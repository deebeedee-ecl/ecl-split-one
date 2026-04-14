import { NextResponse } from "next/server";
import { resetGameStats } from "@/lib/reset-game-stats";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const matchId = String(body.matchId || "").trim();
    const gameNumber = Number(body.gameNumber);

    if (!matchId) {
      return NextResponse.json(
        { success: false, error: "Missing matchId." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(gameNumber) || gameNumber < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid gameNumber." },
        { status: 400 }
      );
    }

    const result = await resetGameStats(matchId, gameNumber);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/reset-game-stats error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset game stats.",
      },
      { status: 500 }
    );
  }
}