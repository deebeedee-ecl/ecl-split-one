import type { Prisma } from "@prisma/client";
import { isValidatedLzyumiSnapshot } from "@/lib/lzyumi-snapshot";

export type AccountProfileView = "profile" | "settings" | "application" | "reporter";

export type ChampionPoolDto = {
  main: string[];
  learning: string[];
};

export type PrivacySettingsDto = {
  showWechat: boolean;
  showEmail: boolean;
  showRiotId: boolean;
  bannerPositionY: number;
};

export type KookVerificationDto = {
  code: string;
  status: string;
  expiresAt: string;
};

export type PlayerProfileDto = {
  id: string;
  displayName: string;
  riotName: string;
  riotTag: string;
  chinaServerId: string;
  chinaServerName: string;
  primaryRole: string;
  secondaryRole: string;
  currentRank: string;
  nationality: string;
  timezone: string;
  bio: string;
  avatarStyle: string;
  avatarUrl: string;
  bannerUrl: string;
  dashboardTheme: string;
  championPool: ChampionPoolDto;
  privacySettings: PrivacySettingsDto;
  verificationStatus: string;
  accountStatus: string;
  lzyumiLastLookupAt: string | null;
  lzyumiRawProfile: unknown;
  lzyumiRecentStat: unknown;
  lzyumiRankedGames: unknown;
  kookVerifications?: KookVerificationDto[];
};

export type SettingsProfileDto = {
  id: string;
  displayName: string;
  riotName: string;
  riotTag: string;
  chinaServerId: string;
  chinaServerName: string;
  kookUsername: string;
  kookId: string;
  wechatId: string;
  primaryRole: string;
  secondaryRole: string;
  nationality: string;
  timezone: string;
  bio: string;
  avatarStyle: string;
  avatarUrl: string;
  bannerUrl: string;
  dashboardTheme: string;
  championPool: ChampionPoolDto;
  privacySettings: PrivacySettingsDto;
  verificationStatus: string;
  accountStatus: string;
  kookVerifications: KookVerificationDto[];
};

export type ApplicationProfileDto = {
  displayName: string;
  email: string;
  riotName: string;
  riotTag: string;
  primaryRole: string;
  secondaryRole: string;
  verificationStatus: string;
  accountStatus: string;
};

export type ReporterProfileDto = {
  kookId: string | null;
};

const verificationSelect = {
  code: true,
  status: true,
  expiresAt: true,
} as const satisfies Prisma.KookVerificationSelect;

export const accountPlayerProfileSelect = {
  id: true,
  displayName: true,
  riotName: true,
  riotTag: true,
  chinaServerId: true,
  chinaServerName: true,
  primaryRole: true,
  secondaryRole: true,
  currentRank: true,
  nationality: true,
  timezone: true,
  bio: true,
  avatarStyle: true,
  avatarUrl: true,
  bannerUrl: true,
  dashboardTheme: true,
  championPool: true,
  privacySettings: true,
  verificationStatus: true,
  accountStatus: true,
  lzyumiLastLookupAt: true,
  lzyumiRawProfile: true,
  lzyumiRecentStat: true,
  lzyumiRankedGames: true,
  kookVerifications: {
    select: verificationSelect,
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const satisfies Prisma.AccountProfileSelect;

export const accountSettingsProfileSelect = {
  id: true,
  displayName: true,
  riotName: true,
  riotTag: true,
  chinaServerId: true,
  chinaServerName: true,
  kookUsername: true,
  kookId: true,
  wechatId: true,
  primaryRole: true,
  secondaryRole: true,
  nationality: true,
  timezone: true,
  bio: true,
  avatarStyle: true,
  avatarUrl: true,
  bannerUrl: true,
  dashboardTheme: true,
  championPool: true,
  privacySettings: true,
  verificationStatus: true,
  accountStatus: true,
  kookVerifications: {
    select: verificationSelect,
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const satisfies Prisma.AccountProfileSelect;

export const accountApplicationProfileSelect = {
  displayName: true,
  email: true,
  riotName: true,
  riotTag: true,
  primaryRole: true,
  secondaryRole: true,
  verificationStatus: true,
  accountStatus: true,
} as const satisfies Prisma.AccountProfileSelect;

export const accountReporterProfileSelect = {
  kookId: true,
} as const satisfies Prisma.AccountProfileSelect;

type VerificationSource = {
  code: string;
  status: string;
  expiresAt: Date | string;
};

type PlayerProfileSource = {
  id: string;
  displayName: string;
  riotName: string;
  riotTag: string | null;
  chinaServerId: number | null;
  chinaServerName: string | null;
  primaryRole: string | null;
  secondaryRole: string | null;
  currentRank: string | null;
  nationality: string | null;
  timezone: string | null;
  bio: string | null;
  avatarStyle: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  dashboardTheme: string | null;
  championPool: unknown;
  privacySettings: unknown;
  verificationStatus: string;
  accountStatus: string;
  lzyumiLastLookupAt: Date | string | null;
  lzyumiRawProfile: unknown;
  lzyumiRecentStat: unknown;
  lzyumiRankedGames: unknown;
  kookVerifications?: VerificationSource[];
};

type SettingsProfileSource = {
  id: string;
  displayName: string;
  riotName: string;
  riotTag: string | null;
  chinaServerId: number | null;
  chinaServerName: string | null;
  kookUsername: string | null;
  kookId: string | null;
  wechatId: string | null;
  primaryRole: string | null;
  secondaryRole: string | null;
  nationality: string | null;
  timezone: string | null;
  bio: string | null;
  avatarStyle: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  dashboardTheme: string | null;
  championPool: unknown;
  privacySettings: unknown;
  verificationStatus: string;
  accountStatus: string;
  kookVerifications: VerificationSource[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function normalizeChampionPool(value: unknown): ChampionPoolDto {
  const record = asRecord(value);
  const strings = (items: unknown) =>
    Array.isArray(items)
      ? items.filter((item): item is string => typeof item === "string")
      : [];

  return {
    main: strings(record?.main),
    learning: strings(record?.learning),
  };
}

export function normalizePrivacySettings(value: unknown): PrivacySettingsDto {
  const record = asRecord(value);

  return {
    showWechat: typeof record?.showWechat === "boolean" ? record.showWechat : false,
    showEmail: typeof record?.showEmail === "boolean" ? record.showEmail : false,
    showRiotId: typeof record?.showRiotId === "boolean" ? record.showRiotId : true,
    bannerPositionY:
      typeof record?.bannerPositionY === "number" ? record.bannerPositionY : 50,
  };
}

function snapshotMetadata(root: Record<string, unknown>) {
  return {
    _eclSnapshotVersion:
      typeof root._eclSnapshotVersion === "number" ? root._eclSnapshotVersion : undefined,
    _eclFetchedAt: typeof root._eclFetchedAt === "string" ? root._eclFetchedAt : undefined,
  };
}

function displayGames(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => {
          const game = asRecord(entry);
          if (!game) return null;
          return {
            championId:
              typeof game.championId === "string" || typeof game.championId === "number"
                ? game.championId
                : undefined,
            isWin: typeof game.isWin === "number" ? game.isWin : undefined,
            wasMvp: typeof game.wasMvp === "string" ? game.wasMvp : undefined,
            wasSvp: typeof game.wasSvp === "string" ? game.wasSvp : undefined,
            title: typeof game.title === "string" ? game.title : undefined,
            titleTime: typeof game.titleTime === "string" ? game.titleTime : undefined,
          };
        })
        .filter((game): game is NonNullable<typeof game> => Boolean(game))
    : [];
}

export function displayLzyumiProfile(value: unknown) {
  const root = asRecord(value);
  if (!root) return null;
  const data = asRecord(root.data);
  const battleInfo = asRecord(root.battleInfo) ?? asRecord(data?.battleInfo);
  const rows = Array.isArray(battleInfo?.mapOneInfoList)
    ? battleInfo.mapOneInfoList
        .map((entry) => {
          const row = asRecord(entry);
          if (!row) return null;
          return {
            type: typeof row.type === "string" ? row.type : undefined,
            tier: typeof row.tier === "string" ? row.tier : undefined,
            winPoint: typeof row.winPoint === "number" ? row.winPoint : undefined,
            wins: typeof row.wins === "number" ? row.wins : undefined,
            losses: typeof row.losses === "number" ? row.losses : undefined,
            total: typeof row.total === "number" ? row.total : undefined,
            rate: typeof row.rate === "number" ? row.rate : undefined,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
    : [];

  return {
    ...snapshotMetadata(root),
    data: displayGames(root.data),
    battleInfo: { mapOneInfoList: rows },
  };
}

export function displayLzyumiRecentStat(value: unknown) {
  const root = asRecord(value);
  if (!root) return null;
  const data = asRecord(root.data);
  const recentState = asRecord(data?.recentState);
  const champions = Array.isArray(recentState?.common_use_champions)
    ? recentState.common_use_champions
        .map((entry) => {
          const champion = asRecord(entry);
          if (!champion || typeof champion.key !== "number" || typeof champion.value !== "number") {
            return null;
          }
          return { key: champion.key, value: champion.value };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : [];

  return {
    ...snapshotMetadata(root),
    data: {
      recentState: {
        kda: typeof recentState?.kda === "number" ? recentState.kda : undefined,
        common_use_champions: champions,
      },
    },
  };
}

export function displayLzyumiRankedGames(value: unknown) {
  const root = asRecord(value);
  if (!root) return null;

  return {
    ...snapshotMetadata(root),
    soloGames: displayGames(root.soloGames),
    flexGames: displayGames(root.flexGames),
  };
}

function verificationDto(value: VerificationSource): KookVerificationDto {
  return {
    code: value.code,
    status: value.status,
    expiresAt:
      value.expiresAt instanceof Date ? value.expiresAt.toISOString() : value.expiresAt,
  };
}

export function toPlayerProfileDto(profile: PlayerProfileSource): PlayerProfileDto {
  const hasProfileSnapshot = isValidatedLzyumiSnapshot(profile.lzyumiRawProfile);

  return {
    id: profile.id,
    displayName: profile.displayName,
    riotName: profile.riotName,
    riotTag: profile.riotTag ?? "",
    chinaServerId: profile.chinaServerId === null ? "" : String(profile.chinaServerId),
    chinaServerName: profile.chinaServerName ?? "",
    primaryRole: profile.primaryRole ?? "",
    secondaryRole: profile.secondaryRole ?? "",
    currentRank: hasProfileSnapshot ? profile.currentRank ?? "Unranked" : "Unranked",
    nationality: profile.nationality ?? "",
    timezone: profile.timezone ?? "",
    bio: profile.bio ?? "",
    avatarStyle: profile.avatarStyle ?? "crest",
    avatarUrl: profile.avatarUrl ?? "",
    bannerUrl: profile.bannerUrl ?? "",
    dashboardTheme: profile.dashboardTheme ?? "crimson",
    championPool: normalizeChampionPool(profile.championPool),
    privacySettings: normalizePrivacySettings(profile.privacySettings),
    verificationStatus: profile.verificationStatus,
    accountStatus: profile.accountStatus,
    lzyumiLastLookupAt: hasProfileSnapshot
      ? profile.lzyumiLastLookupAt instanceof Date
        ? profile.lzyumiLastLookupAt.toISOString()
        : profile.lzyumiLastLookupAt
      : null,
    lzyumiRawProfile: displayLzyumiProfile(profile.lzyumiRawProfile),
    lzyumiRecentStat: displayLzyumiRecentStat(profile.lzyumiRecentStat),
    lzyumiRankedGames: displayLzyumiRankedGames(profile.lzyumiRankedGames),
    ...(profile.kookVerifications
      ? { kookVerifications: profile.kookVerifications.map(verificationDto) }
      : {}),
  };
}

export function toSettingsProfileDto(profile: SettingsProfileSource): SettingsProfileDto {
  return {
    id: profile.id,
    displayName: profile.displayName,
    riotName: profile.riotName,
    riotTag: profile.riotTag ?? "",
    chinaServerId: profile.chinaServerId === null ? "" : String(profile.chinaServerId),
    chinaServerName: profile.chinaServerName ?? "",
    kookUsername: profile.kookUsername ?? "",
    kookId: profile.kookId ?? "",
    wechatId: profile.wechatId ?? "",
    primaryRole: profile.primaryRole ?? "",
    secondaryRole: profile.secondaryRole ?? "",
    nationality: profile.nationality ?? "",
    timezone: profile.timezone ?? "",
    bio: profile.bio ?? "",
    avatarStyle: profile.avatarStyle ?? "crest",
    avatarUrl: profile.avatarUrl ?? "",
    bannerUrl: profile.bannerUrl ?? "",
    dashboardTheme: profile.dashboardTheme ?? "crimson",
    championPool: normalizeChampionPool(profile.championPool),
    privacySettings: normalizePrivacySettings(profile.privacySettings),
    verificationStatus: profile.verificationStatus,
    accountStatus: profile.accountStatus,
    kookVerifications: profile.kookVerifications.map(verificationDto),
  };
}

export function toApplicationProfileDto(
  profile: Prisma.AccountProfileGetPayload<{ select: typeof accountApplicationProfileSelect }>,
): ApplicationProfileDto {
  return {
    displayName: profile.displayName,
    email: profile.email,
    riotName: profile.riotName,
    riotTag: profile.riotTag ?? "",
    primaryRole: profile.primaryRole ?? "",
    secondaryRole: profile.secondaryRole ?? "",
    verificationStatus: profile.verificationStatus,
    accountStatus: profile.accountStatus,
  };
}

export function toReporterProfileDto(
  profile: Prisma.AccountProfileGetPayload<{ select: typeof accountReporterProfileSelect }>,
): ReporterProfileDto {
  return { kookId: profile.kookId };
}
