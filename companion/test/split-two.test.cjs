const test=require('node:test'),assert=require('node:assert/strict');
const {SplitTwo}=require('../src/split-two.cjs');
function fixture(transport){
  const account={epoch:1,data:{authenticated:true},client:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic-secret'}}})}}};
  const collector={connection:{profile:{puuid:'p',gameName:'Name',tagLine:'1234'}},db:{matches:[{key:'k'}]},enqueue:async()=> 'k',tick:async()=>{},readMatch:async()=>({raw:{gameId:100001},sample:false})};
  return {account,collector,split:new SplitTwo(account,collector,transport)};
}
test('public Split II refresh never sends account credentials',async()=>{
  const {split}=fixture(async(url,options)=>{assert.equal(url,'https://eclchina.lol/api/tournaments/split-ii/matches');assert.equal(options.headers.Authorization,undefined);return Response.json({teams:[],fixtures:[],reports:[]});});
  await split.refresh();assert.ok(split.snapshot().tournament);split.dispose();
});
test('uploads are disconnected by default and only requested tournament games go to review',async()=>{
  const calls=[],{split}=fixture(async(url,options)=>{calls.push({url,options});if(options.method==='POST')return Response.json({status:'PENDING'});return Response.json({jobs:[{id:'job',leagueGameId:'100001',status:'PENDING'}]});});
  await split.tick();assert.equal(calls.length,0);split.local=split.identity();split.epoch=1;split.controller=new AbortController();split.change({enabled:true});await split.tick();
  const reporting=calls.filter(c=>c.url.endsWith('/tournaments/split-ii/collection'));assert.equal(reporting.length,2);assert.equal(JSON.parse(reporting[1].options.body).jobId,'job');assert.ok(calls.every(c=>c.url.startsWith('https://eclchina.lol/api/tournaments/split-ii/')));assert.ok(!JSON.stringify(split.snapshot()).includes('synthetic-secret'));split.dispose();
});
test('switching League or ECL account disconnects without uploading',async()=>{
  let requests=0;const {split,account}=fixture(async()=>{requests++;return Response.json({});});split.local=split.identity();split.epoch=1;split.change({enabled:true});account.epoch=2;await split.tick();assert.equal(requests,0);assert.equal(split.data.enabled,false);split.dispose();
});
test('disconnect during connection cannot enable uploads after the request resolves',async()=>{
  let finish;const {split}=fixture(()=>new Promise(resolve=>{finish=resolve;}));const connecting=split.connect();await new Promise(resolve=>setImmediate(resolve));split.disconnect();finish(Response.json({jobs:[]}));await connecting;assert.equal(split.data.enabled,false);split.dispose();
});
