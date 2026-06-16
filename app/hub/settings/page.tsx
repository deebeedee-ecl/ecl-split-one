import {
  HubShell,
  PlaceholderCard,
  PlaceholderGrid,
} from "../_components/HubShell";

export default function SettingsPage() {
  return (
    <HubShell
      active="settings"
      eyebrow="Account Controls"
      title="Settings"
      description="Settings architecture for account identity, Riot ID, KOOK verification, and Hub preferences."
    >
      <PlaceholderGrid columns="two">
        <PlaceholderCard
          title="Account Settings"
          description="Future display name, email, privacy, account status, and profile visibility controls."
        />
        <PlaceholderCard
          title="Riot ID"
          description="Future Riot name, Riot tag, China server details, and lookup connection."
        />
        <PlaceholderCard
          title="KOOK Verification"
          description="Future KOOK identity linking, verification code status, and role sync."
        />
        <PlaceholderCard
          title="Preferences"
          description="Future dashboard theme, notification settings, privacy defaults, and queue preferences."
        />
      </PlaceholderGrid>
    </HubShell>
  );
}
