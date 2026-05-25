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

// Regular season standings locked after final results were confirmed.
export const standingsLocked = true;

export const lockedStandings: LockedStandingRow[] = [
  {
    teamId: "e0ea817b-a770-44fe-81ff-9f3906875e83",
    teamName: "Exiled Bunzz",
    logoUrl: "/logos/eb.png",
    played: 5,
    points: 8,
    gameW: 8,
    gameL: 2,
    diff: 6,
  },
  {
    teamId: "3a935485-b3fc-4c4e-9c0a-7184f8f01e60",
    teamName: "niuniupower",
    logoUrl: "/logos/niu.png",
    played: 5,
    points: 7,
    gameW: 7,
    gameL: 3,
    diff: 4,
  },
  {
    teamId: "9a25fe77-db90-4bde-9918-6c34a69e2a8d",
    teamName: "Bean In Your Mum",
    logoUrl: "/logos/biy.png",
    played: 5,
    points: 6,
    gameW: 6,
    gameL: 4,
    diff: 2,
  },
  {
    teamId: "0ce4c650-b196-44ba-baf8-31928e1c48bc",
    teamName: "Flanmingos",
    logoUrl: "/logos/fla.png",
    played: 5,
    points: 3,
    gameW: 3,
    gameL: 7,
    diff: -4,
  },
  {
    teamId: "9011e35c-0268-4503-bd56-0ee86879ce5e",
    teamName: "Zycope and friends",
    logoUrl: "/logos/zaf.png",
    played: 5,
    points: 2,
    gameW: 4,
    gameL: 6,
    diff: -2,
  },
  {
    teamId: "4ec54c7e-3762-4336-a7fc-8be88688e26d",
    teamName: "Make France Great Again",
    logoUrl: "/logos/mfg.png",
    played: 5,
    points: 2,
    gameW: 2,
    gameL: 8,
    diff: -6,
  },
];
