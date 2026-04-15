export function calculateLpChange({
  win,
  kills,
  deaths,
  assists,
  isMVP = false,
  isSVP = false,
  gold,
  damage,
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
  winStreak: number;
  lossStreak: number;
}) {
  let lp = win ? 55 : -28;

  const kda = (kills + assists) / Math.max(1, deaths);

  let kdaBonus = 0;
  if (kda < 1.5) kdaBonus = -5;
  else if (kda < 2.5) kdaBonus = 0;
  else if (kda < 3.5) kdaBonus = 5;
  else if (kda < 5) kdaBonus = 10;
  else kdaBonus = 15;

  lp += kdaBonus;

  if (isMVP) {
    lp += 10;
  }

  // Damage bonus (small but meaningful)
  let damageBonus = 0;
  if (damage !== undefined && damage !== null) {
    if (damage >= 35000) damageBonus = 8;
    else if (damage >= 28000) damageBonus = 6;
    else if (damage >= 22000) damageBonus = 4;
    else if (damage >= 16000) damageBonus = 2;
  }

  lp += damageBonus;

  // Gold bonus (small extra reward)
  let goldBonus = 0;
  if (gold !== undefined && gold !== null) {
    if (gold >= 18000) goldBonus = 6;
    else if (gold >= 15000) goldBonus = 4;
    else if (gold >= 12500) goldBonus = 2;
  }

  lp += goldBonus;

  // Win streak bonus
  if (win) {
    if (winStreak >= 5) lp += 12;
    else if (winStreak === 4) lp += 10;
    else if (winStreak === 3) lp += 6;
    else if (winStreak === 2) lp += 3;
  }

  // Loss streak protection
  if (!win) {
    let protection = 0;

    if (lossStreak >= 5) protection = 10;
    else if (lossStreak === 4) protection = 8;
    else if (lossStreak === 3) protection = 6;
    else if (lossStreak === 2) protection = 3;

    lp += protection;
  }

  // SVP protection on losses
  if (!win && isSVP) {
    lp += 8;
  }

  return {
    lpChange: Math.round(lp),
    kda: Number(kda.toFixed(2)),
  };
}