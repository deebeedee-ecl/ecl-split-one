import { getEloRuleConfig } from "@/lib/elo-rule-config";

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
  const rules = getEloRuleConfig();

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
  const winStreakBonus = Math.max(0, winStreak - 1) * rules.winStreakBonus;
  const lossStreakPenalty = Math.max(0, lossStreak - 1) * rules.lossStreakPenalty;

  const winBase = Math.max(1, rules.baseWinLp - winScalingPenalty + winStreakBonus);
  const lossBase = Math.max(1, rules.baseLossLp + lossScalingPenalty + lossStreakPenalty);
  const lp = win
    ? winBase + (isMVP ? rules.mvpBonus : 0)
    : -Math.max(0, lossBase - (isSVP ? rules.svpLossReduction : 0));

  return {
    lpChange: Math.round(lp),
    kda: Number(kda.toFixed(2)),
    isPlacement: false,
  };
}
