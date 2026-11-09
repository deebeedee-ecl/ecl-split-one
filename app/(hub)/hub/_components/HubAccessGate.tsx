"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  clearHubAccessCache,
  flushPendingProfile,
  getHubAccessCache,
  loadProfile,
  setHubAccessCache,
} from "@/components/account/client-account";
import { supabase } from "@/lib/supabase";

type HubAccessState = "checking" | "ready" | "login" | "profile";

export function HubAccessGate({
  allowProfileSetup = false,
  children,
}: {
  allowProfileSetup?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [state, setState] = useState<HubAccessState>(() => {
    const cached = getHubAccessCache();
    if (cached?.status === "ready") return "ready";
    if (cached?.status === "profile" && allowProfileSetup) return "profile";
    return "checking";
  });

  useEffect(() => {
    let cancelled = false;
    const cached = getHubAccessCache();

    if (cached?.status === "ready" || (cached?.status === "profile" && allowProfileSetup)) {
      setState(cached.status);
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          clearHubAccessCache();
          setState("login");
        }
      });

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }

    async function checkAccess() {
      setState("checking");

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        clearHubAccessCache();
        if (!cancelled) setState("login");
        return;
      }

      await flushPendingProfile().catch(() => null);
      const profile = await loadProfile();

      if (cancelled) return;

      if (profile) {
        setHubAccessCache("ready");
        setState("ready");
        return;
      }

      if (allowProfileSetup) {
        setHubAccessCache("profile");
        setState("profile");
        return;
      }

      setHubAccessCache("profile");
      setState("profile");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearHubAccessCache();
        setState("login");
      }
    });

    checkAccess();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [allowProfileSetup]);

  if (state === "ready" || (state === "profile" && allowProfileSetup)) {
    return children;
  }

  if (state === "login") {
    return (
      <HubGateMessage
        title="Log in to enter the Hub"
        description="The ECL Hub is only available after you log in with your ECL account."
        actionHref="/login"
        actionLabel="Log in"
      />
    );
  }

  if (state === "profile") {
    return (
      <HubGateMessage
        title="Complete your Hub profile"
        description="Your account is logged in, but the Hub could not load a completed player profile for this page."
        actionHref={`/hub/settings?next=${encodeURIComponent(pathname)}`}
        actionLabel="Open settings"
      />
    );
  }

  return (
    <section className="rounded-[1.4rem] border border-white/[0.08] bg-[#191a1f] p-8 text-sm font-bold text-[#aeb5da]">
      Checking Hub access...
    </section>
  );
}

function HubGateMessage({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-10 text-center shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#aeb5da]">
        {description}
      </p>
      <Link
        href={actionHref}
        className="mt-7 inline-flex rounded-2xl bg-[#0755C9] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0797F2]"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
