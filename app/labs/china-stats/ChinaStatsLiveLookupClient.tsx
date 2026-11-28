"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, Clock3, FilterX, Loader2, RefreshCw, Search, Server, ShieldCheck, Swords, Wifi } from "lucide-react";
import {
  canRequestChinaStatsDetail,
  getChinaStatsDetailBudget,
  shouldRetainChinaStatsResult,
  type ChinaStatsDetailBudget,
  type ChinaStatsLookupTarget,
} from "@/lib/china-stats-demo-states";
import { fetchLzyumiBrowserResponse, LzyumiBrowserContractError } from "@/lib/lzyumi-browser-contract";
import { verifyFinderIdentity } from "@/lib/lzyumi-custom-game-finder";
import { loadChampionNames } from "@/lib/lzyumi-display";
import { splitRiotId } from "@/lib/riot-id";
import {
  CHINA_STATS_ALL_MATCH_FILTER,
  CHINA_STATS_UNAVAILABLE_MATCH_FILTER,
  DEFAULT_CHINA_STATS_MATCH_FILTERS,
  chinaStatsChampionFilterKey,
  chinaStatsParticipantProfileHref,
  filterChinaStatsLiveMatches,
  normalizeChinaStatsLiveDetail,
  normalizeChinaStatsLiveHistory,
  normalizeChinaStatsLiveProfile,
  summarizeChinaStatsLiveMatches,
  type ChinaStatsLiveDetail,
  type ChinaStatsLiveMatch,
  type ChinaStatsLiveMatchFilters,
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
  target: ChinaStatsLookupTarget;
};

type DetailState =
  | { status: "loading" }
  | { status: "available"; detail: ChinaStatsLiveDetail }
  | { status: "unavailable"; message: string; retryable: boolean };

type LookupError = {
  message: string;
  target: ChinaStatsLookupTarget;
  retryable: boolean;
};

type LoadingStage = "finding-player" | "loading-ranked-data";

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

function selectQueueState(
  queues: LiveSnapshot["queues"],
  queue: ChinaStatsLiveMatchFilters["queue"],
): QueueState {
  if (queue !== "ALL") return queues[queue];
  const available = (Object.values(queues) as QueueState[]).filter(
    (state): state is Extract<QueueState, { status: "available" }> => state.status === "available",
  );
  if (available.length > 0) {
    return { status: "available", matches: available.flatMap((state) => state.matches) };
  }
  return {
    status: "unavailable",
    message: "Solo / Duo and Flex history are currently unavailable.",
  };
}

export function ChinaStatsLiveLookupClient({
  initialRiotId = "",
  initialServer = "ionia",
}: {
  initialRiotId?: string;
  initialServer?: ChinaStatsServerKey;
}) {
  const [riotId, setRiotId] = useState(initialRiotId);
  const [server, setServer] = useState<ChinaStatsServerKey>(initialServer);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("finding-player");
  const [error, setError] = useState<LookupError | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [matchFilters, setMatchFilters] = useState<ChinaStatsLiveMatchFilters>(DEFAULT_CHINA_STATS_MATCH_FILTERS);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const verifiedOpenId = useRef("");
  const championNames = useRef<ReadonlyMap<string, string>>(new Map());
  const requestedDetails = useRef(new Set<string>());
  const autoSearched = useRef("");
  const lookupInFlight = useRef(false);

  async function search(targetRiotId = riotId, targetServer = server) {
    if (lookupInFlight.current) return;
    const expected = splitRiotId(targetRiotId);
    if (!expected.riotName || !expected.riotTag) {
      setError({
        message: "Enter the exact full Riot ID, including #tag.",
        target: { riotId: targetRiotId, server: targetServer },
        retryable: false,
      });
      return;
    }

    const target: ChinaStatsLookupTarget = {
      riotId: `${expected.riotName}#${expected.riotTag}`,
      server: targetServer,
    };
    const serverInfo = CHINA_STATS_SERVERS[targetServer];
    const retainSnapshot = snapshot !== null
      && shouldRetainChinaStatsResult(snapshot.target, target);
    const retainedOpenId = retainSnapshot ? verifiedOpenId.current : "";
    lookupInFlight.current = true;
    setLoading(true);
    setLoadingStage("finding-player");
    setError(null);
    if (!retainSnapshot) {
      setSnapshot(null);
      setMatchFilters(DEFAULT_CHINA_STATS_MATCH_FILTERS);
    }
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
      setLoadingStage("loading-ranked-data");

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
        target,
        queues: {
          SOLO_DUO: queueState(solo, "SOLO_DUO"),
          FLEX: queueState(flex, "FLEX"),
        },
      });
    } catch (caught) {
      verifiedOpenId.current = retainedOpenId;
      setError({ message: failureMessage(caught), target, retryable: true });
    } finally {
      lookupInFlight.current = false;
      setLoading(false);
    }
  }

  const runInitialSearch = useEffectEvent((targetRiotId: string, targetServer: ChinaStatsServerKey) => {
    void search(targetRiotId, targetServer);
  });

  useEffect(() => {
    const key = `${initialServer}:${initialRiotId.trim().toLocaleLowerCase("en-US")}`;
    if (!initialRiotId.trim() || autoSearched.current === key) return;
    autoSearched.current = key;
    runInitialSearch(initialRiotId, initialServer);
  }, [initialRiotId, initialServer]);

  async function loadDetail(match: ChinaStatsLiveMatch) {
    if (!verifiedOpenId.current || !snapshot) return;
    if (!canRequestChinaStatsDetail(requestedDetails.current, match.providerGameId, MAX_DETAIL_REQUESTS)) {
      setDetails((current) => ({
        ...current,
        [match.providerGameId]: {
          status: "unavailable",
          message: "The five-match detail limit is used. Start another player search to open more scoreboards.",
          retryable: false,
        },
      }));
      return;
    }

    requestedDetails.current.add(match.providerGameId);
    setDetails((current) => ({ ...current, [match.providerGameId]: { status: "loading" } }));
    try {
      const serverInfo = CHINA_STATS_SERVERS[snapshot.target.server];
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
      setDetails((current) => ({
        ...current,
        [match.providerGameId]: {
          status: "unavailable",
          message: failureMessage(caught),
          retryable: true,
        },
      }));
    }
  }

  async function toggleDetail(match: ChinaStatsLiveMatch) {
    if (!verifiedOpenId.current) return;
    if (expandedMatch === match.providerGameId) {
      setExpandedMatch(null);
      return;
    }
    setExpandedMatch(match.providerGameId);
    if (details[match.providerGameId]) return;
    await loadDetail(match);
  }

  async function retryDetail(match: ChinaStatsLiveMatch) {
    setExpandedMatch(match.providerGameId);
    await loadDetail(match);
  }

  const visibleQueue = snapshot ? selectQueueState(snapshot.queues, matchFilters.queue) : null;
  const detailBudget = getChinaStatsDetailBudget(requestedDetails.current, MAX_DETAIL_REQUESTS);
  const loadingMessage = loadingStage === "finding-player"
    ? "Finding the exact player and verifying the selected server."
    : "Player found. Loading ranked queues and recent performance.";

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
              <input value={riotId} onChange={(event) => setRiotId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !loading) void search(); }} placeholder="Name#Tag" className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#536176]" />
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

      {loading && snapshot ? (
        <LookupStatusNotice
          icon={<Loader2 size={18} className="animate-spin" />}
          title="Refreshing this player"
          message={`${loadingMessage} The last complete result stays visible until the refresh finishes.`}
          tone="loading"
        />
      ) : null}
      {error ? (
        <LookupStatusNotice
          icon={<AlertTriangle size={18} />}
          title={snapshot ? "Refresh unsuccessful" : "Player lookup unsuccessful"}
          message={error.message}
          tone="error"
          action={error.retryable ? (
            <button
              type="button"
              onClick={() => void search(error.target.riotId, error.target.server)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-100 px-4 text-xs font-black text-red-950 transition hover:bg-white"
            >
              <RefreshCw size={15} /> Try again
            </button>
          ) : undefined}
        />
      ) : null}
      {loading && !snapshot ? <ChinaStatsLookupSkeleton message={loadingMessage} /> : null}
      {snapshot ? (
        <LiveResult
          snapshot={snapshot}
          matchFilters={matchFilters}
          setMatchFilters={(value) => { setMatchFilters(value); setExpandedMatch(null); }}
          visibleQueue={visibleQueue}
          expandedMatch={expandedMatch}
          details={details}
          detailBudget={detailBudget}
          retryLookup={() => void search(snapshot.target.riotId, snapshot.target.server)}
          toggleDetail={toggleDetail}
          retryDetail={retryDetail}
        />
      ) : null}
    </div>
  );
}

function LookupStatusNotice({
  icon,
  title,
  message,
  tone,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  tone: "loading" | "error";
  action?: React.ReactNode;
}) {
  const styles = tone === "loading"
    ? "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100"
    : "border-red-400/25 bg-red-950/35 text-red-100";
  return <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${styles}`}><div className="flex items-start gap-3"><span className="mt-0.5 shrink-0">{icon}</span><span><span className="block text-sm font-black">{title}</span><span className="mt-1 block text-xs font-semibold leading-5 opacity-80">{message}</span></span></div>{action}</div>;
}

function ChinaStatsLookupSkeleton({ message }: { message: string }) {
  return <section role="status" aria-live="polite" aria-label="Loading player profile" className="space-y-4">
    <div className="rounded-3xl border border-cyan-300/15 bg-[#0d131d] p-5 sm:p-6">
      <div className="flex items-center gap-3 text-sm font-black text-cyan-100"><Loader2 size={18} className="animate-spin" /><span>{message}</span></div>
      <div className="mt-5 h-9 w-56 max-w-full animate-pulse rounded-xl bg-white/[0.07]" />
      <div className="mt-3 h-4 w-36 animate-pulse rounded-lg bg-white/[0.05]" />
    </div>
    <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-white/[0.08] bg-[#0d131d] p-5"><div className="h-3 w-24 rounded bg-white/[0.06]" /><div className="mt-5 h-8 w-32 rounded-lg bg-white/[0.07]" /><div className="mt-12 h-3 w-full rounded bg-white/[0.05]" /></div>)}</div>
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d131d]"><div className="border-b border-white/[0.08] p-5"><div className="h-3 w-28 animate-pulse rounded bg-white/[0.06]" /><div className="mt-3 h-7 w-44 animate-pulse rounded-lg bg-white/[0.07]" /></div>{[0, 1, 2].map((item) => <div key={item} className="grid grid-cols-[4rem_1fr_7rem] gap-4 border-b border-white/[0.05] p-5 last:border-0"><div className="h-4 animate-pulse rounded bg-white/[0.06]" /><div className="h-10 animate-pulse rounded-lg bg-white/[0.05]" /><div className="h-4 animate-pulse rounded bg-white/[0.05]" /></div>)}</div>
  </section>;
}

function BoundaryNote({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-[#0d131d] p-4"><div className="flex items-center gap-2 text-xs font-black text-white"><span className="text-[#36d7ff]">{icon}</span>{title}</div><p className="mt-2 text-xs font-semibold leading-5 text-[#718096]">{text}</p></div>;
}

function LiveResult({
  snapshot,
  matchFilters,
  setMatchFilters,
  visibleQueue,
  expandedMatch,
  details,
  detailBudget,
  retryLookup,
  toggleDetail,
  retryDetail,
}: {
  snapshot: LiveSnapshot;
  matchFilters: ChinaStatsLiveMatchFilters;
  setMatchFilters: (filters: ChinaStatsLiveMatchFilters) => void;
  visibleQueue: QueueState | null;
  expandedMatch: string | null;
  details: Record<string, DetailState>;
  detailBudget: ChinaStatsDetailBudget;
  retryLookup: () => void;
  toggleDetail: (match: ChinaStatsLiveMatch) => Promise<void>;
  retryDetail: (match: ChinaStatsLiveMatch) => Promise<void>;
}) {
  const { profile } = snapshot;
  const loadedMatches = (Object.values(snapshot.queues) as QueueState[]).flatMap((state) => (
    state.status === "available" ? state.matches : []
  ));
  const filteredMatches = filterChinaStatsLiveMatches(loadedMatches, matchFilters);
  const selectedQueueState = matchFilters.queue === "ALL" ? null : snapshot.queues[matchFilters.queue];
  const selectedQueueMatchCount = matchFilters.queue === "ALL"
    ? loadedMatches.length
    : selectedQueueState?.status === "available"
      ? selectedQueueState.matches.length
      : 0;
  const unavailableSections = [
    profile.recentStatus === "unavailable" ? "recent performance" : null,
    snapshot.queues.SOLO_DUO.status === "unavailable" ? "Solo / Duo history" : null,
    snapshot.queues.FLEX.status === "unavailable" ? "Flex history" : null,
  ].filter((value): value is string => value !== null);

  return <div className="space-y-4">
    {unavailableSections.length > 0 ? <section role="status" className="flex flex-col gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-amber-100 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><p className="text-sm font-black">Some player data is unavailable</p><p className="mt-1 text-xs font-semibold leading-5 text-amber-100/75">Available sections are still complete. Retry to load {unavailableSections.join(", ")}.</p></div></div><button type="button" onClick={retryLookup} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-100/25 px-4 text-xs font-black transition hover:bg-amber-100/10"><RefreshCw size={15} /> Retry player data</button></section> : null}
    <section className="rounded-3xl border border-emerald-300/15 bg-[#0d131d] p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-300"><ShieldCheck size={14} /> Player found</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">{profile.riotId}</h2><p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[#7f8ea3]"><Server size={14} />{profile.serverName}{profile.level !== null ? ` · Level ${profile.level}` : ""}</p></div><div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs font-bold text-[#8290a4]"><span className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#36d7ff]">Last updated</span><span className="mt-1 block">{chinaDateTime(profile.fetchedAt)}</span></div></div></section>
    <section className="grid gap-4 lg:grid-cols-3"><LiveRankCard label="Solo / Duo" rank={profile.ranks.solo} /><LiveRankCard label="Flex" rank={profile.ranks.flex} />{profile.recent ? <div className="rounded-2xl border border-white/[0.08] bg-[#0d131d] p-5"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">Recent performance summary</p><div className="mt-4 flex items-end justify-between"><div><p className="text-3xl font-black text-white">{profile.recent.kda?.toFixed(2) ?? "—"}</p><p className="mt-1 text-xs font-bold text-[#718096]">Summary KDA</p></div><div className="text-right text-xs font-bold text-[#8290a4]">{profile.recent.games ?? "—"} games in summary<br /><span className="text-emerald-300">{profile.recent.wins ?? "—"} wins in summary</span></div></div><div className="mt-4 flex gap-2">{profile.recent.champions.slice(0, 3).map((champion) => <div key={champion.championId} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/[0.035] p-2"><Image src={`/lol/champions/${champion.championId}.png`} alt={champion.champion} width={32} height={32} className="h-8 w-8 rounded-lg object-cover" /><span className="min-w-0"><span className="block truncate text-[11px] font-black text-white">{champion.champion}</span><span className="text-[10px] font-bold text-[#718096]">{champion.games} summary games</span></span></div>)}</div><p className="mt-3 text-[11px] font-semibold leading-4 text-[#64748b]">This optional summary may cover a different sample from the loaded match history.</p></div> : <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0d131d] p-5"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">Recent performance summary</p><p className="mt-4 text-sm font-black text-white">Recent stats unavailable</p><p className="mt-2 text-xs font-semibold leading-5 text-[#718096]">Rank and match history are still available for this player.</p></div>}</section>
    <LiveMatchHistory
      snapshot={snapshot}
      filters={matchFilters}
      setFilters={setMatchFilters}
      visibleQueue={visibleQueue}
      filteredMatches={filteredMatches}
      selectedQueueMatchCount={selectedQueueMatchCount}
      expandedMatch={expandedMatch}
      details={details}
      detailBudget={detailBudget}
      retryLookup={retryLookup}
      toggleDetail={toggleDetail}
      retryDetail={retryDetail}
    />
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
        <p className="mt-1 text-xs font-semibold text-[#718096]">Win rate, recent form, role mix, and most-played champions from these loaded matches.</p>
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
          {topRoles.length > 0 && <span>Role mix:</span>}
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

function LiveMatchHistory({
  snapshot,
  filters,
  setFilters,
  visibleQueue,
  filteredMatches,
  selectedQueueMatchCount,
  expandedMatch,
  details,
  detailBudget,
  retryLookup,
  toggleDetail,
  retryDetail,
}: {
  snapshot: LiveSnapshot;
  filters: ChinaStatsLiveMatchFilters;
  setFilters: (filters: ChinaStatsLiveMatchFilters) => void;
  visibleQueue: QueueState | null;
  filteredMatches: ChinaStatsLiveMatch[];
  selectedQueueMatchCount: number;
  expandedMatch: string | null;
  details: Record<string, DetailState>;
  detailBudget: ChinaStatsDetailBudget;
  retryLookup: () => void;
  toggleDetail: (match: ChinaStatsLiveMatch) => Promise<void>;
  retryDetail: (match: ChinaStatsLiveMatch) => Promise<void>;
}) {
  const loadedMatches = (Object.values(snapshot.queues) as QueueState[]).flatMap((state) => (
    state.status === "available" ? state.matches : []
  ));
  const championOptions = [...new Map(loadedMatches.map((match) => [
    chinaStatsChampionFilterKey(match),
    match.champion,
  ])).entries()].sort((left, right) => left[1].localeCompare(right[1]));
  const roleOptions = [...new Set(loadedMatches.flatMap((match) => match.role ? [match.role] : []))].sort();
  const filtersActive = filters.queue !== DEFAULT_CHINA_STATS_MATCH_FILTERS.queue
    || filters.champion !== CHINA_STATS_ALL_MATCH_FILTER
    || filters.role !== CHINA_STATS_ALL_MATCH_FILTER
    || filters.result !== CHINA_STATS_ALL_MATCH_FILTER;

  return <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d131d]">
    <div className="flex flex-col gap-4 border-b border-white/[0.08] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#36d7ff]">Recent ranked games</p>
        <h2 className="mt-1 text-2xl font-black text-white">Match history</h2>
        <p className={`mt-2 text-xs font-bold ${detailBudget.exhausted ? "text-amber-200" : "text-[#64748b]"}`}>
          {detailBudget.exhausted ? "Detail limit reached" : `${detailBudget.remaining} of ${detailBudget.maximum} match details available`}
          <span className="sr-only">. {detailBudget.used} opened.</span>
        </p>
      </div>
      <p className="max-w-md text-xs font-semibold leading-5 text-[#718096]">Filters use only the ranked rows already loaded in this browser. Match details load only when you open a scoreboard.</p>
    </div>

    <div aria-label="Match history filters" className="grid gap-3 border-b border-white/[0.08] bg-[#0a1018] p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
      <LiveMatchFilterSelect label="Queue" value={filters.queue} onChange={(value) => setFilters({ ...filters, queue: value as ChinaStatsLiveMatchFilters["queue"] })}>
        <option value="ALL">All queues</option>
        <option value="SOLO_DUO">Solo / Duo</option>
        <option value="FLEX">Flex</option>
      </LiveMatchFilterSelect>
      <LiveMatchFilterSelect label="Champion" value={filters.champion} onChange={(value) => setFilters({ ...filters, champion: value })}>
        <option value={CHINA_STATS_ALL_MATCH_FILTER}>All champions</option>
        {championOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </LiveMatchFilterSelect>
      <LiveMatchFilterSelect label="Role" value={filters.role} onChange={(value) => setFilters({ ...filters, role: value })}>
        <option value={CHINA_STATS_ALL_MATCH_FILTER}>All roles</option>
        {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        <option value={CHINA_STATS_UNAVAILABLE_MATCH_FILTER}>Role unavailable</option>
      </LiveMatchFilterSelect>
      <LiveMatchFilterSelect label="Result" value={filters.result} onChange={(value) => setFilters({ ...filters, result: value as ChinaStatsLiveMatchFilters["result"] })}>
        <option value={CHINA_STATS_ALL_MATCH_FILTER}>All results</option>
        <option value="W">Wins</option>
        <option value="L">Losses</option>
        <option value={CHINA_STATS_UNAVAILABLE_MATCH_FILTER}>Result unavailable</option>
      </LiveMatchFilterSelect>
      <button
        type="button"
        onClick={() => setFilters(DEFAULT_CHINA_STATS_MATCH_FILTERS)}
        disabled={!filtersActive}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 text-xs font-black text-[#a9b7ca] transition hover:border-[#36d7ff]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FilterX size={15} /> Reset
      </button>
    </div>

    {visibleQueue?.status === "available" && filteredMatches.length > 0 ? <LiveQueueOverview matches={filteredMatches} /> : null}
    {visibleQueue?.status === "unavailable" ? (
      <div role="status" className="m-5 flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-amber-100 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm font-bold"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{visibleQueue.message}</p>
        <button type="button" onClick={retryLookup} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-100/25 px-3 text-xs font-black"><RefreshCw size={14} /> Retry</button>
      </div>
    ) : (
      <div className="divide-y divide-white/[0.06]">
        {filteredMatches.map((match) => <LiveMatchRow key={match.providerGameId} match={match} server={snapshot.target.server} expanded={expandedMatch === match.providerGameId} detail={details[match.providerGameId]} onToggle={() => void toggleDetail(match)} onRetry={() => void retryDetail(match)} />)}
        {visibleQueue?.status === "available" && selectedQueueMatchCount === 0 ? (
          <div role="status" className="p-10 text-center"><Search size={24} className="mx-auto text-[#64748b]" /><p className="mt-3 text-sm font-black text-white">No recent matches in this queue</p><p className="mt-1 text-xs font-semibold text-[#718096]">The queue loaded successfully but returned no ranked history.</p></div>
        ) : null}
        {visibleQueue?.status === "available" && selectedQueueMatchCount > 0 && filteredMatches.length === 0 ? (
          <div role="status" className="p-10 text-center"><FilterX size={24} className="mx-auto text-[#64748b]" /><p className="mt-3 text-sm font-black text-white">No matches match these filters</p><p className="mt-1 text-xs font-semibold text-[#718096]">The loaded history is still available. Reset or change a filter to see it.</p><button type="button" onClick={() => setFilters(DEFAULT_CHINA_STATS_MATCH_FILTERS)} className="mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.12] px-4 text-xs font-black text-white"><FilterX size={14} /> Reset filters</button></div>
        ) : null}
      </div>
    )}
  </section>;
}

function LiveMatchFilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return <label className="block text-[10px] font-black uppercase tracking-[0.11em] text-[#718096]">{label}<select aria-label={`${label} filter`} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-xl border border-white/[0.1] bg-[#101925] px-3 text-xs font-black normal-case tracking-normal text-white outline-none transition focus:border-[#36d7ff]/55">{children}</select></label>;
}

function QueueFormPill({ result }: { result: "W" | "L" | null }) {
  const styles = result === "W"
    ? "bg-emerald-400/15 text-emerald-300"
    : result === "L"
      ? "bg-red-400/15 text-red-300"
      : "bg-white/[0.06] text-[#718096]";
  return <span className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${styles}`}>{result ?? "—"}</span>;
}

function LiveMatchRow({
  match,
  server,
  expanded,
  detail,
  onToggle,
  onRetry,
}: {
  match: ChinaStatsLiveMatch;
  server: ChinaStatsServerKey;
  expanded: boolean;
  detail?: DetailState;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const queueLabel = match.queue === "SOLO_DUO" ? "Solo / Duo" : "Flex";
  const resultLabel = match.result === "W" ? "WIN" : match.result === "L" ? "LOSS" : "N/A";
  const resultStyles = match.result === "W"
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-300"
    : match.result === "L"
      ? "border-red-300/25 bg-red-300/10 text-red-300"
      : "border-white/[0.1] bg-white/[0.04] text-[#a9b7ca]";

  return <article>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="grid w-full gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025] sm:grid-cols-[68px_minmax(160px,1.35fr)_110px_100px_minmax(130px,0.8fr)_24px] sm:items-center sm:px-5"
    >
      <span className={`inline-flex w-fit min-w-14 items-center justify-center rounded-lg border px-2 py-1.5 text-[11px] font-black ${resultStyles}`}>{resultLabel}</span>
      <span className="flex min-w-0 items-center gap-3">
        {match.championId ? <Image src={`/lol/champions/${match.championId}.png`} alt={match.champion} width={42} height={42} className="h-10 w-10 rounded-xl object-cover" /> : <span className="h-10 w-10 rounded-xl bg-white/[0.05]" />}
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-white">{match.champion}</span>
          {match.wasMvp || match.wasSvp ? <span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-black ${match.wasMvp ? "bg-amber-300/15 text-amber-200" : "bg-cyan-300/10 text-cyan-200"}`}>{match.wasMvp ? "MVP" : "SVP"}</span> : null}
        </span>
      </span>
      <span><span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#526176]">Role</span><span className="mt-1 block text-xs font-black text-[#c6d0df]">{match.role ?? "Role unavailable"}</span></span>
      <span><span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#526176]">Queue</span><span className="mt-1 block text-xs font-black text-[#c6d0df]">{queueLabel}</span></span>
      <span className="flex items-center gap-2 text-xs font-bold text-[#8290a4]"><Clock3 size={14} />{match.titleTime ?? "Time unavailable"}</span>
      <span className="text-[#718096]">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
    </button>
    {expanded ? <div className="border-t border-white/[0.06] bg-[#080d14] p-4 sm:p-5">
      {!detail || detail.status === "loading" ? <p role="status" className="flex items-center gap-2 text-sm font-bold text-[#8eeaff]"><Loader2 size={17} className="animate-spin" />Loading match details…</p> : detail.status === "unavailable" ? <div role="status" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-sm font-bold text-amber-100"><AlertTriangle size={17} />{detail.message}</p>{detail.retryable ? <button type="button" onClick={onRetry} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-100/25 px-3 text-xs font-black text-amber-100"><RefreshCw size={14} /> Retry match details</button> : null}</div> : <LiveScoreboard detail={detail.detail} server={server} />}
    </div> : null}
  </article>;
}

function LiveScoreboard({
  detail,
  server,
}: {
  detail: ChinaStatsLiveDetail;
  server: ChinaStatsServerKey;
}) {
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.11em] text-[#8eeaff]"><Swords size={16} />{detail.gameType.replaceAll("_", " ")}{detail.gameMode ? ` / ${detail.gameMode}` : ""}</p>
      <p className="text-[11px] font-bold text-[#64748b]">Full match scoreboard</p>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {detail.teams.map((team, index) => <div key={team.id} className="overflow-hidden rounded-2xl border border-white/[0.08]">
        <div className={`flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-[0.1em] ${team.result === "Win" ? "bg-emerald-400/10 text-emerald-200" : team.result === "Loss" ? "bg-red-400/[0.07] text-red-200" : "bg-white/[0.04] text-[#a9b7ca]"}`}><span>Team {index + 1}</span><span>{team.result}</span></div>
        <div className="divide-y divide-white/[0.05]">
          {team.players.map((player, playerIndex) => <div key={`${team.id}-${playerIndex}`} className={`grid grid-cols-[36px_minmax(100px,1fr)_80px_64px] items-center gap-2 px-3 py-2.5 text-xs ${player.searchedPlayer ? "bg-[#36d7ff]/[0.07]" : ""}`}>
            {player.championId ? <Image src={`/lol/champions/${player.championId}.png`} alt={player.champion} width={32} height={32} className="h-8 w-8 rounded-lg object-cover" /> : <span className="h-8 w-8 rounded-lg bg-white/[0.05]" />}
            <span className="min-w-0">
              <ScoreboardParticipantIdentity riotId={player.riotId} profileRiotId={player.profileRiotId} server={server} />
              <span className="mt-0.5 block truncate text-[10px] font-bold text-[#68778c]">{player.champion} / {player.role}</span>
            </span>
            <span className="font-black text-[#cbd5e1]">{player.kda ?? "—"}</span>
            <span className="text-right font-bold text-[#8290a4]">{player.gold === null ? "—" : `${(player.gold / 1000).toFixed(1)}k`}</span>
          </div>)}
        </div>
      </div>)}
    </div>
  </div>;
}

function ScoreboardParticipantIdentity({
  riotId,
  profileRiotId,
  server,
}: {
  riotId: string;
  profileRiotId: string | null;
  server: ChinaStatsServerKey;
}) {
  const href = chinaStatsParticipantProfileHref(profileRiotId, server);
  if (!href) return <span className="block truncate font-black text-white">{riotId}</span>;
  return <Link href={href} prefetch={false} className="block truncate font-black text-white underline decoration-[#36d7ff]/45 underline-offset-2 transition hover:text-[#8eeaff]">{profileRiotId}</Link>;
}

function chinaDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
