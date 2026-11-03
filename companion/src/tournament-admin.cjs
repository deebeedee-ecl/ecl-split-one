const {EventEmitter}=require('node:events');
const {randomUUID}=require('node:crypto');
const {gameId,validate,summarize,safeError}=require('./core.cjs');
const origin='https://eclchina.lol',endpoint='/api/admin/tournaments/split-ii';
class TournamentAdmin extends EventEmitter {
  constructor(collector,transport=fetch){super();this.collector=collector;this.transport=transport;this.generation=0;this.data={authenticated:false,busy:false,fixtures:[],preview:null,message:'',error:''};}
  snapshot(){return structuredClone(this.data);}
  change(value){Object.assign(this.data,value);this.emit('change',this.snapshot());}
  logout(){this.generation++;clearTimeout(this.expiry);this.cookie=null;this.raw=null;this.lookupKey=null;this.expires=0;this.change({authenticated:false,busy:false,fixtures:[],preview:null,message:'',error:''});return this.snapshot();}
  requireSession(){if(!this.cookie||Date.now()>=this.expires){this.logout();throw new Error('Sign in to tournament admin first.');}}
  async request(path,body,login=false){
    if(!['/api/admin/login',endpoint].includes(path))throw new Error('Unsupported tournament admin request.');
    if(!login)this.requireSession();const generation=this.generation;
    const response=await this.transport(origin+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(!login?{Cookie:this.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const text=await response.text();if(Buffer.byteLength(text)>3_000_000)throw new Error('Tournament response exceeds the size limit.');
    if(generation!==this.generation)throw new Error('Admin session changed. Sign in again.');
    let data;try{data=JSON.parse(text);}catch{throw new Error('Tournament admin is unavailable.');}
    if(!response.ok){if(response.status===401||response.status===403){this.logout();throw new Error(login?'Invalid admin login.':'Admin session expired. Sign in again.');}throw new Error(String(data.message||data.error||'Tournament request failed.').slice(0,350));}
    return {response,data};
  }
  async login(username,password){
    if(this.data.busy)throw new Error('Wait for the current admin request.');
    if(typeof username!=='string'||username.length>100||typeof password!=='string'||!password||password.length>1024)throw new Error('Enter your existing website admin login.');
    this.logout();this.change({busy:true});const generation=this.generation;
    try{
      const {response}=await this.request('/api/admin/login',{username,password},true);password='';
      const cookies=response.headers.getSetCookie?.()??[response.headers.get('set-cookie')||''];
      const match=cookies.map(v=>/^ecl_admin_session=([^;\r\n]+)/.exec(v)).find(Boolean);
      if(!match||generation!==this.generation)throw new Error('Admin sign-in did not return a valid session.');
      this.cookie=`ecl_admin_session=${match[1]}`;this.expires=Date.now()+12*3600000;
      const {data}=await this.request(endpoint);
      if(data.viewer?.admin!==true||!Array.isArray(data.fixtures)||!Array.isArray(data.teams))throw new Error('Tournament admin access could not be verified.');
      this.change({authenticated:true,fixtures:data.fixtures.map(f=>({id:f.id,bestOf:f.bestOf,label:`${data.teams.find(t=>t.id===f.homeTeamId)?.name||'Home'} vs ${data.teams.find(t=>t.id===f.awayTeamId)?.name||'Away'}`})),message:'Admin connected for this app session.',error:''});
      this.expiry=setTimeout(()=>this.logout(),12*3600000);this.expiry.unref?.();
    }catch(error){if(generation===this.generation){this.logout();this.change({error:error.message});}throw error;}
    finally{password='';if(generation===this.generation)this.change({busy:false});}
    return this.snapshot();
  }
  async lookup(value){
    this.requireSession();if(this.data.busy)throw new Error('Wait for the current admin request.');const id=gameId(value),generation=this.generation;
    this.raw=null;this.lookupKey=null;let connection;this.change({busy:true,preview:null,error:'',message:`Checking League game ${id}…`});
    try{
      await this.request(endpoint); // Recheck server authority before collecting local data.
      connection=this.collector.connection??await this.collector.discover();
      if(!connection)throw new Error('Open League on this PC and wait for it to connect.');
      const raw=await this.collector.request(connection,`/lol-match-history/v1/games/${id}`);
      if(generation!==this.generation)throw new Error('Admin session changed.');
      if(String(raw.gameId)!==id)throw new Error('League returned a different game. Nothing was saved.');
      const result=validate(raw);
      if(!result.candidate||raw.platformId!=='HN1')throw new Error('Expected a complete Ionia custom Summoner’s Rift game with ten players.');
      if(Buffer.byteLength(JSON.stringify(raw))>2_800_000)throw new Error('Match JSON is too large for tournament upload.');
      this.raw=raw;this.lookupKey=randomUUID();
      const preview={lookupKey:this.lookupKey,gameId:id,durationSeconds:raw.gameDuration,playedAt:new Date(raw.gameCreation).toISOString(),players:summarize(raw).map(p=>{const source=raw.participants.find(v=>v.participantId===p.participantId);return {...p,win:raw.teams.find(t=>t.teamId===p.teamId)?.win===true||raw.teams.find(t=>t.teamId===p.teamId)?.win==='Win',items:Array.from({length:7},(_,i)=>Number(source.stats?.[`item${i}`])||0)};})};
      this.change({preview,message:'Match loaded locally. Check the ten players and select the correct fixture before submitting.',error:''});
    }catch(error){if(generation===this.generation){this.raw=null;this.lookupKey=null;this.change({error:error.status===404?'League could not find this game from the current client. A participant’s client or a JSON import may be needed.':error.status?'League match history is unavailable. Nothing was uploaded.':String(error.message).startsWith('LCU ')?'League could not retrieve this match. Nothing was uploaded.':safeError(error,connection?.token),message:''});}throw new Error(this.data.error||'Admin session changed.');}
    finally{if(generation===this.generation)this.change({busy:false});}
    return this.snapshot();
  }
  async submit(fixtureId,gameNumber,lookupKey){
    this.requireSession();if(this.data.busy)throw new Error('Wait for the current admin request.');
    const fixture=this.data.fixtures.find(f=>f.id===fixtureId);
    if(!fixture||!Number.isInteger(gameNumber)||gameNumber<1||gameNumber>fixture.bestOf)throw new Error('Choose a valid tournament fixture and game number.');
    if(!this.raw||lookupKey!==this.lookupKey)throw new Error('Look up and review the game again before submitting.');
    const generation=this.generation;this.change({busy:true,error:''});
    try{const {data}=await this.request(endpoint,{action:'importLcu',fixtureId,gameNumber,raw:this.raw});
      if(data.status!=='PENDING'&&data.status!=='APPROVED')throw new Error('Unexpected tournament report status.');
      this.change({message:data.status==='PENDING'?'Report saved for admin review. Results and standings have not changed.':'This game is already recorded.',error:''});
      this.raw=null;this.lookupKey=null;this.change({preview:null});
    }catch(error){if(generation===this.generation)this.change({error:error.message});throw error;}
    finally{if(generation===this.generation)this.change({busy:false});}
    return this.snapshot();
  }
  dispose(){this.logout();}
}
module.exports={TournamentAdmin};
