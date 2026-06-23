import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type OverrideBody = {
  playerId?: string;
  newElo?: number;
  reason?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as OverrideBody | null;
  const playerId = String(body?.playerId ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  const newElo = Number(body?.newElo);

  if (!playerId) {
    return NextResponse.json({ error: "Player is required." }, { status: 400 });
  }

  if (!Number.isFinite(newElo) || !Number.isInteger(newElo) || newElo < 0 || newElo > 5000) {
    return NextResponse.json({ error: "New ELO must be an integer between 0 and 5000." }, { status: 400 });
  }

  if (!reason) {
    return NextResponse.json({ error: "Admin reason is required." }, { status: 400 });
  }

  try {
    const player = await prisma.player.update({
      where: { id: playerId },
      data: { elo: newElo },
      select: {
        id: true,
        name: true,
        elo: true,
      },
    });

    return NextResponse.json({
      ok: true,
      player,
      note: `Manual ELO override applied to ${player.name}: ${newElo}. Reason: ${reason}`,
    });
  } catch (error) {
    console.error("POST /api/admin/elo-override error:", error);
    return NextResponse.json({ error: "Failed to apply ELO override." }, { status: 500 });
  }
}
