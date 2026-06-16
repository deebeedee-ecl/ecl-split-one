import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildKnockoutBracket } from "@/lib/knockout-bracket";
import { lockedStandings } from "@/lib/locked-standings";
import { BarChart3, Crown, Shield, Swords, Trophy } from "lucide-react";
import { SplitOneArchiveCarousel } from "./SplitOneArchiveCarousel";

export const dynamic = "force-dynamic";

type PlayerAggregate = {
  playerId: string;
  name: string;
  teamName: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  gold: number;
  mvps: number;
  svps: number;
};

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
        className="flex items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-[10px] font-black uppercase tracking-[0.12em] text-[#9ca3af]"
        style={{ width: size, height: size }}
      >
        {getTeamTag(alt)}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d]"
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill className="object-contain p-2" sizes={`${size}px`} />
    </div>
  );
}

function formatDate(value?: Date | null) {
  if (!value) return "Date TBC";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value);
}

function kda(player: PlayerAggregate) {
  return ((player.kills + player.assists) / Math.max(1, player.deaths)).toFixed(2);
}

function AwardStars({ player }: { player: PlayerAggregate }) {
  if (player.mvps <= 0 && player.svps <= 0) {
    return null;
  }

  return (
    <span className="ml-2 inline-flex items-center justify-end gap-1 text-base leading-none">
      {player.mvps > 0 && (
        <span
          className="text-[#f5c542] drop-shadow-[0_0_8px_rgba(245,197,66,0.35)]"
          aria-label={`${player.mvps} MVP gold stars`}
          title={`${player.mvps} MVP`}
        >
          {"★".repeat(player.mvps)}
        </span>
      )}
      {player.svps > 0 && (
        <span
          className="text-[#c7cbd1] drop-shadow-[0_0_8px_rgba(199,203,209,0.25)]"
          aria-label={`${player.svps} SVP silver stars`}
          title={`${player.svps} SVP`}
        >
          {"★".repeat(player.svps)}
        </span>
      )}
    </span>
  );
}

function perGame(total: number, games: number) {
  if (!games) return "0.0";
  return (total / games).toFixed(1);
}

function getPointsText(points: number) {
  return `${points} pt${points === 1 ? "" : "s"}`;
}

export default async function SplitOneArchivePage() {
  const [teams, knockoutStoredMatches, completedMatches, playerStats] =
    await Promise.all([
      prisma.team.findMany({
        include: {
          players: {
            orderBy: {
              name: "asc",
            },
          },
        },
        orderBy: {
          name: "asc",
        },
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
      prisma.match.findMany({
        where: {
          status: {
            in: ["COMPLETED", "FORFEIT"],
          },
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          winnerTeam: true,
          games: {
            include: {
              winnerTeam: true,
            },
            orderBy: {
              gameNumber: "asc",
            },
          },
        },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      }),
      prisma.matchGamePlayerStat.findMany({
        include: {
          player: true,
          team: true,
        },
      }),
    ]);

  const bracketMatches = buildKnockoutBracket(knockoutStoredMatches);
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const playerMap = new Map<string, PlayerAggregate>();

  for (const stat of playerStats) {
    const existing = playerMap.get(stat.playerId) ?? {
      playerId: stat.playerId,
      name: stat.player.name,
      teamName: stat.team?.name ?? "No team",
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      gold: 0,
      mvps: 0,
      svps: 0,
    };

    existing.games += 1;
    existing.wins += stat.isWin ? 1 : 0;
    existing.kills += stat.kills;
    existing.deaths += stat.deaths;
    existing.assists += stat.assists;
    existing.damage += stat.damage ?? 0;
    existing.gold += stat.gold ?? 0;
    existing.mvps += stat.isMVP ? 1 : 0;
    existing.svps += stat.isSVP ? 1 : 0;

    playerMap.set(stat.playerId, existing);
  }

  const players = Array.from(playerMap.values());
  const uniqueGameCount = new Set(playerStats.map((stat) => stat.matchGameId)).size;
  const mvpLeader = players.slice().sort((a, b) => b.mvps - a.mvps || b.kills - a.kills)[0];
  const killLeader = players.slice().sort((a, b) => b.kills - a.kills)[0];
  const kdaLeader = players
    .filter((player) => player.games >= 2)
    .sort((a, b) => Number(kda(b)) - Number(kda(a)))[0];

  const awards = [
    {
      label: "Champion",
      value: lockedStandings[0]?.teamName ?? "TBC",
      note: "Split One table leader and archived champion slot",
      icon: Crown,
    },
    {
      label: "MVP Leader",
      value: mvpLeader?.name ?? "TBC",
      note: mvpLeader ? `${mvpLeader.mvps} MVP games - ${mvpLeader.teamName}` : "No MVP data yet",
      icon: Trophy,
    },
    {
      label: "Kill Leader",
      value: killLeader?.name ?? "TBC",
      note: killLeader ? `${killLeader.kills} kills - ${perGame(killLeader.kills, killLeader.games)} per game` : "No stat data yet",
      icon: Swords,
    },
    {
      label: "KDA Leader",
      value: kdaLeader?.name ?? "TBC",
      note: kdaLeader ? `${kda(kdaLeader)} KDA across ${kdaLeader.games} games` : "Minimum 2 games",
      icon: BarChart3,
    },
  ];

  const eloLeaderboard = teams
    .flatMap((team) =>
      team.players.map((player) => {
        const aggregate = playerMap.get(player.id);

        return {
          id: player.id,
          name: player.name,
          riotLine:
            player.riotName || player.riotTag
              ? [player.riotName, player.riotTag].filter(Boolean).join("#")
              : null,
          teamName: team.name,
          teamLogoUrl: team.logoUrl,
          elo: player.elo,
          games: aggregate?.games ?? 0,
          wins: aggregate?.wins ?? 0,
          kda: aggregate ? kda(aggregate) : "0.00",
          mvps: aggregate?.mvps ?? 0,
          svps: aggregate?.svps ?? 0,
        };
      })
    )
    .sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.games !== a.games) return b.games - a.games;
      return a.name.localeCompare(b.name);
    });

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate min-h-[760px] overflow-hidden border-b border-[#1f1f1f] bg-[#050505]">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-68"
          src="/videos/split-one.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#050505_0%,rgba(5,5,5,0.9)_28%,rgba(5,5,5,0.48)_62%,rgba(5,5,5,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_36%,rgba(177,18,38,0.34),transparent_35%),linear-gradient(115deg,rgba(177,18,38,0.22),transparent_34%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#050505] via-[#050505]/78 to-transparent" />
        <div className="absolute left-0 top-0 hidden h-full w-[34vw] skew-x-[-12deg] bg-[#b11226]/24 blur-[1px] lg:block" />

        <div className="relative mx-auto flex min-h-[760px] max-w-7xl flex-col justify-center px-4 py-24 sm:px-6 lg:py-32">
          <h1
            className="max-w-6xl font-black uppercase text-white drop-shadow-[0_24px_54px_rgba(0,0,0,0.82)] [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]"
            style={{ fontSize: "clamp(5.5rem, 11vw, 11rem)", lineHeight: 0.78 }}
          >
            Split
            <span className="block text-[#b11226] drop-shadow-[0_10px_24px_rgba(177,18,38,0.4)]">One</span>
          </h1>
          <p className="mt-9 max-w-4xl text-xl leading-9 text-[#e5e7eb] drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
            Historical home for the Split One table, knockout path, player
            awards, results, and team-by-team records. This archive reads the
            existing season data without changing live records.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat label="Teams" value={lockedStandings.length} />
            <HeroStat label="Matches" value={completedMatches.length} />
            <HeroStat label="Tracked Players" value={players.length} />
            <HeroStat label="Games Logged" value={uniqueGameCount} />
          </div>
        </div>
      </section>

      <SplitOneArchiveCarousel
        standings={lockedStandings}
        bracketMatches={bracketMatches}
        eloLeaderboard={eloLeaderboard}
      />

      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeader
            eyebrow="Awards"
            title="Season Leaders"
            description="Automatically summarized from recorded player stat rows where available."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {awards.map((award) => {
              const Icon = award.icon;

              return (
                <div key={award.label} className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
                  <Icon className="text-[#b11226]" size={28} />
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af]">
                    {award.label}
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">{award.value}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#9ca3af]">{award.note}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#050505]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeader
            eyebrow="Teams"
            title="Team by Team"
            description="Open each team card for roster, record, recent archived matches, and player KDA leaders. MVP = gold star, SVP = silver star."
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {lockedStandings.map((standing, index) => {
              const team = teamById.get(standing.teamId);
              const teamMatches = completedMatches.filter(
                (match) =>
                  match.homeTeamId === standing.teamId ||
                  match.awayTeamId === standing.teamId
              );
              const playerRows = players
                .filter((player) => player.teamName === standing.teamName)
                .sort((a, b) => Number(kda(b)) - Number(kda(a)) || b.mvps - a.mvps)
                .slice(0, 5);

              return (
                <details key={standing.teamId} className="group border border-[#1f1f1f] bg-[#0d0d0d]">
                  <summary className="cursor-pointer list-none p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <TeamLogo src={standing.logoUrl} alt={standing.teamName} size={64} />
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
                            Seed {index + 1} - {getPointsText(standing.points)}
                          </p>
                          <h3 className="mt-1 text-2xl font-black text-white">
                            {standing.teamName}
                          </h3>
                          <p className="mt-1 text-sm text-[#9ca3af]">
                            {standing.gameW}-{standing.gameL} games, {standing.diff > 0 ? "+" : ""}
                            {standing.diff} diff
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-black uppercase tracking-[0.12em] text-[#9ca3af] group-open:text-white">
                        Open
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-[#1f1f1f] p-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <MiniStat label="Roster" value={team?.players.length ?? 0} />
                      <MiniStat label="Matches" value={teamMatches.length} />
                      <MiniStat label="Top KDA" value={playerRows[0] ? kda(playerRows[0]) : "0.00"} />
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">
                          Roster
                        </h4>
                        <div className="mt-3 space-y-2">
                          {(team?.players ?? []).length === 0 ? (
                            <p className="text-sm text-[#9ca3af]">No roster data archived.</p>
                          ) : (
                            team?.players.map((player) => (
                              <div
                                key={player.id}
                                className="border border-[#1f1f1f] bg-black/25 px-3 py-2 text-sm"
                              >
                                <span className="font-bold text-white">{player.name}</span>
                                {player.riotName && (
                                  <span className="ml-2 text-[#9ca3af]">
                                    {player.riotName}
                                    {player.riotTag ? `#${player.riotTag}` : ""}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">
                          Player leaders
                        </h4>
                        <div className="mt-3 space-y-2">
                          {playerRows.length === 0 ? (
                            <p className="text-sm text-[#9ca3af]">No stat rows archived.</p>
                          ) : (
                            playerRows.map((player) => (
                              <div
                                key={player.playerId}
                                className="grid grid-cols-[1fr_auto] gap-3 border border-[#1f1f1f] bg-black/25 px-3 py-2 text-sm"
                              >
                                <span className="font-bold text-white">{player.name}</span>
                                <span className="text-right text-[#9ca3af]">
                                  <span className="font-black text-white">{kda(player)} KDA</span>
                                  <AwardStars player={player} />
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <Link
                        href={`/stats/teams/${standing.teamId}`}
                        className="inline-flex items-center gap-2 bg-[#b11226] px-4 py-3 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#d11a2a]"
                      >
                        Team stats
                        <Shield size={16} />
                      </Link>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#080808]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeader
            eyebrow="Results"
            title="Archived Match List"
            description="Completed Split One results in chronological order."
          />

          <div className="mt-8 grid gap-3">
            {completedMatches.length === 0 ? (
              <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-8 text-center text-[#9ca3af]">
                No completed matches are recorded yet.
              </div>
            ) : (
              completedMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="grid gap-4 border border-[#1f1f1f] bg-[#0d0d0d] p-4 transition hover:border-[#b11226] md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_12rem] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamLogo src={match.homeTeam.logoUrl} alt={match.homeTeam.name} size={42} />
                    <span className="truncate font-black text-white">{match.homeTeam.name}</span>
                  </div>
                  <div className="flex h-12 items-center justify-center border border-[#1f1f1f] bg-black/30 text-center text-2xl font-black text-white">
                    {match.homeScore} - {match.awayScore}
                  </div>
                  <div className="flex min-w-0 items-center gap-3 md:justify-end">
                    <span className="truncate font-black text-white">{match.awayTeam.name}</span>
                    <TeamLogo src={match.awayTeam.logoUrl} alt={match.awayTeam.name} size={42} />
                  </div>
                  <div className="text-xs uppercase tracking-[0.14em] text-[#9ca3af] md:text-right">
                    {match.stage.replace("_", " ")} - {formatDate(match.scheduledAt)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-white/10 bg-black/58 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b8bec8]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-[#1f1f1f] bg-black/25 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
        {title}
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-[#9ca3af]">
        {description}
      </p>
    </div>
  );
}
