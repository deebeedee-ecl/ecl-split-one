import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getTeamTag(name: string) {
  const words = name
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  return name.replace(/[^\w]/g, "").slice(0, 3).toUpperCase();
}

export default async function TeamStatsHubPage() {
  const teams = await prisma.team.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate overflow-hidden border-b border-[#1f1f1f] bg-[#050505] px-6 py-16">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.18),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(177,18,38,0.16),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

        <div className="relative mx-auto max-w-6xl">
          <Link
            href="/tournaments/split-one"
            className="inline-flex items-center gap-2 border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#9ca3af] transition hover:border-[#b11226] hover:text-white"
          >
            Back to Split One Archive
          </Link>

          <p className="mt-10 text-sm font-black uppercase tracking-[0.25em] text-[#b11226]">
            Split One Archive
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-none [font-family:Anton,Impact,Arial_Black,Arial,sans-serif] md:text-7xl">
            Team Stats
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#9ca3af]">
            Team-by-team stat pages for the Split One archive. Open a team for
            radar, roster, and player board data, then return straight back to
            the archive.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Archived Teams" value={teams.length} />
        </div>

        {teams.length === 0 ? (
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-8 text-center text-[#9ca3af]">
            No teams found.
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="group flex flex-col gap-4 border border-[#1f1f1f] bg-[#0d0d0d] p-5 transition hover:border-[#b11226] hover:bg-[#b11226]/10 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-[#1f1f1f] bg-black/40">
                    {team.logoUrl ? (
                      <Image
                        src={team.logoUrl}
                        alt={team.name}
                        fill
                        className="object-contain p-2"
                        sizes="80px"
                      />
                    ) : (
                      <div className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                        {getTeamTag(team.name)}
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white transition group-hover:text-[#d11a2a]">
                      {team.name}
                    </h2>
                    <p className="mt-1 text-sm text-[#9ca3af]">
                      Split One radar, player stats, and roster breakdown.
                    </p>
                  </div>
                </div>

                <Link
                  href={`/stats/teams/${team.id}`}
                  className="inline-flex shrink-0 items-center justify-center bg-[#b11226] px-5 py-3 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#d11a2a]"
                >
                  Team Stats
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
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
    <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-5">
      <div className="text-sm uppercase tracking-[0.18em] text-[#9ca3af]">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}
