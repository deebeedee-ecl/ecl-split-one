import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createHubBootstrapStore } from "../lib/hub-bootstrap";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function session(userId: string, accessToken = `token-${userId}`) {
  return {
    access_token: accessToken,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-11-09T00:00:00.000Z",
    },
  } as Session;
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("Hub hydration starts from one deterministic loading snapshot", async () => {
  const calls = { getSession: 0, subscribe: 0 };
  const store = createHubBootstrapStore({
    async getSession() {
      calls.getSession += 1;
      return null;
    },
    subscribe() {
      calls.subscribe += 1;
      return () => {};
    },
    async flushPendingProfile() {},
    async loadMinimalProfile() {
      return null;
    },
  });

  assert.strictEqual(store.getServerSnapshot(), store.getSnapshot());
  assert.deepEqual(store.getServerSnapshot(), {
    status: "loading",
    session: null,
    profile: null,
  });
  assert.deepEqual(calls, { getSession: 0, subscribe: 0 });

  store.start();
  await settle();
  assert.deepEqual(calls, { getSession: 1, subscribe: 1 });
  assert.equal(store.getSnapshot().status, "signed-out");
  assert.equal(store.getServerSnapshot().status, "loading");
  store.stop();
});

test("one Hub store shares one initial session and minimal-profile bootstrap", async () => {
  const activeSession = session("user-a");
  const calls = { getSession: 0, subscribe: 0, flush: 0, profile: 0, cleanup: 0 };
  const store = createHubBootstrapStore({
    async getSession() {
      calls.getSession += 1;
      return activeSession;
    },
    subscribe() {
      calls.subscribe += 1;
      return () => {
        calls.cleanup += 1;
      };
    },
    async flushPendingProfile() {
      calls.flush += 1;
    },
    async loadMinimalProfile() {
      calls.profile += 1;
      return { id: "profile-a", accountStatus: "ACTIVE", verificationStatus: "VERIFIED" };
    },
  });

  const consumerNotifications = [0, 0, 0];
  const unsubscribeConsumers = consumerNotifications.map((_, index) =>
    store.subscribe(() => {
      consumerNotifications[index] += 1;
    }),
  );
  assert.equal(store.getSnapshot().status, "loading");
  const cleanup = store.start();
  await settle();

  assert.deepEqual(calls, {
    getSession: 1,
    subscribe: 1,
    flush: 1,
    profile: 1,
    cleanup: 0,
  });
  assert.equal(store.getSnapshot().status, "authenticated");
  assert.ok(consumerNotifications.every((count) => count > 0));

  cleanup();
  unsubscribeConsumers.forEach((unsubscribe) => unsubscribe());
  assert.equal(calls.cleanup, 1);
});

test("Hub bootstrap covers signed-out, profile-required, auth-change, and token refresh states", async () => {
  const authListeners: Array<(event: AuthChangeEvent, session: Session | null) => void> = [];
  let profileLoads = 0;
  let cleanups = 0;
  const store = createHubBootstrapStore({
    async getSession() {
      return null;
    },
    subscribe(listener) {
      authListeners.push(listener);
      return () => {
        cleanups += 1;
      };
    },
    async flushPendingProfile() {},
    async loadMinimalProfile(accessToken) {
      profileLoads += 1;
      if (accessToken === "token-no-profile") return null;
      return {
        id: `profile-${accessToken}`,
        accountStatus: "ACTIVE",
        verificationStatus: "VERIFIED",
      };
    },
  });

  store.start();
  await settle();
  assert.equal(store.getSnapshot().status, "signed-out");
  assert.equal(profileLoads, 0);

  authListeners[0]("SIGNED_IN", session("user-a", "token-no-profile"));
  await settle();
  assert.equal(store.getSnapshot().status, "profile-required");
  assert.equal(profileLoads, 1);

  authListeners[0]("SIGNED_IN", session("user-b"));
  await settle();
  assert.equal(store.getSnapshot().status, "authenticated");
  assert.equal(profileLoads, 2);

  authListeners[0]("TOKEN_REFRESHED", session("user-b", "token-user-b-refreshed"));
  await settle();
  assert.equal(store.getSnapshot().session?.access_token, "token-user-b-refreshed");
  assert.equal(profileLoads, 2);

  authListeners[0]("SIGNED_OUT", null);
  await settle();
  assert.equal(store.getSnapshot().status, "signed-out");

  store.stop();
  assert.equal(cleanups, 1);
  assert.equal(store.getSnapshot().status, "loading");
});

test("Hub layout owns bootstrap while protected APIs retain server authorization", async () => {
  const files = await Promise.all([
    "app/(hub)/layout.tsx",
    "app/(public)/layout.tsx",
    "app/(hub)/hub/_components/HubBootstrapProvider.tsx",
    "app/(hub)/hub/_components/HubAccessGate.tsx",
    "app/api/account/profile/bootstrap/route.ts",
    "app/api/account/profile/route.ts",
    "app/api/hub/report-session/route.ts",
    "app/api/tournaments/split-ii/registration/route.ts",
  ].map((relativePath) => readFile(path.join(repositoryRoot, relativePath), "utf8")));

  const [layout, publicLayout, provider, gate, bootstrapRoute, profileRoute, reportRoute, tournamentRoute] = files;
  assert.match(layout, /<HubBootstrapProvider>/);
  assert.doesNotMatch(publicLayout, /HubBootstrapProvider/);
  assert.equal((provider.match(/onAuthStateChange/g) ?? []).length, 1);
  assert.equal((provider.match(/auth\.getSession/g) ?? []).length, 1);
  assert.doesNotMatch(gate, /supabase|onAuthStateChange|getSession|loadProfile/);
  assert.doesNotMatch(gate, /localStorage|sessionStorage|getHubAccessCache/);
  assert.doesNotMatch(provider, /localStorage|sessionStorage|getHubAccessCache/);
  assert.match(bootstrapRoute, /getAccountFromRequest\(request\)/);
  assert.match(bootstrapRoute, /select:\s*{[\s\S]*id:\s*true/);
  assert.match(profileRoute, /getAccountFromRequest\(request\)/);
  assert.match(reportRoute, /getAccountFromRequest\(request\)/);
  assert.match(tournamentRoute, /createRegistrationHandlers\(prisma, getAccountFromRequest\)/);
});

test("minimal-profile bootstrap rejects an unauthenticated request before database access", async () => {
  const { GET } = await import("../app/api/account/profile/bootstrap/route");
  const response = await GET(new Request("http://localhost/api/account/profile/bootstrap"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Not authenticated" });
});
