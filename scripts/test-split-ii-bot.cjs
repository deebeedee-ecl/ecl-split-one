const test=require('node:test'),assert=require('node:assert/strict');
const {createSplitTwoAdapter}=require('../integrations/kook/split-ii.cjs');
test('Split II uses only tournament endpoints and forwards trusted captain identity',async()=>{
  const calls=[],messages=[],event={target_id:'12345',author_id:'87654'};
  const bot=createSplitTwoAdapter({callEclApi:async(path,body)=>{calls.push({path,body});return {reply:'Proposed'};},sendChannelMessage:async(...args)=>messages.push(args),getKookUserId:e=>e.author_id,isAdminEvent:()=>false});
  await bot.handle(event,['schedule','RR01','2026-10-26','20:00']);
  assert.equal(calls[0].path,'/api/kook/tournaments/split-ii');assert.equal(calls[0].body.command,'!split2 schedule RR01 2026-10-26 20:00');assert.equal(calls[0].body.kookUserId,'87654');assert.equal(calls[0].body.isAdmin,false);assert.deepEqual(messages,[['12345','Proposed']]);
  await bot.tick();assert.equal(calls[1].path,'/api/jobs/tournament-notifications');bot.stop();
});
test('failed requests expose only the bounded public server error',async()=>{
  const messages=[],bot=createSplitTwoAdapter({callEclApi:async()=>{throw new Error('sensitive transport failure');},sendChannelMessage:async(_id,message)=>messages.push(message),getKookUserId:()=> '1',isAdminEvent:()=>false});
  await bot.handle({target_id:'2'},['report','RR01','100001']);assert.ok(!messages[0].includes('sensitive'));await bot.tick();assert.equal(messages.length,1);
});
test('outbox delivery acknowledges the exact claim and retains ambiguous failures',async()=>{
  for(const success of [true,false]){
    const calls=[],notice={id:'n1',deliveryKey:'lease-1',channelId:'12345',content:'Approved result'};
    const bot=createSplitTwoAdapter({callEclApi:async(path,body)=>{calls.push({path,body});return body.action==='claim'?{notice}:{recorded:true};},sendChannelMessage:async()=>success,getKookUserId:()=> '1',isAdminEvent:()=>false});
    await bot.tick();assert.equal(calls[1].body.deliveryKey,'lease-1');assert.equal(calls[1].body.sent,success);
  }
});
test('the integrated bot starts the outbox poller on initial startup without sending a message',async context=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const file=process.env.ECL_SPLIT_BOT_SOURCE||path.resolve('.tmp/split-ii-bot-release/bot-for-staging.js');
  if(!fs.existsSync(file)){context.skip('Sibling bot release source is not present.');return;}
  let starts=0,posts=0;
  const sandbox={process:{env:{KOOK_BOT_TOKEN:'synthetic',ECL_KOOK_BOT_SECRET:'synthetic'},exit(){throw new Error('Unexpected exit');}},console:{log(){},error(){}},setTimeout:()=>({unref(){}}),setInterval:()=>({unref(){}}),clearInterval(){},clearTimeout(){},require(name){
    if(name==='dotenv')return {config(){}};
    if(name==='ws')return class{on(){}};
    if(name==='axios')return {get:async()=>({data:{data:{url:'wss://fixture.invalid'}}}),post:async()=>{posts++;return {data:{code:0}};}};
    if(name==='./split-ii.cjs')return {createSplitTwoAdapter:()=>({start(){starts++;},handle(){}})};
    return require(name);
  }};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);await new Promise(resolve=>setImmediate(resolve));assert.equal(starts,1);assert.equal(posts,0);
});
