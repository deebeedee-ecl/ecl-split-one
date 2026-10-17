import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import BroadcastType from "./BroadcastType";

export const metadata: Metadata = {
  title: "ECL SPLIT II | Expat China League",
  description: "Log into the ECL Hub to sign up for Split II. 30 places, random team draw and a 3,000 RMB first prize.",
  robots: { index: false, follow: false },
};

export default function SplitTwoPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#0b0c0f] text-[#eef1f8]">
      <section className="bg-[#0035f8] px-6 py-12 sm:py-16" aria-labelledby="split-ii-title">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">Expat China League / 2026</p>
          <h1 id="split-ii-title" className="mt-8 max-w-3xl"><BroadcastType text="ECL SPLIT II" className="block h-auto w-full" /></h1>
          <p className="mt-8 text-sm font-black italic tracking-wide">AGAINST ALL ODDS</p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-6 py-12 sm:py-16" aria-labelledby="hub-signup-title">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#dfbd73]">30 players / Random team draw / 3,000 RMB first prize</p>
        <h2 id="hub-signup-title" className="mt-5 max-w-2xl text-4xl uppercase leading-tight sm:text-5xl [font-family:Anton,Impact,sans-serif]">Log into the Hub to sign up.</h2>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[#adb7cb]">Use your ECL account to enter Split II from the Hub dashboard. Review and accept the tournament rules and Terms of Service to confirm your entry. Your role comes from your ECL profile.</p>
        <div className="mt-6 flex max-w-2xl items-start gap-3 text-sm leading-6 text-[#c5cede]"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#dfbd73]" /><p>Your ECL profile must be active and verified through KOOK before you can register.</p></div>
        <Link href="/hub/dashboard" className="mt-8 inline-flex min-h-12 items-center justify-center gap-4 rounded-sm bg-[#0035f8] px-6 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#0028c2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8ca3ff]">Log into the Hub <ArrowRight size={18} /></Link>
        <Link href="/split-ii/rules" className="mt-5 block w-fit text-sm text-[#a9bbff] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8ca3ff]">Read the tournament rules and Terms of Service</Link>
        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-[#2a303e] pt-7 sm:grid-cols-4">
          {[
            ["Draft day", "23 October"],
            ["Play begins", "24 October"],
            ["Finals", "20 November"],
            ["Team selection", "Random draw"],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-[#929fb5]">{label}</dt><dd className="mt-2 text-base font-bold">{value}</dd></div>)}
        </dl>
      </section>
    </main>
  );
}
