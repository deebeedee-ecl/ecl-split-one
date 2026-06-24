import { calculateLpChange } from "../lib/elo";
import { INHOUSE_MATCH_FILTER } from "../lib/inhouse-filter";
import { syncPlayerForProfile } from "../lib/player-profile-sync";
import { prisma } from "../lib/prisma";
import { riotIdKey, splitRiotId } from "../lib/riot-id";

type DetailPlayer = {
  nickNameStr?: string;
  nickName?: string;
  scoreInfo?: string;
  win?: string;
  wasMvp?: string;
  wasSvp?: string;
  goldEarned?: number;
  totalDamageDealt?: number;
  echartsMap?: {
    goldEarned?: number;
    totalDamageDealt?: number;
  };
};

function parseScoreInfo(value: string | undefined) {
  const match = value?.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  return match
    ? { kills: Number(match[1]), deaths: Number(match[2]), assists: Number(match[3]) }
    : { kills: 0, deaths: 0, assists: 0 };
}

function isWin(player: DetailPlayer) {
  return ["1", "true", "win"].includes((player.win ?? "").trim().toLowerCase());
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const profiles = await prisma.accountProfile.findMany({
    where: { verificationStatus: "VERIFIED", accountStatus: "ACTIVE" },
    select: {
      displayName: true,
      email: true,
      riotName: true,
      riotTag: true,
    },
  });

  if (apply) {
    for (const profile of profiles) {
      await syncPlayerForProfile(profile);
    }
  }

  const sessions = await prisma.inhouseSession.findMany({
    where: {
      status: "COMPLETED",
      matchGameId: { not: null },
    },
    include: {
      players: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let totalMatched = 0;
  let totalCreated = 0;

  for (const session of sessions) {
    const game = await prisma.matchGame.findUnique({
      where: { id: session.matchGameId! },
      select: {
        id: true,
        matchId: true,
        ocrRawJson: true,
        playerStats: { select: { playerId: true } },
      },
    });
    if (!game) continue;

    const raw = game.ocrRawJson as {
      detail?: { data?: { wgBattleDetailInfo?: DetailPlayer[] } };
    } | null;
    const detailPlayers = raw?.detail?.data?.wgBattleDetailInfo ?? [];
    const detailByKey = new Map<string, DetailPlayer>();

    for (const detailPlayer of detailPlayers) {
      const parts = splitRiotId(detailPlayer.nickNameStr ?? detailPlayer.nickName);
      const key = riotIdKey(parts.riotName, parts.riotTag);
      if (key) detailByKey.set(key, detailPlayer);
    }

    const matched = session.players.flatMap((sessionPlayer) => {
      const key = riotIdKey(sessionPlayer.riotName, sessionPlayer.riotTag);
      const detailPlayer = key ? detailByKey.get(key) : null;
      return detailPlayer ? [{ sessionPlayer, detailPlayer }] : [];
    });
    totalMatched += matched.length;

    const blueWins = matched.filter(
      ({ sessionPlayer, detailPlayer }) => sessionPlayer.side === "BLUE" && isWin(detailPlayer),
    ).length;
    const redWins = matched.filter(
      ({ sessionPlayer, detailPlayer }) => sessionPlayer.side === "RED" && isWin(detailPlayer),
    ).length;
    const blueWon = blueWins >= redWins;
    const winnerTeamId = blueWon ? session.blueTeamId : session.redTeamId;

    console.log(
      `${session.gameLabel ?? session.id}: matched ${matched.length}/10, ` +
        `${blueWon ? "BLUE" : "RED"} won, ${game.playerStats.length} existing stats`,
    );

    if (!apply || !winnerTeamId) continue;

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: game.matchId },
        data: {
          winnerTeamId,
          homeScore: blueWon ? 1 : 0,
          awayScore: blueWon ? 0 : 1,
        },
      });
      await tx.matchGame.update({
        where: { id: game.id },
        data: { winnerTeamId },
      });
    });

    for (const { sessionPlayer, detailPlayer } of matched) {
      const player = await syncPlayerForProfile({
        displayName: sessionPlayer.displayName,
        email: sessionPlayer.email,
        riotName: sessionPlayer.riotName,
        riotTag: sessionPlayer.riotTag,
      });
      const existingStat = await prisma.matchGamePlayerStat.findUnique({
        where: {
          matchGameId_playerId: {
            matchGameId: game.id,
            playerId: player.id,
          },
        },
      });

      if (existingStat) {
        await prisma.inhouseSessionPlayer.update({
          where: { id: sessionPlayer.id },
          data: { playerId: player.id },
        });
        continue;
      }

      const [current, gamesPlayed] = await Promise.all([
        prisma.player.findUniqueOrThrow({ where: { id: player.id } }),
        prisma.matchGamePlayerStat.count({
          where: {
            playerId: player.id,
            ...INHOUSE_MATCH_FILTER,
          },
        }),
      ]);
      const score = parseScoreInfo(detailPlayer.scoreInfo);
      const playerWon = sessionPlayer.side === (blueWon ? "BLUE" : "RED");
      const lpChange = calculateLpChange({
        win: playerWon,
        ...score,
        isMVP: detailPlayer.wasMvp === "1",
        isSVP: detailPlayer.wasSvp === "1",
        currentElo: current.elo,
        gamesPlayed,
        winStreak: current.winStreak,
        lossStreak: current.lossStreak,
      }).lpChange;
      const eloAfter = current.elo + lpChange;

      await prisma.$transaction([
        prisma.matchGamePlayerStat.create({
          data: {
            matchGameId: game.id,
            playerId: player.id,
            teamId: sessionPlayer.side === "BLUE" ? session.blueTeamId : session.redTeamId,
            riotName: current.riotName,
            riotTag: current.riotTag,
            ...score,
            gold: safeNumber(detailPlayer.goldEarned ?? detailPlayer.echartsMap?.goldEarned),
            damage: safeNumber(
              detailPlayer.totalDamageDealt ?? detailPlayer.echartsMap?.totalDamageDealt,
            ),
            isWin: playerWon,
            isMVP: detailPlayer.wasMvp === "1",
            isSVP: detailPlayer.wasSvp === "1",
            lpChange,
            eloBefore: current.elo,
            eloAfter,
            createdAt: session.createdAt,
          },
        }),
        prisma.player.update({
          where: { id: player.id },
          data: {
            elo: eloAfter,
            winStreak: playerWon ? current.winStreak + 1 : 0,
            lossStreak: playerWon ? 0 : current.lossStreak + 1,
          },
        }),
        prisma.inhouseSessionPlayer.update({
          where: { id: sessionPlayer.id },
          data: { playerId: player.id },
        }),
      ]);
      totalCreated += 1;
    }
  }

  console.log(
    apply
      ? `Repair complete: ${totalCreated} stat rows created from ${totalMatched} matched players.`
      : `Dry run: ${totalMatched} players can be matched. Re-run with --apply to repair.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
