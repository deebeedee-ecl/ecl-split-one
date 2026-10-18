// Approved season boundary, checked into the deployment so every server instance
// uses the same cutover. Existing results remain the archived season ledger.
export const deployedRankedSeason = {
  ECL_RANKED_SEASON_ID: "ranked-2026-10-18",
  ECL_RANKED_SEASON_NAME: "Ranked Season October 2026",
  ECL_RANKED_SEASON_START: "2026-10-18T11:06:20.114Z",
} as const;
