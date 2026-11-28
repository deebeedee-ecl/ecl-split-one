import { notFound } from "next/navigation";
import PlayerProfileView from "@/components/account/PlayerProfileView";
import { prisma } from "@/lib/prisma";
import { HubShell } from "../../_components/HubShell";
import { toPublicPlayerProfileDto } from "@/lib/account-profile-dto";

export const dynamic = "force-dynamic";
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

function loadPublicProfile(id: string) {
  return prisma.accountProfile.findFirst({
    where: { id, verificationStatus: "VERIFIED", accountStatus: "ACTIVE" },
    select: publicProfileSelect,
  });
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { slug } = await params;

  const profile = await loadPublicProfile(slug);

  if (!profile) {
    notFound();
  }

  const publicProfile = toPublicPlayerProfileDto(profile);

  const subtitle = publicProfile.privacySettings.showRiotId
    ? `${publicProfile.riotName}#${publicProfile.riotTag}${
        publicProfile.chinaServerName ? ` / ${publicProfile.chinaServerName}` : ""
      }`
    : "Verified ECL player profile";

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
