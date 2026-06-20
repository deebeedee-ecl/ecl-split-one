import { notFound } from "next/navigation";
import { HubShell } from "../../_components/HubShell";
import PlayerProfileView from "@/components/account/PlayerProfileView";

type PlayerProfilePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const mockProfiles: Record<string, { name: string; description: string }> = {
  deebeedee: {
    name: "deebeedee",
    description: "Public profile preview for deebeedee.",
  },
};

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { slug } = await params;
  const profile = mockProfiles[slug];

  if (!profile) {
    notFound();
  }

  return (
    <HubShell
      active="players"
      eyebrow="Player Profile"
      title={profile.name}
      description={profile.description}
    >
      <PlayerProfileView />
    </HubShell>
  );
}
