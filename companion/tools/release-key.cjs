const { app, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { initializeKey, loadKey } = require('./release-vault.cjs');
const { signInstaller } = require('./sign-release.cjs');
const { trustedPolicy } = require('../src/updates.cjs');

app.whenReady().then(async () => {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw new Error('This signing tool requires Windows.');
  const directory = path.join(process.env.LOCALAPPDATA, 'ECL Hub Release Signing');
  const args = process.argv.slice(2), action = args[0];
  const value = name => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  if (action === 'init') {
    const result = await initializeKey(directory, safeStorage);
    console.log(JSON.stringify({ status: 'protected-key-ready', ...result }));
  } else if (action === 'status') {
    const loaded = await loadKey(directory, safeStorage);
    console.log(JSON.stringify({ status: 'protected-key-ready', keyId: loaded.keyId, publicKeyFile: loaded.publicKeyFile }));
  } else if (action === 'sign') {
    const installer = value('--installer'), version = value('--version'), outputDirectory = value('--out');
    if (!installer || !version || !outputDirectory) throw new Error('Installer, version and output directory are required.');
    const loaded = await loadKey(directory, safeStorage);
    const resources = path.join(path.dirname(path.resolve(installer)), 'win-unpacked/resources');
    const asar = require('@electron/asar');
    const archive = path.join(resources, 'app.asar');
    const policy = JSON.parse(asar.extractFile(archive, 'dist/update-policy.json').toString('utf8'));
    const packaged = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
    if (policy.mode !== 'ecl-key' || policy.keyId !== loaded.keyId || packaged.version !== version || !trustedPolicy(policy, await fs.readFile(path.join(resources, 'app-update.yml'), 'utf8'))) throw new Error('The packaged app does not pin this release key.');
    const output = await signInstaller({ installer, version, outputDirectory, privateKey: loaded.key });
    console.log(JSON.stringify({ status: 'release-signed-locally', file: path.basename(output), keyId: loaded.keyId }));
  } else throw new Error('Choose init, status or sign.');
  app.exit(0);
}).catch(() => { console.error('Protected release-key operation failed. No credentials or key contents are printed. Check the Windows account, encryption and supplied paths.'); app.exit(1); });
