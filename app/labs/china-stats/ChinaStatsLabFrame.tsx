import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, BarChart3, Server, Trophy } from "lucide-react";

export function ChinaStatsLabFrame({ children }: { children: ReactNode }) {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-[#070b12] text-[#edf3ff] [font-family:Inter,Arial,sans-serif]">
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#090e17]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1540px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/labs/china-stats/live"
            className="flex min-w-0 items-center gap-3 font-black tracking-[-0.03em] text-white"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#36d7ff]/30 bg-[#36d7ff]/10 text-[#36d7ff]">
              <BarChart3 size={20} />
            </span>
            <span className="truncate text-base sm:text-lg">CHINA STATS</span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] p-1 lg:flex">
            <Link href="/labs/china-stats/live" className="rounded-lg px-3 py-2 text-xs font-black text-[#8eeaff] transition hover:bg-[#36d7ff]/10">Player search</Link>
          </nav>

          <div className="ml-auto hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-amber-100 sm:flex">
            <Server size={14} /> Ionia · Super Server
          </div>
          <div className="hidden items-center gap-2 text-xs font-bold text-[#8190a8] md:flex">
            <Trophy size={15} className="text-emerald-400" /> Challenger to Master
          </div>
          <Link
            href="/hub/dashboard"
            className="ml-1 inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-xs font-black text-[#b7c3d8] transition hover:border-[#36d7ff]/40 hover:text-white"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">ECL Hub</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </div>
    </main>
  );
}
