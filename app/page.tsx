import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Crown,
  Flame,
  Medal,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import LeagueWireTicker from "@/components/LeagueWireTicker";
import SplashVideo from "@/components/SplashVideo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PlayerAwardStats = {
  id: string;
  name: string;
  riotLine: string | null;
  teamName: string | null;
  elo: number;
  gamesPlayed: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  mvpCount: number;
};

type Award = {
  title: string;
  label: string;
  player: PlayerAwardStats;
  value: string;
  note: string;
  icon: typeof Trophy;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatKDA(player: PlayerAwardStats) {
  if (player.kills === 0 && player.deaths === 0 && player.assists === 0) {
    return "0.00";
  }

  return ((player.kills + player.assists) / Math.max(1, player.deaths)).toFixed(
    2
  );
}

function formatAverage(value: number, gamesPlayed: number) {
  if (gamesPlayed === 0) return "0.0";
  return (value / gamesPlayed).toFixed(1);
}

function formatWinRate(wins: number, gamesPlayed: number) {
  if (gamesPlayed === 0) return "0%";
  return `${Math.round((wins / gamesPlayed) * 100)}%`;
}

function getRiotLine(player: {
  riotName: string | null;
  riotTag: string | null;
}) {
  const parts = [player.riotName, player.riotTag].filter(Boolean);
  return parts.length > 0 ? parts.join("#") : null;
}

function pickAward(
  title: string,
  label: string,
  players: PlayerAwardStats[],
  sorter: (a: PlayerAwardStats, b: PlayerAwardStats) => number,
  value: (player: PlayerAwardStats) => string,
  note: string,
  icon: typeof Trophy
): Award | null {
  const player = [...players].sort(sorter)[0];

  if (!player) return null;

  return {
    title,
    label,
    player,
    value: value(player),
    note,
    icon,
  };
}

function ChampionHero({
  champion,
  runnerUpName,
  finalScore,
}: {
  champion: { name: string; logoUrl: string | null } | null;
  runnerUpName: string;
  finalScore: string;
}) {
  const championName = champion?.name ?? "Exiled Bunzz";

  return (
    <section className="relative isolate overflow-hidden rounded-lg border border-yellow-300/20 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.24),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(8,8,8,1)_48%,rgba(21,128,61,0.22))] px-5 py-8 shadow-[0_0_48px_rgba(250,204,21,0.12)] sm:px-8 lg:px-10">
      <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <div className="flex items-center justify-center">
          <div className="relative flex aspect-square w-full max-w-[22rem] items-center justify-center rounded-lg border border-yellow-300/30 bg-black/60 p-8 shadow-[0_0_52px_rgba(250,204,21,0.18)]">
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-yellow-300/25 bg-yellow-300 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-black">
              <Crown size={16} />
              Champions
            </div>

            {champion?.logoUrl ? (
              <Image
                src={champion.logoUrl}
                alt={`${championName} logo`}
                width={320}
                height={320}
                className="h-56 w-56 object-contain sm:h-64 sm:w-64"
                priority
              />
            ) : (
              <div className="text-7xl font-black uppercase text-yellow-100">
                EB
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.28em] text-yellow-200">
            <Trophy size={18} />
            Spring Split Champions
          </p>

          <h1 className="mt-4 text-5xl font-black uppercase tracking-tight text-white sm:text-6xl lg:text-7xl">
            {championName}
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-200">
            EB are the Spring Split Champions after a {finalScore} finals win
            over {runnerUpName}. NN struck first, then EB answered with three
            straight games to close the split.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/35 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                Finals
              </div>
              <div className="mt-2 text-3xl font-black text-yellow-100">
                {finalScore}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/35 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                Run
              </div>
              <div className="mt-2 text-3xl font-black text-white">
                3 Wins
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/35 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                Crown
              </div>
              <div className="mt-2 text-3xl font-black text-green-300">
                Split 1
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/results"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-yellow-300 px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-yellow-200"
            >
              Finals Archive
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/stats/leaderboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-white/75 transition hover:border-green-300/30 hover:bg-green-400/10 hover:text-white"
            >
              Player Leaderboard
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MvpSpotlight({ player }: { player: PlayerAwardStats | undefined }) {
  if (!player) return null;

  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-zinc-950/90 p-5 sm:p-6">
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-green-300">
            <Star size={15} />
            Split MVP
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.05em] text-white sm:text-4xl">
            {player.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Top of the ELO board with {player.gamesPlayed} recorded games for{" "}
            {player.teamName ?? "Free Agency"}.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[24rem]">
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
              ELO
            </div>
            <div className="mt-1 text-2xl font-black text-green-300">
              {player.elo}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
              KDA
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {formatKDA(player)}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
              WR
            </div>
            <div className="mt-1 text-2xl font-black text-yellow-100">
              {formatWinRate(player.wins, player.gamesPlayed)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AwardCard({ award }: { award: Award }) {
  const Icon = award.icon;

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
            {award.label}
          </p>
          <h3 className="mt-2 text-xl font-black uppercase text-white">
            {award.title}
          </h3>
        </div>
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-300/20 bg-green-400/10 text-green-300">
          <Icon size={20} />
        </div>
      </div>

      <div className="mt-6 text-3xl font-black text-yellow-100">
        {award.value}
      </div>
      <div className="mt-2 font-bold text-white">{award.player.name}</div>
      <div className="mt-1 text-sm text-white/45">
        {award.player.riotLine ?? award.player.teamName ?? "ECL player"}
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-400">{award.note}</p>
    </div>
  );
}

export default async function Home() {
  const [leagueWireItems, finalMatch, players] = await Promise.all([
    prisma.leagueWireItem.findMany({
      where: {
        isVisible: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.match.findFirst({
      where: {
        stage: "FINALS",
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.player.findMany({
      include: {
        team: true,
        gameStats: true,
      },
    }),
  ]);

  const playerStats: PlayerAwardStats[] = players.map((player) => {
    const gamesPlayed = player.gameStats.length;
    const wins = player.gameStats.filter((stat) => stat.isWin).length;

    return {
      id: player.id,
      name: player.name,
      riotLine: getRiotLine(player),
      teamName: player.team?.name ?? null,
      elo: player.elo,
      gamesPlayed,
      wins,
      kills: player.gameStats.reduce((sum, stat) => sum + stat.kills, 0),
      deaths: player.gameStats.reduce((sum, stat) => sum + stat.deaths, 0),
      assists: player.gameStats.reduce((sum, stat) => sum + stat.assists, 0),
      damage: player.gameStats.reduce(
        (sum, stat) => sum + (stat.damage ?? 0),
        0
      ),
      mvpCount: player.gameStats.filter((stat) => stat.isMVP).length,
    };
  });

  const qualifiedPlayers = playerStats.filter(
    (player) => player.gamesPlayed >= 8
  );
  const eloLeader = [...playerStats].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    return a.name.localeCompare(b.name);
  })[0];

  const championTeam = finalMatch?.winnerTeam ?? finalMatch?.homeTeam ?? null;
  const runnerUpName =
    finalMatch?.winnerTeamId === finalMatch?.homeTeamId
      ? finalMatch?.awayTeam.name ?? "niuniupower"
      : finalMatch?.homeTeam.name ?? "niuniupower";
  const finalScore = finalMatch
    ? `${finalMatch.homeScore}-${finalMatch.awayScore}`
    : "3-1";

  const awards = [
    pickAward(
      "Best KDA",
      "Minimum 8 games",
      qualifiedPlayers,
      (a, b) => Number(formatKDA(b)) - Number(formatKDA(a)),
      formatKDA,
      "The cleanest blend of kills, assists, and survival across the split.",
      Target
    ),
    pickAward(
      "Least Deaths",
      "Minimum 8 games",
      qualifiedPlayers,
      (a, b) => {
        const deathDiff =
          a.deaths / Math.max(1, a.gamesPlayed) -
          b.deaths / Math.max(1, b.gamesPlayed);
        if (deathDiff !== 0) return deathDiff;
        return b.gamesPlayed - a.gamesPlayed;
      },
      (player) => `${formatAverage(player.deaths, player.gamesPlayed)} / game`,
      "Low deaths, high discipline, and a lot of denied reset timers.",
      ShieldCheck
    ),
    pickAward(
      "Damage Engine",
      "Minimum 8 games",
      qualifiedPlayers,
      (a, b) =>
        b.damage / Math.max(1, b.gamesPlayed) -
        a.damage / Math.max(1, a.gamesPlayed),
      (player) =>
        `${formatNumber(Math.round(player.damage / player.gamesPlayed))} / game`,
      "The most reliable pressure source in recorded games.",
      Flame
    ),
    pickAward(
      "MVP Magnet",
      "All recorded games",
      playerStats,
      (a, b) => {
        if (b.mvpCount !== a.mvpCount) return b.mvpCount - a.mvpCount;
        return b.elo - a.elo;
      },
      (player) => `${player.mvpCount} MVPs`,
      "The player most often tagged as the standout performer.",
      Medal
    ),
    pickAward(
      "Assist Machine",
      "Minimum 8 games",
      qualifiedPlayers,
      (a, b) =>
        b.assists / Math.max(1, b.gamesPlayed) -
        a.assists / Math.max(1, a.gamesPlayed),
      (player) => `${formatAverage(player.assists, player.gamesPlayed)} / game`,
      "Always nearby when the map breaks open.",
      Sparkles
    ),
    pickAward(
      "Kill Leader",
      "Minimum 8 games",
      qualifiedPlayers,
      (a, b) =>
        b.kills / Math.max(1, b.gamesPlayed) -
        a.kills / Math.max(1, a.gamesPlayed),
      (player) => `${formatAverage(player.kills, player.gamesPlayed)} / game`,
      "The split's sharpest finisher by average kills.",
      Swords
    ),
  ].filter((award): award is Award => Boolean(award));

  return (
    <>
      <SplashVideo />

      <main className="min-h-screen overflow-x-hidden bg-black text-white">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <LeagueWireTicker items={leagueWireItems} />

          <div className="mx-auto mb-8 flex max-w-5xl flex-col items-center pt-6 text-center sm:pt-10">
            <Image
              src="/ecl-logo.png"
              alt="ECL Logo"
              width={200}
              height={200}
              className="h-auto w-20 opacity-90 sm:w-24"
              priority
            />

            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.35em] text-green-400">
              Expat China League
            </p>
          </div>

          <ChampionHero
            champion={championTeam}
            runnerUpName={runnerUpName}
            finalScore={finalScore}
          />

          <MvpSpotlight player={eloLeader} />

          <section className="mt-12">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
                  Split Awards
                </p>
                <h2 className="mt-3 text-3xl font-black uppercase text-white">
                  Season Standouts
                </h2>
              </div>
              <Link
                href="/stats/leaderboard"
                className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-yellow-100 transition hover:text-yellow-200"
              >
                Full Leaderboard
                <ArrowRight size={17} />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {awards.map((award) => (
                <AwardCard key={award.title} award={award} />
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-lg border border-green-300/20 bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(24,24,27,0.96)_44%,rgba(250,204,21,0.08))] p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-300">
                  Next Chapter
                </p>
                <h2 className="mt-3 text-3xl font-black uppercase text-white sm:text-4xl">
                  New Inhouse Ranked Coming Soon
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-300">
                  The Spring Split is wrapped. A fresh inhouse ranked format is
                  coming soon with a new ladder, new storylines, and more room
                  for players to climb.
                </p>
              </div>

              <Link
                href="/free-agents"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-400 px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-green-300"
              >
                Join Free Agency
                <ArrowRight size={17} />
              </Link>
            </div>
          </section>

          <div className="mt-16 rounded-lg border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
                League Media
              </p>
              <h2 className="mt-3 text-3xl font-black uppercase text-white">
                Watch & Listen
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Rewatch the Split One hype video and tune into official ECL
                podcast episodes from the season.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="group rounded-lg border border-white/10 bg-black/40 p-5 transition duration-200 hover:border-green-400/30 hover:bg-zinc-900">
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
                  className="mt-5 inline-flex items-center justify-center rounded-lg bg-green-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-black transition duration-200 hover:scale-[1.02] hover:bg-green-300"
                >
                  Watch Video
                </Link>
              </div>

              <div className="group rounded-lg border border-white/10 bg-black/40 p-5 transition duration-200 hover:border-green-400/30 hover:bg-zinc-900">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">
                  ECL Podcast
                </p>
                <h3 className="mt-3 text-xl font-black uppercase text-white">
                  League Talk
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Follow podcast episodes covering matches, players, league
                  stories, and community discussion.
                </p>

                <a
                  href="https://www.youtube.com/playlist?list=PLdfbxhGWRe1pqOASdseItbXbCy6cLxri6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center justify-center rounded-lg border border-green-400/40 bg-transparent px-5 py-3 text-sm font-bold uppercase tracking-wide text-green-400 transition duration-200 hover:scale-[1.02] hover:border-green-300 hover:bg-green-400/10 hover:text-green-300"
                >
                  Listen on YouTube
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
