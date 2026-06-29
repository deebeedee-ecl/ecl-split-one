"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import {
  englishDuration,
  findLzyumiPlayer,
  loadChampionNames,
  summarizeLzyumiPlayer,
  type LzyumiPlayerSummary,
} from "@/lib/lzyumi-display";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionPlayer = {
  id: string;
  kookUserId: string;
  displayName: string;
  riotName: string | null;
  riotTag: string | null;
  side: string;
  eloAtReady: number;
  chinaServerId: number | null;
};

type Session = {
  id: string;
  gameLabel: string | null;
  status: string;
  createdAt: string;
  players: SessionPlayer[];
};

type LzyumiGame = {
  gameId: string;
  title?: string;
  titleTime?: string;
  isWin?: number;
};

type LzyumiDetail = {
  data?: {
    wgBattleDetailInfo?: Array<{
      nickNameStr?: string;
      nickName?: string;
      detailChampionId?: string | number;
      position?: string;
      win?: string;
      scoreInfo?: string;
    }>;
  } | null;
};

type LzyumiResponse = {
  battleInfo?: { openId?: string } | null;
  data?: LzyumiGame[] | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INHOUSE_LABEL = "\u65b0\u6a21\u5f0f"; // 新模式
const LZYUMI_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseTitle(title?: string) {
  if (!title) return { mode: "Unknown", time: "" };
  const [mode, time] = title.split("<br>");
  return { mode: (mode ?? "").trim(), time: (time ?? "").trim() };
}

function gameDateTime(game: LzyumiGame) {
  const { time } = parseTitle(game.title);
  return game.titleTime || time || "Date/time unavailable";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminInhousePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Per-player lookup state
  const [lookupLoading, setLookupLoading] = useState<string | null>(null); // kookUserId
  const [games, setGames] = useState<LzyumiGame[]>([]);
  const [rawProfile, setRawProfile] = useState<LzyumiResponse | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameDetails, setGameDetails] = useState<Record<string, LzyumiDetail>>({});
  const [gameSummaries, setGameSummaries] = useState<Record<string, LzyumiPlayerSummary>>({});

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/inhouse/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  function resetLookup() {
    setGames([]);
    setRawProfile(null);
    setSelectedGameId(null);
    setGameDetails({});
    setGameSummaries({});
    setResult(null);
  }

  function selectSession(s: Session) {
    setSelectedSession(s);
    resetLookup();
  }

  async function cancelSession(session: Session) {
    if (cancellingId !== null) return;

    const label = session.gameLabel ?? "this session";
    if (!window.confirm(`Cancel ${label}? This removes it from pending reports.`)) return;

    setCancellingId(session.id);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/inhouse/sessions/${session.id}/cancel`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? `Cancel failed (${response.status})`);
      }

      setSessions((current) => current.filter((item) => item.id !== session.id));
      if (selectedSession?.id === session.id) {
        setSelectedSession(null);
        resetLookup();
      }
      setResult({ ok: true, message: data.message ?? `${label} cancelled.` });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Cancel failed.",
      });
    } finally {
      setCancellingId(null);
    }
  }

  async function fetchGamesForPlayer(player: SessionPlayer) {
    if (!player.riotName) return;
    setLookupLoading(player.kookUserId);
    resetLookup();

    const nick = player.riotName; // name-only first (matches lzyumi lookup behaviour)
    const areaId = player.chinaServerId ?? 1;

    try {
      const signedUrls: string[] = await Promise.all(
        LZYUMI_FILTERS.map((f) =>
          fetch(
            `/api/lzyumi-sign?nickname=${encodeURIComponent(nick)}&areaId=${areaId}&filter=${f}&allCount=5`,
          )
            .then((r) => r.json())
            .then(({ url }: { url: string }) => url),
        ),
      );

      const responses: LzyumiResponse[] = await Promise.all(
        signedUrls.map((url) => fetch(url).then((r) => r.json()).catch(() => null)),
      );

      // Check if name-only returned anything; if not, retry with name+tag
      const hasData = responses.some(
        (r) => r?.battleInfo?.openId || (Array.isArray(r?.data) && r.data!.length > 0),
      );

      let finalResponses = responses;
      if (!hasData && player.riotTag) {
        const fullNick = `${player.riotName}#${player.riotTag}`;
        const retryUrls: string[] = await Promise.all(
          LZYUMI_FILTERS.map((f) =>
            fetch(
              `/api/lzyumi-sign?nickname=${encodeURIComponent(fullNick)}&areaId=${areaId}&filter=${f}&allCount=5`,
            )
              .then((r) => r.json())
              .then(({ url }: { url: string }) => url),
          ),
        );
        finalResponses = await Promise.all(
          retryUrls.map((url) => fetch(url).then((r) => r.json()).catch(() => null)),
        );
      }

      // Collect all games across all filters, deduplicate by gameId
      const profileResp = finalResponses.find((r) => r?.battleInfo?.openId) ?? null;
      setRawProfile(profileResp);

      const seen = new Set<string>();
      const allGames: LzyumiGame[] = [];
      for (const resp of finalResponses) {
        for (const g of resp?.data ?? []) {
          if (g.gameId && !seen.has(g.gameId)) {
            seen.add(g.gameId);
            allGames.push(g);
          }
        }
      }

      const inhouseGames = allGames.filter((g) => g.title?.includes(INHOUSE_LABEL));
      setGames(inhouseGames);

      // Auto-select the most recent 新模式 game
      setSelectedGameId(inhouseGames[0]?.gameId ?? null);

      const openId = profileResp?.battleInfo?.openId;
      if (openId) {
        const [detailEntries, championNames] = await Promise.all([
          Promise.all(
          inhouseGames.slice(0, 16).map(async (game) => {
            try {
              const signResponse = await fetch(
                `/api/lzyumi-sign?type=detail&openId=${encodeURIComponent(openId)}&gameId=${encodeURIComponent(game.gameId)}&areaId=${areaId}`,
              );
              if (!signResponse.ok) return null;
              const { url } = (await signResponse.json()) as { url: string };
              const detail = (await fetch(url).then((response) => response.json())) as LzyumiDetail;
              return [game.gameId, detail] as const;
            } catch {
              return null;
            }
          }),
          ),
          loadChampionNames(),
        ]);

        const details: Record<string, LzyumiDetail> = {};
        const summaries: Record<string, LzyumiPlayerSummary> = {};
        for (const entry of detailEntries) {
          if (!entry) continue;
          const [gameId, detail] = entry;
          details[gameId] = detail;
          const matchingPlayer = findLzyumiPlayer(
            detail.data?.wgBattleDetailInfo ?? [],
            player.riotName,
            player.riotTag,
          );
          if (matchingPlayer) {
            summaries[gameId] = summarizeLzyumiPlayer(matchingPlayer, championNames);
          }
        }
        setGameDetails(details);
        setGameSummaries(summaries);
      }
    } finally {
      setLookupLoading(null);
    }
  }

  async function submitReport() {
    if (!selectedSession || !selectedGameId || !rawProfile) return;
    setSubmitting(true);
    setResult(null);

    try {
      const openId = rawProfile.battleInfo?.openId ?? "";
      const areaId =
        selectedSession.players.find((p) => p.chinaServerId)?.chinaServerId ?? 1;

      // Fetch detail from admin's browser (residential IP)
      let detail = gameDetails[selectedGameId];
      if (!detail) {
        const detailSign = await fetch(
          `/api/lzyumi-sign?type=detail&openId=${encodeURIComponent(openId)}&gameId=${encodeURIComponent(selectedGameId)}&areaId=${areaId}`,
        ).then((r) => r.json());
        detail = await fetch(detailSign.url).then((r) => r.json());
      }

      const res = await fetch("/api/admin/inhouse/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          rawMatchData: {
            profile: rawProfile,
            gameId: selectedGameId,
            detail,
          },
        }),
      });

      const data = await res.json();
      const message = data.reply ?? data.message ?? JSON.stringify(data);
      setResult({ ok: res.ok, message });

      if (res.ok) {
        // Refresh sessions list — keep result visible, only clear lookup state
        setSessions((prev) => prev.filter((s) => s.id !== selectedSession.id));
        setSelectedSession(null);
        setGames([]);
        setRawProfile(null);
        setSelectedGameId(null);
        // Don't call resetLookup() — that clears result too
      }
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  const blue = selectedSession?.players.filter((p) => p.side === "BLUE") ?? [];
  const red = selectedSession?.players.filter((p) => p.side === "RED") ?? [];

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-2">Inhouse Reporter</h1>
      <p className="text-gray-400 text-sm mb-6">
        Select a pending session, look up any player&apos;s recent games via lzyumi, then submit
        to ingest the match.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Session list ─────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-yellow-400">Pending Sessions</h2>
          {loading && <p className="text-gray-400 text-sm">Loading…</p>}
          {!loading && sessions.length === 0 && (
            <p className="text-gray-400 text-sm">No ASSIGNED sessions.</p>
          )}
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSession(s)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedSession?.id === s.id
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-gray-700 bg-gray-900 hover:border-gray-500"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{s.gameLabel ?? "Unlabeled"}</span>
                  <span className="text-xs text-gray-400">{s.players.length} players</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{formatDate(s.createdAt)}</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-xs text-gray-600">{s.id}</div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      cancelSession(s);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        cancelSession(s);
                      }
                    }}
                    className="shrink-0 rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    aria-disabled={cancellingId !== null}
                  >
                    {cancellingId === s.id ? "Cancelling..." : "Cancel"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Session detail + lookup ────────────────────────── */}
        <div>
          {!selectedSession && (
            <p className="text-gray-500 text-sm mt-8">← Select a session</p>
          )}

          {selectedSession && (
            <div>
              <h2 className="text-lg font-semibold mb-1 text-yellow-400">
                {selectedSession.gameLabel ?? "Session"}{" "}
                <span className="text-sm text-gray-400 font-normal">
                  — {formatDate(selectedSession.createdAt)}
                </span>
              </h2>
              <p className="text-xs text-gray-500 mb-4 font-mono">{selectedSession.id}</p>

              {/* Teams */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {(
                  [
                    { label: "Blue Side", color: "text-blue-400", players: blue },
                    { label: "Red Side", color: "text-red-400", players: red },
                  ] as const
                ).map(({ label, color, players }) => (
                  <div key={label}>
                    <div className={`text-xs font-bold uppercase mb-2 ${color}`}>{label}</div>
                    <div className="space-y-1">
                      {players.map((p) => (
                        <div
                          key={p.kookUserId}
                          className="flex items-center justify-between bg-gray-900 rounded px-2 py-1.5 gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{p.displayName}</div>
                            {p.riotName && (
                              <div className="text-xs text-gray-400 truncate">
                            {p.riotName}
                                {p.riotTag ? `#${p.riotTag.replace(/^#+/, "")}` : ""}
                              </div>
                            )}
                            {!p.riotName && (
                              <div className="text-xs text-gray-600 italic">no Riot ID</div>
                            )}
                          </div>
                          {p.riotName && (
                            <button
                              onClick={() => fetchGamesForPlayer(p)}
                              disabled={lookupLoading !== null}
                              className="text-xs px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                            >
                              {lookupLoading === p.kookUserId ? "…" : "Fetch"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Game list */}
              {games.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2 text-gray-300">
                    Ranked Inhouse Games{" "}
                    <span className="text-gray-500 font-normal">
                      ({rawProfile?.battleInfo?.openId ? "openId ✓" : "no openId"})
                    </span>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {games.map((g) => {
                      const { mode, time } = parseTitle(g.title);
                      const isSelected = selectedGameId === g.gameId;
                      const summary = gameSummaries[g.gameId];
                      return (
                        <button
                          key={g.gameId}
                          onClick={() => setSelectedGameId(g.gameId)}
                          className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                            isSelected
                              ? "border-green-500 bg-green-500/10"
                              : "border-yellow-600 bg-yellow-600/5 hover:border-yellow-500"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-500 text-black px-1 rounded font-bold">
                              IH
                            </span>
                            <span className="text-sm font-semibold">Ranked Inhouse</span>
                            {isSelected && (
                              <span className="ml-auto text-xs text-green-400">selected</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-300">
                            {summary
                              ? `${summary.result} - ${summary.champion} - ${summary.role}`
                              : gameDetails[g.gameId]
                                ? "Champion and role unavailable for this player"
                                : "Loading champion and role..."}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {gameDateTime(g)} -{" "}
                            {englishDuration(g.title, g.titleTime)}
                            {summary?.kda ? ` - KDA ${summary.kda}` : ""}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5 font-mono truncate">
                            {g.gameId}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {games.length === 0 && lookupLoading === null && rawProfile === null && (
                <p className="text-gray-500 text-sm mb-4">
                  Click <strong>Fetch</strong> next to a player to load their recent lzyumi games.
                </p>
              )}

              {games.length === 0 && lookupLoading === null && rawProfile !== null && (
                <p className="text-red-400 text-sm mb-4">
                  No ranked inhouse games found. Try fetching another player from the same session.
                </p>
              )}

              {/* Submit */}
              {selectedGameId && rawProfile?.battleInfo?.openId && (
                <div className="space-y-2">
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm font-semibold text-yellow-200">
                    Be absolutely sure this is the correct ranked inhouse for the selected
                    session. Reporting applies LP/ELO changes.
                  </div>
                  <button
                    onClick={submitReport}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 font-semibold transition-colors"
                  >
                    {submitting ? "Reporting…" : `Report Ranked Inhouse Game`}
                  </button>
                </div>
              )}

              {result && (
                <div
                  className={`mt-3 p-3 rounded-lg text-sm ${
                    result.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
                  }`}
                >
                  {result.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
