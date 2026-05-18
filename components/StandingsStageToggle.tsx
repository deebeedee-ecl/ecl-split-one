"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { useState } from "react";

type StandingRow = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  played: number;
  points: number;
  gameW: number;
  gameL: number;
  diff: number;
};

type BracketTeam = {
  name: string;
  logoUrl: string | null;
  seed?: number;
};

type BracketMatch = {
  id: string;
  stage: "PLAYOFFS" | "SEMIFINALS" | "FINALS";
  stageLabel: string;
  slotLabel: string;
  homeTeam: BracketTeam | null;
  awayTeam: BracketTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerName: string | null;
  status: string;
  bestOf: number | null;
  scheduledLabel: string | null;
  isPlaceholder: boolean;
};

type Props = {
  standings: StandingRow[];
  bracketMatches: BracketMatch[];
};

function getRowClass(index: number, total: number) {
  if (index === 0) {
    return "bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-transparent";
  }

  if (index === 1) {
    return "bg-gradient-to-r from-zinc-300/20 via-zinc-200/10 to-transparent";
  }

  if (index === 2) {
    return "bg-gradient-to-r from-orange-500/20 via-orange-400/10 to-transparent";
  }

  if (index === total - 1 && total > 1) {
    return "bg-gradient-to-r from-red-900/40 via-red-800/20 to-transparent";
  }

  return "bg-white/[0.02]";
}

function getRankTextClass(index: number, total: number) {
  if (index === 0) return "text-yellow-300";
  if (index === 1) return "text-zinc-200";
  if (index === 2) return "text-orange-300";
  if (index === total - 1 && total > 1) return "text-red-300";
  return "text-zinc-400";
}

function TeamMark({ team }: { team: BracketTeam }) {
  if (team.logoUrl) {
    return (
      <Image
        src={team.logoUrl}
        alt={team.name}
        width={36}
        height={36}
        className="h-8 w-8 object-contain"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-[10px] font-black uppercase text-white/45">
      {team.name.slice(0, 3)}
    </div>
  );
}

function BracketTeamRow({
  team,
  score,
  isWinner,
  hasWinner,
}: {
  team: BracketTeam | null;
  score: number | null;
  isWinner: boolean;
  hasWinner: boolean;
}) {
  const isEliminated = Boolean(team && hasWinner && !isWinner);

  return (
    <div
      className={`grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2 ${
        isWinner
          ? "border-green-400/35 bg-green-500/10"
          : isEliminated
            ? "border-white/5 bg-black/30 opacity-45"
          : "border-white/10 bg-black/25"
      }`}
    >
      {team ? (
        <>
          <TeamMark team={team} />
          <div className="min-w-0">
            <div className="truncate text-sm font-black uppercase tracking-[0.04em] text-white">
              {team.name}
            </div>
            {team.seed && (
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Seed {team.seed}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="h-8 w-8 rounded-lg border border-dashed border-white/10 bg-white/[0.03]" />
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
            TBD
          </div>
        </>
      )}

      <div className="text-lg font-black text-white">
        {score == null ? "-" : score}
      </div>
    </div>
  );
}

function BracketCard({ match }: { match: BracketMatch }) {
  const homeWinner = Boolean(
    match.winnerName && match.homeTeam?.name === match.winnerName
  );
  const awayWinner = Boolean(
    match.winnerName && match.awayTeam?.name === match.winnerName
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_24px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-green-400">
            {match.slotLabel}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/40">
            {match.bestOf ? `BO${match.bestOf}` : "Series"} · {match.status}
          </div>
        </div>

        {match.isPlaceholder && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Seeded
          </span>
        )}
      </div>

      <div className="space-y-2">
        <BracketTeamRow
          team={match.homeTeam}
          score={match.homeScore}
          isWinner={homeWinner}
          hasWinner={Boolean(match.winnerName)}
        />
        <BracketTeamRow
          team={match.awayTeam}
          score={match.awayScore}
          isWinner={awayWinner}
          hasWinner={Boolean(match.winnerName)}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
        <span>{match.scheduledLabel || "Date not set"}</span>
        <span className="font-semibold text-white/60">
          Winner: {match.winnerName || "TBD"}
        </span>
      </div>
    </div>
  );
}

function StandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-zinc-950 px-6 py-12 text-center text-zinc-400 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
        No standings data yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
              <tr>
                <th className="px-6 py-5">#</th>
                <th className="px-6 py-5">Team</th>
                <th className="px-6 py-5 text-center">P</th>
                <th className="px-6 py-5 text-center">Game</th>
                <th className="px-6 py-5 text-center">Diff</th>
                <th className="px-6 py-5 text-center">Pts</th>
              </tr>
            </thead>

            <tbody>
              {standings.map((team, index) => (
                <tr
                  key={team.teamId}
                  className={`border-t border-white/10 transition hover:bg-white/[0.04] ${getRowClass(
                    index,
                    standings.length
                  )}`}
                >
                  <td
                    className={`px-6 py-5 text-3xl font-black ${getRankTextClass(
                      index,
                      standings.length
                    )}`}
                  >
                    {index + 1}
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black p-2 shadow-[0_0_10px_rgba(0,0,0,0.35)]">
                        {team.logoUrl ? (
                          <Image
                            src={team.logoUrl}
                            alt={team.teamName}
                            width={48}
                            height={48}
                            className="h-10 w-10 object-contain"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-xs font-black uppercase text-zinc-400">
                            {team.teamName.slice(0, 3)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-2xl font-black uppercase tracking-[0.08em] text-white">
                          {team.teamName}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 text-center text-lg font-bold text-white">
                    {team.played}
                  </td>

                  <td className="px-6 py-5 text-center text-lg font-bold text-white">
                    {team.gameW}-{team.gameL}
                  </td>

                  <td className="px-6 py-5 text-center text-lg font-bold text-white">
                    {team.diff > 0 ? `+${team.diff}` : team.diff}
                  </td>

                  <td className="px-6 py-5 text-center text-2xl font-black text-green-400">
                    {team.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
        <span className="font-semibold text-white">Scoring:</span> 2-0 win = 2
        points, 1-1 draw = 1 point each, 0-2 loss = 0 points.
      </div>
    </>
  );
}

function KnockoutBracket({ matches }: { matches: BracketMatch[] }) {
  const playoffMatches = matches.filter((match) => match.stage === "PLAYOFFS");
  const semifinalMatches = matches.filter(
    (match) => match.stage === "SEMIFINALS"
  );
  const finalMatches = matches.filter((match) => match.stage === "FINALS");

  return (
    <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-[0_0_40px_rgba(0,0,0,0.3)] md:p-6">
      <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
            Single Elimination
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.06em]">
            Knockout Stage
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Seeds open as 1 vs 6, 2 vs 5, and 3 vs 4. After that, the highest
            remaining seed moves straight to the final while the other two play
            the semifinal.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
          <Trophy size={15} />
          Split One
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.9fr_0.9fr]">
        <section>
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/45">
            Opening Round
          </div>
          <div className="grid gap-4">
            {playoffMatches.map((match) => (
              <BracketCard key={match.id} match={match} />
            ))}
          </div>
        </section>

        <section className="xl:pt-16">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/45">
            Semifinal
          </div>
          <div className="grid gap-4">
            {semifinalMatches.map((match) => (
              <BracketCard key={match.id} match={match} />
            ))}
          </div>
        </section>

        <section className="xl:pt-32">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/45">
            Final
          </div>
          <div className="grid gap-4">
            {finalMatches.map((match) => (
              <BracketCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function StandingsStageToggle({
  standings,
  bracketMatches,
}: Props) {
  const [view, setView] = useState<"standings" | "bracket">("standings");
  const showingBracket = view === "bracket";

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setView("standings")}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
              view === "standings"
                ? "bg-green-400 text-black"
                : "text-white/55 hover:text-white"
            }`}
          >
            Standings
          </button>
          <button
            type="button"
            onClick={() => setView("bracket")}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
              view === "bracket"
                ? "bg-green-400 text-black"
                : "text-white/55 hover:text-white"
            }`}
          >
            Knockout
          </button>
        </div>

        <button
          type="button"
          onClick={() => setView(showingBracket ? "standings" : "bracket")}
          aria-label={
            showingBracket ? "Show regular season standings" : "Show knockout stage"
          }
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 text-green-300 transition hover:border-green-400/50 hover:bg-green-500/15"
        >
          {showingBracket ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        </button>
      </div>

      <div className="overflow-hidden">
        <div
          className={`grid grid-cols-[100%_100%] transition-transform duration-500 ease-out ${
            showingBracket ? "-translate-x-full" : "translate-x-0"
          }`}
        >
          <div className="pr-0">
            <StandingsTable standings={standings} />
          </div>
          <div className="pl-0">
            <KnockoutBracket matches={bracketMatches} />
          </div>
        </div>
      </div>
    </section>
  );
}
