import { HubShell } from "../_components/HubShell";
import { InhouseMatchHistoryClient } from "./InhouseMatchHistoryClient";

export default function InhousesPage() {
  return (
    <HubShell
      active="inhouses"
      eyebrow="Gameplay System"
      title="Inhouses"
      description="Match history, drafts, player stats, objectives, and post-game reports for ranked inhouses."
    >
      <InhouseMatchHistoryClient />
    </HubShell>
  );
}
