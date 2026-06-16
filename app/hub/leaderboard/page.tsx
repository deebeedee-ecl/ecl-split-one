import { HubShell } from "../_components/HubShell";
import { RankedLadderClient } from "./RankedLadderClient";

export default function RankedLadderPage() {
  return (
    <HubShell
      active="ladder"
      eyebrow="Ranked Inhouse"
      title="Ranked Ladder"
      description="Season ladder, player form, standout performances, and live competitive notes."
    >
      <RankedLadderClient />
    </HubShell>
  );
}
