const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
async function build() {
  await require('./icon.cjs').buildIcon();
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  for (const file of ['index.html', 'style.css', 'privacy.css', 'workspace.css', 'desktop.css']) fs.copyFileSync(path.join(__dirname, 'src', file), path.join(__dirname, 'dist', file));
  const radix = path.dirname(require.resolve('@radix-ui/colors/package.json'));
  fs.writeFileSync(path.join(__dirname, 'dist/theme.css'), ['gray-dark.css', 'blue-dark.css', 'green-dark.css', 'red-dark.css'].map(file => fs.readFileSync(path.join(radix, file), 'utf8')).join('\n'));
  fs.copyFileSync(path.join(radix, 'LICENSE'), path.join(__dirname, 'dist/RADIX-COLORS-LICENSE.txt'));
  const font = path.dirname(require.resolve('@fontsource-variable/inter/package.json'));
  fs.copyFileSync(path.join(font, 'files/inter-latin-wght-normal.woff2'), path.join(__dirname, 'dist/inter-latin.woff2'));
  fs.copyFileSync(path.join(font, 'LICENSE'), path.join(__dirname, 'dist/INTER-LICENSE.txt'));
  for (const [name, file] of [['i18next', 'LICENSE'], ['chart.js', 'LICENSE.md'], ['@floating-ui/dom', 'LICENSE']]) {
    const root = path.join(__dirname, 'node_modules', name);
    fs.copyFileSync(path.join(root, file), path.join(__dirname, 'dist', `${name.replace(/[^a-z0-9]/gi, '-')}-LICENSE.txt`));
  }
  const config = require('./config.cjs').loadBuildConfiguration();
  fs.writeFileSync(path.join(__dirname, 'dist/public-config.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(__dirname, 'dist/update-policy.json'), JSON.stringify(require('./config.cjs').loadUpdatePolicy(require('./package.json').build.win)));
  const source = path.join(__dirname, '../public/lol/champions');
  const destination = path.join(__dirname, 'dist/champions');
  fs.mkdirSync(destination, { recursive: true });
  if (fs.existsSync(source)) for (const file of fs.readdirSync(source).filter(file => /^\d+\.png$/.test(file))) fs.copyFileSync(path.join(source, file), path.join(destination, file));
  fs.mkdirSync(path.join(__dirname, 'dist/roles'), { recursive: true });
  for (const name of ['top', 'jungle', 'mid', 'bot', 'support', 'fill']) fs.copyFileSync(path.join(__dirname, '../public/lol/roles', `${name}.png`), path.join(__dirname, 'dist/roles', `${name}.png`));
  const names = path.join(source, 'champions.json');
  const champions = fs.existsSync(names) ? JSON.parse(fs.readFileSync(names, 'utf8').replace(/^\uFEFF/, '')).map(c => ({ id: c.id, name: c.name })) : [];
  esbuild.buildSync({ entryPoints: [path.join(__dirname, 'src/renderer.js')], bundle: true, outfile: path.join(__dirname, 'dist/renderer.js'), minify: true, platform: 'browser', define: { __CHAMPIONS__: JSON.stringify(champions) } });
  console.log(`Native account login: ${config.configured ? 'configured with public client credentials' : 'not configured'}.`);
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
