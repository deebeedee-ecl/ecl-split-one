import { riotIdKey, splitRiotId } from "@/lib/riot-id";

export const LZYUMI_SNAPSHOT_VERSION = 2;

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

export function markValidatedLzyumiSnapshot(value: unknown, fetchedAt = new Date()) {
  const root = asRecord(value);
  if (!root) {
    throw new LzyumiSnapshotValidationError(
      "The ECL.GG snapshot is not a JSON object.",
      "INVALID_SNAPSHOT",
    );
  }

  return {
    ...root,
    _eclSnapshotVersion: LZYUMI_SNAPSHOT_VERSION,
    _eclFetchedAt: fetchedAt.toISOString(),
  };
}

export function isValidatedLzyumiSnapshot(value: unknown) {
  const root = asRecord(value);
  return root?._eclSnapshotVersion === LZYUMI_SNAPSHOT_VERSION;
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
    soloGames,
    flexGames,
  };
}
