import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import PlayerProfileView, { type AccountProfile } from "@/components/account/PlayerProfileView";
import { isValidatedLzyumiSnapshot } from "@/lib/lzyumi-snapshot";
import { prisma } from "@/lib/prisma";
import { HubShell } from "../../_components/HubShell";

export const revalidate = 60;

type PlayerProfilePageProps = {
  params: Promise<{ slug: string }>;
};

const publicProfileSelect = {
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
} as const;

const loadPublicProfile = unstable_cache(
  (id: string) => prisma.accountProfile.findFirst({
    where: { id, verificationStatus: "VERIFIED", accountStatus: "ACTIVE" },
    select: publicProfileSelect,
  }),
  ["public-player-profile-v1"],
  { revalidate: 60 },
);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeChampionPool(value: unknown): AccountProfile["championPool"] {
  const record = asRecord(value);
  const main = Array.isArray(record?.main)
    ? record.main.filter((item): item is string => typeof item === "string")
    : [];
  const learning = Array.isArray(record?.learning)
    ? record.learning.filter((item): item is string => typeof item === "string")
    : [];

  return { main, learning };
}

function normalizePrivacySettings(value: unknown): AccountProfile["privacySettings"] {
  const record = asRecord(value);

  return {
    showWechat: typeof record?.showWechat === "boolean" ? record.showWechat : false,
    showEmail: typeof record?.showEmail === "boolean" ? record.showEmail : false,
    showRiotId: typeof record?.showRiotId === "boolean" ? record.showRiotId : true,
    bannerPositionY:
      typeof record?.bannerPositionY === "number" ? record.bannerPositionY : 50,
  };
}

function publicSnapshotMetadata(root: Record<string, unknown>) {
  return {
    _eclSnapshotVersion:
      typeof root._eclSnapshotVersion === "number" ? root._eclSnapshotVersion : undefined,
    _eclFetchedAt: typeof root._eclFetchedAt === "string" ? root._eclFetchedAt : undefined,
  };
}

function publicLzyumiProfile(value: unknown) {
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
  const games = Array.isArray(root.data)
    ? root.data
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

  return {
    ...publicSnapshotMetadata(root),
    data: games,
    battleInfo: { mapOneInfoList: rows },
  };
}

function publicLzyumiRecentStat(value: unknown) {
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
    ...publicSnapshotMetadata(root),
    data: {
      recentState: {
        kda: typeof recentState?.kda === "number" ? recentState.kda : undefined,
        common_use_champions: champions,
      },
    },
  };
}

function publicLzyumiRankedGames(value: unknown) {
  const root = asRecord(value);
  if (!root) return null;
  const sanitizeGames = (games: unknown) =>
    Array.isArray(games)
      ? games
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

  return {
    ...publicSnapshotMetadata(root),
    soloGames: sanitizeGames(root.soloGames),
    flexGames: sanitizeGames(root.flexGames),
  };
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { slug } = await params;

  const profile = await loadPublicProfile(slug);

  if (!profile) {
    notFound();
  }

  const hasValidatedProfileSnapshot = isValidatedLzyumiSnapshot(profile.lzyumiRawProfile);

  const publicProfile: AccountProfile = {
    id: profile.id,
    email: "",
    displayName: profile.displayName,
    riotName: profile.riotName,
    riotTag: profile.riotTag,
    chinaServerId:
      profile.chinaServerId === null || profile.chinaServerId === undefined
        ? ""
        : String(profile.chinaServerId),
    chinaServerName: profile.chinaServerName ?? "",
    openId: "",
    kookUsername: "",
    kookId: "",
    wechatId: "",
    primaryRole: profile.primaryRole ?? "",
    secondaryRole: profile.secondaryRole ?? "",
    currentRank: hasValidatedProfileSnapshot ? profile.currentRank ?? "Unranked" : "Unranked",
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
    lzyumiLastLookupAt: hasValidatedProfileSnapshot
      ? profile.lzyumiLastLookupAt?.toISOString() ?? null
      : null,
    lzyumiRawProfile: publicLzyumiProfile(profile.lzyumiRawProfile),
    lzyumiRecentStat: publicLzyumiRecentStat(profile.lzyumiRecentStat),
    lzyumiRankedGames: publicLzyumiRankedGames(profile.lzyumiRankedGames),
  };

  const subtitle = `${profile.riotName}#${profile.riotTag}${
    profile.chinaServerName ? ` / ${profile.chinaServerName}` : ""
  }`;

  return (
    <HubShell
      active="players"
      eyebrow="Player Profile"
      title={profile.displayName}
      description={subtitle}
    >
      <PlayerProfileView initialProfile={publicProfile} showPersonalMatchPreview={false} />
    </HubShell>
  );
}
