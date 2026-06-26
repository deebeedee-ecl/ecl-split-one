"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAccessToken, loadProfile } from "@/components/account/client-account";
import { riotIdKey, riotNameKey, splitRiotId } from "@/lib/riot-id";
import {
  englishDuration,
  findLzyumiPlayer,
  loadChampionNames,
  summarizeLzyumiPlayer,
  type LzyumiPlayerSummary,
} from "@/lib/lzyumi-display";

const LZYUMI_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const LZYUMI_GAMES_PER_FILTER = 10;
const MAX_DETAIL_CANDIDATES = 40;
const MIN_PREVIEW_MATCHED_PLAYERS = 6;

// Types

type TeamEntry = { teamId: string; players: string[] };

type GamePreview = {
  sessionId: string;
  gameLabel: string;
  timeStr: string;
  matchedPlayers: number;
  playerSummary: LzyumiPlayerSummary | null;
  teams: TeamEntry[];
  rawMatchData: {
    profile: unknown;
    gameId: string;
    detail: unknown;
  };
};

type ReportSession = {
  id: string;
  gameLabel: string | null;
  players: Array<{
    displayName: string;
    riotName: string | null;
    riotTag: string | null;
    chinaServerId?: number | null;
  }>;
};

type ReporterProfile = {
  riotName: string;
  riotTag?: string | null;
  chinaServerId: string | number;
  openId?: string | null;
};

type ReportSessionResponse = {
  sessions: ReportSession[];
  recentlyCompleted: { gameLabel: string | null } | null;
};

// Helpers

async function fetchAllFilters(
  nick: string,
  areaId: string | number,
  openId?: string | null,
): Promise<unknown[]> {
  const signedUrls: string[] = await Promise.all(
    LZYUMI_FILTERS.map((f) =>
      fetch(
        `/api/lzyumi-sign?nickname=${encodeURIComponent(nick)}&areaId=${areaId}&filter=${f}&allCount=${LZYUMI_GAMES_PER_FILTER}${
          openId ? `&openId=${encodeURIComponent(openId)}` : ""
        }`,
      )
        .then((r) => r.json())
        .then(({ url }: { url: string }) => url),
    ),
  );
  return Promise.all(
    signedUrls.map((url) =>
      fetch(url)
        .then((r) => r.json())
        .catch(() => null),
    ),
  );
}

type LzyumiGame = { gameId?: string; title?: string; titleTime?: string };

async function detectGame(
  reporterProfile: ReporterProfile,
  sessions: ReportSession[],
): Promise<GamePreview> {
  const candidates = new Map<
    string,
    {
      game: LzyumiGame;
      profileData: unknown;
      openId: string;
      areaId: string | number;
      lookupRiotName: string;
      lookupRiotTag: string | null | undefined;
    }
  >();
  let sawAnyRecentGame = false;
  const nameOnly = reporterProfile.riotName;
  const nameWithTag = reporterProfile.riotTag
    ? `${reporterProfile.riotName}#${reporterProfile.riotTag}`
    : reporterProfile.riotName;
  const areaId = reporterProfile.chinaServerId;
  const savedOpenId = reporterProfile.openId?.trim() || null;
  const lookupAttempts = [
    ...(savedOpenId ? [{ nick: nameOnly, openId: savedOpenId }] : []),
    { nick: nameOnly, openId: null },
    ...(nameWithTag !== nameOnly ? [{ nick: nameWithTag, openId: null }] : []),
  ];

  for (const attempt of lookupAttempts) {
    const filterResponses = await fetchAllFilters(attempt.nick, areaId, attempt.openId);
    const hasAnyData = filterResponses.some(
      (r: unknown) =>
        (r as { battleInfo?: { openId?: string } })?.battleInfo?.openId ||
        (Array.isArray((r as { data?: unknown[] })?.data) &&
          ((r as { data?: unknown[] }).data?.length ?? 0) > 0),
    );
    if (!hasAnyData) continue;

    const profileData = filterResponses.find(
      (r: unknown) => (r as { battleInfo?: { openId?: string } })?.battleInfo?.openId,
    );
    const openId: string =
      (profileData as { battleInfo?: { openId?: string } } | undefined)?.battleInfo?.openId ?? "";

    if (!openId) continue;

    for (const response of filterResponses) {
      const games = Array.isArray((response as { data?: unknown[] })?.data)
        ? ((response as { data?: LzyumiGame[] }).data as LzyumiGame[])
        : [];

      if (games.length > 0) sawAnyRecentGame = true;

      for (const game of games) {
        if (game.gameId && !candidates.has(game.gameId)) {
          candidates.set(game.gameId, {
            game,
            profileData,
            openId,
            areaId,
            lookupRiotName: reporterProfile.riotName,
            lookupRiotTag: reporterProfile.riotTag,
          });
        }
      }
    }
  }

  if (candidates.size === 0) {
    throw new Error(
      sawAnyRecentGame
        ? "I found recent games, but none matched enough players from your active inhouse roster. Ask an admin to review the session."
        : "Lzyumi returned no recent games for your ECL profile. Check your Riot ID/server on your profile, then open your profile once to refresh Lzyumi data.",
    );
  }

  type PlayerEntry = {
    teamId?: number | string;
    nickNameStr?: string;
    nickName?: string;
    detailChampionId?: string | number;
    position?: string;
    win?: string;
    scoreInfo?: string;
  };
  let best:
    | {
        session: ReportSession;
        game: LzyumiGame;
        detail: unknown;
        players: PlayerEntry[];
        matchedPlayers: number;
      }
    | null = null;

  for (const candidate of Array.from(candidates.values()).slice(0, MAX_DETAIL_CANDIDATES)) {
    const { game, openId, areaId } = candidate;
    const detailSignRes = await fetch(
      `/api/lzyumi-sign?type=detail&openId=${encodeURIComponent(openId)}&gameId=${encodeURIComponent(game.gameId!)}&areaId=${areaId}`,
    );
    if (!detailSignRes.ok) continue;

    const { url: detailUrl } = await detailSignRes.json();
    const detail = await fetch(detailUrl).then((response) => response.json()).catch(() => null);
    const players =
      ((detail as { data?: { wgBattleDetailInfo?: unknown[] } } | null)?.data
        ?.wgBattleDetailInfo ?? []) as PlayerEntry[];
    const detailKeys = new Set<string>();
    const detailNameKeys = new Map<string, number>();
    for (const player of players) {
      const parts = splitRiotId(player.nickNameStr ?? player.nickName);
      const fullKey = riotIdKey(parts.riotName, parts.riotTag);
      const nameKey = riotNameKey(parts.riotName);
      if (fullKey) detailKeys.add(fullKey);
      if (nameKey) detailNameKeys.set(nameKey, (detailNameKeys.get(nameKey) ?? 0) + 1);
    }

    for (const session of sessions) {
      const matchedPlayers = session.players.filter((player) => {
        const key = riotIdKey(player.riotName, player.riotTag);
        const nameKey = riotNameKey(player.riotName);
        return Boolean(
          (key && detailKeys.has(key)) ||
            (nameKey && detailNameKeys.get(nameKey) === 1),
        );
      }).length;

      if (!best || matchedPlayers > best.matchedPlayers) {
        best = { session, game, detail, players, matchedPlayers };
      }
    }

    if (best?.matchedPlayers === 10) break;
  }

  if (!best || best.matchedPlayers < MIN_PREVIEW_MATCHED_PLAYERS) {
    throw new Error(
      "I found ranked inhouse games, but none matched enough players from your active roster. Ask an admin to review the session.",
    );
  }

  const teamMap = new Map<string, string[]>();
  for (const p of best.players) {
    const tid = String(p.teamId ?? "?");
    if (!teamMap.has(tid)) teamMap.set(tid, []);
    teamMap.get(tid)!.push(p.nickNameStr ?? p.nickName ?? "?");
  }

  const teams: TeamEntry[] = Array.from(teamMap.entries()).map(([teamId, ps]) => ({
    teamId,
    players: ps,
  }));
  const reportingPlayer = findLzyumiPlayer(
    best.players,
    reporterProfile.riotName,
    reporterProfile.riotTag,
  );
  const championNames = reportingPlayer ? await loadChampionNames() : undefined;

  return {
    sessionId: best.session.id,
    gameLabel: best.session.gameLabel ?? "Ranked Inhouse",
    timeStr: englishDuration(best.game.title, best.game.titleTime),
    matchedPlayers: best.matchedPlayers,
    playerSummary: reportingPlayer
      ? summarizeLzyumiPlayer(reportingPlayer, championNames)
      : null,
    teams,
    rawMatchData: {
      profile: candidates.get(best.game.gameId!)?.profileData,
      gameId: best.game.gameId!,
      detail: best.detail,
    },
  };
}

// Component

export default function ReportInhouseClient() {
  const router = useRouter();

  const [phase, setPhase] = useState<"loading" | "preview" | "submitting" | "done" | "error">(
    "loading",
  );
  const [preview, setPreview] = useState<GamePreview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
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
        if (!profile.riotName || !profile.chinaServerId) {
          setErrorMsg("Your profile is missing Riot name or server. Update it in Settings.");
          setPhase("error");
          return;
        }

        const token = data.session.access_token;
        const sessionResponse = await fetch("/api/hub/report-session", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sessionData = (await sessionResponse.json().catch(() => ({}))) as
          | ReportSessionResponse
          | { message?: string };

        if (!sessionResponse.ok) {
          throw new Error(
            "message" in sessionData && sessionData.message
              ? sessionData.message
              : "Could not load your inhouse session.",
          );
        }

        const { sessions, recentlyCompleted } = sessionData as ReportSessionResponse;
        if (sessions.length === 0) {
          if (recentlyCompleted) {
            setSuccessMsg(
              `${recentlyCompleted.gameLabel ?? "Your latest inhouse"} has already been reported.`,
            );
            setPhase("done");
            return;
          }

          throw new Error("You do not have an active inhouse session to report.");
        }

        const result = await detectGame(
          {
            riotName: profile.riotName,
            riotTag: profile.riotTag,
            chinaServerId: profile.chinaServerId,
            openId: profile.openId,
          },
          sessions,
        );
        if (!cancelled) {
          setPreview(result);
          setPhase("preview");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to detect game");
          setPhase("error");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleConfirm() {
    if (!preview) return;
    setPhase("submitting");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/hub/report-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: preview.sessionId,
          rawMatchData: preview.rawMatchData,
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.reply ?? result.message ?? `Report failed (${res.status})`);
      }
      setSuccessMsg(result.reply ?? "Match reported successfully!");
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Report failed");
      setPhase("error");
    }
  }

  // Loading
  if (phase === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#191a21] px-6 py-8 text-[#8f98c0]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm font-bold">Detecting your latest inhouse game...</span>
      </div>
    );
  }

  // Error
  if (phase === "error") {
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

  // Done
  if (phase === "done") {
    return (
      <div className="space-y-4 rounded-2xl border border-[#20b86f]/30 bg-[#191a21] px-6 py-8">
        <div className="flex items-start gap-3 text-[#20b86f]">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm font-bold">{successMsg}</p>
        </div>
        <button
          onClick={() => router.push("/hub/me")}
          className="rounded-xl bg-[#20b86f]/10 px-4 py-2 text-xs font-black text-[#20b86f] ring-1 ring-[#20b86f]/30 hover:bg-[#20b86f]/20"
        >
          Back to profile
        </button>
      </div>
    );
  }

  // Preview / submitting
  const [blueTeam, redTeam] = [preview!.teams[0], preview!.teams[1]];
  const isSubmitting = phase === "submitting";
  const confidenceTone =
    preview!.matchedPlayers >= 10
      ? "border-[#20b86f]/30 bg-[#20b86f]/10 text-[#20b86f]"
      : preview!.matchedPlayers >= 8
        ? "border-[#ffd84d]/30 bg-[#ffd84d]/10 text-[#ffd84d]"
        : "border-[#ff6b6b]/30 bg-[#ff6b6b]/10 text-[#ff6b6b]";
  const resultTone =
    preview!.playerSummary?.result === "Win"
      ? "text-[#20b86f]"
      : preview!.playerSummary?.result === "Loss"
        ? "text-[#ff6b6b]"
        : "text-[#8f98c0]";

  return (
    <div className="space-y-6">
      {/* Match card */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#191a21] shadow-2xl shadow-black/20">
        <div className="border-b border-white/[0.08] bg-[#14151b] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ffd84d]/30 bg-[#ffd84d]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#ffd84d]">
                <ShieldCheck size={13} />
                Ranked Inhouse Detected
              </div>
              <h2 className="text-2xl font-black text-white">
                {preview!.gameLabel}
              </h2>
              <p className="mt-1 text-sm font-bold text-[#8f98c0]">
                Duration: {preview!.timeStr || "Unavailable"}
              </p>
            </div>

            <div className={`rounded-2xl border px-4 py-3 text-right ${confidenceTone}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-80">
                Roster Match
              </p>
              <p className="mt-1 text-2xl font-black">{preview!.matchedPlayers}/10</p>
            </div>
          </div>

          {preview!.playerSummary ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
              {[
                ["Champion", preview!.playerSummary.champion],
                ["Role", preview!.playerSummary.role],
                ["Result", preview!.playerSummary.result],
                ["KDA", preview!.playerSummary.kda ?? "-"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/[0.04] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8f98c0]">
                    {label}
                  </p>
                  <p
                    className={`mt-1 truncate text-sm font-black ${
                      label === "Result" ? resultTone : "text-white"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#8f98c0]">
              Your champion and role could not be identified, but the ranked inhouse game was
              detected from the session roster.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-px bg-white/[0.05] sm:grid-cols-2">
          {/* Blue team */}
          <div className="bg-[#191a21] px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4fc3f7]">
                Blue Team
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#4fc3f7]/10 px-2 py-1 text-[10px] font-black text-[#4fc3f7]">
                <UsersRound size={12} />
                {blueTeam?.players.length ?? 0}/5
              </span>
            </div>
            {blueTeam ? (
              <ul className="space-y-2">
                {blueTeam.players.map((name, index) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 rounded-xl bg-[#4fc3f7]/[0.06] px-3 py-2 text-sm font-bold text-[#d7dcff]"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#4fc3f7]/15 text-[10px] font-black text-[#4fc3f7]">
                      {index + 1}
                    </span>
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#8f98c0]">No data</p>
            )}
          </div>

          {/* Red team */}
          <div className="bg-[#191a21] px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef5350]">
                Red Team
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ef5350]/10 px-2 py-1 text-[10px] font-black text-[#ef5350]">
                <UsersRound size={12} />
                {redTeam?.players.length ?? 0}/5
              </span>
            </div>
            {redTeam ? (
              <ul className="space-y-2">
                {redTeam.players.map((name, index) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 rounded-xl bg-[#ef5350]/[0.06] px-3 py-2 text-sm font-bold text-[#d7dcff]"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ef5350]/15 text-[10px] font-black text-[#ef5350]">
                      {index + 1}
                    </span>
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#8f98c0]">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="rounded-2xl border border-[#ffd84d]/20 bg-[#191a21] px-6 py-5">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#ffd84d]" />
          <div>
            <p className="text-base font-black text-white">Confirm the ranked inhouse report</p>
            <p className="mt-1 text-sm font-bold text-[#ffd84d]">
              Be absolutely sure this is the correct game. Reporting applies LP/ELO changes.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[#20b86f] px-5 py-2.5 text-sm font-black text-[#07110b] transition hover:bg-[#3ee48e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                Submit Ranked Inhouse
              </>
            )}
          </button>
          <button
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-black text-[#8f98c0] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle size={14} />
            Not This Game
          </button>
        </div>
      </div>
    </div>
  );
}
