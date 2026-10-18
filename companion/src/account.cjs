const { EventEmitter } = require('node:events');
const SITE = 'https://eclchina.lol';
const SESSION_KEY = 'ecl-hub-desktop-session';
const text = (value, length = 160) => typeof value === 'string' ? value.slice(0, length) : '';
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
function percentage(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const source = String(value).trim();
  if (!/^\d+(?:\.\d+)?%?$/.test(source)) return null;
  const result = Number(source.replace(/%$/, ''));
  return Number.isFinite(result) && result >= 0 && result <= 100 ? result : null;
}
function rankedSeason(raw) {
  if (!raw || typeof raw !== 'object' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(raw.id) || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100 || typeof raw.startedAt !== 'string' || !Number.isFinite(Date.parse(raw.startedAt))) return null;
  return { id: raw.id, name: raw.name.trim(), startedAt: new Date(raw.startedAt).toISOString() };
}
function profile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let avatar = '';
  // Website uploads allow 4 MiB binary images, or about 5.6 MiB as base64.
  const candidate = typeof raw.avatarUrl === 'string' && raw.avatarUrl.length <= 4 * Math.ceil(4 * 1024 * 1024 / 3) + 64 ? raw.avatarUrl : '';
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(candidate)) avatar = candidate;
  else if (candidate.startsWith('/') && !candidate.startsWith('//')) { const url = new URL(candidate, SITE); if (url.origin === SITE) avatar = url.toString(); }
  else { try { const url = new URL(candidate); if (url.origin === SITE) avatar = url.toString(); } catch { /* Ignore third-party or malformed image URLs. */ } }
  return {
    displayName: text(raw.displayName), riotName: text(raw.riotName), riotTag: text(raw.riotTag),
    server: text(raw.chinaServerName), primaryRole: text(raw.primaryRole), secondaryRole: text(raw.secondaryRole),
    currentRank: text(raw.currentRank), nationality: text(raw.nationality), bio: text(raw.bio, 1600),
    verificationStatus: text(raw.verificationStatus), accountStatus: text(raw.accountStatus), avatar,
    lastRankLookup: text(raw.lzyumiLastLookupAt), ...leagueStats(raw),
  };
}
function leagueStats(raw) {
  const source = raw.lzyumiRawProfile;
  const rows = source?.battleInfo?.mapOneInfoList ?? source?.data?.battleInfo?.mapOneInfoList ?? source?.data?.mapOneInfoList;
  const ranks = (Array.isArray(rows) ? rows : []).filter(r => r && typeof r.type === 'string');
  const rank = row => row && typeof row.tier === 'string' && row.tier !== '-' ? { tier: text(row.tier, 80), lp: Math.max(0, number(row.winPoint)), wins: Math.max(0, number(row.wins)), games: Math.max(0, number(row.total)) } : null;
  const common = raw.lzyumiRecentStat?.data?.recentState?.common_use_champions;
  return {
    soloRank: rank(ranks.find(r => /Solo|\u5355\u53cc\u6392/i.test(r.type))),
    flexRank: rank(ranks.find(r => /Flex|\u7075\u6d3b\u6392\u4f4d/i.test(r.type))),
    leagueChampions: (Array.isArray(common) ? common : []).filter(c => c && /^\d+$/.test(String(c.key)) && Number(c.value) > 0).slice(0, 5).map(c => ({ championId: String(c.key), games: Math.floor(number(c.value)) })),
  };
}
function leagueHistory(raw = {}) {
  const rows = [], seen = new Set();
  for (const [queue, source] of [['solo', raw?.soloGames], ['flex', raw?.flexGames]]) {
    for (const g of (Array.isArray(source) ? source : []).slice(0, 100)) {
      if (!g || typeof g !== 'object') continue;
      const id = text(g.gameId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const title = text(g.title, 1000);
      const kda = /\((\d+)-(\d+)-(\d+)\)\s*$/.exec(title);
      const reported = text(g.titleTime);
      const stamp = /^\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?/.exec(reported)?.[0] || '';
      const position = /\u3010([^\u3011]+)\u3011/.exec(reported)?.[1];
      rows.push({ id, queue, championId: /^\d+$/.test(String(g.championId)) ? String(g.championId) : '',
        isWin: Number(g.isWin) === 1 ? true : Number(g.isWin) === 2 ? false : null,
        kills: kda ? Number(kda[1]) : null, deaths: kda ? Number(kda[2]) : null, assists: kda ? Number(kda[3]) : null,
        reportedAt: stamp, role: ({ '\u4e0a': 'TOP', '\u4e2d': 'MID', '\u6253\u91ce': 'JGL', '\u4e0b': 'ADC', '\u8f85': 'SUP' })[position] || '',
        isMVP: g.wasMvp === 'mvp', isSVP: g.wasSvp === 'svp' });
    }
  }
  return rows.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).slice(0, 100);
}
function history(raw = {}) {
  const games = (Array.isArray(raw.games) ? raw.games : []).slice(0, 100).map(g => ({
    id: text(g.id), label: text(g.gameLabel), date: text(g.date), isWin: g.isWin === true,
    kills: number(g.kills), deaths: number(g.deaths), assists: number(g.assists), lpChange: number(g.lpChange),
    eloAfter: number(g.eloAfter), isMVP: g.isMVP === true, isSVP: g.isSVP === true,
    role: text(g.role), championId: /^\d+$/.test(String(g.championId)) ? String(g.championId) : '',
  }));
  const s = raw.summary;
  const summary = s && typeof s === 'object' ? {
    elo: number(s.elo), rank: s.rank == null ? null : number(s.rank), games: number(s.games), wins: number(s.wins), losses: number(s.losses),
    averageKda: number(s.averageKda), mvps: number(s.mvps), svps: number(s.svps), streak: text(s.streakLabel),
    topChampions: (Array.isArray(s.topChampions) ? s.topChampions : []).filter(c => /^\d+$/.test(String(c.championId))).slice(0, 5).map(c => ({ championId: String(c.championId), games: number(c.games), wins: number(c.wins) })),
    roles: (Array.isArray(s.roleStats) ? s.roleStats : []).slice(0, 6).map(r => ({ role: text(r.role), games: number(r.games), winRate: number(r.winRate), pct: Math.max(0, Math.min(100, number(r.pct))) })),
  } : null;
  return { games, summary, rankedSeason: raw.season?.summaryScope === 'season' ? rankedSeason(raw.season) : null };
}
function leaderboard(raw, limit = 10) {
  return (Array.isArray(raw) ? raw : []).filter(r => r && typeof r === 'object').slice(0, limit).map(r => ({
    rank: number(r.rank), name: text(r.name), elo: number(r.elo), games: number(r.gamesPlayed), winRate: percentage(r.winRate), kda: number(r.kda),
    team: /^FA$/i.test(text(r.teamTag).trim()) ? '' : text(r.teamTag).trim(),
    championSource: r.championSource === 'ecl-snapshot' ? 'ecl-snapshot' : '',
    championsUpdatedAt: text(r.championsUpdatedAt, 64),
    topChampions: (r.championSource === 'ecl-snapshot' && Array.isArray(r.topChampions) ? r.topChampions : [])
      .filter(c => c && /^\d{1,6}$/.test(String(c.championId)) && Number(c.championId) > 0 && Number.isSafeInteger(Number(c.games)) && Number(c.games) > 0)
      .slice(0, 3).map(c => ({ championId: String(c.championId), games: number(c.games) })),
  }));
}
function scoreboard(raw, id) {
  const source = raw?.scoreboard;
  if (!source || source.id !== id || !Array.isArray(source.players) || source.players.length > 10 || !source.players.length) throw new Error('Match details are unavailable. The website may need its desktop update.');
  const stat = value => (typeof value === 'number' || typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const verifiedUnits = source.metricsVersion === 2;
  return { id, metricsVersion: verifiedUnits ? 2 : 1, label: text(source.label), date: text(source.date), players: source.players.map(p => ({
    name: text(p.name), championId: /^\d{1,6}$/.test(String(p.championId)) ? String(p.championId) : '', role: text(p.role),
    isWin: p.isWin === true, isMVP: p.isMVP === true, isSVP: p.isSVP === true,
    kills: stat(p.kills), deaths: stat(p.deaths), assists: stat(p.assists),
    damage: verifiedUnits ? stat(p.damage) : null, gold: verifiedUnits ? stat(p.gold) : null,
    damageApproximate: p.damageApproximate === true, goldApproximate: p.goldApproximate === true,
    vision: stat(p.vision), cs: stat(p.cs),
  })) };
}
async function websiteGet(endpoint, token, transport = fetch) {
  if (!['/api/account/profile', '/api/hub/my-inhouse-history', '/api/leaderboard'].includes(endpoint) && !/^\/api\/hub\/my-inhouse-history\?statId=[a-zA-Z0-9_-]{1,128}$/.test(endpoint)) throw new Error('Unsupported ECL data request.');
  const response = await transport(`${SITE}${endpoint}`, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) { const error = new Error(`ECL data request failed (HTTP ${response.status}).`); error.status = response.status; throw error; }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('ECL returned an empty response.');
  const chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8 * 1024 * 1024) throw new Error('ECL response exceeded the safe size limit.'); chunks.push(Buffer.from(value)); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { await reader.cancel().catch(() => {}); throw new Error('ECL returned an unreadable data response.'); }
}
async function websiteRefresh(token, transport = fetch, signal) {
  const response = await transport(`${SITE}/api/account/refresh-stats?ifStale=1`, { method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000), headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('League snapshot refresh is unavailable.');
  // The response carries no profile or credential data; reload through the existing bounded reader.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('League snapshot refresh is unavailable.');
  const chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4096) throw new Error('Oversized response'); chunks.push(Buffer.from(value)); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { await reader.cancel().catch(() => {}); throw new Error('League snapshot refresh is unavailable.'); }
}
class Account extends EventEmitter {
  constructor(config, vault, dependencies = {}) {
    super(); this.vault = vault; this.config = config; this.read = dependencies.read ?? websiteGet; this.refreshStats = dependencies.refreshStats ?? websiteRefresh; this.epoch = 0; this.refreshing = null; this.authBusy = false;
    this.data = { configured: !!config.configured, authenticated: false, profile: null, games: [], leagueGames: [], summary: null, rankedSeason: null, leaderboard: [], loading: false, error: '', historyError: '', ladderError: '', lastUpdated: null, leagueRefreshing: false, leagueRefreshError: '' };
    if (config.configured) {
      const create = dependencies.createClient ?? require('@supabase/supabase-js').createClient;
      const authOrigin = new URL(config.supabaseUrl).origin;
      this.makeClient = () => create(config.supabaseUrl, config.publicKey, {
        auth: { storage: vault, storageKey: SESSION_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: { fetch: (input, init) => {
          const url = new URL(input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url);
          if (url.origin !== authOrigin || !url.pathname.startsWith('/auth/v1/')) throw new Error('Unsupported authentication request.');
          return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
        } },
      });
      this.client = this.makeClient();
    }
  }
  snapshot() { return structuredClone({ ...this.data, authBusy: this.authBusy, secureStorage: this.vault.persistent, persistentSession: this.vault.persistent && this.vault.remember !== false, storageWarning: this.vault.warning }); }
  changed() { this.emit('change', this.snapshot()); }
  async init() { if (this.client) await this.client.auth.startAutoRefresh(); return this; }
  async login(email, password, remember = true) {
    if (!this.client) throw new Error('This build has no ECL sign-in configuration.');
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || typeof password !== 'string' || !password || password.length > 1024) throw new Error('Enter your ECL email address and password.');
    if (this.authBusy) throw new Error('A sign-in or sign-out is already running.');
    if (typeof remember !== 'boolean') throw new Error('Choose whether to remember this sign-in.');
    this.authBusy = true;
    try {
    this.cancelLeagueRefresh(); this.epoch++; this.data = { ...this.data, profile: null, games: [], leagueGames: [], summary: null, rankedSeason: null, authenticated: false, error: '', historyError: '', lastUpdated: null, loading: true }; this.changed();
    try {
      await this.vault.setRemember(remember, [SESSION_KEY, `${SESSION_KEY}-user`, `${SESSION_KEY}-code-verifier`]);
      const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error('Sign-in was not accepted. Check your ECL email, password and account confirmation.');
    } catch (error) { this.data.loading = false; this.changed(); throw new Error(String(error?.message || '').startsWith('Sign-in was') ? error.message : 'Could not reach ECL sign-in. Check your connection and try again.'); }
    await this.refresh();
    } finally { this.authBusy = false; this.changed(); }
  }
  async logout() {
    if (this.authBusy) throw new Error('A sign-in or sign-out is already running.');
    this.authBusy = true;
    try {
    this.cancelLeagueRefresh(); this.epoch++; this.data = { ...this.data, authenticated: false, profile: null, games: [], leagueGames: [], summary: null, rankedSeason: null, loading: false, error: '', historyError: '', lastUpdated: null }; this.changed();
    if (this.client) {
      this.client.auth.stopAutoRefresh();
      let revocationFailed = false;
      try { const { error } = await this.client.auth.signOut({ scope: 'local' }); revocationFailed = !!error; }
      catch { revocationFailed = true; }
      // Offline logout must still forget this device's saved and in-memory session.
      for (const key of [SESSION_KEY, `${SESSION_KEY}-user`, `${SESSION_KEY}-code-verifier`]) await this.vault.removeItem(key);
      this.client = this.makeClient(); await this.client.auth.startAutoRefresh();
      if (revocationFailed) { this.data.error = 'Signed out on this PC. The authentication server could not confirm revocation while offline.'; this.changed(); }
    }
    } finally { this.authBusy = false; this.changed(); }
  }
  async refresh() {
    const epoch = this.epoch;
    if (this.refreshing?.epoch === epoch) return this.refreshing.promise;
    const promise = this.performRefresh(epoch);
    this.refreshing = { epoch, promise };
    try { await promise; } finally { if (this.refreshing?.promise === promise) this.refreshing = null; }
  }
  async performRefresh(epoch) {
    this.data.loading = true; this.data.error = ''; this.changed();
    try {
      const ladderPromise = this.read('/api/leaderboard').then(leaderboard).then(rows => ({ rows })).catch(() => ({ error: 'Published standings are unavailable right now.' }));
      let session = null;
      try { if (this.client) { const result = await this.client.auth.getSession(); if (!result.error) session = result.data.session; } } catch { /* Remain signed out; never expose session errors or credentials. */ }
      const apply = () => epoch === this.epoch;
      if (apply()) this.data.authenticated = !!session;
      if (session) {
        const [p, h] = await Promise.allSettled([this.read('/api/account/profile', session.access_token), this.read('/api/hub/my-inhouse-history', session.access_token)]);
        if (apply()) {
          if (p.status === 'fulfilled') { this.data.profile = profile(p.value.profile); this.data.leagueGames = leagueHistory(p.value.profile?.lzyumiRankedGames); }
          else this.data.error = `Profile could not refresh${p.reason?.status ? ` (HTTP ${p.reason.status})` : ''}. Try again.`;
          if (h.status === 'fulfilled') { Object.assign(this.data, history(h.value)); this.data.historyError = ''; }
          else this.data.historyError = `Match history could not refresh${h.reason?.status ? ` (HTTP ${h.reason.status})` : ''}.`;
          if ((p.status === 'rejected' && p.reason?.status === 401) || (h.status === 'rejected' && h.reason?.status === 401)) {
            this.cancelLeagueRefresh();
            Object.assign(this.data, { authenticated: false, profile: null, games: [], leagueGames: [], summary: null, rankedSeason: null, error: 'Your ECL session has expired. Please sign in again.' });
          }
          if (this.data.authenticated && p.status === 'fulfilled' && p.value.profile?.riotName && p.value.profile?.chinaServerId) void this.refreshLeague(session, epoch);
        }
      } else if (apply()) Object.assign(this.data, { profile: null, games: [], leagueGames: [], summary: null, rankedSeason: null });
      const ladder = await ladderPromise;
      if (apply()) {
        if (ladder.rows) this.data.leaderboard = ladder.rows;
        this.data.ladderError = ladder.error || '';
        if (!this.data.error && !this.data.historyError && !this.data.ladderError) this.data.lastUpdated = Date.now();
      }
    } finally { if (epoch === this.epoch) { this.data.loading = false; this.changed(); } }
  }
  cancelLeagueRefresh() { this.leagueController?.abort(); this.leagueController = null; this.leagueAttempt = null; this.data.leagueRefreshing = false; this.data.leagueRefreshError = ''; }
  async refreshLeague(session, epoch) {
    const last = Date.parse(this.data.profile?.lastRankLookup || '');
    if (Number.isFinite(last) && Date.now() >= last && Date.now() - last < 12 * 3600000) return;
    if (this.leagueController || (this.leagueAttempt?.epoch === epoch && Date.now() - this.leagueAttempt.at < 5 * 60000)) return;
    this.leagueAttempt = { epoch, at: Date.now() };
    const controller = new AbortController(); this.leagueController = controller;
    const current = () => this.epoch === epoch && this.data.authenticated && !controller.signal.aborted;
    this.data.leagueRefreshing = true; this.data.leagueRefreshError = ''; this.changed();
    try {
      const result = await this.refreshStats(session.access_token, undefined, controller.signal);
      if (!current()) return;
      if (!result.ok) throw new Error('Snapshot unavailable');
      if (['updated', 'fresh'].includes(result.status)) {
        const value = await this.read('/api/account/profile', session.access_token);
        if (current()) { this.data.profile = profile(value.profile); this.data.leagueGames = leagueHistory(value.profile?.lzyumiRankedGames); }
      }
    } catch { if (current()) this.data.leagueRefreshError = 'League refresh unavailable. Showing the saved ECL snapshot.'; }
    finally { if (this.leagueController === controller) { this.leagueController = null; this.data.leagueRefreshing = false; this.changed(); } }
  }
  dispose() { this.cancelLeagueRefresh(); this.client?.auth.stopAutoRefresh(); }
  async matchDetail(id) {
    const epoch = this.epoch;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !this.data.authenticated || !this.data.games.some(g => g.id === id)) throw new Error('Choose a match in your own Inhouse History.');
    const session = await this.client?.auth.getSession();
    if (epoch !== this.epoch || session?.error || !session?.data?.session?.access_token) throw new Error('Sign in again to view match details.');
    const response = await this.read(`/api/hub/my-inhouse-history?statId=${id}`, session.data.session.access_token);
    if (epoch !== this.epoch || !this.data.authenticated) throw new Error('Account changed. Match details cleared.');
    return scoreboard(response, id);
  }
  async desktopRequest(body, capability, signal) {
    if (!['link', 'claim', 'submit'].includes(body?.action)) throw new Error('Unsupported reporting request.');
    const epoch = this.epoch;
    const session = await this.client?.auth.getSession();
    if (epoch !== this.epoch || !this.data.authenticated || !session?.data?.session?.access_token || session.error) throw new Error('Sign in to ECL Hub before connecting reporting.');
    const bytes = JSON.stringify(body);
    if (Buffer.byteLength(bytes) > 2 * 1024 * 1024) throw new Error('Match upload exceeds the pilot size limit.');
    const response = await fetch(`${SITE}/api/desktop/reports`, { method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${session.data.session.access_token}`, ...(capability ? { 'x-ecl-desktop-link': capability } : {}) }, body: bytes });
    const reader = response.body?.getReader(); let size = 0; const chunks = [];
    if (!reader) throw new Error('Reporting server returned an empty response.');
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 32768) throw new Error(); chunks.push(Buffer.from(value)); } }
    catch { await reader.cancel().catch(() => {}); throw new Error('Reporting response was too large or interrupted.'); }
    if (epoch !== this.epoch) throw new Error('ECL account changed. Reconnect reporting.');
    if (!response.ok) { const error = new Error(`Reporting server HTTP ${response.status}. Check the pilot setup and try again.`); error.status = response.status; throw error; }
    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('Reporting server returned unreadable JSON.'); }
    return payload;
  }
}
module.exports = { Account, profile, history, leagueHistory, leaderboard, scoreboard, rankedSeason, websiteGet, websiteRefresh };
