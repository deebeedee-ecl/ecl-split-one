import { createIcons, LayoutDashboard, ArrowUpRight, ArrowRight, Download, Info, PanelBottomClose, FolderOpen, Power, RefreshCw, HardDrive, ListChecks, ExternalLink, RotateCw, Construction, ShieldCheck, UserRound, LogOut, LogIn, Monitor, History, Settings2, Globe, X, Search, ChevronLeft, ChevronRight, NotebookText, Swords, Trophy, ArrowDownUp } from 'lucide';
import { createWorkspace } from './central.js';
import { createSplitTwo } from './split-two.js';
import { t, setLanguage } from './i18n.js';
import { installHints } from './hints.js';
import { reportStage } from './presentation.cjs';
const icons = { LayoutDashboard, ArrowUpRight, ArrowRight, Download, Info, PanelBottomClose, FolderOpen, Power, RefreshCw, HardDrive, ListChecks, ExternalLink, RotateCw, Construction, ShieldCheck, UserRound, LogOut, LogIn, Monitor, History, Settings2, Globe, X, Search, ChevronLeft, ChevronRight, NotebookText, Swords, Trophy, ArrowDownUp };
const $ = id => document.getElementById(id);
const api = window.companion;
const splitTwo=createSplitTwo({api});
let state, reporting, demo = false, activeTab, selected, record, selecting = 0;
const champions = { 59: 'Jarvan IV', 246: 'Qiyana', 7: 'LeBlanc', 110: 'Varus', 412: 'Thresh', 31: "Cho'Gath", 107: 'Rengar', 103: 'Ahri', 222: 'Jinx', 89: 'Leona' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const count = value => Number(value || 0).toLocaleString('en-US');
const duration = value => `${Math.floor(Number(value || 0) / 60)}:${String(Number(value || 0) % 60).padStart(2, '0')}`;
const refreshIcons = () => createIcons({ icons });
const workspace = createWorkspace({ api, tab, refreshIcons, onLanguage: () => { render(); renderRecord(); } });
function notice(value) { $('notice').textContent = value; $('notice').hidden = !value; }
async function action(callback) { try { const result = await callback(); if (!result.ok) throw new Error(result.error); return result.data; } catch (error) { notice(error.message); return undefined; } }

async function tab(value) {
  const result = await action(() => api.tab(value)); if (!result) return;
  activeTab = value;
  for (const view of document.querySelectorAll('.view')) view.hidden = view.id !== value;
  for (const button of document.querySelectorAll('[data-tab]')) { button.classList.toggle('active', button.dataset.tab === value); button.setAttribute('aria-current', button.dataset.tab === value ? 'page' : 'false'); }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function render() {
  $('mode').textContent = t(demo ? 'SAMPLE DATA' : 'LOCAL PROTOTYPE');
  $('connection').textContent = t(demo ? 'Demo mode' : state.connected ? 'League connected' : 'League not connected');
  $('connection').classList.toggle('connected', state.connected);
  $('player').textContent = state.player ? `${state.player.name}${state.player.tag ? `#${state.player.tag}` : ''}` : t('Waiting for League');
  $('player-meta').textContent = state.player ? `${t('League account')}${state.player.level ? ` / ${t('Level {{level}}', { level: state.player.level })}` : ''}` : t('Open the client on this PC');
  $('phase').textContent = t(state.phase || 'Offline'); $('phase').classList.toggle('good', state.connected);
  $('status-message').textContent = t(state.message);
  $('auto').checked = state.autoCollect; $('auto').disabled = demo;
  $('collect-button').disabled = demo || !state.connected;
  $('rescan').disabled = demo;
  $('total').textContent = count(state.matches.length); $('saved-count').textContent = count(state.matches.length);
  $('match-list').innerHTML = state.matches.length ? state.matches.map(match => `<button class="match-item ${match.key === selected ? 'selected' : ''}" data-match="${escape(match.key)}"><strong>#${escape(match.gameId)}</strong><span class="type">${match.gameType === 'CUSTOM_GAME' ? t('Custom 5v5') : `${t('Queue')} ${escape(match.queueId)}`}<span>${duration(match.duration)}</span></span><small>${escape(t(reportStage(match.gameId, reporting)))}</small><span class="timestamp">${new Date(match.collectedAt).toLocaleString(document.documentElement.lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></button>`).join('') : `<div class="empty"><h3>${t('No saved matches')}</h3><p>${t('Waiting for your first collection.')}</p></div>`;
  const pending = state.jobs.filter(job => ['pending', 'fetching', 'retry', 'failed'].includes(job.status));
  $('queue').innerHTML = pending.map(job => `<div class="job"><div><strong>#${escape(job.id)} / ${escape(job.status)}</strong><p>${escape(job.error || `Attempt ${job.attempts} of 5`)}${job.status === 'retry' ? ` Next retry: ${new Date(job.nextAttempt).toLocaleTimeString()}` : ''}</p></div>${['retry', 'failed'].includes(job.status) ? `<button class="secondary" data-retry="${escape(job.key)}"><i data-lucide="rotate-cw"></i>Retry</button>` : ''}</div>`).join('');
  refreshIcons();
  renderReporting();
}
function renderReporting() {
  if (!reporting) return;
  $('reporting-description').textContent = t(reporting.message);
  $('reporting-job').hidden = !reporting.job;
  $('reporting-job').textContent = reporting.job ? `${reporting.job.label || t('Match')} / #${reporting.job.gameId}` : '';
  $('reporting-connect').hidden = reporting.enabled;
  $('reporting-connect').disabled = demo || reporting.status === 'connecting';
  $('reporting-disconnect').hidden = !reporting.enabled;
}
function renderRecord() {
  if (!record) return;
  const raw = record.raw;
  const stage = reportStage(record.gameId, reporting);
  let rows = '';
  for (const teamId of [100, 200]) {
    const team = raw.teams?.find(team => team.teamId === teamId);
    const win = team?.win === true || String(team?.win).toLowerCase() === 'win';
    rows += `<tr class="team ${teamId === 200 ? 'red' : ''}"><td colspan="5">${t(teamId === 100 ? 'BLUE TEAM' : 'RED TEAM')} / ${t(win ? 'WIN' : 'LOSS')}</td></tr>`;
    rows += record.players.filter(p => p.teamId === teamId).map(p => `<tr><td><span class="player-name" title="${escape(p.name)}">${escape(p.name)}</span><span class="champion">${escape(champions[p.championId] || `Champion ${p.championId}`)} / ${count(p.cs)} CS</span></td><td>${p.kills}/${p.deaths}/${p.assists}</td><td>${count(p.damage)}</td><td class="gold-col">${count(p.gold)}</td><td>${count(p.vision)}</td></tr>`).join('');
  }
  const lifecycle = record.sample ? '' : `<ol class="report-stages"><li class="done">${t('Saved locally')}</li><li class="${stage === 'Awaiting admin review' ? 'done' : ''}">${t(stage === 'Awaiting admin review' ? 'Uploaded' : stage === 'Local copy' ? 'No upload this session' : stage)}</li><li>${t(stage === 'Awaiting admin review' ? stage : 'Review not confirmed')}</li><li>${t('Official result not checked')}</li></ol>`;
  $('match-detail').innerHTML = `${record.sample ? `<div class="sample-match-label">${t('SAMPLE MATCH / Fictional players. Not saved or submitted.')}</div>` : ''}<div class="detail-heading"><div><h3>${t(record.sample ? 'Example match' : 'Match')} #${escape(record.gameId)}</h3><p>${escape(raw.gameMode)} / ${duration(raw.gameDuration)} / ${t('{{count}} players', { count: record.players.length })}</p></div><span class="badge neutral">${t(record.sample ? 'Preview only' : 'Saved on this PC')}</span>${record.sample ? `<button class="icon" data-close-preview title="${t('Close preview')}" aria-label="${t('Close preview')}"><i data-lucide="x"></i></button>` : ''}</div>${lifecycle}<p class="validation-note">${escape(t(record.validation.note))}</p><table class="score-table"><thead><tr><th scope="col">${t('Player')}</th><th scope="col">K / D / A</th><th scope="col">${t('Damage')}</th><th scope="col" class="gold-col">${t('Gold')}</th><th scope="col">${t('Vision')}</th></tr></thead><tbody>${rows}</tbody></table>`;
  refreshIcons();
}
async function select(key) {
  const request = ++selecting;
  const result = await action(() => api.match(key));
  if (!result || request !== selecting) return;
  selected = key; record = result; render(); renderRecord();
}
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => void tab(button.dataset.tab)));
$('collect-form').addEventListener('submit', async event => {
  event.preventDefault(); notice(''); const id = $('game-id').value.trim();
  if (!/^\d{5,20}$/.test(id)) { notice('Enter a numeric League Game ID (5-20 digits).'); return; }
  const key = await action(() => api.collect(id));
  if (key) { $('game-id').value = ''; if (state.matches.some(match => match.key === key)) void select(key); }
});
$('auto').addEventListener('change', async () => { await action(() => api.auto($('auto').checked)); render(); });
$('rescan').addEventListener('click', () => void action(() => api.rescan()));
$('reporting-connect').addEventListener('click', () => void action(() => api.reportingConnect()));
$('reporting-disconnect').addEventListener('click', () => void action(() => api.reportingDisconnect()));
api.onReporting(value => { reporting = value; render(); renderRecord(); });
$('preview-match').addEventListener('click', async () => {
  const request = ++selecting;
  const example = await action(() => api.previewMatch());
  if (!example || request !== selecting) return;
  selected = 'sample-preview'; record = example; render(); renderRecord();
  $('match-detail').scrollIntoView({ block: 'start', behavior: 'instant' });
});
$('match-detail').addEventListener('click', event => {
  if (!event.target.closest('[data-close-preview]')) return;
  selecting++; record = null; selected = null; render();
  if (state.matches.length) void select(state.matches[0].key);
  else { $('match-detail').innerHTML = `<div class="empty"><i data-lucide="list-checks"></i><h3>${t('No match selected')}</h3><p>${t('Your saved scoreboard will appear here.')}</p></div>`; refreshIcons(); }
});
$('match-list').addEventListener('click', event => { const button = event.target.closest('[data-match]'); if (button) void select(button.dataset.match); });
$('queue').addEventListener('click', event => { const button = event.target.closest('[data-retry]'); if (button) void action(() => api.retry(button.dataset.retry)); });
for (const [id, method] of [['folder', 'folder'], ['privacy-folder', 'folder'], ['browser-hub', 'browserHub'], ['hide', 'hide'], ['quit', 'quit']]) $(id).addEventListener('click', () => void action(() => api[method]()));
$('hub-home').addEventListener('click', async () => { await tab('profile'); });
api.onState(value => { state = value; render(); workspace.collector(value); if (!selected && state.matches.length) void select(state.matches[0].key); });
async function init() {
  const initial = await action(() => api.state()); if (!initial) return;
  state = initial.collector; reporting = initial.reporting; demo = initial.demo;
  await setLanguage(initial.language);
  $('mode').textContent = t(demo ? 'SAMPLE DATA' : 'LOCAL PROTOTYPE'); $('demo-banner').hidden = !demo; $('version').textContent = `v${initial.version}`;
  installHints(); render(); workspace.start(initial); splitTwo.start(initial); await tab(initial.tab);
  if (state.matches.length) await select(state.matches[0].key);
  if (initial.preview) $('preview-match').click();
}
void init();
