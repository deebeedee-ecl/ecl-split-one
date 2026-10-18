const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { SCOPE, fileDigest, validPayload, verifyEnvelope } = require('../src/release-signature.cjs');

async function signInstaller({ installer, version, privateKeyFile, outputDirectory, passphrase, privateKey }) {
  if (path.basename(installer) !== `ECL-Hub-Setup-${version}.exe`) throw new Error('Installer filename must match its release version.');
  let key = privateKey;
  if (!key) {
    const stat = await fs.stat(privateKeyFile);
    if (!stat.isFile() || stat.size > 8192) throw new Error('Invalid signing key.');
    key = crypto.createPrivateKey({ key: await fs.readFile(privateKeyFile), passphrase });
  }
  if (key.type !== 'private' || key.asymmetricKeyType !== 'ed25519') throw new Error('An Ed25519 release key is required.');
  const payload = { scope: SCOPE, version, file: path.basename(installer), ...await fileDigest(installer) };
  if (!validPayload(payload)) throw new Error('Invalid release payload.');
  const bytes = Buffer.from(JSON.stringify(payload));
  const envelope = { payload: bytes.toString('base64'), signature: crypto.sign(null, bytes, key).toString('base64') };
  verifyEnvelope(envelope, crypto.createPublicKey(key));
  await fs.mkdir(outputDirectory, { recursive: true });
  const output = path.join(outputDirectory, `ECL-Hub-Release-${version}.json`);
  await fs.writeFile(output, JSON.stringify(envelope, null, 2), { flag: 'wx', mode: 0o600 });
  return output;
}
if (require.main === module) {
  const values = new Map(process.argv.slice(2).map(arg => { const index = arg.indexOf('='); return [arg.slice(0, index), arg.slice(index + 1)]; }));
  const installer = values.get('--installer'), version = values.get('--version'), privateKeyFile = values.get('--private-key'), outputDirectory = values.get('--out');
  if (!installer || !version || !privateKeyFile || !outputDirectory) {
    console.error('Usage: node tools/sign-release.cjs --installer=PATH --version=X.Y.Z --private-key=PATH --out=DIRECTORY'); process.exitCode = 1;
  } else {
    signInstaller({ installer, version, privateKeyFile, outputDirectory, passphrase: process.env.ECL_RELEASE_KEY_PASSPHRASE }).then(output => console.log(`Created ${path.basename(output)}. No files uploaded.`)).catch(() => { console.error('Release signing failed. Check the installer version, key and output paths. Existing manifests are never overwritten.'); process.exitCode = 1; });
  }
}
module.exports = { signInstaller };
