import Image from "next/image";

const teams = [
  { tag: "MFG", logo: "/logos/mfg.png", gameW: 0, gameL: 0 },
  { tag: "NIU", logo: "/logos/niu.png", gameW: 0, gameL: 0 },
  { tag: "FLA", logo: "/logos/fla.png", gameW: 0, gameL: 0 },
  { tag: "BIY", logo: "/logos/biy.png", gameW: 0, gameL: 0 },
  { tag: "EB", logo: "/logos/eb.png", gameW: 0, gameL: 0 },
  { tag: "ZAF", logo: "/logos/zaf.png", gameW: 0, gameL: 0 },
];

// 🧠 BO2 points system
function getPoints(w: number, l: number) {
  if (w === 2) return 2;
  if (w === 1 && l === 1) return 1;
  return 0;
}

// 🧠 Build standings
const standings = teams
  .map((team) => {
    const points = getPoints(team.gameW, team.gameL);
    const diff = team.gameW - team.gameL;

    return {
      ...team,
      points,
      diff,
    };
  })
  .sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.diff - a.diff;
  });

// 🎨 Row styling
function getRowStyle(index: number, total: number) {
  if (index === 0) {
    return "bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-transparent border-yellow-400/40 shadow-[0_0_25px_rgba(250,204,21,0.15)]";
  }

  if (index === 1) {
    return "bg-gradient-to-r from-zinc-300/20 via-zinc-200/10 to-transparent border-zinc-300/40 shadow-[0_0_20px_rgba(200,200,200,0.12)]";
  }

  if (index === 2) {
    return "bg-gradient-to-r from-orange-500/20 via-orange-400/10 to-transparent border-orange-400/40 shadow-[0_0_20px_rgba(251,146,60,0.12)]";
  }

  if (index === total - 1) {
    return "bg-gradient-to-r from-red-900/50 via-red-800/25 to-transparent border-red-700/40 shadow-[0_0_25px_rgba(120,0,0,0.35)]";
  }

  return "bg-black/40 border-white/10";
}

export default function StandingsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <section className="border-b border-white/10 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Expat China League
          </p>

          <h1 className="mt-4 text-5xl font-black uppercase md:text-7xl">
            Standings
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-zinc-300">
            Teams are ranked by total points and game difference across the regular season. Every BO2 series contributes directly to the standings.
            <span className="ml-2 font-bold text-white">
             
            </span>
          </p>
        </div>
      </section>

      {/* TABLE */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
          
          {/* HEADER ROW */}
          <div className="grid grid-cols-[60px_1fr_140px_140px] border-b border-white/10 px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
            <div>#</div>
            <div>Team</div>
            <div className="text-center">Game</div>
            <div className="text-center">Pts</div>
          </div>

          {/* ROWS */}
          <div className="divide-y divide-white/5">
            {standings.map((team, index) => (
              <div
                key={team.tag}
                className={`relative grid grid-cols-[60px_1fr_140px_140px] items-center px-6 py-5 rounded-xl border ${getRowStyle(
                  index,
                  standings.length
                )} transition duration-300 hover:scale-[1.01] hover:bg-white/[0.04]`}
              >
                {/* subtle lighting overlay */}
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_50%)]" />

                {/* POSITION */}
                <div className="text-lg font-black text-zinc-400 relative">
                  {index + 1}
                </div>

                {/* TEAM */}
                <div className="flex items-center gap-4 relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-black p-2 shadow-[0_0_10px_rgba(0,0,0,0.4)]">
                    <Image
                      src={team.logo}
                      alt={team.tag}
                      width={48}
                      height={48}
                      className="h-10 w-10 object-contain"
                    />
                  </div>

                  <div className="text-2xl font-black uppercase tracking-[0.08em]">
                    {team.tag}
                  </div>
                </div>

                {/* GAME SCORE */}
                <div className="text-center text-lg font-bold text-white relative">
                  {team.gameW}-{team.gameL}
                </div>

                {/* POINTS */}
                <div className="text-center text-2xl font-black text-green-400 relative">
                  {team.points}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}