"use client";

type LeagueWireItem = {
  id: string;
  text: string;
  href: string | null;
};

type LeagueWireTickerProps = {
  items: LeagueWireItem[];
};

export default function LeagueWireTicker({
  items,
}: LeagueWireTickerProps) {
  if (!items.length) return null;

  const doubledItems = [...items, ...items];

  return (
    <div className="mb-14 overflow-hidden rounded-2xl border border-green-400/20 bg-zinc-950/80 shadow-[0_0_30px_rgba(74,222,128,0.06)]">
      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className="flex items-center border-b border-green-400/10 bg-green-500/10 px-4 py-3 md:min-w-[220px] md:border-b-0 md:border-r">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.95)]" />
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-green-300 sm:text-sm">
              League Wire
            </span>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-zinc-950 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-zinc-950 to-transparent" />

          <div className="league-wire-track whitespace-nowrap py-3 hover:[animation-play-state:paused]">
            {doubledItems.map((item, index) =>
              item.href ? (
                <a
                  key={`${item.id}-${index}`}
                  href={item.href}
                  className="inline-flex items-center px-6 text-sm text-zinc-200 transition hover:text-white sm:text-base"
                >
                  <span className="mr-4 inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                  {item.text}
                </a>
              ) : (
                <span
                  key={`${item.id}-${index}`}
                  className="inline-flex items-center px-6 text-sm text-zinc-200 sm:text-base"
                >
                  <span className="mr-4 inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                  {item.text}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .league-wire-track {
          display: inline-block;
          min-width: max-content;
          animation: leagueTicker 36s linear infinite;
          will-change: transform;
        }

        @keyframes leagueTicker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}