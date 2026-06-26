import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { calculateLpChange } from "@/lib/elo";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import {
  fetchLatestLzyumiMatch,
  fetchLzyumiMatchDetail,
  getChinaServer,
  type LzyumiDetailResponse,
  type LzyumiLookupResponse,
  type LzyumiPlayerDetail,
  type LzyumiRecentMatch,
} from "@/lib/lzyumi";
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

const ACTIVE_SESSION_HOURS = 48;
const REQUIRED_MATCHED_PLAYERS = 10;

type RawMatchData = {
  profile: LzyumiLookupResponse;
  gameId: string;
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

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  const secret = request.headers.get("x-ecl-kook-secret");
  return !process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET;
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

async function findOrCreatePlayer(sessionPlayer: SessionPlayer) {
  const riotName = normalizeRiotPart(sessionPlayer.riotName);
  const riotTag = normalizeRiotTag(sessionPlayer.riotTag);
  const email = clean(sessionPlayer.email);

  const existingById = sessionPlayer.playerId
    ? await prisma.player.findUnique({
        where: {
          id: sessionPlayer.playerId,
        },
      })
    : null;

  if (existingById) return existingById;

  const player = await syncPlayerForProfile({
    displayName: sessionPlayer.displayName,
    riotName,
    riotTag,
    email,
  });

  return prisma.player.findUniqueOrThrow({
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
    const { profile, gameId, detail } = body.rawMatchData;
    const openId = profile.battleInfo?.openId;

    if (!openId) {
      return NextResponse.json(
        {
          status: "NO_LATEST_MATCH",
          reply: "Pre-fetched lzyumi data is missing the player openId.",
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

    recentMatch = { gameId };
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
          reply: "I could not find a recent Lzyumi match for the reporter. If the bot supports it, ensure it passes match data directly.",
        },
        { status: 404 },
      );
    }

    recentMatch = latest.recentMatch;
    matchDetail = latest.detail;
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

  if (alreadyReported && alreadyReported.id !== session.id) {
    return NextResponse.json(
      {
        status: "ALREADY_REPORTED",
        reply: "That Lzyumi game has already been reported to ECL.",
        sessionId: alreadyReported.id,
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
      const detailPlayer =
        (key ? detailByRiotKey.get(key) : undefined) ??
        (nameKey ? detailByNameKey.get(nameKey) ?? undefined : undefined);
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
        reply: `The latest Lzyumi game only matched ${matchedRows.length}/10 inhouse players. I did not ingest it. Missing: ${
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

  const blueTeam = await prisma.team.upsert({
    where: {
      name: teamName(session.id, "BLUE"),
    },
    update: {},
    create: {
      name: teamName(session.id, "BLUE"),
    },
  });
  const redTeam = await prisma.team.upsert({
    where: {
      name: teamName(session.id, "RED"),
    },
    update: {},
    create: {
      name: teamName(session.id, "RED"),
    },
  });

  const match = await prisma.match.create({
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

  const game = await prisma.matchGame.create({
    data: {
      matchId: match.id,
      gameNumber: 1,
      winnerTeamId: blueWon ? blueTeam.id : redTeam.id,
      homeKills: blueKills,
      awayKills: redKills,
      homeGold: blueGold,
      awayGold: redGold,
      mvpName,
      ocrRawJson: toJson({
        source: "kook-inhouse-report",
        recentMatch,
        detail: matchDetail,
      }),
    },
  });

  let appliedPlayers = 0;

  for (const row of matchedRows) {
    const player = await findOrCreatePlayer(row.sessionPlayer);
    const gamesPlayed = await prisma.matchGamePlayerStat.count({
      where: {
        playerId: player.id,
        ...INHOUSE_MATCH_FILTER,
      },
    });
    const side = row.sessionPlayer.side;
    const teamId = side === "BLUE" ? blueTeam.id : redTeam.id;
    const isWin = teamId === game.winnerTeamId;
    const score = parseScoreInfo(row.detailPlayer.scoreInfo);
    const lp = calculateLpChange({
      win: isWin,
      kills: score.kills,
      deaths: score.deaths,
      assists: score.assists,
      isMVP: row.detailPlayer.wasMvp === "1",
      isSVP: row.detailPlayer.wasSvp === "1",
      currentElo: player.elo,
      gamesPlayed,
      winStreak: player.winStreak,
      lossStreak: player.lossStreak,
    }).lpChange;
    const eloAfter = player.elo + lp;

    await prisma.matchGamePlayerStat.create({
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
        damage: safeNumber(
          row.detailPlayer.totalDamageDealt ?? row.detailPlayer.echartsMap?.totalDamageDealt,
        ),
        isWin,
        isMVP: row.detailPlayer.wasMvp === "1",
        isSVP: row.detailPlayer.wasSvp === "1",
        lpChange: lp,
        eloBefore: player.elo,
        eloAfter,
      },
    });

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        elo: eloAfter,
        winStreak: isWin ? player.winStreak + 1 : 0,
        lossStreak: isWin ? 0 : player.lossStreak + 1,
      },
    });

    await prisma.inhouseSessionPlayer.update({
      where: {
        id: row.sessionPlayer.id,
      },
      data: {
        playerId: player.id,
      },
    });

    appliedPlayers += 1;
  }

  await prisma.inhouseSession.update({
    where: {
      id: session.id,
    },
    data: {
      status: "COMPLETED",
      blueTeamId: blueTeam.id,
      redTeamId: redTeam.id,
      matchId: match.id,
      matchGameId: game.id,
      lzyumiGameId: recentMatch.gameId,
      reportedByKookId: adminOverride ? "ADMIN" : reporterKookUserId,
      reportRawJson: toJson({
        recentMatch,
        reporterProfile,
      }),
      completedAt: new Date(),
    },
  });

  // Revalidate live match/profile surfaces immediately; the ranked ladder stays on its daily window.
  revalidatePath("/hub/inhouses");
  revalidatePath("/hub/me");

  return NextResponse.json({
    ok: true,
    status: "INGESTED",
    reply: `Reported. ECL ingested ${appliedPlayers}/10 players. Winner: ${
      blueWon ? "Blue Side" : "Red Side"
    }.`,
    sessionId: session.id,
    matchId: match.id,
    matchGameId: game.id,
    lzyumiGameId: recentMatch.gameId,
    appliedPlayers,
  });
}
