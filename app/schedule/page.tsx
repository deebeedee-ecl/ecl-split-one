export default function SchedulePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-4xl font-black uppercase md:text-6xl">
          Schedule
        </h1>

        <p className="mt-4 text-zinc-300">
          Match schedule for ECL Split One.
        </p>

        <div className="mt-10 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Week 1</h2>
            <p className="mt-2 text-zinc-400">Apr 20–26</p>
            <p className="mt-2 text-zinc-300">Each team plays 2 BO2 series.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Week 2</h2>
            <p className="mt-2 text-zinc-400">Apr 27–30</p>
            <p className="mt-2 text-zinc-300">Each team plays 1 BO2 series.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Holiday Break</h2>
            <p className="mt-2 text-zinc-400">May 1–5</p>
            <p className="mt-2 text-zinc-300">No games scheduled.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Week 3</h2>
            <p className="mt-2 text-zinc-400">May 6–12</p>
            <p className="mt-2 text-zinc-300">Each team plays 2 BO2 series.</p>
          </div>
        </div>
      </div>
    </main>
  );
}