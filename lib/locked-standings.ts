export type LockedStandingRow = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  played: number;
  points: number;
  gameW: number;
  gameL: number;
  diff: number;
};

// Keep this false until the regular season is officially finished.
// When it is time to lock, paste the final table into lockedStandings and
// change standingsLocked to true.
export const standingsLocked = false;

export const lockedStandings: LockedStandingRow[] = [];
