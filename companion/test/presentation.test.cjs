const test = require('node:test');
const assert = require('node:assert/strict');
const { position, rankLabel, serverLabel, updateLabel, reportStage } = require('../src/presentation.cjs');
const { Account, scoreboard, leaderboard } = require('../src/account.cjs');
const { PublicData } = require('../src/public.cjs');

test('rank/server display is localized without changing saved source data', () => {
  assert.equal(rankLabel('\u94c2\u91d1I'), 'Platinum I');
  assert.equal(rankLabel('\u94c2\u91d1\u2161'), 'Platinum II');
  assert.equal(rankLabel('\u6d41\u5149\u7fe1\u7fe0IV'), 'Emerald IV');
  assert.equal(rankLabel('\u50b2\u4e16\u5b97\u5e08'), 'Grandmaster');
  assert.equal(rankLabel('\u94c2\u91d1I', true), '\u94c2\u91d1I');
  assert.equal(rankLabel('Diamond II'), 'Diamond II');
  const servers = [{ name: 'Ionia', chineseName: '\u827e\u6b27\u5c3c\u4e9a' }];
  assert.equal(serverLabel(servers[0].chineseName, servers), 'Ionia');
  assert.equal(serverLabel('Ionia', servers, true), servers[0].chineseName);
});
test('role assets use only known reported positions, never guessed champion roles', () => {
  assert.deepEqual(position('JNG'), position('jungle'));
  assert.deepEqual(position('SUPP'), ['support', 'Support']);
  assert.deepEqual(position('BOTTOM'), ['bot', 'Bottom']);
  for (const value of [null, '', 'Qiyana', '../../secret', 'UNKNOWN']) assert.equal(position(value), null);
});
test('footer and collection stages never invent successful checks or official approval', () => {
  for (const status of ['idle', 'checking', 'unavailable', 'invalid', 'development', 'typo']) assert.notEqual(updateLabel(status), 'Up to date');
  assert.equal(updateLabel('current'), 'Up to date');
  assert.equal(reportStage('123456', { status: 'review', job: { gameId: 'other' } }), 'Local copy');
  assert.equal(reportStage('123456', { status: 'review', job: { gameId: '123456' } }), 'Awaiting admin review');
  assert.equal(reportStage('123456', { status: 'uploading', job: { gameId: '123456' } }), 'Uploading');
});
test('full ladder is separate from the legacy top ten and limits champion metadata', async () => {
  const players = Array.from({ length: 33 }, (_, i) => ({ rank: i + 1, name: `Player ${i}`, elo: 1000 - i, gamesPlayed: 10, winRate: '60%', email: 'discard', championSource: 'ecl-snapshot', championsUpdatedAt: '2026-10-18T00:00:00Z', topChampions: [{ championId: '246', games: 5, wins: 3, puuid: 'discard' }, { championId: '../../x', games: 50 }, null] }));
  const data = new PublicData(async endpoint => endpoint === '/api/hub/ladder' ? JSON.stringify({ scope: 'all-time', coverage: 'full', players }) : endpoint === '/api/matches' ? '[]' : '<main></main>');
  await data.refresh();
  const state = data.snapshot();
  assert.equal(state.ladder.length, 33); assert.equal(state.ladderCoverage, 'full');
  assert.equal(state.ladder[0].topChampions.length, 1); assert.ok(!JSON.stringify(state).includes('discard'));
  data.read = async endpoint => endpoint === '/api/matches' ? '[]' : endpoint === '/api/hub/ladder' ? JSON.stringify({ scope: 'all-time', coverage: 'full', players: [] }) : '<main></main>';
  await data.refresh(); assert.deepEqual(data.snapshot().ladder, []); assert.equal(data.snapshot().ladderCoverage, 'full');
});
test('scoreboards minimize fields, preserve missing stats and reject old server responses', () => {
  const data = scoreboard({ scoreboard: { id: 'own', label: 'IH #028', players: [{ name: 'Player', championId: '246', role: 'MID', isWin: true, damage: null, kills: 10, puuid: 'private-puuid', email: 'private-email' }] } }, 'own');
  assert.equal(data.players[0].damage, null); assert.equal(data.players[0].kills, 10);
  assert.ok(!JSON.stringify(data).includes('private-'));
  assert.throws(() => scoreboard({ games: [] }, 'own'), /website/);
  assert.throws(() => scoreboard({ scoreboard: { id: 'other', players: [] } }, 'own'));
});
test('scoreboard full-unit schema preserves MVP/SVP, zeros and unknowns; old responses cannot display K values as full units', () => {
  const source = { id: 'own', players: [{ name: 'Player', championId: '246', role: 'MID', isWin: true, damage: 4904, gold: 4237, vision: null, kills: 0, isMVP: true, isSVP: false, damageApproximate: false }] };
  const old = scoreboard({ scoreboard: source }, 'own');
  assert.equal(old.players[0].damage, null); assert.equal(old.players[0].gold, null);
  const detail = scoreboard({ scoreboard: { ...source, metricsVersion: 2 } }, 'own');
  assert.equal(detail.players[0].damage, 4904); assert.equal(detail.players[0].gold, 4237);
  assert.equal(detail.players[0].isMVP, true); assert.equal(detail.players[0].kills, 0); assert.equal(detail.players[0].vision, null);
});
test('ladder champion picks require the League snapshot source, never substitute inhouse picks', () => {
  const row = { name: 'Player', topChampions: [{ championId: '246', games: 10, wins: 9 }] };
  assert.deepEqual(leaderboard([row])[0].topChampions, []);
  const result = leaderboard([{ ...row, championSource: 'ecl-snapshot', championsUpdatedAt: '2026-10-18T00:00:00Z' }])[0];
  assert.deepEqual(result.topChampions, [{ championId: '246', games: 10 }]);
  assert.equal(result.championsUpdatedAt, '2026-10-18T00:00:00Z');
});
test('website news changes arrive through refresh without updating the app binary', async () => {
  let title = 'Old patch';
  const data = new PublicData(async endpoint => endpoint === '/news' ? `<main><article><h2>${title}</h2><time>Oct 18, 2026</time></article></main>` : endpoint === '/api/matches' ? '[]' : '<main></main>');
  await data.refresh(); assert.equal(data.snapshot().items[0].title, 'Old patch');
  title = 'New patch'; await data.refresh();
  assert.equal(data.snapshot().items[0].title, 'New patch');
  assert.equal(data.snapshot().items[0].category, 'patch');
});
test('private detail reads require an own listed match and discard results after account changes', async () => {
  let finish; let calls = 0;
  const account = new Account({ configured: false }, {} , { read: async () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  account.data.authenticated = true; account.data.games = [{ id: 'own' }];
  account.client = { auth: { getSession: async () => ({ data: { session: { access_token: 'private-token' } } }) } };
  await assert.rejects(account.matchDetail('other'), /own/); assert.equal(calls, 0);
  const pending = account.matchDetail('own');
  await new Promise(resolve => setImmediate(resolve));
  account.epoch++; account.data.authenticated = false;
  finish({ scoreboard: { id: 'own', players: [{ name: 'Private' }] } });
  await assert.rejects(pending, /Account changed/);
});
