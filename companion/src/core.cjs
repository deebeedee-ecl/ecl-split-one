const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const https = require('node:https');
const fs = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const exec = promisify(execFile);

function gameId(value) {
  const id = String(value ?? '').trim();
  if (!/^\d{5,20}$/.test(id)) throw new Error('Enter a numeric League Game ID (5-20 digits).');
  return id;
}

function winner(value) { return value === true || String(value).toLowerCase() === 'win'; }
function summarize(raw) {
  const participants = Array.isArray(raw.participants) ? raw.participants : [];
  const identities = Array.isArray(raw.participantIdentities) ? raw.participantIdentities : [];
  return participants.map(p => {
    const identity = identities.find(i => i.participantId === p.participantId)?.player ?? {};
    const name = identity.gameName || identity.riotIdGameName || identity.summonerName || 'Unknown player';
    const tag = identity.tagLine || identity.riotIdTagline;
    const stats = p.stats ?? {};
    return {
      participantId: p.participantId, name: tag ? `${name}#${tag}` : name,
      teamId: p.teamId, championId: p.championId, kills: stats.kills ?? 0,
      deaths: stats.deaths ?? 0, assists: stats.assists ?? 0,
      damage: stats.totalDamageDealtToChampions ?? 0, gold: stats.goldEarned ?? 0,
      cs: (stats.totalMinionsKilled ?? 0) + (stats.neutralMinionsKilled ?? 0), vision: stats.visionScore ?? 0,
    };
  }).sort((a, b) => a.teamId - b.teamId || a.participantId - b.participantId);
}

function validate(raw) {
  const players = Array.isArray(raw.participants) ? raw.participants : [];
  const identities = Array.isArray(raw.participantIdentities) ? raw.participantIdentities : [];
  const teams = Array.isArray(raw.teams) ? raw.teams : [];
  const issues = [];
  if (raw.endOfGameResult !== 'GameComplete') issues.push('Match is not marked GameComplete.');
  if (players.length !== 10) issues.push('Expected exactly 10 participants.');
  if (new Set(players.map(p => p.participantId)).size !== 10 || players.some(p => !Number.isInteger(p.participantId))) issues.push('Participant IDs are missing or duplicated.');
  if (identities.length !== 10 || new Set(identities.map(i => i.participantId)).size !== 10 || players.some(p => !identities.some(i => i.participantId === p.participantId))) issues.push('Player identities do not match all participants.');
  const puuids = players.map(p => identities.find(i => i.participantId === p.participantId)?.player?.puuid);
  if (puuids.some(p => typeof p !== 'string' || !p.trim()) || new Set(puuids).size !== 10) issues.push('Expected 10 distinct player PUUIDs.');
  if (teams.length !== 2 || ![100, 200].every(id => teams.filter(t => t.teamId === id).length === 1 && players.filter(p => p.teamId === id).length === 5)) issues.push('Expected two teams of five (100 and 200).');
  if (teams.filter(t => winner(t.win)).length !== 1) issues.push('Expected exactly one winning team.');
  if (!(Number(raw.gameDuration) > 0)) issues.push('Match duration is missing.');
  const complete = issues.length === 0;
  const candidate = complete && raw.gameType === 'CUSTOM_GAME' && raw.mapId === 11 && raw.gameMode === 'CLASSIC';
  return {
    complete, candidate, issues,
    label: !complete ? 'Needs review' : candidate ? 'Roster check pending' : 'Non-ECL match',
    note: candidate ? 'Complete custom 5v5. ECL verification, expected teams and duplicate checks must still run on the server.' : complete ? 'Saved locally. This is not a custom Summoner\'s Rift match.' : issues.join(' '),
  };
}

function safeError(error, token) {
  let text = String(error?.message ?? error ?? 'Unknown error');
  if (token) text = text.split(token).join('[redacted]');
  text = text.replace(/--remoting-auth-token=[^\s"\\]+/gi, '--remoting-auth-token=[redacted]');
  return text.slice(0, 1600);
}

async function discover() {
  if (process.platform !== 'win32') return null;
  const script = String.raw`
    $ErrorActionPreference = 'Stop'
    $rows = @(Get-CimInstance Win32_Process -Filter "Name = 'LeagueClientUx.exe' OR Name = 'League of Legends.exe'" | ForEach-Object {
      $line = $_.CommandLine
      $p = [regex]::Match([string]$line, '--app-port=(\d+)')
      $t = [regex]::Match([string]$line, '--remoting-auth-token=([^"\s]+)')
      if ($p.Success -and $t.Success) {
        [PSCustomObject]@{ pid=$_.ProcessId; port=[int]$p.Groups[1].Value; token=$t.Groups[1].Value }
      } else {
        [PSCustomObject]@{ pid=$_.ProcessId; port=0; token=$null }
      }
    })
    ConvertTo-Json -InputObject $rows -Compress
  `;
  let stdout;
  try {
    ({ stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024, encoding: 'utf8' }));
  } catch { throw new Error('Windows could not inspect LeagueClientUx.exe. Try launching ECL Hub with the same permissions as League.'); }
  let rows;
  try { rows = JSON.parse(stdout.trim().replace(/^\uFEFF/, '') || '[]'); }
  catch { throw new Error('Windows returned unreadable League process information.'); }
  const candidates = Array.isArray(rows) ? rows : [rows];
  // Confirm the League service, not Riot Client Services, before retaining credentials.
  for (const row of candidates) {
    if (!row?.token || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535) continue;
    try {
      const profile = await request(row, '/lol-summoner/v1/current-summoner');
      if (profile?.puuid || profile?.summonerId) return { ...row, profile };
    } catch { /* A restarting client can leave an old process briefly visible. */ }
  }
  if (candidates.some(row => row?.pid)) throw new Error('League is running but its local connection is unavailable. Wait for reconnection.');
  return null;
}

function request(connection, endpoint) {
  if (!endpoint.startsWith('/lol-')) return Promise.reject(new Error('Unsupported local endpoint.'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, data) => { if (settled) return; settled = true; clearTimeout(deadline); error ? reject(error) : resolve(data); };
    const req = https.request({ hostname: '127.0.0.1', port: connection.port, path: endpoint, method: 'GET', rejectUnauthorized: false,
      headers: { Authorization: `Basic ${Buffer.from(`riot:${connection.token}`).toString('base64')}`, Accept: 'application/json' } }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 24 * 1024 * 1024) req.destroy(new Error('Local response exceeded 24 MB.')); else chunks.push(chunk); });
      res.on('error', error => finish(error));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) {
          const error = new Error(`LCU HTTP ${res.statusCode}: ${safeError(body, connection.token)}`);
          error.status = res.statusCode; finish(error); return;
        }
        try { finish(null, JSON.parse(body)); } catch { finish(new Error('League returned invalid JSON.')); }
      });
    });
    const deadline = setTimeout(() => req.destroy(new Error('League request timed out after 15 seconds.')), 15000);
    req.on('error', error => finish(error));
    req.end();
  });
}

function regionFor(profile) {
  const value = String(profile?.platformId || profile?.region || 'unknown').toUpperCase();
  return /^[A-Z0-9_-]{1,24}$/.test(value) ? value : 'unknown';
}

class Collector extends EventEmitter {
  constructor(directory, dependencies = {}) {
    super(); this.directory = directory; this.discover = dependencies.discover ?? discover; this.request = dependencies.request ?? request;
    this.now = dependencies.now ?? Date.now; this.connection = null; this.working = false; this.timer = null; this.running = false;
    this.db = { version: 1, autoCollect: false, jobs: [], matches: [] };
    this.status = { connected: false, player: null, phase: 'Unknown', message: 'Looking for League...', busy: false, lastChecked: null };
    this.writeChain = Promise.resolve(); this.recentChecked = 0; this.activeGame = null;
  }
  async init() {
    await fs.mkdir(path.join(this.directory, 'matches'), { recursive: true });
    try {
      const db = JSON.parse(await fs.readFile(path.join(this.directory, 'state.json'), 'utf8'));
      if (db.version !== 1 || !Array.isArray(db.jobs) || !Array.isArray(db.matches)) throw new Error('Unsupported saved state');
      this.db = db;
      for (const job of this.db.jobs) if (job.status === 'fetching') job.status = 'pending';
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Saved collector state could not be read. Your match files have not been changed.');
    }
    await this.pruneExpiredMatches();
    return this;
  }
  async pruneExpiredMatches() {
    const cutoff = this.now() - 30 * 86400000;
    const expired = this.db.matches.filter(m => Number.isFinite(m.collectedAt) && m.collectedAt <= cutoff);
    const removed = new Set();
    for (const match of expired) {
      if (typeof match.file !== 'string' || !/^[A-Za-z0-9_-]+\.json$/.test(match.file)) continue;
      try { await fs.unlink(path.join(this.directory, 'matches', match.file)); }
      catch (error) { if (error.code !== 'ENOENT') continue; }
      removed.add(match.key);
    }
    if (removed.size) {
      this.db.matches = this.db.matches.filter(m => !removed.has(m.key));
      this.db.jobs = this.db.jobs.filter(j => !(j.status === 'saved' && removed.has(j.key)));
      await this.persist(); this.changed();
    }
  }
  async persist() {
    const json = JSON.stringify(this.db, null, 2);
    const operation = this.writeChain.catch(() => {}).then(async () => {
      const file = path.join(this.directory, 'state.json');
      await fs.writeFile(`${file}.tmp`, json, { mode: 0o600 }); await fs.rename(`${file}.tmp`, file);
    });
    this.writeChain = operation; await operation;
  }
  snapshot() { return { ...this.status, autoCollect: this.db.autoCollect, jobs: this.db.jobs.map(j => ({ ...j })), matches: this.db.matches.map(m => ({ ...m })) }; }
  changed() { this.emit('change', this.snapshot()); }
  async setAuto(value) { if (typeof value !== 'boolean') throw new Error('Invalid collection setting.'); this.db.autoCollect = value; await this.persist(); this.changed(); }
  async enqueue(value, source = 'manual') {
    const id = gameId(value);
    if (!this.connection) throw new Error('Open League and wait for the connection before collecting a match.');
    const owner = this.connection.profile.puuid;
    if (!owner) throw new Error('League has not supplied your player identity yet.');
    const key = `${regionFor(this.connection.profile)}-${owner}-${id}`;
    const existing = this.db.jobs.find(j => j.key === key);
    if (existing) return existing.key;
    this.db.jobs.unshift({ key, id, owner, region: regionFor(this.connection.profile), source, status: 'pending', attempts: 0, nextAttempt: 0, createdAt: this.now(), error: '' });
    await this.persist(); this.changed(); return key;
  }
  async retry(key) {
    const job = this.db.jobs.find(j => j.key === key);
    if (!job || !['retry', 'failed'].includes(job.status)) throw new Error('This match is not waiting for a retry.');
    job.status = 'pending'; job.attempts = 0; job.nextAttempt = 0; job.error = ''; await this.persist(); this.changed();
  }
  async readMatch(key) {
    const meta = this.db.matches.find(m => m.key === key);
    if (!meta) throw new Error('Saved match not found.');
    return JSON.parse(await fs.readFile(path.join(this.directory, 'matches', meta.file), 'utf8'));
  }
  async runJob() {
    const connection = this.connection;
    if (!connection) return;
    const job = this.db.jobs.find(j => ['pending', 'retry'].includes(j.status) && j.nextAttempt <= this.now() && j.owner === connection.profile.puuid);
    if (!job) return;
    job.status = 'fetching'; job.attempts++; this.status.busy = true; this.changed();
    try {
      await this.persist();
      const raw = await this.request(connection, `/lol-match-history/v1/games/${job.id}`);
      if (String(raw.gameId) !== job.id) throw new Error('League returned a different Game ID. Nothing was saved.');
      if (raw.endOfGameResult !== 'GameComplete' && !String(raw.endOfGameResult).startsWith('Abort_')) throw new Error('League has not supplied a final match result yet. Waiting before retrying.');
      const validation = validate(raw);
      if (validation.candidate && !(raw.participantIdentities ?? []).some(i => i.player?.puuid === job.owner)) {
        validation.candidate = false; validation.issues.push('Collector account is not a participant.'); validation.label = 'Needs review'; validation.note = validation.issues.join(' ');
      }
      const crypto = require('node:crypto');
      const file = `${job.region}-${job.id}-${crypto.createHash('sha256').update(job.owner).digest('hex').slice(0, 16)}.json`;
      const record = { gameId: job.id, collectedAt: this.now(), source: 'league-local-api', validation, players: summarize(raw), raw };
      const destination = path.join(this.directory, 'matches', file);
      await fs.writeFile(`${destination}.tmp`, JSON.stringify(record, null, 2), { mode: 0o600 }); await fs.rename(`${destination}.tmp`, destination);
      const meta = { key: job.key, file, gameId: job.id, collectedAt: record.collectedAt, queueId: raw.queueId, gameType: raw.gameType, duration: raw.gameDuration, validation };
      this.db.matches = [meta, ...this.db.matches.filter(m => m.key !== job.key)]; job.status = 'saved'; job.error = '';
      this.status.message = `Saved match ${job.id} locally.`;
    } catch (error) {
      job.status = job.attempts >= 5 ? 'failed' : 'retry'; job.error = safeError(error, connection.token);
      job.nextAttempt = this.now() + Math.min(300000, 15000 * 2 ** (job.attempts - 1));
      this.status.message = 'Match retrieval failed. The retry queue keeps your Game ID.';
      if ([401, 403].includes(error.status)) {
        this.connection = null;
        Object.assign(this.status, { connected: false, player: null, phase: 'Unknown' });
      }
    } finally { this.status.busy = false; await this.persist(); this.changed(); }
  }
  async tick() {
    if (this.working) return;
    this.working = true;
    try {
      await this.pruneExpiredMatches();
      const connection = await this.discover();
      if (!connection) {
        this.connection = null; Object.assign(this.status, { connected: false, player: null, phase: 'Offline', message: 'Open League in the main lobby. ECL Hub will reconnect automatically.' });
        return;
      }
      if (this.connection?.profile?.puuid !== connection.profile.puuid || this.connection?.port !== connection.port) {
        this.recentChecked = 0; this.activeGame = null;
      }
      this.connection = connection;
      const p = connection.profile;
      this.status.connected = true;
      this.status.player = { name: p.gameName || p.displayName || p.summonerName || 'League player', tag: p.tagLine || '', level: p.summonerLevel || 0 };
      this.status.message = 'Connected to League on this PC.';
      try {
        const phase = await this.request(connection, '/lol-gameflow/v1/gameflow-phase');
        this.status.phase = typeof phase === 'string' ? phase : 'Connected';
      } catch { this.status.phase = 'Connected'; }
      if (this.db.autoCollect && this.status.phase === 'InProgress') {
        try {
          const session = await this.request(connection, '/lol-gameflow/v1/session');
          if (session.gameData?.gameId) this.activeGame = gameId(session.gameData.gameId);
        } catch { /* Recent history or a manually supplied ID remains available. */ }
      }
      if (this.db.autoCollect && this.activeGame && ['EndOfGame', 'WaitingForStats', 'PreEndOfGame'].includes(this.status.phase)) {
        await this.enqueue(this.activeGame, 'gameflow'); this.activeGame = null;
      }
      if (this.db.autoCollect && this.now() - this.recentChecked > 60000) {
        this.recentChecked = this.now();
        try {
          const history = await this.request(connection, '/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=4');
          const games = Array.isArray(history.games) ? history.games : history.games?.games;
          for (const match of (games ?? []).slice(0, 5)) if (match.gameId) await this.enqueue(match.gameId, 'recent-history');
        } catch (error) { this.status.message = `League connected; recent history unavailable. ${safeError(error, connection.token)}`; }
      }
      await this.runJob();
    } catch (error) { this.connection = null; Object.assign(this.status, { connected: false, player: null, phase: 'Unknown', message: safeError(error) }); }
    finally { this.working = false; this.status.lastChecked = this.now(); this.changed(); }
  }
  start() {
    if (this.running) return; this.running = true;
    const cycle = async () => { await this.tick(); if (this.running) this.timer = setTimeout(cycle, 10000); };
    void cycle();
  }
  stop() { this.running = false; clearTimeout(this.timer); }
}
module.exports = { Collector, validate, summarize, gameId, safeError, request, discover, regionFor };
