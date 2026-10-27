import type { SplitTwoTeam } from "./split-ii-fixtures";

type TeamRoster = {
  team: SplitTwoTeam;
  accent: string;
  captain: string;
  picks: readonly { name: string; pot: number }[];
};

// Final draft allocations supplied by the tournament owner, October 24, 2026.
export const SPLIT_II_ROSTERS: readonly TeamRoster[] = [
  { team: "ballbreakers", accent: "#df374a", captain: "Jzck", picks: [
    { name: "Epifanio", pot: 1 }, { name: "gurt", pot: 4 },
    { name: "joyboy", pot: 2 }, { name: "Dpzd", pot: 5 },
  ] },
  { team: "exodus", accent: "#2aaaf0", captain: "Soul", picks: [
    { name: "Peter", pot: 1 }, { name: "Joe", pot: 2 },
    { name: "fayimo", pot: 4 }, { name: "Yasser", pot: 5 },
  ] },
  { team: "zero", accent: "#a3ad7d", captain: "Exile", picks: [
    { name: "Pedro", pot: 1 }, { name: "xrc_rhino", pot: 4 },
    { name: "jipssi", pot: 3 }, { name: "LazyT3ry", pot: 5 },
  ] },
  { team: "nextgen", accent: "#f2b622", captain: "Kasper", picks: [
    { name: "Zeu5", pot: 1 }, { name: "Bernardt", pot: 4 },
    { name: "toggaf", pot: 3 }, { name: "Shenric", pot: 5 },
  ] },
  { team: "phoenix", accent: "#ef6c15", captain: "doolittlesy", picks: [
    { name: "shidian", pot: 2 }, { name: "prinomta", pot: 5 },
    { name: "Danicat", pot: 4 }, { name: "Flan", pot: 3 },
  ] },
];
