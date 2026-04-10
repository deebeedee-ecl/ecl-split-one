import { prisma } from "@/lib/prisma";
import { Great_Vibes } from "next/font/google";

export const dynamic = "force-dynamic";

const signatureFont = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
});

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  currentRank?: string;
  rank?: string;
  primaryRole?: string;
  secondaryRole?: string;
};

const accentThemes = [
  {
    badge: "border-green-400/30 bg-green-400/10 text-green-300",
    captain: "border-green-400/20 bg-green-400/10",
    slot: "border-green-400/20 bg-green-400/10 text-green-300",
    hover:
      "hover:border-green-400/35 hover:shadow-[0_18px_60px_rgba(74,222,128,0.16)]",
  },
  {
    badge: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    captain: "border-cyan-400/20 bg-cyan-400/10",
    slot: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    hover:
      "hover:border-cyan-400/35 hover:shadow-[0_18px_60px_rgba(34,211,238,0.16)]",
  },
  {
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
    captain: "border-violet-400/20 bg-violet-400/10",
    slot: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    hover:
      "hover:border-violet-400/35 hover:shadow-[0_18px_60px_rgba(167,139,250,0.16)]",
  },
];

function getTeamTag(teamName: string) {
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "ECL";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();

  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function TeamsPage() {
  const [teams, savedTeams] = await Promise.all([
    prisma.teamRegistration.findMany({
      where: { status: "approved" },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.team.findMany({
      select: { name: true, logoUrl: true, kitUrl: true },
    }),
  ]);

  const savedTeamMap = new Map(
    savedTeams.map((t) => [cleanText(t.name).toLowerCase(), t])
  );

  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl space-y-10">
        <div>
          <h1 className="text-5xl font-black uppercase md:text-7xl">Teams</h1>
        </div>

        <div className="space-y-8">
          {teams.map((team, i) => {
            const accent = accentThemes[i % accentThemes.length];
            const teamTag = getTeamTag(team.teamName);

            const saved = savedTeamMap.get(
              cleanText(team.teamName).toLowerCase()
            );

            const logoUrl = saved?.logoUrl || "";
            const kitUrl = saved?.kitUrl || "";

            const players = Array.isArray(team.players)
              ? (team.players as TeamPlayer[])
              : [];

            return (
              <article
                key={team.id}
                className={`rounded-3xl border border-white/10 bg-zinc-900 transition ${accent.hover}`}
              >
                <div className="grid lg:grid-cols-[1.35fr_1fr]">
                  <div className="p-8">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                        Team Identity
                      </p>

                      <h2 className="mt-4 text-4xl font-black uppercase leading-none md:text-6xl">
                        {team.teamName}
                      </h2>

                      <div
                        className={`mt-4 inline-block rounded-md border px-3 py-1 text-xs font-bold ${accent.badge}`}
                      >
                        {teamTag}
                      </div>
                    </div>

                    <div className={`mt-8 rounded-xl p-5 ${accent.captain}`}>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                        Captain
                      </p>
                      <p className="mt-2 text-lg font-bold">{team.captainName}</p>
                    </div>

                    <div className="mt-8 space-y-4">
                      {players.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-4"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-black ${accent.slot}`}
                            >
                              P{idx + 1}
                            </div>

                            <div>
                              <p className="text-lg font-semibold text-white">
                                {p.playerName || p.name || "Player"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
                            {p.currentRank || p.rank || "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start justify-center bg-black p-8">
                    <div className="w-full max-w-md">
                      <div className="mb-8 flex justify-center">
                        <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/80 shadow-[0_20px_60px_rgba(0,0,0,0.65)] md:h-32 md:w-32">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={`${team.teamName} logo`}
                              className="h-full w-full object-contain p-3"
                            />
                          ) : (
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                              No Logo
                            </span>
                          )}
                        </div>
                      </div>

                      {kitUrl ? (
                        <div className="relative">
                          <div className="rounded-[28px] border border-amber-300/20 bg-zinc-950 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.85)]">
                            <div className="rounded-[22px] border border-amber-200/10 bg-zinc-900 p-3">
                              <div className="rounded-[18px] border border-white/6 bg-black p-6">
                                <div className="flex items-center justify-center bg-black">
                                  <img
                                    src={kitUrl}
                                    alt={`${team.teamName} kit`}
                                    className="max-h-[360px] w-auto object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_70px_rgba(245,158,11,0.05)]" />

                          <div className="mt-6 text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/35">
                              Signed by Captain
                            </p>

                            <p
                              className={`${signatureFont.className} mt-3 text-4xl leading-none text-white/85 md:text-5xl`}
                            >
                              {team.captainName}
                            </p>

                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/25">
                              Official ECL Signature
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950 p-10 text-center text-white/40">
                          No Kit
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}