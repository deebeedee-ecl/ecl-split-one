import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";
import { riotIdKey } from "@/lib/riot-id";
import { parseWorldCupApplication } from "@/lib/world-cup-applications";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { teamId } = await context.params;

  const [profile, team] = await Promise.all([
    prisma.accountProfile.findUnique({
      where: { userId: account.id },
      select: { id: true, userId: true },
    }),
    prisma.teamRegistration.findUnique({
      where: { id: teamId },
      select: { id: true, teamName: true, players: true },
    }),
  ]);

  const teamPlayers = Array.isArray(team?.players) ? team.players as Array<Record<string, unknown>> : [];
  const isCaptain = Boolean(
    profile &&
      team &&
      (teamPlayers.some(
      (player) =>
        String(player.captainProfileId || "") === profile.id ||
        String(player.captainUserId || "") === profile.userId,
      )),
  );

  if (!team || !isCaptain) {
    return NextResponse.json({ error: "Only this team's captain can view applications." }, { status: 403 });
  }

  const applications = await prisma.freeAgentRegistration.findMany({
    where: {
      notes: {
        contains: "World Cup Team Application",
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const teamApplications = applications.filter((application) => {
    const meta = parseWorldCupApplication(application.notes);
    return meta.requestedTeamId === team.id || meta.requestedTeam === team.teamName;
  });

  const keys = teamApplications
    .map((application) => riotIdKey(application.riotName, application.riotTag))
    .filter((key): key is string => Boolean(key));
  const profiles = keys.length
    ? await prisma.accountProfile.findMany({
        where: {
          verificationStatus: "VERIFIED",
          accountStatus: "ACTIVE",
        },
        select: {
          id: true,
          riotName: true,
          riotTag: true,
        },
      })
    : [];
  const profileMap = new Map(
    profiles
      .map((item) => [riotIdKey(item.riotName, item.riotTag), item.id] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0])),
  );

  return NextResponse.json({
    applications: teamApplications.map((application) => {
      const meta = parseWorldCupApplication(application.notes);
      const key = riotIdKey(application.riotName, application.riotTag) ?? "";

      return {
        id: application.id,
        playerName: application.playerName,
        riotId: `${application.riotName}#${application.riotTag}`,
        role: `${application.primaryRole || "Role pending"}${application.secondaryRole ? ` / ${application.secondaryRole}` : ""}`,
        nationality: meta.nationality || "Nationality pending",
        pitch: meta.pitch || "",
        status: application.status,
        captainDecision: meta.captainDecision,
        profileId: profileMap.get(key) ?? "",
      };
    }),
  });
}
