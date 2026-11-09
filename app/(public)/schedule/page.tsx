import { KnockoutBracket } from "@/components/StandingsStageToggle";
import { buildKnockoutBracket } from "@/lib/knockout-bracket";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const knockoutMatches = await prisma.match.findMany({
    where: {
      stage: {
        in: ["PLAYOFFS", "SEMIFINALS", "FINALS"],
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      winnerTeam: true,
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });

  const bracketMatches = buildKnockoutBracket(knockoutMatches);
  const syncedMatches = knockoutMatches.filter(
    (match) => match.status === "SCHEDULED"
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Expat China League
          </p>

          <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
            Knockout Schedule
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
            Split One has moved into single elimination. Fixtures appear here
            as soon as they are synced for KOOK, with exact start times handled
            directly by captains.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-400">
              Phase
            </p>
            <h2 className="mt-3 text-2xl font-black uppercase">Knockouts</h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-400">
              Synced Fixtures
            </p>
            <h2 className="mt-3 text-2xl font-black uppercase">
              {syncedMatches.length} Series
            </h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-400">
              Match Times
            </p>
            <h2 className="mt-3 text-2xl font-black uppercase">KOOK TBC</h2>
          </div>
        </div>

        <KnockoutBracket matches={bracketMatches} />

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm leading-7 text-zinc-300">
          <p>
            Knockout matches do not need a public start time to be listed.
            Captains should confirm exact scheduling through KOOK; results and
            completed series will continue to appear on the Results page.
          </p>
        </div>
      </section>
    </main>
  );
}
