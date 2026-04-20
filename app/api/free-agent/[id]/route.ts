import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned === "" ? null : cleaned;
}

function normalizeRank(value: unknown) {
  const cleaned = cleanText(value).toLowerCase();

  if (cleaned.includes("challenger")) return "Challenger";
  if (cleaned.includes("grandmaster")) return "Grandmaster";
  if (cleaned.includes("master")) return "Master";
  if (cleaned.includes("diamond")) return "Diamond";
  if (cleaned.includes("emerald")) return "Emerald";
  if (cleaned.includes("platinum")) return "Platinum";
  if (cleaned.includes("gold")) return "Gold";
  if (cleaned.includes("silver")) return "Silver";
  if (cleaned.includes("bronze")) return "Bronze";
  if (cleaned.includes("iron")) return "Iron";

  return "Unranked";
}

type TeamPlayerJson = {
  freeAgentId?: string;
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  currentRank?: string;
  rank?: string;
  email?: string;
  notes?: string;
};

function sameRosterPlayer(
  player: TeamPlayerJson,
  freeAgentId: string,
  email: string,
  riotName: string,
  riotTag: string,
  playerName: string
) {
  const rosterFreeAgentId = cleanText(player.freeAgentId);
  const rosterEmail = cleanText(player.email).toLowerCase();
  const rosterRiotName = cleanText(player.riotName).toLowerCase();
  const rosterRiotTag = cleanText(player.riotTag).toLowerCase();
  const rosterPlayerName = cleanText(
    typeof player.playerName === "string" ? player.playerName : player.name
  ).toLowerCase();

  const targetEmail = cleanText(email).toLowerCase();
  const targetRiotName = cleanText(riotName).toLowerCase();
  const targetRiotTag = cleanText(riotTag).toLowerCase();
  const targetPlayerName = cleanText(playerName).toLowerCase();

  if (rosterFreeAgentId && rosterFreeAgentId === freeAgentId) return true;
  if (targetEmail && rosterEmail && rosterEmail === targetEmail) return true;

  if (
    targetRiotName &&
    targetRiotTag &&
    rosterRiotName &&
    rosterRiotTag &&
    rosterRiotName === targetRiotName &&
    rosterRiotTag === targetRiotTag
  ) {
    return true;
  }

  if (targetPlayerName && rosterPlayerName && rosterPlayerName === targetPlayerName) {
    return true;
  }

  return false;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const existingAgent = await prisma.freeAgentRegistration.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: "Free agent not found" },
        { status: 404 }
      );
    }

    const nextStatus =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : existingAgent.status;

    const nextSignedToTeamId =
      body.signedToTeamId !== undefined
        ? normalizeNullableText(body.signedToTeamId)
        : existingAgent.signedToTeamId;

    const nextSignedToTeamName =
      body.signedToTeamName !== undefined
        ? normalizeNullableText(body.signedToTeamName)
        : existingAgent.signedToTeamName;

    const nextPlayerName =
      body.playerName !== undefined
        ? cleanText(body.playerName)
        : existingAgent.playerName;

    const nextEmail =
      body.email !== undefined ? cleanText(body.email) : existingAgent.email;

    const nextRiotName =
      body.riotName !== undefined
        ? cleanText(body.riotName)
        : existingAgent.riotName;

    const nextRiotTag =
      body.riotTag !== undefined
        ? cleanText(body.riotTag)
        : existingAgent.riotTag;

    const nextPrimaryRole =
      body.primaryRole !== undefined
        ? cleanText(body.primaryRole)
        : existingAgent.primaryRole;

    const nextSecondaryRole =
      body.secondaryRole !== undefined
        ? normalizeNullableText(body.secondaryRole)
        : existingAgent.secondaryRole;

    const nextCurrentRank =
      body.currentRank !== undefined
        ? normalizeRank(body.currentRank)
        : normalizeRank(existingAgent.currentRank);

    const nextNotes =
      body.notes !== undefined
        ? normalizeNullableText(body.notes)
        : existingAgent.notes;

    const updatedAgentData = {
      status: nextStatus,
      signedToTeamId: nextStatus === "signed" ? nextSignedToTeamId : null,
      signedToTeamName: nextStatus === "signed" ? nextSignedToTeamName : null,
      playerName: nextPlayerName,
      email: nextEmail,
      riotName: nextRiotName,
      riotTag: nextRiotTag,
      primaryRole: nextPrimaryRole,
      secondaryRole: nextSecondaryRole,
      currentRank: nextCurrentRank,
      notes: nextNotes,
    };

    if (
      updatedAgentData.status === "signed" &&
      (!updatedAgentData.signedToTeamId || !updatedAgentData.signedToTeamName)
    ) {
      return NextResponse.json(
        { error: "Missing signed team information" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedAgent = await tx.freeAgentRegistration.update({
        where: { id },
        data: updatedAgentData,
      });

      let matchedPlayer: {
        id: string;
        name: string;
        email: string | null;
        riotName: string | null;
        riotTag: string | null;
        teamId: string | null;
      } | null = null;

      if (nextEmail) {
        matchedPlayer = await tx.player.findFirst({
          where: {
            email: nextEmail,
          },
          select: {
            id: true,
            name: true,
            email: true,
            riotName: true,
            riotTag: true,
            teamId: true,
          },
        });
      }

      if (!matchedPlayer && nextRiotName && nextRiotTag) {
        matchedPlayer = await tx.player.findFirst({
          where: {
            riotName: nextRiotName,
            riotTag: nextRiotTag,
          },
          select: {
            id: true,
            name: true,
            email: true,
            riotName: true,
            riotTag: true,
            teamId: true,
          },
        });
      }

      let playerUpdated = false;
      let teamRosterUpdated = false;
      let warning: string | null = null;

      if (matchedPlayer) {
        await tx.player.update({
          where: {
            id: matchedPlayer.id,
          },
          data: {
            teamId:
              updatedAgent.status === "signed"
                ? updatedAgent.signedToTeamId
                : null,
          },
        });

        playerUpdated = true;
      } else {
        warning =
          "Free agent updated, but no matching Player record was found to sync teamId.";
      }

      const allTeamRegistrations = await tx.teamRegistration.findMany({
        select: {
          id: true,
          teamName: true,
          players: true,
        },
      });

      for (const teamReg of allTeamRegistrations) {
        const existingPlayers = Array.isArray(teamReg.players)
          ? (teamReg.players as TeamPlayerJson[])
          : [];

        const filteredPlayers = existingPlayers.filter(
          (player) =>
            !sameRosterPlayer(
              player,
              updatedAgent.id,
              nextEmail,
              nextRiotName,
              nextRiotTag,
              nextPlayerName
            )
        );

        if (filteredPlayers.length !== existingPlayers.length) {
          await tx.teamRegistration.update({
            where: { id: teamReg.id },
            data: {
              players: filteredPlayers,
            },
          });
        }
      }

      if (updatedAgent.status === "signed" && updatedAgent.signedToTeamId) {
        const savedTeam = await tx.team.findUnique({
          where: {
            id: updatedAgent.signedToTeamId,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!savedTeam) {
          warning = warning
            ? `${warning} Matching team record was not found in prisma.team.`
            : "Matching team record was not found in prisma.team.";
        } else {
          const targetTeamRegistration = await tx.teamRegistration.findFirst({
            where: {
              teamName: savedTeam.name,
            },
            select: {
              id: true,
              teamName: true,
              players: true,
            },
          });

          if (!targetTeamRegistration) {
            warning = warning
              ? `${warning} Matching teamRegistration roster was not found for the selected team.`
              : "Matching teamRegistration roster was not found for the selected team.";
          } else {
            const existingPlayers = Array.isArray(targetTeamRegistration.players)
              ? (targetTeamRegistration.players as TeamPlayerJson[])
              : [];

            const newRosterEntry: TeamPlayerJson = {
              freeAgentId: updatedAgent.id,
              playerName: nextPlayerName || nextRiotName || "Unknown Player",
              riotName: nextRiotName || undefined,
              riotTag: nextRiotTag || undefined,
              primaryRole: nextPrimaryRole || undefined,
              secondaryRole: nextSecondaryRole || undefined,
              currentRank: nextCurrentRank || "Unranked",
              email: nextEmail || undefined,
              notes: nextNotes || undefined,
            };

            const alreadyExists = existingPlayers.some((player) =>
              sameRosterPlayer(
                player,
                updatedAgent.id,
                nextEmail,
                nextRiotName,
                nextRiotTag,
                nextPlayerName
              )
            );

            const nextPlayers = alreadyExists
              ? existingPlayers.map((player) =>
                  sameRosterPlayer(
                    player,
                    updatedAgent.id,
                    nextEmail,
                    nextRiotName,
                    nextRiotTag,
                    nextPlayerName
                  )
                    ? newRosterEntry
                    : player
                )
              : [...existingPlayers, newRosterEntry];

            await tx.teamRegistration.update({
              where: { id: targetTeamRegistration.id },
              data: {
                players: nextPlayers,
              },
            });

            teamRosterUpdated = true;
          }
        }
      }

      return {
        updatedAgent,
        playerUpdated,
        matchedPlayerId: matchedPlayer?.id ?? null,
        teamRosterUpdated,
        warning,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/free-agent/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to update free agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const existingAgent = await prisma.freeAgentRegistration.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: "Free agent not found" },
        { status: 404 }
      );
    }

    await prisma.freeAgentRegistration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/free-agent/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to delete free agent" },
      { status: 500 }
    );
  }
}