const { EventEmitter } = require('node:events');
const FEED = 'https://eclchina.lol/desktop-updates/windows/';
function trustedPolicy(policy, metadata) {
  try {
    const config = require('js-yaml').load(metadata);
    const publishers = Array.isArray(config.publisherName) ? config.publisherName : [config.publisherName];
    const matches = policy.trusted === true && Array.isArray(policy.publishers) && policy.publishers.length > 0 && publishers.length === policy.publishers.length && publishers.every(p => typeof p === 'string' && policy.publishers.includes(p)) && config.provider === 'generic' && config.url === FEED;
    if (!matches) return false;
    if (policy.mode === 'ecl-key') {
      const { publicKey, keyId } = require('./release-public-key.cjs');
      return policy.publishers.length === 1 && policy.publishers[0] === 'ECL Hub release-key verification' && keyId(publicKey(policy.publicKey)) === policy.keyId;
    }
    return policy.mode === undefined || policy.mode === 'authenticode';
  } catch { return false; }
}
function validRelease(info) {
  if (!/^\d+\.\d+\.\d+$/.test(info?.version || '') || !Array.isArray(info.files) || !info.files.length) return false;
  return info.files.every(file => {
    try { const url = new URL(file.url, FEED); return url.href.startsWith(FEED) && !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith(`/ECL-Hub-Setup-${info.version}.exe`) && /^[A-Za-z0-9+/]{86}==$/.test(file.sha512); } catch { return false; }
  });
}
function restartBlocker(collector, reporting, now = Date.now()) {
  if (collector.busy || reporting.busy) return 'Wait for match collection and reporting to finish before updating.';
  if (!Number.isFinite(collector.lastChecked) || now - collector.lastChecked > 30000 || now < collector.lastChecked) return 'Checking League status. Try updating again shortly.';
  const safe = collector.connected ? ['None', 'Lobby', 'EndOfGame'] : ['Offline'];
  return safe.includes(collector.phase) ? '' : 'Finish your League game before restarting to update.';
}
class Updates extends EventEmitter {
  constructor(updater, { enabled = false, trusted = false, version = '0.0.0', verifier = null } = {}) {
    super(); this.updater = updater; this.enabled = enabled; this.trusted = trusted;
    this.verifier = verifier; this.generation = 0; this.installing = false;
    this.data = { status: enabled ? 'idle' : 'development', version, availableVersion: '', progress: 0, checkedAt: null, trusted };
    if (!updater) return;
    updater.autoDownload = false; updater.autoInstallOnAppQuit = false; updater.allowDowngrade = false; updater.allowPrerelease = false; updater.disableWebInstaller = true; updater.logger = null;
    if (verifier) {
      updater.disableDifferentialDownload = true;
      updater.verifyUpdateCodeSignature = async (_publishers, file) => { try { await verifier.verifyFile(file); return null; } catch { return 'ECL installer signature check failed.'; } };
    }
    updater.on('checking-for-update', () => this.change({ status: 'checking' }));
    updater.on('update-available', info => {
      const generation = ++this.generation;
      this.release = validRelease(info) ? info : null;
      if (this.verifier && this.release && this.enabled && this.trusted) {
        this.release = null; this.change({ status: 'checking' });
        void this.verifier.verifyRelease(info).then(() => {
          if (this.generation !== generation) return;
          this.release = info; this.change({ status: 'available', availableVersion: info.version, checkedAt: Date.now() });
          void this.download().catch(() => {});
        }).catch(() => { if (this.generation === generation) this.change({ status: 'invalid', availableVersion: '' }); });
        return;
      }
      this.change({ status: this.release ? 'available' : 'invalid', availableVersion: this.release?.version || '', checkedAt: Date.now() });
      // Validate the fixed feed before starting the download; installation always stays explicit.
      if (this.enabled && this.trusted && this.release) void this.download().catch(() => {});
    });
    updater.on('update-not-available', () => { this.generation++; this.release = null; this.change({ status: 'current', availableVersion: '', checkedAt: Date.now() }); });
    updater.on('download-progress', p => { if (this.data.status === 'downloading') this.change({ progress: Math.max(0, Math.min(100, Number(p.percent) || 0)) }); });
    updater.on('update-downloaded', info => {
      if (!this.trusted || this.data.status !== 'downloading' || info.version !== this.release?.version) return;
      if (!this.verifier) { this.change({ status: 'ready', progress: 100 }); return; }
      const generation = this.generation;
      // Cached installers may bypass NSIS's download-time hook, so verify every completed download too.
      void this.verifier.verifyFile(info.downloadedFile).then(() => {
        if (this.generation === generation && this.data.status === 'downloading') { this.downloadedFile = info.downloadedFile; this.change({ status: 'ready', progress: 100 }); }
      }).catch(() => { if (this.generation === generation) this.change({ status: 'invalid' }); });
    });
    updater.on('error', () => { this.generation++; this.release = null; this.change({ status: 'unavailable' }); });
  }
  snapshot() { return { ...this.data }; }
  change(data) { Object.assign(this.data, data); this.emit('change', this.snapshot()); }
  async check() {
    if (!this.enabled || ['checking', 'downloading', 'ready'].includes(this.data.status)) return this.snapshot();
    this.change({ status: 'checking' });
    try { await this.updater.checkForUpdates(); } catch { this.change({ status: 'unavailable' }); }
    return this.snapshot();
  }
  async download() {
    if (!this.enabled || !this.trusted || this.data.status !== 'available' || !validRelease(this.release)) throw new Error('Signed update installation is not configured for this test build.');
    this.change({ status: 'downloading', progress: 0 });
    try { await this.updater.downloadUpdate(); } catch { this.change({ status: 'unavailable' }); throw new Error('Update download failed.'); }
  }
  install(beforeInstall = () => {}) {
    if (!this.enabled || !this.trusted || this.installing || this.data.status !== 'ready') throw new Error('No verified update is ready.');
    if (this.verifier) { this.installing = true; return this.installVerified(beforeInstall).finally(() => { this.installing = false; }); }
    beforeInstall();
    this.updater.quitAndInstall(false, true);
  }
  async installVerified(beforeInstall) {
    const generation = this.generation;
    try { await this.verifier.verifyFile(this.downloadedFile); }
    catch { this.change({ status: 'invalid' }); throw new Error('ECL installer signature check failed.'); }
    if (generation !== this.generation || this.data.status !== 'ready') throw new Error('No verified update is ready.');
    beforeInstall(); this.updater.quitAndInstall(false, true);
  }
  start() { if (!this.enabled) return; this.initial = setTimeout(() => void this.check(), 15000); this.initial.unref(); this.timer = setInterval(() => void this.check(), 6 * 60 * 60 * 1000); this.timer.unref(); }
  dispose() { this.generation++; this.release = null; this.downloadedFile = null; clearTimeout(this.initial); clearInterval(this.timer); }
}
module.exports = { Updates, FEED, validRelease, trustedPolicy, restartBlocker };
