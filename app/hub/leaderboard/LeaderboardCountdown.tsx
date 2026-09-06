"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function LeaderboardCountdown({ nextUpdateAt }: { nextUpdateAt: string }) {
  const [display, setDisplay] = useState("...");

  useEffect(() => {
    function tick() {
      const nextUpdate = new Date(nextUpdateAt).getTime();
      const diff = nextUpdate - Date.now();

      if (diff <= 0) {
        setDisplay("updating soon");
        return;
      }

      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${pad(h)}h ${pad(m)}m ${pad(s)}s`);
    }

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [nextUpdateAt]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#36D7FF]/18 bg-[#061C4A] px-3 py-2 text-xs font-black tracking-[0.12em] text-[#C9DFEB]">
      <RefreshCw size={11} className="shrink-0 opacity-60" />
      <span className="uppercase">Next update</span>
      <span className="text-[#77CFFF]">{display}</span>
    </div>
  );
}
