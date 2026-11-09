import { headers } from "next/headers";
import { HubShell } from "../_components/HubShell";
import { InhouseMatchHistoryClient } from "./InhouseMatchHistoryClient";
import { fetchInhouseMatches } from "@/lib/inhouse-matches";
import {
  PERFORMANCE_REQUEST_HEADER,
  withPerformanceTrace,
} from "@/lib/performance-timing";

export const dynamic = "force-dynamic";

export default async function InhousesPage() {
  const requestHeaders = await headers();
  return withPerformanceTrace({
    route: "hub.inhouses.page",
    requestId: requestHeaders.get(PERFORMANCE_REQUEST_HEADER),
  }, async (trace) => {
    const liveMatches = await trace.phase("server.read-model", fetchInhouseMatches);

    return (
      <HubShell
        active="inhouses"
        eyebrow="Gameplay System"
        title="Inhouses"
        description="Match history, drafts, player stats, objectives, and post-game reports for ranked inhouses."
        hideHeader
      >
        <InhouseMatchHistoryClient liveMatches={liveMatches} />
      </HubShell>
    );
  });
}
