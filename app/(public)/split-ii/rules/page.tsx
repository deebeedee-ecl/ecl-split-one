import Link from "next/link";
import { ECL_TERMS_2026_10_16 } from "@/lib/tournaments/ecl-terms-2026-10-16";
import { SPLIT_II_FLOATER_RULES, SPLIT_II_FLOATER_RULES_VERSION, SPLIT_II_ORIGINAL_REGISTRATION_RULES, SPLIT_II_ORIGINAL_RULES_VERSION, SPLIT_II_REGISTRATION_RULES, SPLIT_II_RULES_VERSION, SPLIT_II_TERMS_VERSION } from "@/lib/tournaments/split-ii-config";

export const metadata = { title: "Split II registration rules & terms | ECL" };

export default function SplitTwoRulesPage() {
  return (
    <main className="min-h-screen bg-[#0b0c0f] px-5 py-12 text-[#eef1f8] sm:py-20">
      <article className="mx-auto max-w-3xl">
        <Link href="/split-ii" className="text-sm text-[#9cb0ff] underline underline-offset-4">Back to Split II registration</Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-widest text-[#dfbd73]">ECL / Split II / 2026</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Registration rules &amp; terms</h1>
        <p className="mt-5 text-sm leading-7 text-[#adb7cb]">These are the terms and registration rules shown when you sign up. We save the accepted versions and consent time with your entry.</p>
        <section className="mt-9 border border-[#30394a] bg-[#171c27] p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Split II registration rules</h2>
          <p className="mt-2 break-all text-xs text-[#adb7cb]">Version: {SPLIT_II_RULES_VERSION}</p>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-7 text-[#d0d7e5]">
            {SPLIT_II_REGISTRATION_RULES.map(rule => <li key={rule}>{rule}</li>)}
          </ol>
        </section>
        <section id="floaters" className="mt-9 scroll-mt-6 border border-[#30394a] bg-[#171c27] p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Subs / Floaters</h2>
          <p className="mt-2 break-all text-xs text-[#adb7cb]">Version: {SPLIT_II_FLOATER_RULES_VERSION}</p>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-7 text-[#d0d7e5]">{SPLIT_II_FLOATER_RULES.map(rule => <li key={rule}>{rule}</li>)}</ol>
        </section>
        <details className="mt-9 border border-[#30394a] p-6 text-sm leading-7 text-[#adb7cb]">
          <summary className="cursor-pointer text-[#eef1f8]">Original registration rules accepted before October 22</summary>
          <p className="mt-3 break-all text-xs">Version: {SPLIT_II_ORIGINAL_RULES_VERSION}. Previously saved consent records remain unchanged.</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5">{SPLIT_II_ORIGINAL_REGISTRATION_RULES.map(rule => <li key={rule}>{rule}</li>)}</ol>
        </details>
        <section id="ecl-terms" className="mt-10">
          <h2 className="text-2xl font-bold">ECL Terms &amp; Community Rules</h2>
          <p className="mt-2 break-all text-xs text-[#adb7cb]">Version: {SPLIT_II_TERMS_VERSION}</p>
          {ECL_TERMS_2026_10_16.map(section => <section key={section.number} className="mt-6 border-b border-[#30394a] pb-6">
            <h3 className="text-lg font-bold">{section.number}. {section.title}</h3>
            {section.body.map(paragraph => <p key={paragraph} className="mt-3 text-sm leading-7 text-[#b9c3d5]">{paragraph}</p>)}
          </section>)}
        </section>
      </article>
    </main>
  );
}
