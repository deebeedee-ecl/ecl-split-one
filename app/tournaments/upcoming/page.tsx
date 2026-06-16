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
      description="A placeholder for future ECL cups, registration windows, formats, rosters, and schedules."
      icon={Trophy}
    >
      <EmptyState
        title="Upcoming tournament shell"
        description="No production tournament data is connected here yet. This page is ready for future event planning."
      />
    </HubPage>
  );
}
