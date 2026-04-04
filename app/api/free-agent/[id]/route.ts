import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TeamPlayer = {
  freeAgentId?: string;
  playerName?: string;
  riotName?: string;
  riotTag?: string;
  currentRank?: string;
  primaryRole?: string;
  secondaryRole?: string;
  email?: string;
  notes?: string;
};

function normalizePlayers(players: unknown): TeamPlayer[] {
  return Array.isArray(players) ? (players as TeamPlayer[]) : [];
}

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

function isSamePlayer(
  player: TeamPlayer,
  agent: {
    id: string;
    email: string;
    riotName: string;
    riotTag: string;
  }
) {
  const sameFreeAgentId = player.freeAgentId && player.freeAgentId === agent.id;

  const sameEmail =
    player.email &&
    agent.email &&
    player.email.toLowerCase() === agent.email.toLowerCase();

  const sameRiot =
    player.riotName &&
    player.riotTag &&
    agent.riotName &&
    agent.riotTag &&
    player.riotName.toLowerCase() === agent.riotName.toLowerCase() &&
    player.riotTag.toLowerCase() === agent.riotTag.toLowerCase();

  return sameFreeAgentId || sameEmail || sameRiot;
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
        ? body.signedToTeamId
        : existingAgent.signedToTeamId;

    const nextSignedToTeamName =
      body.signedToTeamName !== undefined
        ? body.signedToTeamName
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
      body.riotTag !== undefined ? cleanText(body.riotTag) : existingAgent.riotTag;

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
      body.notes !== undefined ? normalizeNullableText(body.notes) : existingAgent.notes;

    const updatedAgentData = {
      status: nextStatus,
      signedToTeamId: nextSignedToTeamId ?? null,
      signedToTeamName: nextSignedToTeamName ?? null,
      playerName: nextPlayerName,
      email: nextEmail,
      riotName: nextRiotName,
      riotTag: nextRiotTag,
      primaryRole: nextPrimaryRole,
      secondaryRole: nextSecondaryRole,
      currentRank: nextCurrentRank,
      notes: nextNotes,
    };

    const nextAgentIdentity = {
      id: existingAgent.id,
      email: nextEmail,
      riotName: nextRiotName,
      riotTag: nextRiotTag,
    };

    // Remove from old team first if player used to be signed
    if (existingAgent.signedToTeamId) {
      const oldTeam = await prisma.teamRegistration.findUnique({
        where: { id: existingAgent.signedToTeamId },
      });

      if (oldTeam) {
        const oldPlayers = normalizePlayers(oldTeam.players);

        const cleanedOldPlayers = oldPlayers.filter(
          (player) => !isSamePlayer(player, nextAgentIdentity)
        );

        await prisma.teamRegistration.update({
          where: { id: oldTeam.id },
          data: {
            players: cleanedOldPlayers,
          },
        });
      }
    }

    // If the player should now be signed, add them into the selected team's roster
    if (nextStatus === "signed") {
      if (!nextSignedToTeamId || !nextSignedToTeamName) {
        return NextResponse.json(
          { error: "Missing signed team information" },
          { status: 400 }
        );
      }

      const newTeam = await prisma.teamRegistration.findUnique({
        where: { id: nextSignedToTeamId },
      });

      if (!newTeam) {
        return NextResponse.json(
          { error: "Selected team not found" },
          { status: 404 }
        );
      }

      const currentPlayers = normalizePlayers(newTeam.players);

      const playerAlreadyExists = currentPlayers.some((player) =>
        isSamePlayer(player, nextAgentIdentity)
      );

      const newPlayerEntry: TeamPlayer = {
        freeAgentId: existingAgent.id,
        playerName: nextPlayerName,
        riotName: nextRiotName,
        riotTag: nextRiotTag,
        currentRank: nextCurrentRank || "Unranked",
        primaryRole: nextPrimaryRole,
        secondaryRole: nextSecondaryRole || undefined,
        email: nextEmail,
        notes: nextNotes || undefined,
      };

      const updatedPlayers = playerAlreadyExists
        ? currentPlayers.map((player) =>
            isSamePlayer(player, nextAgentIdentity) ? newPlayerEntry : player
          )
        : [...currentPlayers, newPlayerEntry];

      await prisma.teamRegistration.update({
        where: { id: newTeam.id },
        data: {
          players: updatedPlayers,
        },
      });
    }

    const updatedAgent = await prisma.freeAgentRegistration.update({
      where: { id },
      data: updatedAgentData,
    });

    return NextResponse.json(updatedAgent);
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

    if (existingAgent.signedToTeamId) {
      const team = await prisma.teamRegistration.findUnique({
        where: { id: existingAgent.signedToTeamId },
      });

      if (team) {
        const currentPlayers = normalizePlayers(team.players);

        const cleanedPlayers = currentPlayers.filter(
          (player) =>
            !isSamePlayer(player, {
              id: existingAgent.id,
              email: existingAgent.email,
              riotName: existingAgent.riotName,
              riotTag: existingAgent.riotTag,
            })
        );

        await prisma.teamRegistration.update({
          where: { id: team.id },
          data: {
            players: cleanedPlayers,
          },
        });
      }
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