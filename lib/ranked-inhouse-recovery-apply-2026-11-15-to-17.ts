import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { calculateLpChange, STARTING_ELO } from "./elo";
import { INHOUSE_MATCH_FILTER } from "./inhouse-filter";
import { acquireRankedInhouseReportLock } from "./inhouse-report-lock";
import { prisma } from "./prisma";
import { getRankedSeason } from "./ranked-season";
import {
  parseRecoveryReviewManifest,
  RECOVERY_SCOPE,
  type ParsedGame,
  type ParsedParticipant,
  type RecoveryReviewManifest,
  type RecoveryManifestDefinition,
  type RecoveryScope,
} from "./ranked-inhouse-recovery-review-2026-11-15-to-17";
import { normalizeRiotTag, riotIdKey } from "./riot-id";

export const RECOVERY_APPLY_OPERATION = "ranked-inhouse-recovery-2026-11-15-to-17-apply-v1";
export const RECOVERY_APPLY_ENDPOINT = "https://eclchina.lol/api/jobs/inhouse-recovery-2026-11-15-to-17/apply";

export type RankedInhouseImportDefinition = RecoveryManifestDefinition & {
  applyOperationId: string;
  scope: RecoveryScope;
  source: string;
  labelPrefix: string;
  sessionChannelPrefix: string;
  unregisteredParticipantPolicy: "allow" | "manifest";
};

export const DATED_RECOVERY_IMPORT_DEFINITION: RankedInhouseImportDefinition = {
  reviewOperationId: "ranked-inhouse-recovery-2026-11-15-to-17-review-v1",
  applyOperationId: RECOVERY_APPLY_OPERATION,
  target: "deebeedee-ecl/ecl-split-one",
  scope: RECOVERY_SCOPE,
  source: "ranked-inhouse-recovery",
  labelPrefix: "IH Recovery",
  sessionChannelPrefix: "DATED_RECOVERY",
  unregisteredParticipantPolicy: "allow",
  allowKiwiForAuthorizedPartial: true,
};

const CANCELLED_JOB_STATUSES = ["CANCELLED", "DESKTOP_CANCELLED", "DESKTOP_EXPIRED", "DESKTOP_REJECTED"];
type RecoveryDb = typeof prisma | Prisma.TransactionClient;

type ResolvedParticipant = {
  participant: ParsedParticipant;
  profile: {
    id: string;
    displayName: string;
    email: string;
    riotName: string;
    riotTag: string;
    chinaServerId: number | null;
    openId: string | null;
    kookId: string | null;
  };
  player: {
    id: string;
    name: string;
    riotName: string | null;
    riotTag: string | null;
    email: string | null;
    elo: number;
    winStreak: number;
    lossStreak: number;
  };
};

type ExistingStat = {
  id: string;
  playerId: string;
  createdAt: Date;
  isWin: boolean;
  kills: number;
  deaths: number;
  assists: number;
  isMVP: boolean;
  isSVP: boolean;
  lpChange: number;
  eloBefore: number | null;
  eloAfter: number | null;
};

type ProjectedStat = {
  key: string;
  kind: "existing" | "new";
  existingId: string | null;
  gameSequence: number | null;
  identityKey: string | null;
  playerId: string;
  createdAt: Date;
  isWin: boolean;
  kills: number;
  deaths: number;
  assists: number;
  isMVP: boolean;
  isSVP: boolean;
  lpChange: number;
  eloBefore: number;
  eloAfter: number;
};

type GameMode = { game: ParsedGame; mode: "INSERT" | "EXISTING"; existingMatchGameId: string | null };

export type RecoveryApplyPlan = {
  readOnly: true;
  applyAvailable: true;
  clean: boolean;
  fingerprint: string;
  blockers: string[];
  warnings: string[];
  summary: {
    operationId: string;
    gameCount: number;
    gamesToInsert: number;
    alreadyPresentGames: number;
    eligibleStatRowsToInsert: number;
    excludedObservedParticipants: number;
    authorizedUnknownFillerSlots: number;
    affectedPlayers: number;
    existingSeasonStatsReplayed: number;
    existingStatsChanged: number;
    projectedInsertedLpDelta: number;
    projectedExistingReplayDelta: number;
  };
  games: Array<{
    sequence: number;
    chinaTime: string;
    mode: "INSERT" | "EXISTING";
    observedParticipants: number;
    eligibleParticipants: number;
    excludedObservedParticipants: number;
    authorizedUnknownFillerSlots: number;
  }>;
};

type InternalPlan = {
  public: RecoveryApplyPlan;
  manifest: RecoveryReviewManifest;
  gameModes: GameMode[];
  resolved: Map<string, ResolvedParticipant>;
  excludedIdentityKeys: Set<string>;
  projected: ProjectedStat[];
  finalStates: Map<string, { elo: number; winStreak: number; lossStreak: number }>;
  beforePlayers: Array<{ id: string; elo: number; winStreak: number; lossStreak: number }>;
  beforeStats: ExistingStat[];
};

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function nestedText(value: unknown, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = value;
    for (const part of path) current = record(current)?.[part];
    if (typeof current === "string" && current.trim()) return current.trim();
  }
  return "";
}

function matchGameProviderId(value: Prisma.JsonValue | null) {
  return nestedText(value, [["gameId"], ["raw", "gameId"], ["recentMatch", "gameId"], ["raw", "recentMatch", "gameId"]]);
}

function reportJobProviderId(value: Prisma.JsonValue | null) {
  return nestedText(value, [["gameId"], ["rawMatchData", "gameId"], ["recentMatch", "gameId"]]);
}

function jsonGameIdPaths(gameId: string): Prisma.MatchGameWhereInput[] {
  return [["gameId"], ["raw", "gameId"], ["recentMatch", "gameId"], ["raw", "recentMatch", "gameId"]]
    .map((path) => ({ ocrRawJson: { path, equals: gameId } }));
}

function reportJobPaths(gameId: string): Prisma.InhouseReportJobWhereInput[] {
  return [["gameId"], ["rawMatchData", "gameId"], ["recentMatch", "gameId"]]
    .map((path) => ({ rawMatchData: { path, equals: gameId } }));
}

function tournamentPaths(gameId: string): Prisma.TournamentReportWhereInput[] {
  return [["providerGameId"], ["evidence", "providerGameId"]]
    .map((path) => ({ raw: { path, equals: gameId } }));
}

function chinaDay(value: Date) {
  const china = new Date(value.getTime() + 8 * 60 * 60 * 1000);
  return `${china.getUTCFullYear()}-${String(china.getUTCMonth() + 1).padStart(2, "0")}-${String(china.getUTCDate()).padStart(2, "0")}`;
}

function chinaTime(value: Date) {
  const china = new Date(value.getTime() + 8 * 60 * 60 * 1000);
  return `${chinaDay(value)} ${String(china.getUTCHours()).padStart(2, "0")}:${String(china.getUTCMinutes()).padStart(2, "0")}`;
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function resolveParticipants(
  db: RecoveryDb,
  games: ParsedGame[],
  blockers: string[],
  warnings: string[],
  allowUnregisteredParticipants: boolean,
) {
  const participants = new Map<string, ParsedParticipant>();
  for (const game of games) for (const participant of game.participants) participants.set(participant.identityKey, participant);
  const identities = [...participants.values()];
  const profiles = identities.length ? await db.accountProfile.findMany({
    where: {
      OR: [
        ...identities.map((identity) => ({
          riotName: { equals: identity.riotName, mode: "insensitive" as const },
          riotTag: { equals: identity.riotTag, mode: "insensitive" as const },
        })),
        { openId: { in: unique(identities.map((identity) => identity.openId)) }, chinaServerId: 1 },
      ],
    },
    select: {
      id: true, displayName: true, email: true, riotName: true, riotTag: true,
      chinaServerId: true, openId: true, kookId: true, verificationStatus: true, accountStatus: true,
    },
  }) : [];
  const selected: Array<{ participant: ParsedParticipant; profile: typeof profiles[number] }> = [];
  const excluded = new Set<string>();
  for (const participant of identities) {
    const stable = profiles.filter((profile) => profile.openId === participant.openId && profile.chinaServerId === participant.areaId);
    const eligible = stable.filter((profile) => Boolean(profile.kookId)
      && profile.verificationStatus === "VERIFIED" && profile.accountStatus === "ACTIVE");
    if (eligible.length === 0) {
      excluded.add(participant.identityKey);
      continue;
    }
    if (eligible.length !== 1) {
      blockers.push("AMBIGUOUS_STABLE_PROFILE_IDENTITY");
      continue;
    }
    if (riotIdKey(eligible[0].riotName, eligible[0].riotTag) !== participant.identityKey) {
      warnings.push("PROFILE_RIOT_ID_RENAMED_MATCHED_BY_OPEN_ID");
    }
    selected.push({ participant, profile: eligible[0] });
  }
  if (excluded.size) {
    if (allowUnregisteredParticipants) {
      warnings.push("OWNER_AUTHORIZED_UNREGISTERED_PARTICIPANTS_EXCLUDED");
    } else {
      blockers.push("UNREGISTERED_PARTICIPANTS_REQUIRE_OWNER_APPROVAL");
    }
  }
  const players = selected.length ? await db.player.findMany({
    where: {
      OR: selected.flatMap(({ profile }) => [
        { riotName: { equals: profile.riotName, mode: "insensitive" as const }, riotTag: { equals: profile.riotTag, mode: "insensitive" as const } },
        { email: { equals: profile.email, mode: "insensitive" as const } },
      ]),
    },
    select: { id: true, name: true, riotName: true, riotTag: true, email: true, elo: true, winStreak: true, lossStreak: true },
  }) : [];
  const resolved = new Map<string, ResolvedParticipant>();
  for (const row of selected) {
    const candidates = players.filter((player) =>
      riotIdKey(player.riotName, player.riotTag) === riotIdKey(row.profile.riotName, row.profile.riotTag)
      || Boolean(player.email && row.profile.email && player.email.toLowerCase() === row.profile.email.toLowerCase()),
    );
    const distinct = [...new Map(candidates.map((player) => [player.id, player])).values()];
    if (distinct.length !== 1) {
      blockers.push("REGISTERED_PROFILE_PLAYER_RESOLUTION_MISMATCH");
      continue;
    }
    resolved.set(row.participant.identityKey, { ...row, player: distinct[0] });
  }
  if (new Set([...resolved.values()].map((row) => row.player.id)).size !== resolved.size) {
    blockers.push("REGISTERED_PLAYER_NOT_UNIQUE");
  }
  return { resolved, excluded };
}

async function buildInternalPlan(
  value: unknown,
  db: RecoveryDb,
  definition: RankedInhouseImportDefinition,
): Promise<InternalPlan> {
  const parsed = parseRecoveryReviewManifest(value, definition.scope, definition);
  const blockers = [...parsed.blockers];
  const warnings = [...parsed.warnings];
  const ids = parsed.games.map((game) => game.providerGameId);
  const [sessions, matchGames, reportJobs, tournamentReports, collectionJobs] = await Promise.all([
    db.inhouseSession.findMany({
      where: { lzyumiGameId: { in: ids } },
      select: { id: true, lzyumiGameId: true, status: true, matchId: true, matchGameId: true },
    }),
    db.matchGame.findMany({
      where: { OR: ids.flatMap(jsonGameIdPaths) },
      select: {
        id: true, ocrRawJson: true,
        playerStats: { select: { id: true, playerId: true, isWin: true, kills: true, deaths: true, assists: true } },
      },
    }),
    db.inhouseReportJob.findMany({
      where: { status: { notIn: CANCELLED_JOB_STATUSES }, OR: ids.flatMap(reportJobPaths) },
      select: { id: true, sessionId: true, status: true, rawMatchData: true },
    }),
    db.tournamentReport.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] }, OR: [{ leagueGameId: { in: ids } }, ...ids.flatMap(tournamentPaths)] },
      select: { id: true },
    }),
    db.tournamentCollectionJob.findMany({ where: { leagueGameId: { in: ids } }, select: { id: true } }),
  ]);
  if (tournamentReports.length) blockers.push("TOURNAMENT_REPORT_COLLISION");
  if (collectionJobs.length) blockers.push("TOURNAMENT_COLLECTION_COLLISION");
  const allowUnregisteredParticipants = definition.unregisteredParticipantPolicy === "allow"
    || parsed.manifest.operatorReview.approvedUnregisteredParticipants === true;
  const { resolved, excluded } = await resolveParticipants(
    db,
    parsed.games,
    blockers,
    warnings,
    allowUnregisteredParticipants,
  );
  const gameModes: GameMode[] = [];
  for (const game of parsed.games) {
    const gameSessions = sessions.filter((row) => row.lzyumiGameId === game.providerGameId);
    const gameRows = matchGames.filter((row) => matchGameProviderId(row.ocrRawJson) === game.providerGameId);
    const jobs = reportJobs.filter((row) => reportJobProviderId(row.rawMatchData) === game.providerGameId);
    if (gameSessions.length === 0 && gameRows.length === 0 && jobs.length === 0) {
      gameModes.push({ game, mode: "INSERT", existingMatchGameId: null });
      continue;
    }
    const session = gameSessions[0];
    const matchGame = gameRows[0];
    const coherent = gameSessions.length === 1 && gameRows.length === 1
      && session.status === "COMPLETED" && session.matchGameId === matchGame.id && Boolean(session.matchId)
      && jobs.every((job) => job.sessionId === session.id && job.status === "CONFIRMED");
    if (!coherent) {
      blockers.push(`GAME_${game.sequence}_FOREIGN_OR_PARTIAL_COLLISION`);
      gameModes.push({ game, mode: "EXISTING", existingMatchGameId: matchGame?.id ?? null });
      continue;
    }
    const statsByPlayer = new Map(matchGame.playerStats.map((stat) => [stat.playerId, stat]));
    for (const participant of game.participants) {
      const identity = resolved.get(participant.identityKey);
      if (!identity) continue;
      const stat = statsByPlayer.get(identity.player.id);
      if (!stat || stat.isWin !== participant.isWin || stat.kills !== participant.kills
        || stat.deaths !== participant.deaths || stat.assists !== participant.assists) {
        blockers.push(`GAME_${game.sequence}_EXISTING_STATS_MISMATCH`);
      }
    }
    gameModes.push({ game, mode: "EXISTING", existingMatchGameId: matchGame.id });
  }

  for (const mode of gameModes.filter((row) => row.mode === "INSERT")) {
    const eligible = mode.game.participants.filter((participant) => resolved.has(participant.identityKey));
    const teams = unique(eligible.map((participant) => participant.teamId));
    if (teams.length !== 2) blockers.push(`GAME_${mode.game.sequence}_ELIGIBLE_PLAYERS_NOT_ON_BOTH_TEAMS`);
  }
  const season = getRankedSeason();
  if (!season) blockers.push("ACTIVE_RANKED_SEASON_MISSING");
  if (season && parsed.games.some((game) => game.playedAt < season.startedAt)) blockers.push("GAME_PREDATES_ACTIVE_RANKED_SEASON");
  const existingCollisionPlayerIds = unique(matchGames.flatMap((game) => game.playerStats.map((stat) => stat.playerId)));
  const affectedPlayerIds = unique([...resolved.values()].map((row) => row.player.id).concat(existingCollisionPlayerIds));
  const beforePlayers = affectedPlayerIds.length ? await db.player.findMany({
    where: { id: { in: affectedPlayerIds } },
    select: { id: true, elo: true, winStreak: true, lossStreak: true },
  }) : [];
  const beforeStats: ExistingStat[] = season && affectedPlayerIds.length ? await db.matchGamePlayerStat.findMany({
    where: { ...INHOUSE_MATCH_FILTER, playerId: { in: affectedPlayerIds }, createdAt: { gte: season.startedAt } },
    select: {
      id: true, playerId: true, createdAt: true, isWin: true, kills: true, deaths: true, assists: true,
      isMVP: true, isSVP: true, lpChange: true, eloBefore: true, eloAfter: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  }) : [];
  const projected: ProjectedStat[] = beforeStats.map((stat) => ({
    key: `existing:${stat.id}`, kind: "existing", existingId: stat.id, gameSequence: null, identityKey: null,
    ...stat, lpChange: 0, eloBefore: 0, eloAfter: 0,
  }));
  for (const mode of gameModes.filter((row) => row.mode === "INSERT")) {
    for (const participant of mode.game.participants) {
      const identity = resolved.get(participant.identityKey);
      if (!identity) continue;
      projected.push({
        key: `new:${String(mode.game.sequence).padStart(2, "0")}:${participant.identityKey}`,
        kind: "new", existingId: null, gameSequence: mode.game.sequence, identityKey: participant.identityKey,
        playerId: identity.player.id, createdAt: mode.game.playedAt, isWin: participant.isWin,
        kills: participant.kills, deaths: participant.deaths, assists: participant.assists,
        isMVP: participant.isMVP, isSVP: participant.isSVP, lpChange: 0, eloBefore: 0, eloAfter: 0,
      });
    }
  }
  const finalStates = new Map<string, { elo: number; winStreak: number; lossStreak: number }>();
  for (const playerId of affectedPlayerIds) {
    const events = projected.filter((event) => event.playerId === playerId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.key.localeCompare(b.key));
    let elo = STARTING_ELO;
    let winStreak = 0;
    let lossStreak = 0;
    let lastPlayedAt: Date | null = null;
    const playedDays = new Set<string>();
    for (const event of events) {
      const result = calculateLpChange({
        win: event.isWin, kills: event.kills, deaths: event.deaths, assists: event.assists,
        isMVP: event.isMVP, isSVP: event.isSVP, currentElo: elo,
        winStreak, lossStreak, lastPlayedAt, playedAt: event.createdAt,
        hasPlayedOnDoubleLpDay: playedDays.has(chinaDay(event.createdAt)), doubleLpEligible: true,
      });
      event.lpChange = result.lpChange;
      event.eloBefore = elo;
      event.eloAfter = elo + result.lpChange;
      elo = event.eloAfter;
      winStreak = event.isWin ? winStreak + 1 : 0;
      lossStreak = event.isWin ? 0 : lossStreak + 1;
      lastPlayedAt = event.createdAt;
      playedDays.add(chinaDay(event.createdAt));
    }
    finalStates.set(playerId, { elo, winStreak, lossStreak });
  }
  const existingProjection = projected.filter((row) => row.kind === "existing");
  const newProjection = projected.filter((row) => row.kind === "new");
  const oldById = new Map(beforeStats.map((row) => [row.id, row]));
  const existingStatsChanged = existingProjection.filter((row) => {
    const old = oldById.get(row.existingId!);
    return !old || old.lpChange !== row.lpChange || old.eloBefore !== row.eloBefore || old.eloAfter !== row.eloAfter;
  }).length;
  const fingerprint = hash({
    definition,
    manifest: parsed.manifest,
    collisions: {
      sessions: sessions.map((row) => row.id).sort(), matchGames: matchGames.map((row) => row.id).sort(),
      reportJobs: reportJobs.map((row) => `${row.id}:${row.status}`).sort(),
    },
    resolved: [...resolved.values()].map((row) => ({
      identityKey: row.participant.identityKey, openIdHash: hash(row.participant.openId),
      profileId: row.profile.id, playerId: row.player.id,
    })).sort((a, b) => a.identityKey.localeCompare(b.identityKey)),
    excluded: [...excluded].map(hash).sort(),
    beforePlayers, beforeStats,
    projected: projected.map((row) => ({ key: row.key, lpChange: row.lpChange, eloBefore: row.eloBefore, eloAfter: row.eloAfter })),
    blockers: unique(blockers),
  });
  const gameRows = gameModes.map((mode) => {
    const eligible = mode.game.participants.filter((participant) => resolved.has(participant.identityKey)).length;
    return {
      sequence: mode.game.sequence, chinaTime: chinaTime(mode.game.playedAt), mode: mode.mode,
      observedParticipants: mode.game.participants.length, eligibleParticipants: eligible,
      excludedObservedParticipants: mode.game.participants.length - eligible,
      authorizedUnknownFillerSlots: mode.game.ownerAuthorizedUnregisteredFillerSlots,
    };
  });
  const publicPlan: RecoveryApplyPlan = {
    readOnly: true, applyAvailable: true, clean: unique(blockers).length === 0, fingerprint,
    blockers: unique(blockers), warnings: unique(warnings),
    summary: {
      operationId: definition.applyOperationId, gameCount: parsed.games.length,
      gamesToInsert: gameModes.filter((row) => row.mode === "INSERT").length,
      alreadyPresentGames: gameModes.filter((row) => row.mode === "EXISTING").length,
      eligibleStatRowsToInsert: newProjection.length,
      excludedObservedParticipants: excluded.size,
      authorizedUnknownFillerSlots: parsed.games.reduce((sum, game) => sum + game.ownerAuthorizedUnregisteredFillerSlots, 0),
      affectedPlayers: affectedPlayerIds.length, existingSeasonStatsReplayed: beforeStats.length, existingStatsChanged,
      projectedInsertedLpDelta: newProjection.reduce((sum, row) => sum + row.lpChange, 0),
      projectedExistingReplayDelta: existingProjection.reduce((sum, row) => sum + row.lpChange - (oldById.get(row.existingId!)?.lpChange ?? 0), 0),
    },
    games: gameRows,
  };
  return { public: publicPlan, manifest: parsed.manifest, gameModes, resolved, excludedIdentityKeys: excluded, projected, finalStates, beforePlayers, beforeStats };
}

export async function preflightRankedInhouseRecovery(
  value: unknown,
  db: RecoveryDb = prisma,
  scope: RecoveryScope = RECOVERY_SCOPE,
) {
  return (await buildInternalPlan(value, db, {
    ...DATED_RECOVERY_IMPORT_DEFINITION,
    scope,
  })).public;
}

export async function preflightRankedInhouseImport(
  value: unknown,
  definition: RankedInhouseImportDefinition,
  db: RecoveryDb = prisma,
) {
  return (await buildInternalPlan(value, db, definition)).public;
}

function gameLabel(game: ParsedGame, definition: RankedInhouseImportDefinition) {
  return `${definition.labelPrefix} ${chinaTime(game.playedAt)}`;
}

export async function applyRankedInhouseImport(
  value: unknown,
  expectedFingerprint: string,
  definition: RankedInhouseImportDefinition,
) {
  return prisma.$transaction(async (tx) => {
    await acquireRankedInhouseReportLock(tx);
    const plan = await buildInternalPlan(value, tx, definition);
    if (!plan.public.clean) throw new Error(`Recovery apply is blocked: ${plan.public.blockers.join(", ")}`);
    if (!expectedFingerprint || expectedFingerprint !== plan.public.fingerprint) {
      throw new Error("Recovery fingerprint no longer matches production state.");
    }
    const newProjectionByKey = new Map(plan.projected.filter((row) => row.kind === "new")
      .map((row) => [`${row.gameSequence}:${row.identityKey}`, row]));
    const rawGames = new Map(plan.manifest.games.map((game) => [game.providerGameId, game]));
    const inserted: Array<{ sessionId: string; matchId: string; matchGameId: string; blueTeamId: string; redTeamId: string }> = [];
    const backup = {
      operationId: definition.applyOperationId,
      batchId: plan.manifest.batchId ?? null,
      fingerprint: plan.public.fingerprint,
      capturedAt: new Date().toISOString(),
      beforePlayers: plan.beforePlayers,
      beforeStats: plan.beforeStats,
    };
    for (const mode of plan.gameModes.filter((row) => row.mode === "INSERT")) {
      const game = mode.game;
      const sessionId = randomUUID();
      const label = gameLabel(game, definition);
      const blueProviderTeamId = game.participants.some((participant) => participant.teamId === "100")
        ? "100" : unique(game.participants.map((participant) => participant.teamId)).sort()[0];
      const blueWon = game.winnerTeamId === blueProviderTeamId;
      const blueTeam = await tx.team.create({ data: { name: `${definition.labelPrefix} ${sessionId.slice(0, 8)} BLUE` } });
      const redTeam = await tx.team.create({ data: { name: `${definition.labelPrefix} ${sessionId.slice(0, 8)} RED` } });
      const match = await tx.match.create({ data: {
        stage: "REGULAR_SEASON", roundLabel: label, matchLabel: label, bestOf: 1,
        scheduledAt: game.playedAt, status: "COMPLETED", homeTeamId: blueTeam.id, awayTeamId: redTeam.id,
        winnerTeamId: blueWon ? blueTeam.id : redTeam.id, homeScore: blueWon ? 1 : 0, awayScore: blueWon ? 0 : 1,
        createdAt: game.playedAt,
      } });
      const raw = rawGames.get(game.providerGameId)!;
      const blueRows = game.participants.filter((participant) => participant.teamId === blueProviderTeamId);
      const redRows = game.participants.filter((participant) => participant.teamId !== blueProviderTeamId);
      const matchGame = await tx.matchGame.create({ data: {
        matchId: match.id, gameNumber: 1, winnerTeamId: blueWon ? blueTeam.id : redTeam.id,
        durationSeconds: game.durationSeconds,
        homeKills: blueRows.reduce((sum, row) => sum + row.kills, 0), awayKills: redRows.reduce((sum, row) => sum + row.kills, 0),
        homeGold: blueRows.reduce((sum, row) => sum + row.gold, 0), awayGold: redRows.reduce((sum, row) => sum + row.gold, 0),
        mvpName: null,
        ocrRawJson: asJson({
          source: definition.source, operationId: definition.applyOperationId,
          batchId: plan.manifest.batchId ?? null,
          recentMatch: raw.game, detail: raw.detail,
          ownerAuthorizedUnregisteredFillerSlots: game.ownerAuthorizedUnregisteredFillerSlots,
          excludedObservedIdentityHashes: game.participants.filter((participant) => !plan.resolved.has(participant.identityKey)).map((participant) => hash(participant.identityKey)),
        }),
        createdAt: game.playedAt,
      } });
      const eligible = game.participants.flatMap((participant) => {
        const identity = plan.resolved.get(participant.identityKey);
        return identity ? [{ participant, identity }] : [];
      });
      await tx.inhouseSession.create({ data: {
        id: sessionId, status: "COMPLETED", gameLabel: label,
        sourceChannelId: definition.sessionChannelPrefix,
        blueChannelId: `${definition.sessionChannelPrefix}_BLUE`,
        redChannelId: `${definition.sessionChannelPrefix}_RED`,
        blueTeamId: blueTeam.id, redTeamId: redTeam.id, matchId: match.id, matchGameId: matchGame.id,
        lzyumiGameId: game.providerGameId, reportedByKookId: "ADMIN",
        reportRawJson: asJson({
          source: definition.source, operationId: definition.applyOperationId,
          batchId: plan.manifest.batchId ?? null,
          playedAt: game.playedAt.toISOString(), notify: false,
          ...(inserted.length === 0 ? { recoveryBackup: backup } : {}),
        }),
        createdAt: game.playedAt, completedAt: game.playedAt,
        players: { create: eligible.map(({ participant, identity }) => {
          const projection = newProjectionByKey.get(`${game.sequence}:${participant.identityKey}`)!;
          return {
            kookUserId: identity.profile.kookId!, profileId: identity.profile.id, playerId: identity.player.id,
            displayName: identity.profile.displayName, riotName: identity.profile.riotName,
            riotTag: normalizeRiotTag(identity.profile.riotTag) || null, email: identity.profile.email,
            side: participant.teamId === blueProviderTeamId ? "BLUE" : "RED", eloAtReady: projection.eloBefore,
            createdAt: game.playedAt,
          };
        }) },
      } });
      await tx.matchGamePlayerStat.createMany({ data: eligible.map(({ participant, identity }) => {
        const projection = newProjectionByKey.get(`${game.sequence}:${participant.identityKey}`)!;
        return {
          matchGameId: matchGame.id, playerId: identity.player.id,
          teamId: participant.teamId === blueProviderTeamId ? blueTeam.id : redTeam.id,
          riotName: identity.profile.riotName, riotTag: normalizeRiotTag(identity.profile.riotTag) || null,
          kills: participant.kills, deaths: participant.deaths, assists: participant.assists,
          gold: participant.gold, damage: participant.damage, isWin: participant.isWin,
          isMVP: participant.isMVP, isSVP: participant.isSVP,
          lpChange: projection.lpChange, eloBefore: projection.eloBefore, eloAfter: projection.eloAfter,
          createdAt: game.playedAt,
        };
      }) });
      inserted.push({ sessionId, matchId: match.id, matchGameId: matchGame.id, blueTeamId: blueTeam.id, redTeamId: redTeam.id });
    }
    const beforeStatById = new Map(plan.beforeStats.map((row) => [row.id, row]));
    for (const projection of plan.projected.filter((row) => {
      if (row.kind !== "existing") return false;
      const before = beforeStatById.get(row.existingId!);
      return !before || before.lpChange !== row.lpChange || before.eloBefore !== row.eloBefore || before.eloAfter !== row.eloAfter;
    })) {
      await tx.matchGamePlayerStat.update({
        where: { id: projection.existingId! },
        data: { lpChange: projection.lpChange, eloBefore: projection.eloBefore, eloAfter: projection.eloAfter },
      });
    }
    for (const [playerId, state] of plan.finalStates) {
      await tx.player.update({ where: { id: playerId }, data: state });
    }
    return {
      status: "APPLIED" as const,
      operationId: definition.applyOperationId,
      fingerprint: plan.public.fingerprint,
      notify: false,
      insertedGames: inserted.length,
      alreadyPresentGames: plan.public.summary.alreadyPresentGames,
      insertedStatRows: plan.public.summary.eligibleStatRowsToInsert,
      replayedExistingStatRows: plan.public.summary.existingSeasonStatsReplayed,
      affectedPlayers: plan.public.summary.affectedPlayers,
      inserted,
    };
  }, { maxWait: 10_000, timeout: 240_000 });
}

export async function applyRankedInhouseRecovery(value: unknown, expectedFingerprint: string) {
  return applyRankedInhouseImport(value, expectedFingerprint, DATED_RECOVERY_IMPORT_DEFINITION);
}
