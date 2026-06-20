import {
  EmptyState,
  HubPage,
  Trophy,
} from "../../hub/_components/HubScaffold";

export default function UpcomingTournamentsPage() {
  return (
    <HubPage
      eyebrow="Tournament Queue"
      title="Upcoming Tournaments"
      description="Upcoming ECL events, registration windows, formats, rosters, and schedules will be announced here."
      icon={Trophy}
    >
      <EmptyState
        title="No upcoming events announced"
        description="Tournament announcements will be posted here when registration dates, formats, and schedules are confirmed."
      />
    </HubPage>
  );
}
