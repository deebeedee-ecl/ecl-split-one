import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma,PrismaClient,type AccountProfile } from '@prisma/client';
import { seedMatchWorkflow,tournamentView,scheduleFixture,submitTournamentReport,reviewTournamentReport,normalizedReport } from '../lib/tournaments/matches';
import { queueTournamentCollection,uploadTournamentCollection,importTournamentLcu } from '../lib/tournaments/collection';
import { instant,parseReport } from '../lib/tournaments/match-policy';
import { SPLIT_II_ROSTERS } from '../lib/tournaments/split-ii-rosters';
import { deliverTournamentNotifications,claimTournamentNotification,finishTournamentNotification } from '../lib/tournaments/notifications';
type Connection={query:(sql:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>};
export async function testMatchWorkflow(db:PrismaClient,connection:Connection,profiles:AccountProfile[]){
  const sql=(file:string)=>readFile(path.resolve('docs/database/tournaments',file),'utf8');
  await connection.query(await sql('create-tournaments.draft.sql'));await connection.query(await sql('seed-split-ii.draft.sql'));await connection.query(await sql('schedule-split-ii.draft.sql'));await connection.query(await sql('add-floater-pool.sql'));await connection.query(await sql('activate-floater-pool.sql'));
  await connection.query('BEGIN');try{await connection.query(await sql('add-match-workflow.sql'));await connection.query(await sql('match-workflow-security.sql'));await connection.query('COMMIT');}catch(e){await connection.query('ROLLBACK');throw e;}
  const event=await db.tournament.findUniqueOrThrow({where:{slug:'ecl-split-ii-2026'}});
  const picks=SPLIT_II_ROSTERS.flatMap(t=>[t.captain,...t.picks.map(p=>p.name)]);
  for(const [index,name] of picks.entries()){
    const p=profiles[30+index];await db.accountProfile.update({where:{id:p.id},data:{chinaServerId:1,accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}});
    await db.tournamentRegistration.create({data:{tournamentId:event.id,profileId:p.id,displayNameSnapshot:name,primaryRoleSnapshot:'MID',riotNameSnapshot:p.riotName!,riotTagSnapshot:p.riotTag!,termsVersion:event.termsVersion!,rulesVersion:event.rulesVersion!,consentedAt:new Date(Date.now()-1000)}});
  }
  const floater=profiles[60];await db.tournamentRegistration.create({data:{tournamentId:event.id,profileId:floater.id,pool:'FLOATER',displayNameSnapshot:'Test Floater',primaryRoleSnapshot:'SUPP',riotNameSnapshot:floater.riotName!,riotTagSnapshot:floater.riotTag!,termsVersion:event.termsVersion!,rulesVersion:event.floaterRulesVersion!,consentedAt:new Date(Date.now()-1000)}});
  const fingerprint=async()=>{
    const tables=['Player','Match','MatchGame','MatchGamePlayerStat','InhouseSession','InhouseReportJob','AccountProfile','tournament_registrations'];
    return Promise.all(tables.map(async name=>(await connection.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS hash FROM public."${name}" t`)).rows[0].hash));
  };
  const before=await fingerprint();
  assert.deepEqual(await seedMatchWorkflow(db),{teams:5,members:25,fixtures:10,alreadySeeded:false});
  assert.equal((await seedMatchWorkflow(db)).alreadySeeded,true);
  let view=await tournamentView(db,{admin:true});assert.equal(view.teams.length,5);assert.equal(view.fixtures.length,10);assert.equal(view.reports.length,0);
  assert.deepEqual(view.teams.find(t=>t.key==='exodus')?.members.map(p=>p.name),['Soul','Peter','Joe','fayimo','Yasser']);
  for(const role of ['anon','authenticated']){await connection.query(`SET ROLE ${role}`);try{for(const table of ['tournament_teams','tournament_members','tournament_fixtures','tournament_reports','tournament_floater_appearances','tournament_notifications','tournament_collection_jobs'])await assert.rejects(()=>connection.query(`SELECT * FROM public.${table}`));}finally{await connection.query('RESET ROLE');}}
  console.log('PASS: separate match foundation, exact 25 players, pick order, ten fixtures, idempotent seeding and RLS');
  let readAttempts=0;
  const flaky=new Proxy(db,{get(target,key){if(key==='tournament')return {findUnique:async(args:Prisma.TournamentFindUniqueArgs)=>{if(++readAttempts===1)throw new Prisma.PrismaClientInitializationError('Synthetic connection failure',Prisma.prismaVersion.client,'P1001');return target.tournament.findUnique(args);}};return Reflect.get(target,key);}});
  assert.equal((await tournamentView(flaky)).teams.length,5);assert.equal(readAttempts,2);
  assert.throws(()=>instant('2026-02-30T20:00:00+08:00'));
  const f=view.fixtures[0],home=view.teams.find(t=>t.id===f.homeTeamId)!,away=view.teams.find(t=>t.id===f.awayTeamId)!,at=new Date(Date.now()+86400000).toISOString();
  const homeActor={admin:false,profileId:home.captainProfileId},awayActor={admin:false,profileId:away.captainProfileId};
  const proposal={action:'propose',fixtureId:f.id,revision:0,at,channelId:'12345'};
  await assert.rejects(()=>scheduleFixture(db,{admin:false,profileId:floater.id},proposal),/captain/);
  const proposed=await scheduleFixture(db,homeActor,proposal);assert.equal(proposed.schedule?.state,'PROPOSED');
  await assert.rejects(()=>scheduleFixture(db,homeActor,{action:'confirm',fixtureId:f.id,revision:1}),/opposing/);
  await assert.rejects(()=>scheduleFixture(db,awayActor,{action:'confirm',fixtureId:f.id,revision:0}),/changed/);
  const race=await Promise.allSettled([1,2].map(()=>scheduleFixture(db,awayActor,{action:'confirm',fixtureId:f.id,revision:1})));
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(await db.tournamentNotification.count(),1);
  console.log('PASS: captain-only scheduling, opponent confirmation, stale revisions and concurrent confirmation');
  const reportFor=(fixture:typeof f,gameId:string,sub=false)=>{
    const teams=[fixture.homeTeamId,fixture.awayTeamId].map(id=>view.teams.find(t=>t.id===id)!);
    return {fixtureId:fixture.id,gameNumber:1,platform:'HN1',leagueGameId:gameId,source:'MANUAL',payload:{winnerTeamId:fixture.homeTeamId,playedAt:new Date(Date.now()-3600000).toISOString(),durationSeconds:1800,note:'Test approved match',players:teams.flatMap((t,side)=>t.members.map((p,index)=>({profileId:sub&&side===0&&index===4?floater.id:p.profileId,teamId:t.id,kills:5,deaths:2,assists:10,mvp:side===0&&index===0})))}};
  };
  const firstInput=reportFor(f,'100001',true);
  Object.assign(firstInput.payload.players[0],{champion:'51',items:[3031,3006,0,0,0,0,3363],damage:60158,gold:20732,position:'BOTTOM'});
  const invalidItems=structuredClone(firstInput);Object.assign(invalidItems.payload.players[0],{items:Array(8).fill(1)});assert.throws(()=>parseReport(invalidItems),/seven/);
  const invalidDamage=structuredClone(firstInput);Object.assign(invalidDamage.payload.players[0],{damage:-1});assert.throws(()=>parseReport(invalidDamage),/integer/);
  const identityPlayer=home.members[0],originalProfile=await db.accountProfile.findUniqueOrThrow({where:{id:identityPlayer.profileId}});
  try{
    await db.accountProfile.update({where:{id:identityPlayer.profileId},data:{riotName:'Different Hub account',riotTag:'99999'}});
    const frozen=await tournamentView(db);assert.equal(frozen.teams.find(t=>t.id===home.id)!.members[0].riotId,identityPlayer.riotId);
    const candidate=parseReport(firstInput);await normalizedReport(db,event.id,candidate);
    assert.equal(candidate.payload.players.find(p=>p.profileId===identityPlayer.profileId)!.riotId,identityPlayer.riotId);
  }finally{await db.accountProfile.update({where:{id:identityPlayer.profileId},data:{riotName:originalProfile.riotName,riotTag:originalProfile.riotTag,updatedAt:originalProfile.updatedAt}});}
  console.log('PASS: tournament roster and report identities stay separate from later Hub account changes');
  await assert.rejects(()=>submitTournamentReport(db,homeActor,firstInput),/admin/);
  const first=await submitTournamentReport(db,{admin:true},firstInput);assert.equal(first.status,'PENDING');
  const savedPayload=(await db.tournamentReport.findUniqueOrThrow({where:{id:first.id}})).payload as unknown as {players:{items:number[];damage:number;gold:number}[]};
  assert.deepEqual(savedPayload.players[0].items,[3031,3006,0,0,0,0,3363]);assert.equal(savedPayload.players[0].damage,60158);assert.equal(savedPayload.players[0].gold,20732);
  assert.equal((await submitTournamentReport(db,{admin:true},firstInput)).duplicate,true);
  assert.equal((await tournamentView(db)).reports.length,0);
  const published=await reviewTournamentReport(db,first.id,'approve','Checked actual lineup, screenshot, duration and stats');assert.equal(published.status,'APPROVED');
  const retry=await reviewTournamentReport(db,first.id,'approve','Idempotent retry');assert.ok('duplicate' in retry&&retry.duplicate);
  assert.equal(await db.tournamentFloaterAppearance.count(),1);
  view=await tournamentView(db,{admin:true});assert.equal(view.standings.find(t=>t.id===home.id)?.wins,1);assert.equal(view.leaders.kda[0].kda,7.5);assert.equal(view.leaders.assists[0].assists,10);assert.equal(view.leaders.mvps[0].mvps,1);
  const repeated=view.fixtures.find(v=>v.id!==f.id&&v.homeTeamId===home.id)!;
  const repeat=await submitTournamentReport(db,{admin:true},reportFor(repeated,'100002',true));await assert.rejects(()=>reviewTournamentReport(db,repeat.id,'approve','Attempt repeat floater'),/already played/);
  assert.equal((await db.tournamentReport.findUniqueOrThrow({where:{id:repeat.id}})).status,'PENDING');
  const opposite=view.fixtures.find(v=>v.homeTeamId!==home.id&&v.awayTeamId!==home.id)!;
  const other=await submitTournamentReport(db,{admin:true},reportFor(opposite,'100003',true));await reviewTournamentReport(db,other.id,'approve','Floater different team');assert.equal(await db.tournamentFloaterAppearance.count(),2);
  const fix=await submitTournamentReport(db,{admin:true},{...reportFor(f,'100001',false),replacesId:first.id});await reviewTournamentReport(db,fix.id,'approve','Corrected actual lineup');assert.equal((await db.tournamentReport.findUniqueOrThrow({where:{id:first.id}})).status,'REPLACED');assert.equal(await db.tournamentFloaterAppearance.count(),1);
  const duplicate=await submitTournamentReport(db,{admin:true},reportFor(repeated,'100001'));await assert.rejects(()=>reviewTournamentReport(db,duplicate.id,'approve','Duplicate League ID'),/already has an approved/);
  console.log('PASS: review gate, exact lineups, approved statistics, corrections, duplicate IDs and once-per-team floaters');
  assert.deepEqual(await fingerprint(),before,'Tournament operations must leave every legacy row/profile/registration unchanged');
  const session=await db.inhouseSession.create({data:{sourceChannelId:'1',blueChannelId:'2',redChannelId:'3'}});
  await assert.rejects(()=>db.inhouseSession.update({where:{id:session.id},data:{lzyumiGameId:'100001'}}));
  const job=await db.inhouseReportJob.create({data:{sessionId:session.id,requestedByKookId:'123',rawMatchData:{gameId:'100099'}}});
  const collision=await submitTournamentReport(db,{admin:true},reportFor(repeated,'100099'));await assert.rejects(()=>reviewTournamentReport(db,collision.id,'approve','Legacy collision'),/inhouse/);
  await db.inhouseReportJob.delete({where:{id:job.id}});await db.inhouseSession.delete({where:{id:session.id}});
  assert.deepEqual(await fingerprint(),before);
  console.log('PASS: both directions reject tournament/inhouse reuse; all legacy fingerprints unchanged');
  const queueFixture=view.fixtures.find(v=>v.id!==f.id&&v.id!==opposite.id)!;
  const queueHome=view.teams.find(t=>t.id===queueFixture.homeTeamId)!,queueAway=view.teams.find(t=>t.id===queueFixture.awayTeamId)!,owner={admin:false,profileId:queueHome.members[0].profileId};
  const job2=await queueTournamentCollection(db,owner,queueFixture.id,'100088');
  const actualProfiles=await db.accountProfile.findMany({where:{id:{in:[...queueHome.members,...queueAway.members].map(p=>p.profileId)}}});
  const roster=[...queueHome.members,...queueAway.members].map(m=>({member:m,profile:actualProfiles.find(p=>p.id===m.profileId)!}));
  const raw={gameId:100088,platformId:'HN1',gameType:'CUSTOM_GAME',gameMode:'CLASSIC',mapId:11,endOfGameResult:'GameComplete',gameCreation:Date.now()-7200000,gameDuration:1800,teams:[{teamId:100,win:'Win'},{teamId:200,win:'Fail'}],participants:roster.map(({member},i)=>({participantId:i+1,teamId:member.profileId===queueHome.members.find(m=>m.profileId===member.profileId)?.profileId?100:200,championId:1,stats:{kills:5,deaths:2,assists:10}})),participantIdentities:roster.map(({profile},i)=>({participantId:i+1,player:{puuid:`puuid-${i}`,gameName:profile.riotName,tagLine:profile.riotTag}}))};
  const identity={puuid:'puuid-0',name:roster[0].profile.riotName,tag:roster[0].profile.riotTag};
  Object.assign(raw.participants[0].stats,{item0:3031,item1:3006,item2:0,item3:0,item4:0,item5:0,item6:3363,totalDamageDealtToChampions:32111,goldEarned:16424});
  await assert.rejects(()=>uploadTournamentCollection(db,{admin:false,profileId:floater.id},{jobId:job2.id,identity,raw}),/not found/);
  await assert.rejects(()=>uploadTournamentCollection(db,owner,{jobId:job2.id,identity,raw:{...raw,gameId:100089}}),/requested/);
  const collected=await uploadTournamentCollection(db,owner,{jobId:job2.id,identity,raw});assert.equal(collected.status,'PENDING');assert.equal((await uploadTournamentCollection(db,owner,{jobId:job2.id,identity,raw})).duplicate,true);
  assert.equal((await db.tournamentReport.findUniqueOrThrow({where:{id:collected.id!}})).source,'HUB');
  const collectedPlayers=((await db.tournamentReport.findUniqueOrThrow({where:{id:collected.id!}})).payload as unknown as {players:{items?:number[];damage?:number;gold?:number}[]}).players;
  assert.deepEqual(collectedPlayers[0].items,[3031,3006,0,0,0,0,3363]);assert.equal(collectedPlayers[0].damage,32111);assert.equal(collectedPlayers[0].gold,16424);assert.equal(collectedPlayers[1].items,undefined);
  await assert.rejects(()=>importTournamentLcu(db,owner,queueFixture.id,1,raw),/Admin/);
  const imported=await importTournamentLcu(db,{admin:true},queueFixture.id,1,{...raw,gameId:100087});assert.equal(imported.status,'PENDING');
  assert.equal((await db.tournamentReport.findUniqueOrThrow({where:{id:imported.id}})).source,'JSON');
  const privateView=await tournamentView(db);assert.ok(!JSON.stringify(privateView).includes('puuid-'));assert.ok(!JSON.stringify(privateView).includes('Checked actual lineup'));
  assert.deepEqual(await fingerprint(),before);
  console.log('PASS: own-account collection, exact Game ID, parsed ten-player sides, private raw data and pending-only uploads');
  process.env.KOOK_BOT_TOKEN='fixture-token-not-real';let sent=0;
  const claims=await Promise.all([claimTournamentNotification(db),claimTournamentNotification(db)]);const claimed=claims.filter((v):v is NonNullable<typeof v>=>Boolean(v));assert.ok(claimed.length>=1);assert.equal(new Set(claimed.map(v=>v.id)).size,claimed.length);
  for(const claim of claimed){assert.equal((await finishTournamentNotification(db,claim.id,'wrong-key',true)).recorded,false);assert.equal((await finishTournamentNotification(db,claim.id,claim.deliveryKey,true)).recorded,true);}
  const expectedDeliveries=Math.min(2,await db.tournamentNotification.count({where:{status:'PENDING'}}));const delivered=await deliverTournamentNotifications(db,async()=>{sent++;return Response.json({code:0});});assert.equal(delivered.sent,expectedDeliveries);assert.equal(sent,expectedDeliveries);
  while(await db.tournamentNotification.count({where:{status:'PENDING'}}))await deliverTournamentNotifications(db,async()=>Response.json({code:0}));
  const ambiguous=await db.tournamentNotification.create({data:{tournamentId:event.id,dedupeKey:'test-ambiguous',channelId:'12345',content:'Fixture test notification'}});
  await deliverTournamentNotifications(db,async()=>{throw new Error('Test timeout');});assert.equal((await db.tournamentNotification.findUniqueOrThrow({where:{id:ambiguous.id}})).status,'UNKNOWN');
  delete process.env.KOOK_BOT_TOKEN;
  console.log('PASS: durable mocked notification delivery and ambiguous timeout avoids blind duplicate resend');
}
