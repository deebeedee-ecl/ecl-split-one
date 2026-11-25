import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildChinaStatsSignedUrl,
  consumeChinaStatsSigningBudget,
  parseChinaStatsSigningInput,
  type ChinaStatsSigningRateStore,
} from "../lib/china-stats-signing.ts";

test("China stats signing accepts only the intended servers and read-only scopes", () => {
  assert.deepEqual(
    parseChinaStatsSigningInput({ type: "profile", nickname: "Player#CN1", areaId: 1 }),
    { type: "profile", nickname: "Player#CN1", areaId: 1 },
  );
  assert.deepEqual(
    parseChinaStatsSigningInput({ type: "history", openId: "opaque-player", areaId: 31, filter: 3 }),
    { type: "history", openId: "opaque-player", areaId: 31, filter: 3 },
  );

  assert.throws(
    () => parseChinaStatsSigningInput({ type: "profile", nickname: "Player#CN1", areaId: 7 }),
    /Ionia or Super Server/,
  );
  assert.throws(
    () => parseChinaStatsSigningInput({ type: "profile", nickname: "Player#CN1", areaId: "1" }),
    /Ionia or Super Server/,
  );
  assert.throws(
    () => parseChinaStatsSigningInput({ type: "history", openId: "opaque-player", areaId: 1, filter: 1 }),
    /Ranked queue is invalid/,
  );
  assert.throws(
    () => parseChinaStatsSigningInput({ type: "detail", openId: "opaque-player", gameId: "bad\nvalue", areaId: 1 }),
    /Match identity is invalid/,
  );
  assert.throws(
    () => parseChinaStatsSigningInput({ type: "write", areaId: 1 }),
    /Lookup type is invalid/,
  );
});
test("China stats signed URLs keep request size and endpoint selection fixed", () => {
  const profile = new URL(buildChinaStatsSignedUrl({ type: "profile", nickname: "Player#CN1", areaId: 1 }));
  assert.equal(profile.pathname, "/lzyumi/lol/info");
  assert.equal(profile.searchParams.get("nickname"), "Player*~*~*CN1");
  assert.equal(profile.searchParams.get("allCount"), "20");
  assert.equal(profile.searchParams.get("filter"), "1");
  assert.equal(profile.searchParams.get("areaId"), "1");

  const history = new URL(buildChinaStatsSignedUrl({
    type: "history",
    openId: "opaque-player",
    areaId: 31,
    filter: 2,
  }));
  assert.equal(history.pathname, "/lzyumi/lol/info");
  assert.equal(history.searchParams.get("allCount"), "20");
  assert.equal(history.searchParams.get("filter"), "2");
  assert.equal(history.searchParams.get("areaId"), "31");

  const detail = new URL(buildChinaStatsSignedUrl({
    type: "detail",
    openId: "opaque-player",
    gameId: "opaque-game",
    areaId: 1,
  }));
  assert.equal(detail.pathname, "/lzyumi/lol/info/findOrderDetailInfoAll");
  assert.equal(detail.searchParams.get("gameId"), "opaque-game");
});

test("China stats signing applies a bounded per-key warm-instance request budget", () => {
  const store: ChinaStatsSigningRateStore = new Map();
  assert.deepEqual(
    consumeChinaStatsSigningBudget({ key: "account-1", now: 1_000, limit: 2, windowMs: 10_000, store }),
    { allowed: true, remaining: 1, retryAfterSeconds: 0 },
  );
  assert.deepEqual(
    consumeChinaStatsSigningBudget({ key: "account-1", now: 2_000, limit: 2, windowMs: 10_000, store }),
    { allowed: true, remaining: 0, retryAfterSeconds: 0 },
  );
  assert.deepEqual(
    consumeChinaStatsSigningBudget({ key: "account-1", now: 3_000, limit: 2, windowMs: 10_000, store }),
    { allowed: false, remaining: 0, retryAfterSeconds: 8 },
  );
  assert.equal(
    consumeChinaStatsSigningBudget({ key: "account-1", now: 11_000, limit: 2, windowMs: 10_000, store }).allowed,
    true,
  );
});

test("China stats signer is POST-only, authenticated in deployed environments, and read-only", async () => {
  const source = await readFile("app/api/china-stats/sign/route.ts", "utf8");
  assert.match(source, /export async function POST/);
  assert.match(source, /getAccountFromRequest/);
  assert.match(source, /NODE_ENV === "development"/);
  assert.match(source, /consumeChinaStatsSigningBudget/);
  assert.match(source, /hasChinaStatsPreviewAccess/);
  assert.match(source, /status: 403/);
  assert.doesNotMatch(source, /export async function GET/);
  assert.doesNotMatch(source, /prisma|create\(|update\(|delete\(|upsert\(/);
});
