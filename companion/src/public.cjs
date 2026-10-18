const { EventEmitter } = require('node:events');
const { load } = require('cheerio');
const { leaderboard, rankedSeason } = require('./account.cjs');
const SITE = 'https://eclchina.lol';
const PAGES = new Set(['/news', '/tournaments', '/', '/hub/leaderboard', '/api/matches', '/api/hub/ladder']);
const clean = (value, max = 240) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
function publicLink(value) {
  try { const url = new URL(value, SITE); return url.origin === SITE && !url.username && !url.password && /^\/(news|tournaments|split-ii|hub\/leaderboard)(\/|$)/.test(url.pathname) ? url.toString() : ''; } catch { return ''; }
}
async function readPage(endpoint, transport = fetch) {
  if (!PAGES.has(endpoint)) throw new Error('Unsupported public page.');
  const response = await transport(`${SITE}${endpoint}`, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: endpoint.startsWith('/api/') ? 'application/json' : 'text/html' } });
  if (!response.ok) throw new Error(`Public page unavailable (HTTP ${response.status}).`);
  const reader = response.body?.getReader(); if (!reader) throw new Error('Empty public page.');
  const chunks = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4 * 1024 * 1024) throw new Error('Public page too large.'); chunks.push(Buffer.from(part.value)); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; }
  return Buffer.concat(chunks).toString('utf8');
}
function news(html) {
  const $ = load(html); $('script, style, template').remove();
  return $('main article').toArray().slice(0, 8).map((element, i) => {
    const root = $(element), title = clean(root.find('h2,h3').first().text());
    const paras = root.find('p').toArray();
    return { id: `news-${i}`, title, category: /patch/i.test(title) ? 'patch' : 'news',
      detail: clean($(paras.find(p => $(p).text().trim().length > 60)).text(), 350),
      date: clean(root.find('time').first().text() || root.find('span').filter((_i, el) => /\b20\d\d\b/.test($(el).text())).first().text(), 60), url: `${SITE}/news` };
  }).filter(row => row.title);
}
function events(html, homepage = '') {
  const $ = load(html); $('script,style,template').remove();
  const result = $('main a').toArray().map(element => {
    const root = $(element), title = clean(root.find('h2,h3').first().text()), url = publicLink(root.attr('href'));
    return { id: url, title, category: 'event', detail: clean(root.find('p').first().text(), 350), date: '', url,
      status: /archiv/i.test(root.text()) ? 'Archive' : 'Published event' };
  }).filter(row => row.title && row.url).slice(0, 8);
  const home = load(homepage); home('script,style,template').remove();
  if (home('a[href="/split-ii"]').length) result.unshift({ id: 'split-ii', title: 'ECL Split II: Draft', category: 'event', detail: clean(home('a[href="/split-ii"]').first().text(), 350), date: '', url: `${SITE}/split-ii`, status: 'View details' });
  return result;
}
function ladder(html) {
  const $ = load(html); $('script,style,template').remove();
  const table = $('table').filter((_i, el) => /Player|玩家/.test($(el).find('thead').text())).first();
  return table.find('tbody tr').toArray().slice(0, 500).map(element => {
    const cells = $(element).find('td'), values = cells.toArray().map(el => clean($(el).text()));
    if (cells.length < 6) return null;
    const rank = Number(values[0].replace(/^#/, '')), name = clean(cells.eq(1).find('p').first().text() || values[1]);
    const numeric = value => Number(String(value).replace(/[^\d.-]/g, ''));
    const record = /^(\d+)\s*-\s*(\d+)$/.exec(values[3]);
    if (!record || !/^ELO$/i.test(clean(table.find('th').eq(2).text()))) return null;
    const winRate = /^\d+(?:\.\d+)?%$/.test(values[4]) ? numeric(values[4]) : null;
    return { rank, name, elo: numeric(values[2]), wins: Number(record[1]), losses: Number(record[2]), games: Number(record[1]) + Number(record[2]), winRate, streak: clean(values[5]), role: clean(values[6]), team: '' };
  }).filter(row => row && Number.isFinite(row.rank) && row.rank > 0 && row.name && Number.isFinite(row.elo));
}
function fixtures(raw, now = Date.now()) {
  if (!Array.isArray(raw)) throw new Error('Unreadable fixture list.');
  const seen = new Set();
  return raw.slice(0, 5000).filter(row => {
    if (!row || typeof row !== 'object' || row.status !== 'SCHEDULED' || typeof row.scheduledAt !== 'string' || Date.parse(row.scheduledAt) <= now || !Number.isFinite(Date.parse(row.scheduledAt))) return false;
    const id = clean(row.id, 100);
    if (!id || seen.has(id) || !clean(row.homeTeam?.name) || !clean(row.awayTeam?.name)) return false;
    seen.add(id); return true;
  }).map(row => ({ id: clean(row.id, 100), home: clean(row.homeTeam.name, 100), away: clean(row.awayTeam.name, 100),
    scheduledAt: new Date(row.scheduledAt).toISOString(), label: clean(row.roundLabel || row.matchLabel || row.stage, 100),
    bestOf: Number.isSafeInteger(row.bestOf) && row.bestOf > 0 && row.bestOf <= 9 ? row.bestOf : null,
  })).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)).slice(0, 4);
}
class PublicData extends EventEmitter {
  constructor(read = readPage) { super(); this.read = read; this.data = { items: [], ladder: [], ladderCoverage: '', ladderUpdatedAt: null, fixtures: [], fixturesError: '', fixturesUpdatedAt: null, loading: false, error: '', ladderError: '', updatedAt: null }; }
  snapshot() { return structuredClone(this.data); }
  async refresh() {
    if (this.pending) return this.pending;
    this.pending = this.performRefresh();
    try { await this.pending; } finally { this.pending = null; }
  }
  async performRefresh() {
    this.data.loading = true; this.emit('change', this.snapshot());
    const pages = await Promise.allSettled(['/news', '/tournaments', '/', '/hub/leaderboard', '/api/matches', '/api/hub/ladder'].map(page => this.read(page)));
    const [n, e, h, l, f, full] = pages;
    const items = [...(n.status === 'fulfilled' ? news(n.value) : []), ...(e.status === 'fulfilled' ? events(e.value, h.status === 'fulfilled' ? h.value : '') : [])];
    if (items.length) this.data.items = items;
    this.data.error = n.status === 'rejected' || e.status === 'rejected' || h.status === 'rejected' || !items.length ? 'Some website updates are unavailable. Previously loaded posts may be shown.' : '';
    let structured = null, season = null;
    try {
      if (full.status === 'fulfilled') {
        const raw = JSON.parse(full.value);
        season = raw.scope === 'season' ? rankedSeason(raw.season) : null;
        if ((raw.scope === 'all-time' || raw.scope === 'season' && season) && raw.coverage === 'full' && Array.isArray(raw.players) && raw.players.length <= 500) structured = leaderboard(raw.players, 500);
      }
    } catch { /* Older website deployments only provide the top-ten endpoint. */ }
    const rows = structured ?? (l.status === 'fulfilled' ? ladder(l.value) : []);
    if (structured !== null || rows.length) { this.data.ladder = rows; this.data.ladderSeason = structured !== null ? season : null; this.data.ladderCoverage = structured !== null ? 'full' : 'website'; this.data.ladderUpdatedAt = Date.now(); }
    this.data.ladderError = structured === null && !rows.length ? 'Full ladder unavailable. Published top ten may be shown instead.' : '';
    try {
      if (f.status === 'rejected') throw f.reason;
      this.data.fixtures = fixtures(JSON.parse(f.value));
      this.data.fixturesError = ''; this.data.fixturesUpdatedAt = Date.now();
    } catch { this.data.fixturesError = 'Upcoming fixtures are unavailable. Try refreshing later.'; this.data.fixtures = []; }
    if (items.length) this.data.updatedAt = Date.now();
    this.data.loading = false; this.emit('change', this.snapshot());
  }
  start() { void this.refresh(); this.timer = setInterval(() => void this.refresh(), 15 * 60 * 1000); this.timer.unref(); }
  dispose() { clearInterval(this.timer); }
}
module.exports = { PublicData, readPage, publicLink, news, events, ladder, fixtures };
