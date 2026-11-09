import { headers } from "next/headers";
import { HubShell } from "../_components/HubShell";
import { ChampionsClient } from "./ChampionsClient";
import { getChampionStatsRows } from "@/lib/champion-stats";
import {
  PERFORMANCE_REQUEST_HEADER,
  withPerformanceTrace,
} from "@/lib/performance-timing";

export const dynamic = "force-dynamic";

export default async function ChampionsPage() {
  const requestHeaders = await headers();
  return withPerformanceTrace({
    route: "hub.champions.page",
    requestId: requestHeaders.get(PERFORMANCE_REQUEST_HEADER),
  }, async (trace) => {
    const championRows = await trace.phase("server.read-model", getChampionStatsRows);

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
  });
}
