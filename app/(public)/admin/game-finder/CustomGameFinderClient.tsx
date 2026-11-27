"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Copy, Loader2, Search } from "lucide-react";
import { fetchLzyumiBrowserResponse } from "@/lib/lzyumi-browser-contract";
import {
  evaluateFinderCandidate,
  LZYUMI_FINDER_FILTERS,
  selectFinderHistoryCandidates,
  verifyFinderIdentity,
  type FinderCandidate,
  type FinderDetail,
  type FinderHistoryGame,
} from "@/lib/lzyumi-custom-game-finder";
import { loadChampionNames } from "@/lib/lzyumi-display";
import { splitRiotId } from "@/lib/riot-id";

const CHINA_SERVERS = [
  { id: 1, label: "Ionia / \u827e\u6b27\u5c3c\u4e9a" },
  { id: 14, label: "Black Rose / \u9ed1\u8272\u73ab\u7470" },
  { id: 31, label: "Super Server / \u5ce1\u8c37\u4e4b\u5dc5" },
  { id: 30, label: "Baron Nashor / \u7537\u7235\u9886\u57df" },
  { id: 3, label: "Zaun / \u7956\u5b89" },
  { id: 4, label: "Noxus / \u8bfa\u514b\u8428\u65af" },
  { id: 16, label: "Shurima / \u6055\u745e\u739b" },
];

type LookupResponse = {
  battleInfo?: { nameInfoNew?: string; openId?: string; areaId?: number } | null;
  data?: FinderHistoryGame[] | null;
};

async function signedUrl(parameters: URLSearchParams) {
  const response = await fetch(`/api/lzyumi-sign?${parameters.toString()}`, { cache: "no-store" });
  const body = await response.json().catch(() => null) as { url?: unknown } | null;
  if (!response.ok || typeof body?.url !== "string") throw new Error("ECL could not create a short-lived Lzyumi request.");
  return body.url;
}

async function mapWithConcurrency<T, R>(values: readonly T[], concurrency: number, run: (value: T) => Promise<R>) {
  const results: R[] = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await run(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function chinaTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function CustomGameFinderClient() {
  const [riotId, setRiotId] = useState("");
  const [areaId, setAreaId] = useState(1);
  const [targetDate, setTargetDate] = useState("");
  const [dayWindow, setDayWindow] = useState(1);
  const [primaryChampion, setPrimaryChampion] = useState("");
  const [opponentRiotId, setOpponentRiotId] = useState("");
  const [opponentChampion, setOpponentChampion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<FinderCandidate[]>([]);
  const [summary, setSummary] = useState<{ history: number; details: number; failedDetails: number } | null>(null);
  const [copied, setCopied] = useState("");

  async function search() {
    const expected = splitRiotId(riotId);
    if (!expected.riotName || !expected.riotTag) {
      setError("Enter the exact full Riot ID, including #tag.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setError("Choose the approximate China date of the game.");
      return;
    }
    if (opponentChampion.trim() && !splitRiotId(opponentRiotId).riotTag) {
      setError("Add the opponent's full Riot ID when using an opponent champion clue.");
      return;
    }
    if (opponentRiotId.trim() && !splitRiotId(opponentRiotId).riotTag) {
      setError("Enter the opponent's exact full Riot ID, including #tag.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);
    setSummary(null);
    setCopied("");
    try {
      const attempts = [expected.riotName, `${expected.riotName}#${expected.riotTag}`];
      let verified: ReturnType<typeof verifyFinderIdentity> | null = null;
      for (const nickname of attempts) {
        try {
          const url = await signedUrl(new URLSearchParams({ nickname, areaId: String(areaId), filter: "1", allCount: "20" }));
          const response = await fetchLzyumiBrowserResponse(url, "profile") as LookupResponse;
          verified = verifyFinderIdentity(response, riotId, areaId);
          break;
        } catch {
          // Bare-name and full-ID attempts are deliberately separate and bounded.
        }
      }
      if (!verified) throw new Error("Lzyumi could not verify that exact Riot ID on the selected server. Check spelling, tag, and server.");

      const historyResponses = await mapWithConcurrency(
        LZYUMI_FINDER_FILTERS.filter(filter => filter !== 1),
        2,
        async filter => {
          try {
            const url = await signedUrl(new URLSearchParams({ openId: verified!.openId, areaId: String(areaId), filter: String(filter), allCount: "20" }));
            return await fetchLzyumiBrowserResponse(url, "history") as LookupResponse;
          } catch {
            return null;
          }
        },
      );
      const history = [verified.history, ...historyResponses.map(response => response?.data ?? [])].flat();
      const candidates = selectFinderHistoryCandidates(history, targetDate, dayWindow);
      if (!candidates.length) throw new Error("No dated Lzyumi history rows were found in that window. Widen the date window or verify the server.");

      const championNames = await loadChampionNames().catch(() => new Map<string, string>());
      const found: FinderCandidate[] = [];
      let failedDetails = 0;
      for (const candidate of candidates) {
        try {
          const url = await signedUrl(new URLSearchParams({ type: "detail", openId: verified.openId, gameId: candidate.game.gameId, areaId: String(areaId) }));
          const detail = await fetchLzyumiBrowserResponse(url, "detail") as FinderDetail;
          const result = evaluateFinderCandidate({ game: candidate.game, detail, targetDate, primaryRiotId: riotId, primaryOpenId: verified.openId, primaryChampion, opponentRiotId, opponentChampion, championNames });
          if (result) found.push(result);
        } catch {
          failedDetails += 1;
        }
      }
      found.sort((a, b) => b.score - a.score || Date.parse(b.playedAt) - Date.parse(a.playedAt));
      setSummary({ history: history.length, details: candidates.length, failedDetails });
      setResults(found);
      if (!found.length) throw new Error("The dated rows were checked, but none was a verified custom game for that exact Riot identity.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The read-only lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyGameId(gameId: string) {
    await navigator.clipboard.writeText(gameId);
    setCopied(gameId);
  }

  return (
    <div className="grid gap-5">
      <section className="border border-white/[0.1] bg-[#17191f] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.28)] sm:p-6">
        <div className="flex items-start gap-3 border border-[#36D7FF]/25 bg-[#071d35] p-4 text-sm font-semibold leading-6 text-[#b9eaff]">
          <Search className="mt-0.5 shrink-0" size={19} />
          <p>This tool is read-only. It uses short-lived signed URLs in your browser, creates no ECL match or tournament record, and never submits or publishes a result.</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Player full Riot ID" hint="Required; exact name and tag."><input value={riotId} onChange={event => setRiotId(event.target.value)} placeholder="Name#Tag" /></Field>
          <Field label="China server"><select value={areaId} onChange={event => setAreaId(Number(event.target.value))}>{CHINA_SERVERS.map(server => <option key={server.id} value={server.id}>{server.label}</option>)}</select></Field>
          <Field label="Approximate China date"><input type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></Field>
          <Field label="Date window"><select value={dayWindow} onChange={event => setDayWindow(Number(event.target.value))}><option value={0}>Exact date</option><option value={1}>Plus/minus 1 day</option><option value={3}>Plus/minus 3 days</option></select></Field>
          <Field label="Player champion clue" hint="Optional name or numeric champion ID."><input value={primaryChampion} onChange={event => setPrimaryChampion(event.target.value)} placeholder="Jayce or 126" /></Field>
          <Field label="Opponent full Riot ID" hint="Optional; improves ranking."><input value={opponentRiotId} onChange={event => setOpponentRiotId(event.target.value)} placeholder="Name#Tag" /></Field>
          <Field label="Opponent champion clue" hint="Optional; requires opponent Riot ID."><input value={opponentChampion} onChange={event => setOpponentChampion(event.target.value)} placeholder="Malphite or 54" /></Field>
        </div>
        <button type="button" onClick={() => void search()} disabled={loading} className="mt-5 inline-flex min-h-12 items-center gap-2 bg-[#0755C9] px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#0797F2] disabled:cursor-wait disabled:opacity-60">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
          {loading ? "Checking bounded history" : "Find custom games"}
        </button>
      </section>

      {error && <p role="alert" className="flex items-start gap-3 border border-red-400/30 bg-red-950/45 p-4 text-sm font-bold text-red-100"><AlertTriangle className="mt-0.5 shrink-0" size={18} />{error}</p>}
      {summary && <p className="text-sm font-semibold text-[#aeb5da]">Read-only scan: {summary.history} history rows collected, {summary.details} bounded details checked, {summary.failedDetails} detail requests unavailable. Provider failures are not treated as empty history.</p>}

      {results.map((result, index) => {
        const teams = new Map<string, FinderCandidate["participants"]>();
        for (const participant of result.participants) {
          teams.set(participant.teamId, [...(teams.get(participant.teamId) ?? []), participant]);
        }
        return <article key={result.gameId} className="border border-white/[0.1] bg-[#17191f] p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#36D7FF]">Candidate {index + 1} / score {result.score}</p><h2 className="mt-2 text-2xl font-black text-white">{chinaTime(result.playedAt)} China time</h2><p className="mt-2 text-sm font-semibold text-[#aeb5da]">{result.gameType}{result.gameMode ? ` / ${result.gameMode}` : ""}{result.mapId ? ` / map ${result.mapId}` : ""}{result.durationSeconds ? ` / ${Math.floor(result.durationSeconds / 60)}m ${result.durationSeconds % 60}s` : ""}</p></div>
            <div className="border border-white/[0.1] bg-black/25 p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f98c0]">Private provider game ID</p><div className="mt-2 flex items-center gap-2"><code className="break-all text-sm text-white">{result.gameId}</code><button type="button" onClick={() => void copyGameId(result.gameId)} aria-label={`Copy game ID ${result.gameId}`} className="p-2 text-[#36D7FF] hover:bg-white/[0.06]">{copied === result.gameId ? <CheckCircle2 size={17} /> : <Copy size={17} />}</button></div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.08em]">
            <Clue label="Custom detail" matched />
            <Clue label="Player champion" matched={result.clues.primaryChampion} />
            <Clue label="Opponent found" matched={result.clues.opponentFound} />
            <Clue label="Opposing team" matched={result.clues.opponentOnOtherTeam} />
            <Clue label="Opponent champion" matched={result.clues.opponentChampion} />
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">{Array.from(teams.entries()).map(([teamId, participants]) => <div key={teamId} className="border border-white/[0.08] bg-black/20 p-4"><h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#8f98c0]">Team {teamId || "unknown"}</h3><ul className="mt-3 grid gap-2">{participants.map(player => <li key={player.riotId} className={`flex flex-col gap-1 border-l-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${player.primary ? "border-[#36D7FF] bg-[#0755C9]/15" : player.opponent ? "border-[#ff5b68] bg-red-950/20" : "border-white/10"}`}><span className="font-bold text-white">{player.riotId}{player.primary ? " / searched player" : player.opponent ? " / opponent clue" : ""}</span><span className="text-[#aeb5da]">{player.champion}{player.role ? ` / ${player.role}` : ""}{player.kda ? ` / ${player.kda}` : ""}</span></li>)}</ul></div>)}</div>
        </article>;
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="grid content-start gap-2 text-sm font-bold text-white"><span>{label}</span>{hint && <small className="font-semibold text-[#8f98c0]">{hint}</small>}<span className="[&_input]:min-h-12 [&_input]:w-full [&_input]:border [&_input]:border-white/[0.12] [&_input]:bg-[#0d0f14] [&_input]:px-3 [&_input]:text-white [&_input]:outline-none [&_input]:focus:border-[#36D7FF] [&_select]:min-h-12 [&_select]:w-full [&_select]:border [&_select]:border-white/[0.12] [&_select]:bg-[#0d0f14] [&_select]:px-3 [&_select]:text-white [&_select]:outline-none [&_select]:focus:border-[#36D7FF]">{children}</span></label>;
}

function Clue({ label, matched }: { label: string; matched: boolean | null }) {
  const className = matched === true ? "border-emerald-400/30 bg-emerald-950/45 text-emerald-200" : matched === false ? "border-amber-400/30 bg-amber-950/45 text-amber-100" : "border-white/[0.1] bg-white/[0.04] text-[#8f98c0]";
  return <span className={`border px-3 py-2 ${className}`}>{label}: {matched === true ? "match" : matched === false ? "not matched" : "not requested"}</span>;
}
