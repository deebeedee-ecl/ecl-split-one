import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    return NextResponse.json({ players });
  } catch (error) {
    console.error("GET /api/admin/elo-players error:", error);
    return NextResponse.json({ error: "Failed to load player list." }, { status: 500 });
  }
}
