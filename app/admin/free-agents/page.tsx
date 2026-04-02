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
    try {
      const res = await fetch(`/api/free-agent/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      fetchFreeAgents();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    }
  }

  useEffect(() => {
    fetchFreeAgents();
  }, []);

  if (loading) {
    return <div className="p-6">Loading free agents...</div>;
  }

  const filteredAgents = freeAgents.filter((agent) => {
    if (filter === "all") return true;
    return agent.status === filter;
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Admin - Free Agents</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className="rounded bg-gray-200 px-3 py-1 text-black"
        >
          All
        </button>

        <button
          onClick={() => setFilter("pending")}
          className="rounded bg-gray-200 px-3 py-1 text-black"
        >
          Pending
        </button>

        <button
          onClick={() => setFilter("approved")}
          className="rounded bg-gray-200 px-3 py-1 text-black"
        >
          Approved
        </button>

        <button
          onClick={() => setFilter("signed")}
          className="rounded bg-gray-200 px-3 py-1 text-black"
        >
          Signed
        </button>

        <button
          onClick={() => setFilter("rejected")}
          className="rounded bg-gray-200 px-3 py-1 text-black"
        >
          Rejected
        </button>
      </div>

      <div className="space-y-4">
        {filteredAgents.length === 0 ? (
          <p>No free agent registrations found.</p>
        ) : (
          filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-lg border bg-white p-4 text-black shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p>
                    <strong>Player Name:</strong> {agent.playerName}
                  </p>
                  <p>
                    <strong>Email:</strong> {agent.email}
                  </p>
                  <p>
                    <strong>Riot ID:</strong> {agent.riotName}#{agent.riotTag}
                  </p>
                  <p>
                    <strong>Primary Role:</strong> {agent.primaryRole}
                  </p>
                  <p>
                    <strong>Secondary Role:</strong>{" "}
                    {agent.secondaryRole || "None"}
                  </p>
                  <p>
                    <strong>Current Rank:</strong>{" "}
                    {agent.currentRank || "Not provided"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span
                      className={`rounded px-2 py-1 text-sm font-medium ${
                        agent.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : agent.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : agent.status === "signed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </p>
                  <p>
                    <strong>Notes:</strong> {agent.notes || "None"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {agent.status === "pending" && (
                    <>
                      <button
                        onClick={() => updateStatus(agent.id, "approved")}
                        className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => updateStatus(agent.id, "rejected")}
                        className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {agent.status === "approved" && (
                    <>
                      <button
                        onClick={() => updateStatus(agent.id, "signed")}
                        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                      >
                        Mark Signed
                      </button>

                      <button
                        onClick={() => updateStatus(agent.id, "rejected")}
                        className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {agent.status === "signed" && (
                    <p className="text-sm italic text-gray-500">
                      Player has been signed
                    </p>
                  )}

                  {agent.status === "rejected" && (
                    <p className="text-sm italic text-gray-500">
                      Already rejected
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}