import Image from "next/image";
import KitCarousel from "@/components/KitCarousel";
import CountdownTimer from "@/components/CountdownTimer";
import LeagueWireTicker from "@/components/LeagueWireTicker";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const leagueWireItems = await prisma.leagueWireItem.findMany({
    where: {
      isVisible: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 8,
  });

  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <LeagueWireTicker items={leagueWireItems} />

        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* LEFT SIDE */}
          <div className="min-w-0 max-w-xl">
            {/* LOGO */}
            <div className="mb-6">
              <Image
                src="/ecl-logo.png"
                alt="ECL Logo"
                width={200}
                height={200}
                className="h-auto w-28 opacity-90 sm:w-36"
                priority
              />
            </div>

            {/* TITLE */}
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-green-400">
                Expat China League
              </p>

              <h1 className="text-5xl font-black uppercase tracking-tight text-white sm:text-6xl lg:text-7xl">
                Split One
              </h1>
            </div>

            {/* DESCRIPTION */}
            <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
              A competitive League of Legends tournament featuring premade teams,
              open free agency, and a structured split system with standings,
              scheduling, and matchday play.
            </p>

            {/* CTA */}
            <div className="mt-10">
              <a
                href="/free-agents"
                className="inline-block rounded-xl bg-green-400 px-8 py-4 font-bold uppercase tracking-wide text-black transition duration-200 hover:scale-[1.02] hover:bg-green-300"
              >
                Join Free Agency
              </a>
            </div>

            {/* COUNTDOWN */}
            <CountdownTimer />
          </div>

          {/* RIGHT SIDE */}
          <div className="flex min-w-0 items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(74,222,128,0.08),transparent_70%)] blur-2xl" />
              <KitCarousel />
            </div>
          </div>
        </div>

        {/* QUICK ACCESS */}
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          <a
            href="/format"
            className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Format
            </p>
            <h3 className="mt-4 text-2xl font-black uppercase">
              Competition Format
            </h3>
            <p className="mt-4 text-zinc-300">
              Understand the structure of Split One from regular season to
              finals.
            </p>
          </a>

          <a
            href="/schedule"
            className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Schedule
            </p>
            <h3 className="mt-4 text-2xl font-black uppercase">
              Match Calendar
            </h3>
            <p className="mt-4 text-zinc-300">
              Follow league dates, fixtures, and match windows.
            </p>
          </a>

          <a
            href="/standings"
            className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Standings
            </p>
            <h3 className="mt-4 text-2xl font-black uppercase">League Table</h3>
            <p className="mt-4 text-zinc-300">
              Track records, rankings, and the race for playoffs.
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}