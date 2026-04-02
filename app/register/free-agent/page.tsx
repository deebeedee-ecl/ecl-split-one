"use client";

import React from "react";

export default function FreeAgentPage() {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("submit fired");

    const formData = new FormData(e.currentTarget);

    const payload = {
      playerName: formData.get("playerName"),
      email: formData.get("email"),
      riotName: formData.get("riotName"),
      riotTag: formData.get("riotTag"),
      primaryRole: formData.get("primaryRole"),
      secondaryRole: formData.get("secondaryRole"),
      currentRank: formData.get("currentRank"),
      notes: formData.get("notes"),
    };

    console.log("payload:", payload);

    const res = await fetch("/api/free-agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("response status:", res.status);

    const data = await res.json();
    console.log("response data:", data);

    if (data.success) {
      alert("Submitted successfully!");
      e.currentTarget.reset();
    } else {
      alert(data.error || "Something went wrong");
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

        <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input
              name="playerName"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Alias / Nickname"
              required
            />

            <input
              name="email"
              type="email"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Email"
              required
            />

            {/* 🔥 Riot ID instructions */}
            <div className="space-y-2">
              <p className="text-sm text-zinc-400">
                Enter your Riot ID exactly as it appears in League of Legends.
                Example:{" "}
                <span className="text-white font-semibold">
                  deebeedee#34323
                </span>
              </p>

              <p className="text-sm text-yellow-400">
                If this does not match your real Riot ID, your signup may be rejected.
              </p>
            </div>

            <input
              name="riotName"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Riot Name (e.g. deebeedee)"
              required
            />

            <input
              name="riotTag"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Riot Tag (e.g. 34323)"
              required
            />

            <input
              name="primaryRole"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Main Role"
              required
            />

            <input
              name="secondaryRole"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Secondary Role"
            />

            <input
              name="currentRank"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Rank"
            />

            <textarea
              name="notes"
              className="min-h-[120px] rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
              placeholder="Notes / WeChat / Extra Info"
            />

            <button
              type="submit"
              className="rounded-2xl bg-green-400 px-6 py-3 font-bold text-black transition hover:bg-green-300"
            >
              Submit Signup
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}