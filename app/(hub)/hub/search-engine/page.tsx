import { Search } from "lucide-react";
import { HubShell } from "../_components/HubShell";
import CustomGameFinderClient from "./CustomGameFinderClient";

export default function SearchEnginePage() {
  return (
    <HubShell
      active="finder"
      eyebrow="China server / read-only evidence"
      title="Custom game finder"
      description="Find a remembered Lzyumi custom game by exact Riot identity, approximate date, and optional champion or opponent clues."
    >
      <div className="mb-5 flex items-center gap-3 text-sm font-bold text-[#aeb5da]"><Search size={18} className="text-[#36D7FF]" />Use this before opening a tournament or ranked result workflow.</div>
      <CustomGameFinderClient />
    </HubShell>
  );
}
