import Image from "next/image";
import Link from "next/link";
import { KnockoutBracket } from "@/components/StandingsStageToggle";
import LeagueWireTicker from "@/components/LeagueWireTicker";
import SplashVideo from "@/components/SplashVideo";
import { buildKnockoutBracket } from "@/lib/knockout-bracket";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const [leagueWireItems, knockoutMatches] = await Promise.all([
    prisma.leagueWireItem.findMany({
      where: {
        isVisible: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.match.findMany({
      where: {
        stage: {
          in: ["PLAYOFFS", "SEMIFINALS", "FINALS"],
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const bracketMatches = buildKnockoutBracket(knockoutMatches);

  return (
    <>
      <SplashVideo />

      <main className="min-h-screen overflow-x-hidden bg-black text-white">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <LeagueWireTicker items={leagueWireItems} />

          <div className="mx-auto max-w-5xl pt-6 text-center sm:pt-10">
            <div className="mb-6 flex justify-center">
              <Image
                src="/ecl-logo.png"
                alt="ECL Logo"
                width={200}
                height={200}
                className="h-auto w-24 opacity-90 sm:w-28"
                priority
              />
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-green-400">
              Expat China League
            </p>

            <h1 className="mt-4 text-5xl font-black uppercase tracking-tight text-white sm:text-6xl lg:text-7xl">
              Split One Knockouts
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
              The regular season is locked. Six teams enter single elimination,
              where every series can end a split and every win moves one step
              closer to the crown.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center rounded-xl bg-green-400 px-8 py-4 font-bold uppercase tracking-wide text-black transition duration-200 hover:scale-[1.02] hover:bg-green-300"
              >
                View Knockout Schedule
              </Link>

              <Link
                href="/standings"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-bold uppercase tracking-wide text-white/75 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-green-400/10 hover:text-white"
              >
                View Standings
              </Link>
            </div>

            <div className="mt-5 text-sm text-zinc-400">
              Still looking to play this split or future events?{" "}
              <Link
                href="/free-agents"
                className="font-bold text-green-300 underline decoration-green-400/40 underline-offset-4 transition hover:text-green-200 hover:decoration-green-300"
              >
                Join free agency
              </Link>
            </div>
          </div>

          <div className="mt-10">
            <KnockoutBracket matches={bracketMatches} />
          </div>

          <div className="mt-16 rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
                League Media
              </p>
              <h2 className="mt-3 text-3xl font-black uppercase text-white">
                Watch & Listen
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Rewatch the Split One hype video and tune into the official ECL
                podcast as the knockout story unfolds.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="group rounded-[1.5rem] border border-white/10 bg-black/40 p-5 transition duration-200 hover:border-green-400/30 hover:bg-zinc-900">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">
                  Official Hype Video
                </p>
                <h3 className="mt-3 text-xl font-black uppercase text-white">
                  Split One Cinematic
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Open the official hype video and relive the launch of Split
                  One.
                </p>

                <Link
                  href="/video/Hype.mp4"
                  className="mt-5 inline-flex items-center justify-center rounded-xl bg-green-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-black transition duration-200 hover:scale-[1.02] hover:bg-green-300"
                >
                  Watch Video
                </Link>
              </div>

              <div className="group rounded-[1.5rem] border border-white/10 bg-black/40 p-5 transition duration-200 hover:border-green-400/30 hover:bg-zinc-900">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">
                  ECL Podcast
                </p>
                <h3 className="mt-3 text-xl font-black uppercase text-white">
                  League Talk
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Follow the latest podcast episodes covering matches, players,
                  league stories, and community discussion.
                </p>

                <a
                  href="https://www.youtube.com/playlist?list=PLdfbxhGWRe1pqOASdseItbXbCy6cLxri6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center justify-center rounded-xl border border-green-400/40 bg-transparent px-5 py-3 text-sm font-bold uppercase tracking-wide text-green-400 transition duration-200 hover:scale-[1.02] hover:border-green-300 hover:bg-green-400/10 hover:text-green-300"
                >
                  Listen on YouTube
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Link
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
                Understand the path from opening round to Split One champion.
              </p>
            </Link>

            <Link
              href="/schedule"
              className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Schedule
              </p>
              <h3 className="mt-4 text-2xl font-black uppercase">
                Knockout Fixtures
              </h3>
              <p className="mt-4 text-zinc-300">
                Follow playoff series as captains confirm them through KOOK.
              </p>
            </Link>

            <Link
              href="/results"
              className="group rounded-[2rem] border border-white/10 bg-zinc-900 p-6 transition hover:scale-[1.02] hover:border-green-400/30 hover:bg-zinc-800"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Results
              </p>
              <h3 className="mt-4 text-2xl font-black uppercase">
                Match Archive
              </h3>
              <p className="mt-4 text-zinc-300">
                Track completed series, winners, and game breakdowns.
              </p>
            </Link>
          </div>

        </section>
      </main>
    </>
  );
}
