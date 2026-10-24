import { prisma } from "@/lib/prisma";
import { tournamentView, scheduleFixture } from "@/lib/tournaments/matches";
import { object, text, integer } from "@/lib/tournaments/match-policy";
import { tournamentBody,tournamentFailure,tournamentJson,tournamentUser } from "@/lib/tournaments/http";
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{return tournamentJson(await tournamentView(prisma,request.headers.has('authorization')?await tournamentUser(request):{admin:false}));}catch(e){return tournamentFailure(e);}
}
export async function POST(request:Request){
  try{
    const actor=await tournamentUser(request),b=object(await tournamentBody(request));
    return tournamentJson(await scheduleFixture(prisma,actor,{action:text(b.action,20),fixtureId:text(b.fixtureId,150),revision:integer(b.revision,0,100000),at:b.at}));
  }catch(e){return tournamentFailure(e);}
}
