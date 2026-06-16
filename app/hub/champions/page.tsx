import { HubShell } from "../_components/HubShell";
import { ChampionsClient } from "./ChampionsClient";

export default function ChampionsPage() {
  return (
    <HubShell
      active="champions"
      eyebrow="Champion Intelligence"
      title="Champions"
      description="Champion tiers, usage, and which ECL inhouse players are playing each pick."
    >
      <ChampionsClient />
    </HubShell>
  );
}
