import { SPLIT_II_SEMIFINALS, type SplitTwoTeam } from "./split-ii-fixtures";

export const SPLIT_II_FINAL_SEED_ORDER: readonly SplitTwoTeam[] = [
  "ballbreakers",
  "zero",
  "exodus",
  "phoenix",
  "nextgen",
];

type Team = { id: string; key: string; name: string };
type Standing = { id: string; played: number; tied: boolean };

export function buildSplitTwoSemifinalPlan(eventId: string, teams: Team[], standings: Standing[]) {
  const byId = new Map(teams.map(team => [team.id, team]));
  const byKey = new Map(teams.map(team => [team.key, team]));
  if (teams.length !== 5 || byKey.size !== 5 || SPLIT_II_FINAL_SEED_ORDER.some(key => !byKey.has(key))) {
    throw new Error("Split II semifinal release requires the five final tournament teams.");
  }
  if (standings.length !== 5 || standings.some(row => row.played !== 4 || row.tied)) {
    throw new Error("Split II round robin must be complete with no provisional seed ties.");
  }
  const seedOrder = standings.map(row => byId.get(row.id)?.key);
  if (seedOrder.some((key, index) => key !== SPLIT_II_FINAL_SEED_ORDER[index])) {
    throw new Error("Live Split II standings do not match the approved semifinal seeding.");
  }

  return SPLIT_II_SEMIFINALS.map(definition => {
    const home = byKey.get(definition.home)!;
    const away = byKey.get(definition.away)!;
    return {
      id: `${eventId}:${definition.code}`,
      tournamentId: eventId,
      code: definition.code,
      stage: "SEMIFINAL",
      week: 3,
      bestOf: 3,
      pairKey: [definition.home, definition.away].sort().join(":"),
      homeTeamId: home.id,
      awayTeamId: away.id,
      schedule: null,
      revision: 0,
      homeTeam: home.name,
      awayTeam: away.name,
      gameOneSideSelection: byKey.get(definition.gameOneSideSelection)!.name,
    };
  });
}
