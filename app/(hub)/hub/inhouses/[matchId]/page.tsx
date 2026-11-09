import { HubShell } from "../../_components/HubShell";
import { InhouseMatchDetailClient } from "../InhouseMatchHistoryClient";
import { fetchInhouseMatches } from "@/lib/inhouse-matches";

export const dynamic = "force-dynamic";

export default async function InhouseMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const liveMatches = await fetchInhouseMatches();

  return (
    <HubShell
      active="inhouses"
      eyebrow="Gameplay System"
      title="Inhouse Report"
      description="Full match statistics, draft, damage, objectives, and standouts."
      hideHeader
    >
      <InhouseMatchDetailClient matchId={matchId} liveMatches={liveMatches} />
    </HubShell>
  );
}
