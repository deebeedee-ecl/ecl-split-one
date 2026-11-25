"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, Clock3, Loader2, Search, Server, ShieldCheck, Swords, Wifi } from "lucide-react";
import { fetchLzyumiBrowserResponse, LzyumiBrowserContractError } from "@/lib/lzyumi-browser-contract";
import { verifyFinderIdentity } from "@/lib/lzyumi-custom-game-finder";
import { loadChampionNames } from "@/lib/lzyumi-display";
import { splitRiotId } from "@/lib/riot-id";
import {
  normalizeChinaStatsLiveDetail,
  normalizeChinaStatsLiveHistory,
  normalizeChinaStatsLiveProfile,
  summarizeChinaStatsLiveMatches,
  type ChinaStatsLiveDetail,
  type ChinaStatsLiveMatch,
  type ChinaStatsLiveProfile,
  type ChinaStatsLiveQueue,
  type ChinaStatsLiveRank,
} from "@/lib/china-stats-live";
import { CHINA_STATS_SERVERS, type ChinaStatsServerKey } from "@/lib/china-stats-servers";
import type { ChinaStatsSigningInput } from "@/lib/china-stats-signing";

type LookupResponse = {
  battleInfo?: { nameInfoNew?: string; openId?: string; areaId?: number } | null;
  data?: Array<{ gameId: string; title?: string; titleTime?: string; [key: string]: unknown }> | null;
};

type QueueState =
  | { status: "available"; matches: ChinaStatsLiveMatch[] }
  | { status: "unavailable"; message: string };

type LiveSnapshot = {
  profile: ChinaStatsLiveProfile;
  queues: Record<ChinaStatsLiveQueue, QueueState>;
};

type DetailState =
  | { status: "loading" }
  | { status: "available"; detail: ChinaStatsLiveDetail }
  | { status: "unavailable"; message: string };

const MAX_DETAIL_REQUESTS = 5;

async function signedUrl(input: ChinaStatsSigningInput) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (process.env.NODE_ENV !== "development") {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Sign in to search China ranked profiles.");
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch("/api/china-stats/sign", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as { url?: unknown; message?: unknown } | null;
  if (!response.ok || typeof body?.url !== "string") {
    throw new Error(typeof body?.message === "string"
      ? body.message
      : "Player data is temporarily unavailable. Try again shortly.");
  }
  return body.url;
}

function failureMessage(error: unknown) {
  if (error instanceof LzyumiBrowserContractError) {
    const messages: Record<LzyumiBrowserContractError["kind"], string> = {
      authentication: "Player data is temporarily unavailable. Try again shortly.",
      throttled: "Too many lookups right now. Try again in a moment.",
      "network-rejected": "Player data could not be reached from this network.",
      "not-found": "That player could not be found on the selected server.",
      "http-error": "Player data could not be loaded.",
      malformed: "Some player data was incomplete. Try again shortly.",
      "provider-error": "The lookup could not be completed. Try again later.",
    };
    return messages[error.kind];
  }
  return error instanceof Error ? error.message : "The player lookup failed.";
}

export function ChinaStatsLiveLookupClient() {
  const [riotId, setRiotId] = useState("");
  const [server, setServer] = useState<ChinaStatsServerKey>("ionia");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [queue, setQueue] = useState<ChinaStatsLiveQueue>("SOLO_DUO");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const verifiedOpenId = useRef("");
  const championNames = useRef<ReadonlyMap<string, string>>(new Map());
  const requestedDetails = useRef(new Set<string>());

  async function search() {
    const expected = splitRiotId(riotId);
    if (!expected.riotName || !expected.riotTag) {
      setError("Enter the exact full Riot ID, including #tag.");
      return;
    }

    const serverInfo = CHINA_STATS_SERVERS[server];
    setLoading(true);
    setError("");
    setSnapshot(null);
    setDetails({});
    setExpandedMatch(null);
    requestedDetails.current.clear();
    verifiedOpenId.current = "";

    try {
      const attempts = [...new Set([expected.riotName, `${expected.riotName}#${expected.riotTag}`])];
      let profileResponse: LookupResponse | null = null;
      let verified: ReturnType<typeof verifyFinderIdentity> | null = null;
      let lastIdentityError: unknown = null;

      for (const nickname of attempts) {
        try {
          const url = await signedUrl({
            type: "profile",
            nickname,
            areaId: serverInfo.areaId,
          });
          const response = await fetchLzyumiBrowserResponse(url, "profile") as LookupResponse;
          verified = verifyFinderIdentity(response, `${expected.riotName}#${expected.riotTag}`, serverInfo.areaId);
          profileResponse = response;
          break;
        } catch (caught) {
          lastIdentityError = caught;
        }
      }

      if (!verified || !profileResponse) {
        throw new Error(lastIdentityError instanceof LzyumiBrowserContractError
          ? failureMessage(lastIdentityError)
          : "That exact Riot ID could not be found on the selected server.");
      }

      verifiedOpenId.current = verified.openId;
      championNames.current = await loadChampionNames().catch(() => new Map<string, string>());

      const historyRequest = async (filter: 2 | 3) => {
        const url = await signedUrl({
          type: "history",
          openId: verified!.openId,
          areaId: serverInfo.areaId,
          filter,
        });
        return fetchLzyumiBrowserResponse(url, "history");
      };
      const recentRequest = async () => {
        const url = await signedUrl({
          type: "recent",
          openId: verified!.openId,
          areaId: serverInfo.areaId,
        });
        return fetchLzyumiBrowserResponse(url, "recent");
      };

      const [solo, flex, recent] = await Promise.allSettled([
        historyRequest(2),
        historyRequest(3),
        recentRequest(),
      ]);
      const resolvedRiotId = verified.resolvedRiotId;
      const profile = normalizeChinaStatsLiveProfile({
        profileResponse,
        recentResponse: recent.status === "fulfilled" ? recent.value : null,
        riotId: resolvedRiotId,
        serverName: serverInfo.name,
        areaId: serverInfo.areaId,
        championNames: championNames.current,
      });
      const queueState = (
        outcome: PromiseSettledResult<unknown>,
        targetQueue: ChinaStatsLiveQueue,
      ): QueueState => outcome.status === "fulfilled"
        ? { status: "available", matches: normalizeChinaStatsLiveHistory(outcome.value, targetQueue, championNames.current) }
        : { status: "unavailable", message: failureMessage(outcome.reason) };

      setSnapshot({
        profile,
        queues: {
          SOLO_DUO: queueState(solo, "SOLO_DUO"),
          FLEX: queueState(flex, "FLEX"),
        },
      });
    } catch (caught) {
      verifiedOpenId.current = "";
      setError(failureMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function toggleDetail(match: ChinaStatsLiveMatch) {
    if (expandedMatch === match.providerGameId) {
      setExpandedMatch(null);
      return;
    }
    setExpandedMatch(match.providerGameId);
    if (details[match.providerGameId] || !verifiedOpenId.current) return;
    if (requestedDetails.current.size >= MAX_DETAIL_REQUESTS) {
      setDetails((current) => ({ ...current, [match.providerGameId]: { status: "unavailable", message: "Open another player search to view more match details." } }));
      return;
    }

    requestedDetails.current.add(match.providerGameId);
    setDetails((current) => ({ ...current, [match.providerGameId]: { status: "loading" } }));
    try {
      const serverInfo = CHINA_STATS_SERVERS[server];
      const url = await signedUrl({
        type: "detail",
        openId: verifiedOpenId.current,
        gameId: match.providerGameId,
        areaId: serverInfo.areaId,
      });
      const response = await fetchLzyumiBrowserResponse(url, "detail");
      const detail = normalizeChinaStatsLiveDetail({
        value: response,
        searchedOpenId: verifiedOpenId.current,
        championNames: championNames.current,
      });
      setDetails((current) => ({ ...current, [match.providerGameId]: { status: "available", detail } }));
    } catch (caught) {
      setDetails((current) => ({ ...current, [match.providerGameId]: { status: "unavailable", message: failureMessage(caught) } }));
    }
  }

  const visibleQueue = snapshot?.queues[queue] ?? null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_88%_0%,rgba(54,215,255,0.13),transparent_29%),linear-gradient(135deg,#111925_0%,#0b111b_70%)] p-5 sm:p-7 lg:p-9">
        <div className="grid gap-7 xl:grid-cols-[1fr_0.9fr] xl:items-end">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-[#36d7ff]"><Wifi size={15} /> China player search</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl">Search China ranked profiles.</h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[#98a8bf] sm:text-base">Enter a full Riot ID to see rank, LP, recent form, champion pool, and match history on Ionia or Super Server.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.09] bg-black/25 p-4">
            <label className="block text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">Full Riot ID</label>
            <div className="mt-2 flex min-h-12 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#080d14] px-3 focus-within:border-[#36d7ff]/55">
              <Search size={18} className="text-[#66758a]" />
              <input value={riotId} onChange={(event) => setRiotId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Name#Tag" className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#536176]" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <select value={server} onChange={(event) => setServer(event.target.value as ChinaStatsServerKey)} className="min-h-11 rounded-xl border border-white/[0.1] bg-[#080d14] px-3 text-sm font-bold text-white outline-none focus:border-[#36d7ff]/55">
                <option value="ionia">{`Ionia / ${CHINA_STATS_SERVERS.ionia.chineseName}`}</option>
                <option value="super-server">{`Super Server / ${CHINA_STATS_SERVERS["super-server"].chineseName}`}</option>
              </select>
              <button type="button" disabled={loading} onClick={() => void search()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1478b8] px-5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#1596d5] disabled:cursor-wait disabled:opacity-60">{loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}{loading ? "Searching" : "Search player"}</button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <BoundaryNote icon={<ShieldCheck size={17} />} title="Exact player search" text="Use the full Riot ID, including the tag, to find the right account." />
        <BoundaryNote icon={<BarChart3 size={17} />} title="Rank and form" text="Compare Solo/Duo and Flex rank, LP, win rate, and recent champions." />
        <BoundaryNote icon={<Swords size={17} />} title="Match history" text="Open recent games for a complete 5v5 scoreboard and player stats." />
      </div>

      {error && <p role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-950/35 p-4 text-sm font-bold text-red-100"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</p>}
      {snapshot && <LiveResult snapshot={snapshot} queue={queue} setQueue={(value) => { setQueue(value); setExpandedMatch(null); }} visibleQueue={visibleQueue} expandedMatch={expandedMatch} details={details} toggleDetail={toggleDetail} />}
    </div>
  );
}

function BoundaryNote({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-[#0d131d] p-4"><div className="flex items-center gap-2 text-xs font-black text-white"><span className="text-[#36d7ff]">{icon}</span>{title}</div><p className="mt-2 text-xs font-semibold leading-5 text-[#718096]">{text}</p></div>;
}

function LiveResult({ snapshot, queue, setQueue, visibleQueue, expandedMatch, details, toggleDetail }: { snapshot: LiveSnapshot; queue: ChinaStatsLiveQueue; setQueue: (queue: ChinaStatsLiveQueue) => void; visibleQueue: QueueState | null; expandedMatch: string | null; details: Record<string, DetailState>; toggleDetail: (match: ChinaStatsLiveMatch) => Promise<void> }) {
  const { profile } = snapshot;
  return <div className="space-y-4">
    <section className="rounded-3xl border border-emerald-300/15 bg-[#0d131d] p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-300"><ShieldCheck size={14} /> Player found</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">{profile.riotId}</h2><p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[#7f8ea3]"><Server size={14} />{profile.serverName}{profile.level !== null ? ` · Level ${profile.level}` : ""}</p></div><div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs font-bold text-[#8290a4]"><span className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#36d7ff]">Last updated</span><span className="mt-1 block">{chinaDateTime(profile.fetchedAt)}</span></div></div></section>
    <section className="grid gap-4 lg:grid-cols-3"><LiveRankCard label="Solo / Duo" rank={profile.ranks.solo} /><LiveRankCard label="Flex" rank={profile.ranks.flex} />{profile.recent ? <div className="rounded-2xl border border-white/[0.08] bg-[#0d131d] p-5"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">Recent performance</p><div className="mt-4 flex items-end justify-between"><div><p className="text-3xl font-black text-white">{profile.recent.kda?.toFixed(2) ?? "—"}</p><p className="mt-1 text-xs font-bold text-[#718096]">30-day KDA</p></div><div className="text-right text-xs font-bold text-[#8290a4]">{profile.recent.games ?? "—"} games<br /><span className="text-emerald-300">{profile.recent.wins ?? "—"} wins</span></div></div><div className="mt-4 flex gap-2">{profile.recent.champions.slice(0, 3).map((champion) => <div key={champion.championId} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/[0.035] p-2"><Image src={`/lol/champions/${champion.championId}.png`} alt={champion.champion} width={32} height={32} className="h-8 w-8 rounded-lg object-cover" /><span className="min-w-0"><span className="block truncate text-[11px] font-black text-white">{champion.champion}</span><span className="text-[10px] font-bold text-[#718096]">{champion.games} games</span></span></div>)}</div></div> : <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0d131d] p-5"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">Recent performance</p><p className="mt-4 text-sm font-black text-white">Recent stats unavailable</p><p className="mt-2 text-xs font-semibold leading-5 text-[#718096]">Rank and match history are still available for this player.</p></div>}</section>
    <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d131d]"><div className="flex flex-col gap-4 border-b border-white/[0.08] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5"><div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#36d7ff]">Recent ranked games</p><h2 className="mt-1 text-2xl font-black text-white">Match history</h2></div><div className="flex rounded-xl border border-white/[0.08] bg-black/20 p-1">{(["SOLO_DUO", "FLEX"] as ChinaStatsLiveQueue[]).map((item) => <button key={item} type="button" onClick={() => setQueue(item)} className={`rounded-lg px-4 py-2 text-xs font-black ${queue === item ? "bg-[#163b59] text-[#8eeaff]" : "text-[#77869b] hover:text-white"}`}>{item === "SOLO_DUO" ? "Solo / Duo" : "Flex"}</button>)}</div></div>{visibleQueue?.status === "available" && visibleQueue.matches.length > 0 && <LiveQueueOverview matches={visibleQueue.matches} />}{visibleQueue?.status === "unavailable" ? <p className="m-5 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm font-bold text-amber-100"><AlertTriangle size={17} />{visibleQueue.message}</p> : <div className="divide-y divide-white/[0.06]">{visibleQueue?.matches.map((match) => <LiveMatchRow key={match.providerGameId} match={match} expanded={expandedMatch === match.providerGameId} detail={details[match.providerGameId]} onToggle={() => void toggleDetail(match)} />)}{visibleQueue?.status === "available" && visibleQueue.matches.length === 0 && <p className="p-10 text-center text-sm font-bold text-[#718096]">No recent matches found for this queue.</p>}</div>}</section>
  </div>;
}

function LiveRankCard({ label, rank }: { label: string; rank: ChinaStatsLiveRank }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-[#0d131d] p-5"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">{label}</p><div className="mt-3 flex items-start justify-between"><div><h3 className="text-2xl font-black text-cyan-100">{rank.label}</h3><p className="mt-1 text-sm font-black text-white">{rank.lp === null ? "LP unavailable" : `${rank.lp.toLocaleString()} LP`}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200"><BarChart3 size={20} /></span></div><div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs font-bold text-[#718096]"><span>{rank.wins ?? "—"}W / {rank.losses ?? "—"}L</span><span className="text-emerald-300">{rank.winRate === null ? "WR unavailable" : `${rank.winRate.toFixed(1)}% WR`}</span></div></div>;
}

function LiveQueueOverview({ matches }: { matches: ChinaStatsLiveMatch[] }) {
  const summary = summarizeChinaStatsLiveMatches(matches);
  const unresolvedGames = summary.games - summary.decidedGames;
  const topRoles = summary.roles.slice(0, 2);

  return <div className="border-b border-white/[0.08] bg-[#080d14]/75 p-4 sm:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8eeaff]">Last {summary.games} games</p>
        <p className="mt-1 text-xs font-semibold text-[#718096]">Win rate, recent form, preferred roles, and most-played champions.</p>
      </div>
      <p className="text-xs font-bold text-[#64748b]">Newest match first</p>
    </div>
    <div className="grid gap-3 lg:grid-cols-[0.8fr_1.05fr_1.35fr]">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-[#718096]">Record</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-black text-white">{summary.winRate === null ? "—" : `${summary.winRate.toFixed(1)}%`}</p>
            <p className="mt-1 text-xs font-bold text-[#718096]">Win rate</p>
          </div>
          <p className="text-right text-sm font-black"><span className="text-emerald-300">{summary.wins}W</span><span className="mx-1.5 text-[#526176]">/</span><span className="text-red-300">{summary.losses}L</span></p>
        </div>
        {unresolvedGames > 0 && <p className="mt-3 text-xs font-semibold text-amber-200/80">{unresolvedGames} result{unresolvedGames === 1 ? "" : "s"} unavailable</p>}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-[#718096]">Recent form</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summary.recentForm.map((result, index) => <QueueFormPill key={`${index}-${result ?? "unknown"}`} result={result} />)}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[#8290a4]">
          <span>{summary.currentStreak ? `${summary.currentStreak.length}${summary.currentStreak.result} streak` : "Streak unavailable"}</span>
          {topRoles.map((role) => <span key={role.role}>{role.role}: {role.games}</span>)}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-[#718096]">Champion pool</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {summary.champions.slice(0, 3).map((champion) => <div key={champion.championId ?? champion.champion} className="flex min-w-0 items-center gap-2 rounded-xl bg-black/20 p-2">
            {champion.championId ? <Image src={`/lol/champions/${champion.championId}.png`} alt={champion.champion} width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.06]" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black text-white">{champion.champion}</span>
              <span className="mt-0.5 block text-[11px] font-bold text-[#718096]">{champion.games}G · {champion.winRate === null ? "WR —" : `${champion.winRate.toFixed(0)}% WR`}</span>
            </span>
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}

function QueueFormPill({ result }: { result: "W" | "L" | null }) {
  const styles = result === "W"
    ? "bg-emerald-400/15 text-emerald-300"
    : result === "L"
      ? "bg-red-400/15 text-red-300"
      : "bg-white/[0.06] text-[#718096]";
  return <span className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${styles}`}>{result ?? "—"}</span>;
}

function LiveMatchRow({ match, expanded, detail, onToggle }: { match: ChinaStatsLiveMatch; expanded: boolean; detail?: DetailState; onToggle: () => void }) {
  return <article><button type="button" onClick={onToggle} className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:grid-cols-[70px_1fr_140px_32px] sm:items-center sm:px-5"><span className={`text-sm font-black ${match.result === "W" ? "text-emerald-300" : match.result === "L" ? "text-red-300" : "text-[#8290a4]"}`}>{match.result === "W" ? "WIN" : match.result === "L" ? "LOSS" : "RESULT N/A"}</span><span className="flex min-w-0 items-center gap-3">{match.championId ? <Image src={`/lol/champions/${match.championId}.png`} alt={match.champion} width={42} height={42} className="h-10 w-10 rounded-xl object-cover" /> : <span className="h-10 w-10 rounded-xl bg-white/[0.05]" />}<span className="min-w-0"><span className="block truncate text-sm font-black text-white">{match.champion}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#718096]">{match.role ?? (match.queue === "SOLO_DUO" ? "Solo / Duo" : "Flex")}{match.wasMvp ? " / MVP" : match.wasSvp ? " / SVP" : ""}</span></span></span><span className="flex items-center gap-2 text-xs font-bold text-[#8290a4]"><Clock3 size={14} />{match.titleTime ?? "Time unavailable"}</span><span className="text-[#718096]">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span></button>{expanded && <div className="border-t border-white/[0.06] bg-[#080d14] p-4 sm:p-5">{!detail || detail.status === "loading" ? <p className="flex items-center gap-2 text-sm font-bold text-[#8eeaff]"><Loader2 size={17} className="animate-spin" />Loading match details…</p> : detail.status === "unavailable" ? <p className="flex items-center gap-2 text-sm font-bold text-amber-100"><AlertTriangle size={17} />{detail.message}</p> : <LiveScoreboard detail={detail.detail} />}</div>}</article>;
}

function LiveScoreboard({ detail }: { detail: ChinaStatsLiveDetail }) {
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.11em] text-[#8eeaff]"><Swords size={16} />{detail.gameType.replaceAll("_", " ")}{detail.gameMode ? ` / ${detail.gameMode}` : ""}</p><p className="text-[11px] font-bold text-[#64748b]">Full match scoreboard</p></div><div className="grid gap-4 xl:grid-cols-2">{detail.teams.map((team, index) => <div key={team.id} className="overflow-hidden rounded-2xl border border-white/[0.08]"><div className={`flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-[0.1em] ${team.result === "Win" ? "bg-emerald-400/10 text-emerald-200" : team.result === "Loss" ? "bg-red-400/[0.07] text-red-200" : "bg-white/[0.04] text-[#a9b7ca]"}`}><span>Team {index + 1}</span><span>{team.result}</span></div><div className="divide-y divide-white/[0.05]">{team.players.map((player, playerIndex) => <div key={`${team.id}-${playerIndex}`} className={`grid grid-cols-[36px_minmax(100px,1fr)_80px_64px] items-center gap-2 px-3 py-2.5 text-xs ${player.searchedPlayer ? "bg-[#36d7ff]/[0.07]" : ""}`}>{player.championId ? <Image src={`/lol/champions/${player.championId}.png`} alt={player.champion} width={32} height={32} className="h-8 w-8 rounded-lg object-cover" /> : <span className="h-8 w-8 rounded-lg bg-white/[0.05]" />}<span className="min-w-0"><span className="block truncate font-black text-white">{player.riotId}</span><span className="mt-0.5 block truncate text-[10px] font-bold text-[#68778c]">{player.champion} / {player.role}</span></span><span className="font-black text-[#cbd5e1]">{player.kda ?? "—"}</span><span className="text-right font-bold text-[#8290a4]">{player.gold === null ? "—" : `${(player.gold / 1000).toFixed(1)}k`}</span></div>)}</div></div>)}</div></div>;
}

function chinaDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
