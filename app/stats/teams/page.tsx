import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamStatsHubPage() {
  const teams = await prisma.team.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/stats"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-green-400"
          >
            ← Back to Stats
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
            Stats
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase tracking-[0.08em]">
            Team Stats
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/60">
            Browse all teams and open their dedicated stats pages for a deeper
            breakdown.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Teams" value={teams.length} />
        </div>

        {teams.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/55">
            No teams found.
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-green-400/40 hover:bg-green-400/10 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                    {team.logoUrl ? (
                      <Image
                        src={team.logoUrl}
                        alt={team.name}
                        fill
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                        No Logo
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white transition group-hover:text-green-300">
                      {team.name}
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      Overview, infographic team stats, and roster breakdown.
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  <Link
                    href={`/stats/teams/${team.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-green-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:scale-[1.02] hover:bg-green-300"
                  >
                    Team Stats
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}