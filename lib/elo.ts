import { getEloRuleConfig } from "@/lib/elo-rule-config";

export const STARTING_ELO = 800;
export const PLACEMENT_GAME_COUNT = 3;
export const LP_SCALING_START = 1400;
export const INACTIVITY_GRACE_DAYS = 7;
export const INACTIVITY_LP_LOSS_PER_DAY = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

function chinaDayNumber(date: Date) {
  return Math.floor((date.getTime() + CHINA_OFFSET_MS) / MS_PER_DAY);
}

function chinaDayOfWeek(date: Date) {
  return new Date(date.getTime() + CHINA_OFFSET_MS).getUTCDay();
}

export function isDoubleLpWinDay(date = new Date()) {
  const day = chinaDayOfWeek(date);
  return day === 4 || day === 5;
}

export function chinaDayBounds(date = new Date()) {
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS);
  const startUtc =
    Date.UTC(
      chinaDate.getUTCFullYear(),
      chinaDate.getUTCMonth(),
      chinaDate.getUTCDate(),
    ) - CHINA_OFFSET_MS;

  return {
    start: new Date(startUtc),
    end: new Date(startUtc + MS_PER_DAY),
  };
}

export function inactivityPenalty(lastPlayedAt?: Date | string | null, now = new Date()) {
  if (!lastPlayedAt) return 0;

  const lastPlayed = lastPlayedAt instanceof Date ? lastPlayedAt : new Date(lastPlayedAt);
  if (Number.isNaN(lastPlayed.getTime())) return 0;

  const inactiveDays = chinaDayNumber(now) - chinaDayNumber(lastPlayed);
  const penaltyDays = Math.max(0, inactiveDays - INACTIVITY_GRACE_DAYS);

  return penaltyDays * INACTIVITY_LP_LOSS_PER_DAY;
}

export function applyInactivityDecay(
  elo: number,
  lastPlayedAt?: Date | string | null,
  now = new Date(),
) {
  return Math.max(0, Math.round(elo - inactivityPenalty(lastPlayedAt, now)));
}

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
  lastPlayedAt,
  playedAt = new Date(),
  hasPlayedOnDoubleLpDay = false,
  doubleLpEligible = false,
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
  lastPlayedAt?: Date | string | null;
  playedAt?: Date;
  hasPlayedOnDoubleLpDay?: boolean;
  doubleLpEligible?: boolean;
}) {
  const kda = (kills + assists) / Math.max(1, deaths);
  const rules = getEloRuleConfig();
  const inactivityLoss = inactivityPenalty(lastPlayedAt, playedAt);
  const effectiveElo = Math.max(0, currentElo - inactivityLoss);

  if (gamesPlayed < PLACEMENT_GAME_COUNT) {
    const placementLp = win ? 60 : 0;
    const doubledPlacementLp =
      win && doubleLpEligible && isDoubleLpWinDay(playedAt) && !hasPlayedOnDoubleLpDay
        ? placementLp * 2
        : placementLp;

    return {
      lpChange: doubledPlacementLp - inactivityLoss,
      kda: Number(kda.toFixed(2)),
      isPlacement: true,
      inactivityLoss,
      doubleLpApplied: doubledPlacementLp !== placementLp,
    };
  }

  const ratingAboveScalingStart = Math.max(0, effectiveElo - LP_SCALING_START);
  const winScalingPenalty = Math.floor(ratingAboveScalingStart / 25);
  const lossScalingPenalty = Math.floor(ratingAboveScalingStart / 35);
  const nextWinStreak = win ? winStreak + 1 : 0;
  const winStreakBonus = nextWinStreak >= 6 ? 30 : nextWinStreak >= 3 ? 15 : 0;
  const lossStreakPenalty = Math.max(0, lossStreak - 1) * rules.lossStreakPenalty;

  const winBase = Math.max(1, rules.baseWinLp - winScalingPenalty + winStreakBonus);
  const lossBase = Math.max(1, rules.baseLossLp + lossScalingPenalty + lossStreakPenalty);
  const resultLp = win
    ? winBase + (isMVP ? rules.mvpBonus : 0)
    : -Math.max(0, lossBase - (isSVP ? rules.svpLossReduction : 0));
  const doubleLpApplied =
    win && doubleLpEligible && isDoubleLpWinDay(playedAt) && !hasPlayedOnDoubleLpDay;
  const lp = (doubleLpApplied ? resultLp * 2 : resultLp) - inactivityLoss;

  return {
    lpChange: Math.round(lp),
    kda: Number(kda.toFixed(2)),
    isPlacement: false,
    inactivityLoss,
    doubleLpApplied,
  };
}
