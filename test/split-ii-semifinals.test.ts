import test from 'node:test';
import assert from 'node:assert/strict';
import { previewSplitTwoSemifinals, publishSplitTwoSemifinals } from '../lib/tournaments/matches';
import { SPLIT_II_FIXTURE_WEEKS } from '../lib/tournaments/split-ii-fixtures';
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

function workflow(existing: Record<string, unknown>[] = []) {
  const idByKey = new Map(teams.map(team => [team.key, team.id]));
  const fixtures = SPLIT_II_FIXTURE_WEEKS.flatMap(week => week.matches.map(([home, away], index) => {
    const code = `RR${String((week.week - 1) * 5 + index + 1).padStart(2, '0')}`;
    return { id: code, code, stage: 'ROUND_ROBIN', week: week.week, bestOf: 1, pairKey: [home, away].sort().join(':'), homeTeamId: idByKey.get(home)!, awayTeamId: idByKey.get(away)!, schedule: null, revision: 0 };
  })).concat(existing as never[]);
  const winners: Record<string, string> = {
    RR01: 'ballbreakers', RR02: 'zero', RR03: 'ballbreakers', RR04: 'zero', RR05: 'exodus',
    RR06: 'zero', RR07: 'phoenix', RR08: 'exodus', RR09: 'ballbreakers', RR10: 'exodus',
  };
  const durations: Record<string, number> = { ballbreakers: 1000, zero: 1100, exodus: 1200, phoenix: 1300 };
  const reports = Object.entries(winners).map(([fixtureId, key], index) => ({
    id: `report-${fixtureId}`,
    fixtureId,
    reviewedAt: new Date(`2026-11-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
    payload: { winnerTeamId: idByKey.get(key)!, durationSeconds: durations[key] + index, players: [] },
  }));
  const created: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: async () => [{ id: 'event' }],
    tournament: { findUniqueOrThrow: async () => ({ id: 'event' }) },
    tournamentTeam: { findMany: async () => teams },
    tournamentFixture: {
      findMany: async () => fixtures,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const stored = { ...data, schedule: null };
        fixtures.push(stored as never);
        created.push(stored);
        return stored;
      },
    },
    tournamentReport: { findMany: async () => reports },
  };
  return { db: { ...tx, $transaction: async (run: (client: typeof tx) => unknown) => run(tx) }, fixtures, reports, created };
}

test('publishes the two semifinals atomically and is idempotent', async () => {
  const state = workflow();
  const preview = await previewSplitTwoSemifinals(state.db as never, { admin: true });
  assert.equal(preview.status, 'ready');
  assert.match(preview.fingerprint, /^[a-f0-9]{64}$/);
  const first = await publishSplitTwoSemifinals(state.db as never, { admin: true }, preview.fingerprint);
  assert.deepEqual(first.inserted, ['SF01', 'SF02']);
  assert.equal(first.alreadyApplied, false);
  assert.equal(first.notificationQueued, false);
  assert.match(first.auditId, /^split-ii-semifinals-v1:[a-f0-9]{12}$/);
  assert.deepEqual(state.created.map(row => row.code), ['SF01', 'SF02']);
  const appliedPreview = await previewSplitTwoSemifinals(state.db as never, { admin: true });
  assert.equal(appliedPreview.status, 'applied');
  const second = await publishSplitTwoSemifinals(state.db as never, { admin: true }, appliedPreview.fingerprint);
  assert.deepEqual(second.inserted, []);
  assert.equal(second.alreadyApplied, true);
  assert.equal(state.fixtures.filter(row => row.stage === 'SEMIFINAL').length, 2);
});

test('requires admin access and blocks a mismatched existing semifinal', async () => {
  const denied = workflow();
  await assert.rejects(previewSplitTwoSemifinals(denied.db as never, { admin: false }), /Admin access required/);
  await assert.rejects(publishSplitTwoSemifinals(denied.db as never, { admin: false }, 'a'.repeat(64)), /Admin access required/);
  const mismatched = workflow([{ id: 'event:SF01', code: 'SF01', stage: 'SEMIFINAL', week: 3, bestOf: 3, pairKey: 'ballbreakers:nextgen', homeTeamId: 'bb-id', awayTeamId: 'ng-id', schedule: null, revision: 0 }]);
  const preview = await previewSplitTwoSemifinals(mismatched.db as never, { admin: true });
  assert.equal(preview.status, 'blocked');
  await assert.rejects(publishSplitTwoSemifinals(mismatched.db as never, { admin: true }, preview.fingerprint), /needs review/);
  assert.equal(mismatched.created.length, 0);
});

test('requires a fresh preview fingerprint before publication', async () => {
  const state = workflow();
  await assert.rejects(publishSplitTwoSemifinals(state.db as never, { admin: true }, ''), /current preview fingerprint/);
  const preview = await previewSplitTwoSemifinals(state.db as never, { admin: true });
  state.reports[0].payload.durationSeconds += 1;
  await assert.rejects(
    publishSplitTwoSemifinals(state.db as never, { admin: true }, preview.fingerprint),
    /state changed after preview/,
  );
  assert.equal(state.created.length, 0);
});

test('preview fingerprint is stable across database result ordering', async () => {
  const state = workflow();
  const first = await previewSplitTwoSemifinals(state.db as never, { admin: true });
  state.reports.reverse();
  state.fixtures.reverse();
  const second = await previewSplitTwoSemifinals(state.db as never, { admin: true });
  assert.equal(second.fingerprint, first.fingerprint);
});
