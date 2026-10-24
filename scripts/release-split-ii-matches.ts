// Read-only unless apply --apply is explicitly supplied. Never loads test data.
import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedMatchWorkflow,tournamentView } from '../lib/tournaments/matches';
const require=createRequire(path.resolve('.tmp/tournament-test-tools/package.json'));
async function main(){
  const action=process.argv[2]??'check';if(!['check','apply'].includes(action)||action==='apply'&&!process.argv.includes('--apply'))throw new Error('Use check or apply --apply.');
  loadEnvConfig(process.cwd(),false);if(!process.env.DATABASE_URL)throw new Error('Database is not configured.');
  const target=new URL(process.env.DATABASE_URL);if(target.searchParams.has('schema')&&target.searchParams.get('schema')!=='public')throw new Error('Expected the existing public schema.');
  for(const key of ['schema','pgbouncer','connection_limit','pool_timeout'])target.searchParams.delete(key);
  const {Client}=require('pg');const connection=new Client({connectionString:target.href,connectionTimeoutMillis:20000,statement_timeout:30000});const db=new PrismaClient({log:[]});
  try{
    await connection.connect();
    const event=await db.tournament.findUniqueOrThrow({where:{slug:'ecl-split-ii-2026'},select:{id:true,capacity:true,_count:{select:{registrations:true}}}});
    const registrations=await db.tournamentRegistration.groupBy({by:['pool'],where:{tournamentId:event.id},_count:true});
    const existing=(await connection.query("SELECT to_regclass('public.tournament_teams') IS NOT NULL AS ready")).rows[0].ready;
    console.log(JSON.stringify({action,foundationExists:existing,capacity:event.capacity,pools:registrations.map(r=>({pool:r.pool,count:r._count}))}));
    if(registrations.find(r=>r.pool==='MAIN')?._count!==25)throw new Error('Expected exactly 25 existing main registrations.');
    if(action==='check'){if(existing){const view=await tournamentView(db);console.log(JSON.stringify({teams:view.teams.length,fixtures:view.fixtures.length,approvedResults:view.reports.length}));}return;}
    if(existing){console.log(JSON.stringify(await seedMatchWorkflow(db)));return;}
    const tables=['Player','Match','MatchGame','MatchGamePlayerStat','InhouseSession','InhouseSessionPlayer','InhouseReportJob','AccountProfile','tournaments','tournament_registrations'];
    const fingerprints=async()=>{
      const result:Record<string,{count:string;hash:string}>={};
      for(const table of tables)result[table]=(await connection.query(`SELECT count(*)::text AS count,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS hash FROM public."${table}" t`)).rows[0];
      return result;
    };
    const before=await fingerprints();
    await connection.query('BEGIN');
    try{
      await connection.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='60s'");
      await connection.query(await readFile('docs/database/tournaments/add-match-workflow.sql','utf8'));
      await connection.query(await readFile('docs/database/tournaments/match-workflow-security.sql','utf8'));
      await connection.query('COMMIT');
    }catch(e){await connection.query('ROLLBACK');throw e;}
    const seeded=await seedMatchWorkflow(db),after=await fingerprints();
    const changed=tables.filter(table=>before[table].hash!==after[table].hash);
    await writeFile('.tmp/split-ii-match-migration-audit.json',JSON.stringify({at:new Date().toISOString(),before,after,changed,seeded},null,2));
    console.log(JSON.stringify({seeded,existingRowsUnchanged:changed.length===0,changedTables:changed}));
    if(changed.length)throw new Error('Existing records changed concurrently; inspect the private fingerprint audit before publication.');
  }finally{await db.$disconnect();await connection.end();}
}
main().catch(error=>{console.error(error instanceof Error&&/^(Use |Expected |Database |Existing records)/.test(error.message)?error.message:'Tournament release failed. Inspect state before retrying; no credentials printed.');process.exitCode=1;});
