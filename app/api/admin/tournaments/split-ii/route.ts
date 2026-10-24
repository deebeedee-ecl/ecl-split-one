import { prisma } from "@/lib/prisma";
import { scheduleFixture, submitTournamentReport, reviewTournamentReport, tournamentView } from "@/lib/tournaments/matches";
import { object,text,integer,TournamentError } from "@/lib/tournaments/match-policy";
import { tournamentAdmin,tournamentBody,tournamentJson,tournamentFailure } from "@/lib/tournaments/http";
import { importTournamentLcu } from '@/lib/tournaments/collection';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const actor=tournamentAdmin(request),reportId=new URL(request.url).searchParams.get('reportId');
    if(reportId){
      const report=await prisma.tournamentReport.findFirst({where:{id:text(reportId,100),fixture:{homeTeam:{tournament:{slug:'ecl-split-ii-2026'}}}}});
      if(!report)throw new TournamentError('Report not found.',404);
      return tournamentJson({report});
    }
    return tournamentJson(await tournamentView(prisma,actor));
  }catch(e){return tournamentFailure(e);}
}
export async function POST(request:Request){
  try{
    const actor=tournamentAdmin(request),b=object(await tournamentBody(request,true));
    if(b.action==='submit')return tournamentJson(await submitTournamentReport(prisma,actor,b.report),201);
    if(b.action==='importLcu')return tournamentJson(await importTournamentLcu(prisma,actor,text(b.fixtureId,150),integer(b.gameNumber,1,5),b.raw,b.replacesId?text(b.replacesId,100):undefined),201);
    if(b.action==='retryNotification'){
      const result=await prisma.tournamentNotification.updateMany({where:{id:text(b.id,100),tournament:{slug:'ecl-split-ii-2026'},status:{in:['UNKNOWN','FAILED']}},data:{status:'PENDING',attempts:0,nextAttemptAt:new Date()}});
      return tournamentJson({queued:result.count===1});
    }
    if(b.action==='review'){
      if(b.decision!=='approve'&&b.decision!=='reject')throw new TournamentError('Choose approve or reject.');
      return tournamentJson(await reviewTournamentReport(prisma,text(b.reportId,100),b.decision,text(b.reason,2000),b.mvpProfileId===undefined?undefined:text(b.mvpProfileId,100)));
    }
    if(b.action==='schedule')return tournamentJson(await scheduleFixture(prisma,actor,{action:text(b.scheduleAction,20),fixtureId:text(b.fixtureId,150),revision:integer(b.revision,0,100000),at:b.at,channelId:b.channelId?text(b.channelId,30):undefined}));
    throw new TournamentError('Unknown tournament action.');
  }catch(e){return tournamentFailure(e);}
}
