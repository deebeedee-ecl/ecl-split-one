import { timingSafeEqual } from "node:crypto";
import { purgeExpiredDesktopReports } from "@/lib/desktop-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (process.env.ECL_DESKTOP_RETENTION_ENABLED !== "1" || !expected || expected.length < 32) return Response.json({ message: "Retention cleanup is not configured." }, { status: 503 });
  const received = Buffer.from(request.headers.get("authorization") || ""), wanted = Buffer.from(`Bearer ${expected}`);
  if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) return Response.json({ message: "Unauthorized" }, { status: 401 });
  try { return Response.json(await purgeExpiredDesktopReports(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ message: "Retention cleanup failed." }, { status: 503 }); }
}
