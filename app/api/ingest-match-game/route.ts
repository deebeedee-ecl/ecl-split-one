import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLpChange } from "@/lib/elo";

type ParsedPlayer = {
  name?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  gold?: number;
  damage?: number;
  isMVP?: boolean;
  isSVP?: boolean;
};

type ParsedTeamStats = {
  kills?: number;
  gold?: number;
  towers?: number;
  inhibitors?: number;
  barons?: number;
  drakes?: number;
  isWinner?: boolean;
};

type RosterPlayer = {
  id: string;
  riotName: string | null;
  riotTag: string | null;
  teamId: string | null;
  elo: number;
  winStreak: number;
  lossStreak: number;
};

function normalizeRiotNameParts(rawName: string) {
  const trimmed = rawName.trim();
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex === -1) return { riotName: trimmed, riotTag: "" };
  return {
    riotName: trimmed.slice(0, hashIndex).trim(),
    riotTag: trimmed.slice(hashIndex + 1).trim(),
  };
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// ---------------------------------------------------------------------------
// Levenshtein edit distance — used for fuzzy name matching only.
// We keep this cheap: strings are short (player names, ~5–20 chars).
// ---------------------------------------------------------------------------
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr.push(
        Math.min(
          prev[j + 1] + 1,
          curr[j] + 1,
          prev[j] + (a[i] !== b[j] ? 1 : 0)
        )
      );
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
// Fuzzy player lookup.
//
// Strategy (in order):
//   1. Exact riotName + riotTag match (case-insensitive).
//   2. Exact tag + fuzzy name — edit distance ≤ MAX_NAME_DISTANCE.
//      Catches: Fembov→Femboy, xVanp→xVamp, MANBA0UT→MANBAOUT, etc.
//
// Returns the best-matching RosterPlayer or null.
// ---------------------------------------------------------------------------
const MAX_NAME_DISTANCE = 2;

function fuzzyFindPlayer(
  rawName: string,
  rosterPlayers: RosterPlayer[]
): RosterPlayer | null {
  if (!rawName.includes("#")) return null;

  const { riotName: ocrName, riotTag: ocrTag } =
    normalizeRiotNameParts(rawName);
  const ocrNameLower = ocrName.toLowerCase();
  const ocrTagLower = ocrTag.toLowerCase();

  // 1. Exact match
  for (const p of rosterPlayers) {
    if (
      p.riotName?.toLowerCase() === ocrNameLower &&
      p.riotTag?.toLowerCase() === ocrTagLower
    ) {
      return p;
    }
  }

  // 2. Exact tag + fuzzy name
  let bestPlayer: RosterPlayer | null = null;
  let bestDist = MAX_NAME_DISTANCE + 1;

  for (const p of rosterPlayers) {
    if (p.riotTag?.toLowerCase() !== ocrTagLower) continue;
    const dist = editDistance(ocrNameLower, p.riotName?.toLowerCase() ?? "");
    if (dist <= MAX_NAME_DISTANCE && dist < bestDist) {
      bestDist = dist;
      bestPlayer = p;
    }
  }

  return bestPlayer;
}

// ---------------------------------------------------------------------------
// Score how many OCR players fuzzy-match a given roster.
// Used to map top/bottom screenshot sides to home/away teams.
// ---------------------------------------------------------------------------
function scoreSideAgainstRoster(
  players: ParsedPlayer[],
  rosterPlayers: RosterPlayer[]
): number {
  let score = 0;
  for (const p of players) {
    const rawName = typeof p?.name === "string" ? p.name.trim() : "";
    if (!rawName.includes("#")) continue;
    if (fuzzyFindPlayer(rawName, rosterPlayers)) score++;
  }
  return score;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      matchId,
      gameNumber,
      topTeam,
      bottomTeam,
      winningPlayers,
      losingPlayers,
      durationMinutes,
    } = body;

    if (!matchId || gameNumber === undefined) {
      return NextResponse.json(
        { error: "Missing matchId or gameNumber" },
        { status: 400 }
      );
    }

    if (!topTeam || !bottomTeam) {
      return NextResponse.json(
        { error: "Missing topTeam or bottomTeam" },
        { status: 400 }
      );
    }

    if (!Array.isArray(winningPlayers) || !Array.isArray(losingPlayers)) {
      return NextResponse.json(
        { error: "winningPlayers and losingPlayers must be arrays" },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { include: { players: true } },
        awayTeam: { include: { players: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;
    const matchBestOf = match.bestOf;
    const currentHomeScore = match.homeScore;
    const currentAwayScore = match.awayScore;
    const currentStatus = match.status;
    const currentWinnerTeamId = match.winnerTeamId;

    const homePlayers: RosterPlayer[] = (match.homeTeam?.players ?? []).filter(
      (p) => p.riotName && p.riotTag
    ) as RosterPlayer[];

    const awayPlayers: RosterPlayer[] = (match.awayTeam?.players ?? []).filter(
      (p) => p.riotName && p.riotTag
    ) as RosterPlayer[];

    const existingGame = await prisma.matchGame.findUnique({
      where: { matchId_gameNumber: { matchId, gameNumber } },
      select: { id: true, winnerTeamId: true },
    });

    const isNewGame = !existingGame;

    // Map top/bottom screenshot sides to home/away using fuzzy scoring
    const topSidePlayers: ParsedPlayer[] = topTeam?.isWinner
      ? winningPlayers
      : losingPlayers;
    const bottomSidePlayers: ParsedPlayer[] = topTeam?.isWinner
      ? losingPlayers
      : winningPlayers;

    const topVsHomeScore = scoreSideAgainstRoster(topSidePlayers, homePlayers);
    const topVsAwayScore = scoreSideAgainstRoster(topSidePlayers, awayPlayers);
    const bottomVsHomeScore = scoreSideAgainstRoster(
      bottomSidePlayers,
      homePlayers
    );
    const bottomVsAwayScore = scoreSideAgainstRoster(
      bottomSidePlayers,
      awayPlayers
    );

    console.log("🔍 Side scores:", {
      topVsHomeScore,
      topVsAwayScore,
      bottomVsHomeScore,
      bottomVsAwayScore,
    });

    let topTeamId: string | null = null;
    let bottomTeamId: string | null = null;

    if (
      topVsHomeScore > topVsAwayScore &&
      bottomVsAwayScore >= bottomVsHomeScore
    ) {
      topTeamId = homeTeamId;
      bottomTeamId = awayTeamId;
    } else if (
      topVsAwayScore > topVsHomeScore &&
      bottomVsHomeScore >= bottomVsAwayScore
    ) {
      topTeamId = awayTeamId;
      bottomTeamId = homeTeamId;
    } else {
      // Fallback: pick whichever side has a higher total match score
      const homeTotal = topVsHomeScore + bottomVsHomeScore;
      const awayTotal = topVsAwayScore + bottomVsAwayScore;

      console.warn("⚠️ Ambiguous side mapping — using fallback scoring", {
        homeTotal,
        awayTotal,
      });

      if (homeTotal > 0 || awayTotal > 0) {
        // Assign by whichever side scored more home players on top
        topTeamId = topVsHomeScore >= topVsAwayScore ? homeTeamId : awayTeamId;
        bottomTeamId = topTeamId === homeTeamId ? awayTeamId : homeTeamId;
      } else {
        return NextResponse.json(
          {
            error: "Could not map screenshot sides to scheduled teams",
            debug: {
              topVsHomeScore,
              topVsAwayScore,
              bottomVsHomeScore,
              bottomVsAwayScore,
              homePlayers: homePlayers.map(
                (p) => `${p.riotName}#${p.riotTag}`
              ),
              awayPlayers: awayPlayers.map(
                (p) => `${p.riotName}#${p.riotTag}`
              ),
              receivedTopSide: topSidePlayers.map((p) => p.name),
              receivedBottomSide: bottomSidePlayers.map((p) => p.name),
            },
          },
          { status: 400 }
        );
      }
    }

    const homeIsTop = topTeamId === homeTeamId;
    const homeTeamStats: ParsedTeamStats = homeIsTop ? topTeam : bottomTeam;
    const awayTeamStats: ParsedTeamStats = homeIsTop ? bottomTeam : topTeam;
    const winnerTeamId = topTeam.isWinner ? topTeamId : bottomTeamId;
    const loserTeamId =
      winnerTeamId === homeTeamId ? awayTeamId : homeTeamId;

    if (!winnerTeamId || !loserTeamId) {
      return NextResponse.json(
        { error: "Failed to determine winner/loser team IDs" },
        { status: 400 }
      );
    }

    const allPlayers: ParsedPlayer[] = [
      ...(Array.isArray(winningPlayers) ? winningPlayers : []),
      ...(Array.isArray(losingPlayers) ? losingPlayers : []),
    ];

    const mvpPlayer = allPlayers.find((p) => p?.isMVP);
    const mvpName = mvpPlayer?.name ?? null;

    const safeDurationMinutes =
      typeof durationMinutes === "number" &&
      Number.isFinite(durationMinutes) &&
      durationMinutes >= 0
        ? Math.floor(durationMinutes)
        : null;

    const durationSeconds =
      safeDurationMinutes !== null ? safeDurationMinutes * 60 : null;

    const game = await prisma.matchGame.upsert({
      where: { matchId_gameNumber: { matchId, gameNumber } },
      update: {
        winnerTeamId,
        durationSeconds,
        homeKills: safeNumber(homeTeamStats.kills),
        awayKills: safeNumber(awayTeamStats.kills),
        homeGold: safeNumber(homeTeamStats.gold),
        awayGold: safeNumber(awayTeamStats.gold),
        homeTowers: safeNumber(homeTeamStats.towers),
        awayTowers: safeNumber(awayTeamStats.towers),
        homeInhibitors: safeNumber(homeTeamStats.inhibitors),
        awayInhibitors: safeNumber(awayTeamStats.inhibitors),
        homeBarons: safeNumber(homeTeamStats.barons),
        awayBarons: safeNumber(awayTeamStats.barons),
        homeDrakes: safeNumber(homeTeamStats.drakes),
        awayDrakes: safeNumber(awayTeamStats.drakes),
        mvpName,
        ocrRawJson: body,
      },
      create: {
        matchId,
        gameNumber,
        winnerTeamId,
        durationSeconds,
        homeKills: safeNumber(homeTeamStats.kills),
        awayKills: safeNumber(awayTeamStats.kills),
        homeGold: safeNumber(homeTeamStats.gold),
        awayGold: safeNumber(awayTeamStats.gold),
        homeTowers: safeNumber(homeTeamStats.towers),
        awayTowers: safeNumber(awayTeamStats.towers),
        homeInhibitors: safeNumber(homeTeamStats.inhibitors),
        awayInhibitors: safeNumber(awayTeamStats.inhibitors),
        homeBarons: safeNumber(homeTeamStats.barons),
        awayBarons: safeNumber(awayTeamStats.barons),
        homeDrakes: safeNumber(homeTeamStats.drakes),
        awayDrakes: safeNumber(awayTeamStats.drakes),
        mvpName,
        ocrRawJson: body,
      },
    });

    let matched = 0;
    let skipped = 0;
    const allRosterPlayers = [...homePlayers, ...awayPlayers];

    async function processPlayer(p: ParsedPlayer) {
      const rawName = typeof p.name === "string" ? p.name.trim() : "";

      // Use the same fuzzy lookup so Fembov→Femboy works here too
      const player = fuzzyFindPlayer(rawName, allRosterPlayers);

      if (!player) {
        console.log("⚠️ Not in roster (fuzzy):", rawName);
        skipped++;
        return;
      }

      if (player.teamId !== homeTeamId && player.teamId !== awayTeamId) {
        console.log("⚠️ Not in this match:", rawName);
        skipped++;
        return;
      }

      const teamId = player.teamId!;
      const isWin = teamId === winnerTeamId;
      matched++;

      const existingStat = await prisma.matchGamePlayerStat.findUnique({
        where: {
          matchGameId_playerId: { matchGameId: game.id, playerId: player.id },
        },
        select: { id: true },
      });

      const isNewStat = !existingStat;
      let lpChange = 0;
      let eloBefore = player.elo;
      let eloAfter = player.elo;

      if (isNewStat) {
        const eloResult = calculateLpChange({
          win: isWin,
          kills: safeNumber(p.kills),
          deaths: safeNumber(p.deaths),
          assists: safeNumber(p.assists),
          isMVP: Boolean(p.isMVP),
          isSVP: Boolean(p.isSVP),
          gold: safeNumber(p.gold),
          damage: safeNumber(p.damage),
          winStreak: player.winStreak,
          lossStreak: player.lossStreak,
        });
        lpChange = eloResult.lpChange;
        eloAfter = player.elo + lpChange;
      }

      const { riotName, riotTag } = normalizeRiotNameParts(rawName);

      await prisma.matchGamePlayerStat.upsert({
        where: {
          matchGameId_playerId: { matchGameId: game.id, playerId: player.id },
        },
        update: {
          teamId,
          riotName: player.riotName!,
          riotTag: player.riotTag!,
          kills: safeNumber(p.kills),
          deaths: safeNumber(p.deaths),
          assists: safeNumber(p.assists),
          gold: safeNumber(p.gold),
          damage: safeNumber(p.damage),
          isWin,
          isMVP: Boolean(p.isMVP),
          isSVP: Boolean(p.isSVP),
          lpChange,
          eloBefore,
          eloAfter,
        },
        create: {
          matchGameId: game.id,
          playerId: player.id,
          teamId,
          riotName: player.riotName!,
          riotTag: player.riotTag!,
          kills: safeNumber(p.kills),
          deaths: safeNumber(p.deaths),
          assists: safeNumber(p.assists),
          gold: safeNumber(p.gold),
          damage: safeNumber(p.damage),
          isWin,
          isMVP: Boolean(p.isMVP),
          isSVP: Boolean(p.isSVP),
          lpChange,
          eloBefore,
          eloAfter,
        },
      });

      if (isNewStat) {
        await prisma.player.update({
          where: { id: player.id },
          data: {
            elo: eloAfter,
            winStreak: isWin ? player.winStreak + 1 : 0,
            lossStreak: isWin ? 0 : player.lossStreak + 1,
          },
        });
      }
    }

    for (const p of allPlayers) {
      await processPlayer(p);
    }

    console.log(`✅ Matched: ${matched}, ❌ Skipped: ${skipped}`);

    let homeScore = currentHomeScore;
    let awayScore = currentAwayScore;

    if (isNewGame) {
      homeScore =
        winnerTeamId === homeTeamId
          ? currentHomeScore + 1
          : currentHomeScore;
      awayScore =
        winnerTeamId === awayTeamId
          ? currentAwayScore + 1
          : currentAwayScore;
    }

    let status = currentStatus;
    let finalWinner = currentWinnerTeamId;

    if (matchBestOf === 2) {
      const totalGamesPlayed = homeScore + awayScore;
      if (totalGamesPlayed >= 2) {
        status = "COMPLETED";
        if (homeScore > awayScore) finalWinner = homeTeamId;
        else if (awayScore > homeScore) finalWinner = awayTeamId;
        else finalWinner = null;
      } else {
        status = "SCHEDULED";
        finalWinner = null;
      }
    } else {
      const winsNeeded = Math.ceil(matchBestOf / 2);
      if (homeScore >= winsNeeded) {
        status = "COMPLETED";
        finalWinner = homeTeamId;
      } else if (awayScore >= winsNeeded) {
        status = "COMPLETED";
        finalWinner = awayTeamId;
      }
    }

    await prisma.match.update({
      where: { id: matchId },
      data: { homeScore, awayScore, status, winnerTeamId: finalWinner },
    });

    return NextResponse.json({
      success: true,
      gameId: game.id,
      isNewGame,
      matchedPlayers: matched,
      skippedPlayers: skipped,
      debug: {
        topTeamId,
        bottomTeamId,
        winnerTeamId,
        homeScore,
        awayScore,
      },
    });
  } catch (err) {
    console.error("INGEST ERROR:", err);
    return NextResponse.json(
      { error: "Failed to ingest match game" },
      { status: 500 }
    );
  }
}