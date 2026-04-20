import Image from "next/image";
import Link from "next/link";
import LeagueWireTicker from "@/components/LeagueWireTicker";
import SplashVideo from "@/components/SplashVideo";
import { prisma } from "@/lib/prisma";

function formatDate(value?: Date | null) {
  if (!value) return "Date not set";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getTeamTag(name: string) {
  const words = name
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  return name.replace(/[^\w]/g, "").slice(0, 3).toUpperCase();
}

function TeamLogo({
  src,
  alt,
  size = 72,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black uppercase tracking-[0.18em] text-white/45"
        style={{ width: size, height: size }}
      >
        LOGO
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-full border border-white/10 bg-white/5"
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={`${size}px`}
      />
    </div>
  );
}

export default async function Home() {
  const [leagueWireItems, nextMatch] = await Promise.all([
    prisma.leagueWireItem.findMany({
      where: {
        isVisible: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.match.findFirst({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          gte: new Date(),
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: {
        scheduledAt: "asc",
      },
    }),
  ]);

  const homeTag = nextMatch ? getTeamTag(nextMatch.homeTeam.name) : "";
  const awayTag = nextMatch ? getTeamTag(nextMatch.awayTeam.name) : "";

  return (
    <>
      <SplashVideo />

      <main className="min-h-screen overflow-x-hidden bg-black text-white">
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <LeagueWireTicker items={leagueWireItems} />

          {/* HERO */}
          <div className="mx-auto max-w-4xl pt-6 text-center sm:pt-10">
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
              Split One
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
              A competitive League of Legends tournament featuring premade
              teams, open free agency, and a structured split system with
              standings, scheduling, and matchday play.
            </p>

            <div className="mt-10">
              <Link
                href="/free-agents"
                className="inline-flex items-center justify-center rounded-xl bg-green-400 px-8 py-4 font-bold uppercase tracking-wide text-black transition duration-200 hover:scale-[1.02] hover:bg-green-300"
              >
                Join Free Agency
              </Link>
            </div>
          </div>

          {/* ROW 2 */}
          <div className="mt-16 grid gap-6 lg:grid-cols-2">
            {/* WATCH & LISTEN */}
            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
                  League Media
                </p>
                <h2 className="mt-3 text-3xl font-black uppercase text-white">
                  Watch & Listen
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400 sm:text-base">
                  Rewatch the Split One hype video and tune into the official
                  ECL podcast as the league story unfolds.
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
                    Follow the latest podcast episodes covering matches,
                    players, league stories, and community discussion.
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

            {/* NEXT MATCH */}
            <div className="relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(74,222,128,0.08),transparent_70%)] blur-2xl" />

              {nextMatch ? (
                <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-6 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
                      Next Match
                    </p>
                    <p className="mt-3 text-sm uppercase tracking-[0.18em] text-white/45">
                      {formatDate(nextMatch.scheduledAt)} • BO{nextMatch.bestOf}
                    </p>
                  </div>

                  <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/30 px-5 py-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <TeamLogo
                          src={nextMatch.homeTeam.logoUrl}
                          alt={nextMatch.homeTeam.name}
                          size={72}
                        />
                        <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-3xl">
                          {homeTag}
                        </h2>
                      </div>

                      <div className="shrink-0 text-2xl font-black uppercase tracking-[0.22em] text-white/75 sm:text-3xl">
                        VS
                      </div>

                      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                        <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-3xl">
                          {awayTag}
                        </h2>
                        <TeamLogo
                          src={nextMatch.awayTeam.logoUrl}
                          alt={nextMatch.awayTeam.name}
                          size={72}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/schedule"
                      className="inline-flex flex-1 items-center justify-center rounded-xl bg-green-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-black transition duration-200 hover:scale-[1.02] hover:bg-green-300"
                    >
                      View Schedule
                    </Link>

                    <Link
                      href="/results"
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white/75 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-green-400/10 hover:text-white"
                    >
                      View Results
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-6 shadow-[0_0_40px_rgba(34,197,94,0.06)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
                    Next Match
                  </p>

                  <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/30 px-5 py-10 text-center">
                    <h2 className="text-2xl font-black uppercase text-white sm:text-3xl">
                      Fixtures Coming Soon
                    </h2>
                    <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-zinc-400 sm:text-base">
                      The next scheduled fixture will appear here once match
                      times are locked in.
                    </p>
                  </div>

                  <div className="mt-6">
                    <Link
                      href="/schedule"
                      className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white/75 transition duration-200 hover:scale-[1.02] hover:border-green-400/30 hover:bg-green-400/10 hover:text-white"
                    >
                      View Schedule
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ROW 3 */}
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
    </>
  );
}