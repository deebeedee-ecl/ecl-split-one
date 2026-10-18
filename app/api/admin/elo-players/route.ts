import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankedSeason, loadRankedSeasonStates } from "@/lib/ranked-season";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const season = getRankedSeason();
    const players = await prisma.player.findMany({
      orderBy: [{ name: "asc" }],
      take: 500,
      select: {
        id: true,
        name: true,
        riotName: true,
        riotTag: true,
        elo: true,
      },
    });

    const states = season ? await loadRankedSeasonStates(players.map(player => player.id), season) : null;
    return NextResponse.json({ players: players.map(player => ({ ...player, elo: states?.get(player.id)?.displayElo ?? player.elo })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/admin/elo-players error:", error);
    return NextResponse.json({ error: "Failed to load player list." }, { status: 500 });
  }
}
