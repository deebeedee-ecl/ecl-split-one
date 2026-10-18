const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { initializeKey, loadKey, paths } = require('../tools/release-vault.cjs');
const { updatePolicy, loadUpdatePolicy } = require('../config.cjs');
const { trustedPolicy, FEED } = require('../src/updates.cjs');

function encryption() {
  const secret = crypto.randomBytes(32);
  return { isEncryptionAvailable: () => true,
    encryptString(text) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', secret, iv); return Buffer.concat([iv, cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]); },
    decryptString(bytes) { const decipher = crypto.createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8'); },
  };
}
async function directory(t) { const value = await fs.mkdtemp(path.join(os.tmpdir(), 'ecl-release-vault-')); t.after(() => fs.rm(value, { recursive: true, force: true })); return value; }
const win = { signExecutable: false, verifyUpdateCodeSignature: true, signtoolOptions: { publisherName: 'ECL Hub release-key verification' } };
const metadata = `provider: generic\nurl: ${FEED}\npublisherName: ECL Hub release-key verification\n`;

test('release vault stores only encrypted private bytes outside the repository and never rotates on repeated init', async t => {
  const dir = await directory(t), storage = encryption();
  const first = await initializeKey(dir, storage), second = await initializeKey(dir, storage);
  assert.deepEqual(first, second);
  const files = paths(dir), encrypted = await fs.readFile(files.privateFile);
  assert.ok(!encrypted.includes(Buffer.from('PRIVATE KEY')));
  const loaded = await loadKey(dir, storage);
  assert.equal(loaded.keyId, first.keyId);
  const before = encrypted.toString('base64'); await initializeKey(dir, storage);
  assert.equal((await fs.readFile(files.privateFile)).toString('base64'), before);
  await assert.rejects(loadKey(dir, encryption()));
  await fs.unlink(files.publicFile);
  assert.equal((await initializeKey(dir, storage)).keyId, first.keyId, 'a missing public file is recovered from the original encrypted key');
});
test('missing encryption creates no plaintext fallback and a missing private key cannot silently replace the pin', async t => {
  const dir = await directory(t), storage = encryption();
  await assert.rejects(initializeKey(dir, { isEncryptionAvailable: () => false }), /unavailable/);
  assert.deepEqual(await fs.readdir(dir), []);
  await initializeKey(dir, storage); await fs.unlink(paths(dir).privateFile);
  await assert.rejects(initializeKey(dir, storage), /missing/);
  assert.throws(() => paths(path.resolve(__dirname, '..')), /outside/);
});
test('ECL-key build and runtime trust require an explicit public pin, fixed feed and matching metadata', async t => {
  const dir = await directory(t), storage = encryption();
  const result = await initializeKey(dir, storage);
  assert.equal(updatePolicy(win).trusted, false);
  const policy = loadUpdatePolicy(win, { ECL_UPDATE_PUBLIC_KEY_FILE: result.publicKeyFile });
  assert.equal(policy.trusted, true); assert.equal(policy.mode, 'ecl-key');
  assert.equal(trustedPolicy(policy, metadata), true);
  assert.equal(trustedPolicy({ ...policy, keyId: 'wrong' }, metadata), false);
  assert.equal(trustedPolicy({ ...policy, publicKey: 'bad' }, metadata), false);
  assert.equal(trustedPolicy(policy, metadata.replace(FEED, 'https://evil.example/')), false);
  assert.equal(trustedPolicy(policy, metadata.replace('ECL Hub release-key verification', 'Wrong')), false);
  assert.throws(() => updatePolicy({ ...win, verifyUpdateCodeSignature: false }, policy.publicKey));
  assert.throws(() => loadUpdatePolicy(win, { ECL_UPDATE_PUBLIC_KEY_FILE: 'relative.pem' }));
  assert.ok(!JSON.stringify(policy).includes('PRIVATE KEY'));
  assert.ok(!JSON.stringify(policy).includes('encrypted'));
});
