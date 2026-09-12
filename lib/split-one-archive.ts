export type SplitOneStandoutAward = {
  label: string;
  qualifier: string;
  value: string;
  player: string;
  riotLine: string;
  description: string;
  icon: "target" | "shield" | "flame" | "trophy" | "assist" | "swords";
};

export type SplitOneLeaderboardRow = {
  id: string;
  name: string;
  riotLine: string | null;
  teamName: string;
  teamLogoUrl: string | null;
  elo: number;
  games: number;
  wins: number;
  kda: string;
  mvps: number;
  svps?: number;
};

export const splitOneChampionSummary = {
  champion: "Exiled Bunzz",
  championTag: "EB",
  logoUrl: "/logos/eb.png",
  finalsScore: "3-1",
  finalsOpponent: "niuniupower",
  run: "3 Wins",
  crown: "Split 1",
  body:
    "EB are the Spring Split Champions after a 3-1 finals win over niuniupower. NN struck first, then EB answered with three straight games to close the split.",
  mvp: {
    name: "shidian",
    teamName: "niuniupower",
    teamTag: "NIU",
    note: "Top of the ELO board with 19 recorded games for niuniupower.",
    elo: 1847,
    kda: "3.69",
    winRate: "63%",
  },
};

export const splitOneStandoutAwards: SplitOneStandoutAward[] = [
  {
    label: "Best KDA",
    qualifier: "Minimum 8 games",
    value: "6.84",
    player: "azzdoc",
    riotLine: "kaylegaph#12755",
    description: "The cleanest blend of kills, assists, and survival across the split.",
    icon: "target",
  },
  {
    label: "Least Deaths",
    qualifier: "Minimum 8 games",
    value: "2.6 / game",
    player: "azzdoc",
    riotLine: "kaylegaph#12755",
    description: "Low deaths, high discipline, and a lot of denied reset timers.",
    icon: "shield",
  },
  {
    label: "Damage Engine",
    qualifier: "Minimum 8 games",
    value: "38,274 / game",
    player: "shidian",
    riotLine: "每天只睡两小时#42660",
    description: "The most reliable pressure source in recorded games.",
    icon: "flame",
  },
  {
    label: "MVP Magnet",
    qualifier: "All recorded games",
    value: "5 MVPs",
    player: "Joyboy",
    riotLine: "PagdMof#77120",
    description: "The player most often tagged as the standout performer.",
    icon: "trophy",
  },
  {
    label: "Assist Machine",
    qualifier: "Minimum 8 games",
    value: "16.9 / game",
    player: "Rhino",
    riotLine: "xrcrhino#69949",
    description: "Always nearby when the map breaks open.",
    icon: "assist",
  },
  {
    label: "Kill Leader",
    qualifier: "Minimum 8 games",
    value: "10.6 / game",
    player: "Dixon",
    riotLine: "Dixon#65976",
    description: "The split's sharpest finisher by average kills.",
    icon: "swords",
  },
];

export const splitOneLockedLeaderboard: SplitOneLeaderboardRow[] = [
  {
    id: "split-one-joyboy",
    name: "Joyboy",
    riotLine: "PagdMof#77120",
    teamName: "Exiled Bunzz",
    teamLogoUrl: "/logos/eb.png",
    elo: 1973,
    games: 0,
    wins: 0,
    kda: "-",
    mvps: 5,
  },
  {
    id: "split-one-doolittle",
    name: "Doolittle",
    riotLine: "Hacker#64961",
    teamName: "Exiled Bunzz",
    teamLogoUrl: "/logos/eb.png",
    elo: 1884,
    games: 0,
    wins: 0,
    kda: "-",
    mvps: 0,
  },
  {
    id: "split-one-exile",
    name: "Exile",
    riotLine: "DZJOYBOY#56675",
    teamName: "Exiled Bunzz",
    teamLogoUrl: "/logos/eb.png",
    elo: 1883,
    games: 0,
    wins: 0,
    kda: "-",
    mvps: 0,
  },
  {
    id: "split-one-shidian",
    name: "shidian",
    riotLine: "每天只睡两小时#42660",
    teamName: "niuniupower",
    teamLogoUrl: "/logos/niu.png",
    elo: 1877,
    games: 19,
    wins: 12,
    kda: "3.69",
    mvps: 0,
  },
  {
    id: "split-one-vamp",
    name: "Vamp",
    riotLine: "xVamp#71075",
    teamName: "Exiled Bunzz",
    teamLogoUrl: "/logos/eb.png",
    elo: 1827,
    games: 0,
    wins: 0,
    kda: "-",
    mvps: 0,
  },
  {
    id: "split-one-cass",
    name: "Cass",
    riotLine: "Zeus#39026",
    teamName: "niuniupower",
    teamLogoUrl: "/logos/niu.png",
    elo: 1790,
    games: 0,
    wins: 0,
    kda: "-",
    mvps: 0,
  },
  {
    id: "split-one-azzdoc",
    name: "azzdoc",
    riotLine: "kaylegaph#12755",
    teamName: "niuniupower",
    teamLogoUrl: "/logos/niu.png",
    elo: 1760,
    games: 8,
    wins: 0,
    kda: "6.84",
    mvps: 0,
  },
  {
    id: "split-one-rhino",
    name: "Rhino",
    riotLine: "xrcrhino#69949",
    teamName: "niuniupower",
    teamLogoUrl: "/logos/niu.png",
    elo: 1733,
    games: 8,
    wins: 0,
    kda: "-",
    mvps: 0,
  },
  {
    id: "split-one-dixon",
    name: "Dixon",
    riotLine: "Dixon#65976",
    teamName: "Bean In Your Mum",
    teamLogoUrl: "/logos/biy.png",
    elo: 1719,
    games: 8,
    wins: 0,
    kda: "-",
    mvps: 0,
  },
];
