import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { splitTwoReadReply, splitTwoHelp, splitTwoReportHelp, fixtureFinished, completedFixtureReply } from '../lib/tournaments/kook-copy';
import * as policy from '../lib/tournaments/match-policy';
import { SPLIT_II_FIXTURE_WEEKS, SPLIT_II_TEAMS } from '../lib/tournaments/split-ii-fixtures';

function sample() {
  const teams = Object.entries(SPLIT_II_TEAMS).map(([key, t]) => ({ id: key, name: t.name, members: [{ profileId: key + '-player' }] }));
  const fixtures = SPLIT_II_FIXTURE_WEEKS.flatMap(w => w.matches.map(([homeTeamId, awayTeamId], i) => ({
    id: 'RR' + String((w.week - 1) * 5 + i + 1).padStart(2, '0'), code: 'RR' + String((w.week - 1) * 5 + i + 1).padStart(2, '0'),
    week: w.week, stage: 'ROUND_ROBIN', bestOf: 1, homeTeamId, awayTeamId, revision: 0,
    homeScore: 0, awayScore: 0, schedule: null as null | { at: string; state: string },
  })));
  const wins = [['RR01', 'ballbreakers'], ['RR03', 'ballbreakers'], ['RR05', 'exodus'], ['RR07', 'phoenix']];
  const reports = wins.map(([fixtureId, winnerTeamId], i) => {
    const f = fixtures.find(f => f.id === fixtureId)!;
    f.homeScore = Number(f.homeTeamId === winnerTeamId); f.awayScore = Number(f.awayTeamId === winnerTeamId);
    return { id: 'report-' + fixtureId, fixtureId, gameNumber: 1, status: 'APPROVED', payload: { winnerTeamId, durationSeconds: 1842, playedAt: `2026-11-0${i + 1}T12:11:07.000Z` } };
  });
  const standings = teams.map(t => ({ ...t, played: 0, wins: 0, losses: 0, winTimeSeconds: 0, tied: false }));
  for (const f of fixtures.filter(f => f.homeScore || f.awayScore)) for (const t of standings.filter(t => f.homeTeamId === t.id || f.awayTeamId === t.id)) {
    t.played++; if ((f.homeScore ? f.homeTeamId : f.awayTeamId) === t.id) {
      t.wins++;
      t.winTimeSeconds += Number(reports.find(report => report.fixtureId === f.id)?.payload.durationSeconds ?? 0);
    } else t.losses++;
  }
  for (const row of standings) row.tied = standings.some(other => other.id !== row.id && other.played > 0 && row.played > 0 && other.wins === row.wins && other.winTimeSeconds === row.winTimeSeconds);
  return { event: { id: 'event' }, teams, fixtures, reports, standings };
}
type View = Parameters<typeof splitTwoReadReply>[2];
const asView = (v: ReturnType<typeof sample>) => v as unknown as View;

test('remaining fixtures reflect approved results and preserve RR codes/week grouping', () => {
  const v = asView(sample());
  const reply = splitTwoReadReply('fixtures', [], v)!;
  assert.match(reply, /6 unplayed fixtures/);
  for (const code of ['RR02', 'RR04', 'RR06', 'RR08', 'RR09', 'RR10']) assert.ok(reply.includes(code));
  for (const code of ['RR01', 'RR03', 'RR05', 'RR07']) assert.ok(!reply.includes(code));
  assert.ok(reply.includes('Week 1') && reply.includes('Week 2'));
  assert.equal(reply, splitTwoReadReply('remaining', [], v));
});
test('full draw shows final scores, with no stale scheduling text on completed games', () => {
  const v = sample(); v.fixtures[0].schedule = { state: 'CONFIRMED', at: '2026-11-03T12:00:00Z' };
  const reply = splitTwoReadReply('fixtures', ['all'], asView(v))!;
  assert.match(reply, /10 fixtures/); assert.match(reply, /RR01: BallBreakers 1–0 Phoenix \/ Final/);
  assert.ok(!reply.split('\n').find(line => line.startsWith('RR01:'))!.includes('CONFIRMED'));
  assert.ok(!reply.includes('Time TBC'));
  assert.match(splitTwoReadReply('fixtures', ['bad'], asView(v))!, /Use !split2 fixtures/);
});
test('standings expose winning time and retain only exact ties as provisional', () => {
  const v = sample(); const reply = splitTwoReadReply('standings', [], asView(v))!;
  assert.match(reply, /BallBreakers \/ 2 \/ 2–0 \/ 1:01:24 \/ 2/);
  assert.match(reply, /Exodus \* \/ 2 \/ 1–1 \/ 0:30:42 \/ 1/);
  assert.match(reply, /Phoenix \* \/ 2 \/ 1–1 \/ 0:30:42 \/ 1/);
  assert.match(reply, /NextGen \/ 2 \/ 0–2 \/ — \/ 0/);
  assert.match(reply, /Equal wins are ranked by lower total time/);
});
test('results omit pending reports and include an approved game in an unfinished Bo3', () => {
  const v = sample();
  v.reports.push({ id: 'pending', fixtureId: 'RR02', gameNumber: 1, status: 'PENDING', payload: { winnerTeamId: 'zero', durationSeconds: 999, playedAt: '2026-11-04T00:00:00Z' } });
  v.fixtures.push({ ...v.fixtures[0], id: 'SF01', code: 'SF01', stage: 'SEMIFINAL', bestOf: 3, homeScore: 1, awayScore: 0 });
  v.reports.push({ id: 'semi-game1', fixtureId: 'SF01', gameNumber: 1, status: 'APPROVED', payload: { winnerTeamId: 'ballbreakers', durationSeconds: 1000, playedAt: '2026-11-04T01:00:00Z' } });
  const reply = splitTwoReadReply('results', [], asView(v))!;
  assert.ok(!reply.includes('RR02:')); assert.ok(reply.includes('SF01:'));
  assert.ok(reply.includes('30:42')); assert.ok(!reply.includes('TBC'));
});
test('published scores determine completion; all finished and no-result states are clear', () => {
  const v = sample(); assert.equal(fixtureFinished(asView(v).fixtures[0]), true);
  assert.equal(fixtureFinished(asView(v).fixtures[1]), false);
  for (const f of v.fixtures) f.homeScore = 1;
  assert.match(splitTwoReadReply('remaining', [], asView(v))!, /Round robin complete/);
  v.reports = []; assert.match(splitTwoReadReply('results', [], asView(v))!, /No published results/);
});

function routeHarness() {
  const v = sample(), calls = { actors: 0, queues: 0, schedules: 0, views: 0 };
  let actor = { admin: false, profileId: 'zero-player' }, floater = false;
  const exports: Record<string, unknown> = {};
  const loadedModule = { exports };
  const http = {
    tournamentBot(request: Request) { if (request.headers.get('x-ecl-kook-secret') !== 'synthetic') throw new policy.TournamentError('Unauthorized bot request.', 401); },
    tournamentBody: (request: Request) => request.json(),
    tournamentJson: (body: unknown) => Response.json(body),
    tournamentFailure: (e: Error & { status?: number }) => Response.json({ message: e.message }, { status: e.status ?? 500 }),
    tournamentKookUser: async () => { calls.actors++; return actor; },
  };
  const requireMock = (name: string) => {
    if (name === '@/lib/prisma') return { prisma: { tournamentRegistration: { findFirst: async () => floater ? { id: 'floater-registration' } : null } } };
    if (name.endsWith('/http')) return http;
    if (name.endsWith('/match-policy')) return policy;
    if (name.endsWith('/kook-copy')) return { splitTwoReadReply, splitTwoHelp, splitTwoReportHelp, fixtureFinished, completedFixtureReply };
    if (name.endsWith('/matches')) return {
      tournamentView: async () => { calls.views++; return v; },
      scheduleFixture: async () => { calls.schedules++; return { revision: 1, schedule: { state: 'PROPOSED', at: '2026-11-05T12:00:00Z' } }; },
    };
    if (name.endsWith('/collection')) return { queueTournamentCollection: async () => { calls.queues++; return { status: 'PENDING', gameNumber: 1, leagueGameId: '1234567890' }; } };
    throw new Error('Unexpected dependency');
  };
  const code = transformSync(readFileSync('app/api/kook/tournaments/split-ii/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  vm.runInNewContext(code, { exports, module: loadedModule, require: requireMock, Response, process: { env: {} } });
  return { calls, view: v, setActor: (value: typeof actor, isFloater = false) => { actor = value; floater = isFloater; },
    async command(command: string, authorized = true) {
      const post = loadedModule.exports.POST as (r: Request) => Promise<Response>;
      return post(new Request('https://eclchina.lol/api/kook/tournaments/split-ii', { method: 'POST',
        headers: { 'content-type': 'application/json', ...(authorized ? { 'x-ecl-kook-secret': 'synthetic' } : {}) },
        body: JSON.stringify({ command, kookUserId: '12345', channelId: '12345', isAdmin: actor.admin }) }));
    },
  };
}
test('bot authentication precedes data access; read commands never queue collection or scheduling', async () => {
  const h = routeHarness(); assert.equal((await h.command('!split2 standings', false)).status, 401);
  assert.equal(h.calls.views, 0);
  for (const command of ['standings', 'fixtures', 'fixtures all', 'remaining', 'results', 'report', 'help']) {
    const r = await h.command('!split2 ' + command); assert.equal(r.status, 200); assert.ok((await r.json()).reply);
  }
  assert.equal(h.calls.actors, 0); assert.equal(h.calls.queues, 0); assert.equal(h.calls.schedules, 0);
});
test('completed fixtures and published Bo3 games cannot queue another collection', async () => {
  const h = routeHarness(); const r = await h.command('!split2 report RR01 1234567890');
  assert.match((await r.json()).reply, /Already reported/);
  assert.equal(h.calls.actors, 0); assert.equal(h.calls.queues, 0);
  h.view.fixtures[1].bestOf = 3; h.view.fixtures[1].homeScore = 1;
  h.view.reports.push({ id: 'bo3-first', fixtureId: 'RR02', gameNumber: 1, status: 'APPROVED', payload: { winnerTeamId: 'zero', durationSeconds: 1234, playedAt: '2026-11-04T00:00:00Z' } });
  const partial = await h.command('!split2 report RR02 1234567890 1');
  assert.match((await partial.json()).reply, /already published/); assert.equal(h.calls.queues, 0);
});
test('player report requests retain collection workflow; nonparticipant admins get the admin path', async () => {
  const h = routeHarness(); let r = await h.command('!split2 report RR02 1234567890');
  assert.match((await r.json()).reply, /Collection queued/); assert.equal(h.calls.queues, 1);
  h.setActor({ admin: true, profileId: 'unrelated-admin' });
  r = await h.command('!split2 report RR02 1234567890');
  assert.match((await r.json()).reply, /without having played/); assert.equal(h.calls.queues, 1);
  h.setActor({ admin: true, profileId: 'floater-admin' }, true);
  r = await h.command('!split2 report RR02 1234567890');
  assert.match((await r.json()).reply, /Collection queued/); assert.equal(h.calls.queues, 2);
});
