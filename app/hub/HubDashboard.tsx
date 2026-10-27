import SplitTwoRegistration from "../split-ii/SplitTwoRegistration";
import { HubShell } from "./_components/HubShell";
import MatchupCarousel from '../split-ii/MatchupCarousel';

export default function HubDashboard({splitTwo=false}:{splitTwo?:boolean}) {
  return (
    <HubShell
      active={splitTwo?'split-ii':'dashboard'}
      eyebrow="Split II"
      title="Split II: Draft"
      description="The next chapter of Expat China League."
      hideHeader
      theme="blue"
    >
      {splitTwo?<SplitTwoRegistration inDashboard />:<MatchupCarousel/>}
    </HubShell>
  );
}
