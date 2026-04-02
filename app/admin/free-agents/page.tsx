"use client";

import { useEffect, useState } from "react";

type FreeAgent = {
  id: string;
  playerName: string;
  email: string;
  riotName: string;
  riotTag: string;
  primaryRole: string;
  secondaryRole: string | null;
  currentRank: string | null;
  notes: string | null;
  status: string;
  submittedAt: string;
};

const rankOrder = [
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

export default function AdminFreeAgentsPage() {
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function fetchFreeAgents() {
    try {
      const res = await fetch("/api/free-agent");
      const data = await res.json();
      setFreeAgents(data);
    } catch (error) {
      console.error("Failed to fetch free agents:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(
    id: string,
    status: "approved" | "rejected" | "signed"
  ) {
    await fetch(`/api/free-agent/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    fetchFreeAgents();
  }

  async function deleteAgent(id: string) {
    if (!confirm("Are you sure you want to delete this player?")) return;

    await fetch(`/api/free-agent/${id}`, {
      method: "DELETE",
    });

    fetchFreeAgents();
  }

  useEffect(() => {
    fetchFreeAgents();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  const filtered = freeAgents.filter((a) =>
    filter === "all" ? true : a.status === filter
  );

  // 🔥 SORT BY RANK
  const sorted = [...filtered].sort((a, b) => {
    const rankA = rankOrder.indexOf(a.currentRank || "");
    const rankB = rankOrder.indexOf(b.currentRank || "");

    return rankB - rankA;
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Admin - Free Agents</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "pending", "approved", "signed", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded bg-gray-200 px-3 py-1 text-black"
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {sorted.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border bg-white p-4 text-black shadow-sm"
          >
            <div className="flex justify-between gap-4">
              <div className="space-y-1">
                <p><strong>{agent.playerName}</strong></p>
                <p>{agent.riotName}#{agent.riotTag}</p>
                <p>Rank: {agent.currentRank}</p>
                <p>Status: {agent.status}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {agent.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(agent.id, "approved")} className="bg-green-600 text-white px-3 py-1 rounded">
                      Approve
                    </button>
                    <button onClick={() => updateStatus(agent.id, "rejected")} className="bg-red-600 text-white px-3 py-1 rounded">
                      Reject
                    </button>
                  </>
                )}

                {agent.status === "approved" && (
                  <>
                    <button onClick={() => updateStatus(agent.id, "signed")} className="bg-blue-600 text-white px-3 py-1 rounded">
                      Signed
                    </button>
                  </>
                )}

                {/* 🔥 DELETE BUTTON */}
                <button
                  onClick={() => deleteAgent(agent.id)}
                  className="bg-black text-white px-3 py-1 rounded border border-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}