import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateLzyumiRefreshPermitIssue,
  evaluateLzyumiRefreshPermitUse,
  LZYUMI_MANUAL_REFRESH_REQUEST_BUDGET,
  type LzyumiRefreshPermitIssueInput,
  type LzyumiRefreshPermitPolicy,
} from "../lib/lzyumi-refresh-permit";

const minute = 60_000;
const now = new Date("2026-11-13T00:00:00.000Z");

const policy: LzyumiRefreshPermitPolicy = {
  permitTtlMs: 2 * minute,
  profileCooldownMs: 5 * minute,
  requesterCooldownMs: minute,
  requesterWindowMs: 24 * 60 * minute,
  requesterMaxPermitsPerWindow: 20,
};

function issueInput(
  overrides: Partial<LzyumiRefreshPermitIssueInput> = {},
): LzyumiRefreshPermitIssueInput {
  return {
    now,
    requesterProfileId: "synthetic-requester",
    target: {
      profileId: "synthetic-target",
      active: true,
      verified: true,
      riotName: "SyntheticPlayer",
      riotTag: "0001",
      chinaServerId: 1,
      openId: "synthetic-open-id",
      snapshotIsStale: true,
    },
    lastProfilePermitIssuedAt: null,
    lastRequesterPermitIssuedAt: null,
    requesterPermitCountInWindow: 0,
    oldestRequesterPermitInWindowAt: null,
    ...overrides,
  };
}

test("allows authenticated owners and viewers with the same bounded request bundle", () => {
  const viewer = evaluateLzyumiRefreshPermitIssue(issueInput(), policy);
  const ownerInput = issueInput();
  ownerInput.requesterProfileId = ownerInput.target.profileId;
  const owner = evaluateLzyumiRefreshPermitIssue(ownerInput, policy);

  assert.equal(viewer.status, "allowed");
  assert.equal(owner.status, "allowed");
  if (viewer.status !== "allowed" || owner.status !== "allowed") return;

  assert.equal(viewer.actor, "viewer");
  assert.equal(owner.actor, "owner");
  assert.deepEqual(viewer.requestBudget, LZYUMI_MANUAL_REFRESH_REQUEST_BUDGET);
  assert.deepEqual(owner.requestBudget, LZYUMI_MANUAL_REFRESH_REQUEST_BUDGET);
  assert.equal(viewer.expiresAt.toISOString(), "2026-11-13T00:02:00.000Z");
});

test("rejects unauthenticated, unavailable, incomplete-identity, and fresh targets", () => {
  const cases: Array<{
    input: LzyumiRefreshPermitIssueInput;
    code: string;
  }> = [
    {
      input: issueInput({ requesterProfileId: null }),
      code: "UNAUTHENTICATED",
    },
    {
      input: issueInput({
        target: { ...issueInput().target, active: false },
      }),
      code: "TARGET_UNAVAILABLE",
    },
    {
      input: issueInput({
        target: { ...issueInput().target, profileId: "" },
      }),
      code: "TARGET_UNAVAILABLE",
    },
    {
      input: issueInput({
        target: { ...issueInput().target, openId: null },
      }),
      code: "IDENTITY_INCOMPLETE",
    },
    {
      input: issueInput({
        target: { ...issueInput().target, snapshotIsStale: false },
      }),
      code: "SNAPSHOT_FRESH",
    },
  ];

  for (const entry of cases) {
    const decision = evaluateLzyumiRefreshPermitIssue(entry.input, policy);
    assert.equal(decision.status, "rejected");
    if (decision.status === "rejected") assert.equal(decision.code, entry.code);
  }
});

test("enforces profile and requester cooldown boundaries without extending them", () => {
  const profileBlocked = evaluateLzyumiRefreshPermitIssue(issueInput({
    lastProfilePermitIssuedAt: new Date(now.getTime() - 4 * minute),
  }), policy);
  assert.deepEqual(profileBlocked, {
    status: "rejected",
    code: "PROFILE_COOLDOWN",
    retryAt: new Date(now.getTime() + minute),
  });

  const requesterBlocked = evaluateLzyumiRefreshPermitIssue(issueInput({
    lastRequesterPermitIssuedAt: new Date(now.getTime() - 30_000),
  }), policy);
  assert.deepEqual(requesterBlocked, {
    status: "rejected",
    code: "REQUESTER_COOLDOWN",
    retryAt: new Date(now.getTime() + 30_000),
  });

  const boundaryAllowed = evaluateLzyumiRefreshPermitIssue(issueInput({
    lastProfilePermitIssuedAt: new Date(now.getTime() - policy.profileCooldownMs),
    lastRequesterPermitIssuedAt: new Date(now.getTime() - policy.requesterCooldownMs),
  }), policy);
  assert.equal(boundaryAllowed.status, "allowed");
});

test("enforces a durable rolling requester budget with an explicit retry time", () => {
  const oldest = new Date(now.getTime() - 23 * 60 * minute);
  const decision = evaluateLzyumiRefreshPermitIssue(issueInput({
    requesterPermitCountInWindow: policy.requesterMaxPermitsPerWindow,
    oldestRequesterPermitInWindowAt: oldest,
  }), policy);

  assert.deepEqual(decision, {
    status: "rejected",
    code: "REQUESTER_BUDGET_EXHAUSTED",
    retryAt: new Date(now.getTime() + 60 * minute),
  });
});

test("fails closed when persistence facts or policy configuration are incoherent", () => {
  assert.throws(
    () => evaluateLzyumiRefreshPermitIssue(issueInput({
      requesterPermitCountInWindow: policy.requesterMaxPermitsPerWindow,
    }), policy),
    /oldestRequesterPermitInWindowAt/,
  );
  assert.throws(
    () => evaluateLzyumiRefreshPermitIssue(issueInput(), {
      ...policy,
      requesterCooldownMs: 0,
    }),
    /requesterCooldownMs/,
  );
  assert.throws(
    () => evaluateLzyumiRefreshPermitIssue(issueInput({
      requesterPermitCountInWindow: policy.requesterMaxPermitsPerWindow,
      oldestRequesterPermitInWindowAt: new Date(
        now.getTime() - policy.requesterWindowMs,
      ),
    }), policy),
    /must fall inside the requester window/,
  );
});

test("permit use is bound to requester and target, expires, and rejects replay", () => {
  const permit = {
    requesterProfileId: "synthetic-requester",
    targetProfileId: "synthetic-target",
    status: "ISSUED" as const,
    expiresAt: new Date(now.getTime() + 2 * minute),
  };

  assert.deepEqual(evaluateLzyumiRefreshPermitUse({
    permit,
    requesterProfileId: permit.requesterProfileId,
    targetProfileId: permit.targetProfileId,
    now,
  }), { status: "allowed" });
  assert.deepEqual(evaluateLzyumiRefreshPermitUse({
    permit,
    requesterProfileId: "different-requester",
    targetProfileId: permit.targetProfileId,
    now,
  }), { status: "rejected", code: "PERMIT_INVALID" });
  assert.deepEqual(evaluateLzyumiRefreshPermitUse({
    permit,
    requesterProfileId: permit.requesterProfileId,
    targetProfileId: permit.targetProfileId,
    now: permit.expiresAt,
  }), { status: "rejected", code: "PERMIT_EXPIRED" });
  assert.deepEqual(evaluateLzyumiRefreshPermitUse({
    permit: { ...permit, status: "COMPLETED" },
    requesterProfileId: permit.requesterProfileId,
    targetProfileId: permit.targetProfileId,
    now,
  }), { status: "rejected", code: "PERMIT_ALREADY_USED" });
  assert.deepEqual(evaluateLzyumiRefreshPermitUse({
    permit: { ...permit, expiresAt: new Date("invalid") },
    requesterProfileId: permit.requesterProfileId,
    targetProfileId: permit.targetProfileId,
    now,
  }), { status: "rejected", code: "PERMIT_INVALID" });
});
