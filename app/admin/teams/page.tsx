"use client";

import { useEffect, useState } from "react";

type Player = {
  riotName: string;
  riotTag: string;
  rank: string;
};

type Team = {
  id: string;
  teamName: string;
  captainName: string;
  captainEmail: string;
  players: Player[];
  status: string;
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [filter, setFilter] = useState("all");

  async function fetchTeams() {
    const res = await fetch("/api/team");
    const data = await res.json();
    setTeams(data);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    fetchTeams();
  }

  useEffect(() => {
    fetchTeams();
  }, []);

  const filtered = teams.filter((team) => {
    if (filter === "all") return true;
    return team.status === filter;
  });

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Admin - Teams</h1>

      <div className="flex gap-2 mb-4">
        {["all", "pending", "approved", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 bg-gray-700 rounded"
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((team) => (
          <div
            key={team.id}
            className="border border-white/10 p-4 rounded-xl"
          >
            <h2 className="text-xl font-bold">{team.teamName}</h2>
            <p className="text-sm text-zinc-400">
              Captain: {team.captainName} ({team.captainEmail})
            </p>

            <div className="mt-3 space-y-1">
              {team.players.map((p, i) => (
                <p key={i}>
                  {p.riotName}#{p.riotTag} — {p.rank}
                </p>
              ))}
            </div>

            <p className="mt-2">Status: {team.status}</p>

            {team.status === "pending" && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => updateStatus(team.id, "approved")}
                  className="bg-green-500 px-3 py-1 rounded"
                >
                  Approve
                </button>
                <button
                  onClick={() => updateStatus(team.id, "rejected")}
                  className="bg-red-500 px-3 py-1 rounded"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}