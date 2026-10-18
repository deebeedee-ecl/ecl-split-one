export const HUB_DOWNLOAD_URL = "KOOK > ECL HUB DESKTOP APP (channel 5590769063605712). Download the pinned ECL Hub installer there.";
export const HUB_REMINDER = `\u26a0 At least one participating player needs ECL Hub installed, signed in and connected to League, with reporting enabled in Collector.\nDownload/setup: ${HUB_DOWNLOAD_URL}`;
export const REPORTER_REMINDER = `\u26a0 Send this from the KOOK account linked to your ECL Hub. Keep Hub and League open, with Collector > Connect reporting enabled.\nDownload/setup: ${HUB_DOWNLOAD_URL}`;

export function hubSetupMessage() {
  return ["ECL Hub for Windows", HUB_DOWNLOAD_URL, "", "1. Install Hub and sign in with your ECL account.", "2. Open League on the same PC and check Hub is connected.", "3. Collector > Connect reporting. Your verified Riot ID must match League.", "", "After playing: !report IH_NUMBER GAME_ID", "Only the designated reporter needs collection running. All ten players need verified profiles.", "Uploads require administrator review. No automatic LP."].join("\n");
}

export function hubCommandHelp() {
  return ["ECL Commands", "", "!hub - download Hub and connect reporting", "!verify CODE - link your KOOK account", "!me / !rank - your profile and current ladder", "!leaderboard - current top ten", "!inhouse - check the ten-player voice roster", "!ready - balance teams and create the inhouse", "!report IH GAME_ID - request collection from your Hub", "!status IH - check collection/review progress", "!no IH - cancel your unsubmitted report request", "!cancel IH - admin: cancel a specific inhouse", "", "Flow: !inhouse > !ready > play > !report IH GAME_ID > Hub upload > admin review", "No !yes confirmation or automatic LP for app reports."].join("\n");
}

export function inhouseSelector(value: string) {
  const selector = value.trim().replace(/^(?:ih|inhouse)\s*#?\s*/i, "").replace(/^#/, "");
  return /^\d+$/.test(selector) ? selector.replace(/^0+(?=\d)/, "") : selector;
}

export function inhouseNumber(label: string | null) {
  return /\b(?:ih|inhouse)\s*#?\s*0*(\d+)\b/i.exec(label || "")?.[1] || "";
}

export function reportStage(status: string, raw: unknown, now = Date.now()) {
  const expiresAt = (raw as { expiresAt?: number } | null)?.expiresAt;
  if (["DESKTOP_PENDING", "DESKTOP_COLLECTING"].includes(status) && typeof expiresAt === "number" && expiresAt <= now) return { code: "EXPIRED", label: "Collection request expired. Ask the reporter to run !report again." };
  const stages: Record<string, { code: string; label: string }> = {
    DESKTOP_PENDING: { code: "WAITING_FOR_HUB", label: "Waiting for the reporter's Hub to claim the request." },
    DESKTOP_COLLECTING: { code: "COLLECTING", label: "Hub claimed the request. Collection/upload is in progress." },
    DESKTOP_REVIEW: { code: "AWAITING_REVIEW", label: "Match received. All ten ready players and sides matched. Awaiting administrator review." },
    DESKTOP_REVIEWED: { code: "REVIEWED", label: "Administrator review recorded. No result or LP has been applied." },
    DESKTOP_REJECTED: { code: "REJECTED", label: "Administrator rejected this upload. Ask an admin before submitting a replacement." },
    DESKTOP_REVIEW_EXPIRED: { code: "REVIEW_EXPIRED", label: "The raw upload expired before review. Ask an administrator to resolve this session." },
    DESKTOP_CANCELLED: { code: "CANCELLED", label: "The unsubmitted collection request was cancelled." },
    DESKTOP_EXPIRED: { code: "EXPIRED", label: "Collection request expired. Run !report again." },
    DESKTOP_FAILED: { code: "FAILED", label: "Collection attempts were exhausted. Check Hub's local queue and run !report again." },
  };
  return stages[status] ?? { code: "LEGACY_REPORT", label: "This session has an older report. Ask an administrator to resolve it before using Hub." };
}
