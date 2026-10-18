"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Report = { id: string; label: string; gameId: string; completedAt: string; raw?: { participants?: { participantId: number; teamId: number; championId: number; stats?: Record<string, number> }[]; participantIdentities?: { participantId: number; player: { gameName?: string; tagLine?: string } }[] } };
export default function DesktopReviewPage() {
  const [reports, setReports] = useState<Report[]>([]), [selected, setSelected] = useState<Report | null>(null), [reason, setReason] = useState("");
  const [message, setMessage] = useState("Loading review queue…"), [busy, setBusy] = useState(false);
  async function load() {
    try { const response = await fetch("/api/admin/desktop-reports", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.message || "Could not load reports."); setReports(body.reports); setMessage(body.reports.length ? "Latest 20 uploads awaiting review." : "No uploads awaiting review."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Review unavailable."); }
  }
  useEffect(() => { void load(); }, []);
  async function open(id: string) {
    setBusy(true); setReason(""); setSelected(null);
    try { const response = await fetch(`/api/admin/desktop-reports?jobId=${encodeURIComponent(id)}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok || !body.reports?.[0]) throw new Error(body.message || "This upload is no longer awaiting review."); setSelected(body.reports[0]); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not open report."); }
    finally { setBusy(false); }
  }
  async function decide(decision: "reviewed" | "reject") {
    if (!selected || busy) return; setBusy(true);
    try {
      const response = await fetch("/api/admin/desktop-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: selected.id, decision, reason }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || "Review could not be saved.");
      setSelected(null); setReason(""); await load(); setMessage(decision === "reviewed" ? "Review recorded. No official result or LP was applied." : "Upload rejected. No LP changed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review could not be saved."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#080a0f] px-5 py-10 text-white"><div className="mx-auto max-w-6xl">
    <Link href="/admin" className="text-sm text-blue-300">← Admin dashboard</Link><h1 className="mt-6 text-3xl font-black">Hub match review</h1>
    <p className="mt-3 max-w-3xl leading-7 text-slate-400">Review uploaded custom matches. These actions record an administrator decision only. They do not create official match history, choose MVP/SVP or award LP.</p>
    <p role="status" className="my-6 rounded-lg border border-white/10 p-4 text-slate-300">{message}</p>
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]"><section className="space-y-3"><button disabled={busy} onClick={() => { void load(); }} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-50">Refresh queue</button>
      {reports.map(report => <button key={report.id} disabled={busy} onClick={() => { void open(report.id); }} className={`block w-full rounded-xl border p-4 text-left disabled:opacity-50 ${selected?.id === report.id ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-white/5"}`}><strong className="block">{report.label}</strong><span className="mt-1 block text-sm text-slate-400">Game {report.gameId}</span><time className="mt-2 block text-xs text-slate-400">{new Date(report.completedAt).toLocaleString("en-GB", { timeZone: "Asia/Shanghai" })} China time</time></button>)}</section>
      <section className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-5">{selected ? <><h2 className="text-xl font-bold">{selected.label} · {selected.gameId}</h2><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr>{["Side", "Player", "Champion", "K/D/A", "Damage", "Gold"].map(label => <th key={label} className="whitespace-nowrap p-2">{label}</th>)}</tr></thead><tbody>{selected.raw?.participants?.map(player => {
        const identity = selected.raw?.participantIdentities?.find(row => row.participantId === player.participantId)?.player;
        return <tr key={player.participantId} className="border-t border-white/10"><td className="p-2">{player.teamId === 100 ? "Blue" : "Red"}</td><td className="p-2">{identity?.gameName}#{identity?.tagLine}</td><td className="p-2">{player.championId}</td><td className="whitespace-nowrap p-2">{player.stats?.kills}/{player.stats?.deaths}/{player.stats?.assists}</td><td className="p-2">{player.stats?.totalDamageDealtToChampions?.toLocaleString()}</td><td className="p-2">{player.stats?.goldEarned?.toLocaleString()}</td></tr>;
      })}</tbody></table></div><label className="mt-6 block text-sm text-slate-300">Review note (required for rejection)<textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" /></label>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => { void decide("reviewed"); }} className="rounded-lg bg-blue-600 px-4 py-3 font-bold disabled:opacity-50">Mark reviewed · no LP</button><button disabled={busy || !reason.trim()} onClick={() => { void decide("reject"); }} className="rounded-lg border border-red-400/50 px-4 py-3 font-bold text-red-300 disabled:opacity-50">Reject upload</button></div></> : <p className="text-slate-400">Choose an upload to inspect all ten players.</p>}</section>
    </div></div></main>;
}
