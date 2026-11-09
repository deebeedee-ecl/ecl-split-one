import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function formatKda(kills: number, deaths: number, assists: number) {
  const divisor = deaths === 0 ? 1 : deaths;
  return ((kills + assists) / divisor).toFixed(2);
}

function formatStreak(winStreak: number, lossStreak: number) {
  if (winStreak > 0) return `W${winStreak}`;
  if (lossStreak > 0) return `L${lossStreak}`;
  return "-";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildPolygonPoints(
  values: number[],
  cx: number,
  cy: number,
  radius: number
) {
  const total = values.length;

  return values
    .map((value, index) => {
      const angle = (360 / total) * index;
      const point = polarToCartesian(cx, cy, (radius * value) / 100, angle);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

function buildGridPolygonPoints(
  sides: number,
  cx: number,
  cy: number,
  radius: number
) {
  return Array.from({ length: sides })
    .map((_, index) => {
      const angle = (360 / sides) * index;
      const point = polarToCartesian(cx, cy, radius, angle);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

type PlayerRow = {
  id: string;
  name: string;
  riotName: string;
  riotTag: string;
  elo: number;
  winStreak: number;
  lossStreak: number;
  gp: number;
  wins: number;
  losses: number;
  wr: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: string;
  mvpCount: number;
  streak: string;
};

type RadarMetric = {
  label: string;
  short: string;
  valueLabel: string;
  chartValue: number;
  position: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
    transform?: string;
    textAlign: "left" | "center" | "right";
  };
};

export default async function TeamStatsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      players: {
        orderBy: {
          name: "asc",
        },
      },
      homeMatches: {
        include: {
          winnerTeam: true,
        },
      },
      awayMatches: {
        include: {
          winnerTeam: true,
        },
      },
    },
  });

  if (!team) {
    notFound();
  }

  const allSeries = [...team.homeMatches, ...team.awayMatches].filter(
    (match) => match.status === "COMPLETED" || match.status === "FORFEIT"
  );

  const completedMatchIds = allSeries.map((match) => match.id);

  const matchGames = completedMatchIds.length
    ? await prisma.matchGame.findMany({
        where: {
          matchId: {
            in: completedMatchIds,
          },
          match: {
            OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
          },
        },
        include: {
          match: true,
        },
        orderBy: [{ matchId: "asc" }, { gameNumber: "asc" }],
      })
    : [];

  const gameWins = matchGames.filter((game) => game.winnerTeamId === team.id).length;
  const gameLosses = matchGames.filter(
    (game) => game.winnerTeamId && game.winnerTeamId !== team.id
  ).length;
  const gameDraws = matchGames.filter((game) => !game.winnerTeamId).length;

  const gameWr =
    gameWins + gameLosses > 0 ? (gameWins / (gameWins + gameLosses)) * 100 : 0;

  const hasGameData = matchGames.length > 0;

  const playerStats = await prisma.matchGamePlayerStat.findMany({
    where: {
      teamId: team.id,
      matchGame: {
        match: {
          status: {
            in: ["COMPLETED", "FORFEIT"],
          },
        },
      },
    },
    include: {
      player: true,
      matchGame: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const hasPlayerStatData = playerStats.length > 0;

  const totalKills = playerStats.reduce((sum, stat) => sum + stat.kills, 0);
  const totalDeaths = playerStats.reduce((sum, stat) => sum + stat.deaths, 0);
  const totalAssists = playerStats.reduce((sum, stat) => sum + stat.assists, 0);

  const avgKills = hasPlayerStatData ? totalKills / playerStats.length : 0;
  const avgDeaths = hasPlayerStatData ? totalDeaths / playerStats.length : 0;
  const avgAssists = hasPlayerStatData ? totalAssists / playerStats.length : 0;
  const teamKda = hasPlayerStatData
    ? formatKda(totalKills, totalDeaths, totalAssists)
    : "—";

  const statsByPlayerId = new Map<
    string,
    {
      gp: number;
      wins: number;
      losses: number;
      kills: number;
      deaths: number;
      assists: number;
      mvpCount: number;
    }
  >();

  for (const stat of playerStats) {
    const current = statsByPlayerId.get(stat.playerId) ?? {
      gp: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      mvpCount: 0,
    };

    current.gp += 1;
    current.wins += stat.isWin ? 1 : 0;
    current.losses += stat.isWin ? 0 : 1;
    current.kills += stat.kills;
    current.deaths += stat.deaths;
    current.assists += stat.assists;
    current.mvpCount += stat.isMVP ? 1 : 0;

    statsByPlayerId.set(stat.playerId, current);
  }

  const rosterRows: PlayerRow[] = team.players.map((player) => {
    const stats = statsByPlayerId.get(player.id) ?? {
      gp: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      mvpCount: 0,
    };

    const wr = stats.gp > 0 ? (stats.wins / stats.gp) * 100 : 0;

    return {
      id: player.id,
      name: player.name,
      riotName: player.riotName || "-",
      riotTag: player.riotTag || "-",
      elo: player.elo,
      winStreak: player.winStreak,
      lossStreak: player.lossStreak,
      gp: stats.gp,
      wins: stats.wins,
      losses: stats.losses,
      wr,
      kills: stats.kills,
      deaths: stats.deaths,
      assists: stats.assists,
      kda: formatKda(stats.kills, stats.deaths, stats.assists),
      mvpCount: stats.mvpCount,
      streak: formatStreak(player.winStreak, player.lossStreak),
    };
  });

  rosterRows.sort((a, b) => b.elo - a.elo);

  const rosterAvgElo = rosterRows.length
    ? Math.round(rosterRows.reduce((sum, player) => sum + player.elo, 0) / rosterRows.length)
    : 0;

  const fightScore = hasPlayerStatData ? clamp(avgKills * 12) : 0;
  const controlScore = hasPlayerStatData ? clamp(100 - avgDeaths * 10) : 0;
  const teamplayScore = hasPlayerStatData ? clamp(avgAssists * 8) : 0;
  const winScore = hasGameData ? clamp(gameWr) : 0;

  const totalGames = matchGames.length || 1;
  const totalMVPs = playerStats.filter((s) => s.isMVP).length;
  const impactScore = hasGameData ? clamp((totalMVPs / totalGames) * 100) : 0;

  const efficiencyScore = rosterRows.length ? clamp(rosterAvgElo / 16) : 0;

  const radarMetrics: RadarMetric[] = [
    {
      label: "WINRATE",
      short: "WR",
      valueLabel: hasGameData ? formatPercent(gameWr) : "—",
      chartValue: winScore,
      position: {
        left: "50%",
        top: "0%",
        transform: "translateX(-50%)",
        textAlign: "center",
      },
    },
    {
      label: "KILLS/AGGRESSION",
      short: "AGG",
      valueLabel: hasPlayerStatData ? avgKills.toFixed(1) : "—",
      chartValue: fightScore,
      position: {
        right: "3%",
        top: "20%",
        textAlign: "right",
      },
    },
    {
      label: "MVP/IMPACT",
      short: "IMP",
      valueLabel: hasPlayerStatData ? `${totalMVPs}` : "—",
      chartValue: impactScore,
      position: {
        right: "10%",
        bottom: "16%",
        textAlign: "right",
      },
    },
    {
      label: "ROSTER STRENGTH",
      short: "ELO",
      valueLabel: rosterRows.length ? String(rosterAvgElo) : "—",
      chartValue: efficiencyScore,
      position: {
        left: "50%",
        bottom: "0%",
        transform: "translateX(-50%)",
        textAlign: "center",
      },
    },
    {
      label: "ASSISTS/TEAMWORK",
      short: "SYNC",
      valueLabel: hasPlayerStatData ? avgAssists.toFixed(1) : "—",
      chartValue: teamplayScore,
      position: {
        left: "10%",
        bottom: "16%",
        textAlign: "left",
      },
    },
    {
      label: "LOW DEATHS / DISCIPLINE",
      short: "MAC",
      valueLabel: hasPlayerStatData ? avgDeaths.toFixed(1) : "—",
      chartValue: controlScore,
      position: {
        left: "3%",
        top: "20%",
        textAlign: "left",
      },
    },
  ];

  const visualRadarValues = radarMetrics.map((metric) => Math.max(22, metric.chartValue));
  const ghostPolygonPoints = buildPolygonPoints([66, 66, 66, 66, 66, 66], 280, 280, 200);
  const livePolygonPoints = buildPolygonPoints(visualRadarValues, 280, 280, 200);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.16),transparent_36%),radial-gradient(circle_at_72%_20%,rgba(177,18,38,0.14),transparent_32%),linear-gradient(to_bottom,rgba(5,5,5,0.98),rgba(0,0,0,1))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#b11226]/60 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <Link
              href="/tournaments/split-one"
              className="inline-flex items-center gap-2 border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-[#9ca3af] transition hover:border-[#b11226] hover:text-white"
            >
              Back to Split One Archive
            </Link>
          </div>

          <section className="border border-[#1f1f1f] bg-[#0d0d0d] px-6 py-8 shadow-[0_10px_50px_rgba(0,0,0,0.35)] md:px-8 md:py-10">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#b11226]">
              Split One
            </p>

            <h1 className="mt-3 text-5xl font-black uppercase leading-none [font-family:Anton,Impact,Arial_Black,Arial,sans-serif] md:text-7xl">
              {team.name}
            </h1>

            <div className="mt-5 flex flex-wrap gap-3">
              <HeroPill
                label="Record"
                value={`${gameWins}-${gameLosses}${gameDraws > 0 ? `-${gameDraws}` : ""}`}
              />
              <HeroPill
                label="Win Rate"
                value={hasGameData ? formatPercent(gameWr) : "—"}
                highlight
              />
            </div>
          </section>

          <section className="mt-6 overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] p-6 shadow-[0_16px_70px_rgba(0,0,0,0.45)] md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/40">
                  Performance Map
                </p>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-[0.06em] text-white">
                  Hex Radar
                </h2>
              </div>

              <div className="border border-[#1f1f1f] bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#b11226]">
                Archive Data
              </div>
            </div>

            <div className="mt-10 flex justify-center">
              <div className="relative aspect-square w-full max-w-[640px]">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(177,18,38,0.1),transparent_38%)] blur-2xl" />
                <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_62%)] blur-3xl" />

                <svg viewBox="0 0 560 560" className="relative z-10 h-full w-full">
                  <defs>
                    <filter id="redGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {[1, 2, 3, 4, 5].map((level) => {
                    const radius = (200 / 5) * level;
                    return (
                      <polygon
                        key={level}
                        points={buildGridPolygonPoints(6, 280, 280, radius)}
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {Array.from({ length: 6 }).map((_, index) => {
                    const outer = polarToCartesian(280, 280, 200, (360 / 6) * index);
                    return (
                      <line
                        key={index}
                        x1="280"
                        y1="280"
                        x2={outer.x}
                        y2={outer.y}
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth="1"
                      />
                    );
                  })}

                  <polygon
                    points={buildGridPolygonPoints(6, 280, 280, 200)}
                    fill="rgba(177,18,38,0.08)"
                    stroke="rgba(177,18,38,0.12)"
                    strokeWidth="1"
                  />

                  <polygon
                    points={ghostPolygonPoints}
                    fill="rgba(255,255,255,0.05)"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="1.5"
                  />

                  <polygon
                    points={livePolygonPoints}
                    fill="rgba(177,18,38,0.22)"
                    stroke="rgba(209,26,42,0.98)"
                    strokeWidth="3"
                    filter="url(#redGlow)"
                  />

                  {visualRadarValues.map((value, index) => {
                    const point = polarToCartesian(
                      280,
                      280,
                      (200 * value) / 100,
                      (360 / 6) * index
                    );
                    return (
                      <circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill="rgba(209,26,42,1)"
                        filter="url(#redGlow)"
                      />
                    );
                  })}

                  <circle
                    cx="280"
                    cy="280"
                    r="56"
                    fill="rgba(8,8,8,0.96)"
                    stroke="rgba(255,255,255,0.10)"
                  />
                  <circle cx="280" cy="280" r="38" fill="rgba(255,255,255,0.04)" />
                </svg>

                <div className="absolute left-1/2 top-1/2 z-20 h-[118px] w-[118px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1f1f1f] bg-[radial-gradient(circle,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_40%,rgba(0,0,0,0.9)_74%)] shadow-[0_0_40px_rgba(177,18,38,0.12)]" />

                {radarMetrics.map((metric) => (
                  <RadarOrbitTag
                    key={metric.short}
                    short={metric.short}
                    label={metric.label}
                    value={metric.valueLabel}
                    position={metric.position}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] shadow-[0_10px_50px_rgba(0,0,0,0.35)]">
            <div className="border-b border-[#1f1f1f] px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/40">
                Roster
              </p>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-[0.06em] text-white">
                Player Board
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.03] text-left">
                  <tr className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                    <th className="px-4 py-4">Player</th>
                    <th className="px-4 py-4">Riot ID</th>
                    <th className="px-4 py-4">ELO</th>
                    <th className="px-4 py-4">GP</th>
                    <th className="px-4 py-4">WR</th>
                    <th className="px-4 py-4">KDA</th>
                    <th className="px-4 py-4">MVP</th>
                    <th className="px-4 py-4">Streak</th>
                  </tr>
                </thead>

                <tbody>
                  {rosterRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-white/45">
                        No roster players found.
                      </td>
                    </tr>
                  ) : (
                    rosterRows.map((player, index) => (
                      <tr
                        key={player.id}
                        className={`border-t border-[#1f1f1f] ${
                          index === 0 ? "bg-[#b11226]/10" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-black ${
                                index === 0
                                  ? "border-[#b11226]/50 bg-[#b11226]/15 text-white"
                                  : "border-[#1f1f1f] bg-white/5 text-white/70"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{player.name}</div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                                {index === 0 ? "Top Rated" : "Roster"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-white/75">
                          {player.riotName !== "-" ? `${player.riotName}#${player.riotTag}` : "-"}
                        </td>

                        <td className="px-4 py-4 font-semibold text-white">{player.elo}</td>

                        <td className="px-4 py-4 text-white/75">{player.gp}</td>

                        <td className="px-4 py-4 text-white/75">
                          {player.gp > 0 ? formatPercent(player.wr) : "-"}
                        </td>

                        <td className="px-4 py-4 text-[#d11a2a]">
                          {player.gp > 0 ? player.kda : "-"}
                        </td>

                        <td className="px-4 py-4 text-white/75">{player.mvpCount}</td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                              player.streak.startsWith("W")
                                ? "border border-[#b11226]/40 bg-[#b11226]/15 text-white"
                                : player.streak.startsWith("L")
                                ? "border border-red-500/30 bg-red-500/10 text-red-300"
                                : "border border-white/10 bg-white/5 text-white/70"
                            }`}
                          >
                            {player.streak}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function HeroPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border px-4 py-3 ${
        highlight
          ? "border-[#b11226]/50 bg-[#b11226]/15"
          : "border-[#1f1f1f] bg-black/30"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.25em] ${
          highlight ? "text-[#d11a2a]" : "text-white/40"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function RadarOrbitTag({
  short,
  label,
  value,
  position,
}: {
  short: string;
  label: string;
  value: string | number;
  position: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
    transform?: string;
    textAlign: "left" | "center" | "right";
  };
}) {
  return (
    <div
      className="absolute"
      style={{
        left: position.left,
        right: position.right,
        top: position.top,
        bottom: position.bottom,
        transform: position.transform,
        textAlign: position.textAlign,
      }}
    >
      <div
        className="group flex flex-col transition duration-200"
        style={{
          alignItems:
            position.textAlign === "center"
              ? "center"
              : position.textAlign === "right"
              ? "flex-end"
              : "flex-start",
        }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1f1f1f] bg-[#111] text-[10px] font-black uppercase tracking-[0.18em] text-white/85 shadow-[0_0_20px_rgba(177,18,38,0.14)] transition duration-200 group-hover:border-[#b11226]/60 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(177,18,38,0.22)]">
          {short}
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
          {label}
        </p>
        <p className="mt-1 text-lg font-black text-white">{value}</p>
      </div>
    </div>
  );
}
