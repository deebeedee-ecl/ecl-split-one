"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setSubmitting(false);
      setError("Admin login failed. Check the username and password.");
      return;
    }

    const next = searchParams.get("next");
    router.replace(next?.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-[1.5rem] border border-[#ff1728]/25 bg-[#111217]/95 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.58)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff1728] text-white shadow-[0_0_32px_rgba(255,23,40,0.35)]">
          <ShieldCheck size={24} />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ff1728]">
            ECL Admin
          </p>
          <h1 className="text-3xl font-black text-white">Control Panel</h1>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#aeb5da]">
            Username
          </span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/35 px-4 py-3 text-base font-bold text-white outline-none transition focus:border-[#ff1728]/70"
            placeholder="admin"
          />
        </label>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#aeb5da]">
            Password
          </span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            type="password"
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/35 px-4 py-3 text-base font-bold text-white outline-none transition focus:border-[#ff1728]/70"
            placeholder="Enter admin password"
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-[#ff1728]/30 bg-[#ff1728]/10 px-4 py-3 text-sm font-bold text-[#ff8a94]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff1728] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#ff3342] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LockKeyhole size={18} />
        {submitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="mt-5 text-xs font-semibold leading-relaxed text-[#6b7280]">
        Admin access is restricted to ECL staff. This session lasts 12 hours.
      </p>
    </form>
  );
}
