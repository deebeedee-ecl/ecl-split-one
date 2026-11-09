import AccountDashboard from "@/components/account/AccountDashboard";
import { HubShell } from "../_components/HubShell";

export default function SettingsPage() {
  return (
    <HubShell
      active="settings"
      eyebrow="Account Controls"
      title="Account Settings"
      description="Edit your ECL account, Riot ID, KOOK verification, privacy, and Hub preferences."
    >
      <AccountDashboard />
    </HubShell>
  );
}
