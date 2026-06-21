"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthMediaPanel } from "./AuthMediaPanel";
import {
  cleanSignupProfilePayload,
  pendingProfileKey,
  saveProfile,
  type SignupProfilePayload,
} from "./client-account";
import { chinaServerOptions } from "./account-options";

const initialForm: SignupProfilePayload & { email: string; password: string } = {
  email: "",
  password: "",
  displayName: "",
  riotName: "",
  riotTag: "",
  chinaServerId: "1",
  chinaServerName: "Ionia",
  openId: "",
  kookUsername: "",
  kookId: "",
  wechatId: "",
  primaryRole: "MID",
  secondaryRole: "SUP",
  currentRank: "Unranked",
  nationality: "",
  timezone: "Asia/Shanghai",
  bio: "",
  avatarStyle: "crest",
  avatarUrl: "",
  bannerUrl: "",
  dashboardTheme: "crimson",
  championPool: {
    main: [],
    learning: [],
  },
  privacySettings: {
    showWechat: false,
    showEmail: false,
    showRiotId: true,
    bannerPositionY: 50,
  },
};

type SignupFormState = typeof initialForm;

function getSignupErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : "Signup failed.";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("email rate limit") || lowerMessage.includes("rate limit")) {
    return "Email signup is temporarily busy. Please try again later or contact an ECL admin.";
  }

  return message;
}

export default function SignupForm() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profilePayload = useMemo<SignupProfilePayload>(
    () =>
      cleanSignupProfilePayload({
        ...form,
        championPool: initialForm.championPool,
      }) as SignupProfilePayload,
    [form]
  );

  function update<K extends keyof SignupFormState>(key: K, value: SignupFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirmed`,
          data: {
            display_name: form.displayName,
            riot_id: `${form.riotName}#${form.riotTag}`,
            kook_username: form.kookUsername,
            ecl_profile: profilePayload,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session?.access_token) {
        const profile = await saveProfile(profilePayload, "POST");
        const code = profile?.kookVerifications?.[0]?.code;
        setMessage(
          code
            ? `Account created. Email is confirmed for this session. Send ${code} to the ECL KOOK bot to link KOOK.`
            : "Account created. Your profile is ready for KOOK verification."
        );
      } else {
        window.localStorage.setItem(pendingProfileKey, JSON.stringify(profilePayload));
        setMessage(
          "Check your email to confirm the account, then log in. Your ECL identity details were saved locally and will sync after login."
        );
      }
    } catch (err) {
      setError(getSignupErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid w-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.44)] lg:grid-cols-[0.95fr_1.05fr]">
      <div className="px-8 py-10 sm:px-14 lg:px-20">
        <div className="mb-9 grid grid-cols-2 border-b border-white/15 text-center text-xl font-black">
          <span className="border-b-2 border-white px-4 py-4 text-white">
            Register
          </span>
          <Link
            href="/login"
            className="px-4 py-4 text-white/55 transition hover:text-white"
          >
            Log In
          </Link>
        </div>

        <div className="grid gap-5">
          <Section title="Account">
            <Field label="Email" value={form.email} onChange={(value) => update("email", value)} type="email" />
            <Field label="Password" value={form.password} onChange={(value) => update("password", value)} type="password" />
            <Field label="Display name" value={form.displayName} onChange={(value) => update("displayName", value)} />
          </Section>

          <Section title="League Identity">
            <Field label="Riot name" value={form.riotName} onChange={(value) => update("riotName", value)} />
            <Field label="Riot tag" value={form.riotTag} onChange={(value) => update("riotTag", value)} placeholder="e.g. 12345" />
            <ServerField
              value={form.chinaServerId}
              onChange={(value) => {
                const server = chinaServerOptions.find((item) => item.id === value) ?? chinaServerOptions[0];
                update("chinaServerId", server.id);
                update("chinaServerName", server.name);
              }}
            />
          </Section>

          <Section title="Community Verification">
            <Field label="KOOK username" value={form.kookUsername} onChange={(value) => update("kookUsername", value)} />
            <Field label="KOOK ID" value={form.kookId} onChange={(value) => update("kookId", value)} placeholder="Optional until bot confirms" />
            <Field label="WeChat ID" value={form.wechatId} onChange={(value) => update("wechatId", value)} placeholder="Used only for reply/help if allowed" />
          </Section>

          {error && <p className="border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</p>}
          {message && <p className="border border-[#b11226]/40 bg-[#b11226]/10 p-4 text-sm font-bold text-white">{message}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className="rounded-xl bg-[#ae3bea] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#bf50f2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create ECL Account"}
          </button>
        </div>
      </div>

      <AuthMediaPanel />
    </div>
  );
}

function ServerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-bold text-[#d1d5db]">China server</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-white outline-none transition focus:border-[#b11226]"
      >
        {chinaServerOptions.map((server) => (
          <option key={server.id} value={server.id}>
            {server.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-[#1f1f1f] bg-black/25 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-white">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-bold text-[#d1d5db]">{label}</span>
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-white outline-none transition placeholder:text-[#6b7280] focus:border-[#b11226]"
      />
    </label>
  );
}
