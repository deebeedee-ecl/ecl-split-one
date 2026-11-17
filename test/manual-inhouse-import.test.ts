import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  buildManualInhouseImportManifest,
  MANUAL_INHOUSE_IMPORT_APPLY_OPERATION,
  manualInhouseImportDefinition,
} from "../lib/manual-inhouse-import";
import { preflightRankedInhouseImport } from "../lib/ranked-inhouse-import";
import { POST as manualImportPost } from "../app/api/jobs/manual-inhouse-import/route";

const providerGameId = "synthetic-manual-game";

function participant(index: number, participantCount = 10) {
  const win = index < participantCount / 2;
  return {
    nickNameStr: `Synthetic${index}#ECL`,
    openIdNow: `open-${index}`,
    translateAreaId: 1,
    teamId: win ? "100" : "200",
    win: win ? "1" : "0",
    scoreInfo: win ? "5/1/8" : "1/5/2",
    goldEarned: 10_000,
    totalDamageDealt: 20_000,
  };
}

function discovery(count = 10, mode = "CLASSIC") {
  return {
    generatedAt: "2026-12-02T03:00:00.000Z",
    readOnly: true,
    candidates: [{
      gameId: providerGameId,
      gameTime: "2026-12-01T12:00:00.000Z",
      reviewStatus: "REVIEW",
      reasons: [],
      raw: {
        game: { gameId: providerGameId, titleTime: "12-1 20:00:00", title: "用时30分15秒" },
        detail: {
          code: 1,
          data: {
            gameType: "CUSTOM_GAME",
            gameMode: mode,
            wgBattleDetailInfo: Array.from({ length: count }, (_, index) => participant(index, count)),
          },
        },
      },
    }],
  };
}

function review({ approved = true, fillerSlots = 0, kiwi = false } = {}) {
  return {
    batchId: "manual-inhouse-2026-12-01-synthetic",
    sinceChinaDay: "2026-12-01",
    untilChinaDay: "2026-12-01",
    confirmedAsRankedInhouseCandidates: true,
    approvedUnregisteredParticipants: approved,
    games: [{
      providerGameId,
      ownerAuthorizedUnregisteredFillerSlots: fillerSlots,
      allowProviderModeKiwi: kiwi,
    }],
  };
}

function database({ foreignCollision = false, existing = false, profileIndexes = [0, 5] } = {}) {
  const profiles = profileIndexes.map((index) => ({
    id: `profile-${index}`,
    displayName: `Synthetic ${index}`,
    email: `synthetic-${index}@example.test`,
    riotName: `Synthetic${index}`,
    riotTag: "ECL",
    chinaServerId: 1,
    openId: `open-${index}`,
    kookId: `kook-${index}`,
    verificationStatus: "VERIFIED",
    accountStatus: "ACTIVE",
  }));
  const players = profileIndexes.map((index) => ({
    id: `player-${index}`,
    name: `Synthetic ${index}`,
    riotName: `Synthetic${index}`,
    riotTag: "ECL",
    email: `synthetic-${index}@example.test`,
    elo: 800,
    winStreak: 0,
    lossStreak: 0,
  }));
  return {
    inhouseSession: {
      findMany: async () => foreignCollision
        ? [{ id: "foreign", lzyumiGameId: providerGameId, status: "ASSIGNED", matchId: null, matchGameId: null }]
        : existing
          ? [{ id: "session-1", lzyumiGameId: providerGameId, status: "COMPLETED", matchId: "match-1", matchGameId: "match-game-1" }]
          : [],
    },
    matchGame: {
      findMany: async () => existing ? [{
        id: "match-game-1",
        ocrRawJson: { recentMatch: { gameId: providerGameId } },
        playerStats: [
          { id: "stat-0", playerId: "player-0", isWin: true, kills: 5, deaths: 1, assists: 8 },
          { id: "stat-5", playerId: "player-5", isWin: false, kills: 1, deaths: 5, assists: 2 },
        ],
      }] : [],
    },
    inhouseReportJob: { findMany: async () => [] },
    tournamentReport: { findMany: async () => [] },
    tournamentCollectionJob: { findMany: async () => [] },
    accountProfile: { findMany: async () => profiles },
    player: { findMany: async () => players },
    matchGamePlayerStat: { findMany: async () => [] },
  } as unknown as PrismaClient;
}

test("manual manifest selects an exact reviewed provider set without notifications", () => {
  const manifest = buildManualInhouseImportManifest(discovery(), review(), new Date("2026-12-02T04:00:00.000Z"));
  assert.equal(manifest.batchId, "manual-inhouse-2026-12-01-synthetic");
  assert.equal(manifest.notify, false);
  assert.equal(manifest.games.length, 1);
  assert.equal(manifest.games[0].durationSeconds, 1815);
  assert.equal(manifest.games[0].evidenceStatus, "COMPLETE_10_OF_10");
  assert.equal(manifest.scope.expectedGameCount, 1);
  assert.match(manifest.scope.providerSetHash, /^[a-f0-9]{64}$/);
});

test("manual preflight excludes owner-approved unregistered players and remains idempotent", async () => {
  const manifest = buildManualInhouseImportManifest(discovery(), review());
  const definition = manualInhouseImportDefinition(manifest);
  const plan = await preflightRankedInhouseImport(manifest, definition, database());
  assert.equal(plan.clean, true);
  assert.equal(plan.summary.operationId, MANUAL_INHOUSE_IMPORT_APPLY_OPERATION);
  assert.equal(plan.summary.gamesToInsert, 1);
  assert.equal(plan.summary.eligibleStatRowsToInsert, 2);
  assert.equal(plan.summary.excludedObservedParticipants, 8);
  assert.equal(plan.games[0].eligibleParticipants, 2);
  assert.ok(plan.warnings.includes("OWNER_AUTHORIZED_UNREGISTERED_PARTICIPANTS_EXCLUDED"));
});

test("manual preflight blocks unregistered participants without batch approval", async () => {
  const manifest = buildManualInhouseImportManifest(discovery(), review({ approved: false }));
  const plan = await preflightRankedInhouseImport(
    manifest,
    manualInhouseImportDefinition(manifest),
    database({ profileIndexes: [0, 1] }),
  );
  assert.equal(plan.clean, false);
  assert.ok(plan.blockers.includes("UNREGISTERED_PARTICIPANTS_REQUIRE_OWNER_APPROVAL"));
});

test("partial and KIWI evidence require exact explicit review overrides", async () => {
  assert.throws(
    () => buildManualInhouseImportManifest(discovery(2, "KIWI"), review({ fillerSlots: 0, kiwi: true })),
    /authorize exactly 8 unknown filler slot/,
  );
  const manifest = buildManualInhouseImportManifest(
    discovery(2, "KIWI"),
    review({ fillerSlots: 8, kiwi: true }),
  );
  const plan = await preflightRankedInhouseImport(
    manifest,
    manualInhouseImportDefinition(manifest),
    database({ profileIndexes: [0, 1] }),
  );
  assert.equal(plan.clean, true);
  assert.ok(plan.warnings.includes("GAME_1_PROVIDER_MODE_KIWI_OWNER_CONFIRMED"));
});

test("manual import blocks tournament evidence and foreign partial collisions", async () => {
  const tournament = discovery();
  tournament.candidates[0].reviewStatus = "EXCLUDE_TOURNAMENT";
  assert.throws(() => buildManualInhouseImportManifest(tournament, review()), /tournament game/);

  const manifest = buildManualInhouseImportManifest(discovery(), review());
  const plan = await preflightRankedInhouseImport(
    manifest,
    manualInhouseImportDefinition(manifest),
    database({ foreignCollision: true }),
  );
  assert.equal(plan.clean, false);
  assert.ok(plan.blockers.includes("GAME_1_FOREIGN_OR_PARTIAL_COLLISION"));
});

test("manual preflight treats a coherent existing provider game as an idempotent no-op", async () => {
  const manifest = buildManualInhouseImportManifest(discovery(), review());
  const plan = await preflightRankedInhouseImport(
    manifest,
    manualInhouseImportDefinition(manifest),
    database({ existing: true }),
  );
  assert.equal(plan.clean, true);
  assert.equal(plan.summary.gamesToInsert, 0);
  assert.equal(plan.summary.alreadyPresentGames, 1);
  assert.equal(plan.summary.eligibleStatRowsToInsert, 0);
  assert.equal(plan.games[0].mode, "EXISTING");
});

test("manual server definition rejects oversized or malformed scopes", () => {
  const manifest = buildManualInhouseImportManifest(discovery(), review());
  const malformed = structuredClone(manifest);
  malformed.scope.expectedGameCount = 51;
  assert.throws(() => manualInhouseImportDefinition(malformed), /game count must be 1-50/);
});

test("manual endpoint fails closed and does not accept the KOOK fallback credential", async () => {
  const previousReport = process.env.ECL_REPORT_ENGINE_SECRET;
  const previousJob = process.env.ECL_JOB_SECRET;
  const previousKook = process.env.ECL_KOOK_BOT_SECRET;
  process.env.ECL_REPORT_ENGINE_SECRET = "dedicated-test-secret";
  delete process.env.ECL_JOB_SECRET;
  process.env.ECL_KOOK_BOT_SECRET = "legacy-kook-test-secret";
  try {
    const response = await manualImportPost(new Request("http://localhost/api/jobs/manual-inhouse-import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ecl-kook-secret": "legacy-kook-test-secret",
        "x-ecl-manual-inhouse-operation": MANUAL_INHOUSE_IMPORT_APPLY_OPERATION,
      },
      body: "{}",
    }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, code: "UNAUTHORIZED" });
  } finally {
    if (previousReport === undefined) delete process.env.ECL_REPORT_ENGINE_SECRET;
    else process.env.ECL_REPORT_ENGINE_SECRET = previousReport;
    if (previousJob === undefined) delete process.env.ECL_JOB_SECRET;
    else process.env.ECL_JOB_SECRET = previousJob;
    if (previousKook === undefined) delete process.env.ECL_KOOK_BOT_SECRET;
    else process.env.ECL_KOOK_BOT_SECRET = previousKook;
  }
});

test("manual endpoint requires the exact operation and JSON action envelope", async () => {
  const previousReport = process.env.ECL_REPORT_ENGINE_SECRET;
  const previousJob = process.env.ECL_JOB_SECRET;
  process.env.ECL_REPORT_ENGINE_SECRET = "dedicated-test-secret";
  delete process.env.ECL_JOB_SECRET;
  try {
    const headers = { "x-ecl-report-engine-secret": "dedicated-test-secret" };
    const wrongOperation = await manualImportPost(new Request("http://localhost/api/jobs/manual-inhouse-import", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", "x-ecl-manual-inhouse-operation": "wrong" },
      body: "{}",
    }));
    assert.equal(wrongOperation.status, 403);

    const wrongType = await manualImportPost(new Request("http://localhost/api/jobs/manual-inhouse-import", {
      method: "POST",
      headers: { ...headers, "content-type": "text/plain", "x-ecl-manual-inhouse-operation": MANUAL_INHOUSE_IMPORT_APPLY_OPERATION },
      body: "{}",
    }));
    assert.equal(wrongType.status, 415);

    const wrongAction = await manualImportPost(new Request("http://localhost/api/jobs/manual-inhouse-import", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", "x-ecl-manual-inhouse-operation": MANUAL_INHOUSE_IMPORT_APPLY_OPERATION },
      body: "{}",
    }));
    assert.equal(wrongAction.status, 400);
    assert.deepEqual(await wrongAction.json(), { ok: false, code: "INVALID_ACTION" });
  } finally {
    if (previousReport === undefined) delete process.env.ECL_REPORT_ENGINE_SECRET;
    else process.env.ECL_REPORT_ENGINE_SECRET = previousReport;
    if (previousJob === undefined) delete process.env.ECL_JOB_SECRET;
    else process.env.ECL_JOB_SECRET = previousJob;
  }
});
