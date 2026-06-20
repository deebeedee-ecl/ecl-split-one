"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, CheckCircle2, Crown, Sparkles, Trophy, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getChinaServerDisplayName, getCountryOption } from "./account-options";
import { flushPendingProfile, getAccessToken, loadProfile, type SignupProfilePayload } from "./client-account";

type AccountProfile = SignupProfilePayload & {
  id: string;
  email: string;
  verificationStatus: string;
  accountStatus: string;
  lzyumiLastLookupAt?: string | null;
  lzyumiRawProfile?: unknown;
  lzyumiRecentStat?: unknown;
  lzyumiRankedGames?: unknown;
  bannerUrl?: string | null;
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

const STATS_REFRESH_INTERVAL_MS = 1000 * 60 * 15;

function shouldRefreshStats(profile: AccountProfile) {
  if (!profile.lzyumiRankedGames || !profile.lzyumiRecentStat) return true;
  if (!profile.lzyumiLastLookupAt) return true;

  const lastLookupAt = new Date(profile.lzyumiLastLookupAt).getTime();
  if (Number.isNaN(lastLookupAt)) return true;

  return Date.now() - lastLookupAt > STATS_REFRESH_INTERVAL_MS;
}

export default function PlayerProfileView() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));

      if (data.session) {
        await flushPendingProfile().catch(() => null);
        const loaded = await loadProfile();
        setProfile(loaded);

        // Auto-refresh when stats are missing or the cached ecl.gg snapshot is stale.
        if (loaded && shouldRefreshStats(loaded)) {
          try {
            const token = await getAccessToken();
            if (token) {
              const res = await fetch("/api/account/refresh-stats", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                setProfile(await loadProfile());
              }
            }
          } catch {
            // Non-critical — silently ignore
          }
        }
      }

      setLoading(false);
    }

    boot();
  }, []);

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
  const ranks = getRankRows(profile.lzyumiRawProfile);
  const recentGames = getCombinedRankedGames(profile.lzyumiRankedGames);
  const seasonChamps = getSeasonChampStats(profile.lzyumiRecentStat);
  const seasonStats = getSeasonStats(profile.lzyumiRawProfile, profile.lzyumiRecentStat);
  const nationality = getCountryOption(profile.nationality);
  const chinaServerName = getChinaServerDisplayName(
    profile.chinaServerId,
    profile.chinaServerName,
  );
  const bannerPositionY = profile.privacySettings?.bannerPositionY ?? 50;
  const isKookVerified = profile.verificationStatus === "VERIFIED";

  const soloRank = formatRank(ranks.solo);
  const flexRank = formatRank(ranks.flex);

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
          {profile.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.bannerUrl}
              alt=""
              className="h-44 w-full object-cover"
              style={{ objectPosition: `50% ${bannerPositionY}%` }}
            />
          ) : (
            <div className="h-44 bg-[radial-gradient(circle_at_80%_15%,rgba(72,240,223,0.32),transparent_28%),linear-gradient(135deg,#252b64,#10131f_58%,#07090f)]" />
          )}
          <div className="-mt-14 flex flex-col gap-6 px-7 pb-7 md:flex-row md:items-end">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[1.7rem] bg-[#24262d] text-4xl font-black text-white ring-4 ring-[#191a1f]">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
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
                    color={getTierColor(ranks.solo?.tier)}
                  />
                )}
                {ranks.flex && (
                  <RankTag
                    label="Flex"
                    tier={flexRank.label}
                    lp={flexRank.lp}
                    color={getTierColor(ranks.flex?.tier)}
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

      <ProfileMatchHistoryPreview />
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
                const role = parseRoleFromTitleTime(game.titleTime);
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

function ProfileMatchHistoryPreview() {
  const items = [
    { id: 3802, name: "Lost Chapter" },
    { id: 3020, name: "Sorcerer's Shoes" },
    { id: 3916, name: "Oblivion Orb" },
    { id: 1052, name: "Amplifying Tome" },
    { id: 2055, name: "Control Ward" },
  ];

  return (
    <section className="rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-[#ff1728]" size={24} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6b7280]">
              Personal Match History
            </p>
            <h2 className="text-xl font-black text-white">Recent Games</h2>
          </div>
        </div>
        <span className="rounded-full border border-[#ffd84d]/30 bg-[#ffd84d]/10 px-3 py-1 text-xs font-black text-[#ffd84d]">
          SVP
        </span>
      </div>

      <div className="mt-5 grid gap-4 rounded-[1.2rem] border border-white/[0.08] bg-black/20 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
        <div className="flex flex-wrap items-center gap-4">
          <ChampionIcon id={103} size={72} />
          <div className="min-w-[13rem] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-black text-white">Ahri</h3>
              <span className="rounded-full bg-[#ff1728]/12 px-3 py-1 text-xs font-black uppercase text-[#ff6b6b]">
                Defeat
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-[#aeb5da]">
                Mid
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#aeb5da]">
              deebeedee#34323 / ECL Elo 1842
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {items.map((item) => (
                <span key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/lol/items/${item.id}.png`}
                    alt={item.name}
                    title={item.name}
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Metric label="KDA" value="2/1/1" accent="text-[#ff6b6b]" />
          <Metric label="Rating" value="10.0" accent="text-[#ffd84d]" />
          <Metric label="Damage" value="5.7k" />
        </div>
      </div>
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
