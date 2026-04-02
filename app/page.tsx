import Image from "next/image";
import CountdownTimer from "@/components/CountdownTimer";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* LEFT SIDE */}
          <div>
            <div className="mb-8">
              <Image
                src="/ecl-logo.png"
                alt="ECL Logo"
                width={260}
                height={260}
                className="h-auto transition duration-300 hover:scale-[1.02]"
                priority
              />
            </div>

            <div className="group inline-block cursor-default">
              <p className="text-2xl font-semibold uppercase tracking-[0.2em] text-green-400 transition duration-300 group-hover:text-green-300 group-hover:drop-shadow-[0_0_18px_rgba(74,222,128,0.55)] md:text-3xl">
                Expat China League
              </p>

              <h1 className="mt-4 text-5xl font-black uppercase tracking-tight text-white transition duration-300 group-hover:scale-[1.01] group-hover:text-green-300 group-hover:drop-shadow-[0_0_24px_rgba(74,222,128,0.7)] md:text-7xl">
                Split One
              </h1>
            </div>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              League of Legends tournament portal for premade teams,
              free agents, standings, schedules, and match submissions.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="/register/team"
                className="rounded-2xl bg-green-400 px-7 py-4 font-black uppercase tracking-wide text-black shadow-[0_0_25px_rgba(74,222,128,0.25)] transition duration-200 hover:scale-[1.02] hover:bg-green-300"
              >
                Register Team
              </a>

              <a
                href="/register/free-agent"
                className="rounded-2xl border border-white/15 bg-white/5 px-7 py-4 font-black uppercase tracking-wide text-white backdrop-blur-sm transition duration-200 hover:scale-[1.02] hover:border-white/30 hover:bg-white/10"
              >
                Join as Free Agent
              </a>
            </div>
          </div>

          {/* RIGHT SIDE — COUNTDOWN */}
          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-xl">
              <CountdownTimer />
            </div>
          </div>
        </div>

        {/* QUICK ACCESS CARDS */}
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          <a
            href="/teams"
            className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Teams
            </p>
            <h3 className="mt-4 text-2xl font-black uppercase text-white">
              Browse Teams
            </h3>
            <p className="mt-4 text-zinc-300">
              View approved teams competing in ECL Split One.
            </p>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-white group-hover:text-green-300">
              Enter →
            </p>
          </a>

          <a
            href="/free-agents"
            className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Free Agents
            </p>
            <h3 className="mt-4 text-2xl font-black uppercase text-white">
              Player Pool
            </h3>
            <p className="mt-4 text-zinc-300">
              Check the approved free-agent list and scout available players.
            </p>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-white group-hover:text-green-300">
              Enter →
            </p>
          </a>

          <a
            href="/schedule"
            className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Schedule
            </p>
            <h3 className="mt-4 text-2xl font-black uppercase text-white">
              Match Calendar
            </h3>
            <p className="mt-4 text-zinc-300">
              Follow fixtures, match days, and upcoming ECL action.
            </p>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-white group-hover:text-green-300">
              Enter →
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}