import assert from "node:assert/strict";
import test from "node:test";

import {
  ProfileRequestError,
  requestAccountProfile,
} from "../components/account/profile-request";

test("profile requests use an explicit narrow view and preserve a missing-profile result", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let authorization = "";

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({ profile: null });
  };

  try {
    const profile = await requestAccountProfile("settings", "synthetic-token");
    assert.equal(profile, null);
    assert.equal(requestedUrl, "/api/account/profile?view=settings");
    assert.equal(authorization, "Bearer synthetic-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("profile requests expose API failures instead of treating them as a missing profile", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ message: "Profile temporarily unavailable" }, { status: 503 });

  try {
    await assert.rejects(
      () => requestAccountProfile("profile", "synthetic-token"),
      (error: unknown) =>
        error instanceof ProfileRequestError &&
        error.status === 503 &&
        error.message === "Profile temporarily unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("profile requests time out with an actionable retry message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });

  try {
    await assert.rejects(
      () => requestAccountProfile("profile", "synthetic-token", { timeoutMs: 5 }),
      (error: unknown) =>
        error instanceof ProfileRequestError &&
        error.message.includes("took too long") &&
        error.status === null,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
