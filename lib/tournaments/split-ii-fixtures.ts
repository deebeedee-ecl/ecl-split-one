export const SPLIT_II_TEAMS = {
  ballbreakers: { name: "BallBreakers", tag: "[BB]" },
  phoenix: { name: "Phoenix", tag: "phx." },
  zero: { name: "Zero", tag: "zero |" },
  nextgen: { name: "NextGen", tag: "nG -" },
  exodus: { name: "Exodus", tag: "<eXo>" },
} as const;

export type SplitTwoTeam = keyof typeof SPLIT_II_TEAMS;

export const SPLIT_II_FIXTURE_WEEKS: readonly {
  week: number;
  matches: readonly (readonly [SplitTwoTeam, SplitTwoTeam])[];
}[] = [
  {
    week: 1,
    matches: [
      ["ballbreakers", "phoenix"],
      ["zero", "nextgen"],
      ["exodus", "ballbreakers"],
      ["phoenix", "zero"],
      ["nextgen", "exodus"],
    ],
  },
  {
    week: 2,
    matches: [
      ["ballbreakers", "zero"],
      ["phoenix", "nextgen"],
      ["zero", "exodus"],
      ["nextgen", "ballbreakers"],
      ["exodus", "phoenix"],
    ],
  },
];
