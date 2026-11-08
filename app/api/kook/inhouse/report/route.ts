import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { calculateLpChange, chinaDayBounds } from "@/lib/elo";
import { getRankedSeason, loadRankedSeasonStates, currentRankedFilter } from "@/lib/ranked-season";
import {
  fetchLatestLzyumiMatch,
  fetchLzyumiMatchDetail,
  getChinaServer,
  type LzyumiDetailResponse,
  type LzyumiLookupResponse,
  type LzyumiPlayerDetail,
  type LzyumiRecentMatch,
} from "@/lib/lzyumi";
import { isLzyumiGameAlreadyReported } from "@/lib/lzyumi-report-dedupe";
import { acquireRankedInhouseReportLock } from "@/lib/inhouse-report-lock";
import { syncPlayerForProfile } from "@/lib/player-profile-sync";
import { prisma } from "@/lib/prisma";
import {
  normalizeRiotPart,
  normalizeRiotTag,
  riotIdKey,
  riotNameKey,
  splitRiotId,
} from "@/lib/riot-id";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ACTIVE_SESSION_HOURS = 48;
const REQUIRED_MATCHED_PLAYERS = Number(process.env.INHOUSE_REPORT_REQUIRED_MATCHES || 8);
const REPORT_GAME_EARLY_GRACE_MS = Number(process.env.INHOUSE_REPORT_EARLY_GRACE_MINUTES || 10) * 60 * 1000;
const REPORT_GAME_LATE_WINDOW_MS = Number(process.env.INHOUSE_REPORT_LATE_WINDOW_HOURS || 6) * 60 * 60 * 1000;

type RawMatchData = {
  profile: LzyumiLookupResponse;
  gameId: string;
  game?: LzyumiRecentMatch;
  detail: LzyumiDetailResponse;
};

type ReportBody = {
  command?: string;
  action?: string;
  kookUserId?: string;
  reporterKookUserId?: string;
  sessionId?: string;
  rawMatchData?: RawMatchData;
  adminOverride?: boolean;
};

type SessionPlayer = Awaited<ReturnType<typeof findActiveSessionForReporter>>["players"][number];

class ReportedGameConflictError extends Error {}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseReportGameTime(game: Pick<LzyumiRecentMatch, "title" | "titleTime">, sessionCreatedAt: Date) {
  const raw = `${game.titleTime || ""} ${game.title || ""}`;
  const match = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const referenceChina = new Date(sessionCreatedAt.getTime() + 8 * 60 * 60 * 1000);
  const candidate = new Date(Date.UTC(
    referenceChina.getUTCFullYear(),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[3]) - 8,
    Number(match[4]),
    Number(match[5] || 0),
  ));

  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function reportGameTimeIssue(game: Pick<LzyumiRecentMatch, "title" | "titleTime">, sessionCreatedAt: Date) {
  const gameTime = parseReportGameTime(game, sessionCreatedAt);
  if (!gameTime) return "";

  const delta = gameTime.getTime() - sessionCreatedAt.getTime();

  if (delta < -REPORT_GAME_EARLY_GRACE_MS) {
    return `That ECL.GG game started ${Math.round(Math.abs(delta) / 60000)} minutes before this inhouse was created.`;
  }

  if (delta > REPORT_GAME_LATE_WINDOW_MS) {
    return `That ECL.GG game started ${Math.round(delta / 60000)} minutes after this inhouse was created.`;
  }

  return "";
}

function playerRiotKeys(player: LzyumiPlayerDetail) {
  return [player.nickNameStr, player.nickName]
    .map(splitRiotId)
    .map((parts) => riotIdKey(parts.riotName, parts.riotTag))
    .filter((value): value is string => Boolean(value));
}

function playerRiotNameKeys(player: LzyumiPlayerDetail) {
  return [player.nickNameStr, player.nickName]
    .map(splitRiotId)
    .map((parts) => riotNameKey(parts.riotName))
    .filter((value): value is string => Boolean(value));
}

function parseScoreInfo(value: unknown) {
  if (typeof value !== "string") return { kills: 0, deaths: 0, assists: 0 };

  const match = value.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  if (!match) return { kills: 0, deaths: 0, assists: 0 };

  return {
    kills: Number(match[1]),
    deaths: Number(match[2]),
    assists: Number(match[3]),
  };
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function isPlayerWin(player: LzyumiPlayerDetail) {
  return ["1", "true", "win"].includes(clean(player.win).toLowerCase());
}

function unauthorized(request: Request) {
  const expectedSecrets = [
    process.env.ECL_KOOK_BOT_SECRET,
    process.env.ECL_REPORT_ENGINE_SECRET,
    process.env.ECL_JOB_SECRET,
  ].map(clean).filter(Boolean);
  const suppliedSecret =
    request.headers.get("x-ecl-kook-secret") ??
    request.headers.get("x-ecl-report-engine-secret") ??
    request.headers.get("x-ecl-job-secret");
  return expectedSecrets.length === 0 || !expectedSecrets.includes(clean(suppliedSecret));
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function findActiveSessionForReporter(kookUserId: string, sessionId?: string, adminOverride = false) {
  const activeSince = new Date(Date.now() - ACTIVE_SESSION_HOURS * 60 * 60 * 1000);

  if (sessionId) {
    // Specific session requested. Admin override skips time limit and player membership check.
    const session = await prisma.inhouseSession.findFirst({
      where: {
        id: sessionId,
        status: "ASSIGNED",
        ...(adminOverride ? {} : { createdAt: { gte: activeSince } }),
        ...(adminOverride ? {} : { players: { some: { kookUserId } } }),
      },
      include: { players: true },
    });
    if (!session) throw new Error("That inhouse session was not found or has already been reported.");
    return session;
  }

  const session = await prisma.inhouseSession.findFirst({
    where: {
      status: "ASSIGNED",
      createdAt: {
        gte: activeSince,
      },
      players: {
        some: {
          kookUserId,
        },
      },
    },
    include: {
      players: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!session) {
    throw new Error("No active inhouse session found for this KOOK user.");
  }

  return session;
}

async function findReporterProfile(reporter: SessionPlayer) {
  if (!reporter.profileId) return null;

  return prisma.accountProfile.findUnique({
    where: {
      id: reporter.profileId,
    },
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      chinaServerName: true,
    },
  });
}

async function findOrCreatePlayer(
  sessionPlayer: SessionPlayer,
  database: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const riotName = normalizeRiotPart(sessionPlayer.riotName);
  const riotTag = normalizeRiotTag(sessionPlayer.riotTag);
  const email = clean(sessionPlayer.email);

  const existingById = sessionPlayer.playerId
    ? await database.player.findUnique({
        where: {
          id: sessionPlayer.playerId,
        },
      })
    : null;

  if (existingById) return existingById;

  const player = await syncPlayerForProfile(
    {
      displayName: sessionPlayer.displayName,
      riotName,
      riotTag,
      email,
    },
    database,
  );

  return database.player.findUniqueOrThrow({
    where: { id: player.id },
  });
}

function teamName(sessionId: string, side: "BLUE" | "RED") {
  return `Ranked IH ${sessionId.slice(0, 8)} ${side}`;
}

export async function POST(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ReportBody;
  const reporterKookUserId = clean(body.reporterKookUserId || body.kookUserId);
  const adminOverride = body.adminOverride === true;
  const requestedSessionId = clean(body.sessionId);

  if (!reporterKookUserId && !adminOverride) {
    return NextResponse.json(
      { message: "Reporter KOOK user ID is required." },
      { status: 400 },
    );
  }

  if (requestedSessionId) {
    const completedSession = await prisma.inhouseSession.findFirst({
      where: {
        id: requestedSessionId,
        status: "COMPLETED",
        ...(adminOverride ? {} : { players: { some: { kookUserId: reporterKookUserId } } }),
      },
      select: {
        id: true,
        gameLabel: true,
        matchId: true,
        matchGameId: true,
        lzyumiGameId: true,
      },
    });

    if (completedSession) {
      return NextResponse.json({
        ok: true,
        status: "ALREADY_REPORTED",
        reply: `${completedSession.gameLabel ?? "This inhouse"} has already been reported.`,
        sessionId: completedSession.id,
        matchId: completedSession.matchId,
        matchGameId: completedSession.matchGameId,
        lzyumiGameId: completedSession.lzyumiGameId,
      });
    }
  }

  let session: Awaited<ReturnType<typeof findActiveSessionForReporter>>;

  try {
    session = await findActiveSessionForReporter(
      reporterKookUserId || "ADMIN",
      requestedSessionId || undefined,
      adminOverride,
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "NO_ACTIVE_SESSION",
        reply: error instanceof Error ? error.message : "No active inhouse session found.",
      },
      { status: 404 },
    );
  }

  // For admin override, skip the reporter-in-session and reporter-profile checks.
  const reporter = adminOverride
    ? null
    : session.players.find((player) => player.kookUserId === reporterKookUserId);

  if (!adminOverride && !reporter) {
    return NextResponse.json(
      { status: "REPORTER_NOT_IN_SESSION", reply: "Reporter was not part of this inhouse." },
      { status: 404 },
    );
  }

  const reporterProfile = reporter ? await findReporterProfile(reporter) : null;

  if (!adminOverride && !reporterProfile) {
    return NextResponse.json(
      {
        status: "REPORTER_PROFILE_NOT_FOUND",
        reply: "Reporter does not have a linked ECL profile.",
      },
      { status: 404 },
    );
  }

  const server = getChinaServer(reporterProfile?.chinaServerId);

  let recentMatch: LzyumiRecentMatch;
  let matchDetail: LzyumiDetailResponse;

  if (body.rawMatchData?.profile && body.rawMatchData?.gameId && body.rawMatchData?.detail) {
    // Bot pre-fetched lzyumi data from residential IP — use it directly.
    const { profile, gameId, game, detail } = body.rawMatchData;
    const openId = profile.battleInfo?.openId;

    if (!openId) {
      return NextResponse.json(
        {
          status: "NO_LATEST_MATCH",
          reply: "Pre-fetched ECL.GG data is missing the player openId.",
        },
        { status: 404 },
      );
    }

    // Fetch detail if not provided or incomplete
    const detailPlayers = detail.data?.wgBattleDetailInfo;
    if (!detailPlayers || detailPlayers.length === 0) {
      const freshDetail = await fetchLzyumiMatchDetail({
        openId,
        gameId,
        areaId: server.id,
      });
      matchDetail = freshDetail;
    } else {
      matchDetail = detail;
    }

    recentMatch = game ?? { gameId };
  } else {
    // Fall back to server-side fetch (works if not IP-blocked).
    if (!reporterProfile) {
      return NextResponse.json(
        { status: "NO_RAW_MATCH_DATA", reply: "Admin reports must include rawMatchData." },
        { status: 400 },
      );
    }
    const latest = await fetchLatestLzyumiMatch({
      riotName: reporterProfile.riotName,
      areaId: server.id,
    });

    if (latest.status !== "found" || !latest.recentMatch?.gameId || !latest.detail) {
      return NextResponse.json(
        {
          status: "NO_LATEST_MATCH",
          reply: "I could not find a recent ECL.GG match for the reporter. If the bot supports it, ensure it passes match data directly.",
        },
        { status: 404 },
      );
    }

    recentMatch = latest.recentMatch;
    matchDetail = latest.detail;
  }

  const timeIssue = reportGameTimeIssue(recentMatch, session.createdAt);
  if (timeIssue) {
    return NextResponse.json(
      {
        status: "MATCH_TIME_MISMATCH",
        reply: `${timeIssue} I did not ingest it because it is probably a different inhouse game.`,
      },
      { status: 409 },
    );
  }

  const alreadyReported = await prisma.inhouseSession.findUnique({
    where: {
      lzyumiGameId: recentMatch.gameId,
    },
    select: {
      id: true,
      status: true,
    },
  });
  const storedDuplicate = await isLzyumiGameAlreadyReported(recentMatch.gameId, session.id);

  if ((alreadyReported && alreadyReported.id !== session.id) || storedDuplicate) {
    return NextResponse.json(
      {
        status: "ALREADY_REPORTED",
        reply: "That ECL.GG game has already been reported to ECL.",
        sessionId: alreadyReported?.id,
      },
      { status: 409 },
    );
  }

  const detailPlayers = matchDetail.data?.wgBattleDetailInfo ?? [];
  const detailByRiotKey = new Map<string, LzyumiPlayerDetail>();
  const detailByNameKey = new Map<string, LzyumiPlayerDetail | null>();

  for (const player of detailPlayers) {
    for (const key of playerRiotKeys(player)) {
      detailByRiotKey.set(key, player);
    }
    for (const key of playerRiotNameKeys(player)) {
      detailByNameKey.set(key, detailByNameKey.has(key) ? null : player);
    }
  }

  // Enrich session players with AccountProfile riotName/riotTag when InhouseSessionPlayer fields are empty.
  // Try by profileId first, fall back to kookUserId → AccountProfile.kookId.
  const missingProfileIds = session.players
    .filter((p) => (!p.riotName || !p.riotTag) && p.profileId)
    .map((p) => p.profileId as string);

  const missingKookIds = session.players
    .filter((p) => (!p.riotName || !p.riotTag) && !p.profileId)
    .map((p) => p.kookUserId);

  const [enrichProfiles, enrichByKook] = await Promise.all([
    missingProfileIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { id: { in: missingProfileIds } },
          select: { id: true, riotName: true, riotTag: true },
        })
      : Promise.resolve([]),
    missingKookIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { kookId: { in: missingKookIds } },
          select: { kookId: true, riotName: true, riotTag: true },
        })
      : Promise.resolve([]),
  ]);

  const enrichMap = new Map(enrichProfiles.map((p) => [p.id, p]));
  const kookEnrichMap = new Map(enrichByKook.map((p) => [p.kookId!, p]));

  const enrichedSessionPlayers = session.players.map((p) => {
    const prof = (p.profileId ? enrichMap.get(p.profileId) : null) ?? kookEnrichMap.get(p.kookUserId) ?? null;
    return {
      ...p,
      riotName: p.riotName || prof?.riotName || null,
      riotTag: normalizeRiotTag(p.riotTag || prof?.riotTag) || null,
    };
  });

  const matchedRows = enrichedSessionPlayers
    .map((sessionPlayer) => {
      const key = riotIdKey(sessionPlayer.riotName, sessionPlayer.riotTag);
      const nameKey = riotNameKey(sessionPlayer.riotName);
      const hasTag = Boolean(normalizeRiotTag(sessionPlayer.riotTag));
      const detailPlayer =
        (key ? detailByRiotKey.get(key) : undefined) ??
        (!hasTag && nameKey ? detailByNameKey.get(nameKey) ?? undefined : undefined);
      return detailPlayer ? { sessionPlayer, detailPlayer } : null;
    })
    .filter(
      (value): value is { sessionPlayer: SessionPlayer; detailPlayer: LzyumiPlayerDetail } =>
        Boolean(value),
    );

  const reporterMatched = adminOverride || matchedRows.some(
    (row) => row.sessionPlayer.kookUserId === reporterKookUserId,
  );

  if (adminOverride ? matchedRows.length < 1 : (matchedRows.length < REQUIRED_MATCHED_PLAYERS || !reporterMatched)) {
    const matchedIds = new Set(matchedRows.map((row) => row.sessionPlayer.id));
    const missingPlayers = enrichedSessionPlayers
      .filter((player) => !matchedIds.has(player.id))
      .map((player) => player.displayName);

    return NextResponse.json(
      {
        status: "MATCH_NOT_CONFIRMED",
        reply: `The latest ECL.GG game only matched ${matchedRows.length}/10 inhouse players. I did not ingest it. Missing: ${
          missingPlayers.length > 0 ? missingPlayers.join(", ") : "unknown"
        }.`,
        matchedPlayers: matchedRows.map((row) => row.sessionPlayer.displayName),
        missingPlayers,
      },
      { status: 409 },
    );
  }

  const blueRows = matchedRows.filter((row) => row.sessionPlayer.side === "BLUE");
  const redRows = matchedRows.filter((row) => row.sessionPlayer.side === "RED");
  const blueWins = blueRows.filter((row) => isPlayerWin(row.detailPlayer)).length;
  const redWins = redRows.filter((row) => isPlayerWin(row.detailPlayer)).length;
  const blueWon = blueWins >= redWins;
  const currentSeason = getRankedSeason();
  if (currentSeason && session.createdAt < currentSeason.startedAt) {
    return NextResponse.json({ message: "This ready session belongs to the previous ranked season. Create a fresh !ready roster before reporting." }, { status: 409 });
  }

  const blueKills = blueRows.reduce(
    (sum, row) => sum + parseScoreInfo(row.detailPlayer.scoreInfo).kills,
    0,
  );
  const redKills = redRows.reduce(
    (sum, row) => sum + parseScoreInfo(row.detailPlayer.scoreInfo).kills,
    0,
  );
  const blueGold = blueRows.reduce(
    (sum, row) => sum + safeNumber(row.detailPlayer.goldEarned ?? row.detailPlayer.echartsMap?.goldEarned),
    0,
  );
  const redGold = redRows.reduce(
    (sum, row) => sum + safeNumber(row.detailPlayer.goldEarned ?? row.detailPlayer.echartsMap?.goldEarned),
    0,
  );
  const mvpName =
    matchedRows.find((row) => row.detailPlayer.wasMvp === "1")?.sessionPlayer.displayName ?? null;

  const applyIngestion = () => prisma.$transaction(async (tx) => {
    await acquireRankedInhouseReportLock(tx);

    const durableSession = await tx.inhouseSession.findUnique({
      where: { id: session.id },
      select: {
        status: true,
        matchId: true,
        matchGameId: true,
        lzyumiGameId: true,
      },
    });
    if (!durableSession) throw new Error("The inhouse session no longer exists.");
    if (durableSession.status === "COMPLETED") {
      return {
        alreadyReported: true as const,
        appliedPlayers: matchedRows.length,
        matchId: durableSession.matchId,
        matchGameId: durableSession.matchGameId,
        lzyumiGameId: durableSession.lzyumiGameId,
      };
    }
    if (durableSession.status !== "ASSIGNED") {
      throw new Error("The inhouse session is no longer active.");
    }

    const durableGameOwner = await tx.inhouseSession.findUnique({
      where: { lzyumiGameId: recentMatch.gameId },
      select: { id: true },
    });
    if (durableGameOwner && durableGameOwner.id !== session.id) {
      throw new ReportedGameConflictError("That ECL.GG game has already been reported to ECL.");
    }

    const blueTeam = await tx.team.upsert({
      where: { name: teamName(session.id, "BLUE") },
      update: {},
      create: { name: teamName(session.id, "BLUE") },
    });
    const redTeam = await tx.team.upsert({
      where: { name: teamName(session.id, "RED") },
      update: {},
      create: { name: teamName(session.id, "RED") },
    });
    const match = await tx.match.create({
      data: {
        stage: "REGULAR_SEASON",
        roundLabel: session.gameLabel ?? "Ranked Inhouse",
        matchLabel: session.gameLabel ?? `Ranked IH ${new Date().toISOString().slice(0, 10)}`,
        bestOf: 1,
        status: "COMPLETED",
        homeTeamId: blueTeam.id,
        awayTeamId: redTeam.id,
        winnerTeamId: blueWon ? blueTeam.id : redTeam.id,
        homeScore: blueWon ? 1 : 0,
        awayScore: blueWon ? 0 : 1,
      },
    });
    const game = await tx.matchGame.create({
      data: {
        matchId: match.id,
        gameNumber: 1,
        winnerTeamId: blueWon ? blueTeam.id : redTeam.id,
        homeKills: blueKills,
        awayKills: redKills,
        homeGold: blueGold,
        awayGold: redGold,
        mvpName,
        ocrRawJson: toJson({ source: "kook-inhouse-report", recentMatch, detail: matchDetail }),
      },
    });

    let appliedPlayers = 0;
    const reportedAt = new Date();
    const season = currentSeason;
    const rankedFilter = currentRankedFilter(season);
    const doubleLpDayBounds = chinaDayBounds(reportedAt);
    const linkedPlayerIds = matchedRows
      .map((row) => row.sessionPlayer.playerId)
      .filter((id): id is string => Boolean(id));
    const linkedPlayers = linkedPlayerIds.length > 0
      ? await tx.player.findMany({ where: { id: { in: linkedPlayerIds } } })
      : [];
    const linkedPlayerById = new Map(linkedPlayers.map((player) => [player.id, player]));
    const resolvedPlayers = [];

    for (const row of matchedRows) {
      const linked = row.sessionPlayer.playerId
        ? linkedPlayerById.get(row.sessionPlayer.playerId)
        : undefined;
      resolvedPlayers.push(linked ?? await findOrCreatePlayer(row.sessionPlayer, tx));
    }

    const seasonStates = season
      ? await loadRankedSeasonStates(resolvedPlayers.map((player) => player.id), season, tx)
      : null;

    for (const [index, row] of matchedRows.entries()) {
      const player = resolvedPlayers[index];
      const state = seasonStates?.get(player.id) ?? null;
      const fallbackHistory = state
        ? null
        : await Promise.all([
            tx.matchGamePlayerStat.count({ where: { playerId: player.id, ...rankedFilter } }),
            tx.matchGamePlayerStat.findFirst({
              where: { playerId: player.id, ...rankedFilter },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            }),
            tx.matchGamePlayerStat.count({
              where: {
                ...rankedFilter,
                playerId: player.id,
                createdAt: { gte: doubleLpDayBounds.start, lt: doubleLpDayBounds.end },
              },
            }),
          ]);
      const gamesPlayed = state?.gamesPlayed ?? fallbackHistory?.[0] ?? 0;
      const lastPlayedAt = state?.lastPlayedAt ?? fallbackHistory?.[1]?.createdAt;
      const hasPlayedOnDoubleLpDay = state
        ? state.stats.some((stat) =>
            stat.createdAt >= (season!.startedAt > doubleLpDayBounds.start
              ? season!.startedAt
              : doubleLpDayBounds.start) && stat.createdAt < doubleLpDayBounds.end)
        : (fallbackHistory?.[2] ?? 0) > 0;
      const teamId = row.sessionPlayer.side === "BLUE" ? blueTeam.id : redTeam.id;
      const isWin = teamId === game.winnerTeamId;
      const score = parseScoreInfo(row.detailPlayer.scoreInfo);
      const lp = calculateLpChange({
        win: isWin,
        kills: score.kills,
        deaths: score.deaths,
        assists: score.assists,
        isMVP: row.detailPlayer.wasMvp === "1",
        isSVP: row.detailPlayer.wasSvp === "1",
        currentElo: state?.elo ?? player.elo,
        gamesPlayed,
        winStreak: state?.winStreak ?? player.winStreak,
        lossStreak: state?.lossStreak ?? player.lossStreak,
        lastPlayedAt,
        playedAt: reportedAt,
        hasPlayedOnDoubleLpDay,
        doubleLpEligible: true,
      }).lpChange;
      const eloBefore = state?.elo ?? player.elo;
      const eloAfter = eloBefore + lp;

      await tx.matchGamePlayerStat.create({
        data: {
          matchGameId: game.id,
          playerId: player.id,
          teamId,
          riotName: player.riotName,
          riotTag: player.riotTag,
          kills: score.kills,
          deaths: score.deaths,
          assists: score.assists,
          gold: safeNumber(row.detailPlayer.goldEarned ?? row.detailPlayer.echartsMap?.goldEarned),
          damage: safeNumber(row.detailPlayer.totalDamageDealt ?? row.detailPlayer.echartsMap?.totalDamageDealt),
          isWin,
          isMVP: row.detailPlayer.wasMvp === "1",
          isSVP: row.detailPlayer.wasSvp === "1",
          lpChange: lp,
          eloBefore,
          eloAfter,
        },
      });
      await tx.player.update({
        where: { id: player.id },
        data: {
          elo: eloAfter,
          winStreak: isWin ? (state?.winStreak ?? player.winStreak) + 1 : 0,
          lossStreak: isWin ? 0 : (state?.lossStreak ?? player.lossStreak) + 1,
        },
      });
      if (row.sessionPlayer.playerId !== player.id) {
        await tx.inhouseSessionPlayer.update({
          where: { id: row.sessionPlayer.id },
          data: { playerId: player.id },
        });
      }
      appliedPlayers += 1;
    }

    await tx.inhouseSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        blueTeamId: blueTeam.id,
        redTeamId: redTeam.id,
        matchId: match.id,
        matchGameId: game.id,
        lzyumiGameId: recentMatch.gameId,
        reportedByKookId: adminOverride ? "ADMIN" : reporterKookUserId,
        reportRawJson: toJson({ recentMatch, reporterProfile }),
        completedAt: new Date(),
      },
    });

    return {
      alreadyReported: false as const,
      appliedPlayers,
      matchId: match.id,
      matchGameId: game.id,
      lzyumiGameId: recentMatch.gameId,
    };
  }, { maxWait: 10_000, timeout: 240_000 });

  let ingestion: Awaited<ReturnType<typeof applyIngestion>>;
  try {
    ingestion = await applyIngestion();
  } catch (error) {
    if (error instanceof ReportedGameConflictError) {
      return NextResponse.json(
        { ok: false, status: "ALREADY_REPORTED", reply: error.message },
        { status: 409 },
      );
    }
    console.error(
      "Atomic inhouse report ingestion failed:",
      error instanceof Error ? error.message : "Unknown database error.",
    );
    return NextResponse.json(
      {
        ok: false,
        status: "INGESTION_FAILED",
        reply:
          "ECL could not apply this result yet. No partial match or LP update was saved; the Report Engine will retry transient failures.",
      },
      { status: 500 },
    );
  }

  if (ingestion.alreadyReported) {
    return NextResponse.json({
      ok: true,
      status: "ALREADY_REPORTED",
      reply: `${session.gameLabel ?? "This inhouse"} has already been reported.`,
      sessionId: session.id,
      matchId: ingestion.matchId,
      matchGameId: ingestion.matchGameId,
      lzyumiGameId: ingestion.lzyumiGameId,
    });
  }

  // Revalidate live match/profile/ladder surfaces immediately after LP is applied.
  revalidatePath("/hub/inhouses");
  revalidatePath("/hub/me");
  revalidatePath("/hub/leaderboard");

  return NextResponse.json({
    ok: true,
    status: "INGESTED",
    reply: `Reported. ECL ingested ${ingestion.appliedPlayers}/10 players. Winner: ${
      blueWon ? "Blue Side" : "Red Side"
    }.`,
    sessionId: session.id,
    matchId: ingestion.matchId,
    matchGameId: ingestion.matchGameId,
    lzyumiGameId: ingestion.lzyumiGameId,
    appliedPlayers: ingestion.appliedPlayers,
  });
}
