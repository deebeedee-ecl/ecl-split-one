"use client";

import { useMemo, useState } from "react";

type GameOption = {
  gameNumber: number;
  hasStats: boolean;
};

export default function ResetGameStatsMenu({
  matchId,
  games,
}: {
  matchId: string;
  games: GameOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasAnyStats = useMemo(() => games.some((game) => game.hasStats), [games]);

  async function handleReset() {
    if (!selectedGame) return;

    try {
      setIsLoading(true);

      const res = await fetch("/api/admin/reset-game-stats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId,
          gameNumber: selectedGame,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reset game stats.");
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to reset game stats.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!hasAnyStats}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSelectedGame(null);
        }}
        className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-300 transition hover:border-red-400/50 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
      >
        Reset Game Stats
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-black p-4 shadow-2xl">
          {selectedGame === null ? (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
                Choose Game
              </p>

              <div className="space-y-2">
                {games.map((game) => (
                  <button
                    key={game.gameNumber}
                    type="button"
                    disabled={!game.hasStats}
                    onClick={() => setSelectedGame(game.gameNumber)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:border-red-400/40 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>Game {game.gameNumber}</span>
                    <span className="text-xs text-white/50">
                      {game.hasStats ? "Has Stats" : "Empty"}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
                Final Warning
              </p>

              <p className="mt-3 text-sm text-white/80">
                Are you sure you want to delete player stats for{" "}
                <span className="font-bold text-red-300">Game {selectedGame}</span>?
              </p>

              <p className="mt-2 text-xs text-white/55">
                This will recalculate ELO and streaks for the affected players.
                Match result data will stay, but the saved player stats for this game will be removed.
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:border-red-400/50 hover:bg-red-500/15 disabled:opacity-50"
                >
                  {isLoading ? "Resetting..." : "Yes, Reset"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}