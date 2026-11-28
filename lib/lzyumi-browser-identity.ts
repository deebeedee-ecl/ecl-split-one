import {
  LzyumiBrowserContractError,
  validateLzyumiProfileResponse,
} from "@/lib/lzyumi-browser-contract";
import { riotIdKey, splitRiotId } from "@/lib/riot-id";

export type LzyumiIdentityAttemptKind =
  | "bare-name"
  | "full-id"
  | "bare-name-with-open-id"
  | "full-id-with-open-id"
  | "open-id-only";

export type LzyumiIdentityAttempt = {
  kind: LzyumiIdentityAttemptKind;
  nickname: string;
  useSavedOpenId: boolean;
};

export type SignedLzyumiIdentityAttempt = Pick<LzyumiIdentityAttempt, "kind"> & {
  url: string;
};

export type LzyumiIdentityTerminalStatus =
  | "RESOLVED"
  | "IDENTITY_NOT_FOUND"
  | "IDENTITY_MISMATCH"
  | "INCOMPLETE_LOOKUP"
  | "THROTTLED"
  | "AUTH_FAILURE";

export type LzyumiIdentityAttemptResult = {
  kind: LzyumiIdentityAttemptKind;
  status: Exclude<LzyumiIdentityTerminalStatus, "RESOLVED">;
  providerCode?: number;
  httpStatus?: number;
  mismatch?: "riot-id" | "server";
};

export type ResolvedLzyumiBrowserIdentity = {
  status: "RESOLVED";
  attempt: LzyumiIdentityAttemptKind;
  attempts: LzyumiIdentityAttemptResult[];
  openId: string;
  resolvedRiotId: string;
  rawProfile: Record<string, unknown>;
};

export type FailedLzyumiBrowserIdentity = {
  status: Exclude<LzyumiIdentityTerminalStatus, "RESOLVED">;
  attempts: LzyumiIdentityAttemptResult[];
  mismatch?: "riot-id" | "server";
};

export type LzyumiBrowserIdentityOutcome =
  | ResolvedLzyumiBrowserIdentity
  | FailedLzyumiBrowserIdentity;

export class LzyumiResolvedIdentityError extends Error {
  constructor(
    message: string,
    readonly reason: "incomplete" | "riot-id" | "server",
  ) {
    super(message);
    this.name = "LzyumiResolvedIdentityError";
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function buildLzyumiIdentityAttempts({
  riotName,
  riotTag,
  hasSavedOpenId,
}: {
  riotName: string;
  riotTag: string;
  hasSavedOpenId: boolean;
}): LzyumiIdentityAttempt[] {
  const bareName = riotName.trim();
  const tag = riotTag.trim().replace(/^#+/, "");
  if (!bareName || !tag) return [];

  const fullId = `${bareName}#${tag}`;
  const attempts: LzyumiIdentityAttempt[] = [
    { kind: "bare-name", nickname: bareName, useSavedOpenId: false },
    { kind: "full-id", nickname: fullId, useSavedOpenId: false },
  ];

  if (hasSavedOpenId) {
    attempts.push(
      { kind: "bare-name-with-open-id", nickname: bareName, useSavedOpenId: true },
      { kind: "full-id-with-open-id", nickname: fullId, useSavedOpenId: true },
      { kind: "open-id-only", nickname: "", useSavedOpenId: true },
    );
  }

  return attempts;
}

export function verifyLzyumiResolvedIdentity(
  value: unknown,
  expectedRiotId: string,
  expectedAreaId: number,
) {
  const profile = asRecord(value);
  const battleInfo = asRecord(profile?.battleInfo);
  if (!profile || !battleInfo) {
    throw new LzyumiResolvedIdentityError(
      "ECL.GG did not return a complete identity.",
      "incomplete",
    );
  }
  const resolvedRiotId = clean(battleInfo.nameInfoNew);
  const resolved = splitRiotId(resolvedRiotId);
  const expected = splitRiotId(expectedRiotId);
  const openId = clean(battleInfo.openId);
  const areaId = Number(battleInfo.areaId);

  if (!resolvedRiotId || !openId || !Number.isInteger(areaId) || areaId <= 0) {
    throw new LzyumiResolvedIdentityError(
      "ECL.GG did not return a complete identity.",
      "incomplete",
    );
  }
  if (
    !expected.riotName ||
    !expected.riotTag ||
    riotIdKey(resolved.riotName, resolved.riotTag) !==
      riotIdKey(expected.riotName, expected.riotTag)
  ) {
    throw new LzyumiResolvedIdentityError(
      "ECL.GG resolved a different Riot ID.",
      "riot-id",
    );
  }
  if (areaId !== expectedAreaId) {
    throw new LzyumiResolvedIdentityError(
      "ECL.GG resolved the identity on a different China server.",
      "server",
    );
  }

  return { openId, resolvedRiotId, areaId, rawProfile: profile };
}

function classifyAttemptError(
  kind: LzyumiIdentityAttemptKind,
  error: unknown,
): LzyumiIdentityAttemptResult {
  if (error instanceof LzyumiResolvedIdentityError) {
    if (error.reason === "riot-id" || error.reason === "server") {
      return {
        kind,
        status: "IDENTITY_MISMATCH",
        mismatch: error.reason,
      };
    }
    return { kind, status: "INCOMPLETE_LOOKUP" };
  }

  if (error instanceof LzyumiBrowserContractError) {
    const metadata = {
      ...(error.providerCode === undefined ? {} : { providerCode: error.providerCode }),
      ...(error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus }),
    };
    if (error.kind === "authentication") {
      return { kind, status: "AUTH_FAILURE", ...metadata };
    }
    if (error.kind === "throttled") {
      return { kind, status: "THROTTLED", ...metadata };
    }
    if (error.kind === "not-found") {
      return { kind, status: "IDENTITY_NOT_FOUND", ...metadata };
    }
    return { kind, status: "INCOMPLETE_LOOKUP", ...metadata };
  }

  return { kind, status: "INCOMPLETE_LOOKUP" };
}

export async function resolveLzyumiBrowserIdentity({
  attempts,
  expectedRiotId,
  expectedAreaId,
  lookup,
}: {
  attempts: readonly SignedLzyumiIdentityAttempt[];
  expectedRiotId: string;
  expectedAreaId: number;
  lookup: (attempt: SignedLzyumiIdentityAttempt) => Promise<unknown>;
}): Promise<LzyumiBrowserIdentityOutcome> {
  const results: LzyumiIdentityAttemptResult[] = [];

  for (const attempt of attempts) {
    try {
      const raw = await lookup(attempt);
      const profile = validateLzyumiProfileResponse(raw);
      const identity = verifyLzyumiResolvedIdentity(profile, expectedRiotId, expectedAreaId);
      return {
        status: "RESOLVED",
        attempt: attempt.kind,
        attempts: results,
        ...identity,
      };
    } catch (error) {
      const result = classifyAttemptError(attempt.kind, error);
      results.push(result);
      if (result.status === "AUTH_FAILURE" || result.status === "THROTTLED") {
        return { status: result.status, attempts: results };
      }
    }
  }

  const incomplete = results.some((result) => result.status === "INCOMPLETE_LOOKUP");
  if (incomplete || results.length === 0) {
    return { status: "INCOMPLETE_LOOKUP", attempts: results };
  }

  const mismatch = results.find((result) => result.status === "IDENTITY_MISMATCH");
  if (mismatch) {
    return {
      status: "IDENTITY_MISMATCH",
      attempts: results,
      mismatch: mismatch.mismatch,
    };
  }

  return { status: "IDENTITY_NOT_FOUND", attempts: results };
}

export function lzyumiIdentityFailureMessage(outcome: FailedLzyumiBrowserIdentity) {
  switch (outcome.status) {
    case "AUTH_FAILURE":
      return "ECL.GG authentication is unavailable. Your previous snapshot was kept.";
    case "THROTTLED":
      return "ECL.GG is temporarily rate-limiting requests. Your previous snapshot was kept.";
    case "IDENTITY_NOT_FOUND":
      return "ECL.GG could not resolve that Riot identity. Your previous snapshot was kept.";
    case "IDENTITY_MISMATCH":
      return "ECL.GG resolved a different Riot identity or China server. Your previous snapshot was kept.";
    case "INCOMPLETE_LOOKUP":
      return "ECL.GG could not complete the identity lookup. Your previous snapshot was kept.";
  }
}
