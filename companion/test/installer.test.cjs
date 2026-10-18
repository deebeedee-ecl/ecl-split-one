const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../package.json');

test('installer keeps the app identity and user data while adding Windows integration', () => {
  const build = config.build;
  assert.equal(build.appId, 'lol.eclchina.companion');
  assert.equal(build.productName, 'ECL Hub');
  assert.deepEqual(build.win.target, ['nsis']);
  assert.equal(build.nsis.oneClick, false);
  assert.equal(build.nsis.perMachine, false);
  assert.equal(build.nsis.allowElevation, false);
  assert.equal(build.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(build.nsis.createDesktopShortcut, true);
  assert.equal(build.nsis.createStartMenuShortcut, true);
  assert.equal(build.nsis.deleteAppDataOnUninstall, false);
  assert.equal(build.nsis.shortcutName, 'ECL Hub');
  assert.equal(build.win.signExecutable, false);
  assert.equal(build.win.verifyUpdateCodeSignature, true);
  assert.equal(build.publish[0].url, 'https://eclchina.lol/desktop-updates/windows/');
  assert.equal(build.nsis.installerIcon, 'assets/ecl-hub.ico');
  assert.ok(config.scripts.dist.includes('--publish never'));
  assert.ok(config.scripts.dist.includes('verify-release-build.cjs'));
  assert.ok(build.files.includes('src/release-signature.cjs'));
  assert.ok(build.files.includes('src/release-public-key.cjs'));
  assert.ok(!build.files.some(file => /tools|release-key\.encrypted|\.pem/.test(file)));
  const main = fs.readFileSync(path.join(__dirname, '../src/main.cjs'), 'utf8');
  assert.ok(main.includes("app.setPath('userData', path.join(app.getPath('appData'), 'ecl-companion'))"));
  assert.ok(main.includes("app.setAppUserModelId('lol.eclchina.companion')"));
});

test('upgrades reuse the installed app identity and uninstall old files before replacement', () => {
  const build = config.build;
  assert.equal(config.name, 'ecl-companion');
  assert.equal(build.appId, 'lol.eclchina.companion');
  assert.equal(build.productName, 'ECL Hub');
  // NSIS derives its upgrade registry key from appId. Do not introduce a new GUID.
  assert.equal(build.nsis.guid, undefined);
  assert.equal(build.nsis.script, undefined);
  assert.equal(build.nsis.deleteAppDataOnUninstall, false);

  const builderRoot = path.dirname(require.resolve('app-builder-lib/package.json'));
  const section = fs.readFileSync(path.join(builderRoot, 'templates/nsis/installSection.nsh'), 'utf8');
  const uninstall = section.indexOf('!insertmacro uninstallOldVersion SHELL_CONTEXT');
  const install = section.indexOf('!insertmacro installApplicationFiles');
  assert.ok(uninstall >= 0 && install > uninstall, 'remove the old installation before extracting the new app');

  const util = fs.readFileSync(path.join(builderRoot, 'templates/nsis/include/installUtil.nsh'), 'utf8');
  assert.ok(util.includes('StrCpy $0 "$0 --updated"'), 'upgrade uninstall must preserve user data');
  assert.ok(util.includes('/KEEP_APP_DATA'), 'old uninstaller must retain the app profile');

  const multiUser = fs.readFileSync(path.join(builderRoot, 'templates/nsis/multiUser.nsh'), 'utf8');
  assert.ok(multiUser.includes('ReadRegStr $perUserInstallationFolder HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation'));
  assert.ok(multiUser.includes('StrCpy $INSTDIR $perUserInstallationFolder'), 'reuse the previous install directory');
});
