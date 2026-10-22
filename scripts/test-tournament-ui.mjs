// DOM interaction tests, with mocked HTTP/auth only. PostgreSQL rules are tested separately.
// Requires jsdom@26.1.0 under .tmp/tournament-test-tools (no app dependency change).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const temporary = path.resolve('.tmp');
const { JSDOM } = await import(pathToFileURL(path.join(temporary, 'tournament-test-tools/node_modules/jsdom/lib/api.js')).href);
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:3002/split-ii', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'Node', 'NodeFilter', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'SVGElement', 'Event', 'CustomEvent', 'MouseEvent', 'FocusEvent', 'MutationObserver', 'getComputedStyle']) {
  Object.defineProperty(globalThis, name, { value: typeof dom.window[name] === 'function' && name === 'getComputedStyle' ? dom.window[name].bind(dom.window) : dom.window[name], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
let playbackAllowed = false;
let playbackAttempts = 0;
dom.window.HTMLMediaElement.prototype.play = function () { playbackAttempts++; return playbackAllowed ? Promise.resolve() : Promise.reject(new Error('Gesture required')); };
dom.window.HTMLMediaElement.prototype.pause = function () {};

await mkdir(temporary, { recursive: true });
const entry = path.join(temporary, 'tournament-ui-entry.tsx');
await writeFile(entry, 'export {default as Page} from "../app/split-ii/SplitTwoRegistration"; export {setSession} from "fixture-supabase";');
const outfile = path.join(temporary, 'tournament-ui-test.cjs');
await build({
  entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'], define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'ui-test-fixtures', setup(builder) {
    builder.onResolve({ filter: /^(fixture-supabase|@\/lib\/supabase)$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
    builder.onResolve({ filter: /^next\/(image|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onResolve({ filter: /\.module\.css$/ }, () => ({ path: 'styles', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
      if (args.path === 'styles') return { contents: 'export default new Proxy({}, {get: (_, key) => String(key)});' };
      if (args.path === 'supabase') return { contents: `
        let session = null; const listeners = new Set();
        export function setSession(next) {session = next; for(const cb of listeners) cb('SIGNED_IN', session);}
        export const supabase = {auth: {
          getSession: async () => ({data:{session}}),
          onAuthStateChange(cb) {listeners.add(cb); queueMicrotask(()=>cb('INITIAL_SESSION',session));return {data:{subscription:{unsubscribe(){listeners.delete(cb)}}}};}
        }};
      ` };
      if (args.path === 'next/image') return { contents: 'import React from "react"; export default function Image({preload, priority, ...props}) {return React.createElement("img",props)}' };
      return { contents: 'import React from "react"; export default function Link({prefetch, ...props}) {return React.createElement("a",props)}' };
    });
  } }],
});
const require = createRequire(import.meta.url);
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const { Page, setSession } = require(outfile);
const config = {
  capacity: 25, count: 0, window: 'open', opensAt: '2026-10-17T04:00:00.000Z', closesAt: null,
  termsVersion: 'ecl-terms-2026-10-16', rulesVersion: 'split-ii-registration-2026-10-22',
  players: [], floaters: [], floaterWindow: 'open', floaterRulesVersion: 'split-ii-floaters-2026-10-22', floaterRegistration: null, viewer: { account: 'signed-out', name: 'Your ECL profile', riotId: '', role: '' }, registration: null,
};
let state = structuredClone(config);
let unavailable = false;
let rejectClaim = false;
let posts = 0;
globalThis.fetch = async (_url, options = {}) => {
  if (unavailable) return Response.json({ message: 'Temporarily unavailable' }, { status: 503 });
  if (options.method === 'POST') {
    posts++;
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), body.pool === 'FLOATER' ? ['accepted', 'pool', 'rulesVersion', 'termsVersion'] : ['accepted', 'rulesVersion', 'termsVersion']);
    assert.equal(body.accepted, true);
    assert.equal(body.termsVersion, config.termsVersion);
    if (rejectClaim) return Response.json({ message: 'The last place was claimed. Please refresh.' }, { status: 409 });
    if (body.pool === 'FLOATER') {
      assert.equal(body.rulesVersion,state.floaterRulesVersion);
      state.floaters = [{id:'saved-floater',name:state.viewer.name,role:state.viewer.role}];
      state.floaterRegistration = {id:'saved-floater',role:state.viewer.role,ticketNumber:1};
      return Response.json(state,{status:201});
    }
    state.players = [{ id: 'saved-entry', name: state.viewer.name, role: state.viewer.role }];
    state.count = 1;
    state.registration = { id: 'saved-entry', role: state.viewer.role, ticketNumber: 1 };
    return Response.json(state, { status: 201 });
  }
  return Response.json(state);
};
let root;
const container = document.getElementById('root');
const button = text => [...document.querySelectorAll('button')].find(element => element.textContent.includes(text));
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await flush(); }
  throw new Error('UI state did not settle');
}
async function mount() {
  if (root) await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(React.createElement(Page, { inDashboard: true })));
  await until(() => !container.textContent.includes('Loading the roster'));
}
async function click(element) { assert.ok(element); await act(async () => element.click()); await flush(); }
try {
  await mount();
  assert.ok(!container.textContent.includes('Moonriver'));
  assert.ok(!button('Preview controls'));
  const tabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')];
  assert.deepEqual(tabs.map(tab=>tab.textContent.replace(/\s+/g,' ').trim()),['Registered players 0','Season details','Tournament format']);
  await act(async()=>button('Tournament format').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
  await until(()=>document.getElementById('format-heading'));
  const format = document.querySelector('[aria-labelledby="format-heading"]');
  assert.deepEqual([...format.querySelectorAll('.formatStats dd')].map(el=>el.textContent),['5','10','Bo1','Top 4']);
  assert.equal(format.querySelectorAll('[aria-label="Participating teams"] li').length,5);
  assert.ok(!format.textContent.includes('RouteOne'));
  assert.ok(format.textContent.includes('5th place is eliminated'));
  assert.ok(format.textContent.includes('Both semifinals and the final are best of three'));
  assert.ok(format.textContent.includes('slowest total win time is eliminated'));
  await act(async()=>button('Registered players').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
  await until(()=>!document.getElementById('format-heading'));
  console.log('PASS: format tab beside season details, five teams without R1, ten Bo1 games, top four and Bo3 playoffs');
  await click(button('Sign in to claim'));
  assert.equal(document.querySelector('[role="dialog"] a').getAttribute('href'), '/login');
  assert.ok(!document.body.textContent.includes('Continue as demo player'));
  await click(document.querySelector('[aria-label="Close dialog"]'));

  state.viewer = { account: 'eligible', name: 'Fixture Player', riotId: 'Fixture#1234', role: 'Middle' };
  await act(async () => setSession({ access_token: 'fixture-token' }));
  await until(() => button('Claim your place') && !button('Claim your place').disabled);
  await click(button('Claim your place'));
  assert.ok(document.querySelector('[role="dialog"]').textContent.includes('Fixture Player'));
  assert.ok(button('Accept & sign up').disabled);
  assert.equal(posts, 0);
  await click(document.querySelector('input[type="checkbox"]'));
  assert.equal(button('Accept & sign up').disabled, false);
  await click(button('Accept & sign up'));
  await until(() => container.textContent.includes('Place confirmed'));
  assert.equal(posts, 1);
  assert.equal(document.querySelector('[role="dialog"]'), null);
  await mount();
  assert.ok(container.textContent.includes('Place confirmed'));
  assert.equal(posts, 1);
  console.log('PASS: signed-out login, no fictional roster, required consent, profile role, saved ticket after remount');

  assert.ok(playbackAttempts > 0);
  assert.equal(document.querySelector('audio').getAttribute('src'), '/split-ii-champ-select.mp3');
  playbackAllowed = true;
  await click(document.querySelector('[aria-label="Play dashboard music"]'));
  assert.equal(document.querySelector('[aria-label="Mute dashboard music"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('audio').volume, 0.2);
  await click(document.querySelector('[aria-label="Mute dashboard music"]'));
  assert.equal(document.querySelector('audio').muted, true);
  console.log('PASS: blocked autoplay offers play control; play and mute work with the requested track');

  state = { ...structuredClone(config), viewer: { account: 'eligible', name: 'Fixture Player', riotId: 'Fixture#1234', role: 'Middle' }, window: 'scheduled' };
  await mount();
  assert.ok(button('Opens 17 Oct, 12:00').disabled);
  state.window = 'open';
  state.count = 25;
  state.players = Array.from({ length: 25 }, (_, i) => ({ id: `entry-${i}`, name: `Player ${i}`, role: 'Mid' }));
  await mount();
  assert.ok(button('Registration full').disabled);
  assert.ok(!button('Join the floater list').disabled);
  await click(button('Join the floater list'));
  assert.ok(document.querySelector('[role="dialog"]').textContent.includes('scrims do not count'));
  assert.ok(button('Accept & join floaters').disabled);
  await click(document.querySelector('input[type="checkbox"]'));
  await click(button('Accept & join floaters'));
  await until(()=>container.textContent.includes('on the floater list'));
  assert.equal(container.querySelector('.counter strong').textContent,'25');
  assert.ok(button('Registered as floater').disabled);
  assert.equal(state.players.length,25);
  assert.equal(state.floaters.length,1);
  await mount();
  assert.ok(container.textContent.includes('on the floater list'));
  assert.equal(container.querySelector('.counter strong').textContent,'25');
  console.log('PASS: full 25-player roster still permits floater signup, explicit consent, separate counter and saved floater entry');
  state = { ...structuredClone(config), viewer: { account: 'eligible', name: 'Fixture Player', riotId: 'Fixture#1234', role: 'Middle' } };
  unavailable = true;
  await mount();
  assert.ok(container.textContent.includes('The roster couldn'));
  assert.equal(container.querySelector('.counter strong').textContent, '--');
  assert.ok(button('Checking registration').disabled);
  unavailable = false;
  await click(button('Try again'));
  await until(() => button('Claim your place') && !button('Claim your place').disabled);
  rejectClaim = true;
  await click(button('Claim your place'));
  await click(document.querySelector('input[type="checkbox"]'));
  await click(button('Accept & sign up'));
  await until(() => document.querySelector('[role="dialog"] [role="alert"]'));
  assert.ok(document.querySelector('[role="dialog"]').textContent.includes('The last place was claimed'));
  assert.ok(!container.textContent.includes('Place confirmed'));
  console.log('PASS: scheduled opening, full capacity, unavailable roster, retry recovery and rejected signup has no false confirmation');
  console.log('All client interaction checks passed. Auth and HTTP were mocked; no live signup was sent.');
} finally {
  if (root) await act(async () => root.unmount());
  dom.window.close();
}
