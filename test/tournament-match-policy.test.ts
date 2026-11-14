import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTables, type MatchPayload } from '../lib/tournaments/match-policy';

const teams = [
  { id: 'ballbreakers', name: 'BallBreakers' },
  { id: 'zero', name: 'Zero' },
  { id: 'exodus', name: 'Exodus' },
];

const fixtures = [
  { id: 'bb-win', stage: 'ROUND_ROBIN', bestOf: 1, homeTeamId: 'ballbreakers', awayTeamId: 'zero' },
  { id: 'zero-win', stage: 'ROUND_ROBIN', bestOf: 1, homeTeamId: 'zero', awayTeamId: 'exodus' },
  { id: 'exodus-win', stage: 'ROUND_ROBIN', bestOf: 1, homeTeamId: 'exodus', awayTeamId: 'ballbreakers' },
];

function report(fixtureId: string, winnerTeamId: string, durationSeconds: number) {
  return { fixtureId, payload: { winnerTeamId, durationSeconds, playedAt: '2026-11-12T12:00:00Z', players: [], note: '', statsComplete: true } satisfies MatchPayload };
}

test('equal-win standings use lower total winning time and do not retain provisional stars', () => {
  const winningGames = [
    { teamId: 'ballbreakers', durations: [1842, 1433, 1437] },
    { teamId: 'zero', durations: [2093, 1785, 1698] },
    { teamId: 'exodus', durations: [2475, 1597, 2043] },
  ];
  const timedFixtures = winningGames.flatMap(({ teamId, durations }) => durations.map((_, index) => ({
    id: `${teamId}-${index}`,
    stage: 'ROUND_ROBIN',
    bestOf: 1,
    homeTeamId: teamId,
    awayTeamId: 'opponent',
  })));
  const reports = winningGames.flatMap(({ teamId, durations }) => durations.map((duration, index) => report(`${teamId}-${index}`, teamId, duration)));

  const { standings } = calculateTables([...teams, { id: 'opponent', name: 'Opponent' }], timedFixtures, reports);

  assert.deepEqual(standings.slice(0, 3).map(row => [row.name, row.wins, row.winTimeSeconds, row.tied]), [
    ['BallBreakers', 3, 4712, false],
    ['Zero', 3, 5576, false],
    ['Exodus', 3, 6115, false],
  ]);
});

test('an exact wins and winning-time tie stays provisional with deterministic name order', () => {
  const reports = [
    report('bb-win', 'ballbreakers', 1800),
    report('zero-win', 'zero', 1800),
    report('exodus-win', 'exodus', 2400),
  ];

  const { standings } = calculateTables(teams, fixtures, reports);

  assert.deepEqual(standings.map(row => [row.name, row.tied]), [
    ['BallBreakers', true],
    ['Zero', true],
    ['Exodus', false],
  ]);
});
