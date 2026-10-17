import SplitTwoRegistration from "../split-ii/SplitTwoRegistration";
import { HubShell } from "./_components/HubShell";

export default function HubDashboard() {
  return (
    <HubShell
      active="dashboard"
      eyebrow="Split II"
      title="Split II: Draft"
      description="The next chapter of Expat China League."
      hideHeader
      theme="blue"
    >
      <SplitTwoRegistration inDashboard />
    </HubShell>
  );
}
