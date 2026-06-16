import Image from "next/image";
import Link from "next/link";
import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value?: Date | null) {
  if (!value) return "Date not set";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getWinnerDisplay(match: {
  status: MatchStatus;
  bestOf: number;
  homeScore: number;
  awayScore: number;
  winnerTeam?: { name: string } | null;
}) {
  if (match.winnerTeam?.name) return match.winnerTeam.name;

  if (
    match.status === "COMPLETED" &&
    match.bestOf === 2 &&
    match.homeScore === match.awayScore
  ) {
    return "Draw";
  }

  return "-";
}

function getTeamTag(name: string) {
  const words = name
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  return name.replace(/[^\w]/g, "").slice(0, 3).toUpperCase();
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
        className="flex shrink-0 items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-[10px] font-black uppercase tracking-[0.12em] text-[#9ca3af]"
        style={{ width: size, height: size }}
      >
        {getTeamTag(alt)}
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d]"
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill className="object-contain p-2" sizes={`${size}px`} />
    </div>
  );
}

export default async function ResultsPage() {
  const [scheduledMatches, completedMatches] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: "SCHEDULED",
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
      orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.match.findMany({
      where: {
        status: {
          in: ["COMPLETED", "FORFEIT"],
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
        games: {
          orderBy: {
            gameNumber: "asc",
          },
        },
      },
      orderBy: [{ scheduledAt: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate overflow-hidden border-b border-[#1f1f1f] px-4 py-16 sm:px-6">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.18),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(177,18,38,0.16),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/tournaments/split-one"
            className="inline-flex items-center border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af] transition hover:border-[#b11226] hover:text-white"
          >
            Back to Split One Archive
          </Link>

          <p className="mt-10 text-sm font-black uppercase tracking-[0.25em] text-[#b11226]">
            Split One Archive
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-none [font-family:Anton,Impact,Arial_Black,Arial,sans-serif] md:text-7xl">
            Results
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#9ca3af]">
            Match history and result cards in the new archive theme. Full match
            pages route back to the Split One archive.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <SectionHeader title="Scheduled Matches" eyebrow="Upcoming" />

        {scheduledMatches.length === 0 ? (
          <EmptyState>No scheduled matches yet.</EmptyState>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {scheduledMatches.map((match) => (
              <MatchCard
                key={match.id}
                href="/schedule"
                home={match.homeTeam}
                away={match.awayTeam}
                score="VS"
                meta={`${match.roundLabel || "Match"} - BO${match.bestOf}`}
                status="Scheduled"
                footer={formatDate(match.scheduledAt)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <SectionHeader title="Completed Results" eyebrow="Archive" />

        {completedMatches.length === 0 ? (
          <EmptyState>No completed results yet.</EmptyState>
        ) : (
          <div className="mt-6 grid gap-4">
            {completedMatches.map((match) => (
              <MatchCard
                key={match.id}
                href={`/matches/${match.id}`}
                home={match.homeTeam}
                away={match.awayTeam}
                score={`${match.homeScore} - ${match.awayScore}`}
                meta={`${match.roundLabel || "Match"} - BO${match.bestOf}`}
                status={match.status === "FORFEIT" ? "Forfeit" : "Final"}
                footer={`Winner: ${getWinnerDisplay(match)} - ${match.games.length} game${
                  match.games.length === 1 ? "" : "s"
                }`}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-4xl font-black uppercase leading-none [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
        {title}
      </h2>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="mt-6 border border-[#1f1f1f] bg-[#0d0d0d] p-8 text-center text-[#9ca3af]">
      {children}
    </div>
  );
}

function MatchCard({
  href,
  home,
  away,
  score,
  meta,
  status,
  footer,
}: {
  href: string;
  home: { name: string; logoUrl: string | null };
  away: { name: string; logoUrl: string | null };
  score: string;
  meta: string;
  status: string;
  footer: string;
}) {
  return (
    <Link
      href={href}
      className="grid gap-4 border border-[#1f1f1f] bg-[#0d0d0d] p-4 transition hover:border-[#b11226] md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_12rem] md:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <TeamLogo src={home.logoUrl} alt={home.name} size={46} />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9ca3af]">
            {getTeamTag(home.name)}
          </p>
          <p className="truncate font-black text-white">{home.name}</p>
        </div>
      </div>

      <div className="flex h-12 items-center justify-center border border-[#1f1f1f] bg-black/30 text-center text-2xl font-black text-white">
        {score}
      </div>

      <div className="flex min-w-0 items-center gap-3 md:justify-end md:text-right">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9ca3af]">
            {getTeamTag(away.name)}
          </p>
          <p className="truncate font-black text-white">{away.name}</p>
        </div>
        <TeamLogo src={away.logoUrl} alt={away.name} size={46} />
      </div>

      <div className="text-xs uppercase tracking-[0.14em] text-[#9ca3af] md:text-right">
        <p className="font-black text-[#b11226]">{status}</p>
        <p className="mt-1">{meta}</p>
        <p className="mt-1 normal-case tracking-normal">{footer}</p>
      </div>
    </Link>
  );
}
