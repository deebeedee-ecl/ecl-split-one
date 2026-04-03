"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FreeAgent = {
  id: string;
  playerName?: string | null;
  email?: string | null;
  riotName?: string | null;
  riotTag?: string | null;
  primaryRole?: string | null;
  secondaryRole?: string | null;
  currentRank?: string | null;
  notes?: string | null;
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

  const sorted = [...filtered].sort((a, b) => {
    const rankA = rankOrder.indexOf(a.currentRank || "");
    const rankB = rankOrder.indexOf(b.currentRank || "");

    const safeRankA = rankA === -1 ? -999 : rankA;
    const safeRankB = rankB === -1 ? -999 : rankB;

    return safeRankB - safeRankA;
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="mb-6 text-3xl font-bold">Admin - Free Agents</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "pending", "approved", "signed", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 ${
              filter === f ? "bg-black text-white" : "bg-gray-200 text-black"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {sorted.map((agent) => {
          const displayName =
            agent.playerName?.trim() ||
            agent.riotName?.trim() ||
            "Unknown Player";

          const displayRiotId =
            agent.riotName && agent.riotTag
              ? `${agent.riotName}#${agent.riotTag}`
              : agent.riotName
              ? agent.riotName
              : "-";

          const displayRank = agent.currentRank?.trim() || "-";
          const displayPrimaryRole = agent.primaryRole?.trim() || "-";
          const displaySecondaryRole = agent.secondaryRole?.trim() || "-";
          const displayEmail = agent.email?.trim() || "-";
          const displayNotes = agent.notes?.trim() || "";

          return (
            <div
              key={agent.id}
              className="rounded-lg border bg-white p-4 text-black shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-bold">{displayName}</p>
                  <p>
                    <strong>Riot ID:</strong> {displayRiotId}
                  </p>
                  <p>
                    <strong>Rank:</strong> {displayRank}
                  </p>
                  <p>
                    <strong>Primary Role:</strong> {displayPrimaryRole}
                  </p>
                  <p>
                    <strong>Secondary Role:</strong> {displaySecondaryRole}
                  </p>
                  <p>
                    <strong>Email:</strong> {displayEmail}
                  </p>
                  <p>
                    <strong>Status:</strong> {agent.status}
                  </p>
                  {displayNotes && (
                    <p className="pt-1 text-sm text-gray-700">
                      <strong>Notes:</strong> {displayNotes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {agent.status === "pending" && (
                    <>
                      <button
                        onClick={() => updateStatus(agent.id, "approved")}
                        className="rounded bg-green-600 px-3 py-1 text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(agent.id, "rejected")}
                        className="rounded bg-red-600 px-3 py-1 text-white"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {agent.status === "approved" && (
                    <button
                      onClick={() => updateStatus(agent.id, "signed")}
                      className="rounded bg-blue-600 px-3 py-1 text-white"
                    >
                      Signed
                    </button>
                  )}

                  {agent.status === "signed" && (
                    <button
                      onClick={() => updateStatus(agent.id, "approved")}
                      className="rounded bg-yellow-500 px-3 py-1 text-black"
                    >
                      Return to Approved
                    </button>
                  )}

                  <button
                    onClick={() => deleteAgent(agent.id)}
                    className="rounded border border-red-500 bg-black px-3 py-1 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}