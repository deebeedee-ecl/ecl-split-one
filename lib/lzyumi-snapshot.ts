import { riotIdKey, splitRiotId } from "@/lib/riot-id";
import {
  LzyumiBrowserContractError,
  validateLzyumiHistoryResponse,
  validateLzyumiOptionalRecentStat,
  validateLzyumiProfileResponse,
} from "@/lib/lzyumi-browser-contract";

export const LZYUMI_SNAPSHOT_VERSION = 2;
export const LZYUMI_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;

type SnapshotIdentityInput = {
  rawProfile: unknown;
  riotName: string;
  riotTag: string | null | undefined;
  areaId: number;
  existingOpenId?: string | null;
};

export type ValidatedLzyumiIdentity = {
  openId: string;
  resolvedName: string;
};

export type ExistingLzyumiSnapshot = {
  rawProfile: unknown;
  recentStat: unknown;
  rankedGames: unknown;
  lastLookupAt: Date | string | null;
};

type LzyumiSnapshotReplacementInput = Omit<SnapshotIdentityInput, "rawProfile"> & {
  profileResponse: unknown;
  soloResponse: unknown;
  flexResponse: unknown;
  recentStat: unknown;
  fetchedAt?: Date;
};

export type LzyumiSnapshotRefreshResult =
  | {
      status: "accepted";
      identity: ValidatedLzyumiIdentity;
      rawProfile: Record<string, unknown>;
      recentStat: Record<string, unknown> | null;
      recentStatStatus: "available" | "unavailable";
      rankedGames: ReturnType<typeof normalizeLzyumiRankedGames>;
      fetchedAt: Date;
    }
  | {
      status: "rejected";
      previous: ExistingLzyumiSnapshot;
      error: LzyumiSnapshotValidationError | LzyumiBrowserContractError;
    };

export class LzyumiSnapshotValidationError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_SNAPSHOT" | "IDENTITY_MISMATCH" | "OPEN_ID_MISMATCH" | "SERVER_MISMATCH",
  ) {
    super(message);
    this.name = "LzyumiSnapshotValidationError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function optionalNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function compactRecord(entries: Array<[string, unknown]>) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

function storedGame(value: unknown) {
  const game = asRecord(value);
  if (!game) return null;

  const stored = compactRecord([
    ["championId", typeof game.championId === "string" || typeof game.championId === "number"
      ? game.championId
      : undefined],
    ["isWin", optionalNumber(game, "isWin")],
    ["wasMvp", optionalString(game, "wasMvp")],
    ["wasSvp", optionalString(game, "wasSvp")],
    ["title", optionalString(game, "title")],
    ["titleTime", optionalString(game, "titleTime")],
  ]);
  return Object.keys(stored).length > 0 ? stored : null;
}

function storedGames(value: unknown) {
  return Array.isArray(value)
    ? value.map(storedGame).filter((game): game is NonNullable<typeof game> => Boolean(game))
    : [];
}

function storedRankRow(value: unknown) {
  const row = asRecord(value);
  if (!row) return null;

  const stored = compactRecord([
    ["type", optionalString(row, "type")],
    ["tier", optionalString(row, "tier")],
    ["winPoint", optionalNumber(row, "winPoint")],
    ["wins", optionalNumber(row, "wins")],
    ["losses", optionalNumber(row, "losses")],
    ["total", optionalNumber(row, "total")],
    ["rate", optionalNumber(row, "rate")],
  ]);
  return Object.keys(stored).length > 0 ? stored : null;
}

function snapshotMetadata(fetchedAt: Date) {
  return {
    _eclSnapshotVersion: LZYUMI_SNAPSHOT_VERSION,
    _eclFetchedAt: fetchedAt.toISOString(),
  };
}

function snapshotBattleInfo(rawProfile: unknown) {
  const root = asRecord(rawProfile);
  const data = asRecord(root?.data);
  return asRecord(root?.battleInfo) ?? asRecord(data?.battleInfo);
}

export function validateLzyumiSnapshotIdentity({
  rawProfile,
  riotName,
  riotTag,
  areaId,
  existingOpenId,
}: SnapshotIdentityInput): ValidatedLzyumiIdentity {
  const expectedKey = riotIdKey(riotName, riotTag);
  if (!expectedKey) {
    throw new LzyumiSnapshotValidationError(
      "The saved profile is missing a complete Riot ID.",
      "INVALID_SNAPSHOT",
    );
  }

  const battleInfo = snapshotBattleInfo(rawProfile);
  const resolvedName =
    typeof battleInfo?.nameInfoNew === "string" ? battleInfo.nameInfoNew.trim() : "";
  const openId = typeof battleInfo?.openId === "string" ? battleInfo.openId.trim() : "";

  if (!resolvedName || !openId) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG response did not include a verifiable Riot ID and openId.",
      "INVALID_SNAPSHOT",
    );
  }

  const resolved = splitRiotId(resolvedName);
  if (riotIdKey(resolved.riotName, resolved.riotTag) !== expectedKey) {
    throw new LzyumiSnapshotValidationError(
      `ECL.GG resolved ${resolvedName} instead of ${riotName}#${riotTag}.`,
      "IDENTITY_MISMATCH",
    );
  }

  const reportedAreaId = Number(battleInfo?.areaId);
  if (Number.isInteger(reportedAreaId) && reportedAreaId > 0 && reportedAreaId !== areaId) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG response belongs to a different China server.",
      "SERVER_MISMATCH",
    );
  }

  const trustedOpenId = existingOpenId?.trim();
  if (trustedOpenId && openId !== trustedOpenId) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG openId changed. Re-verify the Riot account before replacing saved stats.",
      "OPEN_ID_MISMATCH",
    );
  }

  return { openId, resolvedName };
}

export function hasLzyumiRecentStatData(value: unknown) {
  const root = asRecord(value);
  return Boolean(asRecord(root?.data));
}

export function toStoredLzyumiProfileSnapshot(value: unknown, fetchedAt = new Date()) {
  const root = asRecord(value);
  if (!root) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG snapshot is not a JSON object.",
      "INVALID_SNAPSHOT",
    );
  }

  const data = asRecord(root.data);
  const battleInfo = asRecord(root.battleInfo) ?? asRecord(data?.battleInfo);
  const rankRows = Array.isArray(battleInfo?.mapOneInfoList)
    ? battleInfo.mapOneInfoList
        .map(storedRankRow)
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
    : [];

  return {
    ...snapshotMetadata(fetchedAt),
    data: storedGames(root.data),
    battleInfo: { mapOneInfoList: rankRows },
  };
}

export function toStoredLzyumiRecentStatSnapshot(value: unknown, fetchedAt = new Date()) {
  const root = asRecord(value);
  const data = asRecord(root?.data);
  if (!root || !data) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG recent-stat snapshot is not a valid JSON object.",
      "INVALID_SNAPSHOT",
    );
  }
  const recentState = asRecord(data.recentState) ?? {};

  const champions = Array.isArray(recentState.common_use_champions)
    ? recentState.common_use_champions
        .map((value) => {
          const champion = asRecord(value);
          if (!champion) return null;
          const key = optionalNumber(champion, "key");
          const games = optionalNumber(champion, "value");
          return key === undefined || games === undefined ? null : { key, value: games };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : [];

  return {
    ...snapshotMetadata(fetchedAt),
    data: {
      recentState: compactRecord([
        ["kda", optionalNumber(recentState, "kda")],
        ["common_use_champions", champions],
      ]),
    },
  };
}

export function isValidatedLzyumiSnapshot(value: unknown) {
  const root = asRecord(value);
  return root?._eclSnapshotVersion === LZYUMI_SNAPSHOT_VERSION;
}

export function shouldRefreshLzyumiSnapshots(
  rawProfile: unknown,
  rankedGames: unknown,
  lastLookupAt: Date | string | null | undefined,
  now = Date.now(),
) {
  if (
    !isValidatedLzyumiSnapshot(rawProfile) ||
    !isValidatedLzyumiSnapshot(rankedGames)
  ) return true;
  if (!lastLookupAt) return true;

  const timestamp = lastLookupAt instanceof Date
    ? lastLookupAt.getTime()
    : new Date(lastLookupAt).getTime();
  if (!Number.isFinite(timestamp)) return true;

  return now - timestamp >= LZYUMI_REFRESH_INTERVAL_MS;
}

export function normalizeLzyumiRankedGames(soloGames: unknown, flexGames: unknown) {
  if (!Array.isArray(soloGames) || !Array.isArray(flexGames)) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG ranked-game snapshot is incomplete.",
      "INVALID_SNAPSHOT",
    );
  }

  // The provider requests at most 20 rows per queue. Reject oversized client
  // payloads instead of persisting arbitrary JSON under an authenticated user.
  if (soloGames.length > 20 || flexGames.length > 20) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG ranked-game snapshot is larger than expected.",
      "INVALID_SNAPSHOT",
    );
  }

  return {
    _eclSnapshotVersion: LZYUMI_SNAPSHOT_VERSION,
    soloGames: storedGames(soloGames),
    flexGames: storedGames(flexGames),
  };
}

export function resolveLzyumiSnapshotRefresh(
  previous: ExistingLzyumiSnapshot,
  {
    profileResponse,
    soloResponse,
    flexResponse,
    recentStat,
    riotName,
    riotTag,
    areaId,
    existingOpenId,
    fetchedAt = new Date(),
  }: LzyumiSnapshotReplacementInput,
): LzyumiSnapshotRefreshResult {
  try {
    const rawProfile = validateLzyumiProfileResponse(profileResponse);
    const soloHistory = validateLzyumiHistoryResponse(soloResponse);
    const flexHistory = validateLzyumiHistoryResponse(flexResponse);
    const identity = validateLzyumiSnapshotIdentity({
      rawProfile,
      riotName,
      riotTag,
      areaId,
      existingOpenId,
    });
    const rankedGames = normalizeLzyumiRankedGames(soloHistory.data, flexHistory.data);
    const optionalRecentStat = validateLzyumiOptionalRecentStat(recentStat);

    return {
      status: "accepted",
      identity,
      rawProfile: toStoredLzyumiProfileSnapshot(rawProfile, fetchedAt),
      recentStat: optionalRecentStat.status === "available"
        ? toStoredLzyumiRecentStatSnapshot(optionalRecentStat.value, fetchedAt)
        : null,
      recentStatStatus: optionalRecentStat.status,
      rankedGames,
      fetchedAt,
    };
  } catch (error) {
    if (
      error instanceof LzyumiSnapshotValidationError ||
      error instanceof LzyumiBrowserContractError
    ) {
      return { status: "rejected", previous, error };
    }
    throw error;
  }
}
