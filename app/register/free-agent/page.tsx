"use client";

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
          "Your free agent signup has been received and is now pending admin review."
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
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-4xl font-black uppercase md:text-6xl">
          Free Agent Signup
        </h1>

        <p className="mt-4 text-zinc-300">
          Sign up solo and we will place you into a team if accepted.
        </p>

        <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-[0_0_40px_rgba(74,222,128,0.06)]">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input
              name="playerName"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30"
              placeholder="Alias / Nickname"
              required
            />

            <input
              name="email"
              type="email"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30"
              placeholder="Email"
              required
            />

            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
              <p className="text-sm leading-7 text-zinc-200">
                Enter your Riot ID exactly as it appears in League of Legends.
                Example:{" "}
                <span className="font-semibold text-white">
                  deebeedee#34323
                </span>
              </p>

              <p className="mt-2 text-sm leading-7 text-yellow-300">
                Riot Name is required. Riot Tag is required and must be numbers
                only. Incorrect Riot IDs may cause your signup to be rejected.
              </p>
            </div>

            <input
              name="riotName"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30"
              placeholder="Riot Name (e.g. deebeedee)"
              required
            />

            <input
              name="riotTag"
              inputMode="numeric"
              pattern="[0-9]+"
              title="Riot tag must contain numbers only"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30"
              placeholder="Riot Tag (numbers only, e.g. 34323)"
              required
            />

            <select
              name="primaryRole"
              defaultValue=""
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/30"
              required
            >
              <option value="" disabled className="text-zinc-500">
                Select Primary Role
              </option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <select
              name="secondaryRole"
              defaultValue=""
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/30"
            >
              <option value="">Select Secondary Role (Optional)</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <select
              name="currentRank"
              defaultValue=""
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/30"
              required
            >
              <option value="" disabled>
                Select Current Rank
              </option>
              {rankOptions.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>

            <textarea
              name="notes"
              className="min-h-[120px] rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30"
              placeholder="Notes / WeChat / Extra Info"
            />

            {submitState === "success" && (
              <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-300">
                  Registration Submitted
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-200">{message}</p>
              </div>
            )}

            {submitState === "error" && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
                  Submission Error
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-200">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-green-400 px-6 py-3 font-bold text-black transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Submitting..." : "Submit Signup"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}