import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildKnockoutBracket } from "@/lib/knockout-bracket";
import { lockedStandings } from "@/lib/locked-standings";
import {
  Crosshair,
  Flame,
  Handshake,
  Shield,
  ShieldCheck,
  Swords,
  Trophy,
} from "lucide-react";
import { SplitOneArchiveCarousel } from "./SplitOneArchiveCarousel";
import {
  splitOneChampionSummary,
  splitOneLockedLeaderboard,
  splitOneStandoutAwards,
  type SplitOneStandoutAward,
} from "@/lib/split-one-archive";

export const dynamic = "force-dynamic";

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

function getAwardIcon(icon: SplitOneStandoutAward["icon"]) {
  const icons = {
    target: Crosshair,
    shield: ShieldCheck,
    flame: Flame,
    trophy: Trophy,
    assist: Handshake,
    swords: Swords,
  };

  return icons[icon];
}

function getPointsText(points: number) {
  return `${points} pt${points === 1 ? "" : "s"}`;
}

function getLockedMatchCount() {
  return lockedStandings.reduce((total, standing) => total + standing.played, 0) / 2;
}

function getLockedGameCount() {
  return lockedStandings.reduce((total, standing) => total + standing.gameW, 0);
}

export default async function SplitOneArchivePage() {
  const splitOneTeamIds = lockedStandings.map((team) => team.teamId);
  const splitOneTeamNames = lockedStandings.map((team) => team.teamName);
  const splitOneMatchWhere = {
    OR: [
      { homeTeamId: { in: splitOneTeamIds } },
      { awayTeamId: { in: splitOneTeamIds } },
      { homeTeam: { name: { in: splitOneTeamNames } } },
      { awayTeam: { name: { in: splitOneTeamNames } } },
    ],
    NOT: [
      { roundLabel: { startsWith: "IH" } },
      { matchLabel: { startsWith: "IH" } },
      { homeTeam: { name: { startsWith: "Ranked IH" } } },
      { awayTeam: { name: { startsWith: "Ranked IH" } } },
    ],
  } satisfies Prisma.MatchWhereInput;

  const archiveData = await (async () => {
    try {
      const [teams, knockoutStoredMatches, completedMatches, playerStats] =
        await Promise.all([
          prisma.team.findMany({
            where: {
              OR: [{ id: { in: splitOneTeamIds } }, { name: { in: splitOneTeamNames } }],
            },
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
              ...splitOneMatchWhere,
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
              ...splitOneMatchWhere,
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
            where: {
              matchGame: {
                match: {
                  status: {
                    in: ["COMPLETED", "FORFEIT"],
                  },
                  ...splitOneMatchWhere,
                },
              },
            },
            include: {
              player: true,
              team: true,
            },
          }),
        ]);

      return {
        teams,
        knockoutStoredMatches,
        completedMatches,
        playerStats,
        dataError: false,
      };
    } catch (error) {
      console.error("Split One archive data failed to load", error);

      return {
        teams: [],
        knockoutStoredMatches: [],
        completedMatches: [],
        playerStats: [],
        dataError: true,
      };
    }
  })();

  const { knockoutStoredMatches, completedMatches, playerStats, dataError } = archiveData;

  const bracketMatches = buildKnockoutBracket(knockoutStoredMatches);
  const lockedMatchCount = getLockedMatchCount();
  const lockedGameCount = getLockedGameCount();
  const uniqueGameCount =
    new Set(playerStats.map((stat) => stat.matchGameId)).size || lockedGameCount;
  const matchCount = completedMatches.length || lockedMatchCount;
  const trackedPlayerCount = splitOneLockedLeaderboard.length;
  const eloLeaderboard = splitOneLockedLeaderboard;

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
            awards, results, and team-by-team records. The core archive is
            locked from final standings and recovered season screenshots.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat label="Teams" value={lockedStandings.length} />
            <HeroStat label="Matches" value={matchCount} />
            <HeroStat label="Tracked Players" value={trackedPlayerCount} />
            <HeroStat label="Games Logged" value={uniqueGameCount} />
          </div>
        </div>
      </section>

      <SplitOneArchiveCarousel
        standings={lockedStandings}
        bracketMatches={bracketMatches}
        eloLeaderboard={eloLeaderboard}
      />

      <section className="border-b border-[#1f1f1f] bg-[#050505]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid overflow-hidden border border-[#332a0c] bg-[linear-gradient(120deg,rgba(255,214,10,0.22),rgba(5,5,5,0.86)_38%,rgba(20,83,45,0.26))] shadow-[0_24px_90px_rgba(0,0,0,0.45)] lg:grid-cols-[0.92fr_1.35fr]">
            <div className="p-6 sm:p-10">
              <div className="relative flex aspect-[1.12] items-center justify-center border border-[#3a3517] bg-black/62">
                <div className="absolute left-5 top-5 bg-[#ffd60a] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-black">
                  Champions
                </div>
                <Image
                  src={splitOneChampionSummary.logoUrl}
                  alt={splitOneChampionSummary.champion}
                  width={300}
                  height={300}
                  className="h-56 w-56 object-contain sm:h-72 sm:w-72"
                />
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-10">
              <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.26em] text-[#fff4a3]">
                <Trophy size={18} />
                Spring Split Champions
              </p>
              <h2 className="mt-5 text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif] sm:text-7xl">
                {splitOneChampionSummary.champion}
              </h2>
              <p className="mt-6 max-w-3xl text-base leading-8 text-[#f3f4f6]">
                {splitOneChampionSummary.body}
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Finals" value={splitOneChampionSummary.finalsScore} />
                <MiniStat label="Run" value={splitOneChampionSummary.run} />
                <MiniStat label="Crown" value={splitOneChampionSummary.crown} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border border-[#1f1f1f] bg-[#0d0d0d] p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#4ade80]">
                Split MVP
              </p>
              <h3 className="mt-3 text-4xl font-black uppercase text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
                {splitOneChampionSummary.mvp.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
                {splitOneChampionSummary.mvp.note}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="ELO" value={splitOneChampionSummary.mvp.elo} />
              <MiniStat label="KDA" value={splitOneChampionSummary.mvp.kda} />
              <MiniStat label="WR" value={splitOneChampionSummary.mvp.winRate} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeader
            eyebrow="Split Awards"
            title="Season Standouts"
            description="Recovered from the final Split One archive screenshots and locked for historical display."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {splitOneStandoutAwards.map((award) => {
              const Icon = getAwardIcon(award.icon);

              return (
                <div key={award.label} className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#777]">
                        {award.qualifier}
                      </p>
                      <h3 className="mt-3 text-lg font-black uppercase text-white">
                        {award.label}
                      </h3>
                    </div>
                    <span className="flex size-10 items-center justify-center border border-[#14532d] bg-[#052e16] text-[#4ade80]">
                      <Icon size={20} />
                    </span>
                  </div>

                  <p className="mt-5 text-4xl font-black text-[#fff7b2]">
                    {award.value}
                  </p>
                  <p className="mt-2 text-sm font-black text-white">{award.player}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">{award.riotLine}</p>
                  <p className="mt-5 text-sm leading-6 text-[#9ca3af]">
                    {award.description}
                  </p>
                </div>
              );
            })}
          </div>

          {dataError && (
            <div className="mt-8 border border-[#2a2a2a] bg-[#101010] p-5 text-sm leading-6 text-[#b8bec8]">
              Live database rows failed to load, so this page is showing the locked screenshot
              archive only.
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#050505]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeader
            eyebrow="Teams"
            title="Team by Team"
            description="Open each team card for locked standings, recovered leaderboard names, and screenshot-backed award mentions."
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {lockedStandings.map((standing, index) => {
              const teamMatches = completedMatches.filter(
                (match) =>
                  match.homeTeamId === standing.teamId ||
                  match.awayTeamId === standing.teamId
              );
              const archivedRows = splitOneLockedLeaderboard.filter(
                (player) => player.teamName === standing.teamName
              );
              const recoveredAwards = splitOneStandoutAwards.filter((award) =>
                archivedRows.some(
                  (player) => player.name.toLowerCase() === award.player.toLowerCase()
                )
              );

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
                      <MiniStat label="Recovered Players" value={archivedRows.length || "None"} />
                      <MiniStat label="Matches" value={teamMatches.length || standing.played} />
                      <MiniStat label="Top ELO" value={archivedRows[0]?.elo ?? "Locked"} />
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">
                          Recovered leaderboard
                        </h4>
                        <div className="mt-3 space-y-2">
                          {archivedRows.length === 0 ? (
                            <p className="text-sm text-[#9ca3af]">
                              No screenshot-backed player rows recovered for this team.
                            </p>
                          ) : (
                            archivedRows.map((player) => (
                              <div
                                key={player.id}
                                className="grid grid-cols-[1fr_auto] gap-3 border border-[#1f1f1f] bg-black/25 px-3 py-2 text-sm"
                              >
                                <span>
                                  <span className="font-bold text-white">{player.name}</span>
                                  {player.riotLine && (
                                    <span className="ml-2 text-[#6b7280]">{player.riotLine}</span>
                                  )}
                                </span>
                                <span className="font-black text-[#4ade80]">{player.elo}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">
                          Recovered awards
                        </h4>
                        <div className="mt-3 space-y-2">
                          {recoveredAwards.length === 0 ? (
                            <p className="text-sm text-[#9ca3af]">
                              No screenshot-backed award rows recovered for this team.
                            </p>
                          ) : (
                            recoveredAwards.map((award) => (
                              <div
                                key={`${standing.teamId}-${award.label}`}
                                className="grid grid-cols-[1fr_auto] gap-3 border border-[#1f1f1f] bg-black/25 px-3 py-2 text-sm"
                              >
                                <span>
                                  <span className="font-bold text-white">{award.label}</span>
                                  <span className="ml-2 text-[#6b7280]">{award.player}</span>
                                </span>
                                <span className="text-right font-black text-[#fff7b2]">
                                  {award.value}
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
