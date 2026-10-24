import { prisma } from '@/lib/prisma';
import { tournamentUser,tournamentBody,tournamentJson,tournamentFailure } from '@/lib/tournaments/http';
import { object,text,TournamentError } from '@/lib/tournaments/match-policy';
import { tournamentCollectionJobs,uploadTournamentCollection } from '@/lib/tournaments/collection';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return tournamentJson({jobs:await tournamentCollectionJobs(prisma,await tournamentUser(request))});}catch(e){return tournamentFailure(e);}}
export async function POST(request:Request){try{
  const actor=await tournamentUser(request),b=object(await tournamentBody(request));
  if(b.action==='submit')return tournamentJson(await uploadTournamentCollection(prisma,actor,b),201);
  if(b.action==='cancel'){
    await prisma.tournamentCollectionJob.updateMany({where:{id:text(b.jobId,100),profileId:actor.profileId,status:'PENDING'},data:{status:'CANCELLED'}});
    return tournamentJson({cancelled:true});
  }
  throw new TournamentError('Unknown collection action.');
}catch(e){return tournamentFailure(e);}}
