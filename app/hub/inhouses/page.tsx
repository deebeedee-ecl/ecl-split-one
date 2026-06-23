import { HubShell } from "../_components/HubShell";
import { InhouseMatchHistoryClient } from "./InhouseMatchHistoryClient";
import { fetchInhouseMatches } from "@/lib/inhouse-matches";

export default async function InhousesPage() {
  const liveMatches = await fetchInhouseMatches();

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
}
