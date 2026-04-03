"use client";

import { useState } from "react";

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

const emptyPlayer = {
  playerName: "",
  riotName: "",
  riotTag: "",
  currentRank: "",
  primaryRole: "",
  secondaryRole: "",
};

export default function TeamRegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [players, setPlayers] = useState(
    Array.from({ length: 7 }, () => ({ ...emptyPlayer }))
  );
  const [loading, setLoading] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function updatePlayer(index: number, field: string, value: string) {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setPlayers(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSubmitState("idle");
    setMessage("");

    for (let i = 0; i < players.length; i++) {
      const tag = players[i].riotTag?.trim();
      if (tag && !/^\d+$/.test(tag)) {
        setSubmitState("error");
        setMessage(`Player ${i + 1} Riot Tag must be numbers only.`);
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamName,
          captainName,
          captainEmail,
          players,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      setSubmitState("success");
      setMessage("Your team has been submitted and is pending admin review.");

      setTeamName("");
      setCaptainName("");
      setCaptainEmail("");
      setPlayers(Array.from({ length: 7 }, () => ({ ...emptyPlayer })));
    } catch (error) {
      console.error(error);
      setSubmitState("error");
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-4xl font-black uppercase md:text-6xl">
          Team Registration
        </h1>

        <p className="mt-4 text-zinc-300">
          Register your premade roster for ECL Split One.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-[0_0_40px_rgba(74,222,128,0.06)]"
        >
          <div className="grid gap-4">
            <input
              placeholder="Team Name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 focus:border-green-400/30"
              required
            />

            <input
              placeholder="Captain Name"
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 focus:border-green-400/30"
              required
            />

            <input
              type="email"
              placeholder="Captain Email"
              value={captainEmail}
              onChange={(e) => setCaptainEmail(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 focus:border-green-400/30"
              required
            />

            <div className="space-y-4">
              {players.map((player, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4"
                >
                  <p className="mb-3 text-sm uppercase tracking-[0.15em] text-zinc-400">
                    Player {index + 1}
                  </p>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      placeholder="Alias / Nickname"
                      value={player.playerName}
                      onChange={(e) =>
                        updatePlayer(index, "playerName", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-3 py-2 focus:border-green-400/30"
                      required={index < 5}
                    />

                    <input
                      placeholder="Riot Name"
                      value={player.riotName}
                      onChange={(e) =>
                        updatePlayer(index, "riotName", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-3 py-2 focus:border-green-400/30"
                      required={index < 5}
                    />

                    <input
                      placeholder="Tag (numbers only)"
                      inputMode="numeric"
                      pattern="[0-9]+"
                      value={player.riotTag}
                      onChange={(e) =>
                        updatePlayer(index, "riotTag", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-3 py-2 focus:border-green-400/30"
                      required={index < 5}
                    />

                    <select
                      value={player.currentRank}
                      onChange={(e) =>
                        updatePlayer(index, "currentRank", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-3 py-2 focus:border-green-400/30"
                      required={index < 5}
                    >
                      <option value="">Select Rank</option>
                      {rankOptions.map((rank) => (
                        <option key={rank} value={rank}>
                          {rank}
                        </option>
                      ))}
                    </select>

                    <select
                      value={player.primaryRole}
                      onChange={(e) =>
                        updatePlayer(index, "primaryRole", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-3 py-2 focus:border-green-400/30"
                      required={index < 5}
                    >
                      <option value="">Select Primary Role</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    <select
                      value={player.secondaryRole}
                      onChange={(e) =>
                        updatePlayer(index, "secondaryRole", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-3 py-2 focus:border-green-400/30"
                    >
                      <option value="">Select Secondary Role</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {submitState === "success" && (
              <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-300">
                  Team Submitted
                </p>
                <p className="mt-2 text-sm text-zinc-200">{message}</p>
              </div>
            )}

            {submitState === "error" && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
                  Error
                </p>
                <p className="mt-2 text-sm text-zinc-200">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-green-400 px-6 py-3 font-bold text-black hover:bg-green-300 disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit Team"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}