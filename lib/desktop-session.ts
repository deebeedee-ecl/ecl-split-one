import { prisma } from "@/lib/prisma";
export function isDesktopSession(raw: unknown) {
  return !!raw && typeof raw === "object" && "source" in raw && raw.source === "desktop-session-v1";
}
export async function hasDesktopReport(sessionId: string, raw: unknown) {
  if (isDesktopSession(raw)) return true;
  return !!await prisma.inhouseReportJob.findFirst({ where: { sessionId, status: { startsWith: "DESKTOP_" } }, select: { id: true } });
}
