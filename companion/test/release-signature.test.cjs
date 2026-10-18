const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { Updates, FEED } = require('../src/updates.cjs');
const { EclReleaseVerifier, SCOPE, publicKey, verifyEnvelope, readEnvelope } = require('../src/release-signature.cjs');
const { signInstaller } = require('../tools/sign-release.cjs');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-signature-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('ed25519');
  const pem = pub.export({ type: 'spki', format: 'pem' });
  const installer = path.join(directory, 'ECL-Hub-Setup-1.2.3.exe'), keyFile = path.join(directory, 'ephemeral-test.key');
  await fs.writeFile(installer, 'MZ synthetic installer - never executed');
  await fs.writeFile(keyFile, priv.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const envelopeFile = await signInstaller({ installer, version: '1.2.3', privateKeyFile: keyFile, outputDirectory: directory });
  const envelope = JSON.parse(await fs.readFile(envelopeFile, 'utf8'));
  const payload = verifyEnvelope(envelope, publicKey(pem));
  const info = { version: payload.version, files: [{ url: payload.file, sha512: payload.sha512, size: payload.size }] };
  return { directory, pub, priv, pem, installer, keyFile, envelope, payload, info };
}
function signed(payload, key) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return { payload: bytes.toString('base64'), signature: crypto.sign(null, bytes, key).toString('base64') };
}
async function settle(updates) { for (let i = 0; i < 100 && ['checking', 'available', 'downloading'].includes(updates.data.status); i++) await new Promise(resolve => setTimeout(resolve, 5)); }

test('Ed25519 verifier accepts only the pinned public key and exact signed release payload', async t => {
  const f = await fixture(t);
  assert.equal(f.payload.scope, SCOPE);
  assert.equal(f.payload.version, '1.2.3');
  assert.throws(() => publicKey(f.priv.export({ type: 'pkcs8', format: 'pem' })), /public Ed25519/);
  const other = crypto.generateKeyPairSync('ed25519');
  assert.throws(() => verifyEnvelope(f.envelope, other.publicKey), /rejected/);
  assert.throws(() => verifyEnvelope({ ...f.envelope, payload: Buffer.from(JSON.stringify({ ...f.payload, version: '9.9.9' })).toString('base64') }, f.pub), /rejected/);
  for (const change of [{ scope: 'another-app' }, { file: '../evil.exe' }, { size: 0 }, { version: '1.2.3-beta' }, { version: ['1.2.3'] }]) assert.throws(() => verifyEnvelope(signed({ ...f.payload, ...change }, f.priv), f.pub), /rejected/);
  await assert.rejects(signInstaller({ installer: f.installer, version: '1.2.3', privateKeyFile: f.keyFile, outputDirectory: f.directory }), { code: 'EEXIST' });
});
test('metadata cannot substitute hash, size, version, origin or web-installer packages', async t => {
  const f = await fixture(t); let requests = 0;
  const verifier = new EclReleaseVerifier(f.pem, async url => { requests++; assert.equal(url, `${FEED}ECL-Hub-Release-1.2.3.json`); return f.envelope; });
  await verifier.verifyRelease(f.info); await verifier.verifyFile(f.installer);
  for (const mutate of [
    i => { i.files[0].sha512 = Buffer.alloc(64, 1).toString('base64'); },
    i => { i.files[0].size++; }, i => { i.version = '9.9.9'; },
    i => { i.files[0].url = 'https://evil.example/file.exe'; }, i => { i.packages = {}; },
  ]) { const value = structuredClone(f.info); mutate(value); await assert.rejects(verifier.verifyRelease(value)); assert.equal(verifier.manifest, null); }
  assert.ok(requests >= 3);
  await verifier.verifyRelease(f.info);
  await fs.appendFile(f.installer, 'tampered'); await assert.rejects(verifier.verifyFile(f.installer), /check failed/);
});
test('signature fetching permits one public Blob redirect, never credentials, arbitrary origins or oversized bodies', async () => {
  const url = `${FEED}ECL-Hub-Release-1.2.3.json`, blob = 'https://example.public.blob.vercel-storage.com/ecl/ECL-Hub-Release-1.2.3.json';
  const calls = [];
  await readEnvelope(url, async (target, options) => { calls.push({ target, options }); return target === url ? new Response(null, { status: 307, headers: { location: blob } }) : new Response('{}'); });
  assert.equal(calls.length, 2); assert.equal(calls[1].target, blob); assert.equal(calls[1].options.headers.Authorization, undefined);
  for (const location of ['https://evil.example/a.json', blob + '?secret=x', 'http://example.public.blob.vercel-storage.com/ecl/ECL-Hub-Release-1.2.3.json']) await assert.rejects(readEnvelope(url, async () => new Response(null, { status: 307, headers: { location } })), /redirect/);
  await assert.rejects(readEnvelope(url, async () => new Response('x'.repeat(17000))), /unavailable/);
});
test('prototype update adapter verifies cached files and verifies again before installation', async t => {
  const f = await fixture(t), verifier = new EclReleaseVerifier(f.pem, async () => f.envelope);
  const engine = new EventEmitter(); let installs = 0, downloads = 0;
  engine.checkForUpdates = async () => engine.emit('update-available', f.info);
  engine.downloadUpdate = async () => { downloads++; engine.emit('update-downloaded', { version: '1.2.3', downloadedFile: f.installer }); };
  engine.quitAndInstall = () => installs++;
  const updates = new Updates(engine, { enabled: true, trusted: true, verifier }); t.after(() => updates.dispose());
  await updates.check(); await settle(updates);
  assert.equal(updates.snapshot().status, 'ready'); assert.equal(downloads, 1); assert.equal(installs, 0);
  assert.equal(await engine.verifyUpdateCodeSignature([], f.installer), null);
  let guards = 0; const installation = updates.install(() => guards++);
  assert.throws(() => updates.install(), /No verified/);
  await installation; assert.equal(installs, 1); assert.equal(guards, 1);
  await fs.writeFile(f.installer, 'tampered cache');
  await assert.rejects(updates.install(), /signature/); assert.equal(installs, 1); assert.equal(updates.snapshot().status, 'invalid');
});
test('bad signatures prevent downloads; modified cached installers never become ready', async t => {
  const f = await fixture(t), engine = new EventEmitter(); let downloads = 0;
  engine.checkForUpdates = async () => engine.emit('update-available', f.info);
  engine.downloadUpdate = async () => { downloads++; engine.emit('update-downloaded', { version: '1.2.3', downloadedFile: f.installer }); };
  const verifier = new EclReleaseVerifier(f.pem, async () => ({ ...f.envelope, signature: Buffer.alloc(64).toString('base64') }));
  const updates = new Updates(engine, { enabled: true, trusted: true, verifier }); t.after(() => updates.dispose());
  await updates.check(); await settle(updates); assert.equal(updates.snapshot().status, 'invalid'); assert.equal(downloads, 0);
  verifier.read = async () => f.envelope; await fs.writeFile(f.installer, 'bad');
  await updates.check(); await settle(updates); assert.equal(updates.snapshot().status, 'invalid'); assert.equal(downloads, 1);
});

test('an existing real installer can be signed and verified without executing or changing it', { skip: !process.env.ECL_REAL_INSTALLER }, async t => {
  const installer = path.resolve(process.env.ECL_REAL_INSTALLER);
  const match = /^ECL-Hub-Setup-(\d+\.\d+\.\d+)\.exe$/.exec(path.basename(installer)); assert.ok(match);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-real-signature-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('ed25519');
  const privateKeyFile = path.join(directory, 'ephemeral-test.key');
  await fs.writeFile(privateKeyFile, priv.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const before = await fs.stat(installer);
  const output = await signInstaller({ installer, version: match[1], privateKeyFile, outputDirectory: directory });
  const envelope = JSON.parse(await fs.readFile(output, 'utf8'));
  const payload = verifyEnvelope(envelope, pub);
  const verifier = new EclReleaseVerifier(pub.export({ type: 'spki', format: 'pem' }), async () => envelope);
  await verifier.verifyRelease({ version: match[1], files: [{ url: payload.file, sha512: payload.sha512, size: payload.size }] });
  await verifier.verifyFile(installer);
  const after = await fs.stat(installer);
  assert.equal(before.size, after.size); assert.equal(before.mtimeMs, after.mtimeMs);
  assert.ok(payload.size > 100 * 1024 * 1024);
});
