"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { flushPendingProfile } from "./client-account";

type Status = "checking" | "ready" | "login";

export default function AuthConfirmed() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("Finishing your ECL verification...");

  useEffect(() => {
    let mounted = true;

    async function finishConfirmation() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session?.access_token) {
        await flushPendingProfile().catch(() => null);
        setStatus("ready");
        setMessage("Your email is verified and your ECL account is ready.");
        return;
      }

      setStatus("login");
      setMessage("Your email is verified. Log in to continue to the ECL Hub.");
    }

    finishConfirmation();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#050505] px-4 py-10 text-white sm:px-6">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.18),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(19,215,209,0.14),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[1.4rem] border border-white/10 bg-black px-8 py-10 text-center shadow-[0_28px_90px_rgba(0,0,0,0.44)] sm:px-12">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-white/45">
            ECL Account
          </p>
          <h1 className="mt-4 text-4xl font-black text-white">
            Email verified
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-6 text-white/65">
            {message}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {status === "ready" ? (
              <Link
                href="/hub/me"
                className="rounded-xl bg-[#ae3bea] px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#bf50f2]"
              >
                Open my hub
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-[#ae3bea] px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#bf50f2]"
              >
                Continue to login
              </Link>
            )}

            <Link
              href="/"
              className="rounded-xl border border-white/15 px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:border-white/35"
            >
              Back home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
