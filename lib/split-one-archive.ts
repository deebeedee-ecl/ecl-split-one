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

// Calculated from backups/ecl-live-db-safelock-2026-06-16-034850186Z.json.
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
    elo: 1877,
    kda: "3.69",
    winRate: "63%",
  },
};

export const splitOneStandoutAwards: SplitOneStandoutAward[] = [
  {
    "label": "Best KDA",
    "qualifier": "Minimum 8 games",
    "value": "6.84",
    "player": "azzdoc",
    "riotLine": "kaylegap#12755",
    "description": "The cleanest blend of kills, assists, and survival across the split.",
    "icon": "target"
  },
  {
    "label": "Least Deaths",
    "qualifier": "Minimum 8 games",
    "value": "2.6 / game",
    "player": "azzdoc",
    "riotLine": "kaylegap#12755",
    "description": "Low deaths, high discipline, and a lot of denied reset timers.",
    "icon": "shield"
  },
  {
    "label": "Damage Engine",
    "qualifier": "Minimum 8 games",
    "value": "38,274 / game",
    "player": "shidian",
    "riotLine": "每天只睡两小时#42660",
    "description": "The most reliable pressure source in recorded games.",
    "icon": "flame"
  },
  {
    "label": "MVP Magnet",
    "qualifier": "All recorded games",
    "value": "5 MVPs",
    "player": "Joyboy",
    "riotLine": "PagdMo#77120",
    "description": "The player most often tagged as the standout performer.",
    "icon": "trophy"
  },
  {
    "label": "Assist Machine",
    "qualifier": "Minimum 8 games",
    "value": "16.9 / game",
    "player": "Rhino",
    "riotLine": "xrcrhino#69949",
    "description": "Always nearby when the map breaks open.",
    "icon": "assist"
  },
  {
    "label": "Kill Leader",
    "qualifier": "Minimum 8 games",
    "value": "10.6 / game",
    "player": "Dixon",
    "riotLine": "Dixon#65976",
    "description": "The split's sharpest finisher by average kills.",
    "icon": "swords"
  }
];

export const splitOneLockedLeaderboard: SplitOneLeaderboardRow[] = [
  {
    "id": "929a0eda-4ada-455d-84f5-53045d1035b7",
    "name": "Joyboy",
    "riotLine": "PagdMo#77120",
    "teamName": "Exiled Bunzz",
    "teamLogoUrl": "/logos/eb.png",
    "elo": 1973,
    "games": 16,
    "wins": 13,
    "kda": "3.37",
    "mvps": 5,
    "svps": 0
  },
  {
    "id": "d74600b1-321a-4b21-befc-511591629594",
    "name": "Doolittle",
    "riotLine": "Hacker#64961",
    "teamName": "Exiled Bunzz",
    "teamLogoUrl": "/logos/eb.png",
    "elo": 1884,
    "games": 15,
    "wins": 12,
    "kda": "3.83",
    "mvps": 4,
    "svps": 1
  },
  {
    "id": "ea2d375d-c970-4e42-a16a-6a8b8b5dec5a",
    "name": "Exile",
    "riotLine": "DZJOYBOY#56675",
    "teamName": "Exiled Bunzz",
    "teamLogoUrl": "/logos/eb.png",
    "elo": 1883,
    "games": 16,
    "wins": 13,
    "kda": "4.32",
    "mvps": 1,
    "svps": 0
  },
  {
    "id": "2b78a527-4d59-48c8-9a54-a7b37f0ed93d",
    "name": "shidian",
    "riotLine": "每天只睡两小时#42660",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 1877,
    "games": 19,
    "wins": 12,
    "kda": "3.69",
    "mvps": 3,
    "svps": 0
  },
  {
    "id": "55a88aae-5c9b-4bb9-a437-250bed2dfb3e",
    "name": "Vamp",
    "riotLine": "xVamp#71075",
    "teamName": "Exiled Bunzz",
    "teamLogoUrl": "/logos/eb.png",
    "elo": 1827,
    "games": 16,
    "wins": 13,
    "kda": "4.23",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "50830917-e8a5-48ae-9b6d-702880d8afe9",
    "name": "Cass",
    "riotLine": "Zeus#39026",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 1790,
    "games": 19,
    "wins": 12,
    "kda": "2.58",
    "mvps": 2,
    "svps": 2
  },
  {
    "id": "f871ae04-4522-46ef-b455-24dbcaee8f0b",
    "name": "azzdoc",
    "riotLine": "kaylegap#12755",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 1760,
    "games": 12,
    "wins": 9,
    "kda": "6.84",
    "mvps": 3,
    "svps": 1
  },
  {
    "id": "8bf840e1-4add-4222-bbb6-e81c75cdf43f",
    "name": "Rhino",
    "riotLine": "xrcrhino#69949",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 1733,
    "games": 19,
    "wins": 12,
    "kda": "5.65",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "7bb8d524-f56c-45c4-952f-86cc02c7576c",
    "name": "Dixon",
    "riotLine": "Dixon#65976",
    "teamName": "Bean In Your Mum",
    "teamLogoUrl": "/logos/biy.png",
    "elo": 1593,
    "games": 14,
    "wins": 8,
    "kda": "3.60",
    "mvps": 4,
    "svps": 4
  },
  {
    "id": "ddb4b80a-b9f7-4b90-8268-124cecd418fa",
    "name": "jibigua",
    "riotLine": "阿拉丁的金箍棒#18981",
    "teamName": "Exiled Bunzz",
    "teamLogoUrl": "/logos/eb.png",
    "elo": 1467,
    "games": 8,
    "wins": 6,
    "kda": "5.07",
    "mvps": 1,
    "svps": 1
  },
  {
    "id": "658a92ce-831d-422e-9f1a-5f39c2737ad1",
    "name": "biaomei",
    "riotLine": "夜心随风而不逝#39682",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 1443,
    "games": 12,
    "wins": 7,
    "kda": "2.72",
    "mvps": 1,
    "svps": 1
  },
  {
    "id": "09486c9c-e1fd-46a9-af6f-41fcd60cbfc4",
    "name": "Barry",
    "riotLine": "Zeus#11431",
    "teamName": "Exiled Bunzz",
    "teamLogoUrl": "/logos/eb.png",
    "elo": 1424,
    "games": 8,
    "wins": 7,
    "kda": "2.18",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "2ffc645c-8493-4401-8746-b88cf0d27bde",
    "name": "Soul",
    "riotLine": "Soul#67126",
    "teamName": "Bean In Your Mum",
    "teamLogoUrl": "/logos/biy.png",
    "elo": 1423,
    "games": 14,
    "wins": 8,
    "kda": "2.61",
    "mvps": 1,
    "svps": 0
  },
  {
    "id": "9ddcbfc4-18dd-4ea9-8a2a-2d277c6fb63c",
    "name": "Pylon",
    "riotLine": "OptimusPylon#42706",
    "teamName": "Bean In Your Mum",
    "teamLogoUrl": "/logos/biy.png",
    "elo": 1372,
    "games": 14,
    "wins": 8,
    "kda": "2.25",
    "mvps": 1,
    "svps": 0
  },
  {
    "id": "ab16dc69-aaa3-4d4e-ac99-6268274b844f",
    "name": "Cxy",
    "riotLine": "今晚跟我约会好吗#20493",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 1356,
    "games": 7,
    "wins": 5,
    "kda": "3.65",
    "mvps": 2,
    "svps": 1
  },
  {
    "id": "c43386d6-b2f5-4dba-97bc-e85d7088d0a9",
    "name": "Joe",
    "riotLine": "Uunrlu#43247",
    "teamName": "Bean In Your Mum",
    "teamLogoUrl": "/logos/biy.png",
    "elo": 1340,
    "games": 8,
    "wins": 5,
    "kda": "4.69",
    "mvps": 3,
    "svps": 0
  },
  {
    "id": "8c5725ab-553c-48fa-81b2-0011822ecb65",
    "name": "Poopswag",
    "riotLine": "Poopswag#94972",
    "teamName": "Zycope and friends",
    "teamLogoUrl": "/logos/zaf.png",
    "elo": 1302,
    "games": 11,
    "wins": 5,
    "kda": "2.74",
    "mvps": 3,
    "svps": 4
  },
  {
    "id": "74e4a5ca-9a32-4592-b78e-faf1e99064a9",
    "name": "sayk",
    "riotLine": "Lunaris#12624",
    "teamName": "Bean In Your Mum",
    "teamLogoUrl": "/logos/biy.png",
    "elo": 1291,
    "games": 10,
    "wins": 6,
    "kda": "2.97",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "518f44db-db74-47e5-9ce3-7c94cf6b1f19",
    "name": "Beans",
    "riotLine": "Beansabinejr#65349",
    "teamName": "Bean In Your Mum",
    "teamLogoUrl": "/logos/biy.png",
    "elo": 1256,
    "games": 10,
    "wins": 5,
    "kda": "2.96",
    "mvps": 0,
    "svps": 2
  },
  {
    "id": "3f492d76-e839-4f69-b381-7eddc9d35187",
    "name": "Jzck",
    "riotLine": "Jzck#55659",
    "teamName": "Flanmingos",
    "teamLogoUrl": "/logos/fla.png",
    "elo": 1247,
    "games": 9,
    "wins": 4,
    "kda": "2.72",
    "mvps": 2,
    "svps": 2
  },
  {
    "id": "40116e3c-7ff3-49cb-8838-649e46ec9e3a",
    "name": "Cookie",
    "riotLine": "DNAWENTI#93405",
    "teamName": "Zycope and friends",
    "teamLogoUrl": "/logos/zaf.png",
    "elo": 1223,
    "games": 9,
    "wins": 4,
    "kda": "2.77",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "f8b8e0e9-8e56-4d6e-ba5a-39673e3c73f9",
    "name": "Sarat",
    "riotLine": "MrSarat#82147",
    "teamName": "Zycope and friends",
    "teamLogoUrl": "/logos/zaf.png",
    "elo": 1208,
    "games": 11,
    "wins": 5,
    "kda": "2.02",
    "mvps": 1,
    "svps": 0
  },
  {
    "id": "a60c0af7-80e2-4e1e-94fe-87be082b311a",
    "name": "Beef",
    "riotLine": "Somebeef#25650",
    "teamName": "Zycope and friends",
    "teamLogoUrl": "/logos/zaf.png",
    "elo": 1199,
    "games": 7,
    "wins": 4,
    "kda": "2.79",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "12503205-46da-4c40-a951-131910d95d7f",
    "name": "MrSafaaa#34459",
    "riotLine": "MrSafaaa#34459",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 1173,
    "games": 5,
    "wins": 3,
    "kda": "2.15",
    "mvps": 1,
    "svps": 0
  },
  {
    "id": "dc44e499-12d4-4caa-99a2-ad989bd843df",
    "name": "Zycope",
    "riotLine": "Zycoped#33732",
    "teamName": "Zycope and friends",
    "teamLogoUrl": "/logos/zaf.png",
    "elo": 1126,
    "games": 8,
    "wins": 4,
    "kda": "1.91",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "374aeaf5-eee1-42de-ada3-5c6a96ee260d",
    "name": "Flan",
    "riotLine": "Flan#55511",
    "teamName": "Flanmingos",
    "teamLogoUrl": "/logos/fla.png",
    "elo": 1059,
    "games": 11,
    "wins": 3,
    "kda": "2.18",
    "mvps": 2,
    "svps": 0
  },
  {
    "id": "52dde1af-68fe-4561-944a-7823e7264919",
    "name": "Shenric#25983",
    "riotLine": "Shenric#25983",
    "teamName": "Flanmingos",
    "teamLogoUrl": "/logos/fla.png",
    "elo": 1056,
    "games": 12,
    "wins": 3,
    "kda": "2.79",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "062537d5-50fe-4852-a841-a8d53732b0b2",
    "name": "kobe",
    "riotLine": "扣一复活科比#18207",
    "teamName": "Flanmingos",
    "teamLogoUrl": "/logos/fla.png",
    "elo": 1030,
    "games": 9,
    "wins": 2,
    "kda": "2.23",
    "mvps": 0,
    "svps": 3
  },
  {
    "id": "fad99fa6-302e-44f0-be52-a7a47241f3bb",
    "name": "Tim",
    "riotLine": "Footjob#71527",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 1029,
    "games": 4,
    "wins": 1,
    "kda": "2.41",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "517243df-5c5c-43d7-bf04-dec68e22cc6e",
    "name": "David",
    "riotLine": "JeanCultamaire#32640",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 1025,
    "games": 12,
    "wins": 2,
    "kda": "1.93",
    "mvps": 2,
    "svps": 4
  },
  {
    "id": "073ab8db-37fa-4f6a-b12f-92419b418027",
    "name": "Rok",
    "riotLine": "ROK#54113",
    "teamName": "Flanmingos",
    "teamLogoUrl": "/logos/fla.png",
    "elo": 1022,
    "games": 3,
    "wins": 1,
    "kda": "1.33",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "4e7d88de-8a8e-4b0b-aff2-875d9ef199e1",
    "name": "Mozartora",
    "riotLine": "Dpzd#47031",
    "teamName": "Zycope and friends",
    "teamLogoUrl": "/logos/zaf.png",
    "elo": 1004,
    "games": 3,
    "wins": 1,
    "kda": "2.18",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "3adcb3d7-900a-4d0c-83bd-0b89bc4e4136",
    "name": "Louis",
    "riotLine": "MANBAOUT#34819",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 1001,
    "games": 8,
    "wins": 2,
    "kda": "2.25",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "29f20198-5960-4acc-b335-3d22b82780a8",
    "name": "Prinomta",
    "riotLine": "Prinomta#65454",
    "teamName": "Flanmingos",
    "teamLogoUrl": "/logos/fla.png",
    "elo": 995,
    "games": 12,
    "wins": 3,
    "kda": "2.17",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "58bbf964-1d92-4468-b91d-895a74c57e33",
    "name": "Raphael",
    "riotLine": "Femboy#22014",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 979,
    "games": 12,
    "wins": 2,
    "kda": "1.87",
    "mvps": 0,
    "svps": 4
  },
  {
    "id": "11ad3446-9ae5-4a01-8525-aa3a9bc1753a",
    "name": "deebeedee",
    "riotLine": "deebeedee#34323",
    "teamName": "Flanmingos",
    "teamLogoUrl": "/logos/fla.png",
    "elo": 970,
    "games": 2,
    "wins": 0,
    "kda": "2.30",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "54062c9d-d9ed-4f9b-b36e-d82333f3a1bb",
    "name": "WEILA",
    "riotLine": "WEILA#51722",
    "teamName": "Zycope and friends",
    "teamLogoUrl": "/logos/zaf.png",
    "elo": 943,
    "games": 3,
    "wins": 0,
    "kda": "1.93",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "10fae423-7408-4148-b445-1f6e2a389320",
    "name": "Danica",
    "riotLine": "Danicat#62108",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 939,
    "games": 2,
    "wins": 0,
    "kda": "1.73",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "c447f55e-6176-469b-b8bf-1c7fc6bc40b2",
    "name": "Jake",
    "riotLine": "Faker#56863",
    "teamName": "niuniupower",
    "teamLogoUrl": "/logos/niu.png",
    "elo": 939,
    "games": 2,
    "wins": 0,
    "kda": "1.43",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "4d35c1dc-7332-47d7-a802-c36de7952898",
    "name": "Romeo",
    "riotLine": "Sheniqua#18831",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 934,
    "games": 12,
    "wins": 2,
    "kda": "2.51",
    "mvps": 0,
    "svps": 1
  },
  {
    "id": "f1e68ec0-5277-48cb-9631-6dd83e96f79b",
    "name": "DioKan",
    "riotLine": "DioLadro#16490",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 908,
    "games": 8,
    "wins": 1,
    "kda": "1.74",
    "mvps": 0,
    "svps": 0
  },
  {
    "id": "68e6d18d-1a1f-4c78-87c1-9dfb61105285",
    "name": "Fina",
    "riotLine": "BDA#57212",
    "teamName": "Make France Great Again",
    "teamLogoUrl": "/logos/mfg.png",
    "elo": 888,
    "games": 4,
    "wins": 0,
    "kda": "1.24",
    "mvps": 0,
    "svps": 0
  }
];
