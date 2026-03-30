export default function TeamRegisterPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-4xl font-black uppercase md:text-6xl">
          Team Registration
        </h1>

        <p className="mt-4 text-zinc-300">
          Register your premade roster for ECL Split One.
        </p>

        <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="grid gap-4">
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Team Name"
            />
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Captain Alias"
            />
            <input
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Captain Riot ID"
            />
            <textarea
              className="min-h-[140px] rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="List your players, ranks, roles, and substitute here"
            />
            <button className="rounded-2xl bg-green-400 px-6 py-3 font-bold text-black transition hover:bg-green-300">
              Submit Team
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}