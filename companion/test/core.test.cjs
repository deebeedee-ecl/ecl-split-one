const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Collector, validate, summarize, gameId, safeError, regionFor } = require('../src/core.cjs');
const { restartBlocker } = require('../src/updates.cjs');
const { fixture } = require('../src/demo.cjs');

test('30-day retention removes only expired local match files and their saved jobs', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-retention-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const now = 40 * 86400000, collector = await new Collector(directory, { now: () => now }).init();
  await fs.writeFile(path.join(directory, 'matches', 'old.json'), 'raw-private-data');
  await fs.writeFile(path.join(directory, 'matches', 'recent.json'), 'recent-data');
  await fs.writeFile(path.join(directory, 'outside.json'), 'untouched');
  collector.db.matches = [{ key: 'old', file: 'old.json', collectedAt: 10 * 86400000 }, { key: 'recent', file: 'recent.json', collectedAt: now }, { key: 'bad', file: '../outside.json', collectedAt: 0 }];
  collector.db.jobs = [{ key: 'old', status: 'saved' }, { key: 'pending', status: 'pending' }];
  await collector.pruneExpiredMatches();
  await assert.rejects(fs.stat(path.join(directory, 'matches', 'old.json')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(directory, 'outside.json'), 'utf8'), 'untouched');
  assert.equal(collector.db.matches.length, 2); assert.deepEqual(collector.db.jobs.map(j => j.key), ['pending']);
});

test('failed discovery clears a previously safe phase instead of allowing an update while status is unknown', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-state-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const collector = await new Collector(directory, { discover: async () => { throw new Error('League is still running but unavailable'); } }).init();
  collector.status.phase = 'Offline';
  await collector.tick();
  assert.equal(collector.snapshot().phase, 'Unknown'); assert.equal(collector.snapshot().connected, false);
});

test('only a complete custom ten-player match becomes a roster-check candidate', () => {
  assert.equal(validate(fixture()).candidate, true);
  const normal = fixture(); normal.gameType = 'MATCHED_GAME';
  assert.equal(validate(normal).complete, true);
  assert.equal(validate(normal).candidate, false);
  const aborted = fixture(); aborted.endOfGameResult = 'Abort_TooFewPlayers';
  assert.equal(validate(aborted).complete, false);
  assert.equal(validate(aborted).candidate, false);
  const unknown = fixture(); delete unknown.endOfGameResult;
  assert.equal(validate(unknown).candidate, false);
});
test('rejects missing, duplicated or mismatched players and invalid teams', () => {
  for (const mutate of [
    raw => { raw.participants.pop(); },
    raw => { raw.participants[0].participantId = 2; },
    raw => { raw.participantIdentities[0].participantId = 99; },
    raw => { raw.participantIdentities[0].player.puuid = ''; },
    raw => { raw.participantIdentities[0].player.puuid = raw.participantIdentities[1].player.puuid; },
    raw => { raw.participants[0].teamId = 200; },
    raw => { raw.teams = []; },
    raw => { raw.teams[1].win = 'Win'; },
    raw => { raw.gameDuration = 0; },
  ]) { const raw = fixture(); mutate(raw); assert.equal(validate(raw).candidate, false); }
});
test('joins identities by participant ID, not array position', () => {
  const raw = fixture(); raw.participantIdentities.reverse();
  assert.equal(summarize(raw)[0].name, 'Blue One#DEMO');
  assert.equal(summarize(raw).length, 10);
});
test('validates IDs and sanitizes credential-bearing errors', () => {
  assert.equal(gameId(' 11363615233 '), '11363615233');
  for (const id of ['', '../secret', 'a12345', '12', '123456789012345678901']) assert.throws(() => gameId(id));
  assert.ok(!safeError(new Error('token=private-token'), 'private-token').includes('private-token'));
  assert.ok(!safeError('bad --remoting-auth-token=secret123').includes('secret123'));
  assert.equal(regionFor({ platformId: '../../x' }), 'unknown');
});

async function setup(t, request) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-collector-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const connection = { port: 12345, token: 'never-save-this', profile: { puuid: 'sample-player-0', gameName: 'Test', platformId: 'HN1' } };
  const collector = await new Collector(directory, { discover: async () => connection, request }).init();
  collector.connection = connection;
  collector.db.autoCollect = true;
  return { collector, directory, connection };
}
test('deduplicates, persists complete raw JSON and does not persist local credentials', async t => {
  const raw = fixture();
  const { collector, directory } = await setup(t, async () => raw);
  const key = await collector.enqueue(raw.gameId);
  assert.equal(await collector.enqueue(raw.gameId), key);
  await collector.runJob();
  assert.equal(collector.db.jobs.length, 1);
  assert.equal(collector.db.jobs[0].status, 'saved');
  assert.equal((await collector.readMatch(key)).raw.participants.length, 10);
  assert.equal(collector.db.matches[0].validation.candidate, true);
  const state = await fs.readFile(path.join(directory, 'state.json'), 'utf8');
  assert.ok(!state.includes('never-save-this'));
  const restored = await new Collector(directory).init();
  assert.equal(restored.db.matches.length, 1);
});
test('queues failed requests with bounded retries and supports explicit retry', async t => {
  const { collector } = await setup(t, async () => { throw new Error('HTTP 503 token never-save-this'); });
  await collector.enqueue('11363615233');
  for (let i = 0; i < 5; i++) { collector.db.jobs[0].nextAttempt = 0; await collector.runJob(); }
  const job = collector.db.jobs[0];
  assert.equal(job.status, 'failed'); assert.equal(job.attempts, 5);
  assert.ok(!job.error.includes('never-save-this'));
  await collector.retry(job.key); assert.equal(job.status, 'pending'); assert.equal(job.attempts, 0);
});

test('expired LCU credentials block restart and pending collection recovers after an offline restart with new credentials', async t => {
  const { collector, connection, directory } = await setup(t, async () => {
    const error = new Error('LCU authentication expired'); error.status = 401; throw error;
  });
  await collector.enqueue('11363615233');
  Object.assign(collector.status, { connected: true, phase: 'Lobby', lastChecked: Date.now() });
  await collector.runJob();
  assert.equal(collector.connection, null);
  assert.equal(collector.snapshot().connected, false);
  assert.equal(collector.snapshot().phase, 'Unknown');
  assert.notEqual(restartBlocker(collector.snapshot(), { busy: false }), '');

  let available = null;
  const replacement = { ...connection, port: 23456, token: 'replacement-private-token' };
  const restored = await new Collector(directory, {
    discover: async () => available,
    request: async (actual, endpoint) => {
      assert.equal(actual.port, replacement.port); assert.equal(actual.token, replacement.token);
      if (endpoint.endsWith('/gameflow-phase')) return 'Lobby';
      if (endpoint.includes('matches?')) return { games: [] };
      return fixture();
    },
    now: () => Date.now() + 60000,
  }).init();
  await restored.tick();
  assert.equal(restored.db.jobs[0].status, 'retry');
  assert.equal(restored.db.jobs[0].attempts, 1);
  available = replacement;
  await restored.tick(); await restored.tick();
  assert.equal(restored.db.jobs[0].status, 'saved');
  assert.equal(restored.db.matches.length, 1);
  assert.equal((await restored.readMatch(restored.db.jobs[0].key)).raw.participants.length, 10);
  assert.ok(!(await fs.readFile(path.join(directory, 'state.json'), 'utf8')).includes(replacement.token));
});
test('does not run another account\'s pending jobs and rejects mismatched Game IDs', async t => {
  const { collector, connection } = await setup(t, async () => fixture('99999999999'));
  await collector.enqueue('11363615233');
  connection.profile.puuid = 'different-player'; await collector.runJob();
  assert.equal(collector.db.jobs[0].attempts, 0);
  connection.profile.puuid = 'sample-player-0'; await collector.runJob();
  assert.equal(collector.db.matches.length, 0); assert.match(collector.db.jobs[0].error, /different Game ID/);
});
test('a valid custom match without the collector in its roster is not a candidate', async t => {
  const { collector, connection } = await setup(t, async () => fixture());
  connection.profile.puuid = 'not-a-participant'; await collector.enqueue('11363615233'); await collector.runJob();
  assert.equal(collector.db.matches[0].validation.candidate, false);
});
test('not-yet-final match results remain retryable instead of being permanently deduplicated', async t => {
  const raw = fixture(); delete raw.endOfGameResult;
  const { collector } = await setup(t, async () => raw);
  await collector.enqueue(raw.gameId); await collector.runJob();
  assert.equal(collector.db.matches.length, 0);
  assert.equal(collector.db.jobs[0].status, 'retry');
});
test('recent discovery uses the proven 0..4 range and saves only once', async t => {
  const endpoints = [];
  const { collector } = await setup(t, async (_connection, endpoint) => {
    endpoints.push(endpoint);
    if (endpoint.endsWith('/gameflow-phase')) return 'Lobby';
    if (endpoint.includes('matches?')) return { games: { games: [{ gameId: '11363615233' }] } };
    return fixture();
  });
  await collector.tick(); await collector.tick();
  assert.ok(endpoints.includes('/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=4'));
  assert.equal(collector.db.matches.length, 1);
});
test('direct post-game discovery still queues a known ID when history is unavailable', async t => {
  let phase = 'InProgress';
  const { collector } = await setup(t, async (_connection, endpoint) => {
    if (endpoint.endsWith('/gameflow-phase')) return phase;
    if (endpoint.endsWith('/session')) return { gameData: { gameId: '11363615233' } };
    if (endpoint.includes('matches?')) throw new Error('HTTP 503');
    return fixture();
  });
  await collector.tick(); phase = 'EndOfGame'; await collector.tick();
  assert.equal(collector.db.matches.length, 1);
  assert.equal(collector.db.jobs[0].source, 'gameflow');
});
