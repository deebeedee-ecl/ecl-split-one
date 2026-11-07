"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LzyumiResponseError,
  assertLzyumiDetailResponse,
  assertLzyumiHistoryResponse,
  createLzyumiSignature,
  lzyumiDetailUrl,
  lzyumiEndpoints,
  lzyumiInfoUrl,
} = require("../lzyumi-client.cjs");

const CAPTURE_TIME = new Date("2026-11-04T00:42:31.000Z");

test("replacement signing uses fixed China time and the observed source formula", () => {
  assert.deepEqual(createLzyumiSignature(CAPTURE_TIME), {
    lzyumiSign: "affde3b4ad9f3fdda94f86d6a4b85338",
    signStr: "1148423163366",
  });
});

test("endpoint resolution accepts either the API root or the history URL", () => {
  const root = lzyumiEndpoints("https://provider.example/lzyumi/lol");
  const history = lzyumiEndpoints("https://provider.example/lzyumi/lol/info");

  assert.equal(root.info.toString(), "https://provider.example/lzyumi/lol/info");
  assert.equal(root.detail.toString(), "https://provider.example/lzyumi/lol/info/findOrderDetailInfoAll");
  assert.equal(history.info.toString(), root.info.toString());
  assert.equal(history.detail.toString(), root.detail.toString());
});

test("history URL contains the signed lookup contract and authorized session", () => {
  const url = new URL(lzyumiInfoUrl({
    baseUrl: "https://provider.example/lzyumi/lol/info",
    nickname: "ParticipantName#12345",
    openId: "openid-value",
    areaId: 1,
    areaName: "Ionia",
    filter: 2,
    allCount: 20,
    sessionToken: "session-value",
    timestamp: CAPTURE_TIME,
  }));

  assert.equal(url.pathname, "/lzyumi/lol/info");
  assert.equal(url.searchParams.get("nickname"), "ParticipantName*~*~*\u206612345");
  assert.equal(url.searchParams.get("openId"), "openid-value");
  assert.equal(url.searchParams.get("areaId"), "1");
  assert.equal(url.searchParams.get("areaName"), "Ionia");
  assert.equal(url.searchParams.get("seleMe"), "1");
  assert.equal(url.searchParams.get("filter"), "2");
  assert.equal(url.searchParams.get("allCount"), "20");
  assert.equal(url.searchParams.get("lzyumitokenstr"), "session-value");
  assert.equal(url.searchParams.get("signStr"), "1148423163366");
});

test("match-details URL preserves opaque IDs and includes the authorized session", () => {
  const url = new URL(lzyumiDetailUrl({
    baseUrl: "https://provider.example/lzyumi/lol",
    openId: "open/id+value",
    gameId: "opaque/provider+game=id",
    areaId: 14,
    sessionToken: "session-value",
    timestamp: CAPTURE_TIME,
  }));

  assert.equal(url.pathname, "/lzyumi/lol/info/findOrderDetailInfoAll");
  assert.equal(url.searchParams.get("openId"), "open/id+value");
  assert.equal(url.searchParams.get("gameId"), "opaque/provider+game=id");
  assert.equal(url.searchParams.get("areaId"), "14");
  assert.equal(url.searchParams.get("lzyumitokenstr"), "session-value");
  assert.throws(() => lzyumiDetailUrl({ openId: "open-id" }), /openId and provider gameId/);
});

test("response validation accepts complete payloads and rejects provider failures", () => {
  const history = { code: 1, battleInfo: { openId: "open-id" }, data: [] };
  const detail = {
    code: "1",
    data: {
      wgBattleDetailInfo: Array.from({ length: 10 }, (_, index) => ({
        nickNameStr: `Player ${index + 1}`,
      })),
    },
  };

  assert.equal(assertLzyumiHistoryResponse(history), history);
  assert.equal(assertLzyumiDetailResponse(detail), detail);
  assert.throws(
    () => assertLzyumiHistoryResponse({ code: 2, data: [] }),
    (error) => error instanceof LzyumiResponseError && error.code === "2",
  );
  assert.throws(() => assertLzyumiHistoryResponse({ code: 1 }), /data array/);
  assert.throws(
    () => assertLzyumiDetailResponse({ code: 1, data: { wgBattleDetailInfo: Array(9).fill({}) } }),
    /9\/10 players/,
  );
});
