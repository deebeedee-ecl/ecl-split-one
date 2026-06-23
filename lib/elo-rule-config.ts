export type EloRuleConfig = {
  baseWinLp: number;
  baseLossLp: number;
  mvpBonus: number;
  svpLossReduction: number;
  winStreakBonus: number;
  lossStreakPenalty: number;
};

export const defaultEloRuleConfig: EloRuleConfig = {
  baseWinLp: 24,
  baseLossLp: 18,
  mvpBonus: 4,
  svpLossReduction: 3,
  winStreakBonus: 2,
  lossStreakPenalty: 2,
};

let currentEloRuleConfig: EloRuleConfig = { ...defaultEloRuleConfig };

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function sanitizeEloRuleConfig(input: Partial<EloRuleConfig>): EloRuleConfig {
  return {
    baseWinLp: clampInt(Number(input.baseWinLp ?? currentEloRuleConfig.baseWinLp), 1, 80),
    baseLossLp: clampInt(Number(input.baseLossLp ?? currentEloRuleConfig.baseLossLp), 1, 80),
    mvpBonus: clampInt(Number(input.mvpBonus ?? currentEloRuleConfig.mvpBonus), 0, 20),
    svpLossReduction: clampInt(Number(input.svpLossReduction ?? currentEloRuleConfig.svpLossReduction), 0, 20),
    winStreakBonus: clampInt(Number(input.winStreakBonus ?? currentEloRuleConfig.winStreakBonus), 0, 20),
    lossStreakPenalty: clampInt(Number(input.lossStreakPenalty ?? currentEloRuleConfig.lossStreakPenalty), 0, 20),
  };
}

export function getEloRuleConfig() {
  return { ...currentEloRuleConfig };
}

export function setEloRuleConfig(input: Partial<EloRuleConfig>) {
  currentEloRuleConfig = sanitizeEloRuleConfig(input);
  return getEloRuleConfig();
}

export function resetEloRuleConfig() {
  currentEloRuleConfig = { ...defaultEloRuleConfig };
  return getEloRuleConfig();
}
