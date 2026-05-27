"use client";

import Link from "next/link";
import React, { useState } from "react";

const rankOptions = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
];

const roleOptions = ["Top", "Jungle", "Mid", "ADC", "Support"];

export default function FreeAgentPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitState("idle");
    setMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const riotTag = String(formData.get("riotTag") || "").trim();

    if (!/^\d+$/.test(riotTag)) {
      setSubmitState("error");
      setMessage("Riot tag must contain numbers only.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      playerName: String(formData.get("playerName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      riotName: String(formData.get("riotName") || "").trim(),
      riotTag,
      primaryRole: String(formData.get("primaryRole") || "").trim(),
      secondaryRole: String(formData.get("secondaryRole") || "").trim(),
      currentRank: String(formData.get("currentRank") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
    };

    try {
      const res = await fetch("/api/free-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitState("success");
        setMessage(
          "Your signup has been received. Admins will review it before adding you to the free agent pool."
        );
        form.reset();
      } else {
        setSubmitState("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.error("Free agent submit error:", error);
      setSubmitState("error");
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <Link
              href="/free-agents"
              className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55 transition hover:text-green-400"
            >
              Back To Free Agency
            </Link>

            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
              Player Signup
            </p>

            <h1 className="mt-4 text-4xl font-black uppercase tracking-tight md:text-6xl">
              Get On The Radar
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              Register as a free agent for late Split One opportunities,
              substitute needs, roster trades, and future ECL tournaments.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                Subs
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Be available when teams need cover.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                Rosters
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Captains can scout your roles and rank.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                Future
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Stay in the pool for upcoming splits.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.75fr_1.25fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-300">
              What Happens Next
            </p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-zinc-200">
              <p>Admins review the signup for a valid Riot ID and contact info.</p>
              <p>Approved players appear in the public free agent directory.</p>
              <p>Captains can reach out for emergency subs or future teams.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-white/70">
              Helpful Notes
            </p>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              Add WeChat, KOOK name, availability, preferred language, and
              whether you are happy to sub at short notice.
            </p>
          </div>
        </aside>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-[0_0_40px_rgba(74,222,128,0.06)]">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Alias / Nickname">
                <input
                  name="playerName"
                  className="field-input"
                  placeholder="How captains should know you"
                  required
                />
              </Field>

              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  className="field-input"
                  placeholder="For admin contact"
                  required
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
              <p className="text-sm leading-7 text-zinc-200">
                Enter your Riot ID exactly as it appears in League of Legends.
                Riot tag should be numbers only, for example{" "}
                <span className="font-semibold text-white">
                  deebeedee#34323
                </span>
                .
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Riot Name">
                <input
                  name="riotName"
                  className="field-input"
                  placeholder="deebeedee"
                  required
                />
              </Field>

              <Field label="Riot Tag">
                <input
                  name="riotTag"
                  inputMode="numeric"
                  pattern="[0-9]+"
                  title="Riot tag must contain numbers only"
                  className="field-input"
                  placeholder="34323"
                  required
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Primary Role">
                <select
                  name="primaryRole"
                  defaultValue=""
                  className="field-input"
                  required
                >
                  <option value="" disabled>
                    Select role
                  </option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Secondary Role">
                <select name="secondaryRole" defaultValue="" className="field-input">
                  <option value="">Optional</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Current Rank">
                <select
                  name="currentRank"
                  defaultValue=""
                  className="field-input"
                  required
                >
                  <option value="" disabled>
                    Select rank
                  </option>
                  {rankOptions.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notes / Contact / Availability">
              <textarea
                name="notes"
                className="field-input min-h-[140px] resize-y"
                placeholder="WeChat, KOOK name, available days, comfort roles, sub availability..."
              />
            </Field>

            {submitState === "success" && (
              <StatusBox tone="success" title="Signup Received" message={message} />
            )}

            {submitState === "error" && (
              <StatusBox tone="error" title="Submission Error" message={message} />
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-green-400 px-6 py-4 font-black uppercase tracking-wide text-black transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Submitting..." : "Submit Free Agent Signup"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-white/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusBox({
  tone,
  title,
  message,
}: {
  tone: "success" | "error";
  title: string;
  message: string;
}) {
  const classes =
    tone === "success"
      ? "border-green-400/20 bg-green-400/10 text-green-300"
      : "border-red-400/20 bg-red-400/10 text-red-300";

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.18em]">
        {title}
      </p>
      <p className="mt-2 text-sm leading-7 text-zinc-200">{message}</p>
    </div>
  );
}
