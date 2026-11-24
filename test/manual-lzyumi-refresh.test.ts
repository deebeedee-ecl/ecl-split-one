import assert from "node:assert/strict";
import test from "node:test";

import { runManualLzyumiRefresh } from "../components/account/manual-lzyumi-refresh";

const targetProfileId = "11111111-1111-4111-8111-111111111111";
const permitToken = "synthetic-permit-token-long-enough-for-client-validation";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function coreProfile() {
  return {
    code: 1,
    battleInfo: {
      nameInfoNew: "SyntheticPlayer#1000",
      openId: "synthetic-open-id",
      areaId: 1,
      mapOneInfoList: [],
    },
    data: [],
  };
}

function history(gameId: string) {
  return { code: 1, data: [{ gameId }] };
}

function issuedPermit() {
  return {
    ok: true,
    permitToken,
    targetProfileId,
    expiresAt: "2026-11-25T12:02:00.000Z",
    requests: {
      profile: "https://provider.invalid/profile",
      solo: "https://provider.invalid/solo",
      flex: "https://provider.invalid/flex",
      recent: "https://provider.invalid/recent",
    },
  };
}

test("owner manual refresh fetches the fixed browser bundle and consumes a complete snapshot", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "/api/hub/lzyumi-refresh-permits") return json(issuedPermit());
    if (url.endsWith("/profile")) return json(coreProfile());
    if (url.endsWith("/solo")) return json(history("synthetic-solo-game"));
    if (url.endsWith("/flex")) return json(history("synthetic-flex-game"));
    if (url.endsWith("/recent")) return json({ code: 1, data: {} });
    if (url === "/api/hub/lzyumi-refresh-permits/consume") {
      return json({
        ok: true,
        targetProfileId,
        fetchedAt: "2026-11-25T12:00:00.000Z",
        recentStatStatus: "available",
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await runManualLzyumiRefresh({
    targetProfileId,
    accessToken: "synthetic-access-token",
    fetcher,
  });

  assert.deepEqual(result, {
    status: "success",
    fetchedAt: "2026-11-25T12:00:00.000Z",
    recentStatStatus: "available",
  });
  assert.equal(calls.length, 6);
  const consume = calls.at(-1)!;
  const body = JSON.parse(String(consume.init?.body));
  assert.equal(body.targetProfileId, targetProfileId);
  assert.equal(body.permitToken, permitToken);
  assert.equal(body.profileResponse.battleInfo.nameInfoNew, "SyntheticPlayer#1000");
  assert.equal(body.recentStat.status, "available");
});

test("provider core failure does not consume or replace the stored snapshot", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === "/api/hub/lzyumi-refresh-permits") return json(issuedPermit());
    if (url.endsWith("/profile")) return json({ code: 7, data: [] });
    if (url.endsWith("/solo")) return json(history("synthetic-solo-game"));
    if (url.endsWith("/flex")) return json(history("synthetic-flex-game"));
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await runManualLzyumiRefresh({
    targetProfileId,
    accessToken: "synthetic-access-token",
    fetcher,
  });

  assert.equal(result.status, "failure");
  assert.equal(result.code, "PROVIDER_CORE_UNAVAILABLE");
  assert.equal(calls.includes("/api/hub/lzyumi-refresh-permits/consume"), false);
});

test("optional recent-stat failure is consumed as explicitly unavailable", async () => {
  let consumeBody: Record<string, unknown> | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/hub/lzyumi-refresh-permits") return json(issuedPermit());
    if (url.endsWith("/profile")) return json(coreProfile());
    if (url.endsWith("/solo")) return json(history("synthetic-solo-game"));
    if (url.endsWith("/flex")) return json(history("synthetic-flex-game"));
    if (url.endsWith("/recent")) return json({ code: 8, data: null });
    if (url === "/api/hub/lzyumi-refresh-permits/consume") {
      consumeBody = JSON.parse(String(init?.body));
      return json({
        ok: true,
        targetProfileId,
        fetchedAt: "2026-11-25T12:00:00.000Z",
        recentStatStatus: "unavailable",
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await runManualLzyumiRefresh({
    targetProfileId,
    accessToken: "synthetic-access-token",
    fetcher,
  });

  assert.equal(result.status, "success");
  assert.ok(consumeBody);
  const submittedSnapshot = consumeBody as Record<string, unknown>;
  assert.deepEqual(submittedSnapshot.recentStat, {
    status: "unavailable",
    reason: "network-rejected",
  });
});

test("durable cooldown is exposed without starting provider requests", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    calls.push(String(input));
    return json({
      ok: false,
      code: "PROFILE_COOLDOWN",
      retryAt: "2026-11-25T12:05:00.000Z",
    }, 429);
  };

  const result = await runManualLzyumiRefresh({
    targetProfileId,
    accessToken: "synthetic-access-token",
    fetcher,
  });

  assert.deepEqual(result, {
    status: "cooldown",
    code: "PROFILE_COOLDOWN",
    retryAt: "2026-11-25T12:05:00.000Z",
    message: "Refresh is on cooldown. Try again after the displayed time.",
  });
  assert.deepEqual(calls, ["/api/hub/lzyumi-refresh-permits"]);
});

test("disabled permit rollout produces an explicit unavailable state", async () => {
  const fetcher: typeof fetch = async () => json({
    ok: false,
    code: "PERMITS_UNAVAILABLE",
  }, 503);

  const result = await runManualLzyumiRefresh({
    targetProfileId,
    accessToken: "synthetic-access-token",
    fetcher,
  });

  assert.deepEqual(result, {
    status: "unavailable",
    code: "PERMITS_UNAVAILABLE",
    retryAt: null,
    message: "Manual League refresh is temporarily unavailable.",
  });
});

test("mismatched permit target is rejected before any provider request", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    calls.push(String(input));
    return json({ ...issuedPermit(), targetProfileId: "22222222-2222-4222-8222-222222222222" });
  };

  const result = await runManualLzyumiRefresh({
    targetProfileId,
    accessToken: "synthetic-access-token",
    fetcher,
  });

  assert.equal(result.status, "failure");
  assert.equal(result.code, "INVALID_PERMIT_RESPONSE");
  assert.deepEqual(calls, ["/api/hub/lzyumi-refresh-permits"]);
});
