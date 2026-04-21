import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calculateLpChange } from "@/lib/elo";
import { MatchStage, MatchStatus, Prisma } from "@prisma/client";

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

type RouteParams = Promise<{ id: string }>;
type RouteSearchParams = Promise<{
  updated?: string;
  statsSaved?: string;
  game?: string;
  error?: string;
}>;

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

function parseOptionalNonNegativeInt(value: string) {
  const trimmed = value.trim();

  if (trimmed === "") return null;

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return "__INVALID__" as const;
  }

  return Math.round(parsed);
}

function getPlayerDisplayName(player: {
  name: string;
  riotName: string | null;
  riotTag: string | null;
}) {
  if (player.riotName && player.riotTag) {
    return `${player.name} (${player.riotName}#${player.riotTag})`;
  }

  if (player.riotTag) {
    return `${player.name}#${player.riotTag}`;
  }

  return player.name;
}

type TxClient = Prisma.TransactionClient;

async function recalculateAllPlayerStats(tx: TxClient) {
  await tx.player.updateMany({
    data: {
      elo: 1000,
      winStreak: 0,
      lossStreak: 0,
    },
  });

  const players = await tx.player.findMany({
    select: {
      id: true,
      elo: true,
      winStreak: true,
      lossStreak: true,
    },
  });

  const playerState = new Map(
    players.map((player) => [
      player.id,
      {
        elo: 1000,
        winStreak: 0,
        lossStreak: 0,
      },
    ])
  );

  const allStats = await tx.matchGamePlayerStat.findMany({
    include: {
      matchGame: {
        include: {
          match: {
            select: {
              scheduledAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  allStats.sort((a, b) => {
    const aTime =
      a.matchGame.match.scheduledAt?.getTime() ??
      a.matchGame.match.createdAt.getTime();
    const bTime =
      b.matchGame.match.scheduledAt?.getTime() ??
      b.matchGame.match.createdAt.getTime();

    if (aTime !== bTime) return aTime - bTime;
    if (a.matchGame.gameNumber !== b.matchGame.gameNumber) {
      return a.matchGame.gameNumber - b.matchGame.gameNumber;
    }

    return a.id.localeCompare(b.id);
  });

  for (const stat of allStats) {
    const current = playerState.get(stat.playerId) ?? {
      elo: 1000,
      winStreak: 0,
      lossStreak: 0,
    };

    const { lpChange } = calculateLpChange({
      win: stat.isWin,
      kills: stat.kills,
      deaths: stat.deaths,
      assists: stat.assists,
      isMVP: stat.isMVP,
      isSVP: stat.isSVP,
      gold: stat.gold ?? 0,
      damage: stat.damage ?? 0,
      winStreak: current.winStreak,
      lossStreak: current.lossStreak,
    });

    const eloBefore = current.elo;
    const eloAfter = eloBefore + lpChange;

    const nextState = stat.isWin
      ? {
          elo: eloAfter,
          winStreak: current.winStreak + 1,
          lossStreak: 0,
        }
      : {
          elo: eloAfter,
          winStreak: 0,
          lossStreak: current.lossStreak + 1,
        };

    await tx.matchGamePlayerStat.update({
      where: { id: stat.id },
      data: {
        lpChange,
        eloBefore,
        eloAfter,
      },
    });

    await tx.player.update({
      where: { id: stat.playerId },
      data: {
        elo: nextState.elo,
        winStreak: nextState.winStreak,
        lossStreak: nextState.lossStreak,
      },
    });

    playerState.set(stat.playerId, nextState);
  }
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

    const winnerTeamId: string | null = winnerTeamIdRaw || null;

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
      homeTowers: number | null;
      awayTowers: number | null;
      homeInhibitors: number | null;
      awayInhibitors: number | null;
      homeBarons: number | null;
      awayBarons: number | null;
      homeDrakes: number | null;
      awayDrakes: number | null;
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

      const gameHomeTowersRaw = String(
        formData.get(`game_${gameNumber}_homeTowers`) || ""
      ).trim();

      const gameAwayTowersRaw = String(
        formData.get(`game_${gameNumber}_awayTowers`) || ""
      ).trim();

      const gameHomeInhibitorsRaw = String(
        formData.get(`game_${gameNumber}_homeInhibitors`) || ""
      ).trim();

      const gameAwayInhibitorsRaw = String(
        formData.get(`game_${gameNumber}_awayInhibitors`) || ""
      ).trim();

      const gameHomeBaronsRaw = String(
        formData.get(`game_${gameNumber}_homeBarons`) || ""
      ).trim();

      const gameAwayBaronsRaw = String(
        formData.get(`game_${gameNumber}_awayBarons`) || ""
      ).trim();

      const gameHomeDrakesRaw = String(
        formData.get(`game_${gameNumber}_homeDrakes`) || ""
      ).trim();

      const gameAwayDrakesRaw = String(
        formData.get(`game_${gameNumber}_awayDrakes`) || ""
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

      const homeKills = parseOptionalNonNegativeInt(gameHomeKillsRaw);
      const awayKills = parseOptionalNonNegativeInt(gameAwayKillsRaw);
      const homeGold = parseOptionalNonNegativeInt(gameHomeGoldRaw);
      const awayGold = parseOptionalNonNegativeInt(gameAwayGoldRaw);
      const homeTowers = parseOptionalNonNegativeInt(gameHomeTowersRaw);
      const awayTowers = parseOptionalNonNegativeInt(gameAwayTowersRaw);
      const homeInhibitors = parseOptionalNonNegativeInt(gameHomeInhibitorsRaw);
      const awayInhibitors = parseOptionalNonNegativeInt(gameAwayInhibitorsRaw);
      const homeBarons = parseOptionalNonNegativeInt(gameHomeBaronsRaw);
      const awayBarons = parseOptionalNonNegativeInt(gameAwayBaronsRaw);
      const homeDrakes = parseOptionalNonNegativeInt(gameHomeDrakesRaw);
      const awayDrakes = parseOptionalNonNegativeInt(gameAwayDrakesRaw);

      if (
        homeKills === "__INVALID__" ||
        awayKills === "__INVALID__" ||
        homeGold === "__INVALID__" ||
        awayGold === "__INVALID__" ||
        homeTowers === "__INVALID__" ||
        awayTowers === "__INVALID__" ||
        homeInhibitors === "__INVALID__" ||
        awayInhibitors === "__INVALID__" ||
        homeBarons === "__INVALID__" ||
        awayBarons === "__INVALID__" ||
        homeDrakes === "__INVALID__" ||
        awayDrakes === "__INVALID__"
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
        homeTowers === null &&
        awayTowers === null &&
        homeInhibitors === null &&
        awayInhibitors === null &&
        homeBarons === null &&
        awayBarons === null &&
        homeDrakes === null &&
        awayDrakes === null &&
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
        homeTowers: homeTowers as number | null,
        awayTowers: awayTowers as number | null,
        homeInhibitors: homeInhibitors as number | null,
        awayInhibitors: awayInhibitors as number | null,
        homeBarons: homeBarons as number | null,
        awayBarons: awayBarons as number | null,
        homeDrakes: homeDrakes as number | null,
        awayDrakes: awayDrakes as number | null,
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
              homeTowers: game.homeTowers,
              awayTowers: game.awayTowers,
              homeInhibitors: game.homeInhibitors,
              awayInhibitors: game.awayInhibitors,
              homeBarons: game.homeBarons,
              awayBarons: game.awayBarons,
              homeDrakes: game.homeDrakes,
              awayDrakes: game.awayDrakes,
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
              homeTowers: game.homeTowers,
              awayTowers: game.awayTowers,
              homeInhibitors: game.homeInhibitors,
              awayInhibitors: game.awayInhibitors,
              homeBarons: game.homeBarons,
              awayBarons: game.awayBarons,
              homeDrakes: game.homeDrakes,
              awayDrakes: game.awayDrakes,
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

async function saveGamePlayerRows(formData: FormData) {
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
                name: "asc",
              },
            },
          },
        },
        awayTeam: {
          include: {
            players: {
              orderBy: {
                name: "asc",
              },
            },
          },
        },
        games: {
          include: {
            playerStats: true,
          },
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

    const selectedMvpPlayerId = String(formData.get("selectedMvpPlayerId") || "").trim();
    const selectedSvpPlayerId = String(formData.get("selectedSvpPlayerId") || "").trim();

    const homeTeamPlayerIds = new Set(match.homeTeam.players.map((p) => p.id));
    const awayTeamPlayerIds = new Set(match.awayTeam.players.map((p) => p.id));
    const allValidPlayerIds = new Set([
      ...match.homeTeam.players.map((p) => p.id),
      ...match.awayTeam.players.map((p) => p.id),
    ]);

    if (selectedMvpPlayerId && !allValidPlayerIds.has(selectedMvpPlayerId)) {
      redirect(buildRedirectUrl(matchId, { error: `game_${gameNumber}_invalid_mvp` }));
    }

    if (selectedSvpPlayerId && !allValidPlayerIds.has(selectedSvpPlayerId)) {
      redirect(buildRedirectUrl(matchId, { error: `game_${gameNumber}_invalid_svp` }));
    }

    if (
      selectedMvpPlayerId &&
      selectedSvpPlayerId &&
      selectedMvpPlayerId === selectedSvpPlayerId
    ) {
      redirect(buildRedirectUrl(matchId, { error: `game_${gameNumber}_mvp_svp_same` }));
    }

    const entries: Array<{
      playerId: string;
      teamId: string;
      kills: number;
      deaths: number;
      assists: number;
      gold: number | null;
      damage: number | null;
      isMVP: boolean;
      isSVP: boolean;
    }> = [];

    for (let i = 0; i < 5; i++) {
      const playerId = String(formData.get(`home_player_${i}`) || "").trim();
      const killsRaw = String(formData.get(`home_k_${i}`) || "").trim();
      const deathsRaw = String(formData.get(`home_d_${i}`) || "").trim();
      const assistsRaw = String(formData.get(`home_a_${i}`) || "").trim();
      const goldRaw = String(formData.get(`home_gold_${i}`) || "").trim();
      const damageRaw = String(formData.get(`home_damage_${i}`) || "").trim();

      const hasAnyValue =
        killsRaw !== "" ||
        deathsRaw !== "" ||
        assistsRaw !== "" ||
        goldRaw !== "" ||
        damageRaw !== "";

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
      const gold = parseOptionalNonNegativeInt(goldRaw);
      const damage = parseOptionalNonNegativeInt(damageRaw);

      if (gold === "__INVALID__" || damage === "__INVALID__") {
        redirect(
          buildRedirectUrl(matchId, {
            error: `game_${gameNumber}_invalid_numbers`,
          })
        );
      }

      entries.push({
        playerId,
        teamId: match.homeTeam.id,
        kills,
        deaths,
        assists,
        gold: gold as number | null,
        damage: damage as number | null,
        isMVP: playerId === selectedMvpPlayerId,
        isSVP: playerId === selectedSvpPlayerId,
      });
    }

    for (let i = 0; i < 5; i++) {
      const playerId = String(formData.get(`away_player_${i}`) || "").trim();
      const killsRaw = String(formData.get(`away_k_${i}`) || "").trim();
      const deathsRaw = String(formData.get(`away_d_${i}`) || "").trim();
      const assistsRaw = String(formData.get(`away_a_${i}`) || "").trim();
      const goldRaw = String(formData.get(`away_gold_${i}`) || "").trim();
      const damageRaw = String(formData.get(`away_damage_${i}`) || "").trim();

      const hasAnyValue =
        killsRaw !== "" ||
        deathsRaw !== "" ||
        assistsRaw !== "" ||
        goldRaw !== "" ||
        damageRaw !== "";

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
      const gold = parseOptionalNonNegativeInt(goldRaw);
      const damage = parseOptionalNonNegativeInt(damageRaw);

      if (gold === "__INVALID__" || damage === "__INVALID__") {
        redirect(
          buildRedirectUrl(matchId, {
            error: `game_${gameNumber}_invalid_numbers`,
          })
        );
      }

      entries.push({
        playerId,
        teamId: match.awayTeam.id,
        kills,
        deaths,
        assists,
        gold: gold as number | null,
        damage: damage as number | null,
        isMVP: playerId === selectedMvpPlayerId,
        isSVP: playerId === selectedSvpPlayerId,
      });
    }

    if (entries.length === 0) {
      redirect(
        buildRedirectUrl(matchId, {
          error: `game_${gameNumber}_no_player_rows`,
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

    if (selectedMvpPlayerId && !uniquePlayerIds.has(selectedMvpPlayerId)) {
      redirect(buildRedirectUrl(matchId, { error: `game_${gameNumber}_mvp_not_in_rows` }));
    }

    if (selectedSvpPlayerId && !uniquePlayerIds.has(selectedSvpPlayerId)) {
      redirect(buildRedirectUrl(matchId, { error: `game_${gameNumber}_svp_not_in_rows` }));
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
          throw new Error(`Player not found for stat save: ${entry.playerId}`);
        }

        const isWin = entry.teamId === game.winnerTeamId;

        await tx.matchGamePlayerStat.upsert({
          where: {
            matchGameId_playerId: {
              matchGameId: game.id,
              playerId: entry.playerId,
            },
          },
          update: {
            teamId: entry.teamId,
            riotName: player.riotName,
            riotTag: player.riotTag,
            kills: entry.kills,
            deaths: entry.deaths,
            assists: entry.assists,
            gold: entry.gold,
            damage: entry.damage,
            isMVP: entry.isMVP,
            isSVP: entry.isSVP,
            isWin,
          },
          create: {
            matchGameId: game.id,
            playerId: entry.playerId,
            teamId: entry.teamId,
            riotName: player.riotName,
            riotTag: player.riotTag,
            kills: entry.kills,
            deaths: entry.deaths,
            assists: entry.assists,
            gold: entry.gold,
            damage: entry.damage,
            isMVP: entry.isMVP,
            isSVP: entry.isSVP,
            isWin,
            lpChange: 0,
            eloBefore: player.elo,
            eloAfter: player.elo,
          },
        });

        if (entry.isMVP) {
          selectedMvpName =
            player.riotName && player.riotTag
              ? `${player.riotName}#${player.riotTag}`
              : player.name;
        }
      }

      await tx.matchGame.update({
        where: { id: game.id },
        data: {
          mvpName: selectedMvpName,
        },
      });

      await recalculateAllPlayerStats(tx);
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
    console.error("saveGamePlayerRows error:", error);

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
    missing_stats_ids: "Missing match or game information for player row save.",
    invalid_game_number: "Invalid game number.",
    match_not_found: "Match not found.",
    stats_submit_failed: "Failed to save player rows.",
    game_1_no_player_rows: "Enter at least one player row before saving.",
    game_2_no_player_rows: "Enter at least one player row before saving.",
    game_3_no_player_rows: "Enter at least one player row before saving.",
    game_4_no_player_rows: "Enter at least one player row before saving.",
    game_5_no_player_rows: "Enter at least one player row before saving.",
  };

  if (messages[error]) return messages[error];

  if (error.includes("_winner_not_set")) {
    return "Set the winner for that game before saving player rows.";
  }

  if (error.includes("_duplicate_players")) {
    return "The same player was selected more than once in that game.";
  }

  if (error.includes("_multiple_mvps")) {
    return "Only one MVP can be selected per game.";
  }

  if (error.includes("_multiple_svps")) {
    return "Only one SVP can be selected per game.";
  }

  if (error.includes("_invalid_mvp")) {
    return "The selected MVP player is invalid.";
  }

  if (error.includes("_invalid_svp")) {
    return "The selected SVP player is invalid.";
  }

  if (error.includes("_mvp_svp_same")) {
    return "MVP and SVP cannot be the same player.";
  }

  if (error.includes("_mvp_not_in_rows")) {
    return "The selected MVP player is not included in the saved rows.";
  }

  if (error.includes("_svp_not_in_rows")) {
    return "The selected SVP player is not included in the saved rows.";
  }

  if (
    error.includes("_home_missing_player") ||
    error.includes("_away_missing_player")
  ) {
    return "One row has stats entered but no player selected.";
  }

  if (
    error.includes("_home_invalid_player") ||
    error.includes("_away_invalid_player")
  ) {
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
    return "One of the fields contains an invalid number.";
  }

  return "Something went wrong.";
}

function buildPlayerRowDefaults(
  teamPlayers: Array<{
    id: string;
    name: string;
    riotName: string | null;
    riotTag: string | null;
  }>,
  playerStats: Array<{
    playerId: string;
    kills: number;
    deaths: number;
    assists: number;
    gold: number | null;
    damage: number | null;
  }>
) {
  return Array.from({ length: 5 }).map((_, index) => {
    const defaultPlayer = teamPlayers[index];
    const stat = defaultPlayer
      ? playerStats.find((item) => item.playerId === defaultPlayer.id)
      : null;

    return {
      playerId: defaultPlayer?.id ?? "",
      kills: stat?.kills?.toString() ?? "",
      deaths: stat?.deaths?.toString() ?? "",
      assists: stat?.assists?.toString() ?? "",
      gold: stat?.gold?.toString() ?? "",
      damage: stat?.damage?.toString() ?? "",
    };
  });
}

export default async function EditMatchPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearchParams;
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
              name: "asc",
            },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            orderBy: {
              name: "asc",
            },
          },
        },
      },
      winnerTeam: true,
      games: {
        include: {
          playerStats: true,
        },
        orderBy: {
          gameNumber: "asc",
        },
      },
    },
  });

  if (!match) {
    notFound();
  }

  const combinedRoster = [...match.homeTeam.players, ...match.awayTeam.players];

  const gameSlots = Array.from({ length: match.bestOf }, (_, index) => {
    const gameNumber = index + 1;
    const existingGame = match.games.find((game) => game.gameNumber === gameNumber);

    const homePlayerStats = existingGame
      ? existingGame.playerStats.filter((stat) => stat.teamId === match.homeTeam.id)
      : [];

    const awayPlayerStats = existingGame
      ? existingGame.playerStats.filter((stat) => stat.teamId === match.awayTeam.id)
      : [];

    const selectedMvpPlayerId =
      existingGame?.playerStats.find((stat) => stat.isMVP)?.playerId ?? "";

    const selectedSvpPlayerId =
      existingGame?.playerStats.find((stat) => stat.isSVP)?.playerId ?? "";

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
      homeTowers: existingGame?.homeTowers?.toString() ?? "",
      awayTowers: existingGame?.awayTowers?.toString() ?? "",
      homeInhibitors: existingGame?.homeInhibitors?.toString() ?? "",
      awayInhibitors: existingGame?.awayInhibitors?.toString() ?? "",
      homeBarons: existingGame?.homeBarons?.toString() ?? "",
      awayBarons: existingGame?.awayBarons?.toString() ?? "",
      homeDrakes: existingGame?.homeDrakes?.toString() ?? "",
      awayDrakes: existingGame?.awayDrakes?.toString() ?? "",
      mvpName: existingGame?.mvpName ?? "",
      notes: existingGame?.notes ?? "",
      hasSavedGame: !!existingGame,
      hasWinnerSet: !!existingGame?.winnerTeamId,
      selectedMvpPlayerId,
      selectedSvpPlayerId,
      homeRows: buildPlayerRowDefaults(match.homeTeam.players, homePlayerStats),
      awayRows: buildPlayerRowDefaults(match.awayTeam.players, awayPlayerStats),
      rosterOptions: combinedRoster.map((player) => ({
        id: player.id,
        label: getPlayerDisplayName(player),
      })),
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
            Edit the series, patch game objective stats, and overwrite individual player rows without doing a full 10-man resubmission.
          </p>
        </div>

        {successUpdated && (
          <div className="mb-6 rounded-2xl border border-green-400/25 bg-green-500/10 px-5 py-4 text-sm text-green-200">
            Match and game details saved successfully.
          </div>
        )}

        {successStatsSaved && (
          <div className="mb-6 rounded-2xl border border-green-400/25 bg-green-500/10 px-5 py-4 text-sm text-green-200">
            Player rows saved successfully
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
          <h2 className="text-2xl font-bold">Edit Match & Games</h2>
          <p className="mt-2 text-sm text-white/65">
            Home and away stay in the database for structure, but this admin page is meant to be edited using the actual team names and per-game winners.
          </p>

          <form action={updateMatch} className="mt-6 space-y-8">
            <input type="hidden" name="id" value={match.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Team A
                </label>
                <input
                  value={match.homeTeam.name}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white/70 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Team B
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
                  {match.homeTeam.name} Series Score
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
                  {match.awayTeam.name} Series Score
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
                  Series Winner / Draw
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
                <h3 className="text-2xl font-bold">Per-Game Editor</h3>
                <p className="mt-2 text-sm text-white/60">
                  This is the manual fallback for OCR misses. Patch team stats and objective counts directly here.
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

                      <div className="rounded-2xl border border-green-400/15 bg-green-500/5 p-4">
                        <div className="mb-3 text-sm font-bold text-green-400">
                          {match.homeTeam.name}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            label="Kills"
                            name={`game_${game.gameNumber}_homeKills`}
                            defaultValue={game.homeKills}
                          />
                          <Field
                            label="Gold"
                            name={`game_${game.gameNumber}_homeGold`}
                            defaultValue={game.homeGold}
                          />
                          <Field
                            label="Towers"
                            name={`game_${game.gameNumber}_homeTowers`}
                            defaultValue={game.homeTowers}
                          />
                          <Field
                            label="Inhibitors"
                            name={`game_${game.gameNumber}_homeInhibitors`}
                            defaultValue={game.homeInhibitors}
                          />
                          <Field
                            label="Barons"
                            name={`game_${game.gameNumber}_homeBarons`}
                            defaultValue={game.homeBarons}
                          />
                          <Field
                            label="Drakes"
                            name={`game_${game.gameNumber}_homeDrakes`}
                            defaultValue={game.homeDrakes}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-blue-400/15 bg-blue-500/5 p-4">
                        <div className="mb-3 text-sm font-bold text-blue-300">
                          {match.awayTeam.name}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            label="Kills"
                            name={`game_${game.gameNumber}_awayKills`}
                            defaultValue={game.awayKills}
                          />
                          <Field
                            label="Gold"
                            name={`game_${game.gameNumber}_awayGold`}
                            defaultValue={game.awayGold}
                          />
                          <Field
                            label="Towers"
                            name={`game_${game.gameNumber}_awayTowers`}
                            defaultValue={game.awayTowers}
                          />
                          <Field
                            label="Inhibitors"
                            name={`game_${game.gameNumber}_awayInhibitors`}
                            defaultValue={game.awayInhibitors}
                          />
                          <Field
                            label="Barons"
                            name={`game_${game.gameNumber}_awayBarons`}
                            defaultValue={game.awayBarons}
                          />
                          <Field
                            label="Drakes"
                            name={`game_${game.gameNumber}_awayDrakes`}
                            defaultValue={game.awayDrakes}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          MVP Display Name
                        </label>
                        <input
                          name={`game_${game.gameNumber}_mvpName`}
                          type="text"
                          defaultValue={game.mvpName}
                          placeholder="e.g. JeanCultamaire#32640"
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
                Save Match & Game Changes
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
              Player Row Editor
            </p>
            <h2 className="mt-2 text-2xl font-bold">Patch / Overwrite Player Rows</h2>
            <p className="mt-2 text-sm text-white/60">
              Save one row, five rows, or all ten. MVP and SVP are selected once per game below, then Prisma and ELO are recalculated cleanly.
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
                          ? "Winner is set. Patch any player row below."
                          : "Set the winner above before saving player rows."
                        : "Create this game in the editor above first."}
                    </p>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    {game.hasWinnerSet ? "Ready" : "Winner Missing"}
                  </div>
                </div>

                <form action={saveGamePlayerRows} className="space-y-6">
                  <input type="hidden" name="matchId" value={match.id} />
                  <input type="hidden" name="gameNumber" value={game.gameNumber} />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                        MVP Player
                      </label>
                      <select
                        name="selectedMvpPlayerId"
                        defaultValue={game.selectedMvpPlayerId}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-green-400/50"
                      >
                        <option value="">No MVP selected</option>
                        {game.rosterOptions.map((player) => (
                          <option key={`mvp-${player.id}`} value={player.id}>
                            {player.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                        SVP Player
                      </label>
                      <select
                        name="selectedSvpPlayerId"
                        defaultValue={game.selectedSvpPlayerId}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-green-400/50"
                      >
                        <option value="">No SVP selected</option>
                        {game.rosterOptions.map((player) => (
                          <option key={`svp-${player.id}`} value={player.id}>
                            {player.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <PlayerRowTable
                      title={match.homeTeam.name}
                      accent="green"
                      teamLabel="Team A"
                      rows={game.homeRows}
                      players={match.homeTeam.players}
                      side="home"
                    />

                    <PlayerRowTable
                      title={match.awayTeam.name}
                      accent="blue"
                      teamLabel="Team B"
                      rows={game.awayRows}
                      players={match.awayTeam.players}
                      side="away"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={!game.hasSavedGame || !game.hasWinnerSet}
                      className="rounded-xl bg-green-400 px-6 py-3 font-bold uppercase tracking-wide text-black transition hover:scale-[1.02] hover:bg-green-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:hover:scale-100"
                    >
                      Save Player Rows for Game {game.gameNumber}
                    </button>

                    <p className="text-xs text-white/45">
                      Existing rows are overwritten. Missing rows can be added without resetting the whole game.
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

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </label>
      <input
        name={name}
        type="number"
        min="0"
        defaultValue={defaultValue}
        placeholder="0"
        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
      />
    </div>
  );
}

function PlayerRowTable({
  title,
  accent,
  teamLabel,
  rows,
  players,
  side,
}: {
  title: string;
  accent: "green" | "blue";
  teamLabel: string;
  rows: Array<{
    playerId: string;
    kills: string;
    deaths: string;
    assists: string;
    gold: string;
    damage: string;
  }>;
  players: Array<{
    id: string;
    name: string;
    riotName: string | null;
    riotTag: string | null;
  }>;
  side: "home" | "away";
}) {
  const accentClasses =
    accent === "green"
      ? {
          wrap: "border-green-400/15 bg-green-500/5",
          title: "text-green-400",
        }
      : {
          wrap: "border-blue-400/15 bg-blue-500/5",
          title: "text-blue-300",
        };

  return (
    <div className={`rounded-2xl border p-4 ${accentClasses.wrap}`}>
      <div className="mb-4 flex items-center justify-between">
        <h4 className={`text-lg font-bold ${accentClasses.title}`}>{title}</h4>
        <span className="text-xs uppercase tracking-[0.2em] text-white/40">
          {teamLabel}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-[minmax(220px,2fr)_60px_60px_60px_90px_90px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        <div>Player</div>
        <div>K</div>
        <div>D</div>
        <div>A</div>
        <div>Gold</div>
        <div>Dmg</div>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={`${side}-row-${i}`}
            className="grid grid-cols-[minmax(220px,2fr)_60px_60px_60px_90px_90px] gap-2"
          >
            <select
              name={`${side}_player_${i}`}
              defaultValue={row.playerId}
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
            >
              <option value="">Select Player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {getPlayerDisplayName(player)}
                </option>
              ))}
            </select>

            <input
              name={`${side}_k_${i}`}
              type="number"
              min="0"
              defaultValue={row.kills}
              placeholder="0"
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
            />

            <input
              name={`${side}_d_${i}`}
              type="number"
              min="0"
              defaultValue={row.deaths}
              placeholder="0"
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
            />

            <input
              name={`${side}_a_${i}`}
              type="number"
              min="0"
              defaultValue={row.assists}
              placeholder="0"
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
            />

            <input
              name={`${side}_gold_${i}`}
              type="number"
              min="0"
              defaultValue={row.gold}
              placeholder="0"
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
            />

            <input
              name={`${side}_damage_${i}`}
              type="number"
              min="0"
              defaultValue={row.damage}
              placeholder="0"
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-green-400/50"
            />
          </div>
        ))}
      </div>
    </div>
  );
}