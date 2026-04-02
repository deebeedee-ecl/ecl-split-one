"use client";

export default function DeleteTeamButton({ teamId }: { teamId: string }) {
  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this team?"
    );
    if (!confirmed) return;

    const res = await fetch(`/api/team-registration/${teamId}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => null);
    console.log("DELETE response:", res.status, data);

    if (!res.ok) {
      alert(data?.details || data?.error || "Failed to delete team");
      return;
    }

    window.location.reload();
  };

  return (
    <button
      onClick={handleDelete}
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
    >
      Delete
    </button>
  );
}