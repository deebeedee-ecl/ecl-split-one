import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { calculateLpChange, STARTING_ELO } from "./elo";
import { INHOUSE_MATCH_FILTER } from "./inhouse-filter";
import { getRankedSeason, loadRankedSeasonStates } from "./ranked-season";
import {
  normalizeRiotPart,
  normalizeRiotTag,
  riotIdKey,
  splitRiotId,
} from "./riot-id";

export const RECOVERY_OPERATION = "ranked-inhouse-recovery-2026-11-15-to-17-review-v1";
export const RECOVERY_TARGET = "deebeedee-ecl/ecl-split-one";
export const RECOVERY_DATABASE_URL_ENV = "ECL_RANKED_INHOUSE_RECOVERY_DATABASE_URL";
export const RECOVERY_PRODUCTION_ENDPOINT = "https://eclchina.lol/api/jobs/inhouse-recovery-2026-11-15-to-17/preflight";
export const SUPPORTED_ACTIONS = ["prepare", "dry-run"] as const;

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const CANCELLED_JOB_STATUSES = [
  "CANCELLED",
  "DESKTOP_CANCELLED",
  "DESKTOP_EXPIRED",
  "DESKTOP_REJECTED",
] as const;

export type RecoveryScope = {
  sinceChinaDay: string;
  untilChinaDay: string;
  expectedGameCount: number;
  providerSetHash: string;
};

export type RecoveryManifestDefinition = {
  reviewOperationId: string;
  target: string;
  allowKiwiForAuthorizedPartial: boolean;
};

export const DATED_RECOVERY_MANIFEST_DEFINITION: RecoveryManifestDefinition = {
  reviewOperationId: RECOVERY_OPERATION,
  target: RECOVERY_TARGET,
  allowKiwiForAuthorizedPartial: true,
};

export const RECOVERY_SCOPE: RecoveryScope = {
  sinceChinaDay: "2026-11-15",
  untilChinaDay: "2026-11-17",
  expectedGameCount: 12,
  providerSetHash: "409ed63e0782fd0ed5970c712d3cc91e5fffb49e2a938e928d931ca60464b6cf",
};

type JsonObject = Record<string, unknown>;

export type ReviewGame = {
  sequence: number;
  providerGameId: string;
  playedAt: string;
  durationSeconds: number | null;
  evidenceStatus: "COMPLETE_10_OF_10" | "AUTHORIZED_REGISTERED_PARTICIPANTS_ONLY" | "PARTIAL_DETAIL";
  ownerAuthorizedUnregisteredFillerSlots: number;
  allowProviderModeKiwi?: boolean;
  discoveryStatus: string;
  discoveryReasons: string[];
  game: JsonObject;
  detail: JsonObject | null;
};

export type RecoveryReviewManifest = {
  operationId: string;
  batchId?: string;
  target: string;
  readOnly: true;
  notify: false;
  source: {
    kind: "lzyumi-read-only-discovery";
    discoveryGeneratedAt: string;
    discoveryFingerprint: string;
  };
  scope: RecoveryScope;
  operatorReview: {
    confirmedAsRankedInhouseCandidates: true;
    approvedUnregisteredParticipants?: true;
    confirmedAt: string;
    note: string;
  };
  games: ReviewGame[];
};

export type ParsedParticipant = {
  riotName: string;
  riotTag: string;
  identityKey: string;
  openId: string;
  areaId: number;
  teamId: string;
  isWin: boolean;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  damage: number;
  isMVP: boolean;
  isSVP: boolean;
};

export type ParsedGame = {
  sequence: number;
  providerGameId: string;
  playedAt: Date;
  durationSeconds: number | null;
  evidenceStatus: ReviewGame["evidenceStatus"];
  ownerAuthorizedUnregisteredFillerSlots: number;
  participants: ParsedParticipant[];
  winnerTeamId: string | null;
};

export type RecoveryDryRun = {
  readOnly: true;
  applyAvailable: false;
  clean: boolean;
  fingerprint: string;
  blockers: string[];
  warnings: string[];
  summary: {
    operationId: string;
    gameCount: number;
    completeGames: number;
    partialGames: number;
    completeParticipantRows: number;
    observedParticipantRows: number;
    authorizedUnregisteredFillerSlots: number;
    databaseChecked: boolean;
    existingSessionCollisions: number | null;
    legacyGameCollisions: number | null;
    reportJobCollisions: number | null;
    tournamentCollisions: number | null;
    tournamentCollectionCollisions: number | null;
    resolvedProfiles: number | null;
    resolvedPlayers: number | null;
    excludedObservedParticipants: number | null;
    laterRankedResults: number | null;
    projectedStatRows: number | null;
    projectedLpDelta: number | null;
  };
  games: Array<{
    sequence: number;
    chinaTime: string;
    durationSeconds: number | null;
    evidenceStatus: ReviewGame["evidenceStatus"];
    participantCount: number;
    authorizedUnregisteredFillerSlots: number;
    eligibleParticipantCount: number | null;
    projectedBlueLpDelta: number | null;
    projectedRedLpDelta: number | null;
  }>;
};

type ResolvedIdentity = {
  participant: ParsedParticipant;
  profile: {
    id: string;
    email: string;
    riotName: string;
    riotTag: string;
    chinaServerId: number | null;
    openId: string | null;
    kookId: string | null;
    verificationStatus: string;
    accountStatus: string;
  };
  player: {
    id: string;
    elo: number;
    winStreak: number;
    lossStreak: number;
  };
};

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}
function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteInteger(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function chinaDay(value: Date) {
  const china = new Date(value.getTime() + CHINA_OFFSET_MS);
  return `${china.getUTCFullYear()}-${String(china.getUTCMonth() + 1).padStart(2, "0")}-${String(china.getUTCDate()).padStart(2, "0")}`;
}

function chinaTime(value: Date) {
  const china = new Date(value.getTime() + CHINA_OFFSET_MS);
  return `${chinaDay(value)} ${String(china.getUTCHours()).padStart(2, "0")}:${String(china.getUTCMinutes()).padStart(2, "0")}`;
}

function parseProviderTime(game: JsonObject, reference: Date) {
  const raw = `${optionalText(game.titleTime)} ${optionalText(game.title)}`;
  const match = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const referenceChina = new Date(reference.getTime() + CHINA_OFFSET_MS);
  return new Date(Date.UTC(
    referenceChina.getUTCFullYear(),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[3]) - 8,
    Number(match[4]),
    Number(match[5] || 0),
  ));
}

function parseDurationSeconds(game: JsonObject) {
  const match = optionalText(game.title).match(/用时(\d+)分(?:(\d+)秒)?/u);
  return match ? Number(match[1]) * 60 + Number(match[2] || 0) : null;
}

function score(value: unknown, label: string) {
  const match = typeof value === "string" ? value.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/) : null;
  if (!match) throw new Error(`${label} must expose a K/D/A line.`);
  return { kills: Number(match[1]), deaths: Number(match[2]), assists: Number(match[3]) };
}

function providerPlayerWon(value: unknown) {
  return ["1", "true", "win"].includes(String(value ?? "").trim().toLowerCase());
}

function parseParticipant(value: unknown, label: string): ParsedParticipant {
  const input = object(value, label);
  const riotId = requiredText(input.nickNameStr || input.nickName, `${label}.riotId`);
  const parts = splitRiotId(riotId);
  const riotName = normalizeRiotPart(parts.riotName);
  const riotTag = normalizeRiotTag(parts.riotTag);
  const identityKey = riotIdKey(riotName, riotTag);
  if (!riotName || !riotTag || !identityKey) throw new Error(`${label} must use a full Riot ID.`);
  const openId = requiredText(input.openIdNow || input.openId, `${label}.openId`);
  const areaId = finiteInteger(
    input.translateAreaId ?? input.translate_areaId ?? input.original_area_id ?? input.areaId,
  );
  if (areaId !== 1) throw new Error(`${label} is not verified as an Ionia participant.`);
  const teamId = requiredText(input.teamId, `${label}.teamId`);
  return {
    riotName,
    riotTag,
    identityKey,
    openId,
    areaId,
    teamId,
    isWin: providerPlayerWon(input.win),
    ...score(input.scoreInfo, `${label}.scoreInfo`),
    gold: finiteInteger((input.echartsMap as JsonObject | undefined)?.goldEarned ?? input.goldEarned),
    damage: finiteInteger((input.echartsMap as JsonObject | undefined)?.totalDamageDealt ?? input.totalDamageDealt),
    isMVP: String(input.wasMvp ?? "") === "1",
    isSVP: String(input.wasSvp ?? "") === "1",
  };
}

function assertScope(ids: string[], scope: RecoveryScope) {
  if (ids.length !== scope.expectedGameCount || new Set(ids).size !== scope.expectedGameCount) {
    throw new Error(`Recovery scope requires exactly ${scope.expectedGameCount} unique provider games.`);
  }
  if (hash([...ids].sort()) !== scope.providerSetHash) {
    throw new Error("Provider game set does not match the authorized recovery scope.");
  }
}

function assertChinaWindow(value: Date, scope: RecoveryScope, label: string) {
  const day = chinaDay(value);
  if (day < scope.sinceChinaDay || day > scope.untilChinaDay) {
    throw new Error(`${label} is outside the authorized China-date window.`);
  }
}

function completeDetailPlayers(detail: unknown) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const data = (detail as JsonObject).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const players = (data as JsonObject).wgBattleDetailInfo;
  return Array.isArray(players) && players.length === 10 ? players : null;
}

function observedDetailPlayers(detail: unknown) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const data = (detail as JsonObject).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const players = (data as JsonObject).wgBattleDetailInfo;
  return Array.isArray(players) && players.length >= 1 && players.length <= 10 ? players : null;
}

export function buildReviewManifest(
  value: unknown,
  scope: RecoveryScope = RECOVERY_SCOPE,
  now = new Date(),
): RecoveryReviewManifest {
  const discovery = object(value, "discovery");
  if (discovery.readOnly !== true || !Array.isArray(discovery.candidates)) {
    throw new Error("Input must be a read-only discovery artifact.");
  }
  const candidates = discovery.candidates.map((candidate, index) => {
    const input = object(candidate, `candidates[${index}]`);
    const raw = object(input.raw, `candidates[${index}].raw`);
    const game = object(raw.game, `candidates[${index}].raw.game`);
    const providerGameId = requiredText(input.gameId, `candidates[${index}].gameId`);
    if (requiredText(game.gameId, `candidates[${index}].raw.game.gameId`) !== providerGameId) {
      throw new Error(`Candidate ${index + 1} provider ID does not match its history evidence.`);
    }
    const playedAt = new Date(requiredText(input.gameTime, `candidates[${index}].gameTime`));
    if (!Number.isFinite(playedAt.getTime())) throw new Error(`Candidate ${index + 1} has an invalid time.`);
    assertChinaWindow(playedAt, scope, `Candidate ${index + 1}`);
    if (input.reviewStatus === "EXCLUDE_TOURNAMENT" || input.excludedCompetition) {
      throw new Error(`Candidate ${index + 1} is marked as a tournament game.`);
    }
    const detail = raw.detail && typeof raw.detail === "object" && !Array.isArray(raw.detail)
      ? raw.detail as JsonObject
      : null;
    const observedPlayers = observedDetailPlayers(detail);
    const recoveryEvidence = input.recoveryEvidence && typeof input.recoveryEvidence === "object" && !Array.isArray(input.recoveryEvidence)
      ? input.recoveryEvidence as JsonObject
      : null;
    const authorizedFillerSlots = finiteInteger(recoveryEvidence?.ownerAuthorizedUnregisteredFillerSlots);
    const authorizedPartial = Boolean(
      observedPlayers
      && observedPlayers.length < 10
      && discovery.recoveryOperationId === "ranked-inhouse-recovery-2026-11-15-to-17-partial-detail-v1"
      && authorizedFillerSlots === 10 - observedPlayers.length,
    );
    return {
      sequence: index + 1,
      providerGameId,
      playedAt: playedAt.toISOString(),
      durationSeconds: parseDurationSeconds(game),
      evidenceStatus: completeDetailPlayers(detail)
        ? "COMPLETE_10_OF_10" as const
        : authorizedPartial ? "AUTHORIZED_REGISTERED_PARTICIPANTS_ONLY" as const : "PARTIAL_DETAIL" as const,
      ownerAuthorizedUnregisteredFillerSlots: authorizedPartial ? authorizedFillerSlots : 0,
      discoveryStatus: optionalText(input.reviewStatus) || "UNKNOWN",
      discoveryReasons: Array.isArray(input.reasons)
        ? input.reasons.filter((reason): reason is string => typeof reason === "string")
        : [],
      game,
      detail,
    };
  }).sort((left, right) => left.playedAt.localeCompare(right.playedAt));
  assertScope(candidates.map((candidate) => candidate.providerGameId), scope);
  return {
    operationId: RECOVERY_OPERATION,
    target: RECOVERY_TARGET,
    readOnly: true,
    notify: false,
    source: {
      kind: "lzyumi-read-only-discovery",
      discoveryGeneratedAt: requiredText(discovery.generatedAt, "discovery.generatedAt"),
      discoveryFingerprint: hash(discovery),
    },
    scope: { ...scope },
    operatorReview: {
      confirmedAsRankedInhouseCandidates: true,
      confirmedAt: now.toISOString(),
      note: "Owner confirmed the post-14-November custom-game clusters as ranked-inhouse recovery candidates; database and identity checks remain mandatory.",
    },
    games: candidates,
  };
}

function parseManifest(
  value: unknown,
  scope: RecoveryScope,
  definition: RecoveryManifestDefinition,
): { manifest: RecoveryReviewManifest; games: ParsedGame[]; blockers: string[]; warnings: string[] } {
  const manifest = object(value, "manifest") as unknown as RecoveryReviewManifest;
  if (manifest.operationId !== definition.reviewOperationId || manifest.target !== definition.target) {
    throw new Error("Manifest targets a different ranked-inhouse import operation.");
  }
  if (manifest.readOnly !== true || manifest.notify !== false) {
    throw new Error("Recovery review manifests must remain read-only with notifications disabled.");
  }
  if (manifest.operatorReview?.confirmedAsRankedInhouseCandidates !== true) {
    throw new Error("The operator has not confirmed this exact candidate scope.");
  }
  if (!Array.isArray(manifest.games)) throw new Error("manifest.games must be an array.");
  assertScope(manifest.games.map((game) => requiredText(game.providerGameId, "providerGameId")), scope);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const games = manifest.games.map((game, index): ParsedGame => {
    const sequence = index + 1;
    const playedAt = new Date(game.playedAt);
    if (!Number.isFinite(playedAt.getTime())) throw new Error(`Game ${sequence} has an invalid playedAt.`);
    assertChinaWindow(playedAt, scope, `Game ${sequence}`);
    if (requiredText(game.game?.gameId, `Game ${sequence} history ID`) !== game.providerGameId) {
      throw new Error(`Game ${sequence} provider ID does not match its history evidence.`);
    }
    const providerTime = parseProviderTime(game.game, playedAt);
    if (!providerTime || Math.abs(providerTime.getTime() - playedAt.getTime()) > 2_000) {
      throw new Error(`Game ${sequence} time does not match provider evidence.`);
    }
    const rawPlayers = observedDetailPlayers(game.detail);
    if (!rawPlayers) {
      blockers.push(`GAME_${sequence}_DETAIL_INCOMPLETE`);
      return {
        sequence,
        providerGameId: game.providerGameId,
        playedAt,
        durationSeconds: game.durationSeconds,
        evidenceStatus: "PARTIAL_DETAIL",
        ownerAuthorizedUnregisteredFillerSlots: 0,
        participants: [],
        winnerTeamId: null,
      };
    }
    const authorizedFillerSlots = finiteInteger(game.ownerAuthorizedUnregisteredFillerSlots);
    const isAuthorizedPartial = game.evidenceStatus === "AUTHORIZED_REGISTERED_PARTICIPANTS_ONLY"
      && authorizedFillerSlots === 10 - rawPlayers.length
      && authorizedFillerSlots > 0;
    if (rawPlayers.length < 10 && !isAuthorizedPartial) blockers.push(`GAME_${sequence}_DETAIL_INCOMPLETE`);
    const detailData = object(object(game.detail, `Game ${sequence} detail`).data, `Game ${sequence} detail.data`);
    if (detailData.gameType !== "CUSTOM_GAME") blockers.push(`GAME_${sequence}_NOT_STRUCTURED_CUSTOM`);
    if (detailData.gameMode !== "CLASSIC") {
      if (
        isAuthorizedPartial
        && detailData.gameMode === "KIWI"
        && (definition.allowKiwiForAuthorizedPartial || game.allowProviderModeKiwi === true)
      ) {
        warnings.push(`GAME_${sequence}_PROVIDER_MODE_KIWI_OWNER_CONFIRMED`);
      } else {
        blockers.push(`GAME_${sequence}_NOT_CLASSIC`);
      }
    }
    let participants: ParsedParticipant[] = [];
    try {
      participants = rawPlayers.map((player, playerIndex) => parseParticipant(player, `Game ${sequence} player ${playerIndex + 1}`));
    } catch {
      blockers.push(`GAME_${sequence}_PARTICIPANT_EVIDENCE_INVALID`);
    }
    if (participants.length === rawPlayers.length) {
      if (new Set(participants.map((participant) => participant.identityKey)).size !== participants.length) {
        blockers.push(`GAME_${sequence}_DUPLICATE_RIOT_IDENTITY`);
      }
      if (new Set(participants.map((participant) => participant.openId)).size !== participants.length) {
        blockers.push(`GAME_${sequence}_DUPLICATE_OPEN_ID`);
      }
      const teams = unique(participants.map((participant) => participant.teamId));
      const exactCompleteTeams = participants.length === 10
        && teams.length === 2
        && teams.every((teamId) => participants.filter((participant) => participant.teamId === teamId).length === 5);
      const coherentObservedTeams = isAuthorizedPartial
        && teams.length === 2
        && teams.every((teamId) => participants.some((participant) => participant.teamId === teamId));
      if (!exactCompleteTeams && !coherentObservedTeams) {
        blockers.push(`GAME_${sequence}_NOT_EXACT_5V5`);
      }
      const winners = participants.filter((participant) => participant.isWin);
      const winnerTeams = unique(winners.map((participant) => participant.teamId));
      const loserTeams = unique(participants.filter((participant) => !participant.isWin).map((participant) => participant.teamId));
      const completeWinner = participants.length === 10 && winners.length === 5 && winnerTeams.length === 1;
      const coherentObservedWinner = isAuthorizedPartial
        && winners.length > 0
        && winnerTeams.length === 1
        && loserTeams.length === 1
        && loserTeams[0] !== winnerTeams[0];
      if (!completeWinner && !coherentObservedWinner) blockers.push(`GAME_${sequence}_WINNER_INVALID`);
      if (game.durationSeconds === null) warnings.push(`GAME_${sequence}_DURATION_UNAVAILABLE`);
      return {
        sequence,
        providerGameId: game.providerGameId,
        playedAt,
        durationSeconds: game.durationSeconds,
        evidenceStatus: participants.length === 10 ? "COMPLETE_10_OF_10" : "AUTHORIZED_REGISTERED_PARTICIPANTS_ONLY",
        ownerAuthorizedUnregisteredFillerSlots: isAuthorizedPartial ? authorizedFillerSlots : 0,
        participants,
        winnerTeamId: winnerTeams.length === 1 ? winnerTeams[0] : null,
      };
    }
    return {
      sequence,
      providerGameId: game.providerGameId,
      playedAt,
      durationSeconds: game.durationSeconds,
      evidenceStatus: "COMPLETE_10_OF_10",
      ownerAuthorizedUnregisteredFillerSlots: 0,
      participants,
      winnerTeamId: null,
    };
  }).sort((left, right) => left.playedAt.getTime() - right.playedAt.getTime());
  return { manifest, games, blockers: unique(blockers), warnings: unique(warnings) };
}

export function parseRecoveryReviewManifest(
  value: unknown,
  scope: RecoveryScope = RECOVERY_SCOPE,
  definition: RecoveryManifestDefinition = DATED_RECOVERY_MANIFEST_DEFINITION,
) {
  return parseManifest(value, scope, definition);
}

function jsonGameIdPaths(gameId: string): Prisma.MatchGameWhereInput[] {
  return [
    ["gameId"],
    ["raw", "gameId"],
    ["recentMatch", "gameId"],
    ["raw", "recentMatch", "gameId"],
  ].map((jsonPath) => ({ ocrRawJson: { path: jsonPath, equals: gameId } }));
}

function reportJobGameIdPaths(gameId: string): Prisma.InhouseReportJobWhereInput[] {
  return [
    ["gameId"],
    ["rawMatchData", "gameId"],
    ["recentMatch", "gameId"],
  ].map((jsonPath) => ({ rawMatchData: { path: jsonPath, equals: gameId } }));
}

function tournamentProviderIdPaths(gameId: string): Prisma.TournamentReportWhereInput[] {
  return [
    ["providerGameId"],
    ["evidence", "providerGameId"],
  ].map((jsonPath) => ({ raw: { path: jsonPath, equals: gameId } }));
}

function baseDryRun(
  manifest: RecoveryReviewManifest,
  games: ParsedGame[],
  blockers: string[],
  warnings: string[],
  databaseChecked: boolean,
): RecoveryDryRun {
  const completeGames = games.filter((game) => game.evidenceStatus === "COMPLETE_10_OF_10");
  const safeBlockers = databaseChecked ? blockers : [...blockers, "DATABASE_PREFLIGHT_NOT_RUN"];
  return {
    readOnly: true,
    applyAvailable: false,
    clean: safeBlockers.length === 0,
    fingerprint: hash({ manifest, databaseChecked, blockers: safeBlockers }),
    blockers: unique(safeBlockers),
    warnings,
    summary: {
      operationId: manifest.operationId,
      gameCount: games.length,
      completeGames: completeGames.length,
      partialGames: games.length - completeGames.length,
      completeParticipantRows: completeGames.reduce((sum, game) => sum + game.participants.length, 0),
      observedParticipantRows: games.reduce((sum, game) => sum + game.participants.length, 0),
      authorizedUnregisteredFillerSlots: games.reduce((sum, game) => sum + game.ownerAuthorizedUnregisteredFillerSlots, 0),
      databaseChecked,
      existingSessionCollisions: null,
      legacyGameCollisions: null,
      reportJobCollisions: null,
      tournamentCollisions: null,
      tournamentCollectionCollisions: null,
      resolvedProfiles: null,
      resolvedPlayers: null,
      excludedObservedParticipants: null,
      laterRankedResults: null,
      projectedStatRows: null,
      projectedLpDelta: null,
    },
    games: games.map((game) => ({
      sequence: game.sequence,
      chinaTime: chinaTime(game.playedAt),
      durationSeconds: game.durationSeconds,
      evidenceStatus: game.evidenceStatus,
      participantCount: game.participants.length,
      authorizedUnregisteredFillerSlots: game.ownerAuthorizedUnregisteredFillerSlots,
      eligibleParticipantCount: null,
      projectedBlueLpDelta: null,
      projectedRedLpDelta: null,
    })),
  };
}

export function offlineDryRun(value: unknown, scope: RecoveryScope = RECOVERY_SCOPE): RecoveryDryRun {
  const parsed = parseManifest(value, scope, DATED_RECOVERY_MANIFEST_DEFINITION);
  return baseDryRun(parsed.manifest, parsed.games, parsed.blockers, parsed.warnings, false);
}

export async function databaseDryRun(value: unknown, db: PrismaClient, scope: RecoveryScope = RECOVERY_SCOPE): Promise<RecoveryDryRun> {
  const parsed = parseManifest(value, scope, DATED_RECOVERY_MANIFEST_DEFINITION);
  const blockers = [...parsed.blockers];
  const warnings = [...parsed.warnings];
  const providerGameIds = parsed.games.map((game) => game.providerGameId);
  const [sessions, legacyGames, reportJobs, tournamentReports, collectionJobs] = await Promise.all([
    db.inhouseSession.findMany({
      where: { lzyumiGameId: { in: providerGameIds } },
      select: { id: true, lzyumiGameId: true, status: true, matchId: true, matchGameId: true },
    }),
    db.matchGame.findMany({
      where: { OR: providerGameIds.flatMap(jsonGameIdPaths) },
      select: { id: true },
    }),
    db.inhouseReportJob.findMany({
      where: {
        status: { notIn: [...CANCELLED_JOB_STATUSES] },
        OR: providerGameIds.flatMap(reportJobGameIdPaths),
      },
      select: { id: true },
    }),
    db.tournamentReport.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          { leagueGameId: { in: providerGameIds } },
          ...providerGameIds.flatMap(tournamentProviderIdPaths),
        ],
      },
      select: { id: true },
    }),
    db.tournamentCollectionJob.findMany({
      where: { leagueGameId: { in: providerGameIds } },
      select: { id: true },
    }),
  ]);
  if (sessions.length) blockers.push("EXISTING_INHOUSE_SESSION_COLLISION");
  if (legacyGames.length) blockers.push("EXISTING_MATCH_GAME_COLLISION");
  if (reportJobs.length) blockers.push("EXISTING_REPORT_JOB_COLLISION");
  if (tournamentReports.length) blockers.push("TOURNAMENT_REPORT_COLLISION");
  if (collectionJobs.length) blockers.push("TOURNAMENT_COLLECTION_COLLISION");

  const completeParticipants = parsed.games.flatMap((game) => game.participants);
  const participantsByIdentity = new Map<string, ParsedParticipant>();
  for (const participant of completeParticipants) participantsByIdentity.set(participant.identityKey, participant);
  const identities = [...participantsByIdentity.values()];
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
      id: true,
      email: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      openId: true,
      kookId: true,
      verificationStatus: true,
      accountStatus: true,
    },
  }) : [];
  const profilesByIdentity = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const key = riotIdKey(profile.riotName, profile.riotTag);
    if (key) profilesByIdentity.set(key, [...(profilesByIdentity.get(key) ?? []), profile]);
  }
  const selectedProfiles: Array<{ participant: ParsedParticipant; profile: typeof profiles[number] }> = [];
  const excludedIdentityKeys = new Set<string>();
  for (const participant of identities) {
    const openIdMatches = profiles.filter((profile) =>
      profile.openId === participant.openId && profile.chinaServerId === participant.areaId,
    );
    const riotMatches = profilesByIdentity.get(participant.identityKey) ?? [];
    const stableMatches = openIdMatches.length > 0
      ? openIdMatches
      : riotMatches.filter((profile) =>
          profile.openId === participant.openId && profile.chinaServerId === participant.areaId,
        );
    const eligibleMatches = stableMatches.filter((profile) =>
      Boolean(profile.kookId)
      && profile.verificationStatus === "VERIFIED"
      && profile.accountStatus === "ACTIVE",
    );
    if (stableMatches.length === 0 || eligibleMatches.length === 0) {
      excludedIdentityKeys.add(participant.identityKey);
      continue;
    }
    if (eligibleMatches.length !== 1) {
      blockers.push("PROFILE_RESOLUTION_MISMATCH");
      continue;
    }
    const profile = eligibleMatches[0];
    if (profile.chinaServerId !== participant.areaId || !profile.openId || profile.openId !== participant.openId) {
      excludedIdentityKeys.add(participant.identityKey);
      continue;
    }
    if (!profile.kookId || profile.verificationStatus !== "VERIFIED" || profile.accountStatus !== "ACTIVE") {
      excludedIdentityKeys.add(participant.identityKey);
      continue;
    }
    if (riotIdKey(profile.riotName, profile.riotTag) !== participant.identityKey) {
      warnings.push("PROFILE_RIOT_ID_RENAMED_MATCHED_BY_OPEN_ID");
    }
    selectedProfiles.push({ participant, profile });
  }
  if (excludedIdentityKeys.size) warnings.push("OWNER_AUTHORIZED_UNREGISTERED_PARTICIPANTS_EXCLUDED");
  if (new Set(selectedProfiles.map(({ profile }) => profile.id)).size !== selectedProfiles.length) {
    blockers.push("PROFILE_NOT_UNIQUE");
  }
  if (new Set(selectedProfiles.map(({ profile }) => profile.kookId).filter(Boolean)).size !== selectedProfiles.length) {
    blockers.push("KOOK_ID_NOT_UNIQUE");
  }

  const playerRows = selectedProfiles.length ? await db.player.findMany({
    where: {
      OR: selectedProfiles.flatMap(({ profile }) => [
        {
          riotName: { equals: profile.riotName, mode: "insensitive" as const },
          riotTag: { equals: profile.riotTag, mode: "insensitive" as const },
        },
        { email: { equals: profile.email, mode: "insensitive" as const } },
      ]),
    },
    select: { id: true, riotName: true, riotTag: true, email: true, elo: true, winStreak: true, lossStreak: true },
  }) : [];
  const resolved = new Map<string, ResolvedIdentity>();
  for (const selected of selectedProfiles) {
    const candidates = playerRows.filter((player) => {
      const riotMatch = riotIdKey(player.riotName, player.riotTag) === selected.participant.identityKey;
      const emailMatch = Boolean(player.email && selected.profile.email && player.email.toLowerCase() === selected.profile.email.toLowerCase());
      return riotMatch || emailMatch;
    });
    const distinct = [...new Map(candidates.map((player) => [player.id, player])).values()];
    if (distinct.length !== 1 || riotIdKey(distinct[0]?.riotName, distinct[0]?.riotTag) !== selected.participant.identityKey) {
      blockers.push("PLAYER_RESOLUTION_MISMATCH");
      continue;
    }
    resolved.set(selected.participant.identityKey, {
      participant: selected.participant,
      profile: selected.profile,
      player: distinct[0],
    });
  }
  if (new Set([...resolved.values()].map(({ player }) => player.id)).size !== resolved.size) {
    blockers.push("PLAYER_NOT_UNIQUE");
  }

  const playerIds = unique([...resolved.values()].map(({ player }) => player.id));
  const firstPlayedAt = parsed.games[0]?.playedAt;
  const laterStats = playerIds.length && firstPlayedAt ? await db.matchGamePlayerStat.findMany({
    where: {
      ...INHOUSE_MATCH_FILTER,
      playerId: { in: playerIds },
      createdAt: { gt: firstPlayedAt },
    },
    select: { id: true },
  }) : [];
  if (laterStats.length) blockers.push("LATER_RANKED_RESULTS_REQUIRE_REPLAY");

  const season = getRankedSeason();
  if (!season) blockers.push("ACTIVE_RANKED_SEASON_MISSING");
  if (season && parsed.games.some((game) => game.playedAt < season.startedAt)) {
    blockers.push("GAME_PREDATES_ACTIVE_RANKED_SEASON");
  }

  const projectionBlockers = new Set([
    ...blockers,
    ...(parsed.games.some((game) => game.participants.length + game.ownerAuthorizedUnregisteredFillerSlots !== 10) ? ["INCOMPLETE_GAME"] : []),
    ...(resolved.size !== selectedProfiles.length ? ["UNRESOLVED_ELIGIBLE_IDENTITY"] : []),
  ]);
  const projectedGames = new Map<number, { blue: number; red: number; rows: number }>();
  let projectedLpDelta: number | null = null;
  let projectedStatRows: number | null = null;
  let seasonStatsForFingerprint: Array<{ id: string; playerId: string; createdAt: Date; isWin: boolean; lpChange: number }> = [];
  if (projectionBlockers.size === 0 && season) {
    const states = await loadRankedSeasonStates(playerIds, season, db);
    seasonStatsForFingerprint = playerIds.length ? await db.matchGamePlayerStat.findMany({
      where: { ...INHOUSE_MATCH_FILTER, playerId: { in: playerIds }, createdAt: { gte: season.startedAt } },
      select: { id: true, playerId: true, createdAt: true, isWin: true, lpChange: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }) : [];
    const mutable = new Map(playerIds.map((playerId) => {
      const state = states.get(playerId);
      return [playerId, {
        elo: state?.elo ?? STARTING_ELO,
        winStreak: state?.winStreak ?? 0,
        lossStreak: state?.lossStreak ?? 0,
        gamesPlayed: state?.gamesPlayed ?? 0,
        lastPlayedAt: state?.lastPlayedAt ?? null,
        playedChinaDays: new Set((state?.stats ?? []).map((stat) => chinaDay(stat.createdAt))),
      }];
    }));
    let totalLp = 0;
    let totalRows = 0;
    for (const game of parsed.games) {
      const teamIds = unique(game.participants.map((participant) => participant.teamId));
      const blueTeamId = teamIds.includes("100") ? "100" : [...teamIds].sort()[0];
      let blue = 0;
      let red = 0;
      for (const participant of game.participants) {
        const identity = resolved.get(participant.identityKey);
        if (!identity) continue;
        const state = mutable.get(identity.player.id)!;
        const isWin = participant.teamId === game.winnerTeamId;
        const result = calculateLpChange({
          win: isWin,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          isMVP: participant.isMVP,
          isSVP: participant.isSVP,
          currentElo: state.elo,
          gamesPlayed: state.gamesPlayed,
          winStreak: state.winStreak,
          lossStreak: state.lossStreak,
          lastPlayedAt: state.lastPlayedAt,
          playedAt: game.playedAt,
          hasPlayedOnDoubleLpDay: state.playedChinaDays.has(chinaDay(game.playedAt)),
          doubleLpEligible: true,
        });
        state.elo += result.lpChange;
        state.winStreak = isWin ? state.winStreak + 1 : 0;
        state.lossStreak = isWin ? 0 : state.lossStreak + 1;
        state.gamesPlayed += 1;
        state.lastPlayedAt = game.playedAt;
        state.playedChinaDays.add(chinaDay(game.playedAt));
        if (participant.teamId === blueTeamId) blue += result.lpChange;
        else red += result.lpChange;
        totalLp += result.lpChange;
        totalRows += 1;
      }
      projectedGames.set(game.sequence, { blue, red, rows: game.participants.filter((participant) => resolved.has(participant.identityKey)).length });
    }
    projectedLpDelta = totalLp;
    projectedStatRows = totalRows;
  } else {
    warnings.push("LP_PROJECTION_WITHHELD_UNTIL_ALL_BLOCKERS_CLEAR");
  }

  const safeBlockers = unique(blockers);
  const fingerprint = hash({
    manifest: parsed.manifest,
    database: {
      sessionIds: sessions.map((row) => row.id).sort(),
      legacyGameIds: legacyGames.map((row) => row.id).sort(),
      reportJobIds: reportJobs.map((row) => row.id).sort(),
      tournamentReportIds: tournamentReports.map((row) => row.id).sort(),
      collectionJobIds: collectionJobs.map((row) => row.id).sort(),
      resolved: [...resolved.values()].map(({ participant, profile, player }) => ({
        identityKey: participant.identityKey,
        openIdHash: hash(participant.openId),
        profileId: profile.id,
        playerId: player.id,
      })).sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
      excludedIdentityKeyHashes: [...excludedIdentityKeys].map((identityKey) => hash(identityKey)).sort(),
      laterStatIds: laterStats.map((row) => row.id).sort(),
      seasonStats: seasonStatsForFingerprint,
    },
    blockers: safeBlockers,
    projection: { projectedLpDelta, projectedStatRows },
  });
  const result = baseDryRun(parsed.manifest, parsed.games, safeBlockers, unique(warnings), true);
  result.clean = safeBlockers.length === 0;
  result.fingerprint = fingerprint;
  result.summary.existingSessionCollisions = sessions.length;
  result.summary.legacyGameCollisions = legacyGames.length;
  result.summary.reportJobCollisions = reportJobs.length;
  result.summary.tournamentCollisions = tournamentReports.length;
  result.summary.tournamentCollectionCollisions = collectionJobs.length;
  result.summary.resolvedProfiles = selectedProfiles.length;
  result.summary.resolvedPlayers = resolved.size;
  result.summary.excludedObservedParticipants = excludedIdentityKeys.size;
  result.summary.laterRankedResults = laterStats.length;
  result.summary.projectedStatRows = projectedStatRows;
  result.summary.projectedLpDelta = projectedLpDelta;
  result.games = result.games.map((game) => ({
    ...game,
    eligibleParticipantCount: parsed.games
      .find((parsedGame) => parsedGame.sequence === game.sequence)
      ?.participants.filter((participant) => resolved.has(participant.identityKey)).length ?? null,
    projectedBlueLpDelta: projectedGames.get(game.sequence)?.blue ?? null,
    projectedRedLpDelta: projectedGames.get(game.sequence)?.red ?? null,
  }));
  return result;
}
