import { HubShell } from "../../_components/HubShell";
import { prisma } from "@/lib/prisma";
import { formatCountryLabel } from "@/lib/world-cup-countries";
import { ApplicationForm } from "./ApplicationForm";
import { parseWorldCupApplication } from "@/lib/world-cup-applications";
import { WorldCupNav } from "../WorldCupNav";

export const dynamic = "force-dynamic";

type TeamPlayer = {
  teamCountry?: string;
  teamCountryCode?: string;
  teamCountryFlag?: string;
  nationality?: string;
  countryCode?: string;
  countryFlag?: string;
};

function teamCountryLabel(players: TeamPlayer[]) {
  const first = players.find(
    (player) =>
      player.teamCountry ||
      player.teamCountryCode ||
      player.teamCountryFlag ||
      player.nationality ||
      player.countryCode ||
      player.countryFlag,
  );

  return formatCountryLabel({
    flag: first?.teamCountryFlag || first?.countryFlag,
    countryName: first?.teamCountry || first?.nationality,
    countryCode: first?.teamCountryCode || first?.countryCode,
  });
}

export default async function WorldCupApplyPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialTeamId = Array.isArray(params?.teamId) ? params?.teamId[0] : params?.teamId;

  const [teams, applications] = await Promise.all([
    prisma.teamRegistration.findMany({
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        teamName: true,
        players: true,
      },
    }),
    prisma.freeAgentRegistration.findMany({
      where: {
        notes: {
          contains: "World Cup Team Application",
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <HubShell
      active="world-cup"
      eyebrow="World Cup"
      title="Apply For Team"
      description="Send a World Cup roster application into admin review."
      theme="blue"
      hideHeader
    >
      <header className="mb-5 border border-[#2d6bff]/30 bg-[#081431]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#70a7ff]">
          World Cup
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
          Apply For Team
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#aebfe4]">
          Pick a roster, sell yourself, and send the application into captain and admin review.
        </p>
      </header>
      <WorldCupNav active="apply" />
      <ApplicationForm
        initialTeamId={initialTeamId}
        teams={teams.map((team) => ({
          id: team.id,
          name: team.teamName,
          countryLabel: teamCountryLabel(
            Array.isArray(team.players) ? (team.players as TeamPlayer[]) : [],
          ),
        }))}
        recentApplications={applications.map((application) => {
          const meta = parseWorldCupApplication(application.notes);

          return {
            id: application.id,
            playerName: application.playerName,
            role: application.primaryRole || "Role pending",
            requestedTeam: meta.requestedTeam || "Any approved roster",
            nationality: meta.nationality || "Nationality pending",
            pitch: meta.pitch,
            status: meta.captainDecision || application.status,
          };
        })}
      />
    </HubShell>
  );
}
