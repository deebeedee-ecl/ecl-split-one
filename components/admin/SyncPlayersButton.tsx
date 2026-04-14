"use client";

import { useState } from "react";

export default function SyncPlayersButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSync() {
    try {
      setIsLoading(true);
      setMessage(null);
      setIsError(false);

      const res = await fetch("/api/admin/sync-players", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to sync players.");
      }

      setMessage(
        `Player sync complete. Created: ${data.created}, Updated: ${data.updated}, Skipped: ${data.skipped}`
      );

      window.location.reload();
    } catch (error) {
      console.error(error);
      setIsError(true);
      setMessage("Failed to sync players.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-400">
            Player System Sync
          </p>
          <p className="mt-1 text-sm text-white/65">
            Pull approved team registrations and approved/signed free agents into the Player table.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={isLoading}
          className="rounded-xl bg-green-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:scale-[1.02] hover:bg-green-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:hover:scale-100"
        >
          {isLoading ? "Syncing..." : "Sync All Players"}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            isError ? "text-red-300" : "text-green-200"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}