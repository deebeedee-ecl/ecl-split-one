import { FlaskConical } from "lucide-react";
import { HubShell } from "../_components/HubShell";
import SplitTwoRegistration from "../../split-ii/SplitTwoRegistration";

export default function DashboardPreview() {
  return (
    <HubShell
      active="dashboard"
      eyebrow="Split II"
      title="Split II: Draft"
      description="Against all odds."
      hideHeader
      theme="blue"
      preview
    >
      <div className="mb-4 flex items-center gap-2 text-xs text-[#a9adb4]">
        <FlaskConical size={14} />
        Design preview / Mock player profile and registrations
      </div>
      <SplitTwoRegistration inDashboard preview />
    </HubShell>
  );
}
