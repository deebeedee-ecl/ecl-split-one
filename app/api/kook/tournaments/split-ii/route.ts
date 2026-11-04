import { prisma } from "@/lib/prisma";
import { tournamentBot,tournamentBody,tournamentFailure,tournamentJson,tournamentKookUser } from "@/lib/tournaments/http";
import { object,text,integer,TournamentError } from "@/lib/tournaments/match-policy";
import { tournamentView,scheduleFixture } from "@/lib/tournaments/matches";
import { queueTournamentCollection } from '@/lib/tournaments/collection';
import { splitTwoHelp,splitTwoReportHelp,splitTwoReadReply,fixtureFinished,completedFixtureReply } from '@/lib/tournaments/kook-copy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    tournamentBot(request);const b=object(await tournamentBody(request));
    const command=text(b.command??'',300).replace(/^!split2\s*/i,'').trim().split(/\s+/);
    const action=command[0]?.toLowerCase();
    if(action==='health'){
      if(b.isAdmin!==true)throw new TournamentError('Administrator access required.',403);
      return tournamentJson({adminConfigured:Boolean(process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD),botConfigured:Boolean(process.env.ECL_KOOK_BOT_SECRET),workflow:'split-ii-v1'});
    }
    if(!action||action==='help')return tournamentJson({reply:splitTwoHelp});
    if(action==='report'&&(!command[1]||command[1].toLowerCase()==='help'))return tournamentJson({reply:splitTwoReportHelp()});
    if(!['fixtures','remaining','standings','table','results','report','schedule','confirm','cancel'].includes(action))throw new TournamentError(splitTwoHelp);
    const view=await tournamentView(prisma),team=(id:string)=>view.teams.find(t=>t.id===id)?.name??id;
    const readReply=splitTwoReadReply(action,command.slice(1),view);
    if(readReply!==null)return tournamentJson({reply:readReply});
    const fixture=view.fixtures.find(f=>f.code===command[1]?.toUpperCase());
    if(!fixture)throw new TournamentError('Choose a fixture code from !split2 fixtures.');
    if(action==='report'&&fixtureFinished(fixture))return tournamentJson({reply:completedFixtureReply(fixture,view)});
    if(action==='report'&&!command[2])return tournamentJson({reply:splitTwoReportHelp(fixture.code)});
    const actor=await tournamentKookUser(text(b.kookUserId,30),b.isAdmin===true);
    if(action==='report'){
      const gameNumber=command[3]?integer(Number(command[3]),1,5):1;
      if(view.reports.some(r=>r.fixtureId===fixture.id&&r.gameNumber===gameNumber))return tournamentJson({reply:`${fixture.code} / Game ${gameNumber} is already published. Ask an admin for a correction if needed.\nhttps://eclchina.lol/hub/split-ii`});
      const member=view.teams.filter(t=>[fixture.homeTeamId,fixture.awayTeamId].includes(t.id)).some(t=>t.members.some(m=>m.profileId===actor.profileId));
      const floater=actor.admin&&!member&&actor.profileId?await prisma.tournamentRegistration.findFirst({where:{tournamentId:view.event.id,profileId:actor.profileId,pool:'FLOATER'},select:{id:true}}):null;
      if(actor.admin&&!member&&!floater)return tournamentJson({reply:`${fixture.code}: ${team(fixture.homeTeamId)} vs ${team(fixture.awayTeamId)}\nYou can report this as an admin without having played. Import the match data or enter a manual report at:\nhttps://eclchina.lol/admin/split-ii\nPlayer collection requests must come from an account in the actual game.\nA report still needs approval before results and standings change.`});
      const job=await queueTournamentCollection(prisma,actor,fixture.id,text(command[2]??'',20),gameNumber);
      return tournamentJson({reply:`${fixture.code} / Game ${job.gameNumber} / League #${job.leagueGameId}\n${job.status==='UPLOADED'?'Already uploaded for review.':'Collection queued for your ECL account. Open the desktop Hub Split II tab and connect tournament reporting.'}\nIf your client cannot retrieve it, ask an admin to import the match data at https://eclchina.lol/admin/split-ii\nSaved reports need admin approval before results and standings change. Tournament games never award inhouse LP.`});
    }
    const result=await scheduleFixture(prisma,actor,{action:action==='schedule'?'propose':action,fixtureId:fixture.id,revision:action==='schedule'?fixture.revision:integer(Number(command[2]),0,100000),...(action==='schedule'?{at:`${command[2]}T${command[3]}:00+08:00`}:{}),channelId:text(b.channelId??'',30)});
    return tournamentJson({reply:result.schedule?.state==='PROPOSED'?`${fixture.code}: ${team(fixture.homeTeamId)} vs ${team(fixture.awayTeamId)}\nProposed: ${new Date(result.schedule.at).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',hour12:false})} China time\nOpposing captain: !split2 confirm ${fixture.code} ${result.revision}`:`${fixture.code}: ${result.schedule?.state==='CONFIRMED'?'Schedule confirmed.':'Schedule cleared.'}\nhttps://eclchina.lol/hub/split-ii`});
  }catch(e){return tournamentFailure(e);}
}
