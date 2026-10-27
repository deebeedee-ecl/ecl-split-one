const { app, BrowserWindow, ipcMain, protocol, net, Tray, Menu, nativeImage, shell, dialog, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Collector, safeError } = require('./core.cjs');
const { Account } = require('./account.cjs');
const { SessionVault } = require('./vault.cjs');
const { Preferences } = require('./preferences.cjs');
const { PublicData, publicLink } = require('./public.cjs');
const { Updates, trustedPolicy, restartBlocker } = require('./updates.cjs');
const { EclReleaseVerifier } = require('./release-signature.cjs');
const { Reporting } = require('./reporting.cjs');
const { SplitTwo } = require('./split-two.cjs');
const demo = process.argv.includes('--demo');
const smoke = process.argv.includes('--smoke');
// Keep the original profile directory and app ID when rebranding, preserving sessions and matches.
app.setPath('userData', path.join(app.getPath('appData'), 'ecl-companion'));
if (process.platform === 'win32') app.setAppUserModelId('lol.eclchina.companion');
if (demo) app.setPath('userData', path.join(app.getPath('temp'), 'ecl-companion-demo'));
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), `ecl-companion-smoke-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'ecl', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window, tray, collector, account, preferences, publicData, updates, reporting, splitTwo, quitting = false, tab = process.argv.includes('--preview-match') ? 'collector' : 'dashboard';
const localOrigin = 'ecl://companion';
const send = (channel, data) => { if (window && !window.isDestroyed()) window.webContents.send(channel, data); };
const links = { home: 'https://eclchina.lol/hub/dashboard', news: 'https://eclchina.lol/news', events: 'https://eclchina.lol/tournaments', patches: 'https://www.leagueoflegends.com/en-us/news/tags/patch-notes/', ladder: 'https://eclchina.lol/hub/leaderboard' };
function external(url) { if (demo || smoke) return { opened: false, url }; return shell.openExternal(url); }
function trayMenu() {
  const zh = preferences.language === 'zh-CN';
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: zh ? '\u6253\u5f00 ECL Hub' : 'Open ECL Hub', click: () => window.show() },
    { label: zh ? '\u6253\u5f00\u6bd4\u8d5b\u6587\u4ef6' : 'Open saved matches', click: () => void shell.openPath(collector.directory) },
    { type: 'separator' }, { label: zh ? '\u9000\u51fa' : 'Quit', click: () => app.quit() },
  ]));
}

function handle(name, action) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || !event.senderFrame.url.startsWith(`${localOrigin}/`)) return { ok: false, error: 'Untrusted app request.' };
    try { return { ok: true, data: await action(...args) }; }
    catch (error) { return { ok: false, error: safeError(error, collector?.connection?.token) }; }
  });
}

async function open() {
  const icon = path.join(__dirname, '../assets/ecl-hub.ico');
  window = new BrowserWindow({ title: 'ECL Hub', width: 1160, height: 800, minWidth: 860, minHeight: 640, backgroundColor: '#101113', icon, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.on('close', event => { if (!quitting && tray) { event.preventDefault(); window.hide(); } });
  await window.loadURL(`${localOrigin}/index.html`);
  window.show();
}

app.on('before-quit', () => { quitting = true; splitTwo?.dispose(); reporting?.dispose(); collector?.stop(); account?.dispose(); publicData?.dispose(); updates?.dispose(); });
app.on('window-all-closed', () => { if (!tray) app.quit(); });
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(async () => {
    const paths = new Map([
      ['/index.html', path.join(__dirname, '../dist/index.html')], ['/style.css', path.join(__dirname, '../dist/style.css')],
      ['/privacy.css', path.join(__dirname, '../dist/privacy.css')],
      ['/workspace.css', path.join(__dirname, '../dist/workspace.css')],
      ['/desktop.css', path.join(__dirname, '../dist/desktop.css')],
      ['/split-two.css', path.join(__dirname, '../dist/split-two.css')],
      ['/theme.css', path.join(__dirname, '../dist/theme.css')],
      ['/inter-latin.woff2', path.join(__dirname, '../dist/inter-latin.woff2')],
      ['/renderer.js', path.join(__dirname, '../dist/renderer.js')], ['/logo.png', path.join(__dirname, '../assets/ecl-hub.png')],
    ]);
    protocol.handle('ecl', request => {
      const url = new URL(request.url);
      const champion = /^\/champions\/(\d+)\.png$/.exec(url.pathname);
      const role = /^\/roles\/(top|jungle|mid|bot|support|fill)\.png$/.exec(url.pathname);
      const item = /^\/items\/(\d{1,6})\.png$/.exec(url.pathname);
      const team = /^\/teams\/(ballbreakers|exodus|zero|nextgen|phoenix)\.png$/.exec(url.pathname);
      const file = url.host === 'companion' && (paths.get(url.pathname) || (champion && path.join(__dirname, '../dist/champions', `${champion[1]}.png`)) || (role && path.join(__dirname, '../dist/roles', `${role[1]}.png`)) || (item && path.join(__dirname, '../dist/items', `${item[1]}.png`)) || (team && path.join(__dirname, '../dist/teams', `${team[1]}.png`)));
      if (file && !fs.existsSync(file)) return new Response('Not found', { status: 404 });
      return file ? net.fetch(pathToFileURL(file).toString()) : new Response('Not found', { status: 404 });
    });
    collector = await new Collector(path.join(app.getPath('userData'), 'collector')).init();
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/public-config.json'), 'utf8'));
    const vault = new SessionVault(path.join(app.getPath('userData'), 'account'), safeStorage);
    account = await new Account(demo ? { configured: false } : config, vault).init();
    reporting = new Reporting(account, collector);
    splitTwo = new SplitTwo(account, collector);
    splitTwo.on('change', state => send('split-two-state',state));
    account.on('change',()=>{if(splitTwo.data.enabled&&splitTwo.epoch!==account.epoch)splitTwo.disconnect('ECL account changed. Reconnect tournament reporting.');});
    reporting.on('change', state => send('reporting-state', state));
    account.on('change', () => { if (reporting.data.enabled && account.epoch !== reporting.epoch) reporting.disconnect('ECL account changed. Reconnect reporting.'); });
    preferences = await new Preferences(app.getPath('userData')).init();
    publicData = new PublicData();
    const policy = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/update-policy.json'), 'utf8'));
    let trusted = false;
    if (app.isPackaged && policy.trusted) {
      try { const bytes = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml')); if (bytes.length < 16384) trusted = trustedPolicy(policy, bytes.toString('utf8')); } catch { /* Missing publisher configuration cannot enable update installation. */ }
    }
    updates = new Updates(app.isPackaged && !demo && !smoke ? require('electron-updater').autoUpdater : null, {
      enabled: app.isPackaged && process.platform === 'win32' && !demo && !smoke,
      trusted,
      version: app.getVersion(),
      verifier: trusted && policy.mode === 'ecl-key' && !demo && !smoke ? new EclReleaseVerifier(policy.publicKey) : null,
    });
    if (demo) await require('./demo.cjs').seed(collector);
    if (demo) require('./demo.cjs').seedAccount(account);
    if (demo) publicData.data = { ...publicData.data, items: [{ id: 'sample-news', title: 'Sample community update', category: 'news', detail: 'Fictional news for the local preview.', date: 'Oct 17, 2026', url: links.news }, { id: 'sample-patch', title: 'Sample ECL patch notes', category: 'patch', detail: 'Fictional patch announcement.', date: 'Oct 16, 2026', url: links.news }, { id: 'sample-event', title: 'Sample draft tournament', category: 'event', detail: 'Fictional event for the preview.', status: 'View details', date: '', url: links.events }], fixtures: [{ id: 'sample-fixture', home: 'Sample Blue', away: 'Sample Red', label: 'Sample draft tournament', bestOf: 3, scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString() }], fixturesUpdatedAt: Date.now(), updatedAt: Date.now() };
    collector.on('change', state => send('collector-state', state));
    account.on('change', state => send('account-state', state));
    publicData.on('change', state => send('public-state', state)); updates.on('change', state => send('update-state', state));
    handle('state', () => ({ collector: collector.snapshot(), reporting: reporting.snapshot(), splitTwo:splitTwo.snapshot(), preview: process.argv.includes('--preview-match'), account: account.snapshot(), public: publicData.snapshot(), updates: updates.snapshot(), language: preferences.language, demo, tab, version: app.getVersion() }));
    handle('split-two-refresh',()=>demo||smoke?splitTwo.snapshot():splitTwo.refresh());
    handle('split-two-disconnect',()=>splitTwo.disconnect());
    handle('split-two-connect',async()=>{
      if(demo||smoke)throw new Error('Tournament uploads are disabled in sample/test mode.');
      const answer=await dialog.showMessageBox(window,{type:'question',title:'Split II tournament reporting',message:'Allow requested tournament match uploads for this app session?',detail:'Only games requested through your KOOK account with !split2 report are uploaded to https://eclchina.lol. This includes the ten players, League identifiers and match statistics. League credentials stay local. Every report needs administrator review before publication; no inhouse LP is awarded. Disconnect or quit stops future uploads, but cannot retract data already received.',buttons:['Cancel','Allow for this session'],defaultId:0,cancelId:0});
      return answer.response===1?splitTwo.connect():splitTwo.snapshot();
    });
    handle('reporting-disconnect', () => reporting.disconnect());
    handle('reporting-connect', async () => {
      if (demo || smoke) throw new Error('Reporting uploads are disabled in sample/test mode.');
      const zh = preferences.language === 'zh-CN';
      const answer = await dialog.showMessageBox(window, { type: 'question', title: zh ? '连接 KOOK 上报测试' : 'Connect KOOK reporting pilot', message: zh ? '允许本次应用会话上传指定的 ECL 比赛吗？' : 'Allow requested ECL match uploads for this app session?', detail: zh ? '你的游戏名称、标签和玩家标识符将发送至 https://eclchina.lol，绑定本次测试会话。仅上传通过你的 KOOK 身份请求的比赛，包括十名玩家的名称、标识符和比赛数据。游戏连接凭据不会上传。上传的比赛需要管理员审核，不会自动加分。这不构成游戏账号归属证明。断开连接或退出会停止后续上传，但不能撤回服务器已收到的数据。' : 'Your League name, tag and player identifier will be sent to https://eclchina.lol to bind this pilot session to your signed-in ECL account. Only matches requested through your KOOK identity are uploaded, including all ten players, identifiers and statistics. League credentials stay local. Uploaded matches require administrator review; they do not award points. This is not proof of League account ownership. Disconnect or Quit stops future uploads; it cannot retract a request already received by the server.', buttons: zh ? ['取消', '允许本次会话'] : ['Cancel', 'Allow for this session'], defaultId: 0, cancelId: 0 });
      if (answer.response !== 1) return reporting.snapshot();
      return reporting.connect();
    });
    handle('language', async value => { const result = await preferences.setLanguage(value); trayMenu(); return result; });
    handle('public-refresh', () => { if (!demo) return publicData.refresh(); });
    handle('update-check', () => updates.check());
    handle('update-download', () => updates.download());
    handle('update-install', async () => {
      const assertIdle = () => {
        const reason = restartBlocker({ ...collector.snapshot(), busy: collector.status.busy || collector.working }, { busy: splitTwo.busy || reporting.busy || reporting.data.status === 'connecting' });
        if (reason) throw new Error(reason);
      };
      assertIdle();
      if (updates.snapshot().status !== 'ready' || !updates.trusted) throw new Error('No verified update is ready.');
      const zh = preferences.language === 'zh-CN';
      const answer = await dialog.showMessageBox(window, { type: 'question', title: 'ECL Hub', message: zh ? '\u91cd\u542f\u5e76\u5b89\u88c5\u66f4\u65b0\uff1f' : 'Restart ECL Hub and install the verified update?', buttons: zh ? ['\u53d6\u6d88', '\u91cd\u542f\u5e76\u66f4\u65b0'] : ['Cancel', 'Restart and update'], defaultId: 0, cancelId: 0 });
      if (answer.response === 1) { assertIdle(); await updates.install(assertIdle); }
    });
    handle('account-login', (email, password, remember) => { if (demo) throw new Error('Sign-in is disabled in sample mode.'); return account.login(email, password, remember); });
    handle('account-logout', () => { if (demo) throw new Error('Sign-out is disabled in sample mode.'); return account.logout(); });
    handle('account-refresh', () => { if (demo) return; return account.refresh(); });
    handle('account-match', id => demo ? require('./demo.cjs').scoreboard(id, account.data.games) : account.matchDetail(id));
    handle('tab', value => {
      if (!['dashboard', 'profile', 'history', 'league', 'ladder', 'split2', 'settings', 'collector', 'info'].includes(value)) throw new Error('Unknown tab.');
      tab = value; return tab;
    });
    handle('collect', async id => { const key = await collector.enqueue(id); void collector.tick(); return key; });
    handle('rescan', () => { void collector.tick(); });
    handle('auto', value => collector.setAuto(value));
    handle('retry', async key => { await collector.retry(key); void collector.tick(); });
    handle('match', key => collector.readMatch(key));
    handle('preview-match', () => require('./demo.cjs').preview());
    handle('folder', async () => { const error = await shell.openPath(collector.directory); if (error) throw new Error(error); });
    handle('browser-hub', () => external(links.home));
    handle('open-link', value => { if (typeof value !== 'string' || value.length > 2048) throw new Error('Unsupported website link.'); const url = Object.hasOwn(links, value) ? links[value] : publicLink(value); if (!url) throw new Error('Unsupported website link.'); return external(url); });
    handle('edit-profile', () => external('https://eclchina.lol/hub/settings'));
    handle('forgot-password', () => external('https://eclchina.lol/forgot-password'));
    handle('app-folder', () => shell.openPath(path.dirname(app.getPath('exe'))));
    handle('hide', () => window.hide());
    handle('quit', () => { app.quit(); });
    await open();
    const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/ecl-hub.png')).resize({ width: 32, height: 32 });
    tray = new Tray(icon); tray.setToolTip('ECL Hub - local collector');
    trayMenu();
    tray.on('double-click', () => window.show());
    if (!demo && !smoke) collector.start();
    if (!demo) publicData.start();
    if (!demo && !smoke) splitTwo.start();
    updates.start();
    if (!demo) void account.refresh().catch(() => {});
  }).catch(error => { dialog.showErrorBox('ECL Hub could not start', safeError(error)); app.quit(); });
}
