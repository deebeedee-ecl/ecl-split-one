export function calculateLpChange({
  win,
  kills,
  deaths,
  assists,
  isMVP,
  winStreak,
  lossStreak,
}: {
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  isMVP?: boolean;
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

  return {
    lpChange: Math.round(lp),
    kda: Number(kda.toFixed(2)),
  };
}