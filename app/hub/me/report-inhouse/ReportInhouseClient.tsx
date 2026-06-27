"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAccessToken, loadProfile } from "@/components/account/client-account";
import {
  englishDuration,
  findLzyumiPlayer,
  loadChampionNames,
  summarizeLzyumiPlayer,
  type LzyumiPlayerSummary,
} from "@/lib/lzyumi-display";

const INHOUSE_LABEL = "\u65b0\u6a21\u5f0f";
const LZYUMI_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const LZYUMI_GAMES_PER_FILTER = 20;

type SessionPlayer = {
  id: string;
  kookUserId: string;
  displayName: string;
  riotName: string | null;
  riotTag: string | null;
  side: string;
  chinaServerId: number | null;
};

type ReportSession = {
  id: string;
  gameLabel: string | null;
  status: string;
  createdAt: string;
  players: SessionPlayer[];
};

type ReportSessionResponse = {
  sessions: ReportSession[];
  recentlyCompleted: ReportSession | null;
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

function formatDate(iso?: string) {
  if (!iso) return "Date unavailable";
  return new Date(iso).toLocaleString("en-GB", {
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

function playerRiotId(player: SessionPlayer) {
  if (!player.riotName) return "No Riot ID";
  return `${player.riotName}${player.riotTag ? `#${player.riotTag.replace(/^#+/, "")}` : ""}`;
}

export default function ReportInhouseClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ReportSession | null>(null);
  const [currentKookId, setCurrentKookId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState<string | null>(null);
  const [lookupPlayer, setLookupPlayer] = useState<SessionPlayer | null>(null);
  const [games, setGames] = useState<LzyumiGame[]>([]);
  const [rawProfile, setRawProfile] = useState<LzyumiResponse | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameDetails, setGameDetails] = useState<Record<string, LzyumiDetail>>({});
  const [gameSummaries, setGameSummaries] = useState<Record<string, LzyumiPlayerSummary>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login?next=/hub/me/report-inhouse");
          return;
        }

        const profile = await loadProfile();
        if (!profile) {
          router.replace("/hub/settings");
          return;
        }
        setCurrentKookId(profile.kookId ?? null);

        const res = await fetch("/api/hub/report-session", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const payload = (await res.json().catch(() => ({}))) as
          | ReportSessionResponse
          | { message?: string };

        if (!res.ok) {
          throw new Error(
            "message" in payload && payload.message
              ? payload.message
              : "Could not load your inhouse sessions.",
          );
        }

        const reportData = payload as ReportSessionResponse;
        if (!cancelled) {
          setSessions(reportData.sessions ?? []);
          setSelectedSession(reportData.sessions?.[0] ?? null);
          if ((reportData.sessions ?? []).length === 0 && reportData.recentlyCompleted) {
            setResult({
              ok: true,
              message: `${reportData.recentlyCompleted.gameLabel ?? "Your latest inhouse"} has already been reported.`,
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(error instanceof Error ? error.message : "Could not load report page.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSessions();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function resetLookup() {
    setGames([]);
    setRawProfile(null);
    setLookupPlayer(null);
    setSelectedGameId(null);
    setGameDetails({});
    setGameSummaries({});
    setResult(null);
  }

  function selectSession(session: ReportSession) {
    setSelectedSession(session);
    resetLookup();
  }

  async function fetchGamesForPlayer(player: SessionPlayer) {
    if (!player.riotName) return;

    resetLookup();
    setLookupPlayer(player);
    setLookupLoading(player.kookUserId);

    const areaId = player.chinaServerId ?? 1;
    const nameOnly = player.riotName;
    const nameWithTag = player.riotTag ? `${player.riotName}#${player.riotTag}` : nameOnly;

    try {
      const loadForNick = async (nick: string) => {
        const signedUrls: string[] = await Promise.all(
          LZYUMI_FILTERS.map((filter) =>
            fetch(
              `/api/lzyumi-sign?nickname=${encodeURIComponent(nick)}&areaId=${areaId}&filter=${filter}&allCount=${LZYUMI_GAMES_PER_FILTER}`,
            )
              .then((response) => response.json())
              .then(({ url }: { url: string }) => url),
          ),
        );

        return Promise.all(
          signedUrls.map((url) =>
            fetch(url)
              .then((response) => response.json())
              .catch(() => null),
          ),
        ) as Promise<LzyumiResponse[]>;
      };

      let responses = await loadForNick(nameOnly);
      const hasData = responses.some(
        (response) =>
          response?.battleInfo?.openId ||
          (Array.isArray(response?.data) && response.data.length > 0),
      );

      if (!hasData && nameWithTag !== nameOnly) {
        responses = await loadForNick(nameWithTag);
      }

      const profileResponse = responses.find((response) => response?.battleInfo?.openId) ?? null;
      setRawProfile(profileResponse);

      const seen = new Set<string>();
      const allGames: LzyumiGame[] = [];
      for (const response of responses) {
        for (const game of response?.data ?? []) {
          if (game.gameId && !seen.has(game.gameId)) {
            seen.add(game.gameId);
            allGames.push(game);
          }
        }
      }

      const inhouseGames = allGames.filter((game) => game.title?.includes(INHOUSE_LABEL));
      setGames(inhouseGames);
      setSelectedGameId(inhouseGames[0]?.gameId ?? null);

      const openId = profileResponse?.battleInfo?.openId;
      if (!openId || inhouseGames.length === 0) return;

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
    } finally {
      setLookupLoading(null);
    }
  }

  async function submitReport() {
    if (!selectedSession || !selectedGameId || !rawProfile) return;

    setSubmitting(true);
    setResult(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");

      const openId = rawProfile.battleInfo?.openId ?? "";
      const areaId = selectedSession.players.find((player) => player.chinaServerId)?.chinaServerId ?? 1;

      let detail = gameDetails[selectedGameId];
      if (!detail) {
        const detailSign = await fetch(
          `/api/lzyumi-sign?type=detail&openId=${encodeURIComponent(openId)}&gameId=${encodeURIComponent(selectedGameId)}&areaId=${areaId}`,
        ).then((response) => response.json());
        detail = await fetch(detailSign.url).then((response) => response.json());
      }

      const response = await fetch("/api/hub/report-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          rawMatchData: {
            profile: rawProfile,
            gameId: selectedGameId,
            detail,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.reply ?? payload.message ?? `Report failed (${response.status})`);
      }

      setResult({ ok: true, message: payload.reply ?? "Match reported successfully." });
      setSessions((previous) => previous.filter((session) => session.id !== selectedSession.id));
      setSelectedSession(null);
      setGames([]);
      setRawProfile(null);
      setLookupPlayer(null);
      setSelectedGameId(null);
      setGameDetails({});
      setGameSummaries({});
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Report failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const blue = selectedSession?.players.filter((player) => player.side === "BLUE") ?? [];
  const red = selectedSession?.players.filter((player) => player.side === "RED") ?? [];

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#191a21] px-6 py-8 text-[#8f98c0]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm font-bold">Loading your reportable inhouse sessions...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-4 rounded-2xl border border-[#ff4058]/30 bg-[#191a21] px-6 py-8">
        <div className="flex items-start gap-3 text-[#ff6b6b]">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm font-bold">{errorMsg}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs font-black text-[#8f98c0] hover:text-white"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#ffd84d]/25 bg-[#ffd84d]/10 px-5 py-4 text-sm font-bold text-[#ffe477]">
        This page only shows inhouse sessions that include your KOOK account. Pick the right IH,
        fetch match data from your roster, then confirm the exact Ranked Inhouse game.
      </div>

      {result && (
        <div
          className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
            result.ok
              ? "border-[#20b86f]/30 bg-[#20b86f]/10 text-[#20b86f]"
              : "border-[#ff4058]/30 bg-[#ff4058]/10 text-[#ff6b6b]"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <section className="rounded-2xl border border-white/[0.08] bg-[#191a21] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Your Pending Sessions</h2>
            <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-black text-[#8f98c0]">
              {sessions.length}
            </span>
          </div>

          {sessions.length === 0 ? (
            <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#8f98c0]">
              No pending inhouse sessions found for your KOOK account.
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedSession?.id === session.id
                      ? "border-[#ffd84d] bg-[#ffd84d]/10"
                      : "border-white/[0.08] bg-white/[0.04] hover:border-white/[0.2]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-black text-white">
                      {session.gameLabel ?? "Ranked Inhouse"}
                    </span>
                    <span className="text-xs font-black text-[#8f98c0]">
                      {session.players.length} players
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#8f98c0]">
                    {formatDate(session.createdAt)}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-mono text-[#4d5577]">
                    {session.id}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#191a21] p-5">
          {!selectedSession ? (
            <div className="flex min-h-72 items-center justify-center rounded-xl bg-white/[0.03] text-sm font-bold text-[#8f98c0]">
              Select your inhouse session to report it.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ffd84d]/30 bg-[#ffd84d]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#ffd84d]">
                      <ShieldCheck size={13} />
                      Scoped Session
                    </div>
                    <h2 className="text-2xl font-black text-white">
                      {selectedSession.gameLabel ?? "Ranked Inhouse"}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-[#8f98c0]">
                      {formatDate(selectedSession.createdAt)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-black text-[#d7dcff]">
                    <UsersRound size={14} />
                    {selectedSession.players.length}/10 roster
                  </span>
                </div>
                <p className="mt-2 truncate text-xs font-mono text-[#4d5577]">
                  {selectedSession.id}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {[
                  { label: "Blue Side", color: "blue", players: blue },
                  { label: "Red Side", color: "red", players: red },
                ].map(({ label, color, players }) => (
                  <div key={label}>
                    <p
                      className={`mb-2 text-xs font-black uppercase tracking-[0.14em] ${
                        color === "blue" ? "text-[#4fc3f7]" : "text-[#ff6b6b]"
                      }`}
                    >
                      {label}
                    </p>
                    <div className="space-y-2">
                      {(players as SessionPlayer[]).map((player) => (
                        <div
                          key={player.kookUserId}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                            player.kookUserId === currentKookId
                              ? "border-[#20f2d6]/45 bg-[#20f2d6]/10 shadow-[0_0_28px_rgba(32,242,214,0.08)]"
                              : "border-transparent bg-[#101724]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-black text-white">
                                {player.displayName}
                              </p>
                              {player.kookUserId === currentKookId && (
                                <span className="shrink-0 rounded-full bg-[#20f2d6] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#07110b]">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs font-bold text-[#8f98c0]">
                              {playerRiotId(player)}
                            </p>
                          </div>
                          {player.riotName && (
                            <button
                              onClick={() => fetchGamesForPlayer(player)}
                              disabled={lookupLoading !== null}
                              className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg bg-[#255dff] px-3 text-xs font-black text-white hover:bg-[#4c79ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {lookupLoading === player.kookUserId ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Search size={13} />
                              )}
                              Fetch
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {games.length === 0 && lookupLoading === null && rawProfile === null && (
                <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#8f98c0]">
                  Click Fetch next to any roster player to load Ranked Inhouse games from Lzyumi.
                </p>
              )}

              {games.length === 0 && lookupLoading === null && rawProfile !== null && (
                <p className="rounded-xl border border-[#ff4058]/30 bg-[#ff4058]/10 px-4 py-3 text-sm font-bold text-[#ff6b6b]">
                  No Ranked Inhouse games found for that player. Try another player from this same
                  session.
                </p>
              )}

              {games.length > 0 && (
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white">
                      Ranked Inhouse Games{" "}
                      <span className="font-bold text-[#8f98c0]">
                        {lookupPlayer ? `from ${lookupPlayer.displayName}` : ""}
                      </span>
                    </h3>
                    <span className="text-xs font-bold text-[#ffd84d]">
                      Be absolutely sure before reporting.
                    </span>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {games.map((game) => {
                      const isSelected = selectedGameId === game.gameId;
                      const summary = gameSummaries[game.gameId];
                      return (
                        <button
                          key={game.gameId}
                          onClick={() => setSelectedGameId(game.gameId)}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? "border-[#20b86f] bg-[#20b86f]/10"
                              : "border-[#ffd84d]/35 bg-[#ffd84d]/5 hover:border-[#ffd84d]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[#ffd84d] px-1.5 py-0.5 text-[10px] font-black text-black">
                              IH
                            </span>
                            <span className="text-base font-black text-white">Ranked Inhouse</span>
                            {isSelected && (
                              <span className="ml-auto text-xs font-black text-[#20b86f]">
                                selected
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm font-bold text-[#d7dcff]">
                            {gameDateTime(game)} - {englishDuration(game.title, game.titleTime)}
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            {summary
                              ? `${summary.champion} - ${summary.role} - ${summary.result}${summary.kda ? ` - KDA ${summary.kda}` : ""}`
                              : lookupLoading
                                ? "Fetching champion and role..."
                                : "Champion and role unavailable for this player"}
                          </p>
                          <p className="mt-1 truncate text-[11px] font-mono text-[#4d5577]">
                            {game.gameId}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedGameId && rawProfile?.battleInfo?.openId && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#ffd84d]/30 bg-[#ffd84d]/10 px-4 py-3 text-sm font-black text-[#ffe477]">
                    Reporting applies LP/ELO changes to the selected IH session. Do not submit
                    unless the game, date, and roster are correct.
                  </div>
                  <button
                    onClick={submitReport}
                    disabled={submitting}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#20b86f] px-5 text-sm font-black text-[#07110b] hover:bg-[#3ee48e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Reporting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Report Ranked Inhouse Game
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
