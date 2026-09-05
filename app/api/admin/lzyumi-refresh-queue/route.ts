import { NextResponse } from "next/server";
import { getLzyumiRefreshQueueSnapshot } from "@/lib/lzyumi-refresh-queue";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const queue = await getLzyumiRefreshQueueSnapshot();
    return NextResponse.json(queue);
  } catch (error) {
    console.error("GET /api/admin/lzyumi-refresh-queue error:", error);
    return NextResponse.json(
      { error: "Failed to load ECL.GG refresh queue." },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await prisma.lzyumiRefreshQueue.updateMany({
      where: {
        status: "FAILED",
      },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(),
      },
    });
    const queue = await getLzyumiRefreshQueueSnapshot();

    return NextResponse.json({
      ok: true,
      retried: result.count,
      queue,
    });
  } catch (error) {
    console.error("POST /api/admin/lzyumi-refresh-queue error:", error);
    return NextResponse.json(
      { error: "Failed to retry ECL.GG refresh queue." },
      { status: 500 },
    );
  }
}
