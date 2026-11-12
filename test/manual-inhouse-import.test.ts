import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  classifyExistingManualImport,
  MANUAL_INHOUSE_IMPORT_OPERATION,
  MANUAL_INHOUSE_IMPORT_TARGET,
  manualInhouseImportScopeIssues,
  parseManualInhouseImportManifest,
  providerProfileIdentityIssues,
} from "../lib/manual-inhouse-import";

test("worker-secret route stays outside the admin cookie middleware", () => {
  assert.equal(existsSync("app/api/jobs/inhouse-backfill-2026-11-12/route.ts"), true);
  assert.equal(existsSync("app/api/admin/inhouse/backfill-2026-11-12/route.ts"), false);
});

function syntheticManifest() {
  const chinaHours = [20, 21, 21, 22, 23];
  const chinaMinutes = [30, 7, 44, 29, 51];
  return {
    operationId: MANUAL_INHOUSE_IMPORT_OPERATION,
    target: MANUAL_INHOUSE_IMPORT_TARGET,
    notify: false,
    games: Array.from({ length: 5 }, (_, gameIndex) => ({
      providerGameId: String(900_000 + gameIndex),
      playedAt: `2026-11-12T${String(chinaHours[gameIndex] - 8).padStart(2, "0")}:${String(chinaMinutes[gameIndex]).padStart(2, "0")}:04.000Z`,
      game: {
        gameId: String(900_000 + gameIndex),
        titleTime: `11-12 ${String(chinaHours[gameIndex]).padStart(2, "0")}:${String(chinaMinutes[gameIndex]).padStart(2, "0")}:04`,
        title: "用时30分15秒",
      },
      detail: {
        code: 1,
        data: {
          gameType: "CUSTOM_GAME",
          gameMode: "CLASSIC",
          wgBattleDetailInfo: Array.from({ length: 10 }, (_, playerIndex) => ({
            nickNameStr: `Synthetic${playerIndex + 1}#${String(playerIndex + 1).padStart(5, "0")}`,
            openIdNow: `synthetic-open-${playerIndex + 1}`,
            translateAreaId: 1,
            teamId: playerIndex < 5 ? "100" : "200",
            win: playerIndex < 5 ? "1" : "0",
            scoreInfo: "1/2/3",
            echartsMap: { goldEarned: 10_000, totalDamageDealt: 20_000 },
          })),
        },
      },
      excludedRiotIds: ["Synthetic10#00010"],
    })),
  };
}

test("manifest validation rejects any replacement five-game set", () => {
  assert.throws(
    () => parseManualInhouseImportManifest(syntheticManifest()),
    /not the authorized five-game provider set/,
  );
});

test("manifest validation requires one explicit exclusion in every game", () => {
  const manifest = syntheticManifest();
  manifest.games[2].excludedRiotIds = [];
  assert.throws(
    () => parseManualInhouseImportManifest(manifest),
    /exactly one explicitly excluded Riot ID/,
  );
});

test("scope validation independently rejects a foreign game set and exclusion", () => {
  assert.deepEqual(
    manualInhouseImportScopeIssues(["1", "2", "3", "4", "5"], ["synthetic#00001"]),
    ["PROVIDER_GAME_SET_MISMATCH", "EXCLUDED_IDENTITY_MISMATCH"],
  );
});

test("provider identity requires full Riot ID, Ionia openId, active verification, and KOOK linkage", () => {
  const coherent = {
    participant: { riotName: "Synthetic", riotTag: "12345", areaId: 1, openId: "stable-open-id" },
    profile: {
      riotName: "Synthetic", riotTag: "12345", chinaServerId: 1, openId: "stable-open-id",
      kookId: "stable-kook-id", verificationStatus: "VERIFIED", accountStatus: "ACTIVE",
    },
  };
  assert.deepEqual(providerProfileIdentityIssues(coherent), []);
  assert.deepEqual(providerProfileIdentityIssues({
    ...coherent,
    profile: {
      ...coherent.profile,
      riotTag: "54321",
      chinaServerId: 2,
      openId: "different-open-id",
      kookId: null,
      verificationStatus: "PENDING_KOOK",
    },
  }), [
    "FULL_RIOT_ID_MISMATCH",
    "CHINA_SERVER_MISMATCH",
    "OPEN_ID_MISMATCH",
    "KOOK_ID_MISSING",
    "PROFILE_NOT_ACTIVE_VERIFIED",
  ]);
});

test("idempotency recognizes only complete rows from this exact operation", () => {
  const requested = ["game-1", "game-2"];
  const complete = requested.map((lzyumiGameId) => ({
    lzyumiGameId,
    status: "COMPLETED",
    matchId: `match-${lzyumiGameId}`,
    matchGameId: `match-game-${lzyumiGameId}`,
    reportRawJson: { source: "manual-inhouse-backfill", operationId: MANUAL_INHOUSE_IMPORT_OPERATION },
  }));
  assert.deepEqual(classifyExistingManualImport(requested, complete), {
    providerGameIds: requested,
    completedProviderGameIds: requested,
    partialProviderGameIds: [],
  });

  const foreign = [{ ...complete[0], reportRawJson: { source: "kook-inhouse-report" } }];
  assert.deepEqual(classifyExistingManualImport(requested, foreign), {
    providerGameIds: ["game-1"],
    completedProviderGameIds: [],
    partialProviderGameIds: ["game-1"],
  });
});
