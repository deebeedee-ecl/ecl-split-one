import { createHash } from "node:crypto";
import {
  type RankedInhouseImportDefinition,
} from "./ranked-inhouse-import";
import {
  type RecoveryReviewManifest,
  type RecoveryScope,
  type ReviewGame,
} from "./ranked-inhouse-recovery-review-2026-11-15-to-17";

export const MANUAL_INHOUSE_IMPORT_REVIEW_OPERATION = "manual-inhouse-import-review-v1";
export const MANUAL_INHOUSE_IMPORT_APPLY_OPERATION = "manual-inhouse-import-v1";
export const MANUAL_INHOUSE_IMPORT_TARGET = "deebeedee-ecl/ecl-split-one";
export const MANUAL_INHOUSE_IMPORT_ENDPOINT = "https://eclchina.lol/api/jobs/manual-inhouse-import";

const MAX_IMPORT_GAMES = 50;
const MAX_WINDOW_DAYS = 31;

type JsonObject = Record<string, unknown>;

export type ManualInhouseImportReview = {
  batchId: string;
  sinceChinaDay: string;
  untilChinaDay: string;
  confirmedAsRankedInhouseCandidates: true;
  approvedUnregisteredParticipants: boolean;
  note?: string;
  games: Array<{
    providerGameId: string;
    ownerAuthorizedUnregisteredFillerSlots?: number;
    allowProviderModeKiwi?: boolean;
  }>;
};

export const MANUAL_INHOUSE_IMPORT_DEFINITION_BASE = {
  reviewOperationId: MANUAL_INHOUSE_IMPORT_REVIEW_OPERATION,
  applyOperationId: MANUAL_INHOUSE_IMPORT_APPLY_OPERATION,
  target: MANUAL_INHOUSE_IMPORT_TARGET,
  source: "manual-inhouse-import",
  labelPrefix: "IH Manual",
  sessionChannelPrefix: "MANUAL_IMPORT",
  unregisteredParticipantPolicy: "manifest",
  allowKiwiForAuthorizedPartial: false,
} as const;

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

function integer(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function chinaDayDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000+08:00`);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is invalid.`);
  return parsed;
}

function chinaDay(value: Date) {
  const china = new Date(value.getTime() + 8 * 60 * 60 * 1000);
  return `${china.getUTCFullYear()}-${String(china.getUTCMonth() + 1).padStart(2, "0")}-${String(china.getUTCDate()).padStart(2, "0")}`;
}

function detailPlayers(detail: unknown) {
  const detailObject = object(detail, "candidate.raw.detail");
  const data = object(detailObject.data, "candidate.raw.detail.data");
  const players = data.wgBattleDetailInfo;
  if (!Array.isArray(players) || players.length < 1 || players.length > 10) {
    throw new Error("Every selected game must expose between 1 and 10 detail participants.");
  }
  return players;
}

function durationSeconds(game: JsonObject) {
  const direct = Number(game.durationSeconds ?? game.gameDuration);
  if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
  const match = optionalText(game.title).match(/用时(\d+)分(?:(\d+)秒)?/u);
  return match ? Number(match[1]) * 60 + Number(match[2] || 0) : null;
}

function parseReview(value: unknown): ManualInhouseImportReview {
  const input = object(value, "review");
  const batchId = requiredText(input.batchId, "review.batchId");
  if (!/^manual-inhouse-[a-z0-9][a-z0-9-]{5,79}$/.test(batchId)) {
    throw new Error("review.batchId must be a stable manual-inhouse-* slug.");
  }
  const sinceChinaDay = requiredText(input.sinceChinaDay, "review.sinceChinaDay");
  const untilChinaDay = requiredText(input.untilChinaDay, "review.untilChinaDay");
  const since = chinaDayDate(sinceChinaDay, "review.sinceChinaDay");
  const until = chinaDayDate(untilChinaDay, "review.untilChinaDay");
  const windowDays = Math.floor((until.getTime() - since.getTime()) / 86_400_000) + 1;
  if (windowDays < 1 || windowDays > MAX_WINDOW_DAYS) {
    throw new Error(`Manual import date windows must contain 1-${MAX_WINDOW_DAYS} China days.`);
  }
  if (input.confirmedAsRankedInhouseCandidates !== true) {
    throw new Error("The operator must confirm the selected games as ranked inhouses.");
  }
  if (!Array.isArray(input.games) || input.games.length < 1 || input.games.length > MAX_IMPORT_GAMES) {
    throw new Error(`review.games must contain 1-${MAX_IMPORT_GAMES} selected games.`);
  }
  const games = input.games.map((value, index) => {
    const row = object(value, `review.games[${index}]`);
    const ownerAuthorizedUnregisteredFillerSlots = integer(row.ownerAuthorizedUnregisteredFillerSlots);
    if (ownerAuthorizedUnregisteredFillerSlots < 0 || ownerAuthorizedUnregisteredFillerSlots > 9) {
      throw new Error(`review.games[${index}].ownerAuthorizedUnregisteredFillerSlots is invalid.`);
    }
    return {
      providerGameId: requiredText(row.providerGameId, `review.games[${index}].providerGameId`),
      ownerAuthorizedUnregisteredFillerSlots,
      allowProviderModeKiwi: row.allowProviderModeKiwi === true,
    };
  });
  if (new Set(games.map((game) => game.providerGameId)).size !== games.length) {
    throw new Error("review.games contains duplicate provider IDs.");
  }
  return {
    batchId,
    sinceChinaDay,
    untilChinaDay,
    confirmedAsRankedInhouseCandidates: true,
    approvedUnregisteredParticipants: input.approvedUnregisteredParticipants === true,
    note: optionalText(input.note) || undefined,
    games,
  };
}

export function buildManualInhouseImportManifest(
  discoveryValue: unknown,
  reviewValue: unknown,
  now = new Date(),
): RecoveryReviewManifest {
  const discovery = object(discoveryValue, "discovery");
  if (discovery.readOnly !== true || !Array.isArray(discovery.candidates)) {
    throw new Error("Input must be a read-only inhouse discovery artifact.");
  }
  const review = parseReview(reviewValue);
  const candidates = new Map<string, JsonObject>();
  for (const [index, value] of discovery.candidates.entries()) {
    const candidate = object(value, `discovery.candidates[${index}]`);
    const providerGameId = requiredText(candidate.gameId, `discovery.candidates[${index}].gameId`);
    if (candidates.has(providerGameId)) throw new Error("Discovery contains duplicate provider IDs.");
    candidates.set(providerGameId, candidate);
  }

  const games: ReviewGame[] = review.games.map((selection, index) => {
    const candidate = candidates.get(selection.providerGameId);
    if (!candidate) throw new Error(`Selected game ${index + 1} is absent from discovery evidence.`);
    if (candidate.reviewStatus === "EXCLUDE_TOURNAMENT" || candidate.excludedCompetition) {
      throw new Error(`Selected game ${index + 1} is marked as a tournament game.`);
    }
    const raw = object(candidate.raw, `selected game ${index + 1}.raw`);
    const game = object(raw.game, `selected game ${index + 1}.raw.game`);
    if (requiredText(game.gameId, `selected game ${index + 1}.raw.game.gameId`) !== selection.providerGameId) {
      throw new Error(`Selected game ${index + 1} provider ID does not match its history evidence.`);
    }
    const playedAt = new Date(requiredText(candidate.gameTime, `selected game ${index + 1}.gameTime`));
    if (!Number.isFinite(playedAt.getTime())) throw new Error(`Selected game ${index + 1} has an invalid time.`);
    const playedDay = chinaDay(playedAt);
    if (playedDay < review.sinceChinaDay || playedDay > review.untilChinaDay) {
      throw new Error(`Selected game ${index + 1} is outside the reviewed China-date window.`);
    }
    const detail = object(raw.detail, `selected game ${index + 1}.raw.detail`);
    const players = detailPlayers(detail);
    const missingSlots = 10 - players.length;
    if (missingSlots !== selection.ownerAuthorizedUnregisteredFillerSlots) {
      throw new Error(`Selected game ${index + 1} must explicitly authorize exactly ${missingSlots} unknown filler slot(s).`);
    }
    if (missingSlots > 0 && !review.approvedUnregisteredParticipants) {
      throw new Error(`Selected game ${index + 1} has partial evidence but unregistered participants were not approved.`);
    }
    const evidenceStatus: ReviewGame["evidenceStatus"] = missingSlots === 0
      ? "COMPLETE_10_OF_10"
      : "AUTHORIZED_REGISTERED_PARTICIPANTS_ONLY";
    return {
      sequence: index + 1,
      providerGameId: selection.providerGameId,
      playedAt: playedAt.toISOString(),
      durationSeconds: durationSeconds(game),
      evidenceStatus,
      ownerAuthorizedUnregisteredFillerSlots: missingSlots,
      allowProviderModeKiwi: selection.allowProviderModeKiwi,
      discoveryStatus: optionalText(candidate.reviewStatus) || "UNKNOWN",
      discoveryReasons: Array.isArray(candidate.reasons)
        ? candidate.reasons.filter((reason): reason is string => typeof reason === "string")
        : [],
      game,
      detail,
    };
  }).sort((left, right) => left.playedAt.localeCompare(right.playedAt));

  const providerIds = games.map((game) => game.providerGameId);
  const scope: RecoveryScope = {
    sinceChinaDay: review.sinceChinaDay,
    untilChinaDay: review.untilChinaDay,
    expectedGameCount: games.length,
    providerSetHash: hash([...providerIds].sort()),
  };
  return {
    operationId: MANUAL_INHOUSE_IMPORT_REVIEW_OPERATION,
    batchId: review.batchId,
    target: MANUAL_INHOUSE_IMPORT_TARGET,
    readOnly: true,
    notify: false,
    source: {
      kind: "lzyumi-read-only-discovery",
      discoveryGeneratedAt: requiredText(discovery.generatedAt, "discovery.generatedAt"),
      discoveryFingerprint: hash(discovery),
    },
    scope,
    operatorReview: {
      confirmedAsRankedInhouseCandidates: true,
      ...(review.approvedUnregisteredParticipants ? { approvedUnregisteredParticipants: true as const } : {}),
      confirmedAt: now.toISOString(),
      note: review.note || "Operator reviewed this exact manual ranked-inhouse import batch.",
    },
    games,
  };
}

export function manualInhouseImportDefinition(value: unknown): RankedInhouseImportDefinition {
  const manifest = object(value, "manifest") as unknown as RecoveryReviewManifest;
  if (!manifest.batchId || !/^manual-inhouse-[a-z0-9][a-z0-9-]{5,79}$/.test(manifest.batchId)) {
    throw new Error("Manifest batchId is invalid.");
  }
  const scopeInput = object(manifest.scope, "manifest.scope");
  const sinceChinaDay = requiredText(scopeInput.sinceChinaDay, "manifest.scope.sinceChinaDay");
  const untilChinaDay = requiredText(scopeInput.untilChinaDay, "manifest.scope.untilChinaDay");
  const since = chinaDayDate(sinceChinaDay, "manifest.scope.sinceChinaDay");
  const until = chinaDayDate(untilChinaDay, "manifest.scope.untilChinaDay");
  const windowDays = Math.floor((until.getTime() - since.getTime()) / 86_400_000) + 1;
  const expectedGameCount = integer(scopeInput.expectedGameCount);
  const providerSetHash = requiredText(scopeInput.providerSetHash, "manifest.scope.providerSetHash");
  if (windowDays < 1 || windowDays > MAX_WINDOW_DAYS) {
    throw new Error(`Manifest date windows must contain 1-${MAX_WINDOW_DAYS} China days.`);
  }
  if (expectedGameCount < 1 || expectedGameCount > MAX_IMPORT_GAMES) {
    throw new Error(`Manifest game count must be 1-${MAX_IMPORT_GAMES}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(providerSetHash)) throw new Error("Manifest provider-set hash is invalid.");
  const scope: RecoveryScope = { sinceChinaDay, untilChinaDay, expectedGameCount, providerSetHash };
  return { ...MANUAL_INHOUSE_IMPORT_DEFINITION_BASE, scope };
}
