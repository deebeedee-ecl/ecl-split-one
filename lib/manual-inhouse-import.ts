import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { calculateLpChange } from "@/lib/elo";
import { acquireRankedInhouseReportLock } from "@/lib/inhouse-report-lock";
import type {
  LzyumiDetailResponse,
  LzyumiPlayerDetail,
  LzyumiRecentMatch,
} from "@/lib/lzyumi";
import { prisma } from "@/lib/prisma";
import { getRankedSeason, loadRankedSeasonStates } from "@/lib/ranked-season";
import { normalizeRiotPart, normalizeRiotTag, riotIdKey, splitRiotId } from "@/lib/riot-id";

export const MANUAL_INHOUSE_IMPORT_OPERATION = "ranked-inhouse-backfill-2026-11-12";
export const MANUAL_INHOUSE_IMPORT_TARGET = "deebeedee-ecls-projects/ecl-split-one";
const EXPECTED_GAME_COUNT = 5;
const EXPECTED_CHINA_DAY = "2026-11-12";
const EXPECTED_PROVIDER_GAME_SET_HASH = "d51ed74781c8d4a56a39ed6cd477e1ac4a78bd80b1b7a32ff6e7d40ead9ccd0d";
const EXPECTED_EXCLUDED_IDENTITY_HASH = "316fc01df40a2c541c81d8658db1c5f168b46e2369ee9ff8469b6717070e6f9c";
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

type ImportDatabase = typeof prisma | Prisma.TransactionClient;

type RawImportGame = {
  providerGameId: string;
  playedAt: string;
  game: LzyumiRecentMatch;
  detail: LzyumiDetailResponse;
  excludedRiotIds: string[];
};

export type ManualInhouseImportManifest = {
  operationId: string;
  target: string;
  notify: false;
  games: RawImportGame[];
};

type ParsedParticipant = {
  riotId: string;
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
  raw: LzyumiPlayerDetail;
};

type ParsedImportGame = {
  providerGameId: string;
  playedAt: Date;
  durationSeconds: number | null;
  blueProviderTeamId: string;
  redProviderTeamId: string;
  winnerProviderTeamId: string;
  excludedIdentityKeys: Set<string>;
  participants: ParsedParticipant[];
  rawGame: LzyumiRecentMatch;
  rawDetail: LzyumiDetailResponse;
};

type ResolvedPlayer = {
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

type ProjectedStat = {
  resolved: ResolvedPlayer;
  team: "BLUE" | "RED";
  isWin: boolean;
  lpChange: number;
  eloBefore: number;
  eloAfter: number;
};

type ResolvedGame = {
  parsed: ParsedImportGame;
  players: ResolvedPlayer[];
  projectedStats: ProjectedStat[];
};

type FinalPlayerState = {
  playerId: string;
  elo: number;
  winStreak: number;
  lossStreak: number;
  lastPlayedAt: Date | null;
  playedChinaDays: Set<string>;
};

type ExistingImportState = {
  providerGameIds: string[];
  completedProviderGameIds: string[];
  partialProviderGameIds: string[];
};

export type ManualInhouseImportPlan = {
  clean: boolean;
  fingerprint: string;
  blockers: string[];
  warnings: string[];
  summary: {
    operationId: string;
    target: string;
    gameCount: number;
    includedStatRows: number;
    excludedSlots: number;
    uniqueIncludedPlayers: number;
    projectedLpDelta: number;
    alreadyApplied: boolean;
  };
  duplicateChecks: {
    providerGameIdsClear: boolean;
    partialImportClear: boolean;
  };
  invariants: {
    notify: false;
    exactTeams: true;
    atomic: true;
    idempotent: true;
    excludedPlayersReceiveStats: false;
  };
};

type InternalPlan = {
  public: ManualInhouseImportPlan;
  games: ResolvedGame[];
  finalStates: Map<string, FinalPlayerState>;
  existing: ExistingImportState;
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function normalizedIdentity(value: string) {
  const parts = splitRiotId(value);
  const key = riotIdKey(parts.riotName, parts.riotTag);
  if (!key) throw new Error("Every participant and exclusion must use a full Riot ID.");
  return key;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function isAuthorizedManualInhouseExcludedIdentity(identityKey: string) {
  return hash(identityKey) === EXPECTED_EXCLUDED_IDENTITY_HASH;
}

export function manualInhouseImportScopeIssues(providerGameIds: string[], excludedIdentityKeys: string[]) {
  const issues: string[] = [];
  if (providerGameIds.length !== EXPECTED_GAME_COUNT || new Set(providerGameIds).size !== EXPECTED_GAME_COUNT) {
    issues.push("PROVIDER_GAME_SET_SIZE");
  } else if (hash([...providerGameIds].sort()) !== EXPECTED_PROVIDER_GAME_SET_HASH) {
    issues.push("PROVIDER_GAME_SET_MISMATCH");
  }
  if (excludedIdentityKeys.length !== 1 || !isAuthorizedManualInhouseExcludedIdentity(excludedIdentityKeys[0])) {
    issues.push("EXCLUDED_IDENTITY_MISMATCH");
  }
  return issues;
}

export function providerProfileIdentityIssues(input: {
  participant: { riotName: string; riotTag: string; areaId: number; openId: string };
  profile: {
    riotName: string;
    riotTag: string;
    chinaServerId: number | null;
    openId: string | null;
    kookId: string | null;
    verificationStatus: string;
    accountStatus: string;
  };
}) {
  const issues: string[] = [];
  if (riotIdKey(input.participant.riotName, input.participant.riotTag) !== riotIdKey(input.profile.riotName, input.profile.riotTag)) {
    issues.push("FULL_RIOT_ID_MISMATCH");
  }
  if (input.profile.chinaServerId !== input.participant.areaId) issues.push("CHINA_SERVER_MISMATCH");
  if (!input.profile.openId || input.profile.openId !== input.participant.openId) issues.push("OPEN_ID_MISMATCH");
  if (!input.profile.kookId) issues.push("KOOK_ID_MISSING");
  if (input.profile.verificationStatus !== "VERIFIED" || input.profile.accountStatus !== "ACTIVE") {
    issues.push("PROFILE_NOT_ACTIVE_VERIFIED");
  }
  return issues;
}

function chinaDay(value: Date) {
  const china = new Date(value.getTime() + CHINA_OFFSET_MS);
  return `${china.getUTCFullYear()}-${String(china.getUTCMonth() + 1).padStart(2, "0")}-${String(china.getUTCDate()).padStart(2, "0")}`;
}

function parseProviderTime(game: LzyumiRecentMatch, reference: Date) {
  const raw = `${game.titleTime || ""} ${game.title || ""}`;
  const match = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const chinaReference = new Date(reference.getTime() + CHINA_OFFSET_MS);
  return new Date(Date.UTC(
    chinaReference.getUTCFullYear(),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[3]) - 8,
    Number(match[4]),
    Number(match[5] || 0),
  ));
}

function parseDurationSeconds(game: LzyumiRecentMatch) {
  const match = String(game.title || "").match(/用时(\d+)分(?:(\d+)秒)?/u);
  return match ? Number(match[1]) * 60 + Number(match[2] || 0) : null;
}

function parseScore(value: unknown) {
  const match = typeof value === "string" ? value.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/) : null;
  if (!match) throw new Error("Every included provider participant must expose a valid K/D/A line.");
  return { kills: Number(match[1]), deaths: Number(match[2]), assists: Number(match[3]) };
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function playerMetric(player: LzyumiPlayerDetail, key: "goldEarned" | "totalDamageDealt") {
  return number(player.echartsMap?.[key] ?? player[key]);
}

function playerWon(value: unknown) {
  return ["1", "true", "win"].includes(String(value || "").trim().toLowerCase());
}

function parseParticipant(value: unknown, label: string): ParsedParticipant {
  const player = object(value, label) as LzyumiPlayerDetail;
  const rawRiotId = text(player.nickNameStr || player.nickName, `${label}.riotId`);
  const parts = splitRiotId(rawRiotId);
  const riotName = normalizeRiotPart(parts.riotName);
  const riotTag = normalizeRiotTag(parts.riotTag);
  const identityKey = riotIdKey(riotName, riotTag);
  if (!riotName || !riotTag || !identityKey) throw new Error(`${label} must expose a full Riot ID.`);
  const openId = text(player.openIdNow, `${label}.openIdNow`);
  const areaId = number(player.translateAreaId);
  if (areaId !== 1) throw new Error(`${label} is not verified as an Ionia participant.`);
  const teamId = text(player.teamId, `${label}.teamId`);
  const score = parseScore(player.scoreInfo);
  return {
    riotId: `${riotName}#${riotTag}`,
    riotName,
    riotTag,
    identityKey,
    openId,
    areaId,
    teamId,
    isWin: playerWon(player.win),
    ...score,
    gold: playerMetric(player, "goldEarned"),
    damage: playerMetric(player, "totalDamageDealt"),
    isMVP: String(player.wasMvp || "") === "1",
    isSVP: String(player.wasSvp || "") === "1",
    raw: player,
  };
}

function parseImportGame(value: unknown, index: number): ParsedImportGame {
  const input = object(value, `games[${index}]`);
  const providerGameId = text(input.providerGameId, `games[${index}].providerGameId`);
  const playedAtText = text(input.playedAt, `games[${index}].playedAt`);
  const playedAt = new Date(playedAtText);
  if (!Number.isFinite(playedAt.getTime())) throw new Error(`games[${index}].playedAt must be an ISO timestamp.`);
  if (chinaDay(playedAt) !== EXPECTED_CHINA_DAY) throw new Error(`games[${index}] is outside the authorized China day.`);
  const rawGame = object(input.game, `games[${index}].game`) as LzyumiRecentMatch;
  if (text(rawGame.gameId, `games[${index}].game.gameId`) !== providerGameId) {
    throw new Error(`games[${index}] provider game ID does not match its history row.`);
  }
  const providerTime = parseProviderTime(rawGame, playedAt);
  if (!providerTime || Math.abs(providerTime.getTime() - playedAt.getTime()) > 2_000) {
    throw new Error(`games[${index}] playedAt does not match provider evidence.`);
  }
  const rawDetail = object(input.detail, `games[${index}].detail`) as LzyumiDetailResponse;
  if (String(rawDetail.code) !== "1") throw new Error(`games[${index}] detail did not succeed at the provider.`);
  if (rawDetail.data?.gameType !== "CUSTOM_GAME") throw new Error(`games[${index}] is not a provider custom game.`);
  if (rawDetail.data?.gameMode !== "CLASSIC") throw new Error(`games[${index}] is not a provider classic game.`);
  const rawPlayers = rawDetail.data?.wgBattleDetailInfo;
  if (!Array.isArray(rawPlayers) || rawPlayers.length !== 10) {
    throw new Error(`games[${index}] must contain exactly ten provider participants.`);
  }
  const participants = rawPlayers.map((player, playerIndex) => parseParticipant(player, `games[${index}].players[${playerIndex}]`));
  if (new Set(participants.map((player) => player.identityKey)).size !== 10) {
    throw new Error(`games[${index}] contains duplicate Riot identities.`);
  }
  if (new Set(participants.map((player) => player.openId)).size !== 10) {
    throw new Error(`games[${index}] contains duplicate provider openIds.`);
  }
  const teamIds = [...new Set(participants.map((player) => player.teamId))];
  if (teamIds.length !== 2 || teamIds.some((teamId) => participants.filter((player) => player.teamId === teamId).length !== 5)) {
    throw new Error(`games[${index}] must contain two complete five-player teams.`);
  }
  const winnerTeamIds = [...new Set(participants.filter((player) => player.isWin).map((player) => player.teamId))];
  if (participants.filter((player) => player.isWin).length !== 5 || winnerTeamIds.length !== 1) {
    throw new Error(`games[${index}] must expose exactly one five-player winning team.`);
  }
  if (!Array.isArray(input.excludedRiotIds) || input.excludedRiotIds.length !== 1) {
    throw new Error(`games[${index}] must declare exactly one explicitly excluded Riot ID.`);
  }
  const excludedIdentityKeys = new Set(input.excludedRiotIds.map((riotId) => normalizedIdentity(text(riotId, `games[${index}].excludedRiotIds`))));
  if (![...excludedIdentityKeys].every((key) => participants.some((player) => player.identityKey === key))) {
    throw new Error(`games[${index}] exclusion is not present in provider evidence.`);
  }
  const blueProviderTeamId = teamIds.includes("100") ? "100" : [...teamIds].sort()[0];
  const redProviderTeamId = teamIds.find((teamId) => teamId !== blueProviderTeamId)!;
  return {
    providerGameId,
    playedAt,
    durationSeconds: parseDurationSeconds(rawGame),
    blueProviderTeamId,
    redProviderTeamId,
    winnerProviderTeamId: winnerTeamIds[0],
    excludedIdentityKeys,
    participants,
    rawGame,
    rawDetail,
  };
}

export function parseManualInhouseImportManifest(value: unknown): ManualInhouseImportManifest {
  const input = object(value, "manifest");
  const operationId = text(input.operationId, "manifest.operationId");
  if (operationId !== MANUAL_INHOUSE_IMPORT_OPERATION) throw new Error("This route only accepts the authorized dated backfill operation.");
  const target = text(input.target, "manifest.target");
  if (target !== MANUAL_INHOUSE_IMPORT_TARGET) throw new Error("This manifest targets a different deployment.");
  if (input.notify !== false) throw new Error("Manual ranked backfill requires notify: false.");
  if (!Array.isArray(input.games) || input.games.length !== EXPECTED_GAME_COUNT) {
    throw new Error(`manifest.games must contain exactly ${EXPECTED_GAME_COUNT} games.`);
  }
  const parsed = input.games.map(parseImportGame).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  if (new Set(parsed.map((game) => game.providerGameId)).size !== EXPECTED_GAME_COUNT) {
    throw new Error("manifest.games contains duplicate provider game IDs.");
  }
  const excludedSets = parsed.map((game) => [...game.excludedIdentityKeys]);
  if (new Set(excludedSets.flat()).size !== 1) throw new Error("The same single unlinked identity must be excluded from every game.");
  const scopeIssues = manualInhouseImportScopeIssues(parsed.map((game) => game.providerGameId), excludedSets[0]);
  if (scopeIssues.includes("PROVIDER_GAME_SET_SIZE")) throw new Error("manifest.games must contain five unique provider game IDs.");
  if (scopeIssues.includes("PROVIDER_GAME_SET_MISMATCH")) throw new Error("manifest.games is not the authorized five-game provider set.");
  if (scopeIssues.includes("EXCLUDED_IDENTITY_MISMATCH")) throw new Error("The manifest does not exclude the authorized unlinked identity.");
  return {
    operationId,
    target,
    notify: false,
    games: parsed.map((game) => ({
      providerGameId: game.providerGameId,
      playedAt: game.playedAt.toISOString(),
      game: game.rawGame,
      detail: game.rawDetail,
      excludedRiotIds: game.participants
        .filter((participant) => game.excludedIdentityKeys.has(participant.identityKey))
        .map((participant) => participant.riotId),
    })),
  };
}

function parseManifestGames(manifest: ManualInhouseImportManifest) {
  return manifest.games.map(parseImportGame).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
}

function reportSource(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : null;
}

export function classifyExistingManualImport(
  requestedProviderGameIds: string[],
  sessions: Array<{ lzyumiGameId: string | null; status: string; matchId: string | null; matchGameId: string | null; reportRawJson: Prisma.JsonValue | null }>,
) : ExistingImportState {
  const completed = sessions.filter((session) => {
    const source = reportSource(session.reportRawJson);
    return session.status === "COMPLETED" && Boolean(session.matchId) && Boolean(session.matchGameId)
      && source?.source === "manual-inhouse-backfill"
      && source?.operationId === MANUAL_INHOUSE_IMPORT_OPERATION;
  }).map((session) => session.lzyumiGameId).filter((id): id is string => Boolean(id));
  const existing = sessions.map((session) => session.lzyumiGameId).filter((id): id is string => Boolean(id));
  return {
    providerGameIds: existing,
    completedProviderGameIds: requestedProviderGameIds.filter((id) => completed.includes(id)),
    partialProviderGameIds: requestedProviderGameIds.filter((id) => existing.includes(id) && !completed.includes(id)),
  };
}

async function existingImportState(db: ImportDatabase, providerGameIds: string[]) {
  const sessions = await db.inhouseSession.findMany({
    where: { lzyumiGameId: { in: providerGameIds } },
    select: { lzyumiGameId: true, status: true, matchId: true, matchGameId: true, reportRawJson: true },
  });
  return classifyExistingManualImport(providerGameIds, sessions);
}

function jsonPaths(gameId: string): Prisma.MatchGameWhereInput[] {
  const values: Prisma.InputJsonValue[] = [gameId];
  return [
    ["gameId"],
    ["raw", "gameId"],
    ["recentMatch", "gameId"],
    ["raw", "recentMatch", "gameId"],
  ].map((path) => ({ ocrRawJson: { path, equals: values[0] } }));
}

async function collisionGameIds(db: ImportDatabase, providerGameIds: string[]) {
  const [legacyGames, reportJobs, tournamentReports] = await Promise.all([
    db.matchGame.findMany({
      where: { OR: providerGameIds.flatMap(jsonPaths) },
      select: { ocrRawJson: true },
    }),
    db.inhouseReportJob.findMany({
      where: {
        status: { notIn: ["CANCELLED", "DESKTOP_CANCELLED", "DESKTOP_EXPIRED", "DESKTOP_REJECTED"] },
        OR: providerGameIds.flatMap((gameId) => [
          { rawMatchData: { path: ["gameId"], equals: gameId } },
          { rawMatchData: { path: ["rawMatchData", "gameId"], equals: gameId } },
          { rawMatchData: { path: ["recentMatch", "gameId"], equals: gameId } },
        ]),
      },
      select: { rawMatchData: true },
    }),
    db.tournamentReport.findMany({
      where: { leagueGameId: { in: providerGameIds } },
      select: { leagueGameId: true },
    }),
  ]);
  return {
    legacyGameCount: legacyGames.length,
    reportJobCount: reportJobs.length,
    tournamentReportCount: tournamentReports.length,
  };
}

async function resolveIncludedPlayers(db: ImportDatabase, games: ParsedImportGame[], blockers: string[]) {
  const participants = new Map<string, ParsedParticipant>();
  for (const game of games) {
    for (const participant of game.participants) {
      if (!game.excludedIdentityKeys.has(participant.identityKey)) participants.set(participant.identityKey, participant);
    }
  }
  const identities = [...participants.values()];
  const profiles = await db.accountProfile.findMany({
    where: {
      OR: identities.map((identity) => ({
        riotName: { equals: identity.riotName, mode: "insensitive" as const },
        riotTag: { equals: identity.riotTag, mode: "insensitive" as const },
      })),
    },
    select: {
      id: true, displayName: true, email: true, riotName: true, riotTag: true,
      chinaServerId: true, openId: true, kookId: true, verificationStatus: true, accountStatus: true,
    },
  });
  const profilesByIdentity = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const key = riotIdKey(profile.riotName, profile.riotTag);
    if (key) profilesByIdentity.set(key, [...(profilesByIdentity.get(key) ?? []), profile]);
  }
  const selectedProfiles = [];
  for (const identity of identities) {
    const matches = profilesByIdentity.get(identity.identityKey) ?? [];
    if (matches.length !== 1) {
      blockers.push("An included full Riot ID did not resolve to exactly one ECL profile.");
      continue;
    }
    const profile = matches[0];
    const identityIssues = providerProfileIdentityIssues({ participant: identity, profile });
    if (identityIssues.includes("PROFILE_NOT_ACTIVE_VERIFIED")) blockers.push("An included ECL profile is not active and verified.");
    if (identityIssues.includes("KOOK_ID_MISSING")) blockers.push("An included ECL profile has no stable KOOK ID.");
    if (identityIssues.some((issue) => ["FULL_RIOT_ID_MISMATCH", "CHINA_SERVER_MISMATCH", "OPEN_ID_MISMATCH"].includes(issue))) {
      blockers.push("An included provider identity does not match the profile server/openId.");
    }
    selectedProfiles.push({ identity, profile });
  }
  if (new Set(selectedProfiles.map(({ profile }) => profile.id)).size !== selectedProfiles.length) {
    blockers.push("Two included identities resolve to the same ECL profile.");
  }
  if (new Set(selectedProfiles.map(({ profile }) => profile.kookId).filter(Boolean)).size !== selectedProfiles.length) {
    blockers.push("Included profiles do not have unique stable KOOK IDs.");
  }
  const players = selectedProfiles.length ? await db.player.findMany({
    where: {
      OR: selectedProfiles.flatMap(({ profile }) => [
        { riotName: { equals: profile.riotName, mode: "insensitive" as const }, riotTag: { equals: profile.riotTag, mode: "insensitive" as const } },
        { email: { equals: profile.email, mode: "insensitive" as const } },
      ]),
    },
    select: { id: true, name: true, riotName: true, riotTag: true, email: true, elo: true, winStreak: true, lossStreak: true },
  }) : [];
  const resolved = new Map<string, Omit<ResolvedPlayer, "participant">>();
  for (const { identity, profile } of selectedProfiles) {
    const candidates = players.filter((player) => {
      const sameRiot = riotIdKey(player.riotName, player.riotTag) === identity.identityKey;
      const sameEmail = Boolean(profile.email && player.email && profile.email.toLowerCase() === player.email.toLowerCase());
      return sameRiot || sameEmail;
    });
    const unique = [...new Map(candidates.map((player) => [player.id, player])).values()];
    if (unique.length !== 1) {
      blockers.push("An included profile did not resolve to exactly one ECL Player row.");
      continue;
    }
    if (riotIdKey(unique[0].riotName, unique[0].riotTag) !== identity.identityKey) {
      blockers.push("An included Player row does not match the provider full Riot ID.");
    }
    resolved.set(identity.identityKey, { profile, player: unique[0] });
  }
  if (new Set([...resolved.values()].map(({ player }) => player.id)).size !== resolved.size) {
    blockers.push("Two included identities resolve to the same ECL Player row.");
  }
  return resolved;
}

function projectedFingerprint(manifest: ManualInhouseImportManifest, resolvedGames: ResolvedGame[], existing: ExistingImportState, collisions: Awaited<ReturnType<typeof collisionGameIds>>, currentStats: Array<{ id: string; playerId: string; createdAt: Date; isWin: boolean; lpChange: number }>) {
  return hash({
    manifest,
    resolved: resolvedGames.map((game) => ({
      providerGameId: game.parsed.providerGameId,
      players: game.players.map(({ participant, profile, player }) => ({
        identityKey: participant.identityKey,
        openIdHash: hash(participant.openId),
        profileId: profile.id,
        playerId: player.id,
      })),
    })),
    existing,
    collisions,
    currentStats,
  });
}

async function buildInternalPlan(manifest: ManualInhouseImportManifest, db: ImportDatabase): Promise<InternalPlan> {
  const games = parseManifestGames(manifest);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const providerGameIds = games.map((game) => game.providerGameId);
  const existing = await existingImportState(db, providerGameIds);
  const alreadyApplied = existing.completedProviderGameIds.length === providerGameIds.length;
  if (existing.partialProviderGameIds.length) blockers.push("A provider game ID has a partial or foreign inhouse import.");
  if (existing.providerGameIds.length && !alreadyApplied) blockers.push("One or more provider game IDs already exist on inhouse sessions.");
  const collisions = await collisionGameIds(db, providerGameIds);
  if (collisions.legacyGameCount && !alreadyApplied) blockers.push("A provider game ID already exists in MatchGame evidence.");
  if (collisions.reportJobCount) blockers.push("A provider game ID exists in a non-cancelled report job.");
  if (collisions.tournamentReportCount) blockers.push("A provider game ID belongs to a tournament report.");
  const resolvedByIdentity = await resolveIncludedPlayers(db, games, blockers);
  const season = getRankedSeason();
  if (!season) blockers.push("No active ranked season is configured.");
  if (season && games.some((game) => game.playedAt < season.startedAt)) blockers.push("A proposed game predates the current ranked season.");
  const playerIds = [...new Set([...resolvedByIdentity.values()].map(({ player }) => player.id))];
  const currentStats = season && playerIds.length ? await db.matchGamePlayerStat.findMany({
    where: {
      playerId: { in: playerIds },
      createdAt: { gte: season.startedAt },
      matchGame: { match: { OR: [{ roundLabel: { startsWith: "IH" } }, { roundLabel: "Ranked Inhouse" }] } },
    },
    select: { id: true, playerId: true, createdAt: true, isWin: true, lpChange: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  }) : [];
  const firstPlayedAt = games[0].playedAt;
  if (currentStats.some((stat) => stat.createdAt > firstPlayedAt)) {
    blockers.push("An affected player has a later ranked result; replay is required instead of direct backfill.");
  }
  const seasonStates = season ? await loadRankedSeasonStates(playerIds, season, db) : new Map();
  const finalStates = new Map<string, FinalPlayerState>();
  for (const playerId of playerIds) {
    const state = seasonStates.get(playerId);
    finalStates.set(playerId, {
      playerId,
      elo: state?.elo ?? 800,
      winStreak: state?.winStreak ?? 0,
      lossStreak: state?.lossStreak ?? 0,
      lastPlayedAt: state?.lastPlayedAt ?? null,
      playedChinaDays: new Set((state?.stats ?? []).map((stat: { createdAt: Date }) => chinaDay(stat.createdAt))),
    });
  }
  const resolvedGames: ResolvedGame[] = [];
  for (const game of games) {
    const players: ResolvedPlayer[] = [];
    const projectedStats: ProjectedStat[] = [];
    for (const participant of game.participants) {
      if (game.excludedIdentityKeys.has(participant.identityKey)) continue;
      const resolved = resolvedByIdentity.get(participant.identityKey);
      if (!resolved) continue;
      const state = finalStates.get(resolved.player.id)!;
      const isWin = participant.teamId === game.winnerProviderTeamId;
      const result = calculateLpChange({
        win: isWin,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        isMVP: participant.isMVP,
        isSVP: participant.isSVP,
        currentElo: state.elo,
        gamesPlayed: 0,
        winStreak: state.winStreak,
        lossStreak: state.lossStreak,
        lastPlayedAt: state.lastPlayedAt,
        playedAt: game.playedAt,
        hasPlayedOnDoubleLpDay: state.playedChinaDays.has(chinaDay(game.playedAt)),
        doubleLpEligible: true,
      });
      const projection: ProjectedStat = {
        resolved: { participant, ...resolved },
        team: participant.teamId === game.blueProviderTeamId ? "BLUE" : "RED",
        isWin,
        lpChange: result.lpChange,
        eloBefore: state.elo,
        eloAfter: state.elo + result.lpChange,
      };
      players.push(projection.resolved);
      projectedStats.push(projection);
      state.elo = projection.eloAfter;
      state.winStreak = isWin ? state.winStreak + 1 : 0;
      state.lossStreak = isWin ? 0 : state.lossStreak + 1;
      state.lastPlayedAt = game.playedAt;
      state.playedChinaDays.add(chinaDay(game.playedAt));
    }
    if (players.length !== 9) blockers.push("Every game must resolve exactly nine included ECL players.");
    resolvedGames.push({ parsed: game, players, projectedStats });
  }
  if (new Set(resolvedGames.flatMap((game) => game.players.map((row) => row.player.id))).size !== playerIds.length) {
    blockers.push("Resolved player identity state is inconsistent across games.");
  }
  if (games.some((game) => game.durationSeconds === null)) warnings.push("One or more provider titles did not expose duration seconds.");
  const fingerprint = projectedFingerprint(manifest, resolvedGames, existing, collisions, currentStats);
  const publicPlan: ManualInhouseImportPlan = {
    clean: blockers.length === 0 || alreadyApplied,
    fingerprint,
    blockers,
    warnings,
    summary: {
      operationId: manifest.operationId,
      target: manifest.target,
      gameCount: games.length,
      includedStatRows: resolvedGames.reduce((sum, game) => sum + game.projectedStats.length, 0),
      excludedSlots: games.reduce((sum, game) => sum + game.excludedIdentityKeys.size, 0),
      uniqueIncludedPlayers: playerIds.length,
      projectedLpDelta: resolvedGames.flatMap((game) => game.projectedStats).reduce((sum, stat) => sum + stat.lpChange, 0),
      alreadyApplied,
    },
    duplicateChecks: {
      providerGameIdsClear: existing.providerGameIds.length === 0 || alreadyApplied,
      partialImportClear: existing.partialProviderGameIds.length === 0,
    },
    invariants: {
      notify: false,
      exactTeams: true,
      atomic: true,
      idempotent: true,
      excludedPlayersReceiveStats: false,
    },
  };
  return { public: publicPlan, games: resolvedGames, finalStates, existing };
}

export async function preflightManualInhouseImport(manifest: ManualInhouseImportManifest, db: ImportDatabase = prisma) {
  return (await buildInternalPlan(manifest, db)).public;
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function gameLabel(playedAt: Date) {
  const china = new Date(playedAt.getTime() + CHINA_OFFSET_MS);
  return `IH Backfill ${String(china.getUTCMonth() + 1).padStart(2, "0")}-${String(china.getUTCDate()).padStart(2, "0")} ${String(china.getUTCHours()).padStart(2, "0")}:${String(china.getUTCMinutes()).padStart(2, "0")}`;
}

export async function applyManualInhouseImport(manifest: ManualInhouseImportManifest, expectedFingerprint: string) {
  return prisma.$transaction(async (tx) => {
    await acquireRankedInhouseReportLock(tx);
    const plan = await buildInternalPlan(manifest, tx);
    if (plan.public.summary.alreadyApplied) {
      return { status: "ALREADY_APPLIED" as const, plan: plan.public, matchIds: [] as string[] };
    }
    if (!plan.public.clean) throw new Error(`Manual import preflight is blocked: ${plan.public.blockers.join(" ")}`);
    if (!expectedFingerprint || expectedFingerprint !== plan.public.fingerprint) {
      throw new Error("Manual import fingerprint no longer matches current production state.");
    }
    const matchIds: string[] = [];
    for (const game of plan.games) {
      const sessionId = randomUUID();
      const label = gameLabel(game.parsed.playedAt);
      const blueTeam = await tx.team.create({ data: { name: `Ranked IH ${sessionId.slice(0, 8)} BLUE` } });
      const redTeam = await tx.team.create({ data: { name: `Ranked IH ${sessionId.slice(0, 8)} RED` } });
      const blueWon = game.parsed.winnerProviderTeamId === game.parsed.blueProviderTeamId;
      const match = await tx.match.create({
        data: {
          stage: "REGULAR_SEASON",
          roundLabel: label,
          matchLabel: label,
          bestOf: 1,
          scheduledAt: game.parsed.playedAt,
          status: "COMPLETED",
          homeTeamId: blueTeam.id,
          awayTeamId: redTeam.id,
          winnerTeamId: blueWon ? blueTeam.id : redTeam.id,
          homeScore: blueWon ? 1 : 0,
          awayScore: blueWon ? 0 : 1,
          createdAt: game.parsed.playedAt,
        },
      });
      const blueParticipants = game.parsed.participants.filter((player) => player.teamId === game.parsed.blueProviderTeamId);
      const redParticipants = game.parsed.participants.filter((player) => player.teamId === game.parsed.redProviderTeamId);
      const mvp = game.parsed.participants.find((player) => player.isMVP);
      const matchGame = await tx.matchGame.create({
        data: {
          matchId: match.id,
          gameNumber: 1,
          winnerTeamId: blueWon ? blueTeam.id : redTeam.id,
          durationSeconds: game.parsed.durationSeconds,
          homeKills: blueParticipants.reduce((sum, player) => sum + player.kills, 0),
          awayKills: redParticipants.reduce((sum, player) => sum + player.kills, 0),
          homeGold: blueParticipants.reduce((sum, player) => sum + player.gold, 0),
          awayGold: redParticipants.reduce((sum, player) => sum + player.gold, 0),
          mvpName: mvp?.riotId ?? null,
          ocrRawJson: asJson({
            source: "manual-inhouse-backfill",
            operationId: manifest.operationId,
            recentMatch: game.parsed.rawGame,
            detail: game.parsed.rawDetail,
            excludedRiotIds: game.parsed.participants
              .filter((player) => game.parsed.excludedIdentityKeys.has(player.identityKey))
              .map((player) => player.riotId),
          }),
          createdAt: game.parsed.playedAt,
        },
      });
      await tx.inhouseSession.create({
        data: {
          id: sessionId,
          status: "COMPLETED",
          gameLabel: label,
          sourceChannelId: "MANUAL_BACKFILL",
          blueChannelId: "MANUAL_BACKFILL_BLUE",
          redChannelId: "MANUAL_BACKFILL_RED",
          blueTeamId: blueTeam.id,
          redTeamId: redTeam.id,
          matchId: match.id,
          matchGameId: matchGame.id,
          lzyumiGameId: game.parsed.providerGameId,
          reportedByKookId: "ADMIN",
          reportRawJson: asJson({
            source: "manual-inhouse-backfill",
            operationId: manifest.operationId,
            playedAt: game.parsed.playedAt.toISOString(),
            notify: false,
          }),
          createdAt: game.parsed.playedAt,
          completedAt: game.parsed.playedAt,
          players: {
            create: game.projectedStats.map((stat) => ({
              kookUserId: stat.resolved.profile.kookId!,
              profileId: stat.resolved.profile.id,
              playerId: stat.resolved.player.id,
              displayName: stat.resolved.profile.displayName,
              riotName: stat.resolved.profile.riotName,
              riotTag: normalizeRiotTag(stat.resolved.profile.riotTag) || null,
              email: stat.resolved.profile.email,
              side: stat.team,
              eloAtReady: stat.eloBefore,
              createdAt: game.parsed.playedAt,
            })),
          },
        },
      });
      for (const stat of game.projectedStats) {
        const teamId = stat.team === "BLUE" ? blueTeam.id : redTeam.id;
        await tx.matchGamePlayerStat.create({
          data: {
            matchGameId: matchGame.id,
            playerId: stat.resolved.player.id,
            teamId,
            riotName: stat.resolved.profile.riotName,
            riotTag: normalizeRiotTag(stat.resolved.profile.riotTag) || null,
            kills: stat.resolved.participant.kills,
            deaths: stat.resolved.participant.deaths,
            assists: stat.resolved.participant.assists,
            gold: stat.resolved.participant.gold,
            damage: stat.resolved.participant.damage,
            isWin: stat.isWin,
            isMVP: stat.resolved.participant.isMVP,
            isSVP: stat.resolved.participant.isSVP,
            lpChange: stat.lpChange,
            eloBefore: stat.eloBefore,
            eloAfter: stat.eloAfter,
            createdAt: game.parsed.playedAt,
          },
        });
      }
      matchIds.push(match.id);
    }
    for (const state of plan.finalStates.values()) {
      await tx.player.update({
        where: { id: state.playerId },
        data: { elo: state.elo, winStreak: state.winStreak, lossStreak: state.lossStreak },
      });
    }
    return { status: "APPLIED" as const, plan: plan.public, matchIds };
  }, { maxWait: 10_000, timeout: 240_000 });
}
