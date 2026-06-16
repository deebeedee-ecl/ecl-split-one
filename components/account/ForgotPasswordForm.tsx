"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthMediaPanel } from "./AuthMediaPanel";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) throw resetError;

      setMessage("Check your email for the ECL password reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid w-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.44)] lg:grid-cols-[0.95fr_1.05fr]">
      <div className="flex min-h-[38rem] items-center px-8 py-10 sm:px-14 lg:px-20">
        <div className="w-full">
          <div className="mb-9 border-b border-white/15 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white/45">
              Account Recovery
            </p>
            <h1 className="mt-3 text-3xl font-black text-white">
              Reset your password
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
              Enter your ECL email and we will send you a reset link.
            </p>
          </div>

          <div className="space-y-5">
            <label className="block text-sm">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#d1d5db]">
                Email
              </span>
              <input
                value={email}
                type="email"
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-transparent bg-[#151619] px-5 py-4 text-white outline-none transition placeholder:text-[#777] focus:border-[#13d7d1]"
              />
            </label>

            {error && (
              <p className="border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                {error}
              </p>
            )}
            {message && (
              <p className="border border-[#b11226]/40 bg-[#b11226]/10 p-4 text-sm font-bold text-white">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#ae3bea] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#bf50f2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm font-bold text-white/65 transition hover:text-white"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>

      <AuthMediaPanel />
    </div>
  );
}
