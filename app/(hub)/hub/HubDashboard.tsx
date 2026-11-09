import { HubShell } from "./_components/HubShell";
import { HubSplitTwoRegistration } from "./_components/HubSplitTwoRegistration";

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
      <HubSplitTwoRegistration />
    </HubShell>
  );
}
