export const CHINA_STATS_SERVER_KEYS = ["ionia", "super-server"] as const;

export type ChinaStatsServerKey = (typeof CHINA_STATS_SERVER_KEYS)[number];

export const CHINA_STATS_SERVERS: Record<
  ChinaStatsServerKey,
  {
    key: ChinaStatsServerKey;
    areaId: 1 | 31;
    name: string;
    shortName: string;
    chineseName: string;
  }
> = {
  ionia: {
    key: "ionia",
    areaId: 1,
    name: "Ionia",
    shortName: "IONIA",
    chineseName: "\u827e\u6b27\u5c3c\u4e9a",
  },
  "super-server": {
    key: "super-server",
    areaId: 31,
    name: "Super Server",
    shortName: "SUPER SERVER",
    chineseName: "\u5ce1\u8c37\u4e4b\u5dc5",
  },
};
