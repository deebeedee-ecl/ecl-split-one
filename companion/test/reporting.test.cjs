const test = require('node:test');
const assert = require('node:assert/strict');
const { Reporting } = require('../src/reporting.cjs');
const { preview } = require('../src/demo.cjs');
function setup(t, handler) {
  const calls = [];
  const account = { epoch: 1, data: { authenticated: true }, async desktopRequest(body) {
    calls.push(body); if (handler) return handler(body);
    if (body.action === 'link') return { capability: 'private-test-capability', expiresAt: Date.now() + 600000 };
    if (body.action === 'claim') return { job: { id: 'job-1', gameId: '11363615233', lease: 'private-test-lease', label: 'IH #027', expiresAt: Date.now() + 120000 } };
    return { status: 'REVIEW_REQUIRED' };
  } };
  const collector = { connection: { profile: { puuid: 'fake-puuid', gameName: 'Player', tagLine: 'TEST' } }, db: { matches: [{ key: 'local-match' }] }, async enqueue() { return 'local-match'; }, async tick() {}, async readMatch() { return { validation: { candidate: true }, raw: { gameId: '11363615233' } }; } };
  const reporter = new Reporting(account, collector); t.after(() => reporter.dispose());
  return { reporter, account, collector, calls };
}
async function settled(reporter) { for (let i = 0; i < 50 && reporter.busy; i++) await new Promise(resolve => setImmediate(resolve)); }
test('reporting defaults off and never polls/uploads before connection consent', async t => {
  const { reporter, calls } = setup(t); await reporter.tick(); assert.equal(calls.length, 0); assert.equal(reporter.snapshot().enabled, false);
});
test('only assigned match is uploaded and state never exposes authorization or raw records', async t => {
  const { reporter, calls } = setup(t); await reporter.connect(); await settled(reporter);
  assert.deepEqual(calls.map(c => c.action), ['link', 'claim', 'submit']);
  assert.equal(calls[2].jobId, 'job-1'); assert.equal(reporter.snapshot().status, 'review');
  assert.ok(!JSON.stringify(reporter.snapshot()).includes('private-test')); assert.ok(!JSON.stringify(reporter.snapshot()).includes('fake-puuid'));
  reporter.disconnect(); await reporter.tick(); assert.equal(calls.length, 3);
});
test('logout or switching League account disconnects future uploads', async t => {
  const { reporter, account, collector, calls } = setup(t); await reporter.connect(); await settled(reporter);
  account.epoch++; await reporter.tick(); assert.equal(reporter.snapshot().enabled, false);
  await reporter.connect(); await settled(reporter); collector.connection.profile.puuid = 'other';
  const count = calls.length; await reporter.tick(); assert.equal(reporter.snapshot().enabled, false); assert.equal(calls.length, count);
});
test('disconnect during retrieval prevents submission and clears the capability', async t => {
  const { reporter, collector, calls } = setup(t); let release;
  collector.readMatch = () => new Promise(resolve => { release = resolve; });
  await reporter.connect(); for (let i = 0; i < 50 && !release; i++) await new Promise(resolve => setImmediate(resolve));
  reporter.disconnect(); release({ validation: { candidate: true }, raw: {} }); await settled(reporter);
  assert.equal(calls.some(c => c.action === 'submit'), false); assert.equal(reporter.link, null);
});
test('sample previews are complete ten-player scoreboards and can never be uploaded', async t => {
  const { reporter, collector, calls } = setup(t);
  const record = preview(); assert.equal(record.sample, true); assert.equal(record.players.length, 10);
  collector.readMatch = async () => record;
  await reporter.connect(); await settled(reporter); assert.equal(calls.some(c => c.action === 'submit'), false);
});
test('an undeployed server leaves reporting off with an explicit setup message', async t => {
  const { reporter } = setup(t, () => { const error = new Error('private-server-diagnostic'); error.status = 404; throw error; });
  await assert.rejects(reporter.connect(), /not enabled or deployed/);
  assert.equal(reporter.snapshot().enabled, false); assert.equal(reporter.link, null);
  assert.ok(!JSON.stringify(reporter.snapshot()).includes('private-server'));
});
test('disconnect while renewing authorization cannot restore a reporting capability', async t => {
  const { reporter, account } = setup(t);
  await reporter.connect(); await settled(reporter); reporter.link.expiresAt = 0;
  let release;
  account.desktopRequest = () => new Promise(resolve => { release = resolve; });
  const tick = reporter.tick(); reporter.disconnect();
  release({ capability: 'must-not-resurrect', expiresAt: Date.now() + 600000 }); await tick;
  assert.equal(reporter.link, null); assert.equal(reporter.snapshot().enabled, false);
});

for (const outcome of ['resolve', 'reject']) {
  test(`a late ${outcome} from an old reporting connection cannot disconnect the replacement session`, async t => {
    let finishOld, links = 0;
    const { reporter } = setup(t, body => {
      if (body.action === 'link') {
        links++;
        if (links === 1) return new Promise((resolve, reject) => {
          finishOld = () => outcome === 'resolve'
            ? resolve({ capability: 'old-capability', expiresAt: Date.now() + 600000 })
            : reject(new Error('Old connection failed'));
        });
        return { capability: 'new-capability', expiresAt: Date.now() + 600000 };
      }
      if (body.action === 'claim') return { job: null };
      throw new Error('No upload should occur');
    });
    const old = reporter.connect();
    await reporter.connect(); await settled(reporter);
    assert.equal(reporter.link.capability, 'new-capability');
    finishOld(); await old;
    assert.equal(reporter.snapshot().enabled, true);
    assert.equal(reporter.link.capability, 'new-capability');
  });
}
