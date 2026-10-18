const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { Preferences } = require('../src/preferences.cjs');
const { PublicData, publicLink, readPage, news, events, ladder, fixtures } = require('../src/public.cjs');
const { Updates, validRelease, trustedPolicy, FEED, restartBlocker } = require('../src/updates.cjs');
const { updatePolicy } = require('../config.cjs');
const release = () => ({ version: '0.6.0', files: [{ url: 'ECL-Hub-Setup-0.6.0.exe', sha512: Buffer.alloc(64, 7).toString('base64') }] });
test('packaged update trust is explicit and must match actual updater metadata', () => {
  assert.equal(updatePolicy({ signExecutable: false, signtoolOptions: { publisherName: 'Example' } }).trusted, false);
  assert.equal(updatePolicy({}).trusted, false);
  const policy = updatePolicy({ signtoolOptions: { publisherName: 'Example' }, verifyUpdateCodeSignature: true });
  const metadata = `provider: generic\nurl: ${FEED}\npublisherName: Example\n`;
  assert.equal(trustedPolicy(policy, metadata), true);
  assert.equal(trustedPolicy(policy, metadata.replace('publisherName: Example', 'publisherName: Wrong')), false);
  assert.equal(trustedPolicy(policy, metadata.replace(FEED, 'https://evil.com/')), false);
  assert.equal(trustedPolicy(policy, 'provider: generic'), false);
  assert.equal(trustedPolicy(updatePolicy({}), metadata), false);
});
test('language is validated, persisted and contains no account data', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-preferences-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const pref = await new Preferences(directory).init(); assert.equal(pref.language, 'en');
  await pref.setLanguage('zh-CN'); assert.equal((await new Preferences(directory).init()).language, 'zh-CN');
  await assert.rejects(pref.setLanguage('../../x'), /Unsupported/);
  assert.deepEqual(JSON.parse(await fs.readFile(pref.file, 'utf8')), { language: 'zh-CN' });
});
test('public feeds parse text, not scripts or active HTML, and preserve published dates', () => {
  const rows = news('<main><article><span>Oct 17, 2026</span><h2>Patch 0.5</h2><p>A published description that is long enough to serve as this example news paragraph in the feed.</p><script>private-token</script></article></main>');
  assert.equal(rows.length, 1); assert.equal(rows[0].category, 'patch'); assert.equal(rows[0].date, 'Oct 17, 2026');
  assert.ok(!JSON.stringify(rows).includes('private-token'));
  const e = events('<main><a href="/tournaments/split-one"><h2>Split One</h2><span>Archived</span><p>Old tournament.</p></a><a href="https://evil.com"><h2>Bad</h2></a></main>', '<a href="/split-ii">Split II registration</a>');
  assert.equal(e.length, 2); assert.equal(e[0].url, 'https://eclchina.lol/split-ii'); assert.equal(e[1].status, 'Archive');
});
test('ladder parser matches the actual website record columns and rejects other tables', () => {
  const html = '<table><thead><tr><th>Rank</th><th>Player</th><th>ELO</th><th>Record</th><th>Win %</th><th>Streak</th><th>Role</th></tr></thead><tbody><tr><td>#1</td><td><a><p>Display name</p><p>Riot#123</p></a></td><td>1,200</td><td><span>12</span>-<span>8</span></td><td>60%</td><td>W2</td><td>Jungle</td></tr></tbody></table>';
  const rows = ladder(html); assert.equal(rows.length, 1); assert.equal(rows[0].name, 'Display name'); assert.equal(rows[0].elo, 1200); assert.equal(rows[0].games, 20); assert.equal(rows[0].wins, 12);
  assert.deepEqual(ladder(html.replace('<th>ELO</th>', '<th>Other</th>')), []);
});
test('public website reads and external links cannot target arbitrary origins or send credentials', async () => {
  const calls = [];
  const transport = async (url, options) => { calls.push([url, options]); return new Response('<main>Public</main>'); };
  await readPage('/news', transport); assert.equal(calls[0][1].method, 'GET'); assert.equal(calls[0][1].redirect, 'error'); assert.equal(calls[0][1].headers.Authorization, undefined);
  await assert.rejects(readPage('/api/account/profile', transport));
  for (const url of ['https://evil.com/news', 'javascript:alert(1)', '//evil.com/news', 'https://user@eclchina.lol/news', '/account']) assert.equal(publicLink(url), '');
  assert.equal(publicLink('/news'), 'https://eclchina.lol/news');
});
test('unavailable public feeds report an error and do not fabricate news or standings', async () => {
  const data = new PublicData(async () => { throw new Error('private-server-error'); });
  await data.refresh(); const value = data.snapshot(); assert.equal(value.loading, false); assert.deepEqual(value.items, []); assert.deepEqual(value.ladder, []); assert.ok(value.error); assert.ok(!JSON.stringify(value).includes('private-server-error'));
});
test('fixtures include only dated future scheduled matches, sorted and minimized', () => {
  const now = Date.parse('2026-10-17T10:00:00Z');
  const match = (id, date, status = 'SCHEDULED') => ({ id, scheduledAt: date, status, bestOf: 3, roundLabel: 'Round 1', homeTeam: { name: 'Blue', private: 'discard' }, awayTeam: { name: 'Red' }, notes: 'private-note' });
  const value = fixtures([
    match('later', '2026-10-20T10:00:00Z'), match('next', '2026-10-18T10:00:00Z'),
    match('past', '2026-10-16T10:00:00Z'), match('invalid', 'bad'), match('undated', null),
    ...['COMPLETED', 'FORFEIT', 'POSTPONED', 'CANCELLED'].map(status => match(status, '2026-10-20T10:00:00Z', status)),
    match('later', '2026-10-20T10:00:00Z'), null,
  ], now);
  assert.deepEqual(value.map(row => row.id), ['next', 'later']);
  assert.equal(value[0].home, 'Blue'); assert.equal(value[0].bestOf, 3);
  assert.ok(!JSON.stringify(value).includes('private')); assert.throws(() => fixtures({ error: 'bad' }));
});
test('public fixture reads use the existing fixed GET endpoint without authentication', async () => {
  let call;
  await readPage('/api/matches', async (url, options) => { call = { url, options }; return new Response('[]'); });
  assert.equal(call.url, 'https://eclchina.lol/api/matches'); assert.equal(call.options.method, 'GET');
  assert.equal(call.options.headers.Accept, 'application/json'); assert.equal(call.options.headers.Authorization, undefined);
  const data = new PublicData(async endpoint => endpoint === '/api/matches' ? '[]' : '<main></main>');
  await data.refresh(); assert.deepEqual(data.snapshot().fixtures, []); assert.equal(data.snapshot().fixturesError, ''); assert.ok(data.snapshot().fixturesUpdatedAt);
  data.data.fixtures = [{ id: 'stale' }];
  data.read = async () => { throw new Error('private-backend-response'); };
  await data.refresh(); assert.deepEqual(data.snapshot().fixtures, []); assert.match(data.snapshot().fixturesError, /unavailable/);
  assert.ok(!JSON.stringify(data.snapshot()).includes('private-backend-response'));
});
function engine() {
  const updater = new EventEmitter(); updater.downloads = 0; updater.installs = 0;
  updater.checkForUpdates = async () => updater.emit('update-available', release());
  updater.downloadUpdate = async () => { updater.downloads++; updater.emit('download-progress', { percent: 50 }); updater.emit('update-downloaded', release()); };
  updater.quitAndInstall = () => updater.installs++;
  return updater;
}
test('update checking never auto-downloads or auto-installs; unsigned builds cannot install', async () => {
  const updater = engine(), updates = new Updates(updater, { enabled: true, trusted: false });
  await updates.check(); assert.equal(updates.snapshot().status, 'available'); assert.equal(updater.autoDownload, false); assert.equal(updater.autoInstallOnAppQuit, false); assert.equal(updater.downloads, 0);
  await assert.rejects(updates.download(), /Signed/); assert.throws(() => updates.install(), /verified/); assert.equal(updater.installs, 0);
});
test('trusted updates automatically download a valid same-site installer but never install automatically', async () => {
  const updater = engine(), updates = new Updates(updater, { enabled: true, trusted: true });
  await updates.check(); assert.equal(updates.snapshot().status, 'ready'); assert.equal(updater.downloads, 1); assert.equal(updater.installs, 0);
  updates.install(); assert.equal(updater.installs, 1);
});

test('restart requires fresh safe League status and idle collection and uploads', () => {
  const state = { connected: true, phase: 'Lobby', lastChecked: 100000, busy: false };
  assert.equal(restartBlocker(state, { busy: false }, 110000), '');
  for (const phase of ['InProgress', 'ChampSelect', 'GameStart', 'Reconnect', 'Connected', 'Unknown', 'Matchmaking', 'WaitingForStats']) assert.ok(restartBlocker({ ...state, phase }, {}, 110000));
  assert.ok(restartBlocker(state, { busy: true }, 110000));
  assert.ok(restartBlocker({ ...state, busy: true }, {}, 110000));
  assert.ok(restartBlocker(state, {}, 140000));
  assert.ok(restartBlocker({ ...state, lastChecked: null }, {}, 110000));
  assert.equal(restartBlocker({ ...state, connected: false, phase: 'Offline' }, {}, 110000), '');
});

test('failed background downloads are handled and a later check can retry', async () => {
  const updater = engine(); updater.downloadUpdate = async () => { updater.downloads++; throw new Error('private-host-error'); };
  const updates = new Updates(updater, { enabled: true, trusted: true });
  await updates.check(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates.snapshot().status, 'unavailable'); assert.equal(updater.installs, 0);
  await updates.check(); assert.equal(updater.downloads, 2);
  assert.ok(!JSON.stringify(updates.snapshot()).includes('private-host'));
});
test('invalid update files, traversal, origins, hashes and error bodies fail closed', async () => {
  for (const url of ['https://evil.com/ECL-Hub-Setup-0.6.0.exe', '../ECL-Hub-Setup-0.6.0.exe', 'http://eclchina.lol/ECL-Hub-Setup-0.6.0.exe', 'ECL-Hub-Setup-0.6.0.exe?token=x']) { const info = release(); info.files[0].url = url; assert.equal(validRelease(info), false); }
  const info = release(); info.files[0].sha512 = ''; assert.equal(validRelease(info), false);
  assert.equal(validRelease(release()), true); assert.match(FEED, /^https:\/\/eclchina\.lol\//);
  const updater = engine(), updates = new Updates(updater, { enabled: true, trusted: true });
  updater.emit('update-available', info); assert.equal(updates.snapshot().status, 'invalid'); await assert.rejects(updates.download());
  updater.emit('error', new Error('private-token')); assert.equal(updates.snapshot().status, 'unavailable'); assert.ok(!JSON.stringify(updates.snapshot()).includes('private-token'));
});
