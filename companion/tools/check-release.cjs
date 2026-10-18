const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const yaml = require('js-yaml');
const { trustedPolicy } = require('../src/updates.cjs');
const { EclReleaseVerifier } = require('../src/release-signature.cjs');

async function checkRelease(directory) {
  const resources = path.join(directory, 'win-unpacked/resources'), archive = path.join(resources, 'app.asar');
  const policy = JSON.parse(asar.extractFile(archive, 'dist/update-policy.json').toString('utf8'));
  const packaged = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  if (policy.mode !== 'ecl-key' || !trustedPolicy(policy, fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'))) throw new Error('Packaged update trust mismatch.');
  const entries = asar.listPackage(archive);
  if (entries.some(name => /^[/\\](tools|\.git|prisma|report-engine)([/\\]|$)/.test(name) || /(^|[/\\])\.env(?:\.[^/\\]*)?$/.test(name) || /release-key\.encrypted|public-key\.pem/.test(name))) throw new Error('Unexpected private/build files in app package.');
  for (const file of ['main.cjs', 'updates.cjs', 'release-signature.cjs', 'release-public-key.cjs']) {
    if (!asar.extractFile(archive, `src/${file}`).equals(fs.readFileSync(path.join(__dirname, '../src', file)))) throw new Error('Packaged verification code differs from checked source.');
  }
  const metadata = yaml.load(fs.readFileSync(path.join(directory, 'latest.yml'), 'utf8'));
  if (metadata.version !== packaged.version) throw new Error('Release version mismatch.');
  const manifest = `ECL-Hub-Release-${metadata.version}.json`;
  const envelope = JSON.parse(fs.readFileSync(path.join(directory, manifest), 'utf8'));
  const verifier = new EclReleaseVerifier(policy.publicKey, async () => envelope);
  await verifier.verifyRelease(metadata);
  const installer = `ECL-Hub-Setup-${metadata.version}.exe`;
  await verifier.verifyFile(path.join(directory, installer));
  return { status: 'verified-locally-not-published', version: packaged.version, keyId: policy.keyId, bytes: fs.statSync(path.join(directory, installer)).size, releaseFiles: [installer, `${installer}.blockmap`, manifest, 'latest.yml'] };
}
if (require.main === module) checkRelease(path.resolve(process.argv[2] || 'release-updates')).then(value => console.log(JSON.stringify(value, null, 2))).catch(() => { console.error('Release verification failed. Do not publish this directory.'); process.exitCode = 1; });
module.exports = { checkRelease };
