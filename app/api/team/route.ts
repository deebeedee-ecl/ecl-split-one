import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        kitUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET /api/team error:", error);

    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawPlayers = Array.isArray(body.players) ? body.players : [];

    const players = rawPlayers.map((player: any) => ({
      playerName: String(player.playerName || "").trim(),
      riotName: String(player.riotName || "").trim(),
      riotTag: String(player.riotTag || "").trim(),
      currentRank: String(player.currentRank || player.rank || "").trim(),
      primaryRole: String(player.primaryRole || "").trim(),
      secondaryRole: String(player.secondaryRole || "").trim(),
    }));

    const team = await prisma.teamRegistration.create({
      data: {
        teamName: String(body.teamName || "").trim(),
        captainName: String(body.captainName || "").trim(),
        captainEmail: String(body.captainEmail || "").trim(),
        players,
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("POST /api/team error:", error);

    return NextResponse.json(
      { error: "Failed to create team registration" },
      { status: 500 }
    );
  }
}