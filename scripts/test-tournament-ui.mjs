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
await writeFile(entry, 'export {default as Page} from "../app/split-ii/SplitTwoRegistration"; export {default as Admin} from "../app/admin/split-ii/page"; export {createSplitTwo as DesktopSplitTwo} from "../companion/src/split-two"; export {setSession} from "fixture-supabase";');
const outfile = path.join(temporary, 'tournament-ui-test.cjs');
await build({
  entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'], define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'ui-test-fixtures', setup(builder) {
    builder.onResolve({ filter: /^(fixture-supabase|@\/lib\/supabase)$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
    builder.onResolve({ filter: /^next\/(image|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({path:'navigation',namespace:'fixture'}));
    builder.onResolve({ filter: /\.module\.css$/ }, () => ({ path: 'styles', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
      if (args.path === 'styles') return { contents: 'export default new Proxy({}, {get: (_, key) => String(key)});' };
      if(args.path==='navigation')return {contents:'export const usePathname=()=>"/admin/split-ii";'};
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
const { Page, Admin, DesktopSplitTwo, setSession } = require(outfile);
const config = {
  capacity: 25, count: 0, window: 'open', opensAt: '2026-10-17T04:00:00.000Z', closesAt: null,
  termsVersion: 'ecl-terms-2026-10-16', rulesVersion: 'split-ii-registration-2026-10-22',
  players: [], floaters: [], floaterWindow: 'open', floaterRulesVersion: 'split-ii-floaters-2026-10-22', floaterRegistration: null, viewer: { account: 'signed-out', name: 'Your ECL profile', riotId: '', role: '' }, registration: null,
};
let state = structuredClone(config);
let unavailable = false;
let rejectClaim = false;
let posts = 0;
let reads = 0;
let temporaryReadFailures = 0;
let readStatus = 0;
let matchState=null;
globalThis.fetch = async (_url, options = {}) => {
  if(String(_url).endsWith('/matches'))return matchState?Response.json(matchState):Response.json({message:'Tournament matches not configured in this registration fixture.'},{status:503});
  if (options.method !== 'POST') {
    reads++;
    if (temporaryReadFailures > 0) { temporaryReadFailures--; return Response.json({message:'Temporarily unavailable'},{status:503}); }
    if (readStatus) return Response.json({message:'Please sign in again.'},{status:readStatus});
  }
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
  await until(() => !button('Checking registration') || container.querySelector('.rosterWarning'));
}
async function click(element) { assert.ok(element); await act(async () => element.click()); await flush(); }
try {
  await mount();
  assert.ok(!container.textContent.includes('Moonriver'));
  assert.ok(!button('Preview controls'));
  assert.equal(document.querySelector('[aria-label="Split II registration capacity"]'),null);
  assert.equal(document.querySelector('[aria-label="Registration capacity"]'),null);
  assert.deepEqual([...document.querySelectorAll('[aria-label="Tournament dates and draft status"] strong')].map(el=>el.textContent),['23 October','24 October','20 November','Draft complete']);
  const tabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')];
  assert.deepEqual(tabs.map(tab=>tab.textContent.replace(/\s+/g,' ').trim()),['Team rosters 5','Season details','Tournament format','Fixtures','Results','Player stats','Standings']);
  const teamCards = [...document.querySelectorAll('[aria-label="Split II team rosters"] article')];
  assert.equal(teamCards.length,5);
  assert.deepEqual(teamCards.map(card=>[card.querySelector('h4').textContent,card.querySelector('[data-captain="true"] .teamRosterName').textContent]),[
    ['BallBreakers','Jzck'],['Exodus','Soul'],['Zero','Exile'],['NextGen','Kasper'],['Phoenix','doolittlesy']
  ]);
  const rosterNames = [];
  for (const card of teamCards) {
    assert.equal(card.querySelectorAll('.teamRosterList > li').length,5);
    assert.equal(card.querySelectorAll('[data-captain="true"]').length,1);
    assert.equal(card.querySelectorAll('.teamRosterLabel').length,5);
    assert.ok([...card.querySelectorAll('.teamRosterLabel')].slice(1).every(label=>/^Pot 0[1-5]$/.test(label.textContent)));
    assert.match(card.querySelector('img').getAttribute('src'),/^\/kook\/split2\/.+\.png$/);
    rosterNames.push(...[...card.querySelectorAll('.teamRosterName')].map(el=>el.textContent));
  }
  assert.equal(new Set(rosterNames).size,25);
  assert.ok(rosterNames.includes('Epifanio'));
  assert.ok(rosterNames.includes('Bernardt'));
  assert.equal(document.querySelector('[aria-label="Registered players in signup order"]'),null);
  assert.ok(document.getElementById('floaters-heading'));
  const riotIdFor = name => [...document.querySelectorAll('.teamRosterName')].find(el=>el.textContent===name)?.closest('li').querySelector('.teamRosterRiotId')?.textContent;
  state.players = [
    {id:'test-yasser',name:'Yasser',role:'Support',riotId:'PlayerOne#1234'},
    {id:'test-fayimo',name:'FAYIMO',role:'Mid',riotId:'PlayerTwo#5678'},
    {id:'test-bernardt',name:'Bernardt',role:'Top',riotId:'ChangedName#9012'},
  ];
  state.count = state.players.length;
  await act(async()=>window.dispatchEvent(new Event('focus')));
  await until(()=>riotIdFor('Yasser')==='PlayerOne#1234');
  assert.equal(riotIdFor('fayimo'),'PlayerTwo#5678');
  assert.equal(riotIdFor('Bernardt'),'ChangedName#9012');
  state.players.push({id:'duplicate-yasser',name:'yasser',role:'Support',riotId:'DifferentAccount#9999'});
  await act(async()=>window.dispatchEvent(new Event('focus')));
  await until(()=>riotIdFor('Yasser')==='Riot ID unavailable');
  state.players = [];
  state.count = 0;
  await act(async()=>window.dispatchEvent(new Event('focus')));
  await until(()=>riotIdFor('fayimo')==='Riot ID unavailable');
  console.log('PASS: grey Riot ID labels use current API identities, case-normalized exact names, distinct players and safe ambiguity/missing-data handling');
  console.log('PASS: five final team cards, correct captains, 25 unique players, original pot labels, hosted logos and separate subs section');
  await act(async()=>button('Tournament format').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
  await until(()=>document.getElementById('format-heading'));
  const format = document.querySelector('[aria-labelledby="format-heading"]');
  assert.deepEqual([...format.querySelectorAll('.formatStats dd')].map(el=>el.textContent),['5','10','Bo1','Top 4']);
  assert.equal(format.querySelectorAll('[aria-label="Participating teams"] li').length,5);
  assert.ok(!format.textContent.includes('RouteOne'));
  assert.ok(format.textContent.includes('5th place is eliminated'));
  assert.ok(format.textContent.includes('Both semifinals and the final are best of three'));
  assert.ok(format.textContent.includes('slowest total win time is eliminated'));
  await act(async()=>button('Fixtures').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
  await until(()=>document.getElementById('fixtures-heading'));
  const fixtures = document.querySelector('[aria-labelledby="fixtures-heading"]');
  assert.ok(fixtures.textContent.includes('Match dates and times TBC'));
  const pairs = new Set();
  const overallGames = new Map();
  for (const week of [1,2]) {
    const games = fixtures.querySelectorAll(`[aria-label="Week ${week} fixtures"] > li`);
    assert.equal(games.length,5);
    const appearances = new Map();
    for (const game of games) {
      const names = [...game.querySelectorAll('strong')].map(el=>el.textContent);
      assert.equal(names.length,2);
      assert.notEqual(names[0],names[1]);
      const pair = [...names].sort().join('|');
      assert.ok(!pairs.has(pair),'Each pairing must occur only once');
      pairs.add(pair);
      for (const name of names) {
        appearances.set(name,(appearances.get(name)||0)+1);
        overallGames.set(name,(overallGames.get(name)||0)+1);
      }
    }
    assert.equal(appearances.size,5);
    assert.ok([...appearances.values()].every(count=>count===2));
  }
  assert.equal(pairs.size,10);
  assert.equal(overallGames.size,5);
  assert.ok([...overallGames.values()].every(count=>count===4));
  console.log('PASS: Fixtures tab, complete ten-game round robin, two games per team per week, no repeated opponents, times TBC');
  await act(async()=>button('Team rosters').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
  await until(()=>!document.getElementById('fixtures-heading'));
  console.log('PASS: format tab beside season details, five teams without R1, ten Bo1 games, top four and Bo3 playoffs');
  await click(button('Sign in to claim'));
  assert.equal(document.querySelector('[role="dialog"] a').getAttribute('href'), '/login');
  assert.ok(!document.body.textContent.includes('Continue as demo player'));
  await click(document.querySelector('[aria-label="Close dialog"]'));

  state.viewer = { account: 'eligible', name: 'Fixture Player', riotId: 'Fixture#1234', role: 'Middle' };
  await act(async () => setSession({ access_token: 'fixture-token', user: {id:'fixture-user'} }));
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
  assert.equal(document.querySelector('.counter'),null);
  assert.ok(button('Registered as floater').disabled);
  assert.equal(state.players.length,25);
  assert.equal(state.floaters.length,1);
  await mount();
  assert.ok(container.textContent.includes('on the floater list'));
  assert.equal(container.querySelector('.floaterCount').textContent,'1');
  console.log('PASS: full 25-player roster still permits floater signup, explicit consent, separate floater count and saved floater entry');
  const beforeRetry = reads;
  temporaryReadFailures = 1;
  await act(async()=>window.dispatchEvent(new Event('focus')));
  await until(()=>reads >= beforeRetry + 2);
  await flush();
  assert.ok(button('Registered as floater').disabled);
  assert.equal(document.querySelectorAll('[aria-label="Registered floaters in signup order"] > li').length,1);
  assert.ok(!container.querySelector('.rosterWarning'));
  unavailable = true;
  await act(async()=>window.dispatchEvent(new Event('focus')));
  await until(()=>container.querySelector('.rosterWarning'));
  assert.equal(document.querySelectorAll('[aria-label="Split II team rosters"] .teamRosterList > li').length,25);
  assert.equal(document.querySelectorAll('[aria-label="Registered floaters in signup order"] > li').length,1);
  assert.ok(container.textContent.includes('on the floater list'));
  await act(async()=>setSession({access_token:'rotated-token',user:{id:'fixture-user'}}));
  await until(()=>container.querySelector('.rosterWarning'));
  assert.ok(button('Registered as floater').disabled);
  assert.ok(container.textContent.includes('on the floater list'));
  unavailable = false;
  await click(button('Try again'));
  await until(()=>!container.querySelector('.rosterWarning'));
  const beforeUnauthorized = reads;
  readStatus = 401;
  await act(async()=>window.dispatchEvent(new Event('focus')));
  await until(()=>container.querySelector('.rosterWarning'));
  assert.equal(reads,beforeUnauthorized+1,'Unauthorized requests must not be retried');
  readStatus = 0;
  unavailable = true;
  await act(async()=>setSession({access_token:'different-user-token',user:{id:'different-user'}}));
  await until(()=>container.textContent.includes("Registration status and floaters couldn't load"));
  assert.ok(button('Checking registration').disabled);
  assert.equal(document.querySelector('[aria-label="Registered floaters in signup order"]'),null);
  assert.ok(!container.textContent.includes('on the floater list'));
  unavailable = false;
  console.log('PASS: transient read retry, retained main/floater lists on refresh failure and token rotation, recovery, no 401 retry, account-switch privacy');
  state = { ...structuredClone(config), viewer: { account: 'eligible', name: 'Fixture Player', riotId: 'Fixture#1234', role: 'Middle' } };
  unavailable = true;
  await mount();
  assert.ok(container.textContent.includes("Registration status and floaters couldn't load"));
  assert.equal(document.querySelectorAll('[aria-label="Split II team rosters"] article').length,5);
  assert.equal(container.querySelector('.counter'),null);
  assert.ok(button('Checking registration').disabled);
  unavailable = false;
  await click(button('Try again'));
  await until(() => button('Claim your place') && !button('Claim your place').disabled);
  rejectClaim = true;
  const beforeRejectedPost = posts;
  await click(button('Claim your place'));
  await click(document.querySelector('input[type="checkbox"]'));
  await click(button('Accept & sign up'));
  await until(() => document.querySelector('[role="dialog"] [role="alert"]'));
  assert.ok(document.querySelector('[role="dialog"]').textContent.includes('The last place was claimed'));
  assert.ok(!container.textContent.includes('Place confirmed'));
  assert.equal(posts,beforeRejectedPost+1,'Registration writes must not be automatically retried');
  console.log('PASS: scheduled opening, full capacity, unavailable roster, retry recovery and rejected signup has no false confirmation');
  const home={id:'home',key:'ballbreakers',name:'BallBreakers',logo:'/kook/split2/ballbreakers.png',members:[]},away={id:'away',key:'phoenix',name:'Phoenix',logo:'/kook/split2/phoenix.png',members:[]};
  matchState={teams:[home,away],fixtures:[{id:'f1',code:'RR01',week:1,bestOf:1,homeTeamId:'home',awayTeamId:'away',homeScore:1,awayScore:0,schedule:{at:'2026-10-26T12:00:00Z',state:'CONFIRMED'}}],standings:[{id:'home',name:'BallBreakers',played:1,wins:1,losses:0,tied:false},{id:'away',name:'Phoenix',played:1,wins:0,losses:1,tied:false}],reports:[{id:'r1',fixtureId:'f1',gameNumber:1,leagueGameId:'100001',payload:{winnerTeamId:'home',durationSeconds:1800,playedAt:'2026-10-24T12:00:00Z',note:'Approved fixture',players:[{profileId:'p1',name:'Test MVP',riotId:'MVP#1234',teamId:'home',kills:5,deaths:2,assists:10,mvp:true,champion:'51',items:[3031,3006,0],damage:60158,gold:20732,position:'BOTTOM'}]}}],leaders:{kda:[{profileId:'p1',name:'Test MVP',kda:7.5,statGames:1}],assists:[{profileId:'p1',name:'Test MVP',assists:10,statGames:1}],mvps:[{profileId:'p1',name:'Test MVP',mvps:1,games:1}]}};
  state=structuredClone(config);await mount();
  const activate=async label=>{await act(async()=>button(label).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));await flush();};
  await activate('Fixtures');assert.ok(container.textContent.includes('26 Oct, 20:00 CST'));assert.ok(container.textContent.includes('Confirmed'));assert.ok(container.textContent.includes('1 : 0'));
  assert.equal(container.querySelectorAll('.fixtureWeek').length,1);
  assert.equal(container.querySelectorAll('.liveFixtureList > li').length,1);
  assert.ok(container.querySelector('.fixtureTeam.fixtureWin').textContent.includes('BallBreakers'));
  assert.ok(container.querySelector('.fixtureTeam.fixtureLoss').textContent.includes('Phoenix'));
  assert.ok(container.querySelector('.fixtureTeam.fixtureWin').textContent.includes('Win'));
  await activate('Standings');
  const rows=[...container.querySelectorAll('.resultsTable tbody tr')];
  assert.deepEqual(rows.map(row=>[...row.children].map(cell=>cell.textContent)),[['BallBreakers','1','1','0','1'],['Phoenix','1','0','1','0']]);
  assert.ok(container.textContent.includes('Ties (*) remain provisional'));
  assert.ok(!container.textContent.includes('MVP#1234'));
  await activate('Results');
  const resultButton=document.querySelector('[aria-label="View RR01 game 1 match details"]');assert.ok(resultButton);
  await click(resultButton);
  const scoreboard=document.querySelector('[role="dialog"]');assert.ok(scoreboard.textContent.includes('MVP#1234'));assert.ok(scoreboard.textContent.includes('5 / 2 / 10'));assert.ok(scoreboard.textContent.includes('60,158'));assert.ok(scoreboard.textContent.includes('20,732'));assert.ok(scoreboard.querySelector('img[src="/lol/champions/51.png"]'));assert.ok(scoreboard.querySelector('img[src="/lol/items/3031.png"]'));
  await click(scoreboard.querySelector('button'));await until(()=>!document.querySelector('[role="dialog"]'));assert.equal(document.activeElement,resultButton);
  await click(resultButton);await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await until(()=>!document.querySelector('[role="dialog"]'));
  console.log('PASS: result popup shows champion, items, KDA, damage, gold and MVP; X/Escape close it and restore focus');
  await activate('Player stats');assert.ok(container.textContent.includes('7.50'));assert.ok(container.textContent.includes('Top 3 MVPs'));assert.ok(container.textContent.includes('Test MVP'));
  console.log('PASS: shared fixture data renders China time, approved results and match details, standings and Top 3 leaders');
  const completed=structuredClone(matchState);
  for(const [bestOf,homeScore,awayScore] of [[1,0,0],[3,1,0]]){
    matchState={...completed,fixtures:[{...completed.fixtures[0],bestOf,homeScore,awayScore,schedule:null}]};
    await mount();await activate('Fixtures');
    assert.equal(container.querySelectorAll('.fixtureWin,.fixtureLoss').length,0,'Pending and incomplete series have no win/loss styling');
    if(homeScore===0)assert.equal(container.querySelector('.fixtureVersus').textContent,'vs');
  }
  matchState={...completed,fixtures:[{...completed.fixtures[0],bestOf:3,homeScore:1,awayScore:2}]};
  await mount();await activate('Fixtures');
  assert.ok(container.querySelector('.fixtureTeam.fixtureWin').textContent.includes('Phoenix'));
  matchState=completed;
  const members=Array.from({length:10},(_,i)=>({profileId:`p${i}`,name:`Player ${i}`,riotId:`Player${i}#1234`,pot:i%5||null,captain:i%5===0}));
  const adminData={...matchState,teams:[{...home,members:members.slice(0,5)},{...away,members:members.slice(5)}],floaters:[{profileId:'floater',name:'Substitute',role:'Support'}],notifications:[],reports:[{id:'pending',fixtureId:'f1',gameNumber:1,source:'HUB',status:'PENDING',payload:{...matchState.reports[0].payload,players:members.map((p,i)=>({...p,teamId:i<5?'home':'away',kills:5,deaths:2,assists:10,mvp:false}))}}]};
  let adminPost=null;
  globalThis.fetch=async(url,options={})=>{
    assert.ok(String(url).startsWith('/api/admin/tournaments/split-ii'));
    if(options.method==='POST'){adminPost=JSON.parse(options.body);return Response.json({status:adminPost.action==='submit'?'PENDING':'APPROVED'});}
    return Response.json(adminData);
  };
  await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(React.createElement(Admin)));await until(()=>container.textContent.includes('1. Choose a fixture'));
  const fixtureSelect=[...container.querySelectorAll('select')][0];await act(async()=>{fixtureSelect.value='f1';fixtureSelect.dispatchEvent(new Event('change',{bubbles:true}));});await flush();
  assert.equal(container.querySelectorAll('[aria-label^="Actual player"]').length,10);assert.ok(container.textContent.includes('Floater: Substitute'));
  await click(button('Save report for review'));assert.equal(adminPost.action,'submit');assert.equal(adminPost.report.payload.players.length,10);assert.equal(adminPost.report.source,'MANUAL');assert.ok(!JSON.stringify(adminPost).includes('lpChange'));
  const approve=button('Approve & publish');assert.ok(approve.disabled);
  const textarea=[...container.querySelectorAll('textarea')].find(e=>e.placeholder.includes('Confirm winner'));
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Checked winner, actual lineup and screenshot');textarea.dispatchEvent(new Event('input',{bubbles:true}));});await flush();
  assert.equal(button('Approve & publish').disabled,false);await click(button('Approve & publish'));assert.equal(adminPost.action,'review');assert.equal(adminPost.reportId,'pending');assert.equal(adminPost.decision,'approve');
  console.log('PASS: admin actual-lineup form, floater options, pending-only save and required review note before publication');
  const nativeRoot=document.createElement('div');nativeRoot.id='split2-content';document.body.append(nativeRoot);
  const nativeData={...matchState,teams:adminData.teams};let nativeListener;
  DesktopSplitTwo({api:{onSplitTwo:cb=>{nativeListener=cb;},splitTwoRefresh:async()=>({ok:true,data:{tournament:nativeData,enabled:false,message:'Uploads disconnected'}})}}).start({demo:false,splitTwo:{tournament:nativeData,enabled:false,message:'Uploads disconnected'}});
  assert.ok(nativeRoot.textContent.includes('Player0#1234'));nativeRoot.querySelector('[data-split-tab="fixtures"]').click();assert.ok(nativeRoot.textContent.includes('26 Oct, 20:00 CST'));nativeRoot.querySelector('[data-split-tab="results"]').click();assert.ok(nativeRoot.textContent.includes('BallBreakers win'));nativeRoot.querySelector('[data-split-tab="stats"]').click();assert.ok(nativeRoot.textContent.includes('Top 3 KDA'));assert.ok(nativeRoot.textContent.includes('7.5'));
  nativeListener({tournament:nativeData,enabled:false,message:'Uploads disconnected',error:'Temporarily unavailable'});assert.ok(nativeRoot.textContent.includes('Temporarily unavailable'));assert.ok(nativeRoot.textContent.includes('Test MVP'));nativeRoot.remove();
  console.log('PASS: native Split II tab renders shared rosters, fixtures, approved results and leaders, preserving saved data on refresh failure');
  console.log('All client interaction checks passed. Auth and HTTP were mocked; no live signup was sent.');
} finally {
  if (root) await act(async () => root.unmount());
  dom.window.close();
}
