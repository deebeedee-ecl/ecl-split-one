import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import PlayerProfileView from "@/components/account/PlayerProfileView";
import { prisma } from "@/lib/prisma";
import { HubShell } from "../../_components/HubShell";
import { toPlayerProfileDto } from "@/lib/account-profile-dto";

export const revalidate = 60;
export const preferredRegion = "icn1";

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

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { slug } = await params;

  const profile = await loadPublicProfile(slug);

  if (!profile) {
    notFound();
  }

  const publicProfile = toPlayerProfileDto(profile);

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
