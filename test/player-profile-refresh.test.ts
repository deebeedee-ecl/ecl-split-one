import assert from "node:assert/strict";
import test from "node:test";

import {
  runStoredProfileRefreshFlow,
  selectImplicitProfileRefreshCandidate,
} from "../components/account/player-profile-refresh";

type TestProfile = {
  id: string;
  rank: string;
  lzyumiLastLookupAt: string;
  recent: string | null;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createFlowState() {
  return {
    profile: null as TestProfile | null,
    ready: false,
    refreshing: false,
    error: "",
    successCount: 0,
    endCount: 0,
  };
}

function callbacks(state: ReturnType<typeof createFlowState>) {
  return {
    onStoredProfile(profile: TestProfile | null) {
      state.profile = profile;
    },
    onReady() {
      state.ready = true;
    },
    onLoadError(error: unknown) {
      state.error = error instanceof Error ? error.message : "load failed";
    },
    onRefreshStart() {
      state.refreshing = true;
      state.error = "";
    },
    onRefreshSkipped() {
      state.refreshing = false;
    },
    onRefreshSuccess(profile: TestProfile) {
      state.profile = profile;
      state.successCount += 1;
    },
    onRefreshError(error: unknown) {
      state.error = error instanceof Error ? error.message : "refresh failed";
    },
    onRefreshEnd() {
      state.refreshing = false;
      state.endCount += 1;
    },
  };
}

test("public profile navigation never runs an implicit refresh through another viewer", async () => {
  const publicProfile = {
    id: "synthetic-public-profile",
    rank: "Gold I",
    lzyumiLastLookupAt: "2026-11-10T00:00:00.000Z",
    recent: null,
  };
  const authenticatedProfile = {
    ...publicProfile,
    id: "synthetic-viewer-profile",
  };
  const state = createFlowState();
  let refreshCalls = 0;

  await runStoredProfileRefreshFlow({
    async loadStoredProfile() {
      return {
        visibleProfile: publicProfile,
        refreshCandidate: selectImplicitProfileRefreshCandidate({
          publicProfile,
          authenticatedProfile,
        }),
      };
    },
    shouldRefresh: () => true,
    async refreshProfile() {
      refreshCalls += 1;
      return publicProfile;
    },
    isCurrent: () => true,
    ...callbacks(state),
  });

  assert.equal(state.profile, publicProfile);
  assert.equal(state.ready, true);
  assert.equal(state.refreshing, false);
  assert.equal(refreshCalls, 0);
});

test("the authenticated user's own profile remains eligible for the existing implicit refresh", () => {
  const authenticatedProfile = {
    id: "synthetic-owner-profile",
    rank: "Gold I",
    lzyumiLastLookupAt: "2026-11-10T00:00:00.000Z",
    recent: null,
  };

  assert.equal(selectImplicitProfileRefreshCandidate({
    publicProfile: null,
    authenticatedProfile,
  }), authenticatedProfile);
  assert.equal(selectImplicitProfileRefreshCandidate({
    publicProfile: authenticatedProfile,
    authenticatedProfile,
  }), authenticatedProfile);
});

test("publishes the stored snapshot while browser refresh is still pending, then replaces it atomically", async () => {
  const stored: TestProfile = {
    id: "synthetic-profile",
    rank: "Gold I",
    lzyumiLastLookupAt: "2026-11-10T00:00:00.000Z",
    recent: "stored-recent",
  };
  const fresh: TestProfile = {
    id: stored.id,
    rank: "Diamond I",
    lzyumiLastLookupAt: "2026-11-12T00:00:00.000Z",
    recent: null,
  };
  const refresh = deferred<TestProfile | null>();
  const storedReady = deferred<void>();
  const state = createFlowState();

  const flow = runStoredProfileRefreshFlow({
    async loadStoredProfile() {
      return { visibleProfile: stored, refreshCandidate: stored };
    },
    shouldRefresh: () => true,
    refreshProfile: () => refresh.promise,
    isCurrent: () => true,
    ...callbacks(state),
    onReady() {
      state.ready = true;
      storedReady.resolve();
    },
  });

  await storedReady.promise;
  assert.equal(state.ready, true);
  assert.equal(state.refreshing, true);
  assert.equal(state.profile, stored);
  assert.equal(state.profile.lzyumiLastLookupAt, "2026-11-10T00:00:00.000Z");
  assert.equal(state.successCount, 0);

  refresh.resolve(fresh);
  await flow;
  assert.equal(state.profile, fresh);
  assert.equal(state.profile.lzyumiLastLookupAt, "2026-11-12T00:00:00.000Z");
  assert.equal(state.profile.recent, null);
  assert.equal(state.refreshing, false);
  assert.equal(state.successCount, 1);
});

test("a stored-profile load failure exits loading through an actionable error callback", async () => {
  const state = createFlowState();

  await runStoredProfileRefreshFlow({
    async loadStoredProfile() {
      throw new Error("profile request timed out");
    },
    shouldRefresh: () => false,
    async refreshProfile() {
      return null;
    },
    isCurrent: () => true,
    ...callbacks(state),
  });

  assert.equal(state.ready, false);
  assert.equal(state.refreshing, false);
  assert.equal(state.error, "profile request timed out");
});

test("a required refresh failure keeps the previous snapshot and successful timestamp", async () => {
  const stored: TestProfile = {
    id: "synthetic-profile",
    rank: "Gold I",
    lzyumiLastLookupAt: "2026-11-10T00:00:00.000Z",
    recent: "stored-recent",
  };
  const state = createFlowState();

  await runStoredProfileRefreshFlow({
    async loadStoredProfile() {
      return { visibleProfile: stored, refreshCandidate: stored };
    },
    shouldRefresh: () => true,
    async refreshProfile() {
      throw new Error("provider code 7");
    },
    isCurrent: () => true,
    ...callbacks(state),
  });

  assert.equal(state.profile, stored);
  assert.equal(state.profile.lzyumiLastLookupAt, "2026-11-10T00:00:00.000Z");
  assert.equal(state.error, "provider code 7");
  assert.equal(state.refreshing, false);
  assert.equal(state.successCount, 0);
});

test("an obsolete refresh result after user change or unmount cannot change visible UI state", async () => {
  const stored: TestProfile = {
    id: "synthetic-profile-a",
    rank: "Gold I",
    lzyumiLastLookupAt: "2026-11-10T00:00:00.000Z",
    recent: null,
  };
  const staleFresh: TestProfile = {
    ...stored,
    rank: "Diamond I",
    lzyumiLastLookupAt: "2026-11-12T00:00:00.000Z",
  };
  const refresh = deferred<TestProfile | null>();
  const refreshStarted = deferred<void>();
  const state = createFlowState();
  let current = true;

  const flow = runStoredProfileRefreshFlow({
    async loadStoredProfile() {
      return { visibleProfile: stored, refreshCandidate: stored };
    },
    shouldRefresh: () => true,
    refreshProfile() {
      refreshStarted.resolve();
      return refresh.promise;
    },
    isCurrent: () => current,
    ...callbacks(state),
  });

  await refreshStarted.promise;
  current = false;
  refresh.resolve(staleFresh);
  await flow;

  assert.equal(state.profile, stored);
  assert.equal(state.successCount, 0);
  assert.equal(state.endCount, 0);
});

test("refresh API rejects unauthenticated writes at the server boundary", async () => {
  const { POST } = await import("../app/api/hub/refresh-my-profile/route");
  const response = await POST(new Request("http://localhost/api/hub/refresh-my-profile", {
    method: "POST",
    body: JSON.stringify({}),
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Not authenticated" });
});
