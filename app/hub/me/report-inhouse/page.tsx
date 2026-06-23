import { HubShell } from "../../_components/HubShell";
import ReportInhouseClient from "./ReportInhouseClient";

export default function ReportInhousePage() {
  return (
    <HubShell
      active="profile"
      eyebrow="Inhouse"
      title="Report Inhouse Game"
      description="Review the detected game and confirm before submitting."
    >
      <ReportInhouseClient />
    </HubShell>
  );
}
