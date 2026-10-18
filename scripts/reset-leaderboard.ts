// Retired: the old script deleted every MatchGamePlayerStat, including other modes.
// A fresh ranked season is a configured boundary; it must preserve old match history.
console.error("The destructive leaderboard reset has been retired. Use scripts/preview-ranked-season.ts to review a history-preserving season boundary. No database changes were made.");
process.exitCode = 1;
