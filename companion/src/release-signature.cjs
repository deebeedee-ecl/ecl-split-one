const crypto = require('node:crypto');
const fs = require('node:fs');
const { FEED, validRelease } = require('./updates.cjs');
const { publicKey } = require('./release-public-key.cjs');
const SCOPE = 'lol.eclchina.companion:windows-nsis:v1';
const VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const HASH = /^[A-Za-z0-9+/]{86}==$/;
const MAX_INSTALLER = 512 * 1024 * 1024;

function validPayload(value) {
  return value?.scope === SCOPE && typeof value.version === 'string' && VERSION.test(value.version) && value.file === `ECL-Hub-Setup-${value.version}.exe` && typeof value.sha512 === 'string' && HASH.test(value.sha512) && Number.isSafeInteger(value.size) && value.size > 0 && value.size <= MAX_INSTALLER;
}
function verifyEnvelope(envelope, key) {
  try {
    if (typeof envelope?.payload !== 'string' || envelope.payload.length > 8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.payload) || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)) throw new Error();
    const bytes = Buffer.from(envelope.payload, 'base64');
    if (bytes.toString('base64') !== envelope.payload || !crypto.verify(null, bytes, key, Buffer.from(envelope.signature, 'base64'))) throw new Error();
    const payload = JSON.parse(bytes.toString('utf8'));
    if (!validPayload(payload)) throw new Error();
    return Object.freeze(payload);
  } catch { throw new Error('ECL release signature was rejected.'); }
}
async function fileDigest(file, maximum = MAX_INSTALLER) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > maximum) throw new Error('Invalid installer size.');
    const hash = crypto.createHash('sha512'); let size = 0;
    const stream = handle.createReadStream({ autoClose: false });
    try { for await (const chunk of stream) { size += chunk.length; if (size > maximum) throw new Error('Invalid installer size.'); hash.update(chunk); } }
    finally { stream.destroy(); }
    return { size, sha512: hash.digest('base64') };
  } finally { await handle.close(); }
}
async function readEnvelope(url, transport = fetch) {
  let target = new URL(url);
  for (let hop = 0; hop < 2; hop++) {
    const response = await transport(target.href, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location || hop !== 0) throw new Error('ECL release signature is unavailable.');
      const next = new URL(location, target);
      if (next.protocol !== 'https:' || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(next.hostname) || next.port || next.username || next.password || next.search || next.hash || next.pathname.split('/').at(-1) !== target.pathname.split('/').at(-1)) throw new Error('ECL release signature redirect was rejected.');
      target = next; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error('ECL release signature is unavailable.'); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('ECL release signature is unavailable.');
    const chunks = []; let size = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16384) throw new Error('Oversized signature'); chunks.push(Buffer.from(value)); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { await reader.cancel().catch(() => {}); throw new Error('ECL release signature is unavailable.'); }
  }
  throw new Error('ECL release signature is unavailable.');
}

// Uses only the public key pinned at build time; the server cannot replace it.
class EclReleaseVerifier {
  constructor(pem, read = readEnvelope) { this.key = publicKey(pem); this.read = read; this.manifest = null; }
  async verifyRelease(info) {
    this.manifest = null;
    if (!validRelease(info) || info.files.length !== 1 || !VERSION.test(info.version) || info.packages) throw new Error('ECL release metadata was rejected.');
    const payload = verifyEnvelope(await this.read(`${FEED}ECL-Hub-Release-${info.version}.json`), this.key);
    const file = info.files[0];
    if (payload.version !== info.version || payload.sha512 !== file.sha512 || new URL(file.url, FEED).pathname.split('/').at(-1) !== payload.file || (file.size !== undefined && file.size !== payload.size)) throw new Error('ECL release metadata does not match its signature.');
    this.manifest = payload;
  }
  async verifyFile(file) {
    const manifest = this.manifest;
    if (!manifest || typeof file !== 'string') throw new Error('No ECL-verified installer is ready.');
    try {
      const digest = await fileDigest(file, manifest.size);
      if (this.manifest !== manifest || digest.size !== manifest.size || !crypto.timingSafeEqual(Buffer.from(digest.sha512, 'base64'), Buffer.from(manifest.sha512, 'base64'))) throw new Error();
    } catch { throw new Error('ECL installer signature check failed.'); }
  }
}
module.exports = { EclReleaseVerifier, SCOPE, publicKey, validPayload, verifyEnvelope, fileDigest, readEnvelope };
