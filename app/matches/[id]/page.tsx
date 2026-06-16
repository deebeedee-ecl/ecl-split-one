import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function empty(value?: number | null) {
  return value === null || value === undefined ? "-" : value;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "-";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

function formatGold(gold?: number | null) {
  if (gold === null || gold === undefined) return "-";
  return `${(gold / 1000).toFixed(1)}k`;
}

function formatDamage(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${(value / 1000).toFixed(1)}k`;
}

function getWinnerName(
  winnerTeamId: string | null,
  homeTeamId: string,
  awayTeamId: string,
  homeName: string,
  awayName: string
) {
  if (!winnerTeamId) return "Draw / Unset";
  if (winnerTeamId === homeTeamId) return homeName;
  if (winnerTeamId === awayTeamId) return awayName;
  return "Unknown";
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
  size = 56,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-[10px] font-black uppercase tracking-[0.12em] text-[#9ca3af]"
        style={{ width: size, height: size }}
      >
        {getTeamTag(alt)}
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d]"
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill className="object-contain p-2" sizes={`${size}px`} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#1f1f1f] bg-black/30 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9ca3af]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function PlayerBadge({ children }: { children: string }) {
  return (
    <span className="border border-[#b11226]/50 bg-[#b11226]/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
      {children}
    </span>
  );
}

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      games: {
        include: {
          playerStats: {
            include: {
              player: true,
            },
            orderBy: [{ isMVP: "desc" }, { isSVP: "desc" }, { kills: "desc" }],
          },
        },
        orderBy: {
          gameNumber: "asc",
        },
      },
    },
  });

  if (!match || !match.homeTeam || !match.awayTeam) {
    notFound();
  }

  const home = match.homeTeam;
  const away = match.awayTeam;
  const homeTag = getTeamTag(home.name);
  const awayTag = getTeamTag(away.name);
  const seriesWinner = getWinnerName(
    match.winnerTeamId,
    home.id,
    away.id,
    home.name,
    away.name
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate overflow-hidden border-b border-[#1f1f1f] px-4 py-10 sm:px-6 lg:py-16">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.18),transparent_38%),radial-gradient(circle_at_75%_25%,rgba(177,18,38,0.16),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/tournaments/split-one"
            className="inline-flex items-center border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af] transition hover:border-[#b11226] hover:text-white"
          >
            Back to Split One Archive
          </Link>

          <p className="mt-10 text-sm font-black uppercase tracking-[0.24em] text-[#b11226]">
            Match Archive
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-none [font-family:Anton,Impact,Arial_Black,Arial,sans-serif] md:text-7xl">
            Match Detail
          </h1>

          <div className="mt-8 grid gap-4 border border-[#1f1f1f] bg-[#0d0d0d] p-5 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] md:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <TeamLogo src={home.logoUrl} alt={home.name} size={72} />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af]">
                  {homeTag}
                </p>
                <h2 className="truncate text-2xl font-black text-white">{home.name}</h2>
              </div>
            </div>

            <div className="border border-[#1f1f1f] bg-black/35 px-4 py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9ca3af]">
                BO{match.bestOf}
              </p>
              <p className="mt-1 text-4xl font-black text-white">
                {match.homeScore} - {match.awayScore}
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#b11226]">
                {seriesWinner}
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-4 md:justify-end md:text-right">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af]">
                  {awayTag}
                </p>
                <h2 className="truncate text-2xl font-black text-white">{away.name}</h2>
              </div>
              <TeamLogo src={away.logoUrl} alt={away.name} size={72} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="space-y-6">
          {match.games.length === 0 ? (
            <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-8 text-center text-[#9ca3af]">
              No game data has been added for this match yet.
            </div>
          ) : (
            match.games.map((game) => {
              const winner = getWinnerName(
                game.winnerTeamId,
                home.id,
                away.id,
                home.name,
                away.name
              );
              const homePlayers = game.playerStats.filter((stat) => stat.teamId === home.id);
              const awayPlayers = game.playerStats.filter((stat) => stat.teamId === away.id);

              return (
                <article key={game.id} className="border border-[#1f1f1f] bg-[#0d0d0d] p-5">
                  <div className="grid gap-4 border-b border-[#1f1f1f] pb-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b11226]">
                        Game {game.gameNumber}
                      </p>
                      <h3 className="mt-2 text-3xl font-black uppercase text-white">
                        {homeTag} vs {awayTag}
                      </h3>
                    </div>

                    <div className="border border-[#1f1f1f] bg-black/30 px-5 py-4 text-center">
                      <p className="text-4xl font-black text-white">
                        {empty(game.homeKills)} - {empty(game.awayKills)}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#9ca3af]">
                        Kills
                      </p>
                    </div>

                    <div className="lg:text-right">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">
                        Winner
                      </p>
                      <p className="mt-2 text-xl font-black text-white">{winner}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <MiniStat label="Duration" value={formatDuration(game.durationSeconds)} />
                    <MiniStat label={`${homeTag} Gold`} value={formatGold(game.homeGold)} />
                    <MiniStat label={`${awayTag} Gold`} value={formatGold(game.awayGold)} />
                    <MiniStat label="Towers" value={`${empty(game.homeTowers)} - ${empty(game.awayTowers)}`} />
                    <MiniStat label="Drakes" value={`${empty(game.homeDrakes)} - ${empty(game.awayDrakes)}`} />
                    <MiniStat label="Barons" value={`${empty(game.homeBarons)} - ${empty(game.awayBarons)}`} />
                  </div>

                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    <PlayerTable title={home.name} players={homePlayers} />
                    <PlayerTable title={away.name} players={awayPlayers} />
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function PlayerTable({
  title,
  players,
}: {
  title: string;
  players: Array<{
    id: string;
    kills: number;
    deaths: number;
    assists: number;
    gold: number | null;
    damage: number | null;
    isMVP: boolean;
    isSVP: boolean;
    riotName: string | null;
    player: { name: string } | null;
  }>;
}) {
  return (
    <div className="border border-[#1f1f1f] bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-black uppercase tracking-[0.18em] text-white">
          {title}
        </h4>
        <span className="text-xs uppercase tracking-[0.18em] text-[#9ca3af]">
          {players.length} Players
        </span>
      </div>

      {players.length === 0 ? (
        <div className="border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-4 text-sm text-[#9ca3af]">
          No player stats recorded.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f] text-left text-[11px] uppercase tracking-[0.16em] text-[#9ca3af]">
                <th className="px-2 py-2">Player</th>
                <th className="px-2 py-2">K / D / A</th>
                <th className="px-2 py-2">Gold</th>
                <th className="px-2 py-2">Damage</th>
                <th className="px-2 py-2 text-right">Badges</th>
              </tr>
            </thead>
            <tbody>
              {players.map((stat) => (
                <tr key={stat.id} className="border-b border-[#1f1f1f] text-[#d1d5db] last:border-b-0">
                  <td className="px-2 py-3 font-semibold text-white">
                    {stat.player?.name || stat.riotName || "Unknown"}
                  </td>
                  <td className="px-2 py-3">
                    {stat.kills}/{stat.deaths}/{stat.assists}
                  </td>
                  <td className="px-2 py-3">{formatGold(stat.gold)}</td>
                  <td className="px-2 py-3">{formatDamage(stat.damage)}</td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {stat.isMVP && <PlayerBadge>MVP</PlayerBadge>}
                      {stat.isSVP && <PlayerBadge>SVP</PlayerBadge>}
                      {!stat.isMVP && !stat.isSVP && <span className="text-[#9ca3af]">-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
