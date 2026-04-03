import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const teams = await prisma.teamRegistration.findMany();

    const sorted = teams.sort((a, b) => {
      const order = { pending: 0, approved: 1, rejected: 2 };

      if (
        order[a.status as keyof typeof order] !==
        order[b.status as keyof typeof order]
      ) {
        return (
          order[a.status as keyof typeof order] -
          order[b.status as keyof typeof order]
        );
      }

      return (
        new Date(b.submittedAt).getTime() -
        new Date(a.submittedAt).getTime()
      );
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("GET /api/team error:", error);

    return NextResponse.json(
      { error: "Failed to fetch team registrations" },
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