import { NextResponse } from "next/server";
import { syncAllPlayers } from "@/lib/player-sync";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const result = await syncAllPlayers();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/admin/sync-players error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync players.",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}