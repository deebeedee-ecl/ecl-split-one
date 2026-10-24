import type { PrismaClient } from "@prisma/client";
import { randomUUID } from 'node:crypto';
export async function claimTournamentNotification(db:PrismaClient){
  await db.tournamentNotification.updateMany({where:{status:'SENDING',nextAttemptAt:{lt:new Date()}},data:{status:'UNKNOWN'}});
  const row=await db.tournamentNotification.findFirst({where:{status:'PENDING',nextAttemptAt:{lte:new Date()},attempts:{lt:8}},orderBy:{createdAt:'asc'}});
  if(!row)return null;
  const deliveryKey=randomUUID();
  const claimed=await db.tournamentNotification.updateMany({where:{id:row.id,status:'PENDING',attempts:row.attempts},data:{status:'SENDING',deliveryKey,attempts:{increment:1},nextAttemptAt:new Date(Date.now()+120000)}});
  return claimed.count?{id:row.id,channelId:row.channelId,content:row.content,deliveryKey}:null;
}
export async function finishTournamentNotification(db:PrismaClient,id:string,key:string,sent:boolean){
  const result=await db.tournamentNotification.updateMany({where:{id,deliveryKey:key,status:'SENDING'},data:{status:sent?'SENT':'UNKNOWN'}});
  return {recorded:result.count===1};
}
export async function deliverTournamentNotifications(db:PrismaClient,transport:typeof fetch=fetch) {
  const token=process.env.KOOK_BOT_TOKEN?.trim();
  if(!token)return {sent:0,configured:false};
  await db.tournamentNotification.updateMany({where:{status:'SENDING',nextAttemptAt:{lt:new Date()}},data:{status:'UNKNOWN'}});
  let sent=0;
  for(let i=0;i<2;i++){
    const row=await db.tournamentNotification.findFirst({where:{status:'PENDING',nextAttemptAt:{lte:new Date()},attempts:{lt:8}},orderBy:{createdAt:'asc'}});
    if(!row)break;
    const claim=await db.tournamentNotification.updateMany({where:{id:row.id,status:'PENDING',attempts:row.attempts},data:{status:'SENDING',attempts:{increment:1},nextAttemptAt:new Date(Date.now()+120000)}});
    if(!claim.count)continue;
    try{
      const response=await transport('https://www.kookapp.cn/api/v3/message/create',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify({type:1,target_id:row.channelId,content:row.content})});
      const payload=await response.json().catch(()=>null);
      if(response.ok&&payload?.code===0){await db.tournamentNotification.update({where:{id:row.id},data:{status:'SENT'}});sent++;}
      else await db.tournamentNotification.update({where:{id:row.id},data:{status:row.attempts>=7||[401,403,404].includes(response.status)?'FAILED':'PENDING',nextAttemptAt:new Date(Date.now()+Math.min(3600000,60000*2**row.attempts))}});
    }catch{
      // A timeout can occur after KOOK accepted a message. Do not resend blindly.
      await db.tournamentNotification.updateMany({where:{id:row.id,status:'SENDING'},data:{status:'UNKNOWN'}});
    }
  }
  return {sent,configured:true};
}
