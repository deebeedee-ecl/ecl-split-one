"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, CheckCircle2, Crown, Sparkles, Trophy, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  formatLzyumiRank as formatSharedLzyumiRank,
  getLzyumiRankRows as getSharedLzyumiRankRows,
  isSafeProfileImageUrl,
  lzyumiTierColor as getSharedLzyumiTierColor,
} from "@/lib/hub-profile";
import { getChinaServerDisplayName, getCountryOption } from "./account-options";
import {
  flushPendingProfile,
  getAccessToken,
  loadProfile,
  requestKookVerificationCode,
  type SignupProfilePayload,
} from "./client-account";

export type AccountProfile = SignupProfilePayload & {
  id: string;
  email: string;
  verificationStatus: string;
  accountStatus: string;
  lzyumiLastLookupAt?: string | null;
  lzyumiRawProfile?: unknown;
  lzyumiRecentStat?: unknown;
  lzyumiRankedGames?: unknown;
  bannerUrl?: string | null;
  kookVerifications?: Array<{
    code: string;
    status: string;
    expiresAt: string;
  }>;
};

type LzyumiRankRow = {
  wins?: number;
  total?: number;
  tier?: string;
  rate?: number;
  losses?: number;
  type?: string;
  winPoint?: number;
};

type LzyumiRecentGame = {
  championId?: string;
  isWin?: number; // 1 = win, 2 = loss
  title?: string;
  titleTime?: string;
  battleTypeInfo?: string;
  wasMvp?: string;
  wasSvp?: string;
  [key: string]: unknown;
};

type SeasonChampStat = {
  id: string;
  plays: number;
};

type SeasonStats = {
  kda: number | null;
  solo: { rate: number; total: number } | null;
  flex: { rate: number; total: number } | null;
  classic: { rate: number; total: number } | null;
};

/** Parse role from titleTime field e.g. "06-07 12:10:01【中】   胜" */
function parseRoleFromTitleTime(titleTime: string | undefined): string | null {
  if (!titleTime) return null;
  const match = titleTime.match(/【(.+?)】/);
  if (!match) return null;
  const zh = match[1];
  const map: Record<string, string> = {
    "中": "MID",
    "上": "TOP",
    "打野": "JGL",
    "下": "ADC",
    "辅": "SUP",
  };
  return map[zh] ?? null;
}

// lzyumiRankedGames shape: { soloGames: LzyumiRecentGame[], flexGames: LzyumiRecentGame[] }
function getRankedGames(rankedGamesRaw: unknown): { soloGames: LzyumiRecentGame[]; flexGames: LzyumiRecentGame[] } {
  if (!rankedGamesRaw || typeof rankedGamesRaw !== "object") return { soloGames: [], flexGames: [] };
  const rg = rankedGamesRaw as { soloGames?: unknown; flexGames?: unknown };
  return {
    soloGames: Array.isArray(rg.soloGames) ? (rg.soloGames as LzyumiRecentGame[]) : [],
    flexGames: Array.isArray(rg.flexGames) ? (rg.flexGames as LzyumiRecentGame[]) : [],
  };
}

/** Returns true if a game is ARAM (海斗 = Howling Abyss) */
function isAram(game: LzyumiRecentGame): boolean {
  const title = String(game.title ?? "");
  return title.startsWith("海斗");
}

function getCombinedRankedGames(rankedGamesRaw: unknown): LzyumiRecentGame[] {
  const { soloGames, flexGames } = getRankedGames(rankedGamesRaw);
  const all = [...soloGames, ...flexGames].filter((g) => !isAram(g));
  all.sort((a, b) => {
    const ta = String(a.titleTime ?? "");
    const tb = String(b.titleTime ?? "");
    return tb.localeCompare(ta);
  });
  return all.slice(0, 10);
}

function parseRecentGameRole(titleTime: string | undefined): string | null {
  if (!titleTime) return null;
  const match = titleTime.match(/【([^】]+)】/);
  if (!match) return null;

  const map: Record<string, string> = {
    "\u4e0a": "TOP",
    "\u6253\u91ce": "JGL",
    "\u4e2d": "MID",
    "\u4e0b": "ADC",
    "\u8f85": "SUP",
  };

  return map[match[1]] ?? null;
}

/** Get season champion stats from lzyumiRecentStat.data.recentState.common_use_champions */
function getSeasonChampStats(recentStatRaw: unknown): SeasonChampStat[] {
  if (!recentStatRaw || typeof recentStatRaw !== "object") return [];
  const rs = recentStatRaw as { data?: { recentState?: { common_use_champions?: Array<{ key: number; value: number }> } } };
  const champs = rs.data?.recentState?.common_use_champions;
  if (!Array.isArray(champs)) return [];
  return champs
    .filter((c) => c.key && c.value > 0)
    .map((c) => ({ id: String(c.key), plays: c.value }))
    .sort((a, b) => b.plays - a.plays);
}

/** Get KDA + per-queue win rates from lzyumiRawProfile + lzyumiRecentStat */
function getSeasonStats(rawProfile: unknown, recentStatRaw: unknown): SeasonStats {
  // KDA from recentStat
  const rs = recentStatRaw as { data?: { recentState?: { kda?: number } } } | null;
  const kda = rs?.data?.recentState?.kda ?? null;

  // Per-queue win rates from rawProfile.battleInfo.mapOneInfoList
  const bp = rawProfile as { battleInfo?: { mapOneInfoList?: LzyumiRankRow[] } } | null;
  const rows: LzyumiRankRow[] = bp?.battleInfo?.mapOneInfoList ?? [];

  const findRow = (keyword: string) => {
    const row = rows.find((r) => r.type?.includes(keyword));
    if (!row || row.rate === undefined || row.total === undefined) return null;
    return { rate: row.rate, total: row.total };
  };

  return {
    kda,
    // 单双排 = Solo/Duo ranked (current season = first match)
    solo: findRow("单双排"),
    // 灵活排位 = Flex ranked (current season = first match)
    flex: findRow("灵活排位"),
    // 经典对局 = Classic (normal/blind)
    classic: findRow("经典对局"),
  };
}

function getBattleInfo(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { battleInfo?: unknown };
  const battleInfo = value.battleInfo;
  return battleInfo && typeof battleInfo === "object"
    ? (battleInfo as { mapOneInfoList?: unknown })
    : null;
}

function getRankRows(raw: unknown) {
  const battleInfo = getBattleInfo(raw);
  const rows = Array.isArray(battleInfo?.mapOneInfoList)
    ? (battleInfo.mapOneInfoList as LzyumiRankRow[])
    : [];
  const rankedRows = rows.filter((row) => row.tier && row.tier !== "-");

  return {
    solo:
      rankedRows.find((row) => row.type?.includes("\u5355\u53cc\u6392")) ??
      rankedRows[0] ??
      null,
    flex:
      rankedRows.find((row) => row.type?.includes("\u7075\u6d3b\u6392\u4f4d")) ??
      rankedRows[1] ??
      null,
  };
}

// Map Chinese tier names to English + color
const TIER_ZH_TO_EN: Record<string, string> = {
  "铁": "Iron",
  "青铜": "Bronze",
  "白银": "Silver",
  "黄金": "Gold",
  "铂金": "Platinum",
  "翡翠": "Emerald",
  "钻石": "Diamond",
  "大师": "Master",
  "宗师": "Grandmaster",
  "王者": "Challenger",
};

// Tier colors
const TIER_COLORS: Record<string, string> = {
  Iron: "text-[#8a8a8a]",
  Bronze: "text-[#cd7f32]",
  Silver: "text-[#c0c0c0]",
  Gold: "text-[#ffd84d]",
  Platinum: "text-[#4fc3a1]",
  Emerald: "text-[#48f0df]",
  Diamond: "text-[#7ec8e3]",
  Master: "text-[#c9a0ff]",
  Grandmaster: "text-[#ff6b6b]",
  Challenger: "text-[#f4c842]",
};

function getTierEnglish(tier: string | undefined): string {
  if (!tier || tier === "-") return "Unranked";
  for (const [zh, en] of Object.entries(TIER_ZH_TO_EN)) {
    if (tier.startsWith(zh)) return en;
  }
  return "Unranked";
}

function translateTier(tier: string | undefined): string {
  if (!tier || tier === "-") return "Unranked";
  for (const [zh, en] of Object.entries(TIER_ZH_TO_EN)) {
    if (tier.startsWith(zh)) {
      const division = tier.slice(zh.length).trim();
      return division ? `${en} ${division}` : en;
    }
  }
  return tier;
}

function getTierColor(tier: string | undefined): string {
  const en = getTierEnglish(tier);
  return TIER_COLORS[en] ?? "text-[#aeb5da]";
}

function formatRank(row: LzyumiRankRow | null) {
  if (!row) return { label: "Unranked", lp: null };
  return { label: translateTier(row.tier), lp: row.winPoint ?? 0 };
}

const STATS_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;

function formatLastUpdated(profile: AccountProfile, now: number): string {
  if (!profile.lzyumiLastLookupAt) return "Never";
  const lastLookupAt = new Date(profile.lzyumiLastLookupAt).getTime();
  if (Number.isNaN(lastLookupAt)) return "Unknown";
  const diffMs = now - lastLookupAt;
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return "Just now";
  if (totalMinutes < 60) return `${totalMinutes}m ago`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shouldRefreshStats(profile: AccountProfile) {
  if (!profile.lzyumiRankedGames || !profile.lzyumiRecentStat) return true;
  if (!profile.lzyumiLastLookupAt) return true;

  const lastLookupAt = new Date(profile.lzyumiLastLookupAt).getTime();
  if (Number.isNaN(lastLookupAt)) return true;

  return Date.now() - lastLookupAt > STATS_REFRESH_INTERVAL_MS;
}

export default function PlayerProfileView({
  initialProfile,
  showPersonalMatchPreview = true,
}: {
  initialProfile?: AccountProfile;
  showPersonalMatchPreview?: boolean;
} = {}) {
  const [loadedProfile, setLoadedProfile] = useState<AccountProfile | null>(initialProfile ?? null);
  const [hasSession, setHasSession] = useState(Boolean(initialProfile));
  const [loading, setLoading] = useState(!initialProfile);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [statRefreshError, setStatRefreshError] = useState("");
  const [codeRequesting, setCodeRequesting] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [reportingMatch, setReportingMatch] = useState(false);
  const [reportMatchMessage, setReportMatchMessage] = useState("");
  const [reportMatchError, setReportMatchError] = useState("");
  const [shouldAutoReport, setShouldAutoReport] = useState(() =>
    typeof window !== "undefined" && window.location.search.includes("autoreport=1"),
  );

  useEffect(() => {
    if (initialProfile) return;

    async function boot() {
      setLoading(true);
      setLoadedProfile(null);

      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));

      if (data.session) {
        await flushPendingProfile().catch(() => null);
        const loaded = await loadProfile();
        setLoadedProfile(loaded);

        // Auto-refresh when stats are missing or the cached snapshot is stale.
        // Uses browser-based lzyumi fetch (user's residential IP, bypasses cloud IP block).
        if (loaded && shouldRefreshStats(loaded) && loaded.riotName && loaded.chinaServerId) {
          setRefreshingStats(true);
          setStatRefreshError("");
          try {
            const token = await getAccessToken();
            if (!token) throw new Error("no token");

            const nickname = loaded.riotTag
              ? `${loaded.riotName}#${loaded.riotTag}`
              : loaded.riotName;
            const areaId = loaded.chinaServerId;

            // Get signed URLs for all three filters in parallel
            const [signRes1, signRes2, signRes3] = await Promise.all([
              fetch(`/api/lzyumi-sign?nickname=${encodeURIComponent(nickname)}&areaId=${areaId}&filter=1&allCount=10`),
              fetch(`/api/lzyumi-sign?nickname=${encodeURIComponent(nickname)}&areaId=${areaId}&filter=2&allCount=20`),
              fetch(`/api/lzyumi-sign?nickname=${encodeURIComponent(nickname)}&areaId=${areaId}&filter=3&allCount=20`),
            ]);

            const [{ url: url1 }, { url: url2 }, { url: url3 }] = await Promise.all([
              signRes1.json(), signRes2.json(), signRes3.json(),
            ]);

            // Fetch directly from lzyumi using browser IP
            const [raw1, raw2, raw3] = await Promise.all([
              fetch(url1).then((r) => r.json()),
              fetch(url2).then((r) => r.json()),
              fetch(url3).then((r) => r.json()),
            ]);

            const soloGames = Array.isArray(raw2?.data) ? raw2.data : [];
            const flexGames = Array.isArray(raw3?.data) ? raw3.data : [];

            if (raw1?.battleInfo) {
              const saveRes = await fetch("/api/hub/refresh-my-profile", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ rawProfile: raw1, soloGames, flexGames }),
              });
              if (!saveRes.ok) {
                const { message } = await saveRes.json().catch(() => ({}));
                throw new Error(message ?? `Save failed (${saveRes.status})`);
              }
              setLoadedProfile(await loadProfile());
            } else {
              // lzyumi returned no profile — wrong server, unrecognised account, etc.
              const lzyumiMsg = typeof raw1?.message === "string" ? raw1.message : null;
              throw new Error(
                lzyumiMsg ?? "Account not found on lzyumi. Check your Riot name and server in your profile settings."
              );
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Stats refresh failed";
            setStatRefreshError(msg);
          } finally {
            setRefreshingStats(false);
          }
        }
      }

      setLoading(false);
    }

    boot();
  }, [initialProfile]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const profile = initialProfile ?? loadedProfile;

  // Auto-report when opened via bot link (?autoreport=1)
  useEffect(() => {
    if (shouldAutoReport && profile && hasSession && !initialProfile) {
      setShouldAutoReport(false);
      handleReportGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoReport, profile, hasSession, initialProfile]);

  if (loading) {
    return (
      <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-8 text-[#c6ccd8] shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
        Loading profile...
      </section>
    );
  }

  if (!hasSession) {
    return (
      <EmptyProfile
        title="Log in to view your profile"
        description="Your player profile appears here after you sign in with your ECL account."
        actionHref="/login"
        actionLabel="Log in"
      />
    );
  }

  if (!profile) {
    return (
      <EmptyProfile
        title="Complete your ECL profile"
        description="Your account exists, but the player profile has not been created yet. Finish setup in Settings, then return here."
        actionHref="/hub/settings"
        actionLabel="Open settings"
      />
    );
  }

  const initials = (profile.displayName || profile.riotName || "ECL")
    .slice(0, 2)
    .toUpperCase();
  const showRiotId = profile.privacySettings?.showRiotId ?? true;
  const ranks = getSharedLzyumiRankRows(profile.lzyumiRawProfile, profile.currentRank);
  const recentGames = getCombinedRankedGames(profile.lzyumiRankedGames);
  const seasonChamps = getSeasonChampStats(profile.lzyumiRecentStat);
  const seasonStats = getSeasonStats(profile.lzyumiRawProfile, profile.lzyumiRecentStat);
  const nationality = getCountryOption(profile.nationality);
  const chinaServerName = getChinaServerDisplayName(
    profile.chinaServerId,
    profile.chinaServerName,
  );
  const bannerPositionY = profile.privacySettings?.bannerPositionY ?? 50;
  const safeBannerUrl = isSafeProfileImageUrl(profile.bannerUrl) ? profile.bannerUrl : null;
  const safeAvatarUrl = isSafeProfileImageUrl(profile.avatarUrl) ? profile.avatarUrl : null;
  const isKookVerified = profile.verificationStatus === "VERIFIED";
  const verification = profile.kookVerifications?.[0] ?? null;
  const lastUpdatedLabel = formatLastUpdated(profile, now);

  const soloRank = formatSharedLzyumiRank(ranks.solo);
  const flexRank = formatSharedLzyumiRank(ranks.flex);

  async function handleReportGame() {
    if (!profile?.riotName || !profile?.chinaServerId) return;
    setReportingMatch(true);
    setReportMatchMessage("");
    setReportMatchError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");

      // lzyumi lookup: try name-only first (matches signedLookupUrl in lib/lzyumi.ts).
      // Fall back to name#tag (name*~*~*tag) for players who share a name.
      const nameOnly = profile.riotName;
      const nameWithTag = profile.riotTag
        ? `${profile.riotName}#${profile.riotTag}`
        : profile.riotName;
      const areaId = profile.chinaServerId;

      async function fetchAllFilters(nick: string) {
        const LZYUMI_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];
        const signedUrls = await Promise.all(
          LZYUMI_FILTERS.map((f) =>
            fetch(`/api/lzyumi-sign?nickname=${encodeURIComponent(nick)}&areaId=${areaId}&filter=${f}&allCount=5`)
              .then((r) => r.json())
              .then(({ url }: { url: string }) => url),
          ),
        );
        return Promise.all(
          signedUrls.map((url, i) =>
            fetch(url)
              .then((r) => r.json())
              .then((data) => { console.log(`[lzyumi nick=${nick} filter=${LZYUMI_FILTERS[i]}]`, { count: data?.data?.length ?? 0, titles: (data?.data ?? []).map((g: {title?: string}) => g.title), hasOpenId: !!data?.battleInfo?.openId, error: data?.errorCode }); return data; })
              .catch((e) => { console.error(`[lzyumi nick=${nick} filter=${LZYUMI_FILTERS[i]} FAILED]`, e); return null; }),
          ),
        );
      }

      // Step 1: probe lzyumi — name-only first, fall back to name+tag
      let filterResponses = await fetchAllFilters(nameOnly);
      const hasAnyData = filterResponses.some((r) => r?.battleInfo?.openId || (Array.isArray(r?.data) && r.data.length > 0));
      if (!hasAnyData && nameWithTag !== nameOnly) {
        console.log("[lzyumi] name-only returned nothing, retrying with name+tag...");
        filterResponses = await fetchAllFilters(nameWithTag);
      }

      // openId comes from battleInfo — any filter response will have it
      const profileData = filterResponses.find((r) => r?.battleInfo?.openId);
      const openId: string = profileData?.battleInfo?.openId ?? "";
      console.log("[lzyumi] openId:", openId || "(not found)");

      type LzyumiGame = { gameId?: string; title?: string };

      // First pass: find a game with "新模式" in its title — that's the inhouse game mode
      // (灵活/满载SUV is regular Flex ranked, not inhouse)
      let gameId = "";
      let rawProfile: unknown = profileData;
      outer: for (const resp of filterResponses) {
        const games: LzyumiGame[] = Array.isArray(resp?.data) ? resp.data : [];
        for (const g of games) {
          if (g.gameId && g.title?.includes("\u65b0\u6a21\u5f0f")) {
            gameId = g.gameId;
            rawProfile = resp;
            break outer;
          }
        }
      }
      // Fallback: take the most recent game from any filter
      if (!gameId) {
        for (const resp of filterResponses) {
          const games: LzyumiGame[] = Array.isArray(resp?.data) ? resp.data : [];
          const found = games.find((g) => g.gameId);
          if (found?.gameId) {
            gameId = found.gameId;
            rawProfile = resp;
            break;
          }
        }
      }

      console.log("[lzyumi] gameId:", gameId || "(not found)");
      if (!openId && !gameId) {
        throw new Error(
          "lzyumi returned no data at all. Open DevTools console and share the [lzyumi filter=*] logs.",
        );
      }
      if (!openId) {
        throw new Error(
          "lzyumi returned games but no openId (battleInfo missing). Open DevTools console and share the [lzyumi filter=*] logs.",
        );
      }
      if (!gameId) {
        throw new Error(
          "Could not find a recent inhouse game on lzyumi. Make sure you just finished an inhouse match.",
        );
      }

      // Step 2: fetch match detail from lzyumi (openId-based)
      const detailSignRes = await fetch(
        `/api/lzyumi-sign?type=detail&openId=${encodeURIComponent(openId)}&gameId=${encodeURIComponent(gameId)}&areaId=${areaId}`,
      );
      const { url: detailUrl } = await detailSignRes.json();
      const detail = await fetch(detailUrl).then((r) => r.json());

      // Step 3: submit to backend
      const reportRes = await fetch("/api/hub/report-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawMatchData: { profile: rawProfile, gameId, detail } }),
      });

      const result = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        throw new Error(
          result.reply ?? result.message ?? `Report failed (${reportRes.status})`,
        );
      }
      setReportMatchMessage(result.reply ?? "Match reported successfully!");
    } catch (err) {
      setReportMatchError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setReportingMatch(false);
    }
  }

  async function requestFreshKookCode() {
    setCodeRequesting(true);
    setVerificationMessage("");
    setVerificationError("");

    try {
      const nextVerification = await requestKookVerificationCode();
      setLoadedProfile((current) =>
        current
          ? {
              ...current,
              kookVerifications: [nextVerification],
            }
          : current,
      );
      setVerificationMessage("New KOOK verification code is ready.");
    } catch (err) {
      setVerificationError(
        err instanceof Error ? err.message : "Could not request a KOOK verification code.",
      );
    } finally {
      setCodeRequesting(false);
    }
  }

  return (
    <div className="space-y-5">
      {!isKookVerified && (
        <KookVerificationNotice
          code={verification?.code ?? null}
          expiresAt={verification?.expiresAt ?? null}
          requesting={codeRequesting}
          message={verificationMessage}
          error={verificationError}
          onRequestCode={requestFreshKookCode}
        />
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
          {safeBannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeBannerUrl}
              alt=""
              className="h-44 w-full object-cover"
              style={{ objectPosition: `50% ${bannerPositionY}%` }}
            />
          ) : (
            <div className="h-44 bg-[radial-gradient(circle_at_80%_15%,rgba(72,240,223,0.32),transparent_28%),linear-gradient(135deg,#252b64,#10131f_58%,#07090f)]" />
          )}
          <div className="-mt-14 flex flex-col gap-6 px-7 pb-7 md:flex-row md:items-end">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[1.7rem] bg-[#24262d] text-4xl font-black text-white ring-4 ring-[#191a1f]">
              {safeAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={safeAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-4xl font-black tracking-normal text-white md:text-5xl">
                  {profile.displayName}
                </h2>
                {isKookVerified && (
                  <span
                    title="KOOK verified"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#19d27f]/12 text-[#19d27f] ring-1 ring-[#19d27f]/35"
                  >
                    <CheckCircle2 size={21} strokeWidth={3} />
                  </span>
                )}
                {nationality?.code && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/w40/${nationality.code.toLowerCase()}.png`}
                    alt={nationality.name}
                    title={nationality.name}
                    width={28}
                    height={20}
                    className="rounded-sm object-cover shadow-md"
                  />
                )}
              </div>

              {showRiotId && (
                <p className="mt-3 text-base font-bold text-[#aeb5da]">
                  Riot ID: {profile.riotName}#{profile.riotTag}
                  {chinaServerName ? ` · ${chinaServerName}` : ""}
                </p>
              )}

              {/* Role icons + rank tags */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {/* Primary role — large icon with label */}
                {profile.primaryRole && (
                  <RoleBadge role={profile.primaryRole} label="Primary" />
                )}
                {profile.secondaryRole && (
                  <RoleBadge role={profile.secondaryRole} label="Secondary" />
                )}

                {/* Rank tags with tier-matched colors */}
                {ranks.solo && (
                  <RankTag
                    label="Solo/Duo"
                    tier={soloRank.label}
                    lp={soloRank.lp}
                    color={getSharedLzyumiTierColor(ranks.solo?.tier)}
                  />
                )}
                {ranks.flex && (
                  <RankTag
                    label="Flex"
                    tier={flexRank.label}
                    lp={flexRank.lp}
                    color={getSharedLzyumiTierColor(ranks.flex?.tier)}
                  />
                )}
                {!ranks.solo && !ranks.flex && (
                  <span className="rounded-full bg-white/[0.07] px-4 py-2 text-sm font-bold text-[#6b7280]">
                    Unranked
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#aeb5da]">
            Inhouse Record
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Metric label="ELO" value="800" accent="text-[#ffd84d]" />
            <Metric label="Rank" value="-" accent="text-[#ff1728]" />
            <Metric label="W/L" value="0-0" />
            <Metric label="MVPs" value="0" />
          </div>
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#aeb5da]">
              Last updated
            </p>
            {refreshingStats ? (
              <p className="mt-1 text-sm font-black text-[#ffd84d] animate-pulse">Fetching stats…</p>
            ) : statRefreshError ? (
              <p className="mt-1 text-sm font-black text-[#ff6b6b]" title={statRefreshError}>Update failed</p>
            ) : (
              <p className="mt-1 text-lg font-black text-[#48f0df]">{lastUpdatedLabel}</p>
            )}
            <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">
              {statRefreshError ? statRefreshError : "Updates on visit."}
            </p>
          </div>

          {!initialProfile && hasSession && (
            <div className="mt-3">
              <button
                onClick={handleReportGame}
                disabled={reportingMatch || !profile.riotName || !profile.chinaServerId}
                className="w-full rounded-xl bg-[#48f0df]/10 px-4 py-2 text-sm font-black text-[#48f0df] ring-1 ring-[#48f0df]/30 transition hover:bg-[#48f0df]/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {reportingMatch ? "Reporting…" : "Report Inhouse Game"}
              </button>
              {reportMatchMessage && (
                <p className="mt-1 text-[11px] font-semibold text-[#19d27f]">{reportMatchMessage}</p>
              )}
              {reportMatchError && (
                <p className="mt-1 text-[11px] font-semibold text-[#ff6b6b]" title={reportMatchError}>
                  {reportMatchError}
                </p>
              )}
            </div>
          )}
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
        <EmptyPanel
          icon={<Trophy size={27} />}
          eyebrow="Inhouse Only"
          title="Performance Radar"
          description="Mechanics, macro, vision, teamfight, and consistency ratings are built from recorded ECL inhouse games."
        />
        <InhouseStatsPanel />
        <AwardsPanel />
      </section>

      <ChampionsPanel
        seasonChamps={seasonChamps}
        seasonStats={seasonStats}
        recentGames={recentGames}
      />

      {showPersonalMatchPreview && <ProfileMatchHistoryPreview />}
    </div>
  );
}

// Roles without FILL for inhouse stats
const INHOUSE_ROLES: { key: string; label: string }[] = [
  { key: "TOP", label: "Top" },
  { key: "JGL", label: "Jungle" },
  { key: "MID", label: "Mid" },
  { key: "ADC", label: "ADC" },
  { key: "SUP", label: "Support" },
];

function InhouseStatsPanel() {
  const roleStats = INHOUSE_ROLES.map((r) => ({
    ...r,
    pct: 0,
    winRate: 0,
    games: 0,
  }));

  return (
    <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-black text-white">Inhouse Stats</h3>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-[#aeb5da]">
          ECL
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {roleStats.map(({ key, label, pct, winRate, games }) => (
          <div key={key} className="flex items-center gap-3">
            <RoleIcon role={key} size={18} />
            <span className="w-14 text-xs font-black text-[#d7dcff]">{label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-white/[0.06]" style={{ height: 6 }}>
              <div
                className="h-full rounded-full bg-[#ff1728]"
                style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }}
              />
            </div>
            <span className="w-8 text-right text-xs font-black text-[#ff1728]">
              {pct > 0 ? `${pct}%` : "-"}
            </span>
            <span className="w-12 text-right text-xs font-bold text-[#aeb5da]">
              {games > 0 ? `${winRate}% WR` : "-"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#aeb5da]">
          Top Inhouse Champions
        </p>
        <p className="text-xs font-semibold text-[#6b7280]">
          Champion data is built from recorded ECL inhouse games.
        </p>
      </div>
    </section>
  );
}

function ChampionIcon({ id, size = 56 }: { id: string | number; size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl bg-[#2f3568] shrink-0"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/lol/champions/${id}.png`}
        alt={`Champion ${id}`}
        className="h-full w-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

function SeasonStatsPill({
  label,
  rate,
  total,
  color,
}: {
  label: string;
  rate: number;
  total: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/[0.05] px-4 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6b7280]">{label}</span>
      <span className={`text-sm font-black ${color}`}>{rate.toFixed(1)}%</span>
      <span className="text-[10px] font-bold text-[#6b7280]">{total}G</span>
    </div>
  );
}

function ChampionsPanel({
  seasonChamps,
  seasonStats,
  recentGames,
}: {
  seasonChamps: SeasonChampStat[];
  seasonStats: SeasonStats;
  recentGames: LzyumiRecentGame[];
}) {
  const hasSeasonStats =
    seasonStats.kda !== null ||
    seasonStats.solo !== null ||
    seasonStats.flex !== null ||
    seasonStats.classic !== null;

  return (
    <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] shadow-[0_18px_54px_rgba(0,0,0,0.34)] overflow-hidden">
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.07]">
        {/* LEFT — Season stats: most played champions */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <Sparkles className="text-[#ff1728]" size={20} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6b7280]">
                Solo Q / Flex · Season Stats
              </p>
              <h2 className="text-lg font-black text-white">Most Played Champions</h2>
            </div>
          </div>

          {seasonChamps.length === 0 ? (
            <p className="text-sm font-semibold text-[#aeb5da]">
              No champion data available.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {seasonChamps.map((champ) => (
                <div key={champ.id} className="flex flex-col items-center gap-1">
                  <ChampionIcon id={champ.id} size={52} />
                  <p className="text-[10px] font-bold text-[#6b7280]">{champ.plays}G</p>
                </div>
              ))}
            </div>
          )}

          {/* Season stats row */}
          {hasSeasonStats && (
            <div className="mt-5 flex flex-wrap gap-2">
              {seasonStats.kda !== null && (
                <div className="flex items-center gap-2 rounded-2xl bg-white/[0.05] px-4 py-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6b7280]">KDA</span>
                  <span className="text-sm font-black text-[#ffd84d]">{seasonStats.kda.toFixed(2)}</span>
                </div>
              )}
              {seasonStats.solo && (
                <SeasonStatsPill
                  label="Solo/Duo"
                  rate={seasonStats.solo.rate}
                  total={seasonStats.solo.total}
                  color="text-[#4fc3a1]"
                />
              )}
              {seasonStats.flex && (
                <SeasonStatsPill
                  label="Flex"
                  rate={seasonStats.flex.rate}
                  total={seasonStats.flex.total}
                  color="text-[#7ec8e3]"
                />
              )}
              {seasonStats.classic && (
                <SeasonStatsPill
                  label="Classic"
                  rate={seasonStats.classic.rate}
                  total={seasonStats.classic.total}
                  color="text-[#aeb5da]"
                />
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Recent 10 ranked games */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <BarChart3 className="text-[#ff1728]" size={20} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6b7280]">
                Solo Q / Flex · Ranked Only
              </p>
              <h2 className="text-lg font-black text-white">Recent Games</h2>
            </div>
          </div>

          {recentGames.length === 0 ? (
            <p className="text-sm font-semibold text-[#aeb5da]">
              No recent ranked games found.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {recentGames.map((game, i) => {
                const champId = game.championId ?? "0";
                const isWin = game.isWin === 1;
                const isMvp = game.wasMvp === "mvp";
                const isSvp = game.wasSvp === "svp";
                const title = game.title ?? "";
                const mode = title.startsWith("单双") ? "Solo" : title.startsWith("灵活") ? "Flex" : "Ranked";
                const role = parseRecentGameRole(game.titleTime) ?? parseRoleFromTitleTime(game.titleTime);
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <ChampionIcon id={champId} size={52} />
                      <span
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#191a1f] ${isWin ? "bg-[#48f0df]" : "bg-[#ff1728]"}`}
                      />
                      {(isMvp || isSvp) && (
                        <span className="absolute -top-1 -left-1 rounded-full bg-[#ffd84d] px-1 text-[8px] font-black text-black">
                          {isMvp ? "MVP" : "SVP"}
                        </span>
                      )}
                    </div>
                    {/* Role icon or mode label */}
                    {role ? (
                      <RoleIcon role={role} size={14} />
                    ) : (
                      <p className="text-[9px] font-bold text-[#6b7280]">{mode}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type InhouseHistoryGame = {
  id: string;
  gameLabel: string;
  date: string;
  isWin: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lpChange: number;
  eloAfter: number;
  isMVP: boolean;
  isSVP: boolean;
};

function ProfileMatchHistoryPreview() {
  const [games, setGames] = useState<InhouseHistoryGame[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getAccessToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch("/api/hub/my-inhouse-history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setGames((data.games ?? []).slice(0, 3));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-[#ff1728]" size={24} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6b7280]">
              Personal Match History
            </p>
            <h2 className="text-xl font-black text-white">Inhouse Games</h2>
          </div>
        </div>
        <Link
          href="/hub/inhouses"
          className="rounded-xl bg-white/[0.05] px-4 py-2 text-xs font-black text-[#aeb5da] transition hover:bg-white/[0.09]"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="rounded-[1.2rem] border border-white/[0.08] bg-black/20 px-6 py-8 text-center">
          <p className="animate-pulse text-sm font-semibold text-[#ffd84d]">Loading…</p>
        </div>
      ) : !games || games.length === 0 ? (
        <div className="rounded-[1.2rem] border border-white/[0.08] bg-black/20 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-[#6b7280]">No inhouse matches recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[1.2rem] border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7280]">Game</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7280]">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7280]">Result</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7280]">KDA</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7280]">LP</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7280]">ELO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {games.map((g) => (
                <tr key={g.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-black text-[#d7dcff]">
                    {g.gameLabel}
                    {g.isMVP && <span className="ml-2 rounded-full bg-[#ffd84d] px-1.5 py-0.5 text-[9px] font-black text-black">MVP</span>}
                    {g.isSVP && <span className="ml-2 rounded-full bg-[#aeb5da] px-1.5 py-0.5 text-[9px] font-black text-black">SVP</span>}
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">{formatDate(g.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${g.isWin ? "bg-[#48f0df]/10 text-[#48f0df]" : "bg-[#ff1728]/10 text-[#ff1728]"}`}>
                      {g.isWin ? "WIN" : "LOSS"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#c6ccd8]">{g.kills}/{g.deaths}/{g.assists}</td>
                  <td className="px-4 py-3 text-right font-black">
                    <span className={g.lpChange >= 0 ? "text-[#19d27f]" : "text-[#ff6b6b]"}>
                      {g.lpChange >= 0 ? "+" : ""}{g.lpChange}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-[#ffd84d]">{g.eloAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyProfile({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-[1.7rem] border border-dashed border-white/[0.14] bg-[#191a1f] p-10 text-center shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <UserCircle className="mx-auto text-[#ff1728]" size={38} />
      <h2 className="mt-5 text-2xl font-black text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#aeb5da]">
        {description}
      </p>
      <Link
        href={actionHref}
        className="mt-7 inline-flex rounded-2xl bg-[#ff1728] px-5 py-3 text-sm font-black text-white transition hover:bg-[#d91524]"
      >
        {actionLabel}
      </Link>
    </section>
  );
}

function KookVerificationNotice({
  code,
  expiresAt,
  requesting,
  message,
  error,
  onRequestCode,
}: {
  code: string | null;
  expiresAt: string | null;
  requesting: boolean;
  message: string;
  error: string;
  onRequestCode: () => void;
}) {
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  const expiryLabel =
    expiresAt && Number.isFinite(expiresAtMs)
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(expiresAtMs))
      : null;
  const usableCode = code && !isExpired ? code : null;

  return (
    <section className="rounded-[1.4rem] border border-[#ffd84d]/35 bg-[#2a2110] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffd84d]">
            KOOK verification required
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Your profile is hidden until KOOK is linked.
          </h2>
          <div className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-[#f2dfad]">
            <p>1. Open KOOK and message the ECL verification bot.</p>
            <p>
              2. Send your code:
              <span className="ml-2 inline-flex rounded-lg border border-[#ffd84d]/35 bg-black/25 px-2 py-1 font-black tracking-[0.12em] text-white">
                {usableCode ?? "Request a fresh code"}
              </span>
            </p>
            <p>3. Return to the Hub after the bot confirms your account.</p>
          </div>
          {expiryLabel && (
            <p className="mt-3 text-xs font-bold text-[#cdbf95]">
              {isExpired ? "This code expired" : "Code expires"} {expiryLabel}.
            </p>
          )}
          {message && <p className="mt-3 text-sm font-bold text-[#ffd84d]">{message}</p>}
          {error && <p className="mt-3 text-sm font-bold text-red-200">{error}</p>}
        </div>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onRequestCode}
            disabled={requesting}
            className="w-full rounded-xl bg-[#ff1728] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#d91524] disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
          >
            {requesting ? "Preparing code..." : usableCode ? "Refresh code" : "Get KOOK code"}
          </button>
          <Link
            href="/hub/settings"
            className="mt-3 block rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#ffd84d]/45"
          >
            Profile settings
          </Link>
        </div>
      </div>
    </section>
  );
}

function AwardsPanel() {
  const awards = [
    { label: "MVP", value: "0", color: "text-[#ffd84d]", bg: "bg-[#ffd84d]/10" },
    { label: "SVP", value: "0", color: "text-[#c0c0c0]", bg: "bg-white/[0.06]" },
    { label: "Triple Kills", value: "0", color: "text-[#ff1728]", bg: "bg-[#ff1728]/10" },
    { label: "Quadra Kills", value: "0", color: "text-[#ff6b6b]", bg: "bg-[#ff6b6b]/10" },
  ];

  return (
    <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8b7cff]/14 text-[#c9c2ff]">
          <Crown size={27} />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6b7280]">
            Inhouse Only
          </p>
          <h3 className="text-xl font-black text-white">Awards</h3>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {awards.map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl ${bg} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#aeb5da]">
              {label}
            </p>
            <p className={`mt-1 text-3xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs font-semibold text-[#6b7280]">
        Populated from ECL inhouse match records.
      </p>
    </section>
  );
}

function EmptyPanel({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8b7cff]/14 text-[#c9c2ff]">
        {icon}
      </span>
      {eyebrow && (
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b7280]">
          {eyebrow}
        </p>
      )}
      <h3 className={`${eyebrow ? "mt-1" : "mt-5"} text-xl font-black text-white`}>{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#aeb5da]">
        {description}
      </p>
    </section>
  );
}

const ROLE_ICON_MAP: Record<string, string> = {
  TOP: "/lol/roles/top.png",
  JGL: "/lol/roles/jungle.png",
  MID: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  SUP: "/lol/roles/support.png",
  FILL: "/lol/roles/fill.png",
};

function RoleIcon({ role, size = 20 }: { role: string; size?: number }) {
  const src = ROLE_ICON_MAP[role?.toUpperCase()];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={role}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ filter: "brightness(0) invert(1)" }}
    />
  );
}

/** Large role badge for the hero card — icon + label pill */
function RoleBadge({ role, label }: { role: string; label: string }) {
  const src = ROLE_ICON_MAP[role.toUpperCase()];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08] ring-1 ring-white/[0.12]">
        {src && (
          <Image
            src={src}
            alt={role}
            width={28}
            height={28}
            className="object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        )}
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6b7280]">{label}</span>
    </div>
  );
}

/** Rank tag with tier-matched color */
function RankTag({
  label,
  tier,
  lp,
  color,
}: {
  label: string;
  tier: string;
  lp: number | null;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`rounded-2xl bg-white/[0.06] px-4 py-2 ring-1 ring-white/[0.08]`}>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6b7280]">{label}</p>
        <p className={`text-base font-black ${color}`}>{tier}</p>
        {lp !== null && (
          <p className="text-[10px] font-bold text-[#6b7280]">{lp} LP</p>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#aeb5da]">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-black ${accent}`}>{value}</p>
    </div>
  );
}
