"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { useHubBootstrap } from "@/app/(hub)/hub/_components/HubBootstrapProvider";

type AccessState = "checking" | "allowed" | "denied" | "error";
type AccessResult = { accessToken: string; state: Exclude<AccessState, "checking"> };

export function ChinaStatsPreviewAccessGate({ children }: { children: ReactNode }) {
  const { accessToken } = useHubBootstrap();
  const [result, setResult] = useState<AccessResult | null>(null);
  const [revision, setRevision] = useState(0);
  const state: AccessState = !accessToken
    ? "denied"
    : result?.accessToken === accessToken
      ? result.state
      : "checking";

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    void fetch("/api/china-stats/access", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as { allowed?: unknown } | null;
        if (response.ok && body?.allowed === true) setResult({ accessToken, state: "allowed" });
        else if (response.status === 401 || response.status === 403) setResult({ accessToken, state: "denied" });
        else setResult({ accessToken, state: "error" });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ accessToken, state: "error" });
      });
    return () => controller.abort();
  }, [accessToken, revision]);

  if (state === "allowed") return children;

  return (
    <section className="mx-auto mt-16 max-w-2xl rounded-3xl border border-white/[0.08] bg-[#0d131d] p-8 text-center sm:p-12">
      {state === "checking" ? (
        <Loader2 size={30} className="mx-auto animate-spin text-[#36d7ff]" />
      ) : (
        <LockKeyhole size={30} className="mx-auto text-amber-200" />
      )}
      <h1 className="mt-5 text-2xl font-black text-white">
        {state === "checking" ? "Checking preview access" : "Preview access required"}
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-6 text-[#8290a4]">
        {state === "denied"
          ? "This preview is currently limited to invited ECL accounts."
          : state === "error"
            ? "Preview access could not be checked. Try again shortly."
            : "Confirming that this ECL account is invited to the preview."}
      </p>
      {state === "error" ? (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setRevision((value) => value + 1);
          }}
          className="mt-6 rounded-xl bg-[#0755C9] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0797F2]"
        >
          Try again
        </button>
      ) : state === "denied" ? (
        <Link
          href="/hub/dashboard"
          className="mt-6 inline-flex rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-black text-white transition hover:border-[#36d7ff]/40"
        >
          Return to ECL Hub
        </Link>
      ) : null}
    </section>
  );
}
