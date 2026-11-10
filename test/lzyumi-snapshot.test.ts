import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidatedLzyumiSnapshot,
  LzyumiSnapshotValidationError,
  markValidatedLzyumiSnapshot,
  normalizeLzyumiRankedGames,
  resolveLzyumiSnapshotRefresh,
  shouldRefreshLzyumiSnapshots,
  validateLzyumiSnapshotIdentity,
} from "../lib/lzyumi-snapshot";

const validProfile = {
  code: 1,
  battleInfo: {
    nameInfoNew: "ContractTester#T100",
    openId: "synthetic-open-id",
    areaId: 1,
    mapOneInfoList: [],
  },
  data: [],
};

test("accepts a snapshot for the saved Riot identity and openId", () => {
  assert.deepEqual(
    validateLzyumiSnapshotIdentity({
      rawProfile: validProfile,
      riotName: " ContractTester ",
      riotTag: "#T100",
      areaId: 1,
      existingOpenId: "synthetic-open-id",
    }),
    { openId: "synthetic-open-id", resolvedName: "ContractTester#T100" },
  );
});

test("rejects a provider response for a different Riot tag", () => {
  assert.throws(
    () =>
      validateLzyumiSnapshotIdentity({
        rawProfile: {
          ...validProfile,
          battleInfo: { ...validProfile.battleInfo, nameInfoNew: "ContractTester#T200" },
        },
        riotName: "ContractTester",
        riotTag: "T100",
        areaId: 1,
      }),
    (error) =>
      error instanceof LzyumiSnapshotValidationError && error.code === "IDENTITY_MISMATCH",
  );
});

test("rejects a changed openId during an automatic refresh", () => {
  assert.throws(
    () =>
      validateLzyumiSnapshotIdentity({
        rawProfile: validProfile,
        riotName: "ContractTester",
        riotTag: "T100",
        areaId: 1,
        existingOpenId: "different-synthetic-open-id",
      }),
    (error) =>
      error instanceof LzyumiSnapshotValidationError && error.code === "OPEN_ID_MISMATCH",
  );
});

test("rejects a snapshot from another China server", () => {
  assert.throws(
    () =>
      validateLzyumiSnapshotIdentity({
        rawProfile: validProfile,
        riotName: "ContractTester",
        riotTag: "T100",
        areaId: 14,
      }),
    (error) =>
      error instanceof LzyumiSnapshotValidationError && error.code === "SERVER_MISMATCH",
  );
});

test("requires complete bounded ranked-game arrays", () => {
  assert.deepEqual(normalizeLzyumiRankedGames([], []), {
    _eclSnapshotVersion: 2,
    soloGames: [],
    flexGames: [],
  });
  assert.throws(() => normalizeLzyumiRankedGames(undefined, []), LzyumiSnapshotValidationError);
  assert.throws(
    () => normalizeLzyumiRankedGames(Array.from({ length: 21 }), []),
    LzyumiSnapshotValidationError,
  );
});

test("marks only newly validated snapshots as displayable", () => {
  assert.equal(isValidatedLzyumiSnapshot(validProfile), false);
  const marked = markValidatedLzyumiSnapshot(validProfile, new Date("2026-11-06T14:00:00.000Z"));
  assert.equal(isValidatedLzyumiSnapshot(marked), true);
  assert.equal(marked._eclFetchedAt, "2026-11-06T14:00:00.000Z");
});

test("refreshes missing, legacy, and stale snapshots but keeps a fresh pair", () => {
  const now = new Date("2026-11-07T12:00:00.000Z").getTime();
  const raw = markValidatedLzyumiSnapshot(validProfile);
  const ranked = normalizeLzyumiRankedGames([], []);

  assert.equal(shouldRefreshLzyumiSnapshots(null, ranked, new Date(now), now), true);
  assert.equal(shouldRefreshLzyumiSnapshots(validProfile, ranked, new Date(now), now), true);
  assert.equal(
    shouldRefreshLzyumiSnapshots(raw, ranked, "2026-11-07T01:00:01.000Z", now),
    false,
  );
  assert.equal(
    shouldRefreshLzyumiSnapshots(raw, ranked, "2026-11-07T00:00:00.000Z", now),
    true,
  );
});

test("keeps the previous snapshot and timestamp when required history is rejected", () => {
  const previous = {
    rawProfile: { marker: "previous-profile" },
    recentStat: { marker: "previous-recent" },
    rankedGames: { marker: "previous-history" },
    lastLookupAt: "2026-11-09T10:00:00.000Z",
  };
  const result = resolveLzyumiSnapshotRefresh(previous, {
    profileResponse: validProfile,
    soloResponse: { code: 7, data: [] },
    flexResponse: { code: 1, data: [] },
    recentStat: { status: "unavailable", reason: "throttled" },
    riotName: "ContractTester",
    riotTag: "T100",
    areaId: 1,
    existingOpenId: "synthetic-open-id",
    fetchedAt: new Date("2026-11-10T10:00:00.000Z"),
  });

  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.equal(result.previous, previous);
  assert.equal(result.previous.lastLookupAt, "2026-11-09T10:00:00.000Z");
  assert.deepEqual(result.previous.rawProfile, { marker: "previous-profile" });
  assert.equal(result.error.message.includes("provider code 7"), true);
});

test("accepts a complete core snapshot while marking optional recent stats unavailable", () => {
  const previous = {
    rawProfile: { marker: "previous-profile" },
    recentStat: { marker: "stale-recent-must-not-survive" },
    rankedGames: { marker: "previous-history" },
    lastLookupAt: "2026-11-09T10:00:00.000Z",
  };
  const result = resolveLzyumiSnapshotRefresh(previous, {
    profileResponse: validProfile,
    soloResponse: { code: 1, data: [{ gameId: "synthetic-solo-game" }] },
    flexResponse: { code: 1, data: [] },
    recentStat: { status: "unavailable", reason: "http-error" },
    riotName: "ContractTester",
    riotTag: "T100",
    areaId: 1,
    existingOpenId: "synthetic-open-id",
    fetchedAt: new Date("2026-11-10T10:00:00.000Z"),
  });

  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.recentStatStatus, "unavailable");
  assert.equal(result.recentStat, null);
  assert.deepEqual(result.rankedGames.soloGames, [{ gameId: "synthetic-solo-game" }]);
  assert.equal(result.rawProfile._eclFetchedAt, "2026-11-10T10:00:00.000Z");
});
