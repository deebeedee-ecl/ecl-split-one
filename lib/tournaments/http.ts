import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { TournamentError } from "./match-policy";
import type { TournamentActor } from "./matches";

function equal(a:string,b:string) { const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y); }
export function tournamentAdmin(request:Request):TournamentActor {
  const expected=process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD;
  if(!expected)throw new TournamentError("Admin authentication is not configured.",503);
  const match=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('ecl_admin_session='));
  let value='';try{value=decodeURIComponent(match?.slice('ecl_admin_session='.length)||'');}catch{}
  if(!equal(value,expected))throw new TournamentError("Admin access required.",401);
  return {admin:true};
}
export function tournamentBot(request:Request) {
  const expected=process.env.ECL_KOOK_BOT_SECRET;
  if(!expected||!equal(request.headers.get('x-ecl-kook-secret')||'',expected))throw new TournamentError("Unauthorized bot request.",401);
}
export async function tournamentUser(request:Request):Promise<TournamentActor> {
  const user=await getAccountFromRequest(request);
  if(!user)throw new TournamentError("Sign in to your ECL account.",401);
  const profile=await prisma.accountProfile.findUnique({where:{userId:user.id},select:{id:true,verificationStatus:true,accountStatus:true}});
  if(!profile||profile.verificationStatus!=='VERIFIED'||profile.accountStatus!=='ACTIVE')throw new TournamentError("An active, verified ECL profile is required.",403);
  return {profileId:profile.id,admin:false};
}
export async function tournamentKookUser(userId:string,admin=false):Promise<TournamentActor> {
  if(!/^\d{1,30}$/.test(userId))throw new TournamentError("A verified KOOK user is required.",401);
  const profiles=await prisma.accountProfile.findMany({where:{verificationStatus:'VERIFIED',accountStatus:'ACTIVE',OR:[{kookId:userId},{AND:[{OR:[{kookId:null},{kookId:''}]},{kookVerifications:{some:{kookUserId:userId,status:'CONFIRMED'}}}]}]},select:{id:true},take:2});
  if(profiles.length!==1&&!admin)throw new TournamentError("Link your KOOK account to one active, verified ECL profile first.",403);
  return {profileId:profiles.length===1?profiles[0].id:undefined,admin};
}
export async function tournamentBody(request:Request,admin=false) {
  if(admin&&request.headers.get('origin')!==new URL(request.url).origin)throw new TournamentError("Use the tournament admin page for this action.",403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new TournamentError("Expected JSON.",415);
  if(Number(request.headers.get('content-length')||0)>3_000_000)throw new TournamentError("Report exceeds the 3 MB request limit.",413);
  const body=await request.text();
  if(Buffer.byteLength(body)>3_000_000)throw new TournamentError("Report exceeds the 3 MB request limit.",413);
  try{return JSON.parse(body) as unknown;}catch{throw new TournamentError("Invalid JSON.");}
}
export const tournamentJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export function tournamentFailure(error:unknown) {
  if(error instanceof TournamentError)return tournamentJson({message:error.message},error.status);
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return tournamentJson({message:'This game or appearance is already recorded. Refresh and review the existing record.'},409);
  console.warn('Tournament workflow unavailable',error instanceof Prisma.PrismaClientKnownRequestError?error.code:'server-error');
  return tournamentJson({message:'Tournament data is temporarily unavailable. Saved records have not been cleared.'},503);
}
