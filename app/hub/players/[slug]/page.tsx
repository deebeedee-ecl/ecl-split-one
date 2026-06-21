import { notFound } from "next/navigation";
import PlayerProfileView, { type AccountProfile } from "@/components/account/PlayerProfileView";
import { prisma } from "@/lib/prisma";
import { HubShell } from "../../_components/HubShell";

export const dynamic = "force-dynamic";

type PlayerProfilePageProps = {
  params: Promise<{ slug: string }>;
};

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

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { slug } = await params;

  const profile = await prisma.accountProfile.findFirst({
    where: {
      id: slug,
      verificationStatus: "VERIFIED",
      accountStatus: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      chinaServerName: true,
      openId: true,
      kookUsername: true,
      kookId: true,
      wechatId: true,
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
    },
  });

  if (!profile) {
    notFound();
  }

  const publicProfile: AccountProfile = {
    id: profile.id,
    email: profile.email ?? "",
    displayName: profile.displayName,
    riotName: profile.riotName,
    riotTag: profile.riotTag,
    chinaServerId:
      profile.chinaServerId === null || profile.chinaServerId === undefined
        ? ""
        : String(profile.chinaServerId),
    chinaServerName: profile.chinaServerName ?? "",
    openId: profile.openId ?? "",
    kookUsername: profile.kookUsername ?? "",
    kookId: profile.kookId ?? "",
    wechatId: profile.wechatId ?? "",
    primaryRole: profile.primaryRole ?? "",
    secondaryRole: profile.secondaryRole ?? "",
    currentRank: profile.currentRank ?? "Unranked",
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
    lzyumiLastLookupAt: profile.lzyumiLastLookupAt?.toISOString() ?? null,
    lzyumiRawProfile: profile.lzyumiRawProfile,
    lzyumiRecentStat: profile.lzyumiRecentStat,
    lzyumiRankedGames: profile.lzyumiRankedGames,
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
