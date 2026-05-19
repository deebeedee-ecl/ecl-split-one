import { prisma } from "@/lib/prisma";
import StandingsStageToggle from "@/components/StandingsStageToggle";
import { knockoutBracket } from "@/lib/knockout-bracket";
import { lockedStandings, standingsLocked } from "@/lib/locked-standings";

export const dynamic = "force-dynamic";

type StandingRow = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  played: number;
  points: number;
  gameW: number;
  gameL: number;
  diff: number;
};

function createRow(
  teamId: string,
  teamName: string,
  logoUrl: string | null
): StandingRow {
  return {
    teamId,
    teamName,
    logoUrl,
    played: 0,
    points: 0,
    gameW: 0,
    gameL: 0,
    diff: 0,
  };
}

// Current BO2 system based on your earlier standings logic
// 2-0 = 2 points
// 1-1 = 1 point each
// 0-2 = 0 points
function getPoints(w: number, l: number) {
  if (w === 2 && l === 0) return 2;
  if (w === 1 && l === 1) return 1;
  return 0;
}

export default async function StandingsPage() {
  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: {
        name: "asc",
      },
    }),
    prisma.match.findMany({
      where: {
        stage: "REGULAR_SEASON",
        status: {
          in: ["COMPLETED", "FORFEIT"],
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    }),
  ]);

  const table = new Map<string, StandingRow>();

  for (const team of teams) {
    table.set(team.id, createRow(team.id, team.name, team.logoUrl ?? null));
  }

  for (const match of matches) {
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);

    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    home.gameW += match.homeScore;
    home.gameL += match.awayScore;

    away.gameW += match.awayScore;
    away.gameL += match.homeScore;

    home.points += getPoints(match.homeScore, match.awayScore);
    away.points += getPoints(match.awayScore, match.homeScore);
  }

  const liveStandings = Array.from(table.values())
    .map((team) => ({
      ...team,
      diff: team.gameW - team.gameL,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.gameW !== a.gameW) return b.gameW - a.gameW;
      return a.teamName.localeCompare(b.teamName);
    });

  const standings = standingsLocked ? lockedStandings : liveStandings;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Expat China League
          </p>

          <h1 className="mt-4 text-5xl font-black uppercase md:text-7xl">
            Standings
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-zinc-300">
            Teams are ranked by points and game difference across the regular
            season. Completed BO2 results update the table automatically.
          </p>
        </div>
      </section>

      <StandingsStageToggle
        standings={standings}
        bracketMatches={knockoutBracket}
      />
    </main>
  );
}
