"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushPendingProfile, loadProfile } from "@/components/account/client-account";
import { supabase } from "@/lib/supabase";

type HubAccessState = "checking" | "ready" | "login" | "profile";

export function HubAccessGate({
  allowProfileSetup = false,
  children,
}: {
  allowProfileSetup?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<HubAccessState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      setState("checking");

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setState("login");
        return;
      }

      await flushPendingProfile().catch(() => null);
      const profile = await loadProfile();

      if (cancelled) return;

      if (profile) {
        setState("ready");
        return;
      }

      if (allowProfileSetup) {
        setState("profile");
        return;
      }

      router.replace(`/hub/settings?next=${encodeURIComponent(pathname)}`);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAccess();
    });

    checkAccess();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [allowProfileSetup, pathname, router]);

  if (state === "ready" || state === "profile") {
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
        className="mt-7 inline-flex rounded-2xl bg-[#ff1728] px-5 py-3 text-sm font-black text-white transition hover:bg-[#d91524]"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
