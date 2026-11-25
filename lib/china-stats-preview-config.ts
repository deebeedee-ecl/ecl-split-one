import "server-only";

export function isChinaStatsPreviewEnabled(
  environment: Partial<Record<"NODE_ENV" | "CHINA_STATS_PREVIEW_ENABLED", string | undefined>> = process.env,
) {
  const configured = environment.CHINA_STATS_PREVIEW_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return environment.NODE_ENV === "development";
}
