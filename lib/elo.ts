export const STARTING_ELO = 800;
export const PLACEMENT_GAME_COUNT = 3;
export const LP_SCALING_START = 1400;

export function calculateLpChange({
  win,
  kills,
  deaths,
  assists,
  isMVP = false,
  isSVP = false,
  currentElo = STARTING_ELO,
  gamesPlayed = PLACEMENT_GAME_COUNT,
  winStreak,
  lossStreak,
}: {
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  isMVP?: boolean;
  isSVP?: boolean;
  gold?: number;
  damage?: number;
  currentElo?: number;
  gamesPlayed?: number;
  winStreak: number;
  lossStreak: number;
}) {
  const kda = (kills + assists) / Math.max(1, deaths);

  if (gamesPlayed < PLACEMENT_GAME_COUNT) {
    return {
      lpChange: win ? 60 : 0,
      kda: Number(kda.toFixed(2)),
      isPlacement: true,
    };
  }

  const ratingAboveScalingStart = Math.max(0, currentElo - LP_SCALING_START);
  const winScalingPenalty = Math.floor(ratingAboveScalingStart / 25);
  const lossScalingPenalty = Math.floor(ratingAboveScalingStart / 35);
  const streakAdjustment = win
    ? Math.min(4, Math.max(0, winStreak - 1))
    : Math.min(4, Math.max(0, lossStreak - 1));

  const baseWinLp = Math.max(16, 42 - winScalingPenalty - streakAdjustment);
  const baseLossLp = -(32 + lossScalingPenalty + streakAdjustment);
  const awardAdjustment = win && isMVP ? 2 : !win && isSVP ? 2 : 0;
  const lp = win
    ? Math.min(44, baseWinLp + awardAdjustment)
    : Math.max(-52, baseLossLp + awardAdjustment);

  return {
    lpChange: Math.round(lp),
    kda: Number(kda.toFixed(2)),
    isPlacement: false,
  };
}
