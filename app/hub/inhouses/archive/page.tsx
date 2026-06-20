import { HubShell } from "../../_components/HubShell";
import { InhouseArchiveClient } from "../InhouseMatchHistoryClient";

export default function InhouseArchivePage() {
  return (
    <HubShell
      active="inhouses"
      eyebrow="Gameplay System"
      title="Inhouse Archive"
      description="Stored inhouse games with quick access to full post-game reports."
      hideHeader
    >
      <InhouseArchiveClient />
    </HubShell>
  );
}
