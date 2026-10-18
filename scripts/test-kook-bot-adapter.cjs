const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function bot(handler = () => ({ reply: 'response' })) {
  const file = process.env.ECL_BOT_FILE || path.join(__dirname, '../../ECL-Bot/bot.js');
  const source = fs.readFileSync(file, 'utf8'), cut = source.lastIndexOf('\nstartBot().catch(');
  assert.ok(cut > 0);
  const calls = [], timers = [];
  const context = vm.createContext({
    process: { env: { KOOK_BOT_TOKEN: 'synthetic', ECL_KOOK_BOT_SECRET: 'synthetic', ECL_SITE_URL: 'https://example.test' }, exit() { throw new Error('Unexpected exit'); } },
    console: { log() {}, error() {} },
    setTimeout(fn, delay) { const timer = { fn, delay, unref() {} }; timers.push(timer); return timer; },
    require(name) {
      if (name === 'dotenv') return { config() {} };
      if (name === 'ws') return function() { throw new Error('Live connection forbidden'); };
      if (name === 'axios') return { get: async () => ({ data: { data: [] } }), post: async (url, data) => { calls.push({ url, data }); return { data: url.endsWith('/api/kook/commands') || url.endsWith('/api/kook/inhouse') ? handler(url, data) : {} }; } };
      return require(name);
    },
  });
  vm.runInContext(source.slice(0, cut) + '\nglobalThis.adapter = { handleCommand, handleReportCommand, handleInhouseCommand, formatCommands };', context);
  return { adapter: context.adapter, calls, timers };
}
const event = { author_id: 'reporter', target_id: 'channel' };

test('the bot forwards the full report, status and cancellation selectors and routes !hub', async () => {
  const { adapter, calls } = bot();
  for (const [command, args] of [['!report', ['28', '11363615233']], ['!status', ['28']], ['!cancel', ['28']], ['!hub', []]]) await adapter.handleCommand(event, command, args);
  const commands = calls.filter(call => call.url.endsWith('/api/kook/commands')).map(call => call.data.command);
  assert.deepEqual(commands, ['!report 28 11363615233', '!status 28', '!cancel 28', '!hub']);
  const report = calls.find(call => call.data.command === '!report 28 11363615233').data;
  assert.equal(report.kookUserId, 'reporter'); assert.equal(report.channelId, 'channel');
});

test('empty move instructions never announce that players moved, and force-ready cannot bypass verification', async () => {
  const { adapter, calls } = bot(() => ({ reply: 'Duplicate ignored', moveInstructions: [] }));
  await adapter.handleCommand(event, '!ready', []); await adapter.handleCommand(event, '!forceready', []);
  assert.ok(!calls.some(call => call.data.content === 'Players moved to Blue Side and Red Side.'));
  assert.equal(calls.filter(call => call.url.endsWith('/api/kook/inhouse')).length, 1);
});

test('one waiting reminder is scheduled per job and only sent while that same request remains unclaimed', async () => {
  let stage = 'WAITING_FOR_HUB';
  const { adapter, calls, timers } = bot(() => ({ reply: 'Waiting', status: stage, reportRequest: { id: 'job-1', selector: '28', createdAt: new Date().toISOString() } }));
  await adapter.handleReportCommand(event, '!report', ['28', '11363615233']);
  await adapter.handleReportCommand(event, '!report', ['28', '11363615233']);
  assert.equal(timers.filter(timer => timer.delay === 60000).length, 1);
  await timers.find(timer => timer.delay === 60000).fn();
  const reminders = () => calls.filter(call => call.data.content?.includes('still waiting for Hub'));
  assert.equal(reminders().length, 1);
  stage = 'AWAITING_REVIEW'; await timers.find(timer => timer.delay === 60000).fn(); assert.equal(reminders().length, 1);
});
