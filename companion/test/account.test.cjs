const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { publicConfiguration } = require('../config.cjs');
const { SessionVault } = require('../src/vault.cjs');
const { Account, profile, history, leagueHistory, leaderboard, websiteGet, websiteRefresh } = require('../src/account.cjs');
const config = { configured: true, supabaseUrl: 'https://example.supabase.co', publicKey: 'public-test' };
test('ladder preserves website percentage strings and hides only unassigned team tags', () => {
  const rows = leaderboard([
    { name: 'A', winRate: '68%', teamTag: 'FA' },
    { name: 'B', winRate: '0%', teamTag: 'Actual team' },
    { name: 'C', winRate: 42.5, teamTag: ' fa ' },
    ...[null, '', '-', '101%', 'bad', undefined, true, []].map(value => ({ winRate: value })),
  ]);
  assert.equal(rows[0].winRate, 68); assert.equal(rows[0].team, '');
  assert.equal(rows[1].winRate, 0); assert.equal(rows[1].team, 'Actual team');
  assert.equal(rows[2].winRate, 42.5); assert.equal(rows[2].team, '');
  for (const row of rows.slice(3)) assert.equal(row.winRate, null);
});
const jwt = role => `a.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.b`;

test('packaging only accepts public client credentials and rejects privileged keys', () => {
  assert.deepEqual(publicConfiguration({}), { configured: false });
  const result = publicConfiguration({ NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'), DATABASE_URL: 'server-only', ECL_REPORT_ENGINE_SECRET: 'worker-secret' });
  assert.deepEqual(Object.keys(result).sort(), ['configured', 'publicKey', 'supabaseUrl']);
  for (const key of [jwt('service_role'), 'sb_secret_forbidden', 'garbage']) assert.throws(() => publicConfiguration({ NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }));
  for (const url of ['http://example.supabase.co', 'https://example.com', 'https://x@example.supabase.co', 'https://example.supabase.co:444', 'https://example.supabase.co/path']) assert.throws(() => publicConfiguration({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') }));
});
async function directory(t) {
  const location = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-account-test-'));
  t.after(() => fs.rm(location, { recursive: true, force: true })); return location;
}
function encryption() {
  const key = crypto.randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(value) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); },
    decryptString(value) { const decipher = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); decipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8'); },
  };
}
test('desktop session is encrypted at rest, restorable and removable', async t => {
  const location = await directory(t), engine = encryption();
  const vault = new SessionVault(location, engine);
  await vault.setItem('auth-session', 'private-access-and-refresh-token');
  const stored = await fs.readFile(vault.file('auth-session'));
  assert.ok(!stored.includes(Buffer.from('private-access-and-refresh-token')));
  const restored = new SessionVault(location, engine);
  assert.equal(await restored.getItem('auth-session'), 'private-access-and-refresh-token');
  await restored.removeItem('auth-session');
  assert.equal(await new SessionVault(location, engine).getItem('auth-session'), null);
});
test('no secure storage means no plaintext disk fallback', async t => {
  const location = path.join(await directory(t), 'vault');
  const vault = new SessionVault(location, { isEncryptionAvailable: () => false });
  await vault.setItem('auth-session', 'private-token');
  assert.equal(vault.persistent, false); assert.equal(await vault.getItem('auth-session'), 'private-token');
  await assert.rejects(fs.stat(location), { code: 'ENOENT' });
});

test('remember me disabled removes saved sessions and keeps subsequent tokens in memory only', async t => {
  const location = await directory(t), engine = encryption();
  const vault = new SessionVault(location, engine);
  await vault.setItem('auth-session', 'old-session');
  await vault.setRemember(false, ['auth-session']);
  await vault.setItem('auth-session', 'new-memory-only-session');
  assert.equal(await vault.getItem('auth-session'), 'new-memory-only-session');
  assert.equal(await new SessionVault(location, engine).getItem('auth-session'), null);
  assert.deepEqual(await fs.readdir(location), []);
  await vault.setRemember(true);
  await vault.setItem('auth-session', 'remembered-session');
  assert.equal(await new SessionVault(location, engine).getItem('auth-session'), 'remembered-session');
});
test('an unreadable desktop session requests a new sign-in without exposing file contents', async t => {
  const vault = new SessionVault(await directory(t), encryption());
  await fs.writeFile(vault.file('auth-session'), 'bad-secret-data');
  assert.equal(await vault.getItem('auth-session'), null);
  assert.match(vault.warning, /sign in again/); assert.ok(!vault.warning.includes('bad-secret'));
});
test('profile transfer is minimized and refuses third-party avatars', () => {
  const value = profile({ displayName: 'A', riotName: 'B', email: 'private@example.com', wechatId: 'private-contact', access_token: 'private-token', avatarUrl: 'https://tracker.example.com/pixel' });
  assert.equal(value.avatar, '');
  assert.ok(!JSON.stringify(value).includes('private-'));
  assert.equal(profile({ avatarUrl: '/\\tracker.example.com/pixel' }).avatar, '');
  assert.equal(profile({ avatarUrl: '/uploads/avatar.png' }).avatar, 'https://eclchina.lol/uploads/avatar.png');
});

test('avatars within the website upload limit are not truncated or silently discarded', () => {
  const image = `data:image/png;base64,${Buffer.alloc(350000, 1).toString('base64')}`;
  assert.ok(image.length > 400000);
  assert.equal(profile({ avatarUrl: image }).avatar, image);
  assert.equal(profile({ avatarUrl: `data:image/svg+xml;base64,AAAA` }).avatar, '');
  assert.equal(profile({ avatarUrl: 'x'.repeat(5600000) }).avatar, '');
});

test('Lzyumi snapshots stay separate, deduplicate and do not expose raw HTML or identifiers', () => {
  const raw = { soloGames: [
    { gameId: 'a', championId: '7', title: 'Solo <br>8.1(10-3-8)', titleTime: '10-17 12:10:00\u3010\u4e2d\u3011', isWin: 1, wasMvp: 'mvp', openId: 'private-secret' },
    { gameId: 'missing-stats', championId: '../../bad', isWin: 0 },
  ], flexGames: [{ gameId: 'a' }, { gameId: 'b', titleTime: '10-16 19:10:00', isWin: 2 }] };
  const rows = leagueHistory(raw);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].kills, 10); assert.equal(rows[0].role, 'MID'); assert.equal(rows[0].queue, 'solo');
  assert.equal(rows[1].queue, 'flex'); assert.equal(rows[1].isWin, false);
  assert.equal(rows[2].kills, null); assert.equal(rows[2].championId, ''); assert.equal(rows[2].isWin, null);
  assert.ok(!JSON.stringify(rows).includes('private-secret')); assert.ok(!JSON.stringify(rows).includes('<br>'));
  assert.deepEqual(leagueHistory(null), []);
});
test('website reads are GET-only on a fixed origin with redirects forbidden', async () => {
  const calls = [];
  const transport = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ profile: {} }), { status: 200 }); };
  await websiteGet('/api/account/profile', 'private-token', transport);
  assert.equal(calls[0].url, 'https://eclchina.lol/api/account/profile');
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer private-token');
  await assert.rejects(websiteGet('https://evil.example.com', 'private-token', transport));
  assert.equal(calls.length, 1);
});
test('undeployed HTML reporting endpoints preserve HTTP status without exposing remote bodies', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { account } = mockAccount(async () => []); account.data.authenticated = true;
  global.fetch = async () => new Response('<html>private-proxy-diagnostic</html>', { status: 404 });
  await assert.rejects(account.desktopRequest({ action: 'link' }), error => error.status === 404 && !error.message.includes('private-proxy'));
});
function mockAccount(read, signedIn = true, refreshStats = async () => ({ ok: true, status: 'cooldown' })) {
  let active = signedIn;
  const auth = {
    startAutoRefresh() {}, stopAutoRefresh() {},
    getSession: async () => ({ data: { session: active ? { access_token: 'private-token', user: { id: 'test-user' } } : null }, error: null }),
    signInWithPassword: async () => { active = true; return { error: null }; },
    signOut: async () => { active = false; return { error: null }; },
  };
  const account = new Account(config, { persistent: true, remember: true, warning: '', removeItem: async () => {}, async setRemember(value) { this.remember = value; } }, { createClient: () => ({ auth }), read, refreshStats });
  return { account, auth };
}
test('signed-out dashboard only requests public standings', async () => {
  const calls = [];
  const { account } = mockAccount(async endpoint => { calls.push(endpoint); return []; }, false);
  await account.refresh(); assert.deepEqual(calls, ['/api/leaderboard']);
  assert.equal(account.snapshot().authenticated, false);
});

test('League profile includes separate solo/flex ranks and minimized champion counts', () => {
  const value = profile({ lzyumiRawProfile: { battleInfo: { mapOneInfoList: [
    { type: 'Solo/Duo', tier: 'Platinum III', winPoint: 35, token: 'private-token' },
    { type: 'Flex', tier: 'Diamond IV', winPoint: 5 },
  ] } }, lzyumiRecentStat: { data: { recentState: { common_use_champions: [{ key: 59, value: 12, puuid: 'private-puuid' }] } } } });
  assert.equal(value.soloRank.tier, 'Platinum III'); assert.equal(value.flexRank.lp, 5);
  assert.deepEqual(value.leagueChampions, [{ championId: '59', games: 12 }]);
  assert.ok(!JSON.stringify(value).includes('private-'));
});

test('stale profile renders immediately, refreshes once in the background and reloads updated data', async () => {
  let finish, refreshes = 0, refreshed = false;
  const pending = new Promise(resolve => { finish = resolve; });
  const { account } = mockAccount(async endpoint => endpoint === '/api/account/profile' ? { profile: { riotName: 'Player', chinaServerId: 1, currentRank: refreshed ? 'Gold' : 'Silver' } } : [], true, async () => { refreshes++; await pending; refreshed = true; return { ok: true, status: 'updated' }; });
  await account.refresh(); assert.equal(account.snapshot().profile.currentRank, 'Silver'); assert.equal(account.snapshot().leagueRefreshing, true);
  await account.refresh(); assert.equal(refreshes, 1);
  finish(); for (let i = 0; i < 10 && account.data.leagueRefreshing; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(account.snapshot().profile.currentRank, 'Gold'); assert.equal(account.snapshot().leagueRefreshing, false);
  await account.refresh(); assert.equal(refreshes, 1);
});

test('fresh snapshots do not contact provider, failures preserve saved stats and logout discards late results', async () => {
  let fail = false, finish;
  const { account } = mockAccount(async endpoint => endpoint === '/api/account/profile' ? { profile: { riotName: 'Player', chinaServerId: 1, currentRank: 'Gold', lzyumiLastLookupAt: fail ? null : new Date().toISOString() } } : [], true, async () => { if (fail) throw new Error('private-provider-body'); });
  await account.refresh(); assert.equal(account.snapshot().leagueRefreshError, '');
  fail = true; await account.refresh(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(account.snapshot().profile.currentRank, 'Gold'); assert.match(account.snapshot().leagueRefreshError, /saved/);
  assert.ok(!JSON.stringify(account.snapshot()).includes('private-provider'));
  account.leagueAttempt = null;
  account.refreshStats = () => new Promise(resolve => { finish = resolve; });
  await account.refresh(); await account.logout(); finish({ ok: true, status: 'updated' }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(account.snapshot().profile, null); assert.equal(account.snapshot().leagueRefreshing, false);
});

test('snapshot refresh sends only a bearer-authenticated POST to the fixed website', async () => {
  let call;
  assert.deepEqual(await websiteRefresh('private-token', async (url, options) => { call = { url, options }; return new Response('{"ok":true,"status":"updated"}'); }), { ok: true, status: 'updated' });
  assert.equal(call.url, 'https://eclchina.lol/api/account/refresh-stats?ifStale=1');
  assert.equal(call.options.method, 'POST'); assert.equal(call.options.redirect, 'error'); assert.equal(call.options.body, undefined);
  await assert.rejects(websiteRefresh('private-token', async () => new Response('private-body', { status: 502 })), error => !error.message.includes('private-body'));
});
test('signed-in native screens reuse existing APIs without passing tokens to the renderer', async () => {
  const calls = [];
  const { account } = mockAccount(async (endpoint, token) => {
    calls.push([endpoint, token]);
    if (endpoint === '/api/account/profile') return { profile: { displayName: 'Test player', email: 'private-email', wechatId: 'private-contact', lzyumiRankedGames: { soloGames: [{ gameId: 'solo-game', championId: '7', isWin: 1 }] } } };
    if (endpoint === '/api/hub/my-inhouse-history') return { games: [{ id: 'game-1', kills: 10, isWin: true }], summary: { games: 1, wins: 1, averageKda: 5 } };
    return [{ name: 'Published player', rank: 1 }];
  });
  await account.refresh();
  assert.equal(account.snapshot().profile.displayName, 'Test player');
  assert.equal(account.snapshot().games.length, 1);
  assert.equal(account.snapshot().leagueGames[0].id, 'solo-game');
  assert.ok(!JSON.stringify(account.snapshot()).includes('private-'));
  assert.equal(calls.find(([endpoint]) => endpoint === '/api/account/profile')[1], 'private-token');
  assert.equal(calls.find(([endpoint]) => endpoint === '/api/leaderboard')[1], undefined);
});

test('login forwards remember choice without saving the password and rejects malformed preferences', async () => {
  const { account } = mockAccount(async () => [], false);
  await account.login('user@example.com', 'private-password', false);
  assert.equal(account.snapshot().persistentSession, false);
  assert.equal(account.snapshot().secureStorage, true);
  assert.ok(!JSON.stringify(account.snapshot()).includes('private-password'));
  await assert.rejects(account.login('user@example.com', 'private-password', 'false'), /remember/);
});
test('in-flight profile requests cannot repopulate a signed-out workspace', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { account } = mockAccount(async endpoint => endpoint === '/api/account/profile' ? pending : endpoint === '/api/leaderboard' ? [] : { games: [] });
  const request = account.refresh();
  await new Promise(resolve => setImmediate(resolve)); await account.logout();
  release({ profile: { displayName: 'Old account' } }); await request;
  assert.equal(account.snapshot().authenticated, false); assert.equal(account.snapshot().profile, null);
});
test('401 clears private data and malformed history cannot inject arbitrary fields', async () => {
  const { account } = mockAccount(async endpoint => {
    if (endpoint === '/api/leaderboard') return [];
    const error = new Error('private-server-diagnostic'); error.status = 401; throw error;
  });
  await account.refresh(); assert.equal(account.snapshot().authenticated, false); assert.equal(account.snapshot().profile, null);
  assert.deepEqual(account.snapshot().leagueGames, []);
  assert.ok(!JSON.stringify(account.snapshot()).includes('private-server'));
  const normalized = history({ games: [{ id: 'a', championId: '../../x', access_token: 'bad', kills: 'NaN' }] });
  assert.equal(normalized.games[0].championId, ''); assert.equal(normalized.games[0].kills, 0); assert.ok(!JSON.stringify(normalized).includes('access_token'));
});
test('login failures never echo the supplied email, password or upstream error body', async () => {
  const { account, auth } = mockAccount(async () => [], false);
  auth.signInWithPassword = async () => ({ error: { message: 'private-password' } });
  await assert.rejects(account.login('user@example.com', 'private-password'), error => !error.message.includes('private-password') && /not accepted/.test(error.message));
});
test('offline sign-out removes all known desktop session keys', async () => {
  const { account, auth } = mockAccount(async () => []);
  const removed = [];
  account.vault.removeItem = async key => { removed.push(key); };
  auth.signOut = async () => ({ error: new Error('offline') });
  await account.logout();
  assert.equal(account.snapshot().authenticated, false);
  assert.deepEqual(removed, ['ecl-hub-desktop-session', 'ecl-hub-desktop-session-user', 'ecl-hub-desktop-session-code-verifier']);
  assert.match(account.snapshot().error, /Signed out on this PC/);
});
test('overlapping authentication actions are rejected', async () => {
  const { account, auth } = mockAccount(async () => []);
  let finish;
  auth.signInWithPassword = () => new Promise(resolve => { finish = resolve; });
  const pending = account.login('user@example.com', 'test-password');
  await assert.rejects(account.logout(), /already running/);
  await assert.rejects(account.login('user@example.com', 'other-password'), /already running/);
  finish({ error: null }); await pending;
  assert.equal(account.snapshot().authBusy, false);
});
test('desktop transport uses one HTTPS endpoint, fresh bearer authorization and bounded JSON without renderer credentials', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { account } = mockAccount(async () => []); account.data.authenticated = true;
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ ok: true, status: 'REVIEW_REQUIRED' })); };
  await account.desktopRequest({ action: 'submit', jobId: 'synthetic', raw: { gameId: '11363615233' } }, 'private-capability');
  assert.equal(calls[0].url, 'https://eclchina.lol/api/desktop/reports');
  assert.equal(calls[0].options.method, 'POST'); assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer private-token'); assert.equal(calls[0].options.headers['x-ecl-desktop-link'], 'private-capability');
  assert.ok(!calls[0].options.body.includes('private-token')); assert.ok(!JSON.stringify(account.snapshot()).includes('private-capability'));
  await assert.rejects(account.desktopRequest({ action: 'other' }));
  await assert.rejects(account.desktopRequest({ action: 'submit', raw: 'x'.repeat(2 * 1024 * 1024) }));
  account.data.authenticated = false; await assert.rejects(account.desktopRequest({ action: 'claim' }));
  assert.equal(calls.length, 1);
});
