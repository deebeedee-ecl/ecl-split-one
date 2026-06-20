import { Search } from "lucide-react";
import { HubShell } from "../_components/HubShell";

export default function SearchPage() {
  return (
    <HubShell
      active="search"
      eyebrow="ECL.gg"
      title="Search"
      description="Player lookup, profile lookup, match history, champion stats, and inhouse performance search."
    >
      <section className="min-h-72 border border-white/[0.08] bg-[#191a1f] p-8 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
        <Search className="text-[#ff1728]" size={38} />
        <h2 className="mt-5 text-3xl font-black uppercase text-[#f2f2f2]">
          ECL.GG Search
        </h2>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[#a9adb4]">
          Ionia and Super Server search coverage is scheduled for the September
          2026 search release.
        </p>
      </section>
    </HubShell>
  );
}
