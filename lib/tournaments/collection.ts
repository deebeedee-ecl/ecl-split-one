import { Prisma, type PrismaClient } from '@prisma/client';
import { eventLock, normalizedReport, submitTournamentReport, type TournamentActor } from './matches';
import { integer, object, parseReport, text, TournamentError } from './match-policy';

const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const riotKey=(name:string,tag:string)=>`${name.trim().toLowerCase()}#${tag.replace(/^#+/,'').trim().toLowerCase()}`;
export async function queueTournamentCollection(db:PrismaClient,actor:TournamentActor,fixtureId:string,gameId:string,gameNumber=1){
  if(!actor.profileId)throw new TournamentError('A linked player account is required.',403);
  if(!/^\d{5,20}$/.test(gameId))throw new TournamentError('Use the exact numeric League Game ID.');
  integer(gameNumber,1,5);
  return db.$transaction(async tx=>{
    const tournamentId=await eventLock(tx);
    const fixture=await tx.tournamentFixture.findFirst({where:{id:fixtureId,tournamentId}});
    if(!fixture||gameNumber>fixture.bestOf)throw new TournamentError('Invalid fixture or game number.');
    const registration=await tx.tournamentRegistration.findFirst({where:{tournamentId,profileId:actor.profileId},include:{memberships:true}});
    if(!registration||(registration.pool!=='FLOATER'&&!registration.memberships.some(m=>[fixture.homeTeamId,fixture.awayTeamId].includes(m.teamId))))throw new TournamentError('Only a player in this fixture or a registered floater can request collection.',403);
    const key={fixtureId,profileId:actor.profileId!,leagueGameId:gameId,gameNumber};
    const existing=await tx.tournamentCollectionJob.findUnique({where:{fixtureId_profileId_leagueGameId_gameNumber:key}});
    if(existing?.status==='UPLOADED'||existing?.status==='PENDING'&&existing.expiresAt>new Date())return existing;
    if(await tx.tournamentCollectionJob.count({where:{profileId:actor.profileId,status:'PENDING',expiresAt:{gt:new Date()}}})>=5)throw new TournamentError('Finish or cancel an existing collection request first.',409);
    return tx.tournamentCollectionJob.upsert({where:{fixtureId_profileId_leagueGameId_gameNumber:key},create:{...key,tournamentId,expiresAt:new Date(Date.now()+86400000)},update:{status:'PENDING',expiresAt:new Date(Date.now()+86400000)}});
  });
}

/** Strictly interpret LCU data here. No inhouse scoring or report-job code is used. */
export function interpretTournamentMatch(rawValue:unknown,context:{gameId:string;identity:{puuid:string;name:string;tag:string};reporterProfileId:string;homeTeamId:string;awayTeamId:string;players:{profileId:string;name:string;tag:string;teamId:string|null}[]}){
  const raw=object(rawValue);
  if(String(raw.gameId)!==context.gameId||raw.platformId!=='HN1'||raw.gameType!=='CUSTOM_GAME'||raw.gameMode!=='CLASSIC'||raw.mapId!==11||raw.endOfGameResult!=='GameComplete')throw new TournamentError('Expected the requested completed Ionia custom game on Summoner\'s Rift.');
  const participants=raw.participants,identities=raw.participantIdentities,teams=raw.teams;
  if(!Array.isArray(participants)||participants.length!==10||!Array.isArray(identities)||identities.length!==10||!Array.isArray(teams)||teams.length!==2)throw new TournamentError('Match data must include ten participants and two teams.');
  const identityMap=new Map<number,Record<string,unknown>>();
  for(const value of identities){const row=object(value),id=integer(row.participantId,1,100);if(identityMap.has(id))throw new TournamentError('Duplicate participant identity.');identityMap.set(id,object(row.player));}
  const puuids=new Set<string>(),profiles=new Set<string>(),participantIds=new Set<number>();
  const rows=participants.map(value=>{
    const p=object(value),id=integer(p.participantId,1,100),identity=identityMap.get(id);
    if(!identity||participantIds.has(id))throw new TournamentError('Missing or duplicate participant.');participantIds.add(id);
    const puuid=text(identity.puuid,150),name=text(identity.gameName,100),tag=text(identity.tagLine,30);
    if(!puuid||puuids.has(puuid))throw new TournamentError('Missing or duplicate player identity.');puuids.add(puuid);
    const matches=context.players.filter(v=>riotKey(v.name,v.tag)===riotKey(name,tag));
    if(matches.length!==1||profiles.has(matches[0].profileId))throw new TournamentError(`Match Riot ID does not identify one registered player: ${name}#${tag}`);
    const player=matches[0];profiles.add(player.profileId);
    if(player.profileId===context.reporterProfileId&&(puuid!==context.identity.puuid||riotKey(name,tag)!==riotKey(context.identity.name,context.identity.tag)))throw new TournamentError('The local League identity does not match the reporting player.',403);
    const side=integer(p.teamId,100,200);if(![100,200].includes(side))throw new TournamentError('Invalid League side.');
    const stats=object(p.stats);
    return {profileId:player.profileId,permanentTeam:player.teamId,side,champion:String(integer(p.championId,1,10000)),kills:integer(stats.kills,0,200),deaths:integer(stats.deaths,0,200),assists:integer(stats.assists,0,300),mvp:false};
  });
  if(!profiles.has(context.reporterProfileId))throw new TournamentError('The reporting player must have played this game.',403);
  const sideTeams=new Map<number,string>();
  for(const side of [100,200]){
    const line=rows.filter(p=>p.side===side),permanent=[...new Set(line.map(p=>p.permanentTeam).filter((id):id is string=>Boolean(id)))];
    if(line.length!==5||permanent.length!==1||![context.homeTeamId,context.awayTeamId].includes(permanent[0]))throw new TournamentError('Cannot match the actual five-player sides to this fixture. Ask an admin to review the lineup.');
    sideTeams.set(side,permanent[0]);
  }
  if(sideTeams.get(100)===sideTeams.get(200))throw new TournamentError('Both League sides cannot represent the same team.');
  const outcomes=teams.map(v=>{const t=object(v);if(![100,200].includes(Number(t.teamId))||![true,false,'Win','Fail'].includes(t.win as boolean|string))throw new TournamentError('Invalid match outcome.');return {side:Number(t.teamId),win:t.win===true||t.win==='Win'};});
  if(new Set(outcomes.map(o=>o.side)).size!==2||outcomes.filter(o=>o.win).length!==1)throw new TournamentError('Match must have exactly one winner.');
  const durationSeconds=integer(raw.gameDuration,60,14400),creation=integer(raw.gameCreation,1,Date.now());
  const playedAt=new Date(creation+durationSeconds*1000).toISOString();
  return {winnerTeamId:sideTeams.get(outcomes.find(t=>t.win)!.side)!,durationSeconds,playedAt,note:'Collected from the local League client.',players:rows.map(p=>({profileId:p.profileId,champion:p.champion,kills:p.kills,deaths:p.deaths,assists:p.assists,mvp:p.mvp,teamId:sideTeams.get(p.side)!}))};
}

export async function tournamentCollectionJobs(db:PrismaClient,actor:TournamentActor){
  if(!actor.profileId)throw new TournamentError('Sign in first.',401);
  return db.tournamentCollectionJob.findMany({where:{profileId:actor.profileId,tournament:{slug:'ecl-split-ii-2026'},OR:[{status:'PENDING',expiresAt:{gt:new Date()}},{status:'UPLOADED',createdAt:{gt:new Date(Date.now()-86400000)}}]},select:{id:true,fixtureId:true,leagueGameId:true,gameNumber:true,status:true,reportId:true,expiresAt:true},orderBy:{createdAt:'asc'},take:20});
}
export async function importTournamentLcu(db:PrismaClient,actor:TournamentActor,fixtureId:string,gameNumber:number,value:unknown,replacesId?:string){
  if(!actor.admin)throw new TournamentError('Admin access required.',403);
  const fixture=await db.tournamentFixture.findFirst({where:{id:fixtureId,homeTeam:{tournament:{slug:'ecl-split-ii-2026'}}}});
  if(!fixture)throw new TournamentError('Choose a tournament fixture first.');
  const regs=await db.tournamentRegistration.findMany({where:{tournamentId:fixture.tournamentId,OR:[{pool:'FLOATER'},{memberships:{some:{teamId:{in:[fixture.homeTeamId,fixture.awayTeamId]}}}}]},include:{profile:true,memberships:{where:{tournamentId:fixture.tournamentId}}}});
  const raw=object(value),identities=raw.participantIdentities;
  if(!Array.isArray(identities)||!identities.length)throw new TournamentError('Import a complete LCU match JSON, or use the manual form.');
  const first=object(object(identities[0]).player),identity={puuid:text(first.puuid,150),name:text(first.gameName,100),tag:text(first.tagLine,30)};
  const reporter=regs.find(r=>riotKey(r.profile.riotName,r.profile.riotTag)===riotKey(identity.name,identity.tag));
  if(!reporter)throw new TournamentError('The JSON lineup does not match this tournament fixture.');
  const payload=interpretTournamentMatch(raw,{gameId:String(raw.gameId),identity,reporterProfileId:reporter.profileId,homeTeamId:fixture.homeTeamId,awayTeamId:fixture.awayTeamId,players:regs.filter(r=>r.profile.chinaServerId===1).map(r=>({profileId:r.profileId,name:r.profile.riotName,tag:r.profile.riotTag,teamId:r.memberships[0]?.teamId??null}))});
  return submitTournamentReport(db,actor,{fixtureId,gameNumber,platform:'HN1',leagueGameId:String(raw.gameId),source:'JSON',payload,raw,...(replacesId?{replacesId}:{})});
}
export async function uploadTournamentCollection(db:PrismaClient,actor:TournamentActor,value:unknown){
  if(!actor.profileId)throw new TournamentError('Sign in first.',401);
  const body=object(value),local=object(body.identity),identity={puuid:text(local.puuid,150),name:text(local.name,100),tag:text(local.tag,30)};
  const jobId=text(body.jobId,100);
  return db.$transaction(async tx=>{
    const tournamentId=await eventLock(tx);
    const job=await tx.tournamentCollectionJob.findFirst({where:{id:jobId,tournamentId,profileId:actor.profileId}});
    if(!job)throw new TournamentError('Collection request not found.',404);
    if(job.status==='UPLOADED')return {id:job.reportId,status:'PENDING',duplicate:true};
    if(job.status!=='PENDING'||job.expiresAt<new Date())throw new TournamentError('Collection request expired or was cancelled.',409);
    const fixture=await tx.tournamentFixture.findUniqueOrThrow({where:{id:job.fixtureId}});
    const regs=await tx.tournamentRegistration.findMany({where:{tournamentId,OR:[{pool:'FLOATER'},{memberships:{some:{teamId:{in:[fixture.homeTeamId,fixture.awayTeamId]}}}}]},include:{profile:true,memberships:{where:{tournamentId}}}});
    const reporter=regs.find(r=>r.profileId===actor.profileId);
    if(!reporter||reporter.profile.chinaServerId!==1||riotKey(reporter.profile.riotName,reporter.profile.riotTag)!==riotKey(identity.name,identity.tag))throw new TournamentError('Your local League account must match your verified Ionia profile.',403);
    const players=regs.filter(r=>r.profile.chinaServerId===1).map(r=>({profileId:r.profileId,name:r.profile.riotName,tag:r.profile.riotTag,teamId:r.memberships[0]?.teamId??null}));
    const payload=interpretTournamentMatch(body.raw,{gameId:job.leagueGameId,identity,reporterProfileId:actor.profileId!,homeTeamId:fixture.homeTeamId,awayTeamId:fixture.awayTeamId,players});
    const input=parseReport({fixtureId:fixture.id,gameNumber:job.gameNumber,platform:'HN1',leagueGameId:job.leagueGameId,source:'HUB',payload});
    await normalizedReport(tx,tournamentId,input);
    const existing=await tx.tournamentReport.findFirst({where:{tournamentId,fixtureId:fixture.id,gameNumber:job.gameNumber,leagueGameId:job.leagueGameId,status:{in:['PENDING','APPROVED']}}});
    const report=existing??await tx.tournamentReport.create({data:{tournamentId,fixtureId:fixture.id,gameNumber:job.gameNumber,platform:'HN1',leagueGameId:job.leagueGameId,source:'HUB',submittedBy:actor.profileId!,payload:json(input.payload),raw:json(body.raw)}});
    await tx.tournamentCollectionJob.update({where:{id:job.id},data:{status:'UPLOADED',reportId:report.id}});
    return {id:report.id,status:report.status,duplicate:Boolean(existing),lpApplied:false};
  },{maxWait:10000,timeout:30000});
}
