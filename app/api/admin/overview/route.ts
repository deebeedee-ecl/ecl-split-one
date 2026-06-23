import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatRiotId(riotName: string | null, riotTag: string | null) {
  if (!riotName) return "-";
  return riotTag ? `${riotName}#${riotTag}` : riotName;
}

export async function GET() {
  try {
    const weekAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

    const [
      totalProfilesResult,
      gamesPlayedResult,
      newSignupsResult,
      openMessagesResult,
      usersResult,
      matchesResult,
      recentNotesResult,
    ] = await Promise.allSettled([
      prisma.accountProfile.count(),
      prisma.matchGame.count(),
      prisma.accountProfile.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.contactMessage.count({ where: { status: "new" } }),
      prisma.accountProfile.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          displayName: true,
          email: true,
          kookUsername: true,
          kookId: true,
          wechatId: true,
          riotName: true,
          riotTag: true,
          primaryRole: true,
          currentRank: true,
          accountStatus: true,
          verificationStatus: true,
          createdAt: true,
        },
      }),
      prisma.match.findMany({
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
        take: 25,
        include: {
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          games: { select: { durationSeconds: true } },
        },
      }),
      prisma.contactMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          name: true,
          topic: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const totalProfiles = totalProfilesResult.status === "fulfilled" ? totalProfilesResult.value : 0;
    const gamesPlayed = gamesPlayedResult.status === "fulfilled" ? gamesPlayedResult.value : 0;
    const newSignups = newSignupsResult.status === "fulfilled" ? newSignupsResult.value : 0;
    const openMessages = openMessagesResult.status === "fulfilled" ? openMessagesResult.value : 0;
    const users = usersResult.status === "fulfilled" ? usersResult.value : [];
    const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
    const recentNotes = recentNotesResult.status === "fulfilled" ? recentNotesResult.value : [];

    return NextResponse.json({
      metrics: {
        players: totalProfiles,
        gamesPlayed,
        newSignups,
        openReports: openMessages,
      },
      users: users.map((user) => ({
        id: user.id,
        player: user.displayName,
        email: user.email,
        kook: user.kookId || user.kookUsername || "-",
        riot: formatRiotId(user.riotName, user.riotTag),
        wechat: user.wechatId || "-",
        role: user.primaryRole || "-",
        rank: user.currentRank || "Unranked",
        accountStatus: user.accountStatus,
        verificationStatus: user.verificationStatus,
        createdAt: user.createdAt,
      })),
      matches: matches.map((match) => {
        const durationSeconds = match.games.find((game) => game.durationSeconds)?.durationSeconds;
        const minutes = durationSeconds ? Math.floor(durationSeconds / 60) : null;
        const seconds = durationSeconds ? durationSeconds % 60 : null;

        return {
          id: match.id,
          date: match.scheduledAt ?? match.createdAt,
          blue: match.homeTeam.name,
          red: match.awayTeam.name,
          score: `${match.homeScore} - ${match.awayScore}`,
          duration:
            minutes === null || seconds === null
              ? "-"
              : `${minutes}:${String(seconds).padStart(2, "0")}`,
          status: match.status,
          label: match.matchLabel || match.roundLabel || match.stage,
        };
      }),
      recentNotes: recentNotes.map((note) => ({
        id: note.id,
        text: `${note.name} submitted ${String(note.topic || "message").replaceAll("-", " ")} (${note.status})`,
        createdAt: note.createdAt,
      })),
      newsDrafts: [],
    });
  } catch (error) {
    console.error("GET /api/admin/overview error:", error);

    return NextResponse.json(
      { error: "Failed to load admin overview." },
      { status: 500 },
    );
  }
}
