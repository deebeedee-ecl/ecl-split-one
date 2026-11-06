import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidatedLzyumiSnapshot,
  LzyumiSnapshotValidationError,
  markValidatedLzyumiSnapshot,
  normalizeLzyumiRankedGames,
  validateLzyumiSnapshotIdentity,
} from "../lib/lzyumi-snapshot";

const validProfile = {
  battleInfo: {
    nameInfoNew: "Kasper#82130",
    openId: "trusted-open-id",
    areaId: 1,
  },
};

test("accepts a snapshot for the saved Riot identity and openId", () => {
  assert.deepEqual(
    validateLzyumiSnapshotIdentity({
      rawProfile: validProfile,
      riotName: " Kasper ",
      riotTag: "#82130",
      areaId: 1,
      existingOpenId: "trusted-open-id",
    }),
    { openId: "trusted-open-id", resolvedName: "Kasper#82130" },
  );
});

test("rejects a provider response for a different Riot tag", () => {
  assert.throws(
    () =>
      validateLzyumiSnapshotIdentity({
        rawProfile: { battleInfo: { ...validProfile.battleInfo, nameInfoNew: "Kasper#75904" } },
        riotName: "Kasper",
        riotTag: "82130",
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
        riotName: "Kasper",
        riotTag: "82130",
        areaId: 1,
        existingOpenId: "another-open-id",
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
        riotName: "Kasper",
        riotTag: "82130",
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
