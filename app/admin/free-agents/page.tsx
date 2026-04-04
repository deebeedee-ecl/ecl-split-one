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
  signedToTeamId?: string | null;
  signedToTeamName?: string | null;
};

type Team = {
  id: string;
  name: string;
};

type EditForm = {
  playerName: string;
  email: string;
  riotName: string;
  riotTag: string;
  primaryRole: string;
  secondaryRole: string;
  currentRank: string;
  notes: string;
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
  "Unranked",
];

const roleOptions = ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"];

function normalizeRank(rank?: string | null) {
  const value = rank?.trim().toLowerCase() || "";

  if (value.includes("challenger")) return "Challenger";
  if (value.includes("grandmaster")) return "Grandmaster";
  if (value.includes("master")) return "Master";
  if (value.includes("diamond")) return "Diamond";
  if (value.includes("emerald")) return "Emerald";
  if (value.includes("platinum")) return "Platinum";
  if (value.includes("gold")) return "Gold";
  if (value.includes("silver")) return "Silver";
  if (value.includes("bronze")) return "Bronze";
  if (value.includes("iron")) return "Iron";

  return "Unranked";
}

export default function AdminFreeAgentsPage() {
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function fetchFreeAgents() {
    try {
      const res = await fetch("/api/free-agent");
      const data = await res.json();
      setFreeAgents(data);
    } catch (error) {
      console.error("Failed to fetch free agents:", error);
    }
  }

  async function fetchTeams() {
    try {
      const res = await fetch("/api/team");
      const data = await res.json();

      const safeTeams = Array.isArray(data)
        ? data.map((team: any) => ({
            id: team.id,
            name: team.name || team.teamName || "Unnamed Team",
          }))
        : [];

      setTeams(safeTeams);
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      setTeams([]);
    }
  }

  async function loadPageData() {
    setLoading(true);
    try {
      await Promise.all([fetchFreeAgents(), fetchTeams()]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(
    id: string,
    status: "approved" | "rejected" | "signed",
    extraData?: {
      signedToTeamId?: string | null;
      signedToTeamName?: string | null;
    }
  ) {
    try {
      const res = await fetch(`/api/free-agent/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...extraData,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update player");
      }

      if (status === "approved" && extraData?.signedToTeamName === null) {
        setMessage("Player returned to approved.");
      } else if (status === "approved") {
        setMessage("Player approved.");
      } else if (status === "rejected") {
        setMessage("Player rejected.");
      } else if (status === "signed") {
        setMessage("Player marked as signed.");
      }

      await fetchFreeAgents();
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong.");
    }
  }

  async function signPlayer(agent: FreeAgent) {
    const selectedTeamId = selectedTeams[agent.id];

    if (!selectedTeamId) {
      setMessage("Please select a team first.");
      return;
    }

    const chosenTeam = teams.find((team) => team.id === selectedTeamId);

    if (!chosenTeam) {
      setMessage("Selected team was not found.");
      return;
    }

    await updateStatus(agent.id, "signed", {
      signedToTeamId: chosenTeam.id,
      signedToTeamName: chosenTeam.name,
    });
  }

  async function returnToApproved(agent: FreeAgent) {
    await updateStatus(agent.id, "approved", {
      signedToTeamId: null,
      signedToTeamName: null,
    });
  }

  function startEditing(agent: FreeAgent) {
    setEditingId(agent.id);
    setEditForm({
      playerName: agent.playerName?.trim() || "",
      email: agent.email?.trim() || "",
      riotName: agent.riotName?.trim() || "",
      riotTag: agent.riotTag?.trim() || "",
      primaryRole: agent.primaryRole?.trim() || "",
      secondaryRole: agent.secondaryRole?.trim() || "",
      currentRank: normalizeRank(agent.currentRank),
      notes: agent.notes?.trim() || "",
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(agent: FreeAgent) {
    if (!editForm) return;

    setSavingEdit(true);

    try {
      const res = await fetch(`/api/free-agent/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: agent.status,
          signedToTeamId: agent.signedToTeamId ?? null,
          signedToTeamName: agent.signedToTeamName ?? null,
          playerName: editForm.playerName.trim(),
          email: editForm.email.trim(),
          riotName: editForm.riotName.trim(),
          riotTag: editForm.riotTag.trim(),
          primaryRole: editForm.primaryRole.trim(),
          secondaryRole: editForm.secondaryRole.trim() || null,
          currentRank: editForm.currentRank.trim() || "Unranked",
          notes: editForm.notes.trim() || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save player");
      }

      setMessage("Player updated.");
      setEditingId(null);
      setEditForm(null);
      await fetchFreeAgents();
    } catch (error) {
      console.error(error);
      setMessage("Failed to save player.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteAgent(id: string) {
    if (!confirm("Are you sure you want to delete this player?")) return;

    try {
      const res = await fetch(`/api/free-agent/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete player");
      }

      setMessage("Player deleted.");
      await fetchFreeAgents();
    } catch (error) {
      console.error(error);
      setMessage("Failed to delete player.");
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 2500);

    return () => clearTimeout(timer);
  }, [message]);

  if (loading) return <div className="p-6">Loading...</div>;

  const filtered = freeAgents.filter((a) =>
    filter === "all" ? true : a.status === filter
  );

  const sorted = [...filtered].sort((a, b) => {
    const rankA = rankOrder.indexOf(normalizeRank(a.currentRank));
    const rankB = rankOrder.indexOf(normalizeRank(b.currentRank));

    const safeRankA = rankA === -1 ? 999 : rankA;
    const safeRankB = rankB === -1 ? 999 : rankB;

    return safeRankA - safeRankB;
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

      {message && (
        <div className="mb-4 rounded-lg border border-green-400 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </div>
      )}

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
          const isEditing = editingId === agent.id;

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

          const displayRank = normalizeRank(agent.currentRank);
          const displayPrimaryRole = agent.primaryRole?.trim() || "-";
          const displaySecondaryRole = agent.secondaryRole?.trim() || "-";
          const displayEmail = agent.email?.trim() || "-";
          const displayNotes = agent.notes?.trim() || "";
          const signedTeamName = agent.signedToTeamName?.trim() || "-";

          return (
            <div
              key={agent.id}
              className="rounded-lg border bg-white p-4 text-black shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                <div className="flex-1 space-y-2">
                  {isEditing && editForm ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Player Name
                        </label>
                        <input
                          value={editForm.playerName}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev
                                ? { ...prev, playerName: e.target.value }
                                : prev
                            )
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Email
                        </label>
                        <input
                          value={editForm.email}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, email: e.target.value } : prev
                            )
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Riot Name
                        </label>
                        <input
                          value={editForm.riotName}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev
                                ? { ...prev, riotName: e.target.value }
                                : prev
                            )
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Riot Tag
                        </label>
                        <input
                          value={editForm.riotTag}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, riotTag: e.target.value } : prev
                            )
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Primary Role
                        </label>
                        <select
                          value={editForm.primaryRole}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev
                                ? { ...prev, primaryRole: e.target.value }
                                : prev
                            )
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        >
                          <option value="">Select role</option>
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Secondary Role
                        </label>
                        <select
                          value={editForm.secondaryRole}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev
                                ? { ...prev, secondaryRole: e.target.value }
                                : prev
                            )
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        >
                          <option value="">None</option>
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Rank
                        </label>
                        <select
                          value={editForm.currentRank}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev
                                ? { ...prev, currentRank: e.target.value }
                                : prev
                            )
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        >
                          {rankOrder.map((rank) => (
                            <option key={rank} value={rank}>
                              {rank}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-semibold">
                          Notes
                        </label>
                        <textarea
                          value={editForm.notes}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, notes: e.target.value } : prev
                            )
                          }
                          rows={4}
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        />
                      </div>
                    </div>
                  ) : (
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
                      <p>
                        <strong>Signed To:</strong>{" "}
                        {agent.status === "signed" ? (
                          <span className="font-semibold text-green-700">
                            {signedTeamName}
                          </span>
                        ) : (
                          "-"
                        )}
                      </p>

                      {displayNotes && (
                        <p className="pt-1 text-sm text-gray-700">
                          <strong>Notes:</strong> {displayNotes}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex w-full max-w-md flex-col gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(agent)}
                        disabled={savingEdit}
                        className="rounded bg-green-600 px-3 py-2 text-white disabled:opacity-60"
                      >
                        {savingEdit ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={savingEdit}
                        className="rounded bg-gray-300 px-3 py-2 text-black disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditing(agent)}
                        className="rounded bg-black px-3 py-2 text-white"
                      >
                        Edit
                      </button>

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
                        <>
                          <select
                            value={selectedTeams[agent.id] || ""}
                            onChange={(e) =>
                              setSelectedTeams((prev) => ({
                                ...prev,
                                [agent.id]: e.target.value,
                              }))
                            }
                            className="rounded border border-gray-300 px-3 py-2"
                          >
                            <option value="">Select team</option>
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => signPlayer(agent)}
                            className="rounded bg-blue-600 px-3 py-1 text-white"
                          >
                            Mark Signed
                          </button>
                        </>
                      )}

                      {agent.status === "signed" && (
                        <>
                          <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
                            Signed to {signedTeamName}
                          </div>

                          <select
                            value={selectedTeams[agent.id] || ""}
                            onChange={(e) =>
                              setSelectedTeams((prev) => ({
                                ...prev,
                                [agent.id]: e.target.value,
                              }))
                            }
                            className="rounded border border-gray-300 px-3 py-2"
                          >
                            <option value="">Change team</option>
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => signPlayer(agent)}
                            className="rounded bg-indigo-600 px-3 py-1 text-white"
                          >
                            Change Team
                          </button>

                          <button
                            onClick={() => returnToApproved(agent)}
                            className="rounded bg-yellow-500 px-3 py-1 text-black"
                          >
                            Release to Free Agency
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className="rounded border border-red-500 bg-black px-3 py-1 text-white"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}