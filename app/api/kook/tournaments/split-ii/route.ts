import { prisma } from "@/lib/prisma";
import { tournamentBot,tournamentBody,tournamentFailure,tournamentJson,tournamentKookUser } from "@/lib/tournaments/http";
import { object,text,integer,TournamentError } from "@/lib/tournaments/match-policy";
import { tournamentView,scheduleFixture } from "@/lib/tournaments/matches";
import { queueTournamentCollection } from '@/lib/tournaments/collection';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const help=['ECL Split II','!split2 fixtures — ten round-robin fixtures','!split2 schedule RR01 2026-10-26 20:00 — propose China time','!split2 confirm RR01 REVISION — opposing captain confirms','!split2 cancel RR01 REVISION — cancel a proposal','!split2 report RR01 GAME_ID — tournament collection instructions','Captains schedule their own fixtures; admins can override. Tournament results never award inhouse LP.'].join('\n');
export async function POST(request:Request){
  try{
    tournamentBot(request);const b=object(await tournamentBody(request));
    const command=text(b.command??'',300).replace(/^!split2\s*/i,'').trim().split(/\s+/);
    const action=command[0]?.toLowerCase();
    if(action==='health'){
      if(b.isAdmin!==true)throw new TournamentError('Administrator access required.',403);
      return tournamentJson({adminConfigured:Boolean(process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD),botConfigured:Boolean(process.env.ECL_KOOK_BOT_SECRET),workflow:'split-ii-v1'});
    }
    if(!action||action==='help')return tournamentJson({reply:help});
    const view=await tournamentView(prisma),team=(id:string)=>view.teams.find(t=>t.id===id)?.name??id;
    if(action==='fixtures')return tournamentJson({reply:['ECL Split II / Fixtures',...view.fixtures.map(f=>`${f.code} / Week ${f.week}: ${team(f.homeTeamId)} vs ${team(f.awayTeamId)}${f.schedule?` / ${new Date(f.schedule.at).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',hour12:false})} China / ${f.schedule.state}`:' / Time TBC'}`)].join('\n')});
    const actor=await tournamentKookUser(text(b.kookUserId,30),b.isAdmin===true);
    const fixture=view.fixtures.find(f=>f.code===command[1]?.toUpperCase());
    if(!fixture)throw new TournamentError('Choose a fixture code from !split2 fixtures.');
    if(action==='report'){
      const job=await queueTournamentCollection(prisma,actor,fixture.id,text(command[2]??'',20),command[3]?integer(Number(command[3]),1,5):1);
      return tournamentJson({reply:`${fixture.code} / Game ${job.gameNumber} / League #${job.leagueGameId}\n${job.status==='UPLOADED'?'Already uploaded for review.':'Collection queued for your ECL account. Open the desktop Hub Split II tab and connect tournament reporting.'}\nIf history is unavailable, an admin can enter the result at https://eclchina.lol/admin/split-ii\nTournament reports require admin approval and never award inhouse LP.`});
    }
    if(!['schedule','confirm','cancel'].includes(action))throw new TournamentError(help);
    const result=await scheduleFixture(prisma,actor,{action:action==='schedule'?'propose':action,fixtureId:fixture.id,revision:action==='schedule'?fixture.revision:integer(Number(command[2]),0,100000),...(action==='schedule'?{at:`${command[2]}T${command[3]}:00+08:00`}:{}),channelId:text(b.channelId??'',30)});
    return tournamentJson({reply:result.schedule?.state==='PROPOSED'?`${fixture.code}: ${team(fixture.homeTeamId)} vs ${team(fixture.awayTeamId)}\nProposed: ${new Date(result.schedule.at).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',hour12:false})} China time\nOpposing captain: !split2 confirm ${fixture.code} ${result.revision}`:`${fixture.code}: ${result.schedule?.state==='CONFIRMED'?'Schedule confirmed.':'Schedule cleared.'}\nhttps://eclchina.lol/hub/split-ii`});
  }catch(e){return tournamentFailure(e);}
}
