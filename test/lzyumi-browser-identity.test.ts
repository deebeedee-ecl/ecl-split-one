import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";

import {
  buildLzyumiIdentityAttempts,
  resolveLzyumiBrowserIdentity,
  type SignedLzyumiIdentityAttempt,
} from "../lib/lzyumi-browser-identity";
import { LzyumiBrowserContractError } from "../lib/lzyumi-browser-contract";

const expectedRiotId = "SyntheticPlayer#T100";
const expectedAreaId = 1;
const validProfile = {
  code: 1,
  battleInfo: {
    nameInfoNew: expectedRiotId,
    openId: "synthetic-open-id",
    areaId: expectedAreaId,
    mapOneInfoList: [],
  },
  data: [],
};

function signedAttempts(hasSavedOpenId: boolean): SignedLzyumiIdentityAttempt[] {
  return buildLzyumiIdentityAttempts({
    riotName: "SyntheticPlayer",
    riotTag: "T100",
    hasSavedOpenId,
  }).map((attempt) => ({ kind: attempt.kind, url: `https://provider.invalid/${attempt.kind}` }));
}

test("builds the bounded bare-name/full-ID/saved-openId cascade with openId-only last", () => {
  assert.deepEqual(
    buildLzyumiIdentityAttempts({
      riotName: " SyntheticPlayer ",
      riotTag: "#T100",
      hasSavedOpenId: true,
    }),
    [
      { kind: "bare-name", nickname: "SyntheticPlayer", useSavedOpenId: false },
      { kind: "full-id", nickname: expectedRiotId, useSavedOpenId: false },
      { kind: "bare-name-with-open-id", nickname: "SyntheticPlayer", useSavedOpenId: true },
      { kind: "full-id-with-open-id", nickname: expectedRiotId, useSavedOpenId: true },
      { kind: "open-id-only", nickname: "", useSavedOpenId: true },
    ],
  );
  assert.deepEqual(
    buildLzyumiIdentityAttempts({
      riotName: "SyntheticPlayer",
      riotTag: "T100",
      hasSavedOpenId: false,
    }).map((attempt) => attempt.kind),
    ["bare-name", "full-id"],
  );
});

test("accepts the exact bare-name result without depending on a broken full-ID lookup", async () => {
  const calls: string[] = [];
  const result = await resolveLzyumiBrowserIdentity({
    attempts: signedAttempts(false),
    expectedRiotId,
    expectedAreaId,
    async lookup(attempt) {
      calls.push(attempt.kind);
      if (attempt.kind === "bare-name") return validProfile;
      return { code: 1, battleInfo: null, data: null };
    },
  });

  assert.equal(result.status, "RESOLVED");
  assert.deepEqual(calls, ["bare-name"]);
  if (result.status !== "RESOLVED") return;
  assert.equal(result.attempt, "bare-name");
  assert.equal(result.resolvedRiotId, expectedRiotId);
});

test("continues from a null full-ID response to an exact bare-name identity", async () => {
  const attempts = signedAttempts(false).reverse();
  const result = await resolveLzyumiBrowserIdentity({
    attempts,
    expectedRiotId,
    expectedAreaId,
    async lookup(attempt) {
      return attempt.kind === "full-id"
        ? { code: 1, battleInfo: null, data: null }
        : validProfile;
    },
  });

  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.attempt, "bare-name");
  assert.deepEqual(result.attempts, [{
    kind: "full-id",
    status: "IDENTITY_NOT_FOUND",
    providerCode: 1,
  }]);
});

test("code 1 without an identity is not classified as empty history", async () => {
  const result = await resolveLzyumiBrowserIdentity({
    attempts: signedAttempts(false),
    expectedRiotId,
    expectedAreaId,
    async lookup() {
      return { code: 1, battleInfo: null, data: null };
    },
  });

  assert.equal(result.status, "IDENTITY_NOT_FOUND");
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts.every((attempt) => attempt.status === "IDENTITY_NOT_FOUND"), true);
});

test("rejects a different full Riot ID and a different China server", async () => {
  const wrongIdentity = await resolveLzyumiBrowserIdentity({
    attempts: signedAttempts(false).slice(0, 1),
    expectedRiotId,
    expectedAreaId,
    async lookup() {
      return {
        ...validProfile,
        battleInfo: { ...validProfile.battleInfo, nameInfoNew: "SyntheticPlayer#OTHER" },
      };
    },
  });
  assert.equal(wrongIdentity.status, "IDENTITY_MISMATCH");
  assert.equal(wrongIdentity.mismatch, "riot-id");

  const wrongServer = await resolveLzyumiBrowserIdentity({
    attempts: signedAttempts(false).slice(0, 1),
    expectedRiotId,
    expectedAreaId,
    async lookup() {
      return {
        ...validProfile,
        battleInfo: { ...validProfile.battleInfo, areaId: 14 },
      };
    },
  });
  assert.equal(wrongServer.status, "IDENTITY_MISMATCH");
  assert.equal(wrongServer.mismatch, "server");
});

for (const [providerCode, status] of [
  [6, "AUTH_FAILURE"],
  [7, "THROTTLED"],
  [8, "INCOMPLETE_LOOKUP"],
] as const) {
  test(`maps provider code ${providerCode} to ${status}`, async () => {
    const result = await resolveLzyumiBrowserIdentity({
      attempts: signedAttempts(false).slice(0, 1),
      expectedRiotId,
      expectedAreaId,
      async lookup() {
        return { code: providerCode, data: [] };
      },
    });
    assert.equal(result.status, status);
    assert.equal(result.attempts[0]?.providerCode, providerCode);
  });
}

test("HTTP and malformed responses remain incomplete lookups", async () => {
  const httpFailure = await resolveLzyumiBrowserIdentity({
    attempts: signedAttempts(false).slice(0, 1),
    expectedRiotId,
    expectedAreaId,
    async lookup() {
      throw new LzyumiBrowserContractError(
        "synthetic HTTP failure",
        "profile",
        "http-error",
        undefined,
        503,
      );
    },
  });
  assert.equal(httpFailure.status, "INCOMPLETE_LOOKUP");
  assert.equal(httpFailure.attempts[0]?.httpStatus, 503);

  const malformed = await resolveLzyumiBrowserIdentity({
    attempts: signedAttempts(false).slice(0, 1),
    expectedRiotId,
    expectedAreaId,
    async lookup() {
      return { code: 1, battleInfo: {}, data: [] };
    },
  });
  assert.equal(malformed.status, "INCOMPLETE_LOOKUP");
});

test("authenticated profile-refresh signing bundle fails closed without a session", async () => {
  const { GET } = await import("../app/api/lzyumi-sign/route");
  const response = await GET(new NextRequest(
    "http://localhost/api/lzyumi-sign?type=profile-refresh",
  ));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Not authenticated" });
});

test("stored-openId signing is bound to the authenticated owner's server profile", async () => {
  const source = await readFile("app/api/lzyumi-sign/route.ts", "utf8");
  assert.match(source, /type === "profile-refresh"/);
  assert.match(source, /getAccountFromRequest\(req\)/);
  assert.match(source, /where: \{ userId: account\.id \}/);
  assert.match(source, /hasSavedOpenId: Boolean\(profile\.openId/);
  assert.match(source, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(source, /searchParams\.get\("targetProfileId"\)/);
});

test("owner profile refresh resolves identity before openId-bound core history", async () => {
  const source = await readFile("components/account/PlayerProfileView.tsx", "utf8");
  const bundleIndex = source.indexOf("/api/lzyumi-sign?type=profile-refresh");
  const resolveIndex = source.indexOf("resolveLzyumiBrowserIdentity({");
  const soloIndex = source.indexOf("filter=2&allCount=20");
  const flexIndex = source.indexOf("filter=3&allCount=20");
  const saveIndex = source.indexOf('fetch("/api/hub/refresh-my-profile"');

  assert.ok(bundleIndex >= 0);
  assert.ok(resolveIndex > bundleIndex);
  assert.ok(soloIndex > resolveIndex);
  assert.ok(flexIndex > resolveIndex);
  assert.ok(saveIndex > soloIndex && saveIndex > flexIndex);
  assert.match(source, /filter=2&allCount=20[^\n]+openId|openId[^\n]+filter=2&allCount=20/);
  assert.doesNotMatch(source, /nickname=[^\n]+filter=2&allCount=20/);
});
