import { HubShell, PlaceholderCard } from "../_components/HubShell";

export default function SearchPage() {
  return (
    <HubShell
      active="search"
      eyebrow="ECL.gg"
      title="Search"
      description="Search architecture for player lookup, profile lookup, match history, champion stats, and inhouse performance."
    >
      <PlaceholderCard
        title="Search Interface Placeholder"
        description="Future unified search input with result cards for players, Riot IDs, champions, matches, and inhouse performance."
        tall
      />
    </HubShell>
  );
}
