import { HubShell } from "../_components/HubShell";
import PlayerProfileView from "@/components/account/PlayerProfileView";

export default function MyProfilePage() {
  return (
    <HubShell
      active="profile"
      eyebrow="Player Identity"
      title="My Profile"
      description="Your player card, ECL stats, champion pool, match history, and verification status."
    >
      <PlayerProfileView />
    </HubShell>
  );
}
