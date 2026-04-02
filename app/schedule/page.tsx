export default function SchedulePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          Expat China League
        </p>

        <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
          Schedule
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
          ECL Spring Split runs from <span className="font-bold text-white">20 April</span> to{" "}
          <span className="font-bold text-white">20 May</span>. Below is the current
          season timeline, match window, and scheduling notes for Split One.
        </p>

        {/* Top info cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Season Start
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">20 April</h2>
            <p className="mt-3 text-zinc-300">
              Opening week of the Spring Split.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Season End
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">20 May</h2>
            <p className="mt-3 text-zinc-300">
              Final deadline for the split and closing stage of competition.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Match Window
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">18:00 to 23:00</h2>
            <p className="mt-3 text-zinc-300">
              Matches can be scheduled on any day of the week within the official time window.
            </p>
          </div>
        </div>

        {/* Season timeline visual */}
        <div className="mt-16 rounded-[2rem] border border-white/10 bg-zinc-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Season Timeline
          </p>

          <h2 className="mt-4 text-3xl font-black uppercase">
            Split Window
          </h2>

          <div className="mt-10">
            <div className="relative h-2 rounded-full bg-zinc-800">
              <div className="absolute left-0 top-0 h-2 w-full rounded-full bg-gradient-to-r from-green-400 via-white/70 to-green-400" />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                  Start
                </p>
                <p className="mt-2 text-2xl font-black uppercase">20 April</p>
                <p className="mt-2 text-zinc-300">
                  Registration closes and the Spring Split begins.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                  Active Window
                </p>
                <p className="mt-2 text-2xl font-black uppercase">All Week</p>
                <p className="mt-2 text-zinc-300">
                  Matches may be played on any day, depending on team availability and scheduling.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                  End
                </p>
                <p className="mt-2 text-2xl font-black uppercase">20 May</p>
                <p className="mt-2 text-zinc-300">
                  Knockout stage concludes and the split champion is crowned.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly schedule visual */}
        <div className="mt-16 rounded-[2rem] border border-white/10 bg-zinc-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Scheduling Window
          </p>

          <h2 className="mt-4 text-3xl font-black uppercase">
            Flexible Match Times
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Days
              </p>
              <p className="mt-2 text-2xl font-black">Monday to Sunday</p>
              <p className="mt-2 text-zinc-300">
                Teams are free to schedule matches across the full week.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Time Window
              </p>
              <p className="mt-2 text-2xl font-black">18:00 - 23:00</p>
              <p className="mt-2 text-zinc-300">
                Official match scheduling should take place within this evening window.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                Coordination
              </p>
              <p className="mt-2 text-2xl font-black">Flexible</p>
              <p className="mt-2 text-zinc-300">
                Captains should coordinate directly to agree on a suitable day and start time.
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
              Exact fixtures and team pairings will be posted once registration closes and team numbers are finalised.
            </p>
            <p>
              Matches are not restricted to specific weekdays and may be played at any point during the week.
            </p>
            <p>
              The recommended official scheduling window is between 18:00 and 23:00 China time.
            </p>
            <p>
              The schedule page may be updated with more exact match times, playoff dates, and streamed feature matches.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}