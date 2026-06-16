"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Shield, Trophy } from "lucide-react";
import type { KnockoutMatchConfig } from "@/lib/knockout-bracket";
import type { LockedStandingRow } from "@/lib/locked-standings";

type EloLeaderboardRow = {
  id: string;
  name: string;
  riotLine: string | null;
  teamName: string;
  teamLogoUrl: string | null;
  elo: number;
  games: number;
  wins: number;
  kda: string;
  mvps: number;
  svps?: number;
};

type SlideId = "table" | "bracket" | "elo";

const slides: Array<{ id: SlideId; label: string; title: string; eyebrow: string; description: string }> = [
  {
    id: "table",
    label: "League Table",
    eyebrow: "Regular Season",
    title: "League Table",
    description: "Locked Split One standings ranked by points, game record, and game difference.",
  },
  {
    id: "bracket",
    label: "Knockouts",
    eyebrow: "Knockouts",
    title: "Bracket Path",
    description: "Archived playoff path from quarterfinals through the championship final.",
  },
  {
    id: "elo",
    label: "ELO Leaderboard",
    eyebrow: "Player Ranking",
    title: "ELO Leaderboard",
    description: "Split One player list ordered by current ELO with tournament stat context.",
  },
];

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

function AwardStars({ mvps = 0, svps = 0 }: { mvps?: number; svps?: number }) {
  if (mvps <= 0 && svps <= 0) {
    return <span className="text-[#4b5563]">-</span>;
  }

  return (
    <span className="inline-flex items-center justify-center gap-1 text-lg leading-none">
      {mvps > 0 && (
        <span
          className="text-[#f5c542] drop-shadow-[0_0_8px_rgba(245,197,66,0.35)]"
          aria-label={`${mvps} MVP gold stars`}
          title={`${mvps} MVP`}
        >
          {"★".repeat(mvps)}
        </span>
      )}
      {svps > 0 && (
        <span
          className="text-[#c7cbd1] drop-shadow-[0_0_8px_rgba(199,203,209,0.25)]"
          aria-label={`${svps} SVP silver stars`}
          title={`${svps} SVP`}
        >
          {"★".repeat(svps)}
        </span>
      )}
    </span>
  );
}

function TeamLogo({
  src,
  alt,
  size = 46,
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

function BracketTeam({
  team,
  score,
  winner,
}: {
  team: { name: string; logoUrl: string | null; seed?: number } | null;
  score: number | null;
  winner: string | null;
}) {
  const isWinner = Boolean(team?.name && winner === team.name);

  return (
    <div
      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border p-3 ${
        isWinner
          ? "border-[#b11226] bg-[#b11226]/10"
          : "border-[#1f1f1f] bg-black/25"
      }`}
    >
      <TeamLogo src={team?.logoUrl} alt={team?.name ?? "TBC"} size={40} />
      <div className="min-w-0">
        <p className="truncate font-black text-white">{team?.name ?? "TBC"}</p>
        <p className="text-xs uppercase tracking-[0.14em] text-[#9ca3af]">
          {team?.seed ? `Seed ${team.seed}` : "Slot"}
        </p>
      </div>
      <span className="text-xl font-black text-white">{score ?? "-"}</span>
    </div>
  );
}

export function SplitOneArchiveCarousel({
  standings,
  bracketMatches,
  eloLeaderboard,
}: {
  standings: LockedStandingRow[];
  bracketMatches: KnockoutMatchConfig[];
  eloLeaderboard: EloLeaderboardRow[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAllElo, setShowAllElo] = useState(false);
  const activeSlide = slides[activeIndex];

  const visibleElo = useMemo(
    () => (showAllElo ? eloLeaderboard : eloLeaderboard.slice(0, 12)),
    [eloLeaderboard, showAllElo]
  );

  function move(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section className="border-b border-[#1f1f1f] bg-[#080808]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
              {activeSlide.eyebrow}
            </p>
            <h2 className="mt-3 text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              {activeSlide.title}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#9ca3af]">
              {activeSlide.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af] sm:block">
              {activeIndex + 1} / {slides.length}
            </div>
            <button
              type="button"
              onClick={() => move(-1)}
              className="flex size-12 items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
              aria-label="Previous archive slide"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="flex size-12 items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
              aria-label="Next archive slide"
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`border px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition ${
                activeSlide.id === slide.id
                  ? "border-[#b11226] bg-[#b11226] text-white"
                  : "border-[#1f1f1f] bg-[#0d0d0d] text-[#9ca3af] hover:border-[#b11226] hover:text-white"
              }`}
            >
              {slide.label}
            </button>
          ))}
        </div>

        <div className="mt-8 overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          {activeSlide.id === "table" && (
            <div className="overflow-x-auto animate-[archive-panel_220ms_ease-out]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#1f1f1f] bg-black/35 text-[#9ca3af]">
                  <tr>
                    <th className="px-4 py-4">#</th>
                    <th className="px-4 py-4">Team</th>
                    <th className="px-4 py-4 text-center">Played</th>
                    <th className="px-4 py-4 text-center">Points</th>
                    <th className="px-4 py-4 text-center">Games</th>
                    <th className="px-4 py-4 text-center">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team, index) => (
                    <tr key={team.teamId} className="border-b border-[#1f1f1f] last:border-b-0">
                      <td className="px-4 py-4 text-xl font-black text-[#b11226]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <TeamLogo src={team.logoUrl} alt={team.teamName} />
                          <div>
                            <p className="font-black text-white">{team.teamName}</p>
                            <p className="text-xs uppercase tracking-[0.14em] text-[#9ca3af]">
                              Seed {index + 1}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-bold">{team.played}</td>
                      <td className="px-4 py-4 text-center font-black text-white">
                        {team.points}
                      </td>
                      <td className="px-4 py-4 text-center text-[#d1d5db]">
                        {team.gameW}-{team.gameL}
                      </td>
                      <td
                        className={`px-4 py-4 text-center font-black ${
                          team.diff >= 0 ? "text-white" : "text-[#9ca3af]"
                        }`}
                      >
                        {team.diff > 0 ? `+${team.diff}` : team.diff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSlide.id === "bracket" && (
            <div className="grid gap-4 p-4 animate-[archive-panel_220ms_ease-out] lg:grid-cols-5">
              {bracketMatches.map((match) => (
                <div key={match.id} className="border border-[#1f1f1f] bg-black/25 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
                    {match.stageLabel}
                  </p>
                  <h3 className="mt-2 text-lg font-black uppercase text-white">
                    {match.slotLabel}
                  </h3>

                  <div className="mt-5 space-y-3">
                    <BracketTeam
                      team={match.homeTeam}
                      score={match.homeScore}
                      winner={match.winnerName}
                    />
                    <BracketTeam
                      team={match.awayTeam}
                      score={match.awayScore}
                      winner={match.winnerName}
                    />
                  </div>

                  <div className="mt-5 border-t border-[#1f1f1f] pt-4 text-xs leading-5 text-[#9ca3af]">
                    <p>BO{match.bestOf}</p>
                    <p>{match.status}</p>
                    {match.winnerName && <p className="text-white">Winner: {match.winnerName}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSlide.id === "elo" && (
            <div className="animate-[archive-panel_220ms_ease-out]">
              <div className="flex flex-col gap-3 border-b border-[#1f1f1f] bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#9ca3af]">
                  Showing {visibleElo.length} of {eloLeaderboard.length} players
                </p>
                {eloLeaderboard.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setShowAllElo((current) => !current)}
                    className="border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
                  >
                    {showAllElo ? "Show Top 12" : "Show All Players"}
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#1f1f1f] bg-black/35 text-[#9ca3af]">
                    <tr>
                      <th className="px-4 py-4">Rank</th>
                      <th className="px-4 py-4">Player</th>
                      <th className="px-4 py-4 text-center">Team</th>
                      <th className="px-4 py-4 text-center">ELO</th>
                      <th className="px-4 py-4 text-center">Record</th>
                      <th className="px-4 py-4 text-center">KDA</th>
                      <th className="px-4 py-4 text-center">Awards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleElo.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-[#9ca3af]">
                          No ELO rows found yet.
                        </td>
                      </tr>
                    ) : (
                      visibleElo.map((player, index) => (
                        <tr key={player.id} className="border-b border-[#1f1f1f] last:border-b-0">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-black text-[#b11226]">
                                #{index + 1}
                              </span>
                              {index === 0 && <Trophy size={18} className="text-[#b11226]" />}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-black text-white">{player.name}</p>
                            {player.riotLine && (
                              <p className="text-xs text-[#9ca3af]">{player.riotLine}</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <TeamLogo
                                src={player.teamLogoUrl}
                                alt={player.teamName}
                                size={34}
                              />
                              <span className="hidden font-bold text-[#d1d5db] sm:inline">
                                {getTeamTag(player.teamName)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-xl font-black text-white">
                            {player.elo}
                          </td>
                          <td className="px-4 py-4 text-center text-[#d1d5db]">
                            {player.wins}-{Math.max(0, player.games - player.wins)}
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-white">
                            {player.kda}
                          </td>
                          <td className="px-4 py-4 text-center font-black">
                            <AwardStars mvps={player.mvps} svps={player.svps} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
          {slides.map((slide, index) => (
            <span
              key={slide.id}
              className={`h-1.5 transition-all ${
                activeIndex === index ? "w-10 bg-[#b11226]" : "w-4 bg-[#1f1f1f]"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-3 text-xs uppercase tracking-[0.14em] text-[#9ca3af] sm:grid-cols-3">
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-4">
            <Shield className="mb-2 text-[#b11226]" size={18} />
            Regular season locked
          </div>
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-4">
            <Trophy className="mb-2 text-[#b11226]" size={18} />
            Knockout path archived
          </div>
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-4">
            <BarChart3 className="mb-2 text-[#b11226]" size={18} />
            ELO read from player records
          </div>
        </div>
      </div>
    </section>
  );
}
