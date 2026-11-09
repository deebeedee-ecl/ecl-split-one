"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Shield, Trophy } from "lucide-react";

type Group = {
  name: string;
  teams: string[];
  matches: BracketMatch[];
};

type BracketMatch = {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  winner: string;
};

type BracketRound = {
  stage: string;
  matches: BracketMatch[];
};

type Award = {
  label: string;
  name: string;
  meta: string;
  value: string;
};

type PlayerRow = {
  player: string;
  team: string;
  role: string;
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  kda: number;
  csPerMin: number;
};

type ChampionPick = {
  champion: string;
  count: number;
};

type TeamCard = {
  code: string;
  logoUrl: string;
  players: Array<{
    role: string;
    name: string;
  }>;
  record: {
    games: number;
    wins: number;
    losses: number;
  };
  stats: {
    games: number;
    kills: number;
    deaths: number;
    assists: number;
    gold: number;
    towers: number;
    dragons: number;
    goldPerMin: number;
    killsPerMin: number;
    dragonsPerGame: number;
  } | null;
  championsByRole: Record<string, ChampionPick[]>;
};

type GroupStanding = {
  group: string;
  code: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  gameW: number;
  gameL: number;
  diff: number;
};

type SlideId = "table" | "bracket" | "elo";

const slides: Array<{
  id: SlideId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    id: "table",
    label: "League Table",
    eyebrow: "Group Stage",
    title: "League Table",
    description: "Winter Cup group standings ranked by points, game record, and game difference.",
  },
  {
    id: "bracket",
    label: "Knockouts",
    eyebrow: "Knockouts",
    title: "Bracket Path",
    description: "Archived double-elimination path through semi-finals and the final.",
  },
  {
    id: "elo",
    label: "ELO Leaderboard",
    eyebrow: "Player Ranking",
    title: "ELO Leaderboard",
    description: "Winter Cup player board in the same archive style, sorted by KDA and kills.",
  },
];

function formatDecimal(value: number, digits = 2) {
  return value.toFixed(digits);
}

function formatGold(value: number) {
  return `${Math.round(value / 1000)}k`;
}

function TeamLogo({
  src,
  alt,
  size = 46,
}: {
  src?: string;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-[10px] font-black uppercase tracking-[0.12em] text-[#9ca3af]"
        style={{ width: size, height: size }}
      >
        {alt}
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.48)]"
        sizes={`${size}px`}
      />
    </div>
  );
}

function moveIndex(current: number, direction: -1 | 1) {
  return (current + direction + slides.length) % slides.length;
}

function buildGroupStandings(groups: Group[]) {
  return groups.map((group) => {
    const rows = new Map<string, GroupStanding>();

    for (const code of group.teams) {
      rows.set(code, {
        group: group.name,
        code,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        gameW: 0,
        gameL: 0,
        diff: 0,
      });
    }

    for (const match of group.matches) {
      const home = rows.get(match.home);
      const away = rows.get(match.away);
      if (!home || !away) continue;

      home.played += 1;
      home.gameW += match.homeScore;
      home.gameL += match.awayScore;
      home.diff = home.gameW - home.gameL;

      away.played += 1;
      away.gameW += match.awayScore;
      away.gameL += match.homeScore;
      away.diff = away.gameW - away.gameL;

      if (match.winner === match.home) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      }
    }

    return {
      name: group.name,
      matches: group.matches,
      rows: Array.from(rows.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.gameW !== a.gameW) return b.gameW - a.gameW;
        return a.code.localeCompare(b.code);
      }),
    };
  });
}

function getMatchOutcome(match: BracketMatch) {
  const explicitWinner =
    match.winner === match.home || match.winner === match.away ? match.winner : null;
  const scoreWinner =
    match.homeScore === match.awayScore
      ? null
      : match.homeScore > match.awayScore
        ? match.home
        : match.away;
  const winner = explicitWinner ?? scoreWinner;

  return {
    homeWon: winner === match.home,
    awayWon: winner === match.away,
    winner,
  };
}

export function WinterCupArchiveCarousel({
  groups,
  bracketPath,
  awards,
  teamAwards,
  leaderboard,
  teams,
}: {
  groups: Group[];
  bracketPath: BracketRound[];
  awards: Award[];
  teamAwards: Award[];
  leaderboard: PlayerRow[];
  teams: TeamCard[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const activeSlide = slides[activeIndex];
  const visiblePlayers = useMemo(
    () => (showAllPlayers ? leaderboard : leaderboard.slice(0, 12)),
    [leaderboard, showAllPlayers]
  );
  const groupStandings = useMemo(() => buildGroupStandings(groups), [groups]);

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
              onClick={() => setActiveIndex((current) => moveIndex(current, -1))}
              className="flex size-12 items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
              aria-label="Previous Winter Cup section"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((current) => moveIndex(current, 1))}
              className="flex size-12 items-center justify-center border border-[#1f1f1f] bg-[#0d0d0d] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
              aria-label="Next Winter Cup section"
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
            <div className="animate-[archive-panel_220ms_ease-out]">
              <div className="grid gap-4 p-4 xl:grid-cols-2">
                {groupStandings.map((group) => (
                  <div key={group.name} className="overflow-hidden border border-[#1f1f1f] bg-black/25">
                    <div className="border-b border-[#1f1f1f] px-4 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
                        {group.name}
                      </p>
                    </div>

                    <div className="overflow-x-auto">
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
                          {group.rows.map((team, index) => (
                            <tr key={team.code} className="border-b border-[#1f1f1f] last:border-b-0">
                              <td className="px-4 py-4 text-xl font-black text-[#b11226]">
                                {index + 1}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <TeamLogo
                                    src={teams.find((item) => item.code === team.code)?.logoUrl}
                                    alt={team.code}
                                    size={42}
                                  />
                                  <div>
                                    <p className="font-black text-white">{team.code}</p>
                                    <p className="text-xs uppercase tracking-[0.14em] text-[#9ca3af]">
                                      {team.wins}-{team.losses}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center font-bold">{team.played}</td>
                              <td className="px-4 py-4 text-center font-black text-white">{team.points}</td>
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

                    <div className="border-t border-[#1f1f1f] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9ca3af]">
                        Group scores
                      </p>
                      <div className="mt-3 grid gap-2">
                        {group.matches.map((match) => (
                          <BracketResult
                            key={`${group.name}-${match.home}-${match.away}`}
                            match={match}
                            teams={teams}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSlide.id === "bracket" && (
            <div className="grid gap-4 p-4 animate-[archive-panel_220ms_ease-out] lg:grid-cols-5">
              {bracketPath.map((round) => (
                <div key={round.stage} className="border border-[#1f1f1f] bg-black/25 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
                    {round.stage}
                  </p>
                  <div className="mt-5 space-y-3">
                    {round.matches.map((match) => (
                      <BracketResult
                        key={`${round.stage}-${match.home}-${match.away}`}
                        match={match}
                        teams={teams}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSlide.id === "elo" && (
            <div className="animate-[archive-panel_220ms_ease-out]">
              <div className="flex flex-col gap-3 border-b border-[#1f1f1f] bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#9ca3af]">
                  Showing {visiblePlayers.length} of {leaderboard.length} players
                </p>
                {leaderboard.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPlayers((current) => !current)}
                    className="border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
                  >
                    {showAllPlayers ? "Show Top 12" : "Show All Players"}
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
                      <th className="px-4 py-4 text-center">Role</th>
                      <th className="px-4 py-4 text-center">Games</th>
                      <th className="px-4 py-4 text-center">KDA</th>
                      <th className="px-4 py-4 text-center">Kills</th>
                      <th className="px-4 py-4 text-center">Assists</th>
                      <th className="px-4 py-4 text-center">CS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlayers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-[#9ca3af]">
                          No player rows found yet.
                        </td>
                      </tr>
                    ) : (
                      visiblePlayers.map((player, index) => (
                        <tr key={`${player.team}-${player.player}`} className="border-b border-[#1f1f1f] last:border-b-0">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-black text-[#b11226]">
                                #{index + 1}
                              </span>
                              {index === 0 && <Trophy size={18} className="text-[#b11226]" />}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-black text-white">{player.player}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <TeamLogo
                                src={teams.find((team) => team.code === player.team)?.logoUrl}
                                alt={player.team}
                                size={40}
                              />
                              <span className="hidden font-bold text-[#d1d5db] sm:inline">
                                {player.team}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-black text-white">{player.role}</td>
                          <td className="px-4 py-4 text-center text-[#d1d5db]">{player.games}</td>
                          <td className="px-4 py-4 text-center font-black text-white">
                            {formatDecimal(player.kda)}
                          </td>
                          <td className="px-4 py-4 text-center font-black text-white">{player.kills}</td>
                          <td className="px-4 py-4 text-center text-[#d1d5db]">{player.assists}</td>
                          <td className="px-4 py-4 text-center text-[#d1d5db]">
                            {player.cs} / {formatDecimal(player.csPerMin)} per min
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
            Group table locked
          </div>
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-4">
            <Trophy className="mb-2 text-[#b11226]" size={18} />
            Knockout path archived
          </div>
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-4">
            <BarChart3 className="mb-2 text-[#b11226]" size={18} />
            Player board from workbook
          </div>
        </div>

        <section className="mt-16">
          <SectionHeading
            eyebrow="Awards"
            title="Winter Cup Leaders"
            description="Player and team leaders from the Winter Cup leaderboard workbook."
          />
          <div className="mt-8 grid gap-4 xl:grid-cols-2">
            <LeaderPanel title="Player Leaders" awards={awards} />
            <LeaderPanel title="Team Leaders" awards={teamAwards} />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeading
            eyebrow="Teams"
            title="Team by Team"
            description="Open a team card for roster, record, stat totals, and champion picks by role."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {teams.map((team) => (
              <details key={team.code} className="group border border-[#1f1f1f] bg-[#0d0d0d]">
                <summary className="cursor-pointer list-none p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <TeamLogo src={team.logoUrl} alt={team.code} size={104} />
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
                          {team.record.wins}-{team.record.losses} record / {team.record.games} games parsed
                        </p>
                        <h3 className="mt-1 text-3xl font-black text-white">{team.code}</h3>
                      </div>
                    </div>
                    <span className="text-sm font-black uppercase tracking-[0.12em] text-[#9ca3af] group-open:text-white">
                      Open
                    </span>
                  </div>
                </summary>

                <div className="border-t border-[#1f1f1f] p-5">
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">
                        Roster
                      </h4>
                      <div className="mt-3 space-y-2">
                        {team.players.map((player) => (
                          <div
                            key={`${team.code}-${player.role}`}
                            className="grid grid-cols-[4rem_1fr] border border-[#1f1f1f] bg-black/25 px-3 py-2 text-sm"
                          >
                            <span className="font-black text-[#b11226]">{player.role}</span>
                            <span className="font-bold text-white">{player.name}</span>
                          </div>
                        ))}
                      </div>

                      {team.stats && (
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <MiniStat label="Kills" value={team.stats.kills} />
                          <MiniStat label="Gold" value={formatGold(team.stats.gold)} />
                          <MiniStat label="Towers" value={team.stats.towers} />
                          <MiniStat label="Dragons" value={team.stats.dragons} />
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">
                        Champions by role
                      </h4>
                      <div className="mt-3 space-y-3">
                        {Object.entries(team.championsByRole).map(([role, champions]) => (
                          <div key={role} className="border border-[#1f1f1f] bg-black/25 p-3">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b11226]">
                              {role}
                            </p>
                            <div className="mt-2 space-y-2">
                              {champions.length === 0 ? (
                                <p className="text-sm text-[#9ca3af]">No picks parsed.</p>
                              ) : (
                                champions.map((champion) => (
                                  <div key={`${role}-${champion.champion}`} className="flex justify-between gap-4 text-sm">
                                    <span className="font-bold text-white">{champion.champion}</span>
                                    <span className="text-[#9ca3af]">{champion.count} picks</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function BracketResult({ match, teams }: { match: BracketMatch; teams: TeamCard[] }) {
  const home = teams.find((team) => team.code === match.home);
  const away = teams.find((team) => team.code === match.away);
  const outcome = getMatchOutcome(match);
  const hasResult = Boolean(outcome.winner);

  return (
    <div
      className="grid min-h-20 items-center gap-3 border border-[#1f1f1f] bg-[#080808] p-3"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 4.75rem minmax(0, 1fr)" }}
    >
      <BracketTeamCell
        team={home}
        code={match.home}
        won={outcome.homeWon}
        hasResult={hasResult}
        align="left"
      />
      <div className="flex h-12 items-center justify-center border border-[#1f1f1f] bg-black/30 text-center">
        <span className="whitespace-nowrap text-2xl font-black text-white drop-shadow-[0_1px_0_#174ea6]">
          {match.homeScore}-{match.awayScore}
        </span>
      </div>
      <BracketTeamCell
        team={away}
        code={match.away}
        won={outcome.awayWon}
        hasResult={hasResult}
        align="right"
      />
    </div>
  );
}

function BracketTeamCell({
  team,
  code,
  won,
  hasResult,
  align,
}: {
  team?: TeamCard;
  code: string;
  won: boolean;
  hasResult: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${
        align === "right" ? "justify-end text-right" : ""
      }`}
    >
      <TeamLogo src={team?.logoUrl} alt={code} size={32} />
      <div className="min-w-0">
        <p
          className={`truncate text-lg font-black drop-shadow-[0_1px_0_#174ea6] ${
            !hasResult || won ? "text-white" : "text-[#9ca3af]"
          }`}
        >
          {code}
        </p>
        {hasResult && won && (
          <div className="mt-1 h-1.5 w-8 bg-emerald-400" />
        )}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
        {title}
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-[#9ca3af]">
        {description}
      </p>
    </div>
  );
}

function LeaderPanel({ title, awards }: { title: string; awards: Award[] }) {
  return (
    <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-5">
      <h3 className="text-xl font-black uppercase text-white">{title}</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {awards.map((award) => (
          <div key={award.label} className="border border-[#1f1f1f] bg-black/25 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
              {award.label}
            </p>
            <h4 className="mt-4 text-2xl font-black text-white">{award.name}</h4>
            <p className="mt-2 text-sm font-bold text-[#d1d5db]">{award.meta}</p>
            <p className="mt-4 border border-[#1f1f1f] bg-black/30 px-3 py-2 text-sm font-black text-white">
              {award.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#1f1f1f] bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9ca3af]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}
