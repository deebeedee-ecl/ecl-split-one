export default function FreeAgentPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-4xl font-black uppercase md:text-6xl">
          Free Agent Signup
        </h1>

        <p className="mt-4 text-zinc-300">
          Sign up solo and we will place you into a team if accepted.
        </p>

        <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="grid gap-4">
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Alias / Nickname"
            />
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Riot ID"
            />
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Rank"
            />
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Main Role"
            />
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="WeChat Contact"
            />
            <button className="rounded-2xl bg-green-400 px-6 py-3 font-bold text-black transition hover:bg-green-300">
              Submit Signup
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}