import { Prisma, type PrismaClient } from "@prisma/client";
import { SPLIT_II_SLUG } from "./split-ii-config";
import { SPLIT_II_TEAMS, SPLIT_II_FIXTURE_WEEKS } from "./split-ii-fixtures";
import { SPLIT_II_ROSTERS } from "./split-ii-rosters";
import { TournamentError, calculateTables, instant, integer, parseReport, text, type MatchPayload, type Schedule } from "./match-policy";

type Tx = Prisma.TransactionClient;
export type TournamentActor = { profileId?: string; admin: boolean };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const nameKey = (s: string) => s.trim().toLowerCase();
export async function eventLock(tx: Tx) {
  const rows = await tx.$queryRaw<{id:string}[]>`SELECT id FROM public.tournaments WHERE slug=${SPLIT_II_SLUG} FOR UPDATE`;
  if (!rows[0]) throw new TournamentError("Tournament is not configured.", 503);
  return rows[0].id;
}
export async function seedMatchWorkflow(db: PrismaClient) {
  return db.$transaction(async tx => {
    const eventId = await eventLock(tx);
    const existing = await tx.tournamentTeam.count({where:{tournamentId:eventId}});
    if (existing) {
      if (existing !== 5 || await tx.tournamentMember.count({where:{tournamentId:eventId}}) !== 25 || await tx.tournamentFixture.count({where:{tournamentId:eventId,stage:'ROUND_ROBIN'}}) !== 10) throw new TournamentError("Existing tournament foundation needs review.",409);
      return {teams:5,members:25,fixtures:10,alreadySeeded:true};
    }
    const registrations = await tx.tournamentRegistration.findMany({where:{tournamentId:eventId,pool:'MAIN'}});
    if (registrations.length !== 25) throw new TournamentError("Expected the 25-player final roster.",409);
    const assigned = new Set<string>();
    for (const roster of SPLIT_II_ROSTERS) {
      const definition = SPLIT_II_TEAMS[roster.team];
      const picks = [{name:roster.captain,pot:null},...roster.picks];
      const entries = picks.map(p => {
        const found = registrations.filter(r=>nameKey(r.displayNameSnapshot)===nameKey(p.name));
        if (found.length !== 1 || assigned.has(found[0].profileId)) throw new TournamentError(`Ambiguous or repeated player: ${p.name}`,409);
        assigned.add(found[0].profileId); return {...p,registration:found[0]};
      });
      const teamId = `${eventId}:${roster.team}`;
      await tx.tournamentTeam.create({data:{id:teamId,tournamentId:eventId,key:roster.team,...definition,logo:`/kook/split2/${roster.team}.png`,accent:roster.accent,captainProfileId:entries[0].registration.profileId}});
      for (const [index,p] of entries.entries()) await tx.tournamentMember.create({data:{id:`${teamId}:${index}:${p.registration.id}`,tournamentId:eventId,teamId,profileId:p.registration.profileId,registrationId:p.registration.id,pot:p.pot}});
    }
    for (const week of SPLIT_II_FIXTURE_WEEKS) for (const [index,[home,away]] of week.matches.entries()) {
      const code = `RR${String((week.week-1)*5+index+1).padStart(2,'0')}`;
      await tx.tournamentFixture.create({data:{id:`${eventId}:${code}`,tournamentId:eventId,code,week:week.week,homeTeamId:`${eventId}:${home}`,awayTeamId:`${eventId}:${away}`,pairKey:[home,away].sort().join(':')}});
    }
    return {teams:5,members:25,fixtures:10,alreadySeeded:false};
  },{maxWait:10000,timeout:60000});
}

export async function tournamentView(db: PrismaClient, actor: TournamentActor = {admin:false}) {
  try{return await loadTournamentView(db,actor);}catch(error){
    const code=error instanceof Prisma.PrismaClientKnownRequestError?error.code:error instanceof Prisma.PrismaClientInitializationError?error.errorCode:undefined;
    if(!['P1001','P1002','P1008','P1017','P2024'].includes(code??''))throw error;
    await new Promise(resolve=>setTimeout(resolve,150));
    return loadTournamentView(db,actor);
  }
}
async function loadTournamentView(db:PrismaClient,actor:TournamentActor){
  const event = await db.tournament.findUnique({where:{slug:SPLIT_II_SLUG},select:{id:true,name:true,startsOn:true,endsOn:true}});
  if (!event) throw new TournamentError("Tournament is not configured.",503);
  const [teams,fixtures,reports,floaters] = await Promise.all([
    db.tournamentTeam.findMany({where:{tournamentId:event.id},include:{members:{orderBy:{id:'asc'},include:{profile:{select:{riotName:true,riotTag:true}},registration:{select:{displayNameSnapshot:true,primaryRoleSnapshot:true}}}}},orderBy:{key:'asc'}}),
    db.tournamentFixture.findMany({where:{tournamentId:event.id},orderBy:[{week:'asc'},{code:'asc'}]}),
    db.tournamentReport.findMany({where:{tournamentId:event.id,...(!actor.admin?{status:'APPROVED'}:{})},select:{id:true,fixtureId:true,gameNumber:true,status:true,source:true,platform:true,leagueGameId:true,payload:true,createdAt:true,reviewedAt:true,reviewNote:true,replacesId:true},orderBy:{createdAt:'desc'}}),
    db.tournamentRegistration.findMany({where:{tournamentId:event.id,pool:'FLOATER'},select:{profileId:true,displayNameSnapshot:true,primaryRoleSnapshot:true}}),
  ]);
  if (teams.length !== 5 || fixtures.length < 10) throw new TournamentError("Tournament match setup is being prepared.",503);
  const approved = reports.filter(r=>r.status==='APPROVED');
  const tables = calculateTables(teams,fixtures,approved);
  return {event:{id:event.id,name:event.name,timezone:'Asia/Shanghai'},
    teams:teams.map(t=>({id:t.id,key:t.key,name:t.name,tag:t.tag,logo:t.logo,accent:t.accent,captainProfileId:t.captainProfileId,members:t.members.map(m=>({profileId:m.profileId,name:m.registration.displayNameSnapshot,role:m.registration.primaryRoleSnapshot,riotId:`${m.profile.riotName}#${m.profile.riotTag.replace(/^#+/,'')}`,pot:m.pot,captain:m.profileId===t.captainProfileId}))})),
    fixtures:fixtures.map(f=>{const s=f.schedule as unknown as Schedule|null;return {id:f.id,code:f.code,stage:f.stage,week:f.week,bestOf:f.bestOf,homeTeamId:f.homeTeamId,awayTeamId:f.awayTeamId,revision:f.revision,schedule:s?{state:s.state,at:s.at,byTeam:s.byTeam,revision:s.revision}:null,
      homeScore:approved.filter(r=>r.fixtureId===f.id&&(r.payload as unknown as MatchPayload).winnerTeamId===f.homeTeamId).length,
      awayScore:approved.filter(r=>r.fixtureId===f.id&&(r.payload as unknown as MatchPayload).winnerTeamId===f.awayTeamId).length};}),
    reports:reports.map(({reviewNote,...r})=>({...r,...(actor.admin?{reviewNote}:{})})), ...tables,
    ...(actor.admin?{floaters:floaters.map(f=>({profileId:f.profileId,name:f.displayNameSnapshot,role:f.primaryRoleSnapshot})),notifications:await db.tournamentNotification.findMany({where:{tournamentId:event.id,status:{not:'SENT'}},select:{id:true,status:true,attempts:true,nextAttemptAt:true},orderBy:{createdAt:'asc'},take:50})}:{}),
    viewer:{admin:actor.admin,profileId:actor.profileId??null,captainTeamIds:teams.filter(t=>t.captainProfileId===actor.profileId).map(t=>t.id)},
  };
}

async function notify(tx: Tx,eventId:string,key:string,channelId:string|undefined,content:string) {
  const channel = channelId || process.env.KOOK_SPLIT_II_CHANNEL_ID;
  if (!channel || !/^\d{1,30}$/.test(channel)) return false;
  await tx.tournamentNotification.upsert({where:{dedupeKey:key},create:{tournamentId:eventId,dedupeKey:key,channelId:channel,content},update:{}});
  return true;
}
export async function scheduleFixture(db: PrismaClient, actor:TournamentActor, input:{action:string;fixtureId:string;revision:number;at?:unknown;channelId?:string}) {
  if (!actor.profileId && !actor.admin) throw new TournamentError("Sign in with your verified captain account.",401);
  return db.$transaction(async tx=>{
    const eventId=await eventLock(tx);
    const fixture=await tx.tournamentFixture.findFirst({where:{id:input.fixtureId,tournamentId:eventId},include:{homeTeam:true,awayTeam:true}});
    if(!fixture)throw new TournamentError("Fixture not found.",404);
    if(fixture.revision!==integer(input.revision,0,100000))throw new TournamentError("The fixture changed. Refresh before continuing.",409);
    if(await tx.tournamentReport.count({where:{fixtureId:fixture.id,status:'APPROVED'}}))throw new TournamentError("An approved game already exists for this fixture.",409);
    const team=[fixture.homeTeam,fixture.awayTeam].find(t=>t.captainProfileId===actor.profileId);
    if(!actor.admin&&!team)throw new TournamentError("Only a captain of these teams can schedule this fixture.",403);
    const old=fixture.schedule as unknown as Schedule|null;
    let schedule:Schedule|null;
    const revision=fixture.revision+1;
    if(input.action==='propose'){
      const at=instant(input.at);
      if(Date.parse(at)<Date.now()-300000||Date.parse(at)>Date.now()+120*86400000)throw new TournamentError("Choose a future match time within 120 days.");
      schedule={state:actor.admin?'CONFIRMED':'PROPOSED',at,byTeam:team?.id??fixture.homeTeamId,revision,actor:actor.profileId??'ADMIN',...(input.channelId&&/^\d{1,30}$/.test(input.channelId)?{channelId:input.channelId}:old?.channelId?{channelId:old.channelId}:{})};
    }else if(input.action==='confirm'){
      if(old?.state!=='PROPOSED')throw new TournamentError("There is no pending proposal.",409);
      if(!actor.admin&&team?.id===old.byTeam)throw new TournamentError("The opposing captain must confirm the proposal.",403);
      schedule={...old,state:'CONFIRMED',revision};
    }else if(input.action==='cancel'){
      if(!actor.admin&&old?.byTeam!==team?.id)throw new TournamentError("Only the proposing captain or an admin can cancel this proposal.",403);
      if(!actor.admin&&old?.state==='CONFIRMED')throw new TournamentError("Ask an admin to cancel a confirmed schedule, or propose a new time.",403);
      schedule=null;
    }else throw new TournamentError("Unknown scheduling action.");
    await tx.tournamentFixture.update({where:{id:fixture.id},data:{revision,schedule:schedule?json(schedule):Prisma.DbNull}});
    const when=schedule?new Date(schedule.at).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',hour12:false}):'Unscheduled';
    if(schedule?.state==='CONFIRMED')await notify(tx,eventId,`schedule:${fixture.id}:${revision}`,schedule.channelId,`ECL Split II / ${fixture.code}\n${fixture.homeTeam.name} vs ${fixture.awayTeam.name}\nConfirmed: ${when} China time\nBo${fixture.bestOf}\nhttps://eclchina.lol/hub/split-ii`);
    return {fixture:fixture.code,revision,schedule:schedule?{state:schedule.state,at:schedule.at,byTeam:schedule.byTeam,revision}:null};
  },{maxWait:10000,timeout:15000});
}

export async function normalizedReport(tx:Tx,eventId:string,input:ReturnType<typeof parseReport>) {
  const fixture=await tx.tournamentFixture.findFirst({where:{id:input.fixtureId,tournamentId:eventId}});
  if(!fixture)throw new TournamentError("Fixture not found.",404);
  if(input.gameNumber>fixture.bestOf)throw new TournamentError("Game number exceeds the series format.");
  const ids=[fixture.homeTeamId,fixture.awayTeamId];
  if(!ids.includes(input.payload.winnerTeamId)||ids.some(id=>input.payload.players.filter(p=>p.teamId===id).length!==5))throw new TournamentError("Each fixture team must have exactly five players.");
  if(Date.parse(input.payload.playedAt)>Date.now()+300000)throw new TournamentError("A completed game cannot be dated in the future.");
  const registrations=await tx.tournamentRegistration.findMany({where:{tournamentId:eventId,profileId:{in:input.payload.players.map(p=>p.profileId)}},include:{profile:{select:{riotName:true,riotTag:true,chinaServerId:true}},memberships:{where:{tournamentId:eventId}}}});
  for(const player of input.payload.players){
    const r=registrations.find(r=>r.profileId===player.profileId);
    if(!r||(r.pool!=='FLOATER'&&!r.memberships.some(m=>m.teamId===player.teamId)))throw new TournamentError("A lineup contains an unregistered player or a player from another team.");
    if(r.profile.chinaServerId!==1||input.platform!=='HN1')throw new TournamentError("Split II reporting currently requires the registered Ionia accounts.");
    player.name=r.displayNameSnapshot;player.riotId=`${r.profile.riotName}#${r.profile.riotTag.replace(/^#+/,'')}`;
  }
  return fixture;
}
export async function submitTournamentReport(db:PrismaClient,actor:TournamentActor,value:unknown) {
  const input=parseReport(value);
  if(!actor.admin&&input.source!=='HUB')throw new TournamentError("Manual reports require admin access.",403);
  if(!actor.admin&&!input.payload.players.some(p=>p.profileId===actor.profileId))throw new TournamentError("The reporting account must have played this game.",403);
  if(input.source==='HUB'&&!input.leagueGameId)throw new TournamentError("Hub reports require the exact League Game ID.");
  return db.$transaction(async tx=>{
    const eventId=await eventLock(tx);
    await normalizedReport(tx,eventId,input);
    if(!actor.admin)throw new TournamentError("Use the validated tournament collection endpoint for Hub uploads.",403);
    if(input.replacesId&&!await tx.tournamentReport.findFirst({where:{id:input.replacesId,tournamentId:eventId,fixtureId:input.fixtureId,gameNumber:input.gameNumber,status:'APPROVED'}}))throw new TournamentError("The result being corrected is no longer current.",409);
    const prior=await tx.tournamentReport.findFirst({where:{fixtureId:input.fixtureId,gameNumber:input.gameNumber,status:'PENDING',payload:{equals:json(input.payload)},leagueGameId:input.leagueGameId,replacesId:input.replacesId??null,source:input.source}});
    if(prior)return {id:prior.id,status:prior.status,duplicate:true};
    const report=await tx.tournamentReport.create({data:{tournamentId:eventId,fixtureId:input.fixtureId,gameNumber:input.gameNumber,source:input.source,submittedBy:actor.profileId??'ADMIN',platform:input.platform,leagueGameId:input.leagueGameId,payload:json(input.payload),...(input.raw!==undefined?{raw:json(input.raw)}:{}),...(input.evidence?{evidence:json(input.evidence)}:{}),replacesId:input.replacesId??null}});
    return {id:report.id,status:report.status,duplicate:false};
  },{maxWait:10000,timeout:20000});
}

export async function reviewTournamentReport(db:PrismaClient,reportId:string,decision:'approve'|'reject',reason:string,mvpProfileId?:string) {
  const note=text(reason,2000);
  if(!note)throw new TournamentError("Record a review note before approving or rejecting.");
  return db.$transaction(async tx=>{
    const eventId=await eventLock(tx);
    const report=await tx.tournamentReport.findFirst({where:{id:reportId,tournamentId:eventId},include:{fixture:{include:{homeTeam:true,awayTeam:true}}}});
    if(!report)throw new TournamentError("Report not found.",404);
    if(report.status===(decision==='approve'?'APPROVED':'REJECTED'))return {id:report.id,status:report.status,duplicate:true};
    if(report.status!=='PENDING')throw new TournamentError("This report is no longer awaiting review.",409);
    if(decision==='reject')return tx.tournamentReport.update({where:{id:report.id},data:{status:'REJECTED',reviewNote:note,reviewedAt:new Date()},select:{id:true,status:true}});
    const input=parseReport({fixtureId:report.fixtureId,gameNumber:report.gameNumber,platform:report.platform,leagueGameId:report.leagueGameId,source:report.source,payload:report.payload});
    if(mvpProfileId!==undefined){
      if(mvpProfileId&&!input.payload.players.some(p=>p.profileId===mvpProfileId&&p.teamId===input.payload.winnerTeamId))throw new TournamentError('Select an MVP from the winning lineup.');
      for(const p of input.payload.players)p.mvp=p.profileId===mvpProfileId;
    }
    await normalizedReport(tx,eventId,input);
    if(report.leagueGameId){
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${report.platform+':'+report.leagueGameId},0))::text`;
      const variants:Prisma.InputJsonValue[]=[report.leagueGameId];
      if(Number.isSafeInteger(Number(report.leagueGameId)))variants.push(Number(report.leagueGameId));
      const legacy=await tx.inhouseReportJob.findFirst({where:{status:{notIn:['CANCELLED','FAILED','DESKTOP_CANCELLED','DESKTOP_EXPIRED','DESKTOP_REJECTED']},OR:variants.flatMap(id=>[{rawMatchData:{path:['gameId'],equals:id}},{rawMatchData:{path:['raw','gameId'],equals:id}}])},select:{id:true}});
      const legacyGame=await tx.matchGame.findFirst({where:{OR:variants.flatMap(id=>[{ocrRawJson:{path:['gameId'],equals:id}},{ocrRawJson:{path:['raw','gameId'],equals:id}}])},select:{id:true}});
      const legacySession=await tx.inhouseSession.findFirst({where:{lzyumiGameId:report.leagueGameId},select:{id:true}});
      if(legacy||legacyGame||legacySession)throw new TournamentError("This League game is already in an inhouse/legacy report. Resolve that assignment first.",409);
      if(await tx.tournamentReport.findFirst({where:{platform:report.platform,leagueGameId:report.leagueGameId,status:'APPROVED',...(report.replacesId?{id:{not:report.replacesId}}:{})},select:{id:true}}))throw new TournamentError("This League game already has an approved tournament result.",409);
    }
    const approved=await tx.tournamentReport.findMany({where:{fixtureId:report.fixtureId,status:'APPROVED'}});
    if(approved.some(r=>r.gameNumber===report.gameNumber&&r.id!==report.replacesId))throw new TournamentError("This fixture game already has a result. Submit a correction instead.",409);
    if(report.replacesId){
      const replaced=approved.find(r=>r.id===report.replacesId);
      if(!replaced||replaced.gameNumber!==report.gameNumber)throw new TournamentError("The result changed before this correction was approved.",409);
      await tx.tournamentFloaterAppearance.deleteMany({where:{reportId:replaced.id}});
      await tx.tournamentReport.update({where:{id:replaced.id},data:{status:'REPLACED'}});
    }
    const previous=approved.filter(r=>r.id!==report.replacesId);
    const series=[...previous.map(r=>({number:r.gameNumber,payload:r.payload as unknown as MatchPayload})),{number:report.gameNumber,payload:input.payload}].sort((a,b)=>a.number-b.number);
    const score=new Map<string,number>();
    for(const [index,game] of series.entries()){
      if(game.number!==index+1)throw new TournamentError('Approve earlier games in the series first.',409);
      if([...score.values()].some(n=>n>=Math.ceil(report.fixture.bestOf/2)))throw new TournamentError('This series had already ended before that game. Review the earlier results.',409);
      score.set(game.payload.winnerTeamId,(score.get(game.payload.winnerTeamId)??0)+1);
    }
    const others=previous.map(r=>r.payload as unknown as MatchPayload);
    const wins=(id:string)=>[...others,input.payload].filter(p=>p.winnerTeamId===id).length;
    const needed=Math.ceil(report.fixture.bestOf/2);
    if([report.fixture.homeTeamId,report.fixture.awayTeamId].some(id=>wins(id)>needed)||others.length+1>report.fixture.bestOf)throw new TournamentError("The report would exceed the series format.",409);
    const floaters=await tx.tournamentRegistration.findMany({where:{tournamentId:eventId,pool:'FLOATER',profileId:{in:input.payload.players.map(p=>p.profileId)}},select:{profileId:true}});
    const floaterIds=new Set(floaters.map(f=>f.profileId));
    for(const p of input.payload.players.filter(p=>floaterIds.has(p.profileId))){
      if(await tx.tournamentFloaterAppearance.findUnique({where:{tournamentId_teamId_profileId:{tournamentId:eventId,teamId:p.teamId,profileId:p.profileId}}}))throw new TournamentError(`${p.name} has already played a tournament game for that team.`,409);
    }
    await tx.tournamentReport.update({where:{id:report.id},data:{status:'APPROVED',payload:json(input.payload),reviewNote:note,reviewedAt:new Date()}});
    for(const p of input.payload.players.filter(p=>floaterIds.has(p.profileId)))await tx.tournamentFloaterAppearance.create({data:{tournamentId:eventId,teamId:p.teamId,profileId:p.profileId,reportId:report.id}});
    const home=wins(report.fixture.homeTeamId),away=wins(report.fixture.awayTeamId);
    const schedule=report.fixture.schedule as unknown as Schedule|null;
    const notified=await notify(tx,eventId,`result:${report.id}`,schedule?.channelId,`ECL Split II / ${report.fixture.code}${report.replacesId?' / CORRECTED RESULT':''}\n${report.fixture.homeTeam.name} ${home}–${away} ${report.fixture.awayTeam.name}\nGame ${report.gameNumber}: ${input.payload.durationSeconds}s\nhttps://eclchina.lol/hub/split-ii`);
    return {id:report.id,status:'APPROVED',notificationQueued:notified,lpApplied:false};
  },{maxWait:10000,timeout:30000});
}
