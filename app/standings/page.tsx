export default function StandingsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-4xl font-black uppercase md:text-6xl">
          Standings
        </h1>

        <p className="mt-4 text-zinc-300">
          League table for ECL Split One.
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900">
          <div className="grid grid-cols-4 border-b border-white/10 px-6 py-4 text-sm font-bold uppercase tracking-[0.15em] text-zinc-400">
            <div>Team</div>
            <div>Wins</div>
            <div>Losses</div>
            <div>Record</div>
          </div>

          <div className="grid grid-cols-4 px-6 py-4 text-zinc-200">
            <div>Team Alpha</div>
            <div>0</div>
            <div>0</div>
            <div>0-0</div>
          </div>

          <div className="grid grid-cols-4 border-t border-white/10 px-6 py-4 text-zinc-200">
            <div>Team Bravo</div>
            <div>0</div>
            <div>0</div>
            <div>0-0</div>
          </div>
        </div>
      </div>
    </main>
  );
}