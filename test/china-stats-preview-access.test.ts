import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isChinaStatsPreviewProfileAllowed,
  parseChinaStatsPreviewAllowedProfileIds,
  resolveChinaStatsPreviewAccess,
} from "../lib/china-stats-preview-access.ts";

const KASPER_PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const DBD_PROFILE_ID = "22222222-2222-4222-8222-222222222222";

test("China stats preview allowlist accepts only configured stable profile UUIDs", () => {
  const configured = `${KASPER_PROFILE_ID}, ${DBD_PROFILE_ID.toUpperCase()}`;
  const allowed = parseChinaStatsPreviewAllowedProfileIds(configured);
  assert.deepEqual([...allowed ?? []], [KASPER_PROFILE_ID, DBD_PROFILE_ID]);
  assert.equal(isChinaStatsPreviewProfileAllowed(KASPER_PROFILE_ID, {
    NODE_ENV: "production",
    CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS: configured,
  }), true);
  assert.equal(isChinaStatsPreviewProfileAllowed("33333333-3333-4333-8333-333333333333", {
    NODE_ENV: "production",
    CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS: configured,
  }), false);
});

test("deployed preview access fails closed on missing or malformed configuration", () => {
  assert.equal(isChinaStatsPreviewProfileAllowed(KASPER_PROFILE_ID, { NODE_ENV: "production" }), false);
  assert.equal(isChinaStatsPreviewProfileAllowed(KASPER_PROFILE_ID, {
    NODE_ENV: "production",
    CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS: `${KASPER_PROFILE_ID},not-a-uuid`,
  }), false);
  assert.equal(isChinaStatsPreviewProfileAllowed(KASPER_PROFILE_ID, { NODE_ENV: "development" }), true);
});

test("account access requires an active verified profile on the allowlist", async () => {
  const queries: unknown[] = [];
  const database = {
    accountProfile: {
      async findFirst(args: unknown) {
        queries.push(args);
        return { id: KASPER_PROFILE_ID };
      },
    },
  };
  const allowed = await resolveChinaStatsPreviewAccess({
    userId: "authenticated-user-id",
    database,
    environment: {
      NODE_ENV: "production",
      CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS: `${KASPER_PROFILE_ID},${DBD_PROFILE_ID}`,
    },
  });
  assert.equal(allowed, true);
  assert.deepEqual(queries, [{
    where: {
      userId: "authenticated-user-id",
      accountStatus: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    select: { id: true },
  }]);

  const missing = await resolveChinaStatsPreviewAccess({
    userId: "missing-user-id",
    database: { accountProfile: { async findFirst() { return null; } } },
    environment: {
      NODE_ENV: "production",
      CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS: KASPER_PROFILE_ID,
    },
  });
  assert.equal(missing, false);
});

test("page access and signer share the same server-side allowlist boundary", async () => {
  const [accessRoute, signerRoute, runtime, layout, gate] = await Promise.all([
    readFile("app/api/china-stats/access/route.ts", "utf8"),
    readFile("app/api/china-stats/sign/route.ts", "utf8"),
    readFile("lib/china-stats-preview-access-runtime.ts", "utf8"),
    readFile("app/labs/china-stats/layout.tsx", "utf8"),
    readFile("app/labs/china-stats/ChinaStatsPreviewAccessGate.tsx", "utf8"),
  ]);

  assert.match(accessRoute, /getAccountFromRequest/);
  assert.match(accessRoute, /hasChinaStatsPreviewAccess/);
  assert.match(accessRoute, /status: 403/);
  assert.match(signerRoute, /hasChinaStatsPreviewAccess/);
  assert.match(signerRoute, /status: 403/);
  assert.match(runtime, /resolveChinaStatsPreviewAccess/);
  assert.match(layout, /ChinaStatsPreviewAccessGate/);
  assert.match(gate, /\/api\/china-stats\/access/);
  assert.doesNotMatch(`${accessRoute}${signerRoute}${gate}`, /Kasper|deebeedee/);
});
