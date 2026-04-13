import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calculateLpChange } from "@/lib/elo";
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

function buildRedirectUrl(id: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/admin/matches/${id}?${search.toString()}`;
}

function parseRequiredNonNegativeInt(value: string, label: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid non-negative number.`);
  }

  return Math.round(parsed);
}

async function updateMatch(formData: FormData) {
  "use server";

  try {
    const id = String(formData.get("id") || "").trim();

    if (!id) {
      redirect("/admin/matches?error=missing_match_id");
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
      redirect("/admin/matches?error=match_not_found");
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
      redirect(buildRedirectUrl(id, { error: "invalid_stage" }));
    }

    if (!Object.values(MatchStatus).includes(status)) {
      redirect(buildRedirectUrl(id, { error: "invalid_status" }));
    }

    const bestOf = Number(bestOfRaw);
    if (![1, 2, 3, 5].includes(bestOf)) {
      redirect(buildRedirectUrl(id, { error: "invalid_best_of" }));
    }

    const homeScore = Number(homeScoreRaw);
    const awayScore = Number(awayScoreRaw);

    if (
      Number.isNaN(homeScore) ||
      Number.isNaN(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      redirect(buildRedirectUrl(id, { error: "invalid_scores" }));
    }

    let winnerTeamId: string | null = winnerTeamIdRaw || null;

    if (
      winnerTeamId &&
      winnerTeamId !== existingMatch.homeTeamId &&
      winnerTeamId !== existingMatch.awayTeamId
    ) {
      redirect(buildRedirectUrl(id, { error: "invalid_match_winner" }));
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
        redirect(
          buildRedirectUrl(id, {
            error: `game_${gameNumber}_invalid_winner`,
          })
        );
      }

      let durationSeconds: number | null = null;
      if (gameDurationRaw !== "") {
        const parsedMinutes = Number(gameDurationRaw);

        if (Number.isNaN(parsedMinutes) || parsedMinutes < 0) {
          redirect(
            buildRedirectUrl(id, {
              error: `game_${gameNumber}_invalid_duration`,
            })
          );
        }

        durationSeconds = Math.round(parsedMinutes * 60);
      }

      const parseOptionalInt = (value: string) => {
        if (value === "") return null;

        const parsed = Number(value);

        if (Number.isNaN(parsed) || parsed < 0) {
          return "__INVALID__";
        }

        return Math.round(parsed);
      };

      const homeKills = parseOptionalInt(gameHomeKillsRaw);
      const awayKills = parseOptionalInt(gameAwayKillsRaw);
      const homeGold = parseOptionalInt(gameHomeGoldRaw);
      const awayGold = parseOptionalInt(gameAwayGoldRaw);

      if (
        homeKills === "__INVALID__" ||
        awayKills === "__INVALID__" ||
        homeGold === "__INVALID__" ||
        awayGold === "__INVALID__"
      ) {
        redirect(
          buildRedirectUrl(id, {
            error: `game_${gameNumber}_invalid_numbers`,
          })
        );
      }

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
        homeKills: homeKills as number | null,
        awayKills: awayKills as number | null,
        homeGold: homeGold as number | null,
        awayGold: awayGold as number | null,
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
    revalidatePath(`/matches/${id}`);

    redirect(buildRedirectUrl(id, { updated: "1" }));
  } catch (error) {
    console.error("updateMatch error:", error);

    const id = String(formData.get("id") || "").trim();
    if (id) {
      redirect(buildRedirectUrl(id, { error: "update_failed" }));
    }

    redirect("/admin/matches?error=update_failed");
  }
}

async function submitGameStats(formData: FormData) {
  "use server";

  try {
    const matchId = String(formData.get("matchId") || "").trim();
    const gameNumberRaw = String(formData.get("gameNumber") || "").trim();

    if (!matchId || !gameNumberRaw) {
      redirect("/admin/matches?error=missing_stats_ids");
    }

    const gameNumber = Number(gameNumberRaw);

    if (!Number.isInteger(gameNumber) || gameNumber < 1) {
      redirect(buildRedirectUrl(matchId, { error: "invalid_game_number" }));
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          include: {
            players: {
              orderBy: {
                riotName: "asc",
              },
            },
          },
        },
        awayTeam: {
          include: {
            players: {
              orderBy: {
                riotName: "asc",
              },
            },
          },
        },
        games: {
          orderBy: {
            gameNumber: "asc",
          },
        },
      },
    });

    if (!match) {
      redirect("/admin/matches?error=match_not_found");
    }

    const game = match.games.find((g) => g.gameNumber === gameNumber);

    if (!game) {
      redirect(
        buildRedirectUrl(matchId, {
          error: `game_${gameNumber}_not_found`,
        })
      );
    }

    if (!game.winnerTeamId) {
      redirect(
        buildRedirectUrl(matchId, {
          error: `game_${gameNumber}_winner_not_set`,
        })
      );
    }

    const homeTeamPlayerIds = new Set(match.homeTeam.players.map((p) => p.id));
    const awayTeamPlayerIds = new Set(match.awayTeam.players.map((p) => p.id));

    const entries: Array<{
      playerId: string;
      teamId: string;
      kills: number;
      deaths: number;
      assists: number;
      isMVP: boolean;
    }> = [];

    for (let i = 0; i < 5; i++) {
      const playerId = String(formData.get(`home_player_${i}`) || "").trim();
      const killsRaw = String(formData.get(`home_k_${i}`) || "").trim();
      const deathsRaw = String(formData.get(`home_d_${i}`) || "").trim();
      const assistsRaw = String(formData.get(`home_a_${i}`) || "").trim();
      const isMVP = formData.get(`home_mvp_${i}`) === "on";

      const hasAnyValue =
        playerId !== "" ||
        killsRaw !== "" ||
        deathsRaw !== "" ||
        assistsRaw !== "" ||
        isMVP;

      if (!hasAnyValue) continue;

      if (!playerId) {
        redirect(
          buildRedirectUrl(matchId, {
            error: `game_${gameNumber}_home_missing_player`,
          })
        );
      }

      if (!homeTeamPlayerIds.has(playerId)) {
        redirect(
          buildRedirectUrl(matchId, {
            error: `game_${gameNumber}_home_invalid_player`,
          })
        );
      }

      const kills = parseRequiredNonNegativeInt(killsRaw, "Kills");
      const deaths = parseRequiredNonNegativeInt(deathsRaw, "Deaths");
      const assists = parseRequiredNonNegativeInt(assistsRaw, "Assists");

      entries.push({
        playerId,
        teamId: match.homeTeam.id,
        kills,
        deaths,
        assists,
        isMVP,
      });
    }

    for (let i = 0; i < 5; i++) {
      const playerId = String(formData.get(`away_player_${i}`) || "").trim();
      const killsRaw = String(formData.get(`away_k_${i}`) || "").trim();
      const deathsRaw = String(formData.get(`away_d_${i}`) || "").trim();
      const assistsRaw = String(formData.get(`away_a_${i}`) || "").trim();
      const isMVP = formData.get(`away_mvp_${i}`) === "on";

      const hasAnyValue =
        playerId !== "" ||
        killsRaw !== "" ||
        deathsRaw !== "" ||
        assistsRaw !== "" ||
        isMVP;

      if (!hasAnyValue) continue;

      if (!playerId) {
        redirect(
          buildRedirectUrl(matchId, {
            error: `game_${gameNumber}_away_missing_player`,
          })
        );
      }

      if (!awayTeamPlayerIds.has(playerId)) {
        redirect(
          buildRedirectUrl(matchId, {
            error: `game_${gameNumber}_away_invalid_player`,
          })
        );
      }

      const kills = parseRequiredNonNegativeInt(killsRaw, "Kills");
      const deaths = parseRequiredNonNegativeInt(deathsRaw, "Deaths");
      const assists = parseRequiredNonNegativeInt(assistsRaw, "Assists");

      entries.push({
        playerId,
        teamId: match.awayTeam.id,
        kills,
        deaths,
        assists,
        isMVP,
      });
    }

    if (entries.length !== 10) {
      redirect(
        buildRedirectUrl(matchId, {
          error: `game_${gameNumber}_need_10_players`,
        })
      );
    }

    const uniquePlayerIds = new Set(entries.map((entry) => entry.playerId));
    if (uniquePlayerIds.size !== entries.length) {
      redirect(
        buildRedirectUrl(matchId, {
          error: `game_${gameNumber}_duplicate_players`,
        })
      );
    }

    const mvpCount = entries.filter((entry) => entry.isMVP).length;
    if (mvpCount > 1) {
      redirect(
        buildRedirectUrl(matchId, {
          error: `game_${gameNumber}_multiple_mvps`,
        })
      );
    }

    const existingStats = await prisma.matchGamePlayerStat.findMany({
      where: {
        matchGameId: game.id,
        playerId: {
          in: entries.map((entry) => entry.playerId),
        },
      },
    });

    if (existingStats.length > 0) {
      redirect(
        buildRedirectUrl(matchId, {
          error: `game_${gameNumber}_stats_already_exist`,
        })
      );
    }

    const players = await prisma.player.findMany({
      where: {
        id: {
          in: entries.map((entry) => entry.playerId),
        },
      },
    });

    const playerMap = new Map(players.map((player) => [player.id, player]));

    await prisma.$transaction(async (tx) => {
      let selectedMvpName: string | null = null;

      for (const entry of entries) {
        const player = playerMap.get(entry.playerId);

        if (!player) {
          throw new Error(`Player not found for stat submission: ${entry.playerId}`);
        }

        const isWin = entry.teamId === game.winnerTeamId;

        const { lpChange } = calculateLpChange({
          win: isWin,
          kills: entry.kills,
          deaths: entry.deaths,
          assists: entry.assists,
          isMVP: entry.isMVP,
          winStreak: player.winStreak,
          lossStreak: player.lossStreak,
        });

        const newElo = player.elo + lpChange;

        let newWinStreak = player.winStreak;
        let newLossStreak = player.lossStreak;

        if (isWin) {
          newWinStreak += 1;
          newLossStreak = 0;
        } else {
          newLossStreak += 1;
          newWinStreak = 0;
        }

        await tx.matchGamePlayerStat.create({
          data: {
            matchGameId: game.id,
            playerId: player.id,
            teamId: entry.teamId,
            kills: entry.kills,
            deaths: entry.deaths,
            assists: entry.assists,
            isMVP: entry.isMVP,
            isWin,
            lpChange,
            eloBefore: player.elo,
            eloAfter: newElo,
          },
        });

        await tx.player.update({
          where: { id: player.id },
          data: {
            elo: newElo,
            winStreak: newWinStreak,
            lossStreak: newLossStreak,
          },
        });

        playerMap.set(player.id, {
          ...player,
          elo: newElo,
          winStreak: newWinStreak,
          lossStreak: newLossStreak,
        });

        if (entry.isMVP) {
          selectedMvpName = player.riotName
            ? `${player.riotName}#${player.riotTag}`
            : player.name;
        }
      }

      if (selectedMvpName) {
        await tx.matchGame.update({
          where: { id: game.id },
          data: {
            mvpName: selectedMvpName,
          },
        });
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/matches");
    revalidatePath(`/admin/matches/${matchId}`);
    revalidatePath("/schedule");
    revalidatePath("/results");
    revalidatePath("/standings");
    revalidatePath("/stats");
    revalidatePath("/stats/leaderboard");
    revalidatePath(`/matches/${matchId}`);

    redirect(
      buildRedirectUrl(matchId, {
        statsSaved: "1",
        game: String(gameNumber),
      })
    );
  } catch (error) {
    console.error("submitGameStats error:", error);

    const matchId = String(formData.get("matchId") || "").trim();
    if (matchId) {
      redirect(buildRedirectUrl(matchId, { error: "stats_submit_failed" }));
    }

    redirect("/admin/matches?error=stats_submit_failed");
  }
}

async function deleteMatch(formData: FormData) {
  "use server";

  try {
    const id = String(formData.get("id") || "").trim();

    if (!id) {
      redirect("/admin/matches?error=missing_match_id");
    }

    await prisma.match.delete({
      where: { id },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/matches");
    revalidatePath("/schedule");
    revalidatePath("/results");
    revalidatePath("/standings");
    revalidatePath(`/matches/${id}`);

    redirect("/admin/matches?deleted=1");
  } catch (error) {
    console.error("deleteMatch error:", error);

    const id = String(formData.get("id") || "").trim();
    if (id) {
      redirect(buildRedirectUrl(id, { error: "delete_failed" }));
    }

    redirect("/admin/matches?error=delete_failed");
  }
}

function getFriendlyMessage(error: string | undefined) {
  if (!error) return null;

  const messages: Record<string, string> = {
    invalid_stage: "Invalid stage selected.",
    invalid_status: "Invalid status selected.",
    invalid_best_of: "Best of must be 1, 2, 3, or 5.",
    invalid_scores: "Scores must be valid non-negative numbers.",
    invalid_match_winner: "Winner must be one of the two teams in the match.",
    update_failed: "Failed to save match changes.",
    delete_failed: "Failed to delete match.",
    missing_stats_ids: "Missing match or game information for stats submission.",
    invalid_game_number: "Invalid game number.",
    match_not_found: "Match not found.",
    stats_submit_failed: "Failed to submit player stats.",
  };

  if (messages[error]) return messages[error];

  if (error.includes("_winner_not_set")) {
    return "Set the winner for that individual game before submitting player stats.";
  }

  if (error.includes("_stats_already_exist")) {
    return "Player stats for that game already exist. Duplicate submission was blocked.";
  }

  if (error.includes("_need_10_players")) {
    return "You must enter all 10 players before saving game stats.";
  }

  if (error.includes("_duplicate_players")) {
    return "The same player was selected more than once in this game.";
  }

  if (error.includes("_multiple_mvps")) {
    return "Only one MVP can be selected per game.";
  }

  if (error.includes("_home_missing_player") || error.includes("_away_missing_player")) {
    return "One of the stat rows has KDA entered but no player selected.";
  }

  if (error.includes("_home_invalid_player") || error.includes("_away_invalid_player")) {
    return "A selected player does not belong to the correct team.";
  }

  if (error.includes("_not_found")) {
    return "The requested match or game could not be found.";
  }

  if (error.includes("_invalid_winner")) {
    return "One of the selected game winners is invalid.";
  }

  if (error.includes("_invalid_duration")) {
    return "One of the game durations is invalid.";
  }

  if (error.includes("_invalid_numbers")) {
    return "One of the game stat fields contains an invalid number.";
  }

  return "Something went wrong.";
}

export default async function EditMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    updated?: string;
    statsSaved?: string;
    game?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: {
        include: {
          players: {
            orderBy: {
              riotName: "asc",
            },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            orderBy: {
              riotName: "asc",
            },
          },
        },
      },
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
      id: existingGame?.id ?? "",
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
      hasSavedGame: !!existingGame,
      hasWinnerSet: !!existingGame?.winnerTeamId,
    };
  });

  const successUpdated = resolvedSearchParams.updated === "1";
  const successStatsSaved = resolvedSearchParams.statsSaved === "1";
  const savedGameNumber = resolvedSearchParams.game;
  const errorMessage = getFriendlyMessage(resolvedSearchParams.error);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
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

        {successUpdated && (
          <div className="mb-6 rounded-2xl border border-green-400/25 bg-green-500/10 px-5 py-4 text-sm text-green-200">
            Match changes saved successfully.
          </div>
        )}

        {successStatsSaved && (
          <div className="mb-6 rounded-2xl border border-green-400/25 bg-green-500/10 px-5 py-4 text-sm text-green-200">
            Player stats saved successfully
            {savedGameNumber ? ` for Game ${savedGameNumber}` : ""}.
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

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

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Player Stats Entry
            </p>
            <h2 className="mt-2 text-2xl font-bold">Submit Player Stats Per Game</h2>
            <p className="mt-2 text-sm text-white/60">
              Save all 10 players for an individual game. Make sure that game winner is set first in the match editor above.
            </p>
          </div>

          <div className="grid gap-6">
            {gameSlots.map((game) => (
              <div
                key={`stats-${game.gameNumber}`}
                className="rounded-2xl border border-white/10 bg-black/40 p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-[0.08em] text-green-400">
                      Game {game.gameNumber}
                    </h3>
                    <p className="mt-1 text-sm text-white/50">
                      {game.hasSavedGame
                        ? game.hasWinnerSet
                          ? "Ready for player stat submission."
                          : "Set the individual game winner above before saving player stats."
                        : "This game has not been created yet in the match editor above."}
                    </p>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    {game.hasWinnerSet ? "Winner Set" : "Winner Missing"}
                  </div>
                </div>

                <form action={submitGameStats} className="space-y-6">
                  <input type="hidden" name="matchId" value={match.id} />
                  <input type="hidden" name="gameNumber" value={game.gameNumber} />

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-green-400/15 bg-green-500/5 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-lg font-bold text-green-400">
                          {match.homeTeam.name}
                        </h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                          Home Team
                        </span>
                      </div>

                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-1 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                        <div>Player</div>
                        <div>K</div>
                        <div>D</div>
                        <div>A</div>
                        <div className="text-center">MVP</div>
                      </div>

                      <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const defaultPlayer = match.homeTeam.players[i];

                          return (
                            <div
                              key={`home-row-${game.gameNumber}-${i}`}
                              className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2"
                            >
                              <select
                                name={`home_player_${i}`}
                                defaultValue={defaultPlayer?.id || ""}
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              >
                                <option value="">Select Player</option>
                                {match.homeTeam.players.map((player) => (
                                  <option key={player.id} value={player.id}>
                                    {player.riotName}#{player.riotTag}
                                  </option>
                                ))}
                              </select>

                              <input
                                name={`home_k_${i}`}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              />

                              <input
                                name={`home_d_${i}`}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              />

                              <input
                                name={`home_a_${i}`}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              />

                              <label className="flex items-center justify-center rounded-xl border border-white/10 bg-black px-3 py-2">
                                <input
                                  name={`home_mvp_${i}`}
                                  type="checkbox"
                                  className="h-4 w-4"
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-400/15 bg-blue-500/5 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-lg font-bold text-blue-300">
                          {match.awayTeam.name}
                        </h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                          Away Team
                        </span>
                      </div>

                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-1 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                        <div>Player</div>
                        <div>K</div>
                        <div>D</div>
                        <div>A</div>
                        <div className="text-center">MVP</div>
                      </div>

                      <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const defaultPlayer = match.awayTeam.players[i];

                          return (
                            <div
                              key={`away-row-${game.gameNumber}-${i}`}
                              className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2"
                            >
                              <select
                                name={`away_player_${i}`}
                                defaultValue={defaultPlayer?.id || ""}
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              >
                                <option value="">Select Player</option>
                                {match.awayTeam.players.map((player) => (
                                  <option key={player.id} value={player.id}>
                                    {player.riotName}#{player.riotTag}
                                  </option>
                                ))}
                              </select>

                              <input
                                name={`away_k_${i}`}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              />

                              <input
                                name={`away_d_${i}`}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              />

                              <input
                                name={`away_a_${i}`}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
                              />

                              <label className="flex items-center justify-center rounded-xl border border-white/10 bg-black px-3 py-2">
                                <input
                                  name={`away_mvp_${i}`}
                                  type="checkbox"
                                  className="h-4 w-4"
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={!game.hasSavedGame || !game.hasWinnerSet}
                      className="rounded-xl bg-green-400 px-6 py-3 font-bold uppercase tracking-wide text-black transition hover:scale-[1.02] hover:bg-green-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:hover:scale-100"
                    >
                      Save Player Stats for Game {game.gameNumber}
                    </button>

                    <p className="text-xs text-white/45">
                      One submission saves all 10 players and updates ELO/streaks.
                    </p>
                  </div>
                </form>
              </div>
            ))}
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