const fs = require('node:fs');
const path = require('node:path');
const { loadUpdatePolicy } = require('../config.cjs');
const { FEED } = require('../src/updates.cjs');

try {
  const config = require('../package.json'), expected = loadUpdatePolicy(config.build.win);
  const actual = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/update-policy.json'), 'utf8'));
  if (!expected.trusted || JSON.stringify(actual) !== JSON.stringify(expected) || config.build.publish.length !== 1 || config.build.publish[0].provider !== 'generic' || config.build.publish[0].url !== FEED || config.build.win.verifyUpdateCodeSignature !== true) throw new Error();
  console.log(`Release verification configured: ${expected.mode || 'authenticode'}.`);
} catch { console.error('Release build blocked: configure an explicit public release pin or Windows signing identity, rebuild, and retain the fixed feed and signature verification.'); process.exitCode = 1; }
