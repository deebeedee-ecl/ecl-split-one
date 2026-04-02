"use client";

import { useState } from "react";

export default function TeamRegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [players, setPlayers] = useState(
    Array(7).fill({ riotName: "", riotTag: "", rank: "" })
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function updatePlayer(index: number, field: string, value: string) {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setPlayers(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

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

      setMessage("Team submitted successfully!");

      setTeamName("");
      setCaptainName("");
      setCaptainEmail("");
      setPlayers(Array(7).fill({ riotName: "", riotTag: "", rank: "" }));
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
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
          className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-6"
        >
          <div className="grid gap-4">
            <input
              placeholder="Team Name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3"
              required
            />

            <input
              placeholder="Captain Name"
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3"
              required
            />

            <input
              type="email"
              placeholder="Captain Email"
              value={captainEmail}
              onChange={(e) => setCaptainEmail(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3"
              required
            />

            {/* PLAYER SLOTS */}
            <div className="space-y-4">
              {players.map((player, index) => (
                <div
                  key={index}
                  className="border border-white/10 p-3 rounded-xl"
                >
                  <p className="text-sm mb-2 text-zinc-400">
                    Player {index + 1}
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      placeholder="Riot Name"
                      value={player.riotName}
                      onChange={(e) =>
                        updatePlayer(index, "riotName", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-2 py-2"
                    />

                    <input
                      placeholder="Tag"
                      value={player.riotTag}
                      onChange={(e) =>
                        updatePlayer(index, "riotTag", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-2 py-2"
                    />

                    <input
                      placeholder="Rank"
                      value={player.rank}
                      onChange={(e) =>
                        updatePlayer(index, "rank", e.target.value)
                      }
                      className="bg-black border border-white/10 rounded px-2 py-2"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-green-400 px-6 py-3 font-bold text-black"
            >
              {loading ? "Submitting..." : "Submit Team"}
            </button>

            {message && <p className="text-green-400 text-sm">{message}</p>}
          </div>
        </form>
      </div>
    </main>
  );
}