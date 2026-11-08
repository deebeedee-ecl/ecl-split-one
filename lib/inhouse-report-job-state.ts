export const DISCOVERY_PENDING_STATUSES = ["PENDING", "PROCESSING"] as const;
export const CONFIRMATION_PENDING_STATUSES = ["CONFIRM_PENDING", "CONFIRM_PROCESSING"] as const;

export type ReportJobAction = "DISCOVER" | "CONFIRM";

export function reportJobAction(status: string): ReportJobAction | null {
  if (status === "PENDING" || status === "PROCESSING") return "DISCOVER";
  if (status === "CONFIRM_PENDING" || status === "CONFIRM_PROCESSING") return "CONFIRM";
  return null;
}

export function claimedReportJobStatus(action: ReportJobAction) {
  return action === "CONFIRM" ? "CONFIRM_PROCESSING" : "PROCESSING";
}
