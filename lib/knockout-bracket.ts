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
  homeTeam: KnockoutTeam & { id?: string };
  awayTeam: KnockoutTeam & { id?: string };
  winnerTeam: (KnockoutTeam & { id?: string }) | null;
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

function getTeamSeed(team: KnockoutTeam & { id?: string }) {
  const teamId = team.teamId ?? team.id;
  const standingIndex = lockedStandings.findIndex(
    (standing) =>
      standing.teamId === teamId || standing.teamName === team.name
  );

  return standingIndex === -1 ? undefined : standingIndex + 1;
}

function normalizeTeam(
  team: (KnockoutTeam & { id?: string }) | null
): KnockoutTeam | null {
  if (!team) return null;

  return {
    teamId: team.teamId ?? team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    seed: team.seed ?? getTeamSeed(team),
  };
}

// Quarterfinal teams are seeded from the locked regular season standings.
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

  const bracketMatches: KnockoutMatchConfig[] = knockoutBracket.map((slot) => {
    const match = matchesBySlot.get(slot.id);

    if (!match) return slot;

    const bestOf: 3 | 5 = match.bestOf === 5 ? 5 : 3;

    return {
      ...slot,
      homeTeam: normalizeTeam(match.homeTeam),
      awayTeam: normalizeTeam(match.awayTeam),
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      winnerName: normalizeTeam(match.winnerTeam)?.name ?? null,
      status: formatStatus(match.status),
      bestOf,
      scheduledLabel: formatScheduledLabel(match.scheduledAt),
      isPlaceholder: false,
    };
  });

  const quarterfinalWinners = bracketMatches
    .filter((match) => match.stage === "PLAYOFFS" && match.winnerName)
    .map((match) =>
      [match.homeTeam, match.awayTeam].find(
        (team) => team?.name === match.winnerName
      )
    )
    .filter((team): team is KnockoutTeam => Boolean(team?.seed))
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));

  if (quarterfinalWinners.length >= 3) {
    const [finalist, ...semifinalTeams] = quarterfinalWinners;
    const semifinal = bracketMatches.find((match) => match.id === "semifinal");
    const final = bracketMatches.find((match) => match.id === "final");

    if (semifinal?.isPlaceholder) {
      semifinal.homeTeam = semifinalTeams[0] ?? semifinal.homeTeam;
      semifinal.awayTeam = semifinalTeams[1] ?? semifinal.awayTeam;
      semifinal.status = "Ready to play";
    }

    if (final?.isPlaceholder) {
      final.homeTeam = finalist;
      final.status = "Awaiting semifinal winner";
    }
  }

  const semifinal = bracketMatches.find((match) => match.id === "semifinal");
  const final = bracketMatches.find((match) => match.id === "final");

  if (semifinal?.winnerName && final?.isPlaceholder) {
    const semifinalWinner = [semifinal.homeTeam, semifinal.awayTeam].find(
      (team) => team?.name === semifinal.winnerName
    );

    final.awayTeam = semifinalWinner ?? final.awayTeam;
    final.status = "Ready to play";
  }

  return bracketMatches;
}
