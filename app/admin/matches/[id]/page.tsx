import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MatchStage, MatchStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const stageOptions = [
  { value: "REGULAR_SEASON", label: "Regular Season" },
  { value: "PLAYOFFS", label: "Playoffs" },
  { value: "SEMIFINALS", label: "Semifinals" },
  { value: "FINALS", label: "Finals" },
];

const statusOptions = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FORFEIT", label: "Forfeit" },
  { value: "POSTPONED", label: "Postponed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function formatStage(stage: MatchStage) {
  switch (stage) {
    case "REGULAR_SEASON":
      return "Regular Season";
    case "PLAYOFFS":
      return "Playoffs";
    case "SEMIFINALS":
      return "Semifinals";
    case "FINALS":
      return "Finals";
    default:
      return stage;
  }
}

function formatStatus(status: MatchStatus) {
  switch (status) {
    case "SCHEDULED":
      return "Scheduled";
    case "COMPLETED":
      return "Completed";
    case "FORFEIT":
      return "Forfeit";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function getWinnerDisplay(match: {
  status: MatchStatus;
  bestOf: number;
  homeScore: number;
  awayScore: number;
  winnerTeam?: { name: string } | null;
}) {
  if (match.winnerTeam?.name) {
    return match.winnerTeam.name;
  }

  if (
    match.status === "COMPLETED" &&
    match.bestOf === 2 &&
    match.homeScore === match.awayScore
  ) {
    return "DRAW";
  }

  return "-";
}

function toDateTimeLocal(date?: Date | null) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function updateMatch(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Match ID is required.");
  }

  const existingMatch = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      games: {
        orderBy: {
          gameNumber: "asc",
        },
      },
    },
  });

  if (!existingMatch) {
    throw new Error("Match not found.");
  }

  const stage = String(formData.get("stage") || "").trim() as MatchStage;
  const roundLabel = String(formData.get("roundLabel") || "").trim();
  const matchLabel = String(formData.get("matchLabel") || "").trim();
  const bestOfRaw = String(formData.get("bestOf") || "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim();
  const status = String(formData.get("status") || "").trim() as MatchStatus;
  const homeScoreRaw = String(formData.get("homeScore") || "0").trim();
  const awayScoreRaw = String(formData.get("awayScore") || "0").trim();
  const winnerTeamIdRaw = String(formData.get("winnerTeamId") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!Object.values(MatchStage).includes(stage)) {
    throw new Error("Invalid stage.");
  }

  if (!Object.values(MatchStatus).includes(status)) {
    throw new Error("Invalid status.");
  }

  const bestOf = Number(bestOfRaw);
  if (![1, 2, 3, 5].includes(bestOf)) {
    throw new Error("Best of must be 1, 2, 3, or 5.");
  }

  const homeScore = Number(homeScoreRaw);
  const awayScore = Number(awayScoreRaw);

  if (
    Number.isNaN(homeScore) ||
    Number.isNaN(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    throw new Error("Scores must be valid non-negative numbers.");
  }

  let winnerTeamId: string | null = winnerTeamIdRaw || null;

  if (
    winnerTeamId &&
    winnerTeamId !== existingMatch.homeTeamId &&
    winnerTeamId !== existingMatch.awayTeamId
  ) {
    throw new Error("Winner must be one of the two teams in the match.");
  }

  const gameUpdates: Array<{
    gameNumber: number;
    winnerTeamId: string | null;
    durationSeconds: number | null;
    homeKills: number | null;
    awayKills: number | null;
    homeGold: number | null;
    awayGold: number | null;
    mvpName: string | null;
    notes: string | null;
    isEmpty: boolean;
  }> = [];

  for (let gameNumber = 1; gameNumber <= bestOf; gameNumber++) {
    const gameWinnerTeamIdRaw = String(
      formData.get(`game_${gameNumber}_winnerTeamId`) || ""
    ).trim();

    const gameDurationRaw = String(
      formData.get(`game_${gameNumber}_durationMinutes`) || ""
    ).trim();

    const gameHomeKillsRaw = String(
      formData.get(`game_${gameNumber}_homeKills`) || ""
    ).trim();

    const gameAwayKillsRaw = String(
      formData.get(`game_${gameNumber}_awayKills`) || ""
    ).trim();

    const gameHomeGoldRaw = String(
      formData.get(`game_${gameNumber}_homeGold`) || ""
    ).trim();

    const gameAwayGoldRaw = String(
      formData.get(`game_${gameNumber}_awayGold`) || ""
    ).trim();

    const gameMvpNameRaw = String(
      formData.get(`game_${gameNumber}_mvpName`) || ""
    ).trim();

    const gameNotesRaw = String(
      formData.get(`game_${gameNumber}_notes`) || ""
    ).trim();

    const gameWinnerTeamId = gameWinnerTeamIdRaw || null;

    if (
      gameWinnerTeamId &&
      gameWinnerTeamId !== existingMatch.homeTeamId &&
      gameWinnerTeamId !== existingMatch.awayTeamId
    ) {
      throw new Error(
        `Game ${gameNumber}: winner must be one of the two teams in the match.`
      );
    }

    let durationSeconds: number | null = null;
    if (gameDurationRaw !== "") {
      const parsedMinutes = Number(gameDurationRaw);

      if (Number.isNaN(parsedMinutes) || parsedMinutes < 0) {
        throw new Error(
          `Game ${gameNumber}: duration must be a valid non-negative number.`
        );
      }

      durationSeconds = Math.round(parsedMinutes * 60);
    }

    const parseOptionalInt = (value: string, fieldLabel: string) => {
      if (value === "") return null;

      const parsed = Number(value);

      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(`Game ${gameNumber}: ${fieldLabel} must be a valid non-negative number.`);
      }

      return Math.round(parsed);
    };

    const homeKills = parseOptionalInt(gameHomeKillsRaw, "home kills");
    const awayKills = parseOptionalInt(gameAwayKillsRaw, "away kills");
    const homeGold = parseOptionalInt(gameHomeGoldRaw, "home gold");
    const awayGold = parseOptionalInt(gameAwayGoldRaw, "away gold");

    const isEmpty =
      !gameWinnerTeamId &&
      durationSeconds === null &&
      homeKills === null &&
      awayKills === null &&
      homeGold === null &&
      awayGold === null &&
      gameMvpNameRaw.length === 0 &&
      gameNotesRaw.length === 0;

    gameUpdates.push({
      gameNumber,
      winnerTeamId: gameWinnerTeamId,
      durationSeconds,
      homeKills,
      awayKills,
      homeGold,
      awayGold,
      mvpName: gameMvpNameRaw || null,
      notes: gameNotesRaw || null,
      isEmpty,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id },
      data: {
        stage,
        roundLabel: roundLabel || null,
        matchLabel: matchLabel || null,
        bestOf,
        scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw) : null,
        status,
        homeScore,
        awayScore,
        winnerTeamId,
        notes: notes || null,
      },
    });

    await tx.matchGame.deleteMany({
      where: {
        matchId: id,
        gameNumber: {
          gt: bestOf,
        },
      },
    });

    for (const game of gameUpdates) {
      const existingGame = existingMatch.games.find(
        (item) => item.gameNumber === game.gameNumber
      );

      if (game.isEmpty) {
        if (existingGame) {
          await tx.matchGame.delete({
            where: {
              id: existingGame.id,
            },
          });
        }
        continue;
      }

      if (existingGame) {
        await tx.matchGame.update({
          where: {
            id: existingGame.id,
          },
          data: {
            winnerTeamId: game.winnerTeamId,
            durationSeconds: game.durationSeconds,
            homeKills: game.homeKills,
            awayKills: game.awayKills,
            homeGold: game.homeGold,
            awayGold: game.awayGold,
            mvpName: game.mvpName,
            notes: game.notes,
          },
        });
      } else {
        await tx.matchGame.create({
          data: {
            matchId: id,
            gameNumber: game.gameNumber,
            winnerTeamId: game.winnerTeamId,
            durationSeconds: game.durationSeconds,
            homeKills: game.homeKills,
            awayKills: game.awayKills,
            homeGold: game.homeGold,
            awayGold: game.awayGold,
            mvpName: game.mvpName,
            notes: game.notes,
          },
        });
      }
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/matches");
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath("/schedule");
  revalidatePath("/results");
  revalidatePath("/standings");

  redirect("/admin/matches?updated=1");
}

async function deleteMatch(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Match ID is required.");
  }

  await prisma.match.delete({
    where: { id },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/matches");
  revalidatePath("/schedule");
  revalidatePath("/results");
  revalidatePath("/standings");

  redirect("/admin/matches?deleted=1");
}

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      winnerTeam: true,
      games: {
        orderBy: {
          gameNumber: "asc",
        },
      },
    },
  });

  if (!match) {
    notFound();
  }

  const gameSlots = Array.from({ length: match.bestOf }, (_, index) => {
    const gameNumber = index + 1;
    const existingGame = match.games.find((game) => game.gameNumber === gameNumber);

    return {
      gameNumber,
      winnerTeamId: existingGame?.winnerTeamId ?? "",
      durationMinutes:
        existingGame?.durationSeconds != null
          ? String(existingGame.durationSeconds / 60)
          : "",
      homeKills: existingGame?.homeKills?.toString() ?? "",
      awayKills: existingGame?.awayKills?.toString() ?? "",
      homeGold: existingGame?.homeGold?.toString() ?? "",
      awayGold: existingGame?.awayGold?.toString() ?? "",
      mvpName: existingGame?.mvpName ?? "",
      notes: existingGame?.notes ?? "",
    };
  });

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link
            href="/admin/matches"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-green-400"
          >
            ← Back to Match Admin
          </Link>

          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-green-400"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
            Match Editor
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase tracking-[0.08em]">
            {match.homeTeam.name} vs {match.awayTeam.name}
          </h1>
          <p className="mt-3 text-sm text-white/60">
            Update fixture details, scoreline, status, winner, and individual game data.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Stage" value={formatStage(match.stage)} />
          <StatCard label="Status" value={formatStatus(match.status)} />
          <StatCard label="Score" value={`${match.homeScore} - ${match.awayScore}`} />
          <StatCard label="Winner" value={getWinnerDisplay(match)} />
        </div>

        <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-6">
          <h2 className="text-2xl font-bold">Edit Match</h2>
          <p className="mt-2 text-sm text-white/65">
            Save updated match information for schedule, results, standings, and future game stats.
          </p>

          <form action={updateMatch} className="mt-6 space-y-8">
            <input type="hidden" name="id" value={match.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Home Team
                </label>
                <input
                  value={match.homeTeam.name}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white/70 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Away Team
                </label>
                <input
                  value={match.awayTeam.name}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white/70 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Stage
                </label>
                <select
                  name="stage"
                  required
                  defaultValue={match.stage}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                >
                  {stageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Status
                </label>
                <select
                  name="status"
                  required
                  defaultValue={match.status}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Round Label
                </label>
                <input
                  name="roundLabel"
                  type="text"
                  defaultValue={match.roundLabel || ""}
                  placeholder="e.g. Week 1"
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Match Label
                </label>
                <input
                  name="matchLabel"
                  type="text"
                  defaultValue={match.matchLabel || ""}
                  placeholder="e.g. Match A"
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Best Of
                </label>
                <select
                  name="bestOf"
                  required
                  defaultValue={String(match.bestOf)}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                >
                  <option value="1">BO1</option>
                  <option value="2">BO2</option>
                  <option value="3">BO3</option>
                  <option value="5">BO5</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Scheduled At
                </label>
                <input
                  name="scheduledAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(match.scheduledAt)}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Home Score
                </label>
                <input
                  name="homeScore"
                  type="number"
                  min="0"
                  defaultValue={match.homeScore}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Away Score
                </label>
                <input
                  name="awayScore"
                  type="number"
                  min="0"
                  defaultValue={match.awayScore}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Winner / Draw
                </label>
                <select
                  name="winnerTeamId"
                  defaultValue={match.winnerTeamId || ""}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                >
                  <option value="">DRAW / No Winner</option>
                  <option value={match.homeTeam.id}>{match.homeTeam.name}</option>
                  <option value={match.awayTeam.id}>{match.awayTeam.name}</option>
                </select>
                <p className="mt-2 text-xs text-white/45">
                  Leave this as DRAW / No Winner for a completed BO2 result like 1-1.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={5}
                  defaultValue={match.notes || ""}
                  placeholder="Optional admin notes"
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <div className="mb-4">
                <h3 className="text-2xl font-bold">Individual Games</h3>
                <p className="mt-2 text-sm text-white/60">
                  Add per-game results for this series. Blank game cards will not be saved.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {gameSlots.map((game) => (
                  <div
                    key={game.gameNumber}
                    className="rounded-2xl border border-white/10 bg-black/40 p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-lg font-black uppercase tracking-[0.08em] text-green-400">
                        Game {game.gameNumber}
                      </h4>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        {game.durationMinutes ? `${game.durationMinutes} min` : "-"}
                      </span>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Winner
                        </label>
                        <select
                          name={`game_${game.gameNumber}_winnerTeamId`}
                          defaultValue={String(game.winnerTeamId)}
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                        >
                          <option value="">No winner selected</option>
                          <option value={match.homeTeam.id}>{match.homeTeam.name}</option>
                          <option value={match.awayTeam.id}>{match.awayTeam.name}</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Duration (minutes)
                        </label>
                        <input
                          name={`game_${game.gameNumber}_durationMinutes`}
                          type="number"
                          min="0"
                          step="0.1"
                          defaultValue={game.durationMinutes}
                          placeholder="e.g. 33"
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white/80">
                            {match.homeTeam.name} Kills
                          </label>
                          <input
                            name={`game_${game.gameNumber}_homeKills`}
                            type="number"
                            min="0"
                            defaultValue={game.homeKills}
                            placeholder="e.g. 30"
                            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white/80">
                            {match.awayTeam.name} Kills
                          </label>
                          <input
                            name={`game_${game.gameNumber}_awayKills`}
                            type="number"
                            min="0"
                            defaultValue={game.awayKills}
                            placeholder="e.g. 20"
                            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white/80">
                            {match.homeTeam.name} Gold
                          </label>
                          <input
                            name={`game_${game.gameNumber}_homeGold`}
                            type="number"
                            min="0"
                            defaultValue={game.homeGold}
                            placeholder="e.g. 48032"
                            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white/80">
                            {match.awayTeam.name} Gold
                          </label>
                          <input
                            name={`game_${game.gameNumber}_awayGold`}
                            type="number"
                            min="0"
                            defaultValue={game.awayGold}
                            placeholder="e.g. 42584"
                            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          MVP
                        </label>
                        <input
                          name={`game_${game.gameNumber}_mvpName`}
                          type="text"
                          defaultValue={game.mvpName}
                          placeholder="e.g. nidebaba"
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Game Notes
                        </label>
                        <textarea
                          name={`game_${game.gameNumber}_notes`}
                          rows={3}
                          defaultValue={game.notes}
                          placeholder="Optional notes for this individual game"
                          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-xl bg-green-400 px-6 py-3 font-bold uppercase tracking-wide text-black transition hover:scale-[1.02] hover:bg-green-300"
              >
                Save Changes
              </button>

              <Link
                href="/admin/matches"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-bold uppercase tracking-wide text-white transition hover:border-green-400/40 hover:bg-green-400/10"
              >
                Cancel
              </Link>
            </div>
          </form>

          <div className="mt-8 border-t border-white/10 pt-6">
            <h3 className="text-lg font-bold text-red-300">Danger Zone</h3>
            <p className="mt-2 text-sm text-white/55">
              Delete this match entry completely from the system.
            </p>

            <form action={deleteMatch} className="mt-4">
              <input type="hidden" name="id" value={match.id} />
              <button
                type="submit"
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-6 py-3 font-bold uppercase tracking-wide text-red-300 transition hover:border-red-400/50 hover:bg-red-500/15"
              >
                Delete Match
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}