import { NextResponse } from "next/server";
import { getInhouseLeaderboardRows } from "@/lib/inhouse-leaderboard";
import { leagueSnapshotChampions } from "@/lib/league-snapshot-champions";
import { riotIdKey } from "@/lib/riot-id";
import { prisma } from "@/lib/prisma";
import { getRankedSeason } from "@/lib/ranked-season";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const season = getRankedSeason();
    const ladder = await getInhouseLeaderboardRows(season);
    const profiles = ladder.length ? await prisma.accountProfile.findMany({
      where: { verificationStatus: "VERIFIED", accountStatus: "ACTIVE" },
      select: { riotName: true, riotTag: true, lzyumiRecentStat: true, lzyumiLastLookupAt: true },
    }) : [];
    const identities = new Map<string, typeof profiles>();
    for (const profile of profiles) {
      const key = riotIdKey(profile.riotName, profile.riotTag);
      if (key) identities.set(key, [...(identities.get(key) ?? []), profile]);
    }
    return NextResponse.json({ scope: season ? "season" : "all-time", season: season ? { id: season.id, name: season.name, startedAt: season.startedAt.toISOString() } : null, coverage: "full", players: ladder.map(row => {
      const matches = identities.get(riotIdKey(row.riotName, row.riotTag) ?? "") ?? [];
      // Ambiguous profile matches must not attach another account's snapshot.
      const profile = matches.length === 1 ? matches[0] : null;
      return { rank: row.rank, name: row.name, elo: row.elo, gamesPlayed: row.gamesPlayed,
        winRate: row.winRate, teamTag: row.teamName ?? "", championSource: "ecl-snapshot",
        championsUpdatedAt: profile?.lzyumiLastLookupAt?.toISOString() ?? null,
        topChampions: leagueSnapshotChampions(profile?.lzyumiRecentStat),
      };
    }) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Inhouse standings are unavailable." }, { status: 503 });
  }
}
