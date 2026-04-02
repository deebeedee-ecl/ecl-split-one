export default function FormatPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          Expat China League
        </p>

        <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
          Format
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
          Split One begins with a <span className="font-bold text-white">single round robin</span>,
          where every team plays each other once. Each regular season matchup is played as a{" "}
          <span className="font-bold text-white">Best of 2</span>. After the regular season,
          teams are seeded into a <span className="font-bold text-white">single elimination</span>{" "}
          playoff bracket.
        </p>

        {/* Top info cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Stage 1
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">Round Robin</h2>
            <p className="mt-3 text-zinc-300">
              Every team plays every other team once during the regular season.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Match Format
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">Best of 2</h2>
            <p className="mt-3 text-zinc-300">
              Each regular season series is played over two games.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Stage 2
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">Playoffs</h2>
            <p className="mt-3 text-zinc-300">
              Teams advance into a seeded single elimination knockout bracket.
            </p>
          </div>
        </div>

        {/* Format flow visual */}
        <div className="mt-16 rounded-[2rem] border border-white/10 bg-zinc-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Format Visual
          </p>

          <h2 className="mt-4 text-3xl font-black uppercase">
            How Split One Works
          </h2>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Stage 1
              </p>
              <h3 className="mt-3 text-2xl font-black uppercase">
                Single Round Robin
              </h3>
              <p className="mt-4 text-zinc-300">
                Every team plays every other team once during the regular season.
              </p>
              <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-green-300">
                One series per matchup
              </p>
            </div>

            <div className="flex items-center justify-center text-4xl font-black text-green-400">
              →
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Stage 2
              </p>
              <h3 className="mt-3 text-2xl font-black uppercase">
                Seeding
              </h3>
              <p className="mt-4 text-zinc-300">
                Teams are ranked after the round robin based on their performance across the split.
              </p>
              <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-green-300">
                Seeded 1st to 6th
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center text-4xl font-black text-green-400">
            ↓
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
              Stage 3
            </p>
            <h3 className="mt-3 text-2xl font-black uppercase">
              Single Elimination Knockout
            </h3>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                  Quarterfinal 1
                </p>
                <p className="mt-2 text-2xl font-black uppercase">1 vs 6</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                  Quarterfinal 2
                </p>
                <p className="mt-2 text-2xl font-black uppercase">2 vs 5</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                  Quarterfinal 3
                </p>
                <p className="mt-2 text-2xl font-black uppercase">3 vs 4</p>
              </div>
            </div>

            <p className="mt-6 text-zinc-300">
              Winners continue through the bracket until a Split One champion is crowned.
            </p>
          </div>
        </div>

        {/* Match format explanation */}
        <div className="mt-16 rounded-[2rem] border border-white/10 bg-zinc-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Match Format
          </p>

          <h2 className="mt-4 text-3xl font-black uppercase">
            Best of 2 Structure
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Result
              </p>
              <p className="mt-2 text-2xl font-black">2 - 0</p>
              <p className="mt-2 text-zinc-300">
                A clean series win across both games.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Result
              </p>
              <p className="mt-2 text-2xl font-black">1 - 1</p>
              <p className="mt-2 text-zinc-300">
                Teams split the series with one win each.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Result
              </p>
              <p className="mt-2 text-2xl font-black">0 - 2</p>
              <p className="mt-2 text-zinc-300">
                A full series loss across both games.
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-16 rounded-[2rem] border border-white/10 bg-zinc-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Notes
          </p>

          <h2 className="mt-4 text-3xl font-black uppercase">
            Important Information
          </h2>

          <div className="mt-6 space-y-4 text-zinc-300">
            <p>
              Final standings after the regular season determine playoff seeding.
            </p>
            <p>
              Each regular season matchup is played as a Best of 2, allowing for split results.
            </p>
            <p>
              The playoff phase is single elimination, so every knockout match carries elimination pressure.
            </p>
            <p>
              Additional rules, tiebreak procedures, and result submission standards may be added before the split begins.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}