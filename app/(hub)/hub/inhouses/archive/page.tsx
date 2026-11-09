import { HubShell } from "../../_components/HubShell";
import { InhouseArchiveClient } from "../InhouseMatchHistoryClient";
import { fetchInhouseMatches } from "@/lib/inhouse-matches";

export const dynamic = "force-dynamic";

export default async function InhouseArchivePage() {
  const liveMatches = await fetchInhouseMatches();

  return (
    <HubShell
      active="inhouses"
      eyebrow="Gameplay System"
      title="Inhouse Archive"
      description="Stored inhouse games with quick access to full post-game reports."
      hideHeader
    >
      <InhouseArchiveClient liveMatches={liveMatches} />
    </HubShell>
  );
}
