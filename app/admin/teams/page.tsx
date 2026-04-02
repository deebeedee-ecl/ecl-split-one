<button
  onClick={async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this team?"
    );
    if (!confirmed) return;

    const res = await fetch(`/api/team-registration/${team.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("Failed to delete team");
      return;
    }

    window.location.reload();
  }}
  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
>
  Delete
</button>