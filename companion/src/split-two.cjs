const { EventEmitter } = require('node:events');
const origin = 'https://eclchina.lol';
class SplitTwo extends EventEmitter {
  constructor(account, collector, transport = fetch) {
    super(); this.account=account;this.collector=collector;this.transport=transport;this.generation=0;
    this.data={ tournament:null, error:'', enabled:false, message:'Tournament uploads are disconnected.', updatedAt:null };
  }
  snapshot(){return structuredClone(this.data);}
  change(value){Object.assign(this.data,value);this.emit('change',this.snapshot());}
  async request(path,body,authenticated=false,signal){
    const epoch=this.account.epoch,headers={'Content-Type':'application/json'};
    if(authenticated){
      if(!this.account.data.authenticated||!this.account.client)throw new Error('Sign in to your verified ECL account first.');
      const {data,error}=await this.account.client.auth.getSession();
      if(error||!data.session?.access_token||epoch!==this.account.epoch)throw new Error('Sign in again before reporting.');
      headers.Authorization=`Bearer ${data.session.access_token}`;
    }
    const response=await this.transport(`${origin}/api/tournaments/split-ii/${path}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:signal??AbortSignal.timeout(20000)});
    if(authenticated&&epoch!==this.account.epoch)throw new Error('Account changed. Reconnect reporting.');
    if(Number(response.headers.get('content-length')||0)>3_000_000)throw new Error('Tournament response too large.');
    const bytes=await response.text();if(Buffer.byteLength(bytes)>3_000_000)throw new Error('Tournament response too large.');
    let result;try{result=JSON.parse(bytes);}catch{throw new Error('Tournament server is unavailable.');}
    if(!response.ok)throw new Error(String(result.message||'Tournament request failed.').slice(0,500));
    return result;
  }
  async refresh(){
    try{const tournament=await this.request('matches');if(!Array.isArray(tournament.teams)||!Array.isArray(tournament.fixtures)||!Array.isArray(tournament.reports))throw new Error('Invalid tournament data.');this.change({tournament,error:'',updatedAt:Date.now()});}
    catch(error){this.change({error:error.message});}
    return this.snapshot();
  }
  identity(){const p=this.collector.connection?.profile;if(!p?.puuid||!p.gameName||!p.tagLine)throw new Error('Open League and wait for your player identity.');return {puuid:p.puuid,name:p.gameName,tag:p.tagLine};}
  async connect(){
    this.disconnect();this.local=this.identity();this.epoch=this.account.epoch;
    const generation=this.generation,identity=JSON.stringify(this.local);
    if(!this.account.data.authenticated)throw new Error('Sign in before connecting tournament reporting.');
    await this.request('collection',undefined,true);
    if(generation!==this.generation)return this.snapshot();
    if(this.epoch!==this.account.epoch)throw new Error('Account changed. Reconnect reporting.');
    if(JSON.stringify(this.identity())!==identity)throw new Error('League account changed. Reconnect reporting.');
    this.controller=new AbortController();this.change({enabled:true,message:'Waiting for your !split2 report request in KOOK.'});
    this.reportTimer=setInterval(()=>void this.tick(),30000);this.reportTimer.unref?.();void this.tick();return this.snapshot();
  }
  disconnect(message='Tournament uploads are disconnected.'){
    this.generation++;clearInterval(this.reportTimer);this.controller?.abort();this.change({enabled:false,message});return this.snapshot();
  }
  async tick(){
    if(this.busy||!this.data.enabled)return;
    const generation=this.generation,epoch=this.epoch;
    const current=()=>{try{return this.data.enabled&&generation===this.generation&&epoch===this.account.epoch&&JSON.stringify(this.identity())===JSON.stringify(this.local);}catch{return false;}};
    if(!current())return this.disconnect('ECL or League account changed. Reconnect tournament reporting.');
    this.busy=true;
    try{
      const result=await this.request('collection',undefined,true,this.controller.signal);if(!current())return;
      const job=result.jobs?.find(j=>j.status==='PENDING');
      if(!job)return;
      if(typeof job.id!=='string'||!/^\d{5,20}$/.test(job.leagueGameId))throw new Error('Invalid tournament collection request.');
      this.change({message:`Collecting tournament League game #${job.leagueGameId}.`});
      const key=await this.collector.enqueue(job.leagueGameId,'split-ii');await this.collector.tick();if(!current())return;
      if(!this.collector.db.matches.some(m=>m.key===key))return this.change({message:'Match history is unavailable or still collecting. Retrying while connected; admins can report manually.'});
      const record=await this.collector.readMatch(key);if(!current())return;
      if(record.sample)throw new Error('Sample games cannot be uploaded.');
      await this.request('collection',{action:'submit',jobId:job.id,identity:this.local,raw:record.raw},true,this.controller.signal);
      if(!current())return;
      this.change({message:`Game #${job.leagueGameId} uploaded for admin review. No inhouse points awarded.`});void this.refresh();
    }catch(error){if(current())this.change({message:`Tournament report: ${error.message}`});}
    finally{this.busy=false;}
  }
  start(){void this.refresh();this.publicTimer=setInterval(()=>void this.refresh(),60000);this.publicTimer.unref?.();}
  dispose(){this.disconnect();clearInterval(this.publicTimer);}
}
module.exports={SplitTwo};
