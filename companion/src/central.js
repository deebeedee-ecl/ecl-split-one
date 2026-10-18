import { t, locale, setLanguage } from './i18n.js';
import { position, rankLabel, serverLabel, updateLabel } from './presentation.cjs';
import { chinaServerOptions } from '../../components/account/account-options.ts';
import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js';
Chart.register(DoughnutController, ArcElement, Tooltip);
const names = new Map(__CHAMPIONS__.map(c => [String(c.id), c.name]));
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = value => Number(value || 0).toLocaleString(locale());
const champion = id => names.get(String(id)) || `Champion ${id || '?'}`;
const date = value => Number.isNaN(Date.parse(value)) ? '--' : new Date(value).toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
const stamp = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString(locale()) : '--';
const role = value => t(position(value)?.[1] || 'Role unavailable');
const roleIcon = value => { const found = position(value); return found ? `<img class="role-icon" src="roles/${found[0]}.png" alt="${esc(role(value))}" title="${esc(role(value))}">` : `<span class="role-unknown" title="${t('Role unavailable')}" aria-label="${t('Role unavailable')}">?</span>`; };
const rank = value => rankLabel(value, locale() === 'zh-CN') || t('Rank not set');
const server = value => serverLabel(value, chinaServerOptions, locale() === 'zh-CN') || t('Not set');
const portrait = id => id ? `<img class="champion-portrait" src="champions/${esc(id)}.png" alt="${esc(champion(id))}" loading="lazy">` : '<span class="champion-portrait placeholder"></span>';
const badge = (text, good = false) => `<span class="badge ${good ? 'good' : 'neutral'}">${esc(text)}</span>`;
const empty = (title, detail) => `<div class="native-empty"><i data-lucide="history"></i><h3>${esc(t(title))}</h3><p>${esc(t(detail))}</p></div>`;
const avatar = (p, large = false) => `<span class="native-avatar ${large ? 'large' : ''}"><span>${esc((p.displayName || 'ECL').slice(0, 2).toUpperCase())}</span>${p.avatar ? `<img src="${esc(p.avatar)}" alt="${esc(p.displayName)}">` : ''}</span>`;
export function createWorkspace({ api, tab, refreshIcons, onLanguage }) {
  let account, collector, version, demo, published, updates, chart, language, deferredUpdate = '';
  let detailRequest = 0, selectedScoreboard = null;
  let page = 0, result = 'all', query = '', loginBusy = false, leaguePage = 0, queue = 'all', leagueQuery = '', feed = 'all', ladderQuery = '', ladderPage = 0, ladderSort = 'rank';
  const notify = message => { $('workspace-notice').textContent = t(message); $('workspace-notice').hidden = !message; };
  async function action(call) { const response = await call(); if (!response.ok) throw new Error(response.error); return response.data; }
  const guard = call => action(call).catch(error => notify(error.message));
  const prompt = () => `<div class="signin-prompt"><div><h2>${t('Your ECL account, here.')}</h2><p>${t('Sign in to see your profile and recorded ECL games.')}</p></div><button class="primary" data-native-login><i data-lucide="log-in"></i>${t('Sign in')}</button></div>`;
  function loginStorage() { $('login-storage').textContent = t($('remember-me').checked ? 'Windows-encrypted session. Password never saved.' : 'Until you quit ECL Hub. Password never saved.'); }
  function openLogin() {
    if (account.authBusy) return;
    if (demo) return notify('Sample mode cannot sign in to real accounts.');
    $('login-error').hidden = true; $('account-password').value = '';
    $('remember-me').disabled = !account.secureStorage; $('remember-me').checked = !!account.secureStorage; loginStorage();
    $('login-submit').disabled = !account.configured;
    if (!account.configured) { $('login-error').hidden = false; $('login-error').textContent = t('ECL sign-in is not configured in this build.'); }
    $('login-dialog').showModal(); $('account-email').focus();
  }
  function metrics() {
    const s = account.summary;
    const rows = [['ECL rating', s ? num(s.elo) : '--'], ['Games', s ? num(s.games) : '--'], ['Win rate', s?.games ? `${Math.round(s.wins / s.games * 100)}%` : '--'], ['Average KDA', s ? s.averageKda.toFixed(2) : '--'], ['MVPs', s ? num(s.mvps) : '--']];
    return `<dl class="metrics-strip">${rows.map(([label, value]) => `<div><dt>${t(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  }
  function matchTable(games, league = false) {
    return `<table class="native-matches ${league ? 'league-matches' : ''}"><thead><tr>${[league ? 'Champion' : 'Champion / game', 'Result', 'K / D / A', league ? 'Queue' : 'Rating', league ? 'Played' : 'Date'].map(label => `<th scope="col">${t(label)}</th>`).join('')}</tr></thead><tbody>${games.map(g => `<tr><td><div class="champion-cell">${portrait(g.championId)}<div><div class="champion-heading">${roleIcon(g.role)}${league ? `<strong>${esc(champion(g.championId))}</strong>` : `<button class="match-open" data-scoreboard="${esc(g.id)}" title="${t('View match details')}">${esc(champion(g.championId))}</button>`}</div><small>${esc(league ? role(g.role) : g.label)}</small></div></div></td><td><span class="result ${g.isWin === true ? 'win' : g.isWin === false ? 'loss' : ''}">${g.isWin === true ? t('WIN') : g.isWin === false ? t('LOSS') : '--'}</span></td><td class="kda">${g.kills == null ? '--' : `${g.kills} / ${g.deaths} / ${g.assists}`}${g.isMVP ? '<small class="award">MVP</small>' : g.isSVP ? '<small class="award">SVP</small>' : ''}</td><td class="${league ? 'queue-label' : g.lpChange >= 0 ? 'positive' : 'negative'}">${league ? t(g.queue === 'solo' ? 'Solo / Duo' : 'Flex') : `${g.lpChange > 0 ? '+' : ''}${num(g.lpChange)}`}</td><td class="date-cell">${esc(league ? g.reportedAt || '--' : date(g.date))}</td></tr>`).join('')}</tbody></table>`;
  }
  function dashboard() {
    const p = account.profile;
    $('dashboard-content').innerHTML = p ? `<div class="dashboard-welcome">${avatar(p)}<div><span class="eyebrow">${t('WELCOME BACK')}</span><h2>${esc(p.displayName)}</h2></div><button class="text-command" data-go="profile">${t('My profile')}<i data-lucide="arrow-right"></i></button></div>` : account.authenticated ? empty('ECL account connected', account.error || 'Complete your profile on the ECL website.') : prompt();
    upcoming();
  }
  function upcoming() {
    $('dashboard-refresh').disabled = account.loading || account.authBusy || published.loading || demo;
    const rows = (published.fixtures || []).filter(row => Date.parse(row.scheduledAt) > Date.now());
    $('fixture-content').innerHTML = rows.length ? rows.map(row => `<article class="fixture-row"><div><span class="small-label">${esc(row.label ? t(row.label) : t('Tournament fixture'))}${row.bestOf ? ` / ${t('Best of {{count}}', { count: row.bestOf })}` : ''}</span><h3>${esc(row.home)} <span>${t('vs')}</span> ${esc(row.away)}</h3></div><time datetime="${esc(row.scheduledAt)}">${esc(stamp(row.scheduledAt))}</time></article>`).join('') : empty(published.fixturesError ? 'Fixtures unavailable' : 'No upcoming fixtures announced', published.fixturesError || 'New tournament fixtures will appear here when scheduled.');
    $('fixture-status').textContent = published.loading ? t('Loading fixtures...') : published.fixturesUpdatedAt ? t('Schedule checked {{date}}', { date: stamp(published.fixturesUpdatedAt), interpolation: { escapeValue: false } }) : '';
  }
  function performance() {
    chart?.destroy(); chart = null;
    const s = account.summary;
    const seasonGames = account.rankedSeason ? account.games.filter(g => Date.parse(g.date) >= Date.parse(account.rankedSeason.startedAt)) : account.games;
    if (!account.profile) { $('profile-activity').innerHTML = ''; return; }
    const champions = s?.topChampions?.length ? s.topChampions.map(c => `<div class="champion-summary">${portrait(c.championId)}<div><strong>${esc(champion(c.championId))}</strong><small>${t('{{count}} games', { count: c.games })}</small></div><span>${c.games ? Math.round(c.wins / c.games * 100) : 0}% <small>WR</small></span></div>`).join('') : `<p class="section-empty">${t('No champion statistics yet.')}</p>`;
    $('profile-activity').innerHTML = `<div class="desktop-grid"><section class="native-section"><div class="section-heading"><h2>${t('Recent ECL matches')}</h2><button class="text-command" data-go="history">${t('View all')}<i data-lucide="arrow-right"></i></button></div>${account.games.length ? matchTable(account.games.slice(0, 3)) : empty(account.authenticated ? 'No recorded ECL games' : 'Sign in for your match history', 'Local collections appear in Collector, not in official ECL history.')}</section><section class="native-section"><div class="section-heading"><h2>${t('Most played')}</h2><span class="small-label">${t(account.rankedSeason ? 'CURRENT SEASON / LATEST 100' : 'ECL HISTORY')}</span></div>${champions}</section></div><section class="form-section"><div><span class="eyebrow">${t('Inhouse form')}</span><h2>${t('Last {{count}} recorded games', { count: Math.min(seasonGames.length, 10) })}</h2><div class="form-results">${seasonGames.slice(0, 10).reverse().map(g => `<span class="${g.isWin ? 'win' : 'loss'}" title="${esc(`${champion(g.championId)}: ${t(g.isWin ? 'WIN' : 'LOSS')}`)}">${g.isWin ? 'W' : 'L'}</span>`).join('')}</div></div><div class="form-chart"><canvas id="form-chart" role="img" aria-label="${t('Wins and losses')}">${t('Wins and losses')}</canvas></div></section><section class="native-section profile-roles"><div class="section-heading"><h2>${t('Role distribution')}</h2></div>${s?.roles?.length ? s.roles.map(r => `<div class="role-line"><div><strong>${esc(role(r.role))}</strong><span>${t('{{count}} games', { count: r.games })} / ${r.winRate}% WR</span></div><progress value="${r.pct}" max="100" aria-label="${esc(role(r.role))}"></progress></div>`).join('') : `<p class="section-empty">${t('No role statistics yet.')}</p>`}</section><p class="synced-at">${account.loading ? t('Refreshing ECL data...') : account.lastUpdated ? t('Last refreshed {{date}}', { date: stamp(account.lastUpdated) }) : t('Not yet refreshed')}</p>`;
    const games = seasonGames.slice(0, 10), wins = games.filter(g => g.isWin).length;
    if (games.length) chart = new Chart($('form-chart'), { type: 'doughnut', data: { labels: [t('Wins'), t('Losses')], datasets: [{ data: [wins, games.length - wins], backgroundColor: ['#70e0ad', '#ff929c'], borderWidth: 0, spacing: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '78%', animation: false, plugins: { legend: { display: false } } } });
  }
  function profile() {
    performance();
    const p = account.profile;
    if (!p) { $('profile-content').innerHTML = account.authenticated ? empty('No profile available', account.error || 'Complete your ECL profile on the website, then refresh.') : prompt(); return; }
    const rankLine = (label, value) => `<div class="champion-summary rank-summary"><strong>${t(label)}</strong><span>${esc(rank(value?.tier))}${value ? ` / ${num(value.lp)} LP` : ''}</span></div>`;
    const champs = p.leagueChampions || [];
    $('profile-content').innerHTML = `<div class="native-identity profile-identity">${avatar(p, true)}<div class="profile-name"><span class="eyebrow">${esc(p.nationality || t('ECL PLAYER'))}</span><h2>${esc(p.displayName)}</h2><p>${esc(p.riotName)}#${esc(p.riotTag)} <span>/ ${esc(server(p.server))}</span></p><dl class="preferred-roles">${[['Primary role', p.primaryRole], ['Secondary role', p.secondaryRole]].map(([label, value]) => `<div><dt>${t(label)}</dt><dd>${roleIcon(value)}${esc(role(value))}</dd></div>`).join('')}</dl></div><div class="identity-end profile-badges">${badge(rank(p.currentRank))}${badge(t(p.verificationStatus === 'VERIFIED' ? 'ECL verified' : 'Verification pending'), p.verificationStatus === 'VERIFIED')}</div></div><div class="source-strip"><span>${account.rankedSeason ? esc(account.rankedSeason.name) : t('Recorded inhouse history / latest 100 games')}</span></div>${metrics()}<div class="source-strip"><span class="badge neutral">${t('ECL snapshot')}</span><span>${p.lastRankLookup ? t('Last updated {{date}}', { date: stamp(p.lastRankLookup) }) : t('Last updated date unavailable')}</span><span role="status">${account.leagueRefreshing ? t('Refreshing League snapshot...') : esc(t(account.leagueRefreshError || ''))}</span></div><div class="desktop-grid"><section class="native-section"><div class="section-heading"><h2>${t('League ranks')}</h2></div>${rankLine('Solo / Duo', p.soloRank)}${rankLine('Flex', p.flexRank)}</section><section class="native-section"><div class="section-heading"><h2>${t('League champions')}</h2><span class="small-label">${t('Saved snapshot')}</span></div>${champs.length ? champs.map(c => `<div class="champion-summary">${portrait(c.championId)}<strong>${esc(champion(c.championId))}</strong><span>${t('{{count}} games', { count: c.games })}</span></div>`).join('') : `<p class="section-empty">${t('No champion statistics yet.')}</p>`}</section></div>`;
  }
  function histories() {
    const games = account.games.filter(g => (result === 'all' || (result === 'wins' ? g.isWin : !g.isWin)) && `${champion(g.championId)} ${g.label} ${role(g.role)}`.toLowerCase().includes(query));
    const pages = Math.max(1, Math.ceil(games.length / 10)); page = Math.max(0, Math.min(page, pages - 1));
    $('history-content').innerHTML = !account.authenticated ? prompt() : games.length ? matchTable(games.slice(page * 10, page * 10 + 10)) : empty(account.historyError ? 'History unavailable' : 'No matches found', account.historyError || 'Try another filter, or play an ECL game.');
    $('history-count').textContent = t('{{count}} recorded games / latest 100', { count: games.length }); $('history-page').textContent = `${page + 1} / ${pages}`;
    $('history-prev').disabled = page === 0; $('history-next').disabled = page + 1 >= pages; $('history-search').disabled = !account.authenticated;
    document.querySelectorAll('[data-result]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.result === result)); b.disabled = !account.authenticated; });
    const league = (account.leagueGames || []).filter(g => (queue === 'all' || g.queue === queue) && `${champion(g.championId)} ${role(g.role)}`.toLowerCase().includes(leagueQuery));
    const lp = Math.max(1, Math.ceil(league.length / 10)); leaguePage = Math.max(0, Math.min(leaguePage, lp - 1));
    $('league-updated').textContent = account.profile?.lastRankLookup ? t('Last updated {{date}}', { date: stamp(account.profile.lastRankLookup), interpolation: { escapeValue: false } }) : t('Last updated date unavailable');
    $('league-refresh-status').textContent = account.leagueRefreshing ? t('Refreshing League snapshot...') : account.leagueRefreshError ? t(account.leagueRefreshError) : '';
    $('league-content').innerHTML = !account.authenticated ? prompt() : league.length ? matchTable(league.slice(leaguePage * 10, leaguePage * 10 + 10), true) : empty('No saved League games', account.error || 'No games in this saved profile snapshot match the current filter.');
    $('league-count').textContent = t('{{count}} saved games', { count: league.length }); $('league-page').textContent = `${leaguePage + 1} / ${lp}`;
    $('league-prev').disabled = leaguePage === 0; $('league-next').disabled = leaguePage + 1 >= lp; $('league-search').disabled = !account.authenticated;
    document.querySelectorAll('[data-queue]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.queue === queue)); b.disabled = !account.authenticated; });
  }
  function ladder() {
    const all = published.ladderCoverage === 'full' || published.ladder.length ? published.ladder : account.leaderboard;
    const rows = all.filter(row => row.name.toLowerCase().includes(ladderQuery)).toSorted((a, b) => ladderSort === 'rank' ? a.rank - b.rank : (b[ladderSort] ?? -1) - (a[ladderSort] ?? -1));
    const pages = Math.max(1, Math.ceil(rows.length / 15)); ladderPage = Math.max(0, Math.min(ladderPage, pages - 1));
    $('ladder-source').textContent = t(published.ladderCoverage === 'full' ? published.ladderSeason ? 'Current season / full ladder' : 'All-time inhouse standings / full ladder' : published.ladder.length ? 'Website ladder' : 'Published top ten');
    $('ladder-context').textContent = [published.ladderSeason?.name, t(published.ladderError || (published.ladderSeason ? 'Everyone starts at 800 LP. Previous matches remain in history.' : 'Recorded inhouse results, not a separate Split II season.')), t('Champion picks: ECL snapshot'), published.ladderUpdatedAt ? t('Last refreshed {{date}}', { date: stamp(published.ladderUpdatedAt), interpolation: { escapeValue: false } }) : ''].filter(Boolean).join(' ');
    const picks = row => `<div class="ladder-picks" aria-label="${t('Most played League champions')}">${(row.championSource === 'ecl-snapshot' ? row.topChampions || [] : []).slice(0, 3).map(c => `<span title="${esc(`${t('ECL snapshot')} / ${champion(c.championId)} / ${t('{{count}} games', { count: c.games })} / ${row.championsUpdatedAt ? t('Last updated {{date}}', { date: stamp(row.championsUpdatedAt), interpolation: { escapeValue: false } }) : t('Last updated date unavailable')}`)}">${portrait(c.championId)}</span>`).join('') || `<span class="small-label" title="${t('Champion data unavailable')}">--</span>`}</div>`;
    $('ladder-content').innerHTML = rows.length ? `<table class="standings-table"><thead><tr><th scope="col">#</th><th scope="col">${t('Player')} <span class="picks-heading">/ ${t('Most played')}</span></th>${[['elo', 'Rating'], ['games', 'Games'], ['winRate', 'Win rate']].map(([key, label]) => `<th scope="col" aria-sort="${ladderSort === key ? 'descending' : 'none'}"><button data-sort="${key}">${t(label)}<i data-lucide="arrow-down-up"></i></button></th>`).join('')}</tr></thead><tbody>${rows.slice(ladderPage * 15, ladderPage * 15 + 15).map(row => `<tr><td>${row.rank}</td><td><div class="ladder-player"><div class="ladder-name"><strong>${esc(row.name)}</strong>${row.team && !/^FA$/i.test(row.team.trim()) ? `<small>${esc(row.team)}</small>` : ''}</div>${picks(row)}</div></td><td>${num(row.elo)}</td><td>${num(row.games)}</td><td>${row.winRate == null ? '--' : `${row.winRate}%`}</td></tr>`).join('')}</tbody></table>` : empty('No players found', published.ladderError || account.ladderError || 'Try another player name.');
    $('ladder-count').textContent = t('{{count}} players', { count: rows.length }); $('ladder-page').textContent = `${ladderPage + 1} / ${pages}`;
    $('ladder-prev').disabled = ladderPage === 0; $('ladder-next').disabled = ladderPage + 1 >= pages; $('ladder-refresh').disabled = published.loading;
    refreshIcons();
  }
  function drawScoreboard() {
    if (!selectedScoreboard) return;
    const detail = selectedScoreboard;
    $('scoreboard-title').textContent = detail.label;
    $('scoreboard-meta').textContent = `${date(detail.date)} / ${t('{{count}} players', { count: detail.players.length })}`;
    const value = n => n == null ? '--' : num(n);
    const hasVision = detail.players.some(p => p.vision !== null);
    const hasCs = detail.players.some(p => p.cs !== null);
    const sum = (players, key) => players.length && players.every(p => p[key] !== null) ? players.reduce((total, p) => total + p[key], 0) : null;
    const maxDamage = Math.max(1, ...detail.players.map(p => p.damage || 0));
    const winners = detail.players.filter(p => p.isWin), losers = detail.players.filter(p => !p.isWin);
    const metric = (n, approximate) => `${approximate && n !== null ? '~' : ''}${value(n)}`;
    const award = p => p.isMVP || p.isSVP ? `<span class="match-award ${p.isMVP ? 'mvp' : 'svp'}"><i data-lucide="${p.isMVP ? 'trophy' : 'shield-check'}"></i>${p.isMVP ? 'MVP' : 'SVP'}</span>` : '';
    const columnCount = 4 + Number(hasVision) + Number(hasCs);
    const roleOrder = player => { const index = ['top', 'jungle', 'mid', 'bot', 'support'].indexOf(position(player.role)?.[0]); return index < 0 ? 99 : index; };
    $('scoreboard-content').innerHTML = `<div class="match-outcome-strip"><div><span class="result win">${t('VICTORY')}</span><strong>${t('Winning team')}</strong><small>${value(sum(winners, 'gold'))} ${t('Gold')}</small></div><div class="match-kill-score"><strong>${value(sum(winners, 'kills'))}</strong><span>:</span><strong>${value(sum(losers, 'kills'))}</strong><small>${t('Team kills')}</small></div><div><span class="result loss">${t('DEFEAT')}</span><strong>${t('Losing team')}</strong><small>${value(sum(losers, 'gold'))} ${t('Gold')}</small></div></div><table class="scoreboard-table combat-table"><colgroup><col class="player-column"><col class="kda-column"><col class="damage-column"><col class="gold-column">${hasCs ? '<col class="cs-column">' : ''}${hasVision ? '<col class="vision-column">' : ''}</colgroup><thead><tr>${['Player', 'K / D / A', 'Damage', 'Gold', ...(hasCs ? ['CS'] : []), ...(hasVision ? ['Vision'] : [])].map(label => `<th scope="col">${t(label)}</th>`).join('')}</tr></thead><tbody>${[true, false].map(win => {
      const players = detail.players.filter(p => p.isWin === win).toSorted((a, b) => roleOrder(a) - roleOrder(b));
      const damageTotal = sum(players, 'damage');
      return `<tr class="scoreboard-team ${win ? 'victory' : 'defeat'}"><th colspan="${columnCount}" scope="colgroup"><span>${t(win ? 'Winning team' : 'Losing team')}</span><span>${value(sum(players, 'kills'))} ${t('Kills')}</span></th></tr>${players.map(p => `<tr class="combat-row ${p.isMVP ? 'mvp-row' : p.isSVP ? 'svp-row' : ''}"><td><div class="champion-cell">${portrait(p.championId)}<div><div class="scoreboard-player-name"><strong>${esc(p.name)}</strong>${award(p)}</div><small>${roleIcon(p.role)}${esc(champion(p.championId))}</small></div></div></td><td class="combat-kda"><strong>${value(p.kills)} <span>/ ${value(p.deaths)} /</span> ${value(p.assists)}</strong><small>${p.kills !== null && p.assists !== null && p.deaths !== null ? `${((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2)} ${t('KDA')}` : '--'}</small></td><td><div class="damage-readout"><strong>${metric(p.damage, p.damageApproximate)}</strong><small>${p.damage !== null && damageTotal > 0 ? `${Math.round(p.damage / damageTotal * 100)}%` : ''}</small></div><progress class="damage-bar ${win ? 'win' : 'loss'}" max="${maxDamage}" value="${p.damage || 0}" aria-label="${t('Damage')} / ${esc(p.name)}"></progress></td><td class="combat-gold">${metric(p.gold, p.goldApproximate)}</td>${hasCs ? `<td>${value(p.cs)}</td>` : ''}${hasVision ? `<td>${value(p.vision)}</td>` : ''}</tr>`).join('')}`;
    }).join('')}</tbody></table><div class="scoreboard-footnotes">${!hasVision ? `<span><i data-lucide="info"></i>${t('Vision was not recorded for this match.')}</span>` : ''}${detail.players.some(p => p.damageApproximate || p.goldApproximate) ? `<span>${t('~ Rounded source value')}</span>` : ''}${detail.metricsVersion !== 2 ? `<span>${t('Match statistics need the website data update.')}</span>` : ''}</div>`;
    refreshIcons();
  }
  async function openScoreboard(id) {
    const request = ++detailRequest; selectedScoreboard = null;
    $('scoreboard-title').textContent = t('Match details'); $('scoreboard-meta').textContent = '';
    $('scoreboard-content').textContent = t('Loading match details...');
    if (!$('scoreboard-dialog').open) $('scoreboard-dialog').showModal();
    try {
      const detail = await action(() => api.accountMatch(id));
      if (request !== detailRequest || !$('scoreboard-dialog').open) return;
      selectedScoreboard = detail; drawScoreboard();
    } catch (error) { if (request === detailRequest) $('scoreboard-content').textContent = t(error.message); }
  }
  function feeds() {
    const featuredEvent = published.items.find(item => item.category === 'event');
    const items = (feed === 'all' && featuredEvent ? [featuredEvent, ...published.items.filter(item => item !== featuredEvent)] : published.items.filter(item => feed === 'all' || item.category === feed)).slice(0, 4);
    $('feed-content').innerHTML = items.length ? items.map(item => `<article class="news-item"><div class="news-meta"><span>${t(({ event: 'Tournaments', patch: 'Patches', news: 'News' })[item.category])}</span><time>${esc(item.date || t(item.status || 'View details'))}</time></div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><button class="text-command" data-link="${esc(item.url)}">${t('Read on website')}<i data-lucide="arrow-up-right"></i></button></article>`).join('') : empty('No published posts available', published.error || 'Refresh or visit the ECL website.');
    $('feed-status').textContent = published.loading ? t('Loading website updates...') : published.error ? t(published.error) : published.updatedAt ? t('Website checked {{date}}', { date: stamp(published.updatedAt), interpolation: { escapeValue: false } }) : '';
    $('feed-refresh').disabled = published.loading || demo;
    document.querySelectorAll('[data-feed]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.feed === feed))); refreshIcons();
  }
  function updateStatus() {
    const status = updates.status;
    $('version-status-text').textContent = t(updateLabel(status), { percent: Math.round(updates.progress || 0) });
    $('version-status').dataset.status = status;
    $('version-status').title = t('App updates');
    const descriptions = { idle: 'Automatic checks enabled', checking: 'Checking for updates...', current: 'You have the latest published version.', available: 'Update {{version}} available', downloading: 'Downloading update: {{percent}}%', ready: 'Update ready to install', unavailable: 'Update service unavailable. Try again later.', invalid: 'Update metadata was rejected.', development: 'Automatic checks start after installation.' };
    const text = t(descriptions[status] || descriptions.unavailable, { version: updates.availableVersion, percent: Math.round(updates.progress) });
    $('update-description').textContent = text;
    $('update-detail').textContent = `${t('Installed version {{version}}', { version })}. ${t(updates.trusted ? 'Checks on startup and every six hours.' : 'Signed release setup is still required before in-app installation.')}`;
    $('check-updates').disabled = ['checking', 'downloading', 'ready', 'development'].includes(status);
    $('download-update').hidden = status !== 'available'; $('download-update').disabled = !updates.trusted;
    $('install-update').hidden = status !== 'ready'; $('install-update').disabled = !updates.trusted;
    $('update-progress').hidden = status !== 'downloading'; $('update-progress').value = updates.progress;
    $('update-banner').hidden = !['available', 'downloading', 'ready'].includes(status) || (status === 'ready' && deferredUpdate === updates.availableVersion);
    $('update-banner-text').textContent = text; $('update-banner-action').textContent = t(status === 'ready' ? 'Restart and update' : 'View update');
    $('update-later').hidden = status !== 'ready';
  }
  function settings() {
    $('settings-version').textContent = `v${version}`; $('settings-language').value = language;
    $('release-title').textContent = `ECL Hub ${version}`; $('info-version').textContent = `v${version}`;
    $('settings-account').innerHTML = `<div><h2>${t('ECL account')}</h2><p>${esc(account.authenticated ? account.profile?.displayName || t('Account connected') : t('Not signed in'))}</p><small>${t(account.persistentSession ? 'Remembered on this PC using Windows-encrypted storage.' : 'This sign-in lasts until you quit ECL Hub.')}</small>${account.storageWarning ? `<p>${esc(t(account.storageWarning))}</p>` : ''}</div><button class="secondary" ${demo || account.authBusy ? 'disabled' : ''} ${account.authenticated ? 'data-native-logout' : 'data-native-login'}><i data-lucide="${account.authenticated ? 'log-out' : 'log-in'}"></i>${t(account.authenticated ? 'Sign out' : 'Sign in')}</button>`;
    const p = account.profile;
    $('settings-player').hidden = !p;
    $('edit-profile').disabled = !p;
    const fields = p ? [['Display name', p.displayName], ['League ID', `${p.riotName}#${p.riotTag}`], ['China server', server(p.server)], ['Primary role', role(p.primaryRole)], ['Secondary role', role(p.secondaryRole)], ['Profile rank', rank(p.currentRank)], ['Account status', p.accountStatus || t('Account status unknown')]] : [];
    $('settings-player-content').innerHTML = p ? `<dl class="profile-fields">${fields.map(([label, value]) => `<div><dt>${t(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${p.bio ? `<h3 class="bio-heading">${t('About')}</h3><p class="profile-bio">${esc(p.bio)}</p>` : ''}<div class="profile-note"><i data-lucide="shield-check"></i><p>${t('Account status comes from ECL. Desktop reporting is a consented pilot requiring administrator review.')}</p></div>` : '';
    $('settings-auto').checked = collector.autoCollect; $('settings-auto').disabled = demo; updateStatus();
  }
  function render() {
    if (!account || !collector || !published || !updates) return;
    $('account-button').querySelector('span').textContent = account.authenticated ? account.profile?.displayName || t('My account') : t('Sign in'); $('account-button').disabled = !!account.authBusy;
    $('sidebar-account').textContent = account.authenticated ? account.profile?.displayName || t('Account connected') : t('Not signed in'); $('workspace-demo').hidden = !demo;
    const errors = [account.error, account.historyError, account.storageWarning].filter(Boolean); if (errors.length) notify(errors.map(e => t(e)).join(' ')); else if (!loginBusy) notify('');
    document.querySelectorAll('[data-account-refresh]').forEach(b => { b.disabled = account.loading || account.authBusy || demo; b.title = t('Refresh ECL data'); });
    dashboard(); profile(); histories(); ladder(); feeds(); settings(); drawScoreboard(); refreshIcons();
  }
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-native-login')) openLogin();
    if (b.hasAttribute('data-native-logout')) void guard(() => api.accountLogout());
    if (b.hasAttribute('data-account-refresh')) void guard(() => api.accountRefresh());
    if (b.dataset.go) void tab(b.dataset.go);
    if (b.dataset.link) void guard(() => api.openLink(b.dataset.link));
    if (b.dataset.result) { result = b.dataset.result; page = 0; histories(); }
    if (b.dataset.queue) { queue = b.dataset.queue; leaguePage = 0; histories(); }
    if (b.dataset.feed) { feed = b.dataset.feed; feeds(); }
    if (b.dataset.sort) { ladderSort = b.dataset.sort; ladderPage = 0; ladder(); }
    if (b.dataset.scoreboard) void openScoreboard(b.dataset.scoreboard);
  });
  $('account-button').addEventListener('click', () => account.authenticated ? void tab('profile') : openLogin());
  $('account-login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (loginBusy) return; loginBusy = true; $('login-submit').disabled = true; $('login-error').hidden = true;
    try { await action(() => api.accountLogin($('account-email').value, $('account-password').value, $('remember-me').checked)); $('login-dialog').close(); }
    catch (error) { $('login-error').textContent = t(error.message); $('login-error').hidden = false; }
    finally { $('account-password').value = ''; loginBusy = false; $('login-submit').disabled = !account.configured; }
  });
  $('close-login').addEventListener('click', () => { $('account-password').value = ''; $('login-dialog').close(); }); $('login-dialog').addEventListener('close', () => { $('account-password').value = ''; });
  $('remember-me').addEventListener('change', loginStorage); $('forgot-password').addEventListener('click', () => void guard(() => api.forgotPassword()));
  $('edit-profile').addEventListener('click', () => void guard(() => api.editProfile()));
  $('history-search').addEventListener('input', () => { query = $('history-search').value.trim().toLowerCase(); page = 0; histories(); });
  $('league-search').addEventListener('input', () => { leagueQuery = $('league-search').value.trim().toLowerCase(); leaguePage = 0; histories(); });
  $('ladder-search').addEventListener('input', () => { ladderQuery = $('ladder-search').value.trim().toLowerCase(); ladderPage = 0; ladder(); });
  $('history-prev').addEventListener('click', () => { page--; histories(); }); $('history-next').addEventListener('click', () => { page++; histories(); });
  $('league-prev').addEventListener('click', () => { leaguePage--; histories(); }); $('league-next').addEventListener('click', () => { leaguePage++; histories(); });
  $('ladder-prev').addEventListener('click', () => { ladderPage--; ladder(); }); $('ladder-next').addEventListener('click', () => { ladderPage++; ladder(); });
  for (const id of ['feed-refresh', 'ladder-refresh']) $(id).addEventListener('click', () => void guard(() => api.publicRefresh()));
  $('dashboard-refresh').addEventListener('click', () => { void guard(() => api.accountRefresh()); void guard(() => api.publicRefresh()); });
  $('settings-language').addEventListener('change', async () => {
    $('settings-language').disabled = true;
    try { const result = await action(() => api.setLanguage($('settings-language').value)); language = result.language; await setLanguage(language); onLanguage(); render(); }
    catch (error) { $('settings-language').value = language; notify(error.message); }
    finally { $('settings-language').disabled = false; }
  });
  $('settings-auto').addEventListener('change', async () => { await guard(() => api.auto($('settings-auto').checked)); settings(); });
  $('settings-folder').addEventListener('click', () => void guard(() => api.folder())); $('settings-privacy').addEventListener('click', () => void tab('info'));
  $('check-updates').addEventListener('click', () => void guard(() => api.updateCheck())); $('download-update').addEventListener('click', () => void guard(() => api.updateDownload())); $('install-update').addEventListener('click', () => void guard(() => api.updateInstall()));
  $('version-status').addEventListener('click', () => void tab('settings'));
  $('update-banner-action').addEventListener('click', () => updates.status === 'ready' ? void guard(() => api.updateInstall()) : void tab('settings'));
  $('update-later').addEventListener('click', () => { deferredUpdate = updates.availableVersion; updateStatus(); });
  $('release-notes').addEventListener('click', () => $('release-dialog').showModal()); $('close-release').addEventListener('click', () => $('release-dialog').close());
  $('close-scoreboard').addEventListener('click', () => $('scoreboard-dialog').close());
  $('scoreboard-dialog').addEventListener('close', () => { detailRequest++; selectedScoreboard = null; $('scoreboard-content').textContent = ''; });
  document.addEventListener('error', event => { if (event.target.tagName === 'IMG') event.target.hidden = true; }, true);
  api.onAccount(value => { if (!value.authenticated || `${value.profile?.riotName}#${value.profile?.riotTag}` !== `${account?.profile?.riotName}#${account?.profile?.riotTag}`) { detailRequest++; selectedScoreboard = null; $('scoreboard-content').textContent = ''; $('scoreboard-dialog').close(); } account = value; render(); }); api.onPublic(value => { published = value; if (account) { feeds(); ladder(); upcoming(); refreshIcons(); } }); api.onUpdates(value => { updates = value; if (account) updateStatus(); });
  return { start(initial) { ({ account, collector, version, demo, language, updates } = initial); published = initial.public; render(); }, collector(value) { collector = value; render(); } };
}
