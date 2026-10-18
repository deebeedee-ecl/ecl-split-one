const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { publicKey, keyId } = require('../src/release-public-key.cjs');

function paths(directory) {
  const root = path.resolve(__dirname, '../..'), resolved = path.resolve(directory), relative = path.relative(root, resolved);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Release keys must stay outside the project.');
  return { directory: resolved, privateFile: path.join(resolved, 'release-key.encrypted'), publicFile: path.join(resolved, 'public-key.pem') };
}
function requireEncryption(storage) { if (!storage.isEncryptionAvailable()) throw new Error('Windows encryption is unavailable. No key was created or decrypted.'); }
async function loadKey(directory, storage) {
  requireEncryption(storage); const files = paths(directory);
  const stat = await fs.stat(files.privateFile);
  if (!stat.isFile() || stat.size > 16384) throw new Error('Invalid protected release key.');
  const encrypted = await fs.readFile(files.privateFile);
  const key = crypto.createPrivateKey(storage.decryptString(encrypted));
  if (key.type !== 'private' || key.asymmetricKeyType !== 'ed25519') throw new Error('Invalid protected release key.');
  const actual = crypto.createPublicKey(key);
  const expected = publicKey(await fs.readFile(files.publicFile, 'utf8'));
  if (keyId(actual) !== keyId(expected)) throw new Error('Release key does not match its public pin.');
  return { key, publicKey: actual, keyId: keyId(actual), publicKeyFile: files.publicFile };
}
async function initializeKey(directory, storage) {
  requireEncryption(storage); const files = paths(directory);
  await fs.mkdir(files.directory, { recursive: true, mode: 0o700 });
  let encrypted;
  try { encrypted = await fs.readFile(files.privateFile); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { await fs.access(files.publicFile); throw new Error('Public release pin exists but its private key is missing. Restore it; do not rotate silently.'); }
    catch (publicError) { if (publicError.code !== 'ENOENT') throw publicError; }
    const pair = crypto.generateKeyPairSync('ed25519');
    encrypted = storage.encryptString(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    await fs.writeFile(files.privateFile, encrypted, { flag: 'wx', mode: 0o600 });
  }
  if (encrypted.length > 16384) throw new Error('Invalid protected release key.');
  const key = crypto.createPrivateKey(storage.decryptString(encrypted));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Invalid protected release key.');
  const pem = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' });
  try { await fs.writeFile(files.publicFile, pem, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const loaded = await loadKey(directory, storage);
  return { keyId: loaded.keyId, publicKeyFile: loaded.publicKeyFile };
}
module.exports = { initializeKey, loadKey, paths };
