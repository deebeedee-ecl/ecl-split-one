import { HubShell } from "../../_components/HubShell";
import ReportInhouseClient from "./ReportInhouseClient";

export default function ReportInhousePage() {
  return (
    <HubShell
      active="profile"
      eyebrow="Inhouse"
      title="Report Inhouse Game"
      description="Choose your inhouse session, fetch ECL.GG data, and confirm the correct game."
    >
      <ReportInhouseClient />
    </HubShell>
  );
}
