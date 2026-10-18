import test from "node:test";
import assert from "node:assert/strict";
import { link, verifyLink, identity, eligible, requestData, validateDesktopMatch, type DesktopOwner } from "../lib/desktop-report-policy";
import { claimDesktopReport, submitDesktopReport } from "../lib/desktop-reports";
import { POST as desktopPost } from "../app/api/desktop/reports/route";

const owner: DesktopOwner = { id: "profile-1", userId: "user-1", kookId: "kook-1", riotName: "Player 0", riotTag: "TEST", chinaServerId: 1, verificationStatus: "VERIFIED", accountStatus: "ACTIVE" };
const local = { puuid: "fake-puuid-0", name: "Player 0", tag: "TEST" };
const now = Date.parse("2026-10-17T13:00:00Z");
function fixture() {
  const players = Array.from({ length: 10 }, (_, i) => ({ profileId: `p-${i}`, kookUserId: `k-${i}`, riotName: `Player ${i}`, riotTag: "TEST", side: i < 5 ? "BLUE" : "RED" }));
  const session = { createdAt: new Date(now - 3600000), players };
  const raw = { gameId: "11363615233", platformId: "HN1", gameType: "CUSTOM_GAME", gameMode: "CLASSIC", mapId: 11, endOfGameResult: "GameComplete", gameCreation: now - 3000000, gameDuration: 1800,
    participants: players.map((_, i) => ({ participantId: i + 1, teamId: i < 5 ? 100 : 200, championId: 59, stats: { kills: 3, deaths: 2, assists: 5, totalDamageDealtToChampions: 10000, goldEarned: 10000, visionScore: 12 } })),
    participantIdentities: players.map((p, i) => ({ participantId: i + 1, player: { puuid: `fake-puuid-${i}`, gameName: p.riotName, tagLine: p.riotTag } })),
    teams: [{ teamId: 100, win: "Win" }, { teamId: 200, win: "Fail" }],
  };
  return { raw, session };
}
test("pilot binding requires verified active Ionia profile with KOOK and exact Riot identity", () => {
  process.env.ECL_DESKTOP_LINK_SECRET = "synthetic-test-key-not-a-production-secret";
  for (const patch of [{ accountStatus: "SUSPENDED" }, { verificationStatus: "PENDING_KOOK" }, { chinaServerId: 14 }, { kookId: null }]) assert.throws(() => eligible({ ...owner, ...patch }));
  assert.throws(() => identity({ ...local, puuid: "" }));
  assert.throws(() => link(owner, { ...local, name: "Someone else" }, now));
  const value = link(owner, local, now);
  assert.deepEqual(verifyLink(owner, value.capability, now), local);
  for (const changed of [{ id: "another-profile" }, { userId: "another-user" }, { kookId: "another-kook" }, { riotTag: "OTHER" }]) assert.throws(() => verifyLink({ ...owner, ...changed }, value.capability, now));
  assert.throws(() => verifyLink(owner, value.capability, now + 600001));
  assert.throws(() => verifyLink(owner, `${value.capability}tampered`, now));
  delete process.env.ECL_DESKTOP_LINK_SECRET;
  assert.throws(() => link(owner, local, now), /not configured/);
});
test("only a current request assigned to this profile can be processed", () => {
  const data = { source: "desktop-request-v1", gameId: "11363615233", ownerProfileId: owner.id, expiresAt: now + 60000 };
  assert.equal(requestData(data, owner, now).gameId, data.gameId);
  for (const patch of [{ source: "old-engine" }, { gameId: "../bad" }, { ownerProfileId: "other" }, { expiresAt: now - 1 }]) assert.throws(() => requestData({ ...data, ...patch }, owner, now));
});
test("ten-player custom match joins identities by participant ID, not order", () => {
  const { raw, session } = fixture(); raw.participantIdentities.reverse();
  assert.deepEqual(validateDesktopMatch(raw, raw.gameId, local, session, now), { gameId: raw.gameId, winner: 100, players: 10, duration: 1800, started: now - 3000000 });
});
test("rejects wrong game, region, mode, completion and timing", () => {
  for (const patch of [{ gameId: "99999999999" }, { platformId: "EUW1" }, { platformId: "" }, { gameType: "MATCHED_GAME" }, { mapId: 12 }, { gameMode: "ARAM" }, { endOfGameResult: "Abort_Remake" }, { gameCreation: now - 86400000 }, { gameDuration: 0 }, { gameDuration: 999999 }]) {
    const { raw, session } = fixture(); assert.throws(() => validateDesktopMatch({ ...raw, ...patch }, raw.gameId, local, session, now));
  }
});
test("rejects missing or duplicate players, different reporter, altered sides and incomplete statistics", () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => f.raw.participants.pop(),
    (f: ReturnType<typeof fixture>) => f.raw.participants[1].participantId = 1,
    (f: ReturnType<typeof fixture>) => f.raw.participantIdentities[1].player.puuid = local.puuid,
    (f: ReturnType<typeof fixture>) => f.raw.participantIdentities[1].participantId = 99,
    (f: ReturnType<typeof fixture>) => f.raw.participantIdentities[1].player.gameName = "Wrong player",
    (f: ReturnType<typeof fixture>) => { f.raw.participants[0].teamId = 200; f.raw.participants[5].teamId = 100; },
    (f: ReturnType<typeof fixture>) => f.raw.participants[0].stats.kills = -1,
    (f: ReturnType<typeof fixture>) => f.raw.teams[1].win = "Win",
    (f: ReturnType<typeof fixture>) => f.session.players[0].profileId = "",
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.throws(() => validateDesktopMatch(f.raw, f.raw.gameId, local, f.session, now)); }
  const f = fixture(); assert.throws(() => validateDesktopMatch(f.raw, f.raw.gameId, { ...local, puuid: "outsider" }, f.session, now));
});
function fakeDatabase() {
  const f = fixture();
  f.raw.gameCreation = Date.now() - 3000000; f.session.createdAt = new Date(Date.now() - 3600000);
  f.session.players[0].profileId = owner.id; f.session.players[0].kookUserId = owner.kookId!;
  const row = { id: "job-1", sessionId: "session-1", requestedByKookId: owner.kookId, responseChannelId: null, status: "DESKTOP_PENDING", attempts: 0, lockedAt: null as Date | null, lockedBy: null as string | null, rawMatchData: { source: "desktop-request-v1", gameId: f.raw.gameId, ownerProfileId: owner.id, expiresAt: Date.now() + 3600000 } as Record<string, unknown>, session: { id: "session-1", gameLabel: "IH #027", ...f.session } };
  let writes = 0;
  const queries: unknown[] = [];
  const tx = {
    inhouseSession: { async findFirst() { return null; }, async update() { return row.session; } },
    accountProfile: { async findMany() { return f.session.players.map(p => ({ id: p.profileId, kookId: p.kookUserId, riotName: p.riotName, riotTag: p.riotTag })); } },
    inhouseReportJob: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        queries.push(where);
        if (typeof where.id === "object") return null;
        assert.equal(where.requestedByKookId, owner.kookId);
        return row;
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        if (where.status !== row.status || (where.lockedBy && where.lockedBy !== row.lockedBy)) return { count: 0 };
        writes++;
        const attempts = data.attempts ? row.attempts + 1 : row.attempts;
        Object.assign(row, data, { attempts }); return { count: 1 };
      },
      async update({ data }: { data: Record<string, unknown> }) { Object.assign(row, data); return row; },
    },
  };
  const db = { async $transaction(run: (value: typeof tx) => unknown, options: { isolationLevel: string }) { assert.equal(options.isolationLevel, "Serializable"); return run(tx); } } as unknown as NonNullable<Parameters<typeof claimDesktopReport>[1]>;
  return { f, row, db, queries, writes: () => writes };
}
test("claim scopes to the owner and submit requires the exact live lease; review is idempotent without scoring", async () => {
  const { f, row, db, writes } = fakeDatabase();
  const claimed = await claimDesktopReport(owner, db);
  assert.ok(claimed); assert.equal(row.status, "DESKTOP_COLLECTING"); assert.equal(writes(), 1);
  await assert.rejects(submitDesktopReport(owner, local, row.id, "forged-lease", f.raw, db), /lease expired/);
  const result = await submitDesktopReport(owner, local, row.id, claimed.lease, f.raw, db);
  assert.equal(result.status, "REVIEW_REQUIRED"); assert.equal(row.status, "DESKTOP_REVIEW"); assert.equal(writes(), 2);
  const again = await submitDesktopReport(owner, local, row.id, claimed.lease, f.raw, db);
  assert.equal(again.status, "REVIEW_REQUIRED"); assert.equal(writes(), 2);
  assert.equal(row.rawMatchData.source, "desktop-upload-v1");
});
test("expired or foreign profile requests are never leased", async () => {
  for (const patch of [{ expiresAt: Date.now() - 1 }, { ownerProfileId: "someone-else" }]) {
    const { row, db, writes } = fakeDatabase(); Object.assign(row.rawMatchData, patch);
    assert.equal(await claimDesktopReport(owner, db), null); assert.equal(row.status, "DESKTOP_EXPIRED"); assert.equal(writes(), 0);
  }
});
test("desktop API is disabled by default and rejects body-supplied identity without an authenticated session", async () => {
  delete process.env.ECL_DESKTOP_REPORTING_ENABLED;
  const disabled = await desktopPost(new Request("https://eclchina.lol/api/desktop/reports", { method: "POST" }));
  assert.equal(disabled.status, 503);
  process.env.ECL_DESKTOP_REPORTING_ENABLED = "1";
  try {
    const denied = await desktopPost(new Request("https://eclchina.lol/api/desktop/reports", { method: "POST", body: JSON.stringify({ action: "submit", userId: owner.userId, profileId: owner.id, kookId: owner.kookId }) }));
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get("cache-control"), "no-store");
  } finally { delete process.env.ECL_DESKTOP_REPORTING_ENABLED; }
});
test("enabled pilot fails closed unless the authenticated profile is explicitly allowlisted", () => {
  process.env.ECL_DESKTOP_REPORTING_ENABLED = "1";
  try {
    delete process.env.ECL_DESKTOP_REPORTER_PROFILE_IDS;
    assert.throws(() => eligible(owner), /not enabled/);
    process.env.ECL_DESKTOP_REPORTER_PROFILE_IDS = "some-other-profile";
    assert.throws(() => eligible(owner), /not enabled/);
    process.env.ECL_DESKTOP_REPORTER_PROFILE_IDS = `other, ${owner.id}`;
    assert.doesNotThrow(() => eligible(owner));
  } finally { delete process.env.ECL_DESKTOP_REPORTING_ENABLED; delete process.env.ECL_DESKTOP_REPORTER_PROFILE_IDS; }
});
