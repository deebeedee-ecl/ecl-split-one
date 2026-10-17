import { NextResponse } from "next/server";
import { getInhouseLeaderboardRows } from "@/lib/inhouse-leaderboard";
import { leagueSnapshotChampions } from "@/lib/league-snapshot-champions";
import { riotIdKey } from "@/lib/riot-id";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ladder = await getInhouseLeaderboardRows();
    const profiles = ladder.length ? await prisma.accountProfile.findMany({
      where: { verificationStatus: "VERIFIED", accountStatus: "ACTIVE" },
      select: { riotName: true, riotTag: true, lzyumiRecentStat: true, lzyumiLastLookupAt: true },
    }) : [];
    const identities = new Map<string, typeof profiles>();
    for (const profile of profiles) {
      const key = riotIdKey(profile.riotName, profile.riotTag);
      if (key) identities.set(key, [...(identities.get(key) ?? []), profile]);
    }
    return NextResponse.json({ scope: "all-time", coverage: "full", players: ladder.map(row => {
      const matches = identities.get(riotIdKey(row.riotName, row.riotTag) ?? "") ?? [];
      // Ambiguous profile matches must not attach another account's snapshot.
      const profile = matches.length === 1 ? matches[0] : null;
      return { rank: row.rank, name: row.name, elo: row.elo, gamesPlayed: row.gamesPlayed,
        winRate: row.winRate, teamTag: row.teamName ?? "", championSource: "ecl-snapshot",
        championsUpdatedAt: profile?.lzyumiLastLookupAt?.toISOString() ?? null,
        topChampions: leagueSnapshotChampions(profile?.lzyumiRecentStat),
      };
    }) }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "Inhouse standings are unavailable." }, { status: 503 });
  }
}
