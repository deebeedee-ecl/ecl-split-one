import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "—";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatGold(gold?: number | null) {
  if (gold === null || gold === undefined) return "—";
  return `${(gold / 1000).toFixed(1)}k`;
}

function getWinnerName(
  winnerTeamId: string | null,
  homeTeamId: string,
  awayTeamId: string,
  homeName: string,
  awayName: string
) {
  if (!winnerTeamId) return "Draw / Unset";
  if (winnerTeamId === homeTeamId) return homeName;
  if (winnerTeamId === awayTeamId) return awayName;
  return "Unknown";
}

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

function TeamLogo({
  src,
  alt,
  size = 52,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-white/40"
        style={{ width: size, height: size }}
      >
        LOGO
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-full border border-white/10 bg-white/5"
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={`${size}px`}
      />
    </div>
  );
}

function StatPill({
  icon,
  value,
}: {
  icon: string;
  value: string | number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
      <span className="text-xs">{icon}</span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function FooterBadge({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "gold" | "standard";
}) {
  const styles =
    accent === "gold"
      ? "border-yellow-400/40 bg-yellow-400/15 text-yellow-300"
      : "border-white/10 bg-white/[0.04] text-white/60";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${styles}`}>
      <span className="text-[11px] font-black uppercase tracking-[0.18em]">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      games: {
        orderBy: {
          gameNumber: "asc",
        },
      },
    },
  });

  if (!match || !match.homeTeam || !match.awayTeam) {
    notFound();
  }

  const home = match.homeTeam;
  const away = match.awayTeam;

  const homeTag = getTeamTag(home.name);
  const awayTag = getTeamTag(away.name);

  const seriesWinner = getWinnerName(
    match.winnerTeamId,
    home.id,
    away.id,
    home.name,
    away.name
  );

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/results"
          className="mb-5 inline-flex items-center text-sm font-semibold text-white/60 transition hover:text-green-400"
        >
          ← Back to Results
        </Link>

        <div className="mb-6 rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_40px_rgba(0,255,150,0.08)]">
          <div className="relative min-h-[150px]">
            <div className="flex items-start justify-between gap-6">
              <div className="flex max-w-[340px] items-center gap-3">
                <TeamLogo src={home.logoUrl} alt={home.name} size={52} />
                <div>
                  <div className="max-w-[250px] text-base font-black uppercase leading-[1.05] tracking-[0.05em] text-white md:text-lg">
                    {home.name}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                    [{homeTag}] • Home
                  </div>
                </div>
              </div>

              <div className="flex max-w-[340px] items-center gap-3 text-right">
                <div>
                  <div className="max-w-[250px] text-base font-black uppercase leading-[1.05] tracking-[0.05em] text-white md:text-lg">
                    {away.name}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                    [{awayTag}] • Away
                  </div>
                </div>
                <TeamLogo src={away.logoUrl} alt={away.name} size={52} />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[11px] font-bold uppercase tracking-[0.26em] text-white/35">
                  BO{match.bestOf}
                </div>
                <div className="mt-1 text-5xl font-black tracking-tight text-white">
                  {match.homeScore} - {match.awayScore}
                </div>
                <div className="mt-1 text-sm font-bold text-white/75">
                  {seriesWinner}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {match.games.map((game) => {
            const winner = getWinnerName(
              game.winnerTeamId,
              home.id,
              away.id,
              home.name,
              away.name
            );

            return (
              <section
                key={game.id}
                className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
              >
                <div className="mx-auto max-w-[420px] border-b border-white/10 pb-3 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.26em] text-white/35">
                    Game {game.gameNumber} • {formatDuration(game.durationSeconds)}
                  </div>

                  <div className="mt-2 text-4xl font-black tracking-tight text-white">
                    {(game.homeKills ?? 0)} - {(game.awayKills ?? 0)}
                  </div>

                  <div className="mt-1 text-sm font-bold text-white/70">
                    [{homeTag}] <span className="text-white/35">vs</span> [{awayTag}]
                  </div>

                  <div className="mt-1 text-xs font-semibold text-green-400">
                    Winner: {winner}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-white/10 py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black uppercase tracking-[0.06em] text-white">
                      [{homeTag}]
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatPill icon="⚔️" value={game.homeKills ?? "—"} />
                      <StatPill icon="💰" value={formatGold(game.homeGold)} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatPill icon="⚔️" value={game.awayKills ?? "—"} />
                      <StatPill icon="💰" value={formatGold(game.awayGold)} />
                    </div>

                    <span className="text-2xl font-black uppercase tracking-[0.06em] text-white">
                      [{awayTag}]
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.2em] text-white/50">
                        <th className="w-[28%] px-3 py-3 text-left">Team</th>
                        <th className="w-[18%] px-2 py-3 text-center">Kills</th>
                        <th className="w-[14%] px-2 py-3 text-center">Gold</th>
                        <th className="w-[1%] px-0 py-3"></th>
                        <th className="w-[14%] px-2 py-3 text-center">Gold</th>
                        <th className="w-[18%] px-2 py-3 text-center">Kills</th>
                        <th className="w-[28%] px-3 py-3 text-right">Team</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr className="border-b border-white/[0.06] text-sm transition hover:bg-green-400/[0.06]">
                        <td className="truncate px-3 py-3 text-left text-[15px] font-semibold text-white">
                          [{homeTag}]
                        </td>

                        <td className="px-2 py-3 text-center text-[15px] font-bold tracking-wide text-white/90">
                          {game.homeKills ?? "—"}
                        </td>

                        <td className="px-2 py-3 text-center text-[16px] font-extrabold text-red-400">
                          {formatGold(game.homeGold)}
                        </td>

                        <td className="px-0 py-3">
                          <div className="mx-auto h-4 w-px bg-white/5" />
                        </td>

                        <td className="px-2 py-3 text-center text-[16px] font-extrabold text-sky-400">
                          {formatGold(game.awayGold)}
                        </td>

                        <td className="px-2 py-3 text-center text-[15px] font-bold tracking-wide text-white/90">
                          {game.awayKills ?? "—"}
                        </td>

                        <td className="truncate px-3 py-3 text-right text-[15px] font-semibold text-white">
                          [{awayTag}]
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
                  <FooterBadge
                    label="MVP"
                    value={game.mvpName || "Not set"}
                    accent="gold"
                  />

                  {game.notes ? (
                    <FooterBadge
                      label="Note"
                      value={game.notes}
                      accent="standard"
                    />
                  ) : (
                    <FooterBadge
                      label="Status"
                      value="Awaiting player OCR stats"
                      accent="standard"
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}