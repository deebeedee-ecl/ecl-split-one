import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLzyumiEndpointUrl,
  fetchLzyumiBrowserResponse,
  LzyumiBrowserContractError,
  validateLzyumiDetailResponse,
  validateLzyumiHistoryResponse,
  validateLzyumiProfileResponse,
  validateLzyumiRecentStatResponse,
} from "../lib/lzyumi-browser-contract";

const syntheticProfile = {
  code: 1,
  battleInfo: {
    nameInfoNew: "ContractTester#T100",
    openId: "synthetic-open-id",
    areaId: 1,
    mapOneInfoList: [],
  },
  data: [],
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("builds the verified /info paths for recent stats and match detail", () => {
  const base = "https://provider.invalid/lzyumi/lol";
  assert.equal(
    buildLzyumiEndpointUrl(base, "recent").pathname,
    "/lzyumi/lol/info/getPlayerRecentStat",
  );
  assert.equal(
    buildLzyumiEndpointUrl(`${base}/info`, "detail").pathname,
    "/lzyumi/lol/info/findOrderDetailInfoAll",
  );
});

test("accepts successful endpoint-specific response shapes", () => {
  assert.equal(validateLzyumiProfileResponse(syntheticProfile), syntheticProfile);
  assert.deepEqual(validateLzyumiHistoryResponse({ code: "1", data: [] }).data, []);
  assert.deepEqual(validateLzyumiRecentStatResponse({ code: 1, data: {} }).data, {});

  const players = Array.from({ length: 10 }, (_, index) => ({
    teamId: index < 5 ? "blue" : "red",
  }));
  const detail = {
    code: 1,
    data: {
      wgBattleDetailInfo: players,
      teamDetails: [{ teamId: "blue" }, { teamId: "red" }],
    },
  };
  assert.equal(validateLzyumiDetailResponse(detail), detail);
});

for (const [code, kind] of [
  [6, "authentication"],
  [7, "throttled"],
  [8, "network-rejected"],
] as const) {
  test(`rejects HTTP 200 history response with provider code ${code}`, async () => {
    await assert.rejects(
      fetchLzyumiBrowserResponse(
        "https://provider.invalid/history",
        "history",
        100,
        async () => jsonResponse({ code, data: [] }),
      ),
      (error) =>
        error instanceof LzyumiBrowserContractError &&
        error.kind === kind &&
        error.providerCode === code,
    );
  });
}

test("rejects an HTTP error before response-shape validation", async () => {
  await assert.rejects(
    fetchLzyumiBrowserResponse(
      "https://provider.invalid/profile",
      "profile",
      100,
      async () => jsonResponse({}, 503),
    ),
    (error) =>
      error instanceof LzyumiBrowserContractError &&
      error.kind === "http-error" &&
      error.httpStatus === 503,
  );
});

test("rejects malformed JSON and incomplete successful payloads", async () => {
  await assert.rejects(
    fetchLzyumiBrowserResponse(
      "https://provider.invalid/profile",
      "profile",
      100,
      async () => new Response("{", { status: 200 }),
    ),
    (error) => error instanceof LzyumiBrowserContractError && error.kind === "malformed",
  );

  assert.throws(
    () => validateLzyumiHistoryResponse({ code: 1, data: null }),
    (error) => error instanceof LzyumiBrowserContractError && error.kind === "malformed",
  );
  assert.throws(
    () => validateLzyumiHistoryResponse({ code: 1, data: [{}] }),
    (error) => error instanceof LzyumiBrowserContractError && error.kind === "malformed",
  );
  assert.throws(
    () => validateLzyumiProfileResponse({ code: 1, battleInfo: {}, data: [] }),
    (error) => error instanceof LzyumiBrowserContractError && error.kind === "malformed",
  );
});

test("treats code 1 with null identity and history as not found, never empty history", () => {
  assert.throws(
    () => validateLzyumiProfileResponse({ code: 1, battleInfo: null, data: null }),
    (error) =>
      error instanceof LzyumiBrowserContractError &&
      error.kind === "not-found" &&
      error.providerCode === 1,
  );
});
