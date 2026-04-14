import Link from "next/link";

export default function StatsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          Expat China League
        </p>

        <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
          Stats
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
          Track player leaderboards, team performance, and split stats as the
          season progresses.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Link
            href="/stats/leaderboard"
            className="group rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-8 transition hover:border-green-400/40 hover:bg-white/[0.05] hover:shadow-[0_0_30px_rgba(0,255,150,0.08)]"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-green-400">
              Leaderboard
            </div>

            <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-white">
              Player Rankings
            </h2>

            <p className="mt-4 max-w-md text-sm leading-7 text-zinc-300">
              View player ELO, win rate, KDA, MVP count, and the top performers
              in the league.
            </p>

            <div className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-white/60 transition group-hover:text-green-400">
              Enter Leaderboard →
            </div>
          </Link>

          <Link
            href="/stats/teams"
            className="group rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-8 transition hover:border-green-400/40 hover:bg-white/[0.05] hover:shadow-[0_0_30px_rgba(0,255,150,0.08)]"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-green-400">
              Team Stats
            </div>

            <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-white">
              Team Performance
            </h2>

            <p className="mt-4 max-w-md text-sm leading-7 text-zinc-300">
              Open dedicated team pages to view overall performance, simplified
              infographic stats, and a full roster breakdown.
            </p>

            <div className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-white/60 transition group-hover:text-green-400">
              View Team Stats →
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}