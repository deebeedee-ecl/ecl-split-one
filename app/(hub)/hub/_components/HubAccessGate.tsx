"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useHubBootstrap } from "./HubBootstrapProvider";

export function HubAccessGate({
  allowProfileSetup = false,
  children,
}: {
  allowProfileSetup?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { status } = useHubBootstrap();

  if (status === "authenticated" || (status === "profile-required" && allowProfileSetup)) {
    return children;
  }

  if (status === "signed-out") {
    return (
      <HubGateMessage
        title="Log in to enter the Hub"
        description="The ECL Hub is only available after you log in with your ECL account."
        actionHref="/login"
        actionLabel="Log in"
      />
    );
  }

  if (status === "profile-required") {
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
