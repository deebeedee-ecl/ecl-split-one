const { EventEmitter } = require('node:events');

class Reporting extends EventEmitter {
  constructor(account, collector) {
    super(); this.account = account; this.collector = collector; this.generation = 0; this.busy = false;
    this.data = { enabled: false, status: 'disconnected', message: 'KOOK reporting is disconnected. Uploads are off.', job: null };
  }
  snapshot() { return structuredClone(this.data); }
  change(value) { Object.assign(this.data, value); this.emit('change', this.snapshot()); }
  identity() {
    const p = this.collector.connection?.profile;
    if (!p?.puuid || !p.gameName || !p.tagLine) throw new Error('Open League and wait for a complete player identity.');
    return { puuid: p.puuid, name: p.gameName, tag: p.tagLine };
  }
  async connect() {
    this.disconnect(); const generation = this.generation;
    const identity = this.identity(), epoch = this.account.epoch;
    this.controller = new AbortController();
    this.change({ status: 'connecting', message: 'Connecting the reporting pilot...' });
    try {
      const result = await this.account.desktopRequest({ action: 'link', identity }, null, this.controller.signal);
      if (generation !== this.generation) return this.snapshot();
      if (epoch !== this.account.epoch || JSON.stringify(this.identity()) !== JSON.stringify(identity)) return this.disconnect('Account changed. Reconnect reporting.');
      if (typeof result.capability !== 'string' || !Number.isFinite(result.expiresAt)) throw new Error('Reporting server returned invalid authorization.');
      this.link = result; this.local = identity; this.epoch = epoch;
      this.change({ enabled: true, status: 'waiting', message: 'Connected for this app session. Waiting for your KOOK report request.' });
      this.timer = setInterval(() => void this.tick(), 30000); this.timer.unref(); void this.tick();
    } catch (error) {
      if (generation !== this.generation) return this.snapshot();
      this.disconnect(error.status === 503 || error.status === 404 ? 'Desktop reporting pilot is not enabled or deployed on the server yet.' : 'Could not connect. Check your sign-in, verified Riot ID and pilot setup.');
      throw new Error(this.data.message);
    }
    return this.snapshot();
  }
  disconnect(message = 'KOOK reporting is disconnected. Uploads are off.') {
    this.generation++; clearInterval(this.timer); this.controller?.abort(); this.link = null; this.job = null;
    this.change({ enabled: false, status: 'disconnected', message, job: null }); return this.snapshot();
  }
  async tick() {
    if (!this.data.enabled || this.busy) return;
    if (this.account.epoch !== this.epoch || !this.account.data.authenticated) return this.disconnect('ECL account changed. Reconnect reporting.');
    if (!this.collector.connection) return this.change({ status: 'waiting', message: 'Open League to continue your report request.' });
    try { if (JSON.stringify(this.identity()) !== JSON.stringify(this.local)) return this.disconnect('League account changed. Reconnect reporting.'); }
    catch { return this.disconnect('League identity unavailable. Reconnect reporting.'); }
    this.busy = true; const generation = this.generation;
    const current = () => {
      try { return generation === this.generation && this.data.enabled && this.account.epoch === this.epoch && this.collector.connection && JSON.stringify(this.identity()) === JSON.stringify(this.local); } catch { return false; }
    };
    try {
      if (this.link.expiresAt < Date.now() + 60000) {
        const renewed = await this.account.desktopRequest({ action: 'link', identity: this.local }, null, this.controller.signal);
        if (!current()) return;
        if (typeof renewed.capability !== 'string' || !Number.isFinite(renewed.expiresAt)) throw new Error('Invalid reporting authorization.');
        this.link = renewed;
      }
      if (!current()) return;
      if (this.job?.expiresAt <= Date.now()) this.job = null;
      if (!this.job) {
        const { job } = await this.account.desktopRequest({ action: 'claim' }, this.link.capability, this.controller.signal);
        if (!current()) return;
        if (!job) { if (this.data.status !== 'review') this.change({ status: 'waiting', message: 'Waiting for your KOOK report request.', job: null }); return; }
        if (typeof job.id !== 'string' || !/^\d{5,20}$/.test(job.gameId) || typeof job.lease !== 'string' || !Number.isFinite(job.expiresAt)) throw new Error('Invalid report assignment.');
        this.job = job;
      }
      const job = this.job;
      this.change({ status: 'collecting', message: 'Collecting the requested match for administrator review.', job: { gameId: job.gameId, label: String(job.label || '').slice(0, 100) } });
      const key = await this.collector.enqueue(job.gameId, 'kook-report');
      await this.collector.tick(); if (!current()) return;
      if (!this.collector.db.matches.some(m => m.key === key)) return;
      const record = await this.collector.readMatch(key);
      if (!current()) return;
      if (!record.validation?.candidate || record.sample) throw new Error('Only a complete real custom 5v5 can be submitted.');
      this.change({ status: 'uploading', message: 'Uploading the assigned match for administrator review.' });
      const result = await this.account.desktopRequest({ action: 'submit', jobId: job.id, lease: job.lease, raw: record.raw }, this.link.capability, this.controller.signal);
      if (!current()) return;
      if (result.status !== 'REVIEW_REQUIRED') throw new Error('Unexpected report outcome.');
      this.job = null;
      this.change({ status: 'review', message: result.notified === false ? 'Match received for administrator review. Check !report for saved status; a KOOK notification was not confirmed. No points awarded.' : 'Match received for administrator review. No points have been awarded.', job: { gameId: job.gameId, label: String(job.label || '').slice(0, 100) } });
    } catch (error) {
      if (current()) {
        if ([401, 403].includes(error.status)) this.disconnect('Reporting authorization changed. Reconnect after checking your account.');
        else if ([400, 409, 413].includes(error.status)) this.disconnect('Report could not be accepted. Check the Game ID, roster, sides and Ionia server, then reconnect or ask an admin.');
        else this.change({ status: 'retry', message: 'Collection or reporting is unavailable. Retrying while connected; check the local queue for collection errors.' });
      }
    } finally { this.busy = false; }
  }
  dispose() { this.disconnect(); }
}
module.exports = { Reporting };
