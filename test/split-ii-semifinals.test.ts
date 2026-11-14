import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSplitTwoSemifinalPlan } from '../lib/tournaments/split-ii-playoffs';

const teams = [
  ['bb-id', 'ballbreakers', 'BallBreakers'],
  ['zero-id', 'zero', 'Zero'],
  ['exo-id', 'exodus', 'Exodus'],
  ['phx-id', 'phoenix', 'Phoenix'],
  ['ng-id', 'nextgen', 'NextGen'],
].map(([id, key, name]) => ({ id, key, name }));
const standings = teams.map(team => ({ id: team.id, played: 4, tied: false }));

test('builds the approved Bo3 semifinal fixtures and Game 1 side selectors', () => {
  assert.deepEqual(buildSplitTwoSemifinalPlan('event', teams, standings).map(row => ({
    code: row.code,
    stage: row.stage,
    week: row.week,
    bestOf: row.bestOf,
    home: row.homeTeam,
    away: row.awayTeam,
    selector: row.gameOneSideSelection,
  })), [
    { code: 'SF01', stage: 'SEMIFINAL', week: 3, bestOf: 3, home: 'BallBreakers', away: 'Phoenix', selector: 'BallBreakers' },
    { code: 'SF02', stage: 'SEMIFINAL', week: 3, bestOf: 3, home: 'Zero', away: 'Exodus', selector: 'Zero' },
  ]);
});

test('blocks an incomplete, provisional or changed seed order', () => {
  assert.throws(() => buildSplitTwoSemifinalPlan('event', teams, standings.map((row, index) => index === 0 ? { ...row, played: 3 } : row)), /complete/);
  assert.throws(() => buildSplitTwoSemifinalPlan('event', teams, standings.map((row, index) => index === 0 ? { ...row, tied: true } : row)), /provisional/);
  assert.throws(() => buildSplitTwoSemifinalPlan('event', teams, [standings[1], standings[0], ...standings.slice(2)]), /approved semifinal seeding/);
});
