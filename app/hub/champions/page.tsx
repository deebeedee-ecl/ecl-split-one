import { HubShell } from "../_components/HubShell";
import { ChampionsClient } from "./ChampionsClient";

export default function ChampionsPage() {
  return (
    <HubShell
      active="champions"
      eyebrow="Champion Intelligence"
      title="Champions"
      description="Champion stats for ECL inhouse games, player pools, MVP picks, and matchup trends."
    >
      <ChampionsClient />
    </HubShell>
  );
}
