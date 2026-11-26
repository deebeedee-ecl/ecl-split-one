"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Clock3, Loader2, Search, Server, ShieldCheck, Trophy, Users } from "lucide-react";
import {
  CHINA_STATS_LADDER_TIERS,
  type ChinaStatsLadderSnapshot,
  type ChinaStatsLadderTier,
} from "@/lib/china-stats-ladder";
import { CHINA_STATS_SERVERS, type ChinaStatsServerKey } from "@/lib/china-stats-servers";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: ChinaStatsLadderSnapshot }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

const TIER_STYLE: Record<ChinaStatsLadderTier, string> = {
  CHALLENGER: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  GRANDMASTER: "border-rose-300/25 bg-rose-300/[0.08] text-rose-100",
  MASTER: "border-violet-300/25 bg-violet-300/[0.08] text-violet-100",
};

function winRate(wins: number, losses: number) {
  const games = wins + losses;
  return games ? wins / games * 100 : 0;
}

function hasRecord(row: ChinaStatsLadderSnapshot["rows"][number]): row is typeof row & { wins: number; losses: number } {
  return row.wins !== null && row.losses !== null;
}

function ChampionPool({ championIds, compact = false }: { championIds?: number[]; compact?: boolean }) {
  if (!championIds?.length) return <span className="text-[#65738a]">—</span>;
  return <span className="flex items-center gap-1.5">{championIds.slice(0, compact ? 3 : 5).map((championId) => (
    <Image key={championId} src={`/lol/champions/${championId}.png`} alt={`Champion ${championId}`} width={compact ? 28 : 32} height={compact ? 28 : 32} className={`${compact ? "h-7 w-7" : "h-8 w-8"} rounded-lg object-cover`} />
  ))}</span>;
}

function tierLabel(tier: ChinaStatsLadderTier) {
  return tier[0] + tier.slice(1).toLowerCase();
}

async function authHeaders() {
  const headers = new Headers();
  if (process.env.NODE_ENV !== "development") {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return headers;
}

export function ChinaStatsLeaderboardClient() {
  const [server, setServer] = useState<ChinaStatsServerKey>("ionia");
  const [tier, setTier] = useState<"ALL" | ChinaStatsLadderTier>("ALL");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(50);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void authHeaders()
      .then((headers) => fetch(`/api/china-stats/leaderboard?server=${server}`, {
        headers,
        cache: "no-store",
        signal: controller.signal,
      }))
      .then(async (response) => {
        const body = await response.json().catch(() => null) as {
          available?: unknown;
          message?: unknown;
          snapshot?: ChinaStatsLadderSnapshot;
        } | null;
        if (response.ok && body?.available === true && body.snapshot) {
          setState({ status: "ready", snapshot: body.snapshot });
        } else if (response.status === 404 || response.status === 503) {
          setState({ status: "unavailable", message: typeof body?.message === "string" ? body.message : "This ladder is not available yet." });
        } else {
          setState({ status: "error", message: typeof body?.message === "string" ? body.message : "The ladder could not be loaded." });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: "The ladder could not be loaded." });
      });
    return () => controller.abort();
  }, [server, revision]);

  const rows = useMemo(() => {
    if (state.status !== "ready") return [];
    const needle = query.trim().toLocaleLowerCase("en-US");
    return state.snapshot.rows.filter((row) =>
      (tier === "ALL" || row.tier === tier)
      && (!needle || row.riotId.toLocaleLowerCase("en-US").includes(needle)),
    );
  }, [query, state, tier]);

  const snapshot = state.status === "ready" ? state.snapshot : null;
  const leaders = snapshot?.rows.slice(0, 3) ?? [];
  const totalAvailable = snapshot?.coverage.reduce((sum, item) => sum + item.totalAvailable, 0) ?? 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_20%_0%,rgba(54,215,255,0.16),transparent_34%),linear-gradient(135deg,#101927,#090e17_70%)] p-6 sm:p-8">
        <div className="absolute right-[-6rem] top-[-8rem] h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[#78e7ff]">
              <ShieldCheck size={17} /> Verified ranked ladder snapshot
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
              China Solo Queue <span className="text-[#36d7ff]">Leaderboard</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#98a8bf]">
              Official China Solo/Duo rankings for Ionia and Super Server, linked to player profiles and recent match history.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric icon={<Users size={18} />} label="Players shown" value={snapshot ? snapshot.rows.length.toLocaleString() : "—"} />
            <Metric icon={<Trophy size={18} />} label="Apex players" value={snapshot ? totalAvailable.toLocaleString() : "—"} />
            <Metric icon={<Clock3 size={18} />} label="Snapshot" value={snapshot ? new Date(snapshot.capturedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} wide />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-3xl border border-white/[0.08] bg-[#0d131d] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex gap-2 rounded-2xl border border-white/[0.08] bg-black/20 p-1.5">
              {(Object.keys(CHINA_STATS_SERVERS) as ChinaStatsServerKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === server) return;
                    setServer(key);
                    setVisible(50);
                    setState({ status: "loading" });
                  }}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition lg:flex-none ${server === key ? "bg-[#0755C9] text-white shadow-[0_0_24px_rgba(7,151,242,0.2)]" : "text-[#8290a4] hover:bg-white/[0.05] hover:text-white"}`}
                >
                  <Server size={16} /> {CHINA_STATS_SERVERS[key].name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["ALL", ...CHINA_STATS_LADDER_TIERS] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTier(value);
                    setVisible(50);
                  }}
                  className={`min-h-10 rounded-xl border px-3 text-xs font-black transition ${tier === value ? "border-[#36d7ff]/45 bg-[#36d7ff]/10 text-[#9cecff]" : "border-white/[0.08] text-[#8290a4] hover:border-white/20 hover:text-white"}`}
                >
                  {value === "ALL" ? "All apex" : tierLabel(value)}
                </button>
              ))}
            </div>
            <label className="relative ml-auto block w-full lg:max-w-xs">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#627086]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisible(50);
                }}
                placeholder="Search Riot ID"
                className="min-h-11 w-full rounded-xl border border-white/[0.1] bg-black/20 pl-11 pr-4 text-base font-bold text-white outline-none transition placeholder:text-[#536077] focus:border-[#36d7ff]/50"
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-[#0d131d] p-5">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#708097]">Coverage</p>
          <p className="mt-2 text-base font-bold text-white">
            {snapshot
              ? snapshot.coverage.map((item) => `${item.shown} ${tierLabel(item.tier)}`).join(" · ")
              : "Waiting for snapshot"}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#7f8da3]">
            Showing the highest-ranked players available for each tier in this snapshot. Search by Riot ID or switch tiers to narrow the list.
          </p>
        </div>
      </section>

      {snapshot && leaders.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-3">
          {leaders.map((row, index) => (
            <Link
              key={row.riotId}
              href={`/labs/china-stats/live?server=${server}&riotId=${encodeURIComponent(row.riotId)}`}
              className={`group rounded-3xl border p-5 transition hover:-translate-y-1 hover:border-[#36d7ff]/40 ${index === 0 ? "border-amber-300/25 bg-gradient-to-br from-amber-300/[0.1] to-[#0d131d]" : "border-white/[0.08] bg-[#0d131d]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-white">#{row.rank}</span>
                <Trophy size={22} className={index === 0 ? "text-amber-200" : "text-[#65738a]"} />
              </div>
              <p className="mt-6 truncate text-xl font-black text-white group-hover:text-[#8eeaff]">{row.riotId}</p>
              <div className="mt-3 flex items-center justify-between text-sm font-bold">
                <span className="text-[#98a6bb]">{row.leaguePoints.toLocaleString()} LP</span>
                {hasRecord(row)
                  ? <span className="text-emerald-300">{winRate(row.wins, row.losses).toFixed(1)}% WR</span>
                  : <ChampionPool championIds={row.championIds} compact />}
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d131d]">
        {state.status === "loading" ? (
          <Status icon={<Loader2 size={28} className="animate-spin text-[#36d7ff]" />} title="Loading China ladder" body="Reading the latest verified client snapshot." />
        ) : state.status === "unavailable" || state.status === "error" ? (
          <Status
            icon={<AlertTriangle size={28} className="text-amber-200" />}
            title={state.status === "unavailable" ? "Snapshot not collected yet" : "Ladder unavailable"}
            body={state.message}
            action={<button type="button" onClick={() => {
              setState({ status: "loading" });
              setRevision((value) => value + 1);
            }} className="mt-5 rounded-xl bg-[#0755C9] px-5 py-3 text-sm font-black text-white hover:bg-[#0797F2]">Try again</button>}
          />
        ) : rows.length === 0 ? (
          <Status icon={<Search size={28} className="text-[#77869c]" />} title="No matching player" body="Try another Riot ID or apex tier." />
        ) : (
          <>
            <div className="hidden grid-cols-[5rem_minmax(15rem,1fr)_10rem_8rem_11rem_10rem] gap-4 border-b border-white/[0.08] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-[#65738a] md:grid">
              <span>Rank</span><span>Player</span><span>Tier</span><span className="text-right">LP</span><span>Most played</span><span className="text-right">Record</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {rows.slice(0, visible).map((row) => (
                <Link
                  key={`${row.tier}-${row.riotId}`}
                  href={`/labs/china-stats/live?server=${server}&riotId=${encodeURIComponent(row.riotId)}`}
                  className="grid gap-3 px-5 py-5 transition hover:bg-[#36d7ff]/[0.035] md:grid-cols-[5rem_minmax(15rem,1fr)_10rem_8rem_11rem_10rem] md:items-center md:gap-4 md:px-6 md:py-4"
                >
                  <span className="text-2xl font-black text-white md:text-lg">#{row.rank}</span>
                  <div className="min-w-0"><p className="truncate text-base font-black text-white">{row.riotId}</p><p className="mt-1 text-sm font-semibold text-[#66758b]">View profile and match history</p></div>
                  <span className={`w-fit rounded-full border px-3 py-1.5 text-sm font-black ${TIER_STYLE[row.tier]}`}>{tierLabel(row.tier)}</span>
                  <span className="text-base font-black text-white md:text-right">{row.leaguePoints.toLocaleString()}</span>
                  <ChampionPool championIds={row.championIds} />
                  {hasRecord(row)
                    ? <span className="text-sm font-bold text-[#9aa8bc] md:text-right"><span className="text-white">{row.wins}W {row.losses}L</span><span className="mt-1 block font-black text-emerald-300">{winRate(row.wins, row.losses).toFixed(1)}%</span></span>
                    : <span className="text-sm font-bold text-[#77869c] md:text-right">Not provided</span>}
                </Link>
              ))}
            </div>
            {visible < rows.length ? (
              <div className="border-t border-white/[0.08] p-4 text-center">
                <button type="button" onClick={() => setVisible((value) => value + 50)} className="rounded-xl border border-[#36d7ff]/30 px-5 py-3 text-sm font-black text-[#8eeaff] transition hover:bg-[#36d7ff]/10">Show 50 more</button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function Metric({ icon, label, value, wide = false }: { icon: ReactNode; label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-2xl border border-white/[0.08] bg-black/20 p-4 ${wide ? "col-span-2 sm:col-span-1" : ""}`}><div className="flex items-center gap-2 text-[#6fdff8]">{icon}<span className="text-sm font-black uppercase tracking-[0.1em] text-[#77869c]">{label}</span></div><p className="mt-3 text-2xl font-black text-white">{value}</p></div>;
}

function Status({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="px-6 py-20 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035]">{icon}</div><h2 className="mt-5 text-2xl font-black text-white">{title}</h2><p className="mx-auto mt-3 max-w-lg text-base font-semibold leading-7 text-[#7f8da3]">{body}</p>{action}</div>;
}
