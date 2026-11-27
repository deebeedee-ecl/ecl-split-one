import Link from "next/link";
import { ArrowLeft, Search, ShieldCheck } from "lucide-react";
import CustomGameFinderClient from "./CustomGameFinderClient";

export default function AdminGameFinderPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#b11226]">
              <ShieldCheck size={17} />
              Admin / read-only evidence
            </div>
            <h1 className="mt-3 text-4xl font-black uppercase tracking-normal text-white sm:text-5xl">
              Custom Game Finder
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#a9adb4]">
              Find a remembered Lzyumi custom game before starting a separately reviewed ranked or tournament result workflow.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#2b2b2b] bg-[#101010] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
          >
            <ArrowLeft size={16} />
            Admin Control Room
          </Link>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#242424] bg-[#101010] px-4 py-3 text-sm font-bold text-[#aeb5da]">
          <Search size={18} className="text-[#ff4058]" />
          Use this only for candidate discovery; it never imports a result or changes LP.
        </div>

        <CustomGameFinderClient />
      </div>
    </main>
  );
}
