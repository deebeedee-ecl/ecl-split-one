export default function TeamsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-4xl font-black uppercase md:text-6xl">
          Teams
        </h1>

        <p className="mt-4 text-zinc-300">
          Registered teams for ECL Split One will appear here.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Team Alpha</h2>
            <p className="mt-2 text-zinc-400">Captain: Example Player</p>
            <p className="mt-1 text-zinc-400">Record: 0-0</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Team Bravo</h2>
            <p className="mt-2 text-zinc-400">Captain: Example Player</p>
            <p className="mt-1 text-zinc-400">Record: 0-0</p>
          </div>
        </div>
      </div>
    </main>
  );
}