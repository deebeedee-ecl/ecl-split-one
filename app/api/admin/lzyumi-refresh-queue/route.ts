import { NextResponse } from "next/server";
import { getLzyumiRefreshQueueSnapshot } from "@/lib/lzyumi-refresh-queue";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const queue = await getLzyumiRefreshQueueSnapshot();
    return NextResponse.json(queue);
  } catch (error) {
    console.error("GET /api/admin/lzyumi-refresh-queue error:", error);
    return NextResponse.json(
      { error: "Failed to load ecl.gg refresh queue." },
      { status: 500 },
    );
  }
}
