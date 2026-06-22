"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthMediaPanel } from "./AuthMediaPanel";
import { flushPendingProfile, loadProfile, setHubAccessCache } from "./client-account";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      const profile = (await flushPendingProfile().catch(() => null)) ?? (await loadProfile());
      setHubAccessCache(profile ? "ready" : "profile");
      setMessage(
        profile
          ? "Logged in and synced your pending ECL profile."
          : "Logged in. Opening your dashboard."
      );

      router.push("/hub/me");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid w-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.44)] lg:grid-cols-[0.95fr_1.05fr]">
      <div className="flex min-h-[38rem] items-center px-8 py-10 sm:px-14 lg:px-20">
        <div className="w-full">
          <div className="mb-9 grid grid-cols-2 border-b border-white/15 text-center text-xl font-black">
            <Link
              href="/signup"
              className="px-4 py-4 text-white/55 transition hover:text-white"
            >
              Register
            </Link>
            <span className="border-b-2 border-white px-4 py-4 text-white">
              Log In
            </span>
          </div>

          <div className="space-y-5">
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#d1d5db]">Email</span>
            <input
              value={email}
              type="email"
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-transparent bg-[#151619] px-5 py-4 text-white outline-none transition placeholder:text-[#777] focus:border-[#13d7d1]"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#d1d5db]">Password</span>
            <input
              value={password}
              type="password"
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-transparent bg-[#151619] px-5 py-4 text-white outline-none transition placeholder:text-[#777] focus:border-[#13d7d1]"
            />
          </label>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-bold text-white/70 transition hover:text-white"
            >
              Forgot password?
            </Link>
          </div>

          {error && <p className="border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</p>}
          {message && <p className="border border-[#b11226]/40 bg-[#b11226]/10 p-4 text-sm font-bold text-white">{message}</p>}

          <button
            type="button"
            onClick={login}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#ae3bea] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#bf50f2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
          </div>
        </div>
      </div>

      <AuthMediaPanel />
    </div>
  );
}
