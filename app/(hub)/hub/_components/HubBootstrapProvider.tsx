"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createHubBootstrapStore,
  type HubBootstrapState,
  type HubMinimalProfile,
} from "@/lib/hub-bootstrap";
import {
  flushPendingProfile,
  loadHubBootstrapProfile,
} from "@/components/account/client-account";
import { supabase } from "@/lib/supabase";

type HubBootstrapContextValue = HubBootstrapState & {
  accessToken: string | null;
  markProfileAvailable: (profile: HubMinimalProfile) => void;
};

const HubBootstrapContext = createContext<HubBootstrapContextValue | null>(null);

export function HubBootstrapProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createHubBootstrapStore({
      async getSession() {
        const { data } = await supabase.auth.getSession();
        return data.session;
      },
      subscribe(listener) {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          queueMicrotask(() => listener(event, session));
        });
        return () => subscription.unsubscribe();
      },
      flushPendingProfile: (accessToken) => flushPendingProfile(accessToken),
      loadMinimalProfile: (accessToken) => loadHubBootstrapProfile(accessToken),
    }),
  );
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  useEffect(() => store.start(), [store]);

  return (
    <HubBootstrapContext.Provider
      value={{
        ...state,
        accessToken: state.session?.access_token ?? null,
        markProfileAvailable: store.markProfileAvailable,
      }}
    >
      {children}
    </HubBootstrapContext.Provider>
  );
}

export function useHubBootstrap() {
  const context = useContext(HubBootstrapContext);
  if (!context) {
    throw new Error("useHubBootstrap must be used inside the Hub layout.");
  }
  return context;
}
