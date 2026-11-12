export const LZYUMI_MANUAL_REFRESH_REQUEST_BUDGET = Object.freeze({
  profileFilters: Object.freeze([1, 2, 3] as const),
  recentStatRequests: 1 as const,
  snapshotSaveAttempts: 1 as const,
});

export type LzyumiRefreshPermitPolicy = {
  permitTtlMs: number;
  profileCooldownMs: number;
  requesterCooldownMs: number;
  requesterWindowMs: number;
  requesterMaxPermitsPerWindow: number;
};

export type LzyumiRefreshPermitTarget = {
  profileId: string;
  active: boolean;
  verified: boolean;
  riotName: string | null;
  riotTag: string | null;
  chinaServerId: number | null;
  openId: string | null;
  snapshotIsStale: boolean;
};

export type LzyumiRefreshPermitIssueInput = {
  now: Date;
  requesterProfileId: string | null;
  target: LzyumiRefreshPermitTarget;
  lastProfilePermitIssuedAt: Date | null;
  lastRequesterPermitIssuedAt: Date | null;
  requesterPermitCountInWindow: number;
  oldestRequesterPermitInWindowAt: Date | null;
};

export type LzyumiRefreshPermitRejectionCode =
  | "UNAUTHENTICATED"
  | "TARGET_UNAVAILABLE"
  | "IDENTITY_INCOMPLETE"
  | "SNAPSHOT_FRESH"
  | "PROFILE_COOLDOWN"
  | "REQUESTER_COOLDOWN"
  | "REQUESTER_BUDGET_EXHAUSTED";

export type LzyumiRefreshPermitIssueDecision =
  | {
      status: "allowed";
      actor: "owner" | "viewer";
      requesterProfileId: string;
      targetProfileId: string;
      expiresAt: Date;
      requestBudget: typeof LZYUMI_MANUAL_REFRESH_REQUEST_BUDGET;
    }
  | {
      status: "rejected";
      code: LzyumiRefreshPermitRejectionCode;
      retryAt: Date | null;
    };

function requirePositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
}

function validatePolicy(policy: LzyumiRefreshPermitPolicy) {
  requirePositiveInteger(policy.permitTtlMs, "permitTtlMs");
  requirePositiveInteger(policy.profileCooldownMs, "profileCooldownMs");
  requirePositiveInteger(policy.requesterCooldownMs, "requesterCooldownMs");
  requirePositiveInteger(policy.requesterWindowMs, "requesterWindowMs");
  requirePositiveInteger(
    policy.requesterMaxPermitsPerWindow,
    "requesterMaxPermitsPerWindow",
  );
}

function validDate(value: Date) {
  return Number.isFinite(value.getTime());
}

function requireValidDate(value: Date, name: string) {
  if (!validDate(value)) throw new Error(`${name} must be a valid date.`);
}

function cooldownRetryAt(
  lastIssuedAt: Date | null,
  cooldownMs: number,
  nowMs: number,
) {
  if (!lastIssuedAt) return null;
  requireValidDate(lastIssuedAt, "lastIssuedAt");

  const retryAtMs = lastIssuedAt.getTime() + cooldownMs;
  return retryAtMs > nowMs ? new Date(retryAtMs) : null;
}

function hasCompleteTargetIdentity(target: LzyumiRefreshPermitTarget) {
  return Boolean(
    target.riotName?.trim() &&
    target.riotTag?.trim() &&
    Number.isSafeInteger(target.chinaServerId) &&
    Number(target.chinaServerId) > 0 &&
    target.openId?.trim(),
  );
}

/**
 * Pure policy boundary for issuing an explicit browser refresh permit.
 *
 * Persistence must load the supplied attempt facts and insert the permit in one
 * serialized transaction. This function deliberately does not provide an
 * in-memory limiter or claim durability by itself.
 */
export function evaluateLzyumiRefreshPermitIssue(
  input: LzyumiRefreshPermitIssueInput,
  policy: LzyumiRefreshPermitPolicy,
): LzyumiRefreshPermitIssueDecision {
  validatePolicy(policy);
  requireValidDate(input.now, "now");

  const requesterProfileId = input.requesterProfileId?.trim() ?? "";
  if (!requesterProfileId) {
    return { status: "rejected", code: "UNAUTHENTICATED", retryAt: null };
  }

  if (
    !input.target.profileId.trim() ||
    !input.target.active ||
    !input.target.verified
  ) {
    return { status: "rejected", code: "TARGET_UNAVAILABLE", retryAt: null };
  }

  if (!hasCompleteTargetIdentity(input.target)) {
    return { status: "rejected", code: "IDENTITY_INCOMPLETE", retryAt: null };
  }

  if (!input.target.snapshotIsStale) {
    return { status: "rejected", code: "SNAPSHOT_FRESH", retryAt: null };
  }

  const nowMs = input.now.getTime();
  const profileRetryAt = cooldownRetryAt(
    input.lastProfilePermitIssuedAt,
    policy.profileCooldownMs,
    nowMs,
  );
  if (profileRetryAt) {
    return {
      status: "rejected",
      code: "PROFILE_COOLDOWN",
      retryAt: profileRetryAt,
    };
  }

  const requesterRetryAt = cooldownRetryAt(
    input.lastRequesterPermitIssuedAt,
    policy.requesterCooldownMs,
    nowMs,
  );
  if (requesterRetryAt) {
    return {
      status: "rejected",
      code: "REQUESTER_COOLDOWN",
      retryAt: requesterRetryAt,
    };
  }

  if (
    !Number.isSafeInteger(input.requesterPermitCountInWindow) ||
    input.requesterPermitCountInWindow < 0
  ) {
    throw new Error("requesterPermitCountInWindow must be a non-negative safe integer.");
  }

  if (input.requesterPermitCountInWindow >= policy.requesterMaxPermitsPerWindow) {
    const oldest = input.oldestRequesterPermitInWindowAt;
    if (!oldest) {
      throw new Error(
        "oldestRequesterPermitInWindowAt is required when the requester budget is exhausted.",
      );
    }
    requireValidDate(oldest, "oldestRequesterPermitInWindowAt");
    const retryAt = new Date(oldest.getTime() + policy.requesterWindowMs);
    if (retryAt.getTime() <= nowMs) {
      throw new Error(
        "oldestRequesterPermitInWindowAt must fall inside the requester window.",
      );
    }

    return {
      status: "rejected",
      code: "REQUESTER_BUDGET_EXHAUSTED",
      retryAt,
    };
  }

  return {
    status: "allowed",
    actor: requesterProfileId === input.target.profileId ? "owner" : "viewer",
    requesterProfileId,
    targetProfileId: input.target.profileId,
    expiresAt: new Date(nowMs + policy.permitTtlMs),
    requestBudget: LZYUMI_MANUAL_REFRESH_REQUEST_BUDGET,
  };
}

export type StoredLzyumiRefreshPermit = {
  requesterProfileId: string;
  targetProfileId: string;
  status: "ISSUED" | "COMPLETED" | "REJECTED" | "EXPIRED";
  expiresAt: Date;
};

export type LzyumiRefreshPermitUseDecision =
  | { status: "allowed" }
  | {
      status: "rejected";
      code:
        | "PERMIT_INVALID"
        | "PERMIT_EXPIRED"
        | "PERMIT_ALREADY_USED";
    };

/**
 * Validates binding and replay boundaries before a permit-backed snapshot save.
 * The storage adapter must still claim/complete the permit conditionally in the
 * same transaction as the coherent snapshot replacement.
 */
export function evaluateLzyumiRefreshPermitUse({
  permit,
  requesterProfileId,
  targetProfileId,
  now,
}: {
  permit: StoredLzyumiRefreshPermit | null;
  requesterProfileId: string;
  targetProfileId: string;
  now: Date;
}): LzyumiRefreshPermitUseDecision {
  requireValidDate(now, "now");

  if (
    !permit ||
    !requesterProfileId.trim() ||
    !targetProfileId.trim() ||
    permit.requesterProfileId !== requesterProfileId ||
    permit.targetProfileId !== targetProfileId
  ) {
    return { status: "rejected", code: "PERMIT_INVALID" };
  }

  if (permit.status !== "ISSUED") {
    return {
      status: "rejected",
      code: permit.status === "EXPIRED"
        ? "PERMIT_EXPIRED"
        : "PERMIT_ALREADY_USED",
    };
  }

  if (!validDate(permit.expiresAt)) {
    return { status: "rejected", code: "PERMIT_INVALID" };
  }
  if (permit.expiresAt.getTime() <= now.getTime()) {
    return { status: "rejected", code: "PERMIT_EXPIRED" };
  }

  return { status: "allowed" };
}
