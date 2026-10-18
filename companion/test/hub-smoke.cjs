const assert = require('node:assert/strict');
const path = require('node:path');
const { _electron } = require(process.env.ECL_PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const application = await _electron.launch({ executablePath: process.env.ECL_COMPANION_EXE || require('electron'), args: process.env.ECL_COMPANION_EXE ? ['--smoke'] : ['.', '--smoke'], cwd: path.join(__dirname, '..'), env });
  try {
    const page = await application.firstWindow();
    let state;
    for (let attempt = 0; attempt < 50; attempt++) {
      state = (await page.evaluate(() => window.companion.state())).data;
      if (!state.account.loading && !state.public.loading && (state.account.lastUpdated || state.account.ladderError) && (state.public.updatedAt || state.public.error)) break;
      await page.waitForTimeout(500);
    }
    console.log('Read-only website checks', { publicPosts: state.public.items.length, fullLadder: state.public.ladder.length, topTen: state.account.leaderboard.length, upcomingFixtures: state.public.fixtures.length, fixturesError: state.public.fixturesError, feedError: state.public.error, ladderError: state.public.ladderError });
    assert.equal(state.account.authenticated, false);
    const before = state.collector.matches.length;
    await page.locator('[data-tab="collector"]').click(); await page.locator('#preview-match').click();
    await page.locator('.sample-match-label').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.score-table tbody tr:not(.team)').count(), 10);
    const previewState = (await page.evaluate(() => window.companion.state())).data;
    assert.equal(previewState.collector.matches.length, before); assert.equal(previewState.reporting.enabled, false);
    await page.locator('[data-close-preview]').click(); assert.equal(await page.locator('.sample-match-label').count(), 0);
    await page.locator('[data-tab="dashboard"]').click();
    assert.ok(state.account.leaderboard.length || state.account.ladderError);
    assert.ok(state.public.items.length || state.public.error);
    assert.ok(state.public.fixturesUpdatedAt || state.public.fixturesError);
    assert.equal(await page.locator('#dashboard .metrics-strip').count(), 0);
    if (!state.public.fixtures.length) assert.match(await page.locator('#fixture-content').innerText(), /No upcoming|unavailable/);
    await page.screenshot({ path: path.join(__dirname, '../.test-data/native-live-dashboard.png') });
    await page.locator('[data-tab="profile"]').click(); await page.locator('#profile [data-native-login]').click();
    await page.locator('#login-dialog').waitFor({ state: 'visible' });
    await page.locator('#remember-me').uncheck(); assert.match(await page.locator('#login-storage').innerText(), /Until you quit/);
    await page.locator('#remember-me').check(); assert.match(await page.locator('#login-storage').innerText(), /Windows-encrypted/);
    await page.locator('#account-password').fill('not-submitted-or-saved'); await page.locator('#close-login').click();
    assert.equal(await page.locator('#account-password').inputValue(), '');
    const browser = await page.evaluate(() => window.companion.browserHub());
    assert.equal(browser.data.url, 'https://eclchina.lol/hub/dashboard'); assert.equal(browser.data.opened, false);
    const windows = await application.evaluate(({ webContents, BrowserWindow }) => ({ remote: webContents.getAllWebContents().filter(w => /^https:/.test(w.getURL())).length, views: BrowserWindow.getAllWindows()[0].contentView.children.length }));
    assert.deepEqual(windows, { remote: 0, views: 0 });
    const blocked = await page.evaluate(() => window.companion.openLink('https://evil.example.com')); assert.equal(blocked.ok, false);
    await page.locator('[data-tab="ladder"]').click(); await page.screenshot({ path: path.join(__dirname, '../.test-data/native-live-ladder.png') });
    if (state.public.ladderCoverage === 'full' && state.public.ladder.length > 15) {
      assert.equal(await page.locator('#ladder-content tbody tr').count(), 15);
      const first = await page.locator('#ladder-content tbody tr').first().innerText();
      await page.locator('#ladder-next').click();
      assert.match(await page.locator('#ladder-page').innerText(), /^2 \/ /);
      assert.notEqual(await page.locator('#ladder-content tbody tr').first().innerText(), first);
      while (!await page.locator('#ladder-next').isDisabled()) await page.locator('#ladder-next').click();
      assert.equal(await page.locator('#ladder-content tbody tr').count(), state.public.ladder.length % 15 || 15);
      const images = page.locator('#ladder-content .ladder-picks img');
      await images.evaluateAll(async list => { await Promise.all(list.map(image => image.decode())); });
      assert.equal(await images.evaluateAll(list => list.every(image => image.naturalWidth > 0)), true);
      await page.screenshot({ path: path.join(__dirname, '../.test-data/native-live-ladder-last-page.png') });
      console.log('PASS: deployed full-ladder pagination reached the final page.', { players: state.public.ladder.length, pages: Math.ceil(state.public.ladder.length / 15) });
    }
    assert.doesNotMatch(await page.locator('#ladder-content').innerText(), /\bFA\b/);
    console.log('Published win rates', state.account.leaderboard.map(row => row.winRate));
    await page.locator('[data-tab="settings"]').click(); await page.locator('#settings-language').selectOption('zh-CN');
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    assert.equal((await page.evaluate(() => window.companion.state())).data.language, 'zh-CN');
    await page.locator('#settings-language').selectOption('en'); await page.waitForFunction(() => document.documentElement.lang === 'en');
    const encryption = await application.evaluate(({ safeStorage }) => {
      const available = safeStorage.isEncryptionAvailable(); if (!available) return { available };
      const sample = 'synthetic-session-no-real-credentials', cipher = safeStorage.encryptString(sample);
      return { available, roundTrip: safeStorage.decryptString(cipher) === sample, notPlaintext: !cipher.includes(Buffer.from(sample)) };
    });
    if (encryption.available) { assert.equal(encryption.roundTrip, true); assert.equal(encryption.notPlaintext, true); }
    await page.locator('#hide').click(); assert.equal(await application.evaluate(({ BrowserWindow }) => !BrowserWindow.getAllWindows()[0].isVisible()), true);
    console.log('PASS: live read-only feeds/standings or explicit errors, no embedded browser, restricted links, language persistence, remember controls, Windows encryption and tray hiding. No sign-in performed.');
  } finally { await application.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
