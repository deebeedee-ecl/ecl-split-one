import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";
import { riotIdKey } from "@/lib/riot-id";
import { parseWorldCupApplication } from "@/lib/world-cup-applications";

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  captainProfileId?: string;
  captainUserId?: string;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

function realPlayers(players: unknown) {
  return Array.isArray(players)
    ? (players as TeamPlayer[]).filter((player) =>
        Boolean(clean(player.playerName) || clean(player.name) || clean(player.riotName) || clean(player.riotTag)),
      )
    : [];
}

function metadataPlayers(players: unknown) {
  return Array.isArray(players) ? (players as TeamPlayer[]) : [];
}

export async function GET(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { userId: account.id },
    select: {
      id: true,
      userId: true,
      displayName: true,
      riotName: true,
      riotTag: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ status: "no-profile" });
  }

  const [teams, applications] = await Promise.all([
    prisma.teamRegistration.findMany({
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        teamName: true,
        captainName: true,
        players: true,
        status: true,
        submittedAt: true,
      },
    }),
    prisma.freeAgentRegistration.findMany({
      where: {
        riotName: profile.riotName,
        riotTag: profile.riotTag,
        notes: { contains: "World Cup Team Application" },
      },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        status: true,
        notes: true,
        submittedAt: true,
      },
    }),
  ]);

  const profileRiotKey = riotIdKey(profile.riotName, profile.riotTag);

  const captainTeam = teams.find((team) => {
    const metadata = metadataPlayers(team.players);
    return metadata.some(
      (player) =>
        player.captainProfileId === profile.id ||
        player.captainUserId === profile.userId,
    );
  });

  if (captainTeam) {
    return NextResponse.json({
      status: "captain",
      role: "captain",
      team: {
        id: captainTeam.id,
        name: captainTeam.teamName,
        status: captainTeam.status,
        captainName: captainTeam.captainName,
        rosterCount: realPlayers(captainTeam.players).length,
      },
    });
  }

  const rosterTeam = teams.find((team) =>
    realPlayers(team.players).some((player) => riotIdKey(player.riotName, player.riotTag) === profileRiotKey),
  );

  if (rosterTeam) {
    return NextResponse.json({
      status: "member",
      role: "member",
      team: {
        id: rosterTeam.id,
        name: rosterTeam.teamName,
        status: rosterTeam.status,
        captainName: rosterTeam.captainName,
        rosterCount: realPlayers(rosterTeam.players).length,
      },
    });
  }

  const activeApplication = applications.find((application) => {
    const meta = parseWorldCupApplication(application.notes);
    return meta.isWorldCup && meta.captainDecision !== "Rejected";
  });

  if (activeApplication) {
    const meta = parseWorldCupApplication(activeApplication.notes);
    return NextResponse.json({
      status: "applied",
      role: "applicant",
      application: {
        id: activeApplication.id,
        status: activeApplication.status,
        requestedTeamId: meta.requestedTeamId,
        requestedTeam: meta.requestedTeam,
        captainDecision: meta.captainDecision,
        submittedAt: activeApplication.submittedAt,
      },
    });
  }

  return NextResponse.json({
    status: "none",
    role: "none",
  });
}
