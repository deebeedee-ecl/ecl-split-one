import { HubShell } from "../../_components/HubShell";
import { InhouseMatchDetailClient } from "../InhouseMatchHistoryClient";

export default async function InhouseMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  return (
    <HubShell
      active="inhouses"
      eyebrow="Gameplay System"
      title="Inhouse Report"
      description="Full match statistics, draft, damage, objectives, and standouts."
      hideHeader
    >
      <InhouseMatchDetailClient matchId={matchId} />
    </HubShell>
  );
}
