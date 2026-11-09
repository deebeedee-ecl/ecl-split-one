import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type HubMinimalProfile = {
  id: string;
  accountStatus: string;
  verificationStatus: string;
};

export type HubBootstrapState =
  | { status: "loading"; session: Session | null; profile: null }
  | { status: "signed-out"; session: null; profile: null }
  | { status: "profile-required"; session: Session; profile: null }
  | { status: "authenticated"; session: Session; profile: HubMinimalProfile };

type HubBootstrapDependencies = {
  getSession: () => Promise<Session | null>;
  subscribe: (
    listener: (event: AuthChangeEvent, session: Session | null) => void,
  ) => () => void;
  flushPendingProfile: (accessToken: string) => Promise<unknown>;
  loadMinimalProfile: (accessToken: string) => Promise<HubMinimalProfile | null>;
};

const initialState: HubBootstrapState = {
  status: "loading",
  session: null,
  profile: null,
};

export function createHubBootstrapStore(dependencies: HubBootstrapDependencies) {
  let state = initialState;
  let started = false;
  let authRevision = 0;
  let requestRevision = 0;
  let unsubscribeAuth: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function publish(nextState: HubBootstrapState) {
    state = nextState;
    listeners.forEach((listener) => listener());
  }

  async function applySession(session: Session | null) {
    if (!session) {
      requestRevision += 1;
      publish({ status: "signed-out", session: null, profile: null });
      return;
    }

    if (state.session?.user.id === session.user.id) {
      if (state.status === "loading") {
        publish({ status: "loading", session, profile: null });
        return;
      }
      if (state.status === "authenticated" || state.status === "profile-required") {
        publish({ ...state, session });
        return;
      }
    }

    const revision = ++requestRevision;
    publish({ status: "loading", session, profile: null });

    await dependencies.flushPendingProfile(session.access_token).catch(() => null);
    const profile = await dependencies.loadMinimalProfile(session.access_token).catch(() => null);

    if (!started || revision !== requestRevision) return;

    const currentSession =
      state.session?.user.id === session.user.id ? state.session : session;

    publish(
      profile
        ? { status: "authenticated", session: currentSession, profile }
        : { status: "profile-required", session: currentSession, profile: null },
    );
  }

  function start() {
    if (started) return () => stop();
    started = true;

    unsubscribeAuth = dependencies.subscribe((event, session) => {
      if (event === "INITIAL_SESSION") return;
      authRevision += 1;
      void applySession(session);
    });

    const initialAuthRevision = authRevision;
    void dependencies
      .getSession()
      .then((session) => {
        if (!started || initialAuthRevision !== authRevision) return;
        return applySession(session);
      })
      .catch(() => {
        if (!started || initialAuthRevision !== authRevision) return;
        publish({ status: "signed-out", session: null, profile: null });
      });

    return () => stop();
  }

  function stop() {
    if (!started) return;
    started = false;
    authRevision += 1;
    requestRevision += 1;
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    state = initialState;
  }

  function markProfileAvailable(profile: HubMinimalProfile) {
    if (!state.session) return;
    publish({ status: "authenticated", session: state.session, profile });
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initialState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    stop,
    markProfileAvailable,
  };
}

export type HubBootstrapStore = ReturnType<typeof createHubBootstrapStore>;
