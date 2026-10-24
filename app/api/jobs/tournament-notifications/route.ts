import { prisma } from "@/lib/prisma";
import { tournamentBot,tournamentBody,tournamentFailure,tournamentJson } from "@/lib/tournaments/http";
import { claimTournamentNotification,finishTournamentNotification } from "@/lib/tournaments/notifications";
import { object,text,TournamentError } from '@/lib/tournaments/match-policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    tournamentBot(request);const b=object(await tournamentBody(request));
    if(b.action==='claim')return tournamentJson({notice:await claimTournamentNotification(prisma)});
    if(b.action==='finish')return tournamentJson(await finishTournamentNotification(prisma,text(b.id,100),text(b.deliveryKey,100),b.sent===true));
    throw new TournamentError('Unknown notification action.');
  }catch(e){return tournamentFailure(e);}
}
