"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAccessToken, loadProfile } from "@/components/account/client-account";

// ─── types ──────────────────────────────────────────────────────────────────

type TeamEntry = { teamId: string; players: string[] };

type GamePreview = {
  timeStr: string;
  teams: TeamEntry[];
  rawMatchData: {
    profile: unknown;
    gameId: string;
    detail: unknown;
  };
};

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchAllFilters(
  nick: string,
  areaId: string | number,
): Promise<unknown[]> {
  const FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];
  const signedUrls: string[] = await Promise.all(
    FILTERS.map((f) =>
      fetch(
        `/api/lzyumi-sign?nickname=${encodeURIComponent(nick)}&areaId=${areaId}&filter=${f}&allCount=5`,
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
  riotName: string,
  riotTag: string | null | undefined,
  chinaServerId: string | number,
): Promise<GamePreview> {
  const nameOnly = riotName;
  const nameWithTag = riotTag ? `${riotName}#${riotTag}` : riotName;
  const areaId = chinaServerId;

  let filterResponses = await fetchAllFilters(nameOnly, areaId);
  const hasAnyData = filterResponses.some(
    (r: unknown) =>
      (r as { battleInfo?: { openId?: string } })?.battleInfo?.openId ||
      (Array.isArray((r as { data?: unknown[] })?.data) &&
        ((r as { data?: unknown[] }).data?.length ?? 0) > 0),
  );
  if (!hasAnyData && nameWithTag !== nameOnly) {
    filterResponses = await fetchAllFilters(nameWithTag, areaId);
  }

  const profileData = filterResponses.find(
    (r: unknown) => (r as { battleInfo?: { openId?: string } })?.battleInfo?.openId,
  );
  const openId: string =
    (profileData as { battleInfo?: { openId?: string } } | undefined)?.battleInfo?.openId ?? "";

  if (!openId) {
    throw new Error(
      "lzyumi returned no profile data. Make sure your Riot name and server are set correctly.",
    );
  }

  // Find most recent 新模式 (inhouse) game; fall back to any game
  let gameId = "";
  let rawProfile: unknown = profileData;

  outer: for (const resp of filterResponses) {
    const games: LzyumiGame[] = Array.isArray((resp as { data?: unknown[] })?.data)
      ? ((resp as { data?: LzyumiGame[] }).data as LzyumiGame[])
      : [];
    for (const g of games) {
      if (g.gameId && g.title?.includes("\u65b0\u6a21\u5f0f")) {
        gameId = g.gameId;
        rawProfile = resp;
        break outer;
      }
    }
  }
  if (!gameId) {
    for (const resp of filterResponses) {
      const games: LzyumiGame[] = Array.isArray((resp as { data?: unknown[] })?.data)
        ? ((resp as { data?: LzyumiGame[] }).data as LzyumiGame[])
        : [];
      const found = games.find((g) => g.gameId);
      if (found?.gameId) {
        gameId = found.gameId;
        rawProfile = resp;
        break;
      }
    }
  }
  if (!gameId) {
    throw new Error("No recent inhouse game found on lzyumi. Make sure you just finished a match.");
  }

  // Fetch detail
  const detailSignRes = await fetch(
    `/api/lzyumi-sign?type=detail&openId=${encodeURIComponent(openId)}&gameId=${encodeURIComponent(gameId)}&areaId=${areaId}`,
  );
  const { url: detailUrl } = await detailSignRes.json();
  const detail = await fetch(detailUrl).then((r) => r.json());

  // Build preview
  const allGames: LzyumiGame[] = Array.isArray((rawProfile as { data?: unknown[] })?.data)
    ? ((rawProfile as { data?: LzyumiGame[] }).data as LzyumiGame[])
    : [];
  const matchEntry = allGames.find((g) => g.gameId === gameId);
  const timeStr = matchEntry?.titleTime ?? "unknown time";

  const players: Array<{ teamId?: number | string; nickNameStr?: string; nickName?: string }> =
    (detail as { data?: { wgBattleDetailInfo?: unknown[] } })?.data?.wgBattleDetailInfo ?? [];

  const teamMap = new Map<string, string[]>();
  for (const p of players) {
    const tid = String(p.teamId ?? "?");
    if (!teamMap.has(tid)) teamMap.set(tid, []);
    teamMap.get(tid)!.push(p.nickNameStr ?? p.nickName ?? "?");
  }

  const teams: TeamEntry[] = Array.from(teamMap.entries()).map(([teamId, ps]) => ({
    teamId,
    players: ps,
  }));

  return {
    timeStr,
    teams,
    rawMatchData: { profile: rawProfile, gameId, detail },
  };
}

// ─── component ──────────────────────────────────────────────────────────────

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

        const result = await detectGame(
          profile.riotName,
          profile.riotTag,
          profile.chinaServerId,
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
        body: JSON.stringify({ rawMatchData: preview.rawMatchData }),
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

  // ─── loading ───────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#191a21] px-6 py-8 text-[#8f98c0]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm font-bold">Detecting your latest inhouse game…</span>
      </div>
    );
  }

  // ─── error ─────────────────────────────────────────────────────────────────
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
          ← Go back
        </button>
      </div>
    );
  }

  // ─── done ──────────────────────────────────────────────────────────────────
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

  // ─── preview / submitting ──────────────────────────────────────────────────
  const [blueTeam, redTeam] = [preview!.teams[0], preview!.teams[1]];
  const isSubmitting = phase === "submitting";

  return (
    <div className="space-y-6">
      {/* Match card */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#191a21]">
        <div className="border-b border-white/[0.08] bg-[#14151b] px-6 py-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f98c0]">
            Detected game
          </p>
          <h2 className="mt-1 text-xl font-black text-white">
            {preview!.timeStr || "Recent game"}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-px bg-white/[0.05] sm:grid-cols-2">
          {/* Blue team */}
          <div className="bg-[#191a21] px-6 py-5">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#4fc3f7]">
              Blue Team
            </p>
            {blueTeam ? (
              <ul className="space-y-1.5">
                {blueTeam.players.map((name) => (
                  <li key={name} className="text-sm font-bold text-[#d7dcff]">
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
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#ef5350]">
              Red Team
            </p>
            {redTeam ? (
              <ul className="space-y-1.5">
                {redTeam.players.map((name) => (
                  <li key={name} className="text-sm font-bold text-[#d7dcff]">
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
      <div className="rounded-2xl border border-white/[0.08] bg-[#191a21] px-6 py-5">
        <p className="mb-4 text-base font-black text-white">Is this your game?</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-[#20b86f]/10 px-5 py-2.5 text-sm font-black text-[#20b86f] ring-1 ring-[#20b86f]/30 transition hover:bg-[#20b86f]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                Yes, submit this game
              </>
            )}
          </button>
          <button
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-black text-[#8f98c0] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle size={14} />
            No, go back
          </button>
        </div>
      </div>
    </div>
  );
}
