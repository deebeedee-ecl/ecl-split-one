import assert from "node:assert/strict";
import test from "node:test";
import {
  INHOUSE_MATCH_FILTER,
  isInhouseRoundLabel,
} from "../lib/inhouse-filter";
import { MANUAL_INHOUSE_IMPORT_DEFINITION_BASE } from "../lib/manual-inhouse-import";
import { isRankedInhouse } from "../lib/ranked-season";

test("manual ranked-inhouse imports stay visible to history and ladder filters", () => {
  const currentManualLabel = `${MANUAL_INHOUSE_IMPORT_DEFINITION_BASE.labelPrefix} 2026-11-17 21:27`;
  assert.equal(MANUAL_INHOUSE_IMPORT_DEFINITION_BASE.labelPrefix, "IH Manual");
  assert.equal(isInhouseRoundLabel(currentManualLabel), true);
  assert.equal(isRankedInhouse(currentManualLabel), true);

  // The first permanent manual import shipped with this legacy prefix, so the
  // read model must continue to include that already-persisted result.
  assert.equal(isInhouseRoundLabel("Manual IH 2026-11-17 21:27"), true);
  assert.equal(isRankedInhouse("Manual IH 2026-11-17 21:27"), true);
  assert.deepEqual(INHOUSE_MATCH_FILTER, {
    matchGame: {
      match: {
        OR: [
          { roundLabel: { startsWith: "IH" } },
          { roundLabel: { startsWith: "Manual IH" } },
          { roundLabel: "Ranked Inhouse" },
        ],
      },
    },
  });
});

test("unrelated match labels remain outside ranked inhouse state", () => {
  assert.equal(isInhouseRoundLabel("Split II Semifinal"), false);
  assert.equal(isRankedInhouse("Split II Semifinal"), false);
  assert.equal(isInhouseRoundLabel(null), false);
});
