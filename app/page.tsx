import Image from "next/image";
import CountdownTimer from "@/components/CountdownTimer";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* LEFT SIDE */}
          <div className="min-w-0">
            <div className="mb-8">
              <Image
                src="/ecl-logo.png"
                alt="ECL Logo"
                width={260}
                height={260}
                className="h-auto w-40 max-w-full transition duration-300 hover:scale-[1.02] sm:w-52 md:w-[260px]"
                priority
              />
            </div>

            <div className="group inline-block max-w-full cursor-default">
              <p className="text-lg font-semibold uppercase tracking-[0.16em] text-green-400 transition duration-300 group-hover:text-green-300 group-hover:drop-shadow-[0_0_18px_rgba(74,222,128,0.55)] sm:text-2xl md:text-3xl">
                Expat China League
              </p>

              <h1 className="mt-4 break-words text-4xl font-black uppercase tracking-tight text-white transition duration-300 group-hover:scale-[1.01] group-hover:text-green-300 group-hover:drop-shadow-[0_0_24px_rgba(74,222,128,0.7)] sm:text-5xl md:text-6xl lg:text-7xl">
                Split One
              </h1>
            </div>

            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
              League of Legends tournament portal for premade teams,
              free agents, standings, schedules, and match submissions.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <a
                href="/register/team"
                className="w-full rounded-2xl bg-green-400 px-6 py-4 text-center font-black uppercase tracking-wide text-black shadow-[0_0_25px_rgba(74,222,128,0.25)] transition duration-200 hover:scale-[1.02] hover:bg-green-300 sm:w-auto sm:px-7"
              >
                Register Team
              </a>

              <a
                href="/register/free-agent"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center font-black uppercase tracking-wide text-white backdrop-blur-sm transition duration-200 hover:scale-[1.02] hover:border-white/30 hover:bg-white/10 sm:w-auto sm:px-7"
              >
                Join as Free Agent
              </a>
            </div>
          </div>

          {/* RIGHT SIDE — COUNTDOWN */}
          <div className="flex min-w-0 items-center justify-center lg:justify-end">
            <div className="w-full max-w-xl min-w-0">
              <CountdownTimer />
            </div>
          </div>
        </div>

        {/* QUICK ACCESS CARDS */}
        <div className="mt-16 grid gap-6 md:grid-cols-3 lg:mt-20">
          <a
            href="/teams"
            className="group min-w-0 rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Teams
            </p>
            <h3 className="mt-4 break-words text-2xl font-black uppercase text-white">
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
            className="group min-w-0 rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Free Agents
            </p>
            <h3 className="mt-4 break-words text-2xl font-black uppercase text-white">
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
            className="group min-w-0 rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Schedule
            </p>
            <h3 className="mt-4 break-words text-2xl font-black uppercase text-white">
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