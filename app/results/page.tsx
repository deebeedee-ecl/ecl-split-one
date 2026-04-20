import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MatchStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function formatDate(value?: Date | null) {
  if (!value) return "Date not set";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "—";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

function formatGold(value?: number | null) {
  if (value == null || value < 0) return "—";
  return `${(value / 1000).toFixed(1)}k`;
}

function getWinnerDisplay(match: {
  status: MatchStatus;
  bestOf: number;
  homeScore: number;
  awayScore: number;
  winnerTeam?: { name: string } | null;
}) {
  if (match.winnerTeam?.name) return match.winnerTeam.name;

  if (
    match.status === "COMPLETED" &&
    match.bestOf === 2 &&
    match.homeScore === match.awayScore
  ) {
    return "Draw";
  }

  return "—";
}

function getGameWinnerName(
  game: { winnerTeamId: string | null; winnerTeam?: { name: string } | null },
  homeTeam: { id: string; name: string },
  awayTeam: { id: string; name: string }
) {
  if (!game.winnerTeamId) return "No winner recorded";
  if (game.winnerTeam) return game.winnerTeam.name;
  if (game.winnerTeamId === homeTeam.id) return homeTeam.name;
  if (game.winnerTeamId === awayTeam.id) return awayTeam.name;
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
  size = 52,
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

export default async function ResultsPage() {
  const [scheduledMatches, completedMatches] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: "SCHEDULED",
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
      orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
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
      orderBy: [{ scheduledAt: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
            Split One
          </p>
          <h1 className="mt-2 text-5xl font-black uppercase tracking-[0.08em]">
            Results
          </h1>
          <p className="mt-3 max-w-2xl text-white/60">
            Follow upcoming scheduled matches and completed results across the
            regular season and playoffs.
          </p>
        </div>

        <section className="mb-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Upcoming
              </p>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.06em]">
                Scheduled Matches
              </h2>
              <p className="mt-2 max-w-2xl text-white/55">
                The next fixtures currently locked into the calendar.
              </p>
            </div>
          </div>

          {scheduledMatches.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center text-white/55">
              No scheduled matches yet.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {scheduledMatches.map((match) => {
                const homeTag = getTeamTag(match.homeTeam.name);
                const awayTag = getTeamTag(match.awayTeam.name);

                return (
                  <div
                    key={match.id}
                    className="overflow-hidden rounded-3xl border border-green-400/20 bg-gradient-to-br from-green-500/[0.08] via-white/[0.03] to-white/[0.02]"
                  >
                    <div className="border-b border-white/10 px-6 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm uppercase tracking-[0.2em] text-green-400">
                          {match.roundLabel || "Match"} • BO{match.bestOf}
                        </span>

                        <span className="rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-green-300">
                          Scheduled
                        </span>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid items-center gap-4 grid-cols-[1fr_auto_1fr]">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <TeamLogo
                            src={match.homeTeam.logoUrl}
                            alt={match.homeTeam.name}
                            size={62}
                          />
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                              {homeTag}
                            </p>
                            <p className="mt-1 text-base font-bold uppercase leading-tight">
                              {match.homeTeam.name}
                            </p>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-2xl font-black uppercase tracking-[0.2em] text-white">
                            VS
                          </div>
                          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
                            Upcoming
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-3 text-center">
                          <TeamLogo
                            src={match.awayTeam.logoUrl}
                            alt={match.awayTeam.name}
                            size={62}
                          />
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                              {awayTag}
                            </p>
                            <p className="mt-1 text-base font-bold uppercase leading-tight">
                              {match.awayTeam.name}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                          Scheduled Time
                        </div>
                        <div className="mt-1 text-lg font-bold text-white">
                          {formatDate(match.scheduledAt)}
                        </div>
                      </div>

                      {match.notes && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                            Notes
                          </div>
                          <div className="mt-1 text-sm leading-6 text-white/70">
                            {match.notes}
                          </div>
                        </div>
                      )}

                      <div className="mt-5">
                        <Link
                          href="/schedule"
                          className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70 transition hover:border-green-400/40 hover:bg-green-400/10 hover:text-white"
                        >
                          View Schedule
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Archive
              </p>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.06em]">
                Completed Results
              </h2>
              <p className="mt-2 max-w-2xl text-white/55">
                Follow completed match results, series scores, and game
                breakdowns.
              </p>
            </div>
          </div>

          {completedMatches.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center text-white/55">
              No completed results yet.
            </div>
          ) : (
            <div className="grid gap-6">
              {completedMatches.map((match) => {
                const hasGames = match.games.length > 0;
                const homeTag = getTeamTag(match.homeTeam.name);
                const awayTag = getTeamTag(match.awayTeam.name);

                return (
                  <details
                    key={match.id}
                    className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition open:border-green-400/30 open:bg-green-500/5"
                  >
                    <summary className="list-none cursor-pointer p-6">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm uppercase tracking-[0.2em] text-green-400">
                            {match.roundLabel || "Match"} • BO{match.bestOf}
                          </span>

                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                            {match.status === "FORFEIT" ? "Forfeit" : "Completed"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-sm text-white/50">
                            {formatDate(match.scheduledAt)}
                          </div>
                          <div className="text-sm text-white/35 transition group-open:rotate-180">
                            ▼
                          </div>
                        </div>
                      </div>

                      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                          <div className="flex flex-col items-center gap-4 text-center">
                            <TeamLogo
                              src={match.homeTeam.logoUrl}
                              alt={match.homeTeam.name}
                              size={60}
                            />
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                                {homeTag}
                              </p>
                              <p className="mt-1 text-lg font-bold uppercase">
                                {match.homeTeam.name}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-4xl font-black tracking-tight text-white">
                            {match.homeScore} - {match.awayScore}
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                            {match.status === "FORFEIT" ? "Forfeit" : "Final"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                          <div className="flex flex-col items-center gap-4 text-center">
                            <TeamLogo
                              src={match.awayTeam.logoUrl}
                              alt={match.awayTeam.name}
                              size={60}
                            />
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                                {awayTag}
                              </p>
                              <p className="mt-1 text-lg font-bold uppercase">
                                {match.awayTeam.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
                            Winner: {getWinnerDisplay(match)}
                          </span>

                          {hasGames && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                              {match.games.length} Game
                              {match.games.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {match.notes && (
                          <span className="text-sm text-white/50">
                            {match.notes}
                          </span>
                        )}
                      </div>
                    </summary>

                    <div className="border-t border-white/10 px-6 pb-6 pt-5">
                      {hasGames ? (
                        <>
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-black uppercase tracking-[0.08em] text-white">
                                Series Breakdown
                              </h3>
                              <p className="mt-1 text-sm text-white/50">
                                Quick match summary here. Open the full match page
                                for the deep dive.
                              </p>
                            </div>

                            <Link
                              href={`/matches/${match.id}`}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70 transition hover:border-green-400/40 hover:bg-green-400/10 hover:text-white"
                            >
                              View Full Match Data
                            </Link>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {match.games.map((game) => (
                              <div
                                key={game.id}
                                className="rounded-2xl border border-white/10 bg-black/30 p-5"
                              >
                                <div className="mb-4 flex items-center justify-between gap-3">
                                  <h4 className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
                                    Game{" "}
                                    {["One", "Two", "Three", "Four", "Five"][
                                      game.gameNumber - 1
                                    ] || game.gameNumber}
                                  </h4>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                    #{game.gameNumber}
                                  </span>
                                </div>

                                <div className="space-y-3">
                                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                                      Winner
                                    </div>
                                    <div className="mt-1 text-base font-bold text-white">
                                      {getGameWinnerName(
                                        game,
                                        match.homeTeam,
                                        match.awayTeam
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                                        Duration
                                      </div>
                                      <div className="mt-1 text-base font-bold text-white">
                                        {formatDuration(game.durationSeconds)}
                                      </div>
                                    </div>

                                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                                        Gold
                                      </div>
                                      <div className="mt-1 text-base font-bold text-white">
                                        {game.homeGold != null &&
                                        game.awayGold != null
                                          ? `${formatGold(
                                              game.homeGold
                                            )} - ${formatGold(game.awayGold)}`
                                          : "—"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                                      <span>⚔️</span>
                                      <span>Kills</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-base font-bold">
                                      <span className="text-white/60">
                                        {homeTag}
                                      </span>
                                      <span className="text-xl font-black tracking-wide text-white">
                                        {game.homeKills != null &&
                                        game.awayKills != null
                                          ? `${game.homeKills} - ${game.awayKills}`
                                          : "—"}
                                      </span>
                                      <span className="text-white/60">
                                        {awayTag}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                                        Towers
                                      </div>
                                      <div className="mt-1 text-base font-bold text-white">
                                        {game.homeTowers != null &&
                                        game.awayTowers != null
                                          ? `${game.homeTowers} - ${game.awayTowers}`
                                          : "—"}
                                      </div>
                                    </div>

                                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-4 py-3">
                                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                                        Drakes
                                      </div>
                                      <div className="mt-1 text-base font-bold text-white">
                                        {game.homeDrakes != null &&
                                        game.awayDrakes != null
                                          ? `${game.homeDrakes} - ${game.awayDrakes}`
                                          : "—"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-6 text-center text-white/50">
                          <p>No individual game data has been added for this series yet.</p>

                          <Link
                            href={`/matches/${match.id}`}
                            className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70 transition hover:border-green-400/40 hover:bg-green-400/10 hover:text-white"
                          >
                            View Full Match Data
                          </Link>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-10">
          <Link
            href="/schedule"
            className="inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold uppercase tracking-wide text-white transition hover:border-green-400/40 hover:bg-green-400/10"
          >
            View Schedule
          </Link>
        </div>
      </div>
    </main>
  );
}