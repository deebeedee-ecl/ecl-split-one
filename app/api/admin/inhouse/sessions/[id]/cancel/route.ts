import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await prisma.inhouseSession.findUnique({
    where: { id },
    select: { id: true, gameLabel: true, status: true },
  });

  if (!session) {
    return NextResponse.json({ message: "Inhouse session not found." }, { status: 404 });
  }

  if (session.status !== "ASSIGNED") {
    return NextResponse.json(
      { message: `${session.gameLabel ?? "Session"} is already ${session.status}.` },
      { status: 409 },
    );
  }

  const cancelled = await prisma.inhouseSession.update({
    where: { id },
    data: {
      status: "CANCELLED",
    },
    select: {
      id: true,
      gameLabel: true,
      status: true,
    },
  });

  return NextResponse.json({
    ok: true,
    session: cancelled,
    message: `${cancelled.gameLabel ?? "Session"} cancelled.`,
  });
}
