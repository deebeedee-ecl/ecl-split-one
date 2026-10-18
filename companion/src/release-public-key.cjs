const crypto = require('node:crypto');

function publicKey(pem) {
  if (typeof pem !== 'string' || pem.length > 4096 || !/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\s*$/.test(pem)) throw new Error('A public Ed25519 key is required.');
  const key = crypto.createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('A public Ed25519 key is required.');
  return key;
}
function keyId(key) { return crypto.createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex'); }
module.exports = { publicKey, keyId };
