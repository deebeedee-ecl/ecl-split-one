import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "—";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatGold(gold?: number | null) {
  if (gold === null || gold === undefined) return "—";
  return `${(gold / 1000).toFixed(1)}k`;
}

function formatDamage(value?: number | null) {
  if (value === null || value === undefined) return "—";
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

function getTeamTag(teamName: string) {
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "ECL";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();

  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function TeamLogo({
  src,
  alt,
  size = 52,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-white/40"
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

function StatPill({
  icon,
  value,
}: {
  icon: string;
  value: string | number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
      <span className="text-xs">{icon}</span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function FooterBadge({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "gold" | "standard" | "cyan";
}) {
  const styles =
    accent === "gold"
      ? "border-yellow-400/40 bg-yellow-400/15 text-yellow-300"
      : accent === "cyan"
        ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-300"
        : "border-white/10 bg-white/[0.04] text-white/60";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${styles}`}>
      <span className="text-[11px] font-black uppercase tracking-[0.18em]">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

function PlayerBadges({
  isMVP,
  isSVP,
}: {
  isMVP?: boolean;
  isSVP?: boolean;
}) {
  if (!isMVP && !isSVP) {
    return <span className="text-white/30">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {isMVP && (
        <span className="rounded-full border border-yellow-400/30 bg-yellow-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-300">
          MVP
        </span>
      )}
      {isSVP && (
        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
          SVP
        </span>
      )}
    </div>
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
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/results"
          className="mb-5 inline-flex items-center text-sm font-semibold text-white/60 transition hover:text-green-400"
        >
          ← Back to Results
        </Link>

        <div className="mb-6 rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_40px_rgba(0,255,150,0.08)]">
          <div className="relative min-h-[150px]">
            <div className="flex items-start justify-between gap-6">
              <div className="flex max-w-[340px] items-center gap-3">
                <TeamLogo src={home.logoUrl} alt={home.name} size={52} />
                <div>
                  <div className="max-w-[250px] text-base font-black uppercase leading-[1.05] tracking-[0.05em] text-white md:text-lg">
                    {home.name}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                    [{homeTag}] • Home
                  </div>
                </div>
              </div>

              <div className="flex max-w-[340px] items-center gap-3 text-right">
                <div>
                  <div className="max-w-[250px] text-base font-black uppercase leading-[1.05] tracking-[0.05em] text-white md:text-lg">
                    {away.name}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                    [{awayTag}] • Away
                  </div>
                </div>
                <TeamLogo src={away.logoUrl} alt={away.name} size={52} />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[11px] font-bold uppercase tracking-[0.26em] text-white/35">
                  BO{match.bestOf}
                </div>
                <div className="mt-1 text-5xl font-black tracking-tight text-white">
                  {match.homeScore} - {match.awayScore}
                </div>
                <div className="mt-1 text-sm font-bold text-white/75">
                  {seriesWinner}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {match.games.map((game) => {
            const winner = getWinnerName(
              game.winnerTeamId,
              home.id,
              away.id,
              home.name,
              away.name
            );

            const homePlayers = game.playerStats.filter(
              (stat) => stat.teamId === home.id
            );
            const awayPlayers = game.playerStats.filter(
              (stat) => stat.teamId === away.id
            );

            const mvpStat =
              game.playerStats.find((stat) => stat.isMVP) ?? null;
            const svpStat =
              game.playerStats.find((stat) => stat.isSVP) ?? null;

            const mvpName =
              game.mvpName ||
              mvpStat?.player?.name ||
              mvpStat?.riotName ||
              "Not set";

            const svpName =
              svpStat?.player?.name ||
              svpStat?.riotName ||
              "Not set";

            const hasPlayerStats = game.playerStats.length > 0;

            return (
              <section
                key={game.id}
                className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
              >
                <div className="mx-auto max-w-[420px] border-b border-white/10 pb-3 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.26em] text-white/35">
                    Game {game.gameNumber} • {formatDuration(game.durationSeconds)}
                  </div>

                  <div className="mt-2 text-4xl font-black tracking-tight text-white">
                    {(game.homeKills ?? 0)} - {(game.awayKills ?? 0)}
                  </div>

                  <div className="mt-1 text-sm font-bold text-white/70">
                    [{homeTag}] <span className="text-white/35">vs</span> [{awayTag}]
                  </div>

                  <div className="mt-1 text-xs font-semibold text-green-400">
                    Winner: {winner}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black uppercase tracking-[0.06em] text-white">
                      [{homeTag}]
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatPill icon="⚔️" value={game.homeKills ?? "—"} />
                      <StatPill icon="💰" value={formatGold(game.homeGold)} />
                      <StatPill icon="🏰" value={game.homeTowers ?? "—"} />
                      <StatPill icon="🐉" value={game.homeDrakes ?? "—"} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatPill icon="⚔️" value={game.awayKills ?? "—"} />
                      <StatPill icon="💰" value={formatGold(game.awayGold)} />
                      <StatPill icon="🏰" value={game.awayTowers ?? "—"} />
                      <StatPill icon="🐉" value={game.awayDrakes ?? "—"} />
                    </div>

                    <span className="text-2xl font-black uppercase tracking-[0.06em] text-white">
                      [{awayTag}]
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                      <span>⚔️</span>
                      <span>Kills</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-base font-bold">
                      <span className="text-white/60">{homeTag}</span>
                      <span className="text-xl font-black tracking-wide text-white">
                        {game.homeKills != null && game.awayKills != null
                          ? `${game.homeKills} - ${game.awayKills}`
                          : "—"}
                      </span>
                      <span className="text-white/60">{awayTag}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                      <span>💰</span>
                      <span>Gold</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-base font-bold">
                      <span className="text-white/60">{homeTag}</span>
                      <span className="text-lg font-black tracking-wide text-white">
                        {game.homeGold != null && game.awayGold != null
                          ? `${formatGold(game.homeGold)} - ${formatGold(game.awayGold)}`
                          : "—"}
                      </span>
                      <span className="text-white/60">{awayTag}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                      <span>🏰</span>
                      <span>Towers</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-base font-bold">
                      <span className="text-white/60">{homeTag}</span>
                      <span className="text-lg font-black tracking-wide text-white">
                        {game.homeTowers != null && game.awayTowers != null
                          ? `${game.homeTowers} - ${game.awayTowers}`
                          : "—"}
                      </span>
                      <span className="text-white/60">{awayTag}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                      <span>💥</span>
                      <span>Inhibitors</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-base font-bold">
                      <span className="text-white/60">{homeTag}</span>
                      <span className="text-lg font-black tracking-wide text-white">
                        {game.homeInhibitors != null && game.awayInhibitors != null
                          ? `${game.homeInhibitors} - ${game.awayInhibitors}`
                          : "—"}
                      </span>
                      <span className="text-white/60">{awayTag}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                      <span>🟣</span>
                      <span>Barons</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-base font-bold">
                      <span className="text-white/60">{homeTag}</span>
                      <span className="text-lg font-black tracking-wide text-white">
                        {game.homeBarons != null && game.awayBarons != null
                          ? `${game.homeBarons} - ${game.awayBarons}`
                          : "—"}
                      </span>
                      <span className="text-white/60">{awayTag}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                      <span>🐉</span>
                      <span>Drakes</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-base font-bold">
                      <span className="text-white/60">{homeTag}</span>
                      <span className="text-lg font-black tracking-wide text-white">
                        {game.homeDrakes != null && game.awayDrakes != null
                          ? `${game.homeDrakes} - ${game.awayDrakes}`
                          : "—"}
                      </span>
                      <span className="text-white/60">{awayTag}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <FooterBadge
                    label="MVP"
                    value={mvpName}
                    accent="gold"
                  />
                  <FooterBadge
                    label="SVP"
                    value={svpName}
                    accent="cyan"
                  />
                  <FooterBadge
                    label="Players"
                    value={String(game.playerStats.length)}
                    accent="standard"
                  />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-black uppercase tracking-[0.18em] text-white">
                        {home.name}
                      </h4>
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">
                        {homePlayers.length} Players
                      </span>
                    </div>

                    {!hasPlayerStats || homePlayers.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/45">
                        No player stats recorded.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.16em] text-white/45">
                              <th className="px-2 py-2">Player</th>
                              <th className="px-2 py-2">K / D / A</th>
                              <th className="px-2 py-2">Gold</th>
                              <th className="px-2 py-2">Damage</th>
                              <th className="px-2 py-2 text-right">Badges</th>
                            </tr>
                          </thead>
                          <tbody>
                            {homePlayers.map((stat) => (
                              <tr
                                key={stat.id}
                                className="border-b border-white/5 text-white/80 last:border-b-0"
                              >
                                <td className="px-2 py-3 font-semibold text-white">
                                  {stat.player?.name || stat.riotName || "Unknown"}
                                </td>
                                <td className="px-2 py-3">
                                  {stat.kills}/{stat.deaths}/{stat.assists}
                                </td>
                                <td className="px-2 py-3">
                                  {formatGold(stat.gold)}
                                </td>
                                <td className="px-2 py-3">
                                  {formatDamage(stat.damage)}
                                </td>
                                <td className="px-2 py-3 text-right">
                                  <PlayerBadges
                                    isMVP={stat.isMVP}
                                    isSVP={stat.isSVP}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-black uppercase tracking-[0.18em] text-white">
                        {away.name}
                      </h4>
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">
                        {awayPlayers.length} Players
                      </span>
                    </div>

                    {!hasPlayerStats || awayPlayers.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/45">
                        No player stats recorded.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.16em] text-white/45">
                              <th className="px-2 py-2">Player</th>
                              <th className="px-2 py-2">K / D / A</th>
                              <th className="px-2 py-2">Gold</th>
                              <th className="px-2 py-2">Damage</th>
                              <th className="px-2 py-2 text-right">Badges</th>
                            </tr>
                          </thead>
                          <tbody>
                            {awayPlayers.map((stat) => (
                              <tr
                                key={stat.id}
                                className="border-b border-white/5 text-white/80 last:border-b-0"
                              >
                                <td className="px-2 py-3 font-semibold text-white">
                                  {stat.player?.name || stat.riotName || "Unknown"}
                                </td>
                                <td className="px-2 py-3">
                                  {stat.kills}/{stat.deaths}/{stat.assists}
                                </td>
                                <td className="px-2 py-3">
                                  {formatGold(stat.gold)}
                                </td>
                                <td className="px-2 py-3">
                                  {formatDamage(stat.damage)}
                                </td>
                                <td className="px-2 py-3 text-right">
                                  <PlayerBadges
                                    isMVP={stat.isMVP}
                                    isSVP={stat.isSVP}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  {game.notes ? (
                    <FooterBadge
                      label="Note"
                      value={game.notes}
                      accent="standard"
                    />
                  ) : (
                    <FooterBadge
                      label="Status"
                      value={hasPlayerStats ? "OCR stats recorded" : "Awaiting player stats"}
                      accent="standard"
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}