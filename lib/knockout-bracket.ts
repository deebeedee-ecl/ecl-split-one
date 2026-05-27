import { lockedStandings } from "@/lib/locked-standings";

export type KnockoutTeam = {
  teamId?: string;
  name: string;
  logoUrl: string | null;
  seed?: number;
};

export type KnockoutMatchConfig = {
  id: string;
  stage: "PLAYOFFS" | "SEMIFINALS" | "FINALS";
  stageLabel: string;
  slotLabel: string;
  homeTeam: KnockoutTeam | null;
  awayTeam: KnockoutTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerName: string | null;
  status: string;
  bestOf: 3 | 5;
  scheduledLabel: string | null;
  isPlaceholder: boolean;
};

type StoredKnockoutMatch = {
  id: string;
  stage: string;
  roundLabel: string | null;
  matchLabel: string | null;
  bestOf: number;
  scheduledAt: Date | null;
  status: string;
  homeScore: number;
  awayScore: number;
  homeTeam: KnockoutTeam;
  awayTeam: KnockoutTeam;
  winnerTeam: KnockoutTeam | null;
};

function getSeededTeam(seed: number): KnockoutTeam | null {
  const team = lockedStandings[seed - 1];

  if (!team) return null;

  return {
    teamId: team.teamId,
    name: team.teamName,
    logoUrl: team.logoUrl,
    seed,
  };
}

function getPlaceholderTeam(name: string): KnockoutTeam {
  return {
    name,
    logoUrl: null,
  };
}

// Opening-round teams are seeded from the locked regular season standings.
// Keep playoff/semifinal matches as BO3. The championship final is BO5.
export const knockoutBracket: KnockoutMatchConfig[] = [
  {
    id: "playoff-1v6",
    stage: "PLAYOFFS",
    stageLabel: "Quarterfinal",
    slotLabel: "Seed 1 vs Seed 6",
    homeTeam: getSeededTeam(1),
    awayTeam: getSeededTeam(6),
    homeScore: null,
    awayScore: null,
    winnerName: null,
    status: "Scheduled in KOOK",
    bestOf: 3,
    scheduledLabel: null,
    isPlaceholder: false,
  },
  {
    id: "playoff-2v5",
    stage: "PLAYOFFS",
    stageLabel: "Quarterfinal",
    slotLabel: "Seed 2 vs Seed 5",
    homeTeam: getSeededTeam(2),
    awayTeam: getSeededTeam(5),
    homeScore: null,
    awayScore: null,
    winnerName: null,
    status: "Scheduled in KOOK",
    bestOf: 3,
    scheduledLabel: null,
    isPlaceholder: false,
  },
  {
    id: "playoff-3v4",
    stage: "PLAYOFFS",
    stageLabel: "Quarterfinal",
    slotLabel: "Seed 3 vs Seed 4",
    homeTeam: getSeededTeam(3),
    awayTeam: getSeededTeam(4),
    homeScore: null,
    awayScore: null,
    winnerName: null,
    status: "Scheduled in KOOK",
    bestOf: 3,
    scheduledLabel: null,
    isPlaceholder: false,
  },
  {
    id: "semifinal",
    stage: "SEMIFINALS",
    stageLabel: "Semifinal",
    slotLabel: "Semifinal",
    homeTeam: getPlaceholderTeam("Lower remaining seed"),
    awayTeam: getPlaceholderTeam("Middle remaining seed"),
    homeScore: null,
    awayScore: null,
    winnerName: null,
    status: "Lowest remaining seeds",
    bestOf: 3,
    scheduledLabel: null,
    isPlaceholder: true,
  },
  {
    id: "final",
    stage: "FINALS",
    stageLabel: "Final",
    slotLabel: "Championship Final",
    homeTeam: getPlaceholderTeam("Highest remaining seed"),
    awayTeam: getPlaceholderTeam("Semifinal winner"),
    homeScore: null,
    awayScore: null,
    winnerName: null,
    status: "Highest seed vs semifinal winner",
    bestOf: 5,
    scheduledLabel: null,
    isPlaceholder: true,
  },
];

function formatScheduledLabel(value: Date | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildKnockoutBracket(
  matches: StoredKnockoutMatch[]
): KnockoutMatchConfig[] {
  if (matches.length === 0) {
    return knockoutBracket;
  }

  const matchesBySlot = new Map(
    matches
      .filter((match) => match.matchLabel)
      .map((match) => [match.matchLabel, match])
  );

  return knockoutBracket.map((slot) => {
    const match = matchesBySlot.get(slot.id);

    if (!match) return slot;

    return {
      ...slot,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      winnerName: match.winnerTeam?.name ?? null,
      status: formatStatus(match.status),
      bestOf: match.bestOf === 5 ? 5 : 3,
      scheduledLabel: formatScheduledLabel(match.scheduledAt),
      isPlaceholder: false,
    };
  });
}
