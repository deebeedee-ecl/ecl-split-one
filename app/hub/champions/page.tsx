import { HubShell } from "../_components/HubShell";
import { ChampionsClient } from "./ChampionsClient";
import { getChampionStatsRows } from "@/lib/champion-stats";

export const dynamic = "force-dynamic";

export default async function ChampionsPage() {
  const championRows = await getChampionStatsRows();

  return (
    <HubShell
      active="champions"
      eyebrow="Champion Intelligence"
      title="Champions"
      description="Champion stats for ECL inhouse games, player pools, MVP picks, and matchup trends."
    >
      <ChampionsClient championRows={championRows} />
    </HubShell>
  );
}
