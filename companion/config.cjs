const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { publicKey, keyId } = require('./src/release-public-key.cjs');

function publicConfiguration(environment) {
  const url = String(environment.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = String(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return { configured: false };
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid public Supabase URL.'); }
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) || parsed.port || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Public authentication must use the ECL HTTPS Supabase project.');
  let role = '';
  if (key.split('.').length === 3) {
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role; } catch { /* Reject malformed keys without printing them. */ }
  }
  if (role !== 'anon' && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Only a public anonymous/publishable key may be packaged. Server secrets are forbidden.');
  return { configured: true, supabaseUrl: parsed.origin, publicKey: key };
}
function loadBuildConfiguration() {
  let environment = {};
  for (const file of ['.env', '.env.local']) {
    const location = path.join(__dirname, '..', file);
    if (fs.existsSync(location)) {
      const parsed = dotenv.parse(fs.readFileSync(location));
      for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) if (parsed[name]) environment[name] = parsed[name];
    }
  }
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) if (process.env[name]) environment[name] = process.env[name];
  return publicConfiguration(environment);
}
function updatePolicy(win = {}, pem) {
  const publisher = win.signtoolOptions?.publisherName;
  const publishers = (Array.isArray(publisher) ? publisher : [publisher]).filter(p => typeof p === 'string' && p.trim()).map(p => p.trim());
  if (pem !== undefined) {
    const key = publicKey(pem);
    if (win.verifyUpdateCodeSignature !== true || publishers.length !== 1 || publishers[0] !== 'ECL Hub release-key verification') throw new Error('ECL-key updates require the verification hook and explicit release-key publisher marker.');
    return { trusted: true, mode: 'ecl-key', publicKey: key.export({ type: 'spki', format: 'pem' }), keyId: keyId(key), publishers };
  }
  return { trusted: win.signExecutable !== false && win.verifyUpdateCodeSignature !== false && publishers.length > 0, publishers };
}
function loadUpdatePolicy(win, environment = process.env) {
  const file = environment.ECL_UPDATE_PUBLIC_KEY_FILE;
  if (!file) return updatePolicy(win);
  if (!path.isAbsolute(file) || fs.statSync(file).size > 4096) throw new Error('A small absolute public-key file path is required.');
  return updatePolicy(win, fs.readFileSync(file, 'utf8'));
}
module.exports = { publicConfiguration, loadBuildConfiguration, updatePolicy, loadUpdatePolicy };
