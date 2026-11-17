import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  preflightRankedInhouseRecovery,
  RECOVERY_APPLY_OPERATION,
} from "../lib/ranked-inhouse-recovery-apply-2026-11-15-to-17";
import {
  RECOVERY_OPERATION,
  RECOVERY_TARGET,
  type RecoveryScope,
} from "../lib/ranked-inhouse-recovery-review-2026-11-15-to-17";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const providerGameId = "synthetic-recovery-game";
const scope: RecoveryScope = {
  sinceChinaDay: "2026-11-15",
  untilChinaDay: "2026-11-15",
  expectedGameCount: 1,
  providerSetHash: hash([providerGameId]),
};

function participant(index: number, win: boolean) {
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

function manifest() {
  return {
    operationId: RECOVERY_OPERATION,
    target: RECOVERY_TARGET,
    readOnly: true,
    notify: false,
    source: { kind: "lzyumi-read-only-discovery", discoveryGeneratedAt: "2026-11-17T00:00:00.000Z", discoveryFingerprint: "synthetic" },
    scope,
    operatorReview: { confirmedAsRankedInhouseCandidates: true, confirmedAt: "2026-11-17T00:00:00.000Z", note: "synthetic" },
    games: [{
      sequence: 1,
      providerGameId,
      playedAt: "2026-11-14T16:22:00.000Z",
      durationSeconds: 1200,
      evidenceStatus: "AUTHORIZED_REGISTERED_PARTICIPANTS_ONLY",
      ownerAuthorizedUnregisteredFillerSlots: 8,
      discoveryStatus: "REVIEW",
      discoveryReasons: [],
      game: { gameId: providerGameId, titleTime: "11-15 00:22:00", title: "synthetic" },
      detail: { code: 1, data: { gameType: "CUSTOM_GAME", gameMode: "KIWI", wgBattleDetailInfo: [participant(1, true), participant(2, false)] } },
    }],
  };
}

function database({ foreignCollision = false } = {}) {
  const profiles = [1, 2].map((index) => ({
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
  const players = [1, 2].map((index) => ({
    id: `player-${index}`,
    name: `Synthetic ${index}`,
    riotName: `Synthetic${index}`,
    riotTag: "ECL",
    email: `synthetic-${index}@example.test`,
    elo: 800,
    winStreak: 0,
    lossStreak: 0,
  }));
  const laterStats = [
    { id: "later-1", playerId: "player-1", createdAt: new Date("2026-11-16T12:00:00.000Z"), isWin: true, kills: 4, deaths: 2, assists: 6, isMVP: false, isSVP: false, lpChange: 29, eloBefore: 800, eloAfter: 829 },
    { id: "later-2", playerId: "player-2", createdAt: new Date("2026-11-16T12:00:00.000Z"), isWin: false, kills: 2, deaths: 4, assists: 3, isMVP: false, isSVP: false, lpChange: -20, eloBefore: 800, eloAfter: 780 },
  ];
  return {
    inhouseSession: { findMany: async () => foreignCollision ? [{ id: "foreign", lzyumiGameId: providerGameId, status: "ASSIGNED", matchId: null, matchGameId: null }] : [] },
    matchGame: { findMany: async () => [] },
    inhouseReportJob: { findMany: async () => [] },
    tournamentReport: { findMany: async () => [] },
    tournamentCollectionJob: { findMany: async () => [] },
    accountProfile: { findMany: async () => profiles },
    player: { findMany: async () => players },
    matchGamePlayerStat: { findMany: async () => laterStats },
  } as unknown as PrismaClient;
}

test("dated apply plan excludes authorized fillers and replays later ranked rows", async () => {
  const plan = await preflightRankedInhouseRecovery(manifest(), database(), scope);
  assert.equal(plan.summary.operationId, RECOVERY_APPLY_OPERATION);
  assert.equal(plan.clean, true);
  assert.equal(plan.summary.gamesToInsert, 1);
  assert.equal(plan.summary.eligibleStatRowsToInsert, 2);
  assert.equal(plan.summary.authorizedUnknownFillerSlots, 8);
  assert.equal(plan.summary.existingSeasonStatsReplayed, 2);
  assert.equal(plan.games[0].eligibleParticipants, 2);
  assert.ok(plan.summary.existingStatsChanged > 0);
});

test("dated apply plan blocks a foreign or partial provider collision", async () => {
  const plan = await preflightRankedInhouseRecovery(manifest(), database({ foreignCollision: true }), scope);
  assert.equal(plan.clean, false);
  assert.deepEqual(plan.blockers, ["GAME_1_FOREIGN_OR_PARTIAL_COLLISION"]);
});
