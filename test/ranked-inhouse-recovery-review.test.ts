import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  buildReviewManifest,
  databaseDryRun,
  offlineDryRun,
  RECOVERY_DATABASE_URL_ENV,
  RECOVERY_OPERATION,
  RECOVERY_PRODUCTION_ENDPOINT,
  resolveBackendTarget,
  resolveBackendSecret,
  resolveReadOnlyDatabaseTarget,
  SUPPORTED_ACTIONS,
  type RecoveryScope,
} from "../scripts/ranked-inhouse-recovery-review-2026-11-15-to-17";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function detail(seed: number, count = 10) {
  return {
    code: 1,
    data: {
      gameType: "CUSTOM_GAME",
      gameMode: "CLASSIC",
      wgBattleDetailInfo: Array.from({ length: count }, (_, index) => ({
        nickNameStr: `Synthetic${seed}-${index}#${String(seed * 100 + index).padStart(5, "0")}`,
        openIdNow: `open-${seed}-${index}`,
        translateAreaId: 1,
        teamId: index < 5 ? "100" : "200",
        win: index < 5 ? "1" : "0",
        scoreInfo: "1/2/3",
      })),
    },
  };
}

function fixture() {
  const ids = ["provider-alpha", "provider-beta"];
  const scope: RecoveryScope = {
    sinceChinaDay: "2026-11-15",
    untilChinaDay: "2026-11-15",
    expectedGameCount: 2,
    providerSetHash: hash([...ids].sort()),
  };
  return {
    scope,
    discovery: {
      generatedAt: "2026-11-17T02:00:00.000Z",
      readOnly: true,
      candidates: ids.map((gameId, index) => ({
        gameId,
        gameTime: `2026-11-14T${String(16 + index).padStart(2, "0")}:00:00.000Z`,
        reviewStatus: index === 0 ? "EXCLUDE" : "ERROR",
        reasons: index === 0 ? ["synthetic roster threshold"] : ["synthetic partial detail"],
        raw: {
          game: { gameId, titleTime: `11-15 ${String(index).padStart(2, "0")}:00:00`, title: "用时30分15秒" },
          detail: index === 0 ? detail(index + 1) : null,
        },
      })),
    },
  };
}

test("dated recovery tool exposes no apply action", () => {
  assert.deepEqual(SUPPORTED_ACTIONS, ["prepare", "dry-run"]);
});

test("database mode requires a dedicated named non-local read-only target", () => {
  assert.equal(resolveReadOnlyDatabaseTarget([], {}), null);
  assert.throws(
    () => resolveReadOnlyDatabaseTarget(["--database"], {}),
    /production-read-only/,
  );
  assert.throws(
    () => resolveReadOnlyDatabaseTarget(["--database", "--target=production-read-only"], {}),
    new RegExp(RECOVERY_DATABASE_URL_ENV),
  );
  assert.throws(
    () => resolveReadOnlyDatabaseTarget(
      ["--database", "--target=production-read-only"],
      { [RECOVERY_DATABASE_URL_ENV]: "postgresql://reader:secret@127.0.0.1:5432/ecl" },
    ),
    /non-local read-only target/,
  );
  const target = resolveReadOnlyDatabaseTarget(
    ["--database", "--target=production-read-only"],
    { [RECOVERY_DATABASE_URL_ENV]: "postgresql://reader:secret@db.example.test:5432/ecl?schema=public" },
  );
  assert.equal(new URL(target!).searchParams.get("connection_limit"), "1");
});

test("backend mode is pinned to the exact production preflight endpoint", () => {
  assert.equal(resolveBackendTarget([]), null);
  assert.throws(() => resolveBackendTarget(["--backend"]), /production-backend-read-only/);
  assert.throws(
    () => resolveBackendTarget([
      "--backend",
      "--target=production-backend-read-only",
      "--endpoint=https://example.test/api/preflight",
    ]),
    /exact authorized production endpoint/,
  );
  assert.equal(resolveBackendTarget([
    "--backend",
    "--target=production-backend-read-only",
    `--endpoint=${RECOVERY_PRODUCTION_ENDPOINT}`,
  ]), RECOVERY_PRODUCTION_ENDPOINT);
});

test("backend auth prefers dedicated credentials and permits the approved KOOK fallback", () => {
  assert.equal(resolveBackendSecret({
    ECL_REPORT_ENGINE_SECRET: "report",
    ECL_JOB_SECRET: "job",
    ECL_KOOK_BOT_SECRET: "kook",
  }), "report");
  assert.equal(resolveBackendSecret({
    ECL_JOB_SECRET: "job",
    ECL_KOOK_BOT_SECRET: "kook",
  }), "job");
  assert.equal(resolveBackendSecret({ ECL_KOOK_BOT_SECRET: "kook" }), "kook");
  assert.equal(resolveBackendSecret({}), "");
});

test("review manifest stays bound to the exact provider set and China-date window", () => {
  const { discovery, scope } = fixture();
  const manifest = buildReviewManifest(discovery, scope, new Date("2026-11-17T03:00:00.000Z"));
  assert.equal(manifest.operationId, RECOVERY_OPERATION);
  assert.equal(manifest.readOnly, true);
  assert.equal(manifest.notify, false);
  assert.equal(manifest.games.length, 2);
  assert.deepEqual(manifest.games.map((game) => game.evidenceStatus), ["COMPLETE_10_OF_10", "PARTIAL_DETAIL"]);

  const replacement = structuredClone(discovery);
  replacement.candidates[1].gameId = "foreign-provider-id";
  replacement.candidates[1].raw.game.gameId = "foreign-provider-id";
  assert.throws(() => buildReviewManifest(replacement, scope), /authorized recovery scope/);
});

test("offline dry run blocks partial evidence and database-free approval", () => {
  const { discovery, scope } = fixture();
  const manifest = buildReviewManifest(discovery, scope);
  const result = offlineDryRun(manifest, scope);
  assert.equal(result.clean, false);
  assert.equal(result.applyAvailable, false);
  assert.deepEqual(result.blockers, ["GAME_2_DETAIL_INCOMPLETE", "DATABASE_PREFLIGHT_NOT_RUN"]);
  assert.equal(result.summary.completeGames, 1);
  assert.equal(result.summary.partialGames, 1);
  assert.equal(result.summary.completeParticipantRows, 10);
  assert.equal(result.games[0].durationSeconds, 1815);
});

test("manifest preparation rejects tournament exclusions and duplicate provider IDs", () => {
  const { discovery, scope } = fixture();
  const tournament = structuredClone(discovery);
  tournament.candidates[0].reviewStatus = "EXCLUDE_TOURNAMENT";
  assert.throws(() => buildReviewManifest(tournament, scope), /tournament game/);

  const duplicate = structuredClone(discovery);
  duplicate.candidates[1].gameId = duplicate.candidates[0].gameId;
  duplicate.candidates[1].raw.game.gameId = duplicate.candidates[0].gameId;
  assert.throws(() => buildReviewManifest(duplicate, scope), /exactly 2 unique provider games/);
});

test("database dry run reports every ranked and tournament deduplication boundary", async () => {
  const { discovery } = fixture();
  const partialDiscovery = { ...discovery, candidates: [discovery.candidates[1]] };
  const providerGameId = partialDiscovery.candidates[0].gameId;
  const scope: RecoveryScope = {
    sinceChinaDay: "2026-11-15",
    untilChinaDay: "2026-11-15",
    expectedGameCount: 1,
    providerSetHash: hash([providerGameId]),
  };
  const manifest = buildReviewManifest(partialDiscovery, scope);
  const db = {
    inhouseSession: { findMany: async () => [{ id: "session-collision" }] },
    matchGame: { findMany: async () => [{ id: "match-game-collision" }] },
    inhouseReportJob: { findMany: async () => [{ id: "report-job-collision" }] },
    tournamentReport: { findMany: async () => [{ id: "tournament-report-collision" }] },
    tournamentCollectionJob: { findMany: async () => [{ id: "collection-job-collision" }] },
  } as unknown as PrismaClient;
  const result = await databaseDryRun(manifest, db, scope);
  assert.equal(result.clean, false);
  assert.deepEqual(result.blockers, [
    "GAME_1_DETAIL_INCOMPLETE",
    "EXISTING_INHOUSE_SESSION_COLLISION",
    "EXISTING_MATCH_GAME_COLLISION",
    "EXISTING_REPORT_JOB_COLLISION",
    "TOURNAMENT_REPORT_COLLISION",
    "TOURNAMENT_COLLECTION_COLLISION",
  ]);
  assert.equal(result.summary.existingSessionCollisions, 1);
  assert.equal(result.summary.legacyGameCollisions, 1);
  assert.equal(result.summary.reportJobCollisions, 1);
  assert.equal(result.summary.tournamentCollisions, 1);
  assert.equal(result.summary.tournamentCollectionCollisions, 1);
});
