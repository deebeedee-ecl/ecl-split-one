const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' CST';
const duration=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
const number=value=>Number.isFinite(value)?value.toLocaleString('en-GB'):'—';
const keys=new Set(['ballbreakers','exodus','zero','nextgen','phoenix']);
const names=new Map((typeof __CHAMPIONS__==='undefined'?[]:__CHAMPIONS__).map(c=>[String(c.id),c.name]));
const image=(src,alt,className='')=>`<img class="${className}" src="${esc(src)}" alt="${esc(alt)}">`;
const logo=team=>keys.has(team?.key)?image(`teams/${team.key}.png`,team.name,'s2-team-logo'):'';
const complete=f=>Math.max(f.homeScore,f.awayScore)>=Math.floor(f.bestOf/2)+1;
const tabs=[['overview','Overview'],['rosters','Teams'],['fixtures','Fixtures'],['results','Results'],['standings','Standings'],['stats','Player stats']];

export function createSplitTwo({api}){
  const root=document.getElementById('split2-content'),carousel=document.getElementById('split2-dashboard-carousel');
  const dialog=document.createElement('dialog');dialog.className='s2-dialog';dialog.setAttribute('aria-labelledby','s2-match-title');document.body.append(dialog);
  let state,selected='overview',demo=false,selectedReport=null,lastSignature='',carouselIndex=0,carouselTimer,paused=false,returnFocus=null;
  const tournament=()=>state?.tournament;
  const team=id=>tournament()?.teams.find(t=>t.id===id);
  function resultRow(report){
    const d=tournament(),p=report.payload,f=d.fixtures.find(v=>v.id===report.fixtureId);if(!f)return '';
    const winner=team(p.winnerTeamId),loser=team(f.homeTeamId===p.winnerTeamId?f.awayTeamId:f.homeTeamId);
    return `<button class="s2-result" data-s2-result="${esc(report.id)}" aria-label="View ${esc(winner.name)} versus ${esc(loser.name)} match stats"><span class="s2-team s2-win">${logo(winner)}<strong>${esc(winner.name)}</strong></span><span class="s2-score"><b class="s2-win">1</b><span>–</span><b class="s2-loss">0</b></span><span class="s2-team s2-loss">${logo(loser)}<strong>${esc(loser.name)}</strong></span><span class="s2-result-link">View match stats ↗</span><small class="s2-result-meta">${esc(time(p.playedAt))} · ${duration(p.durationSeconds)}${f.bestOf>1?` · Game ${report.gameNumber}`:''}</small></button>`;
  }
  function fixtures(){
    const d=tournament(),weeks=[...new Set(d.fixtures.map(f=>f.week))].sort((a,b)=>a-b);
    return `<div class="s2-week-grid">${weeks.map(week=>`<section class="s2-panel"><div class="s2-panel-heading"><h3>Week ${week}</h3><span>${d.fixtures.filter(f=>f.week===week).length} matches · Bo1</span></div><div class="s2-fixtures">${d.fixtures.filter(f=>f.week===week).map(f=>{
      const done=complete(f),a=team(f.homeTeamId),b=team(f.awayTeamId),home=done?(f.homeScore>f.awayScore?'s2-win':'s2-loss'):'',away=done?(f.awayScore>f.homeScore?'s2-win':'s2-loss'):'';
      return `<div class="s2-fixture ${done?'s2-complete':''}"><span class="s2-team ${home}">${logo(a)}<strong>${esc(a.name)}</strong></span><span class="s2-score">${done||f.homeScore||f.awayScore?`<b class="${home}">${f.homeScore}</b><span>–</span><b class="${away}">${f.awayScore}</b>`:'<small>VS</small>'}</span><span class="s2-team s2-away ${away}"><strong>${esc(b.name)}</strong>${logo(b)}</span>${!done&&f.schedule?`<small class="s2-fixture-time">${esc(time(f.schedule.at))}${f.schedule.state!=='CONFIRMED'?' · Proposed':''}</small>`:''}</div>`;
    }).join('')}</div></section>`).join('')}</div>`;
  }
  function standings(compact=false){
    const rows=tournament().standings;
    return `<section class="s2-panel"><div class="s2-panel-heading"><h3>Standings</h3><span>Round robin</span></div><div class="s2-scroll"><table class="s2-standings"><thead><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>PTS</th></tr></thead><tbody>${rows.map(t=>`<tr><th><span class="s2-team">${logo(team(t.id))}<strong>${esc(t.name)}${t.tied?' <span class="s2-tie">*</span>':''}</strong></span></th><td>${t.played}</td><td>${t.wins}</td><td>${t.losses}</td><td><b>${t.wins}</b></td></tr>`).join('')}</tbody></table></div>${!compact?'<p class="s2-footnote">One point per win. Ties (*) remain provisional under the tournament rules.</p>':''}</section>`;
  }
  function rosters(){return `<div class="s2-rosters">${tournament().teams.map(t=>`<article class="s2-panel s2-roster"><div class="s2-roster-heading">${logo(t)}<div><small>ECL SPLIT II</small><h3>${esc(t.name)}</h3></div></div>${t.members.map(p=>`<div class="s2-player"><span><strong>${esc(p.name)}</strong><small>${esc(p.riotId)}</small></span><span class="s2-player-role ${p.captain?'s2-captain':''}">${p.captain?'CAPTAIN':esc(p.role||'PLAYER')}</span></div>`).join('')}</article>`).join('')}</div>`;}
  function stats(){return `<div class="s2-leaders">${['kda','assists','mvps'].map(k=>`<section class="s2-panel"><div class="s2-panel-heading"><h3>Top 3 ${k==='kda'?'KDA':k==='mvps'?'MVPs':'assists'}</h3></div>${tournament().leaders[k].length?`<ol>${tournament().leaders[k].map((p,i)=>`<li><span class="s2-place">0${i+1}</span><strong>${esc(p.name)}</strong><b>${k==='kda'?Number(p.kda).toFixed(2):number(p[k])}</b><small>${k==='mvps'?p.games:p.statGames} games</small></li>`).join('')}</ol>`:'<p class="s2-empty">Stats appear after the first approved result.</p>'}</section>`).join('')}</div><p class="s2-footnote">Approved Split II games only. KDA = (kills + assists) / max(1, deaths). Missing stats are excluded.</p>`;}
  function overview(){
    const d=tournament(),played=d.fixtures.filter(complete).length;
    return `<div class="s2-metrics"><div><span>TEAMS</span><strong>${d.teams.length}</strong></div><div><span>MATCHES PLAYED</span><strong>${played}<small> / ${d.fixtures.length}</small></strong></div><div><span>FORMAT</span><strong>Bo1</strong></div><div><span>PLAYOFF PLACES</span><strong>4</strong></div></div><div class="s2-overview"><section><div class="s2-section-heading"><h3>Latest result</h3><button data-split-tab="results">All results ↗</button></div>${d.reports.length?resultRow(d.reports[0]):'<div class="s2-panel s2-empty">The first result will appear here.</div>'}<div class="s2-section-heading s2-next-heading"><h3>Round robin</h3><button data-split-tab="fixtures">Full schedule ↗</button></div><div class="s2-mini-matchups">${d.fixtures.filter(f=>!complete(f)).slice(0,3).map(f=>`<button data-split-tab="fixtures" aria-label="${esc(team(f.homeTeamId).name)} versus ${esc(team(f.awayTeamId).name)}">${logo(team(f.homeTeamId))}<span>VS</span>${logo(team(f.awayTeamId))}</button>`).join('')}</div></section>${standings(true)}</div>`;
  }
  function render(){
    if(!state)return;const signature=JSON.stringify([state.tournament,state.error,state.enabled,state.message,selected,demo]);
    if(signature===lastSignature)return;lastSignature=signature;
    const d=tournament();let content='<div class="s2-panel s2-empty">Connecting to tournament data… Updates happen automatically.</div>';
    if(d){content=selected==='overview'?overview():selected==='rosters'?rosters():selected==='fixtures'?fixtures():selected==='standings'?standings():selected==='stats'?stats():`<div class="s2-results-list">${d.reports.length?d.reports.map(resultRow).join(''):'<div class="s2-panel s2-empty">No results yet.</div>'}</div>`;}
    root.innerHTML=`<div class="s2-heading"><div><p class="s2-eyebrow">EXPAT CHINA LEAGUE / 2026</p><h1>Split II<span>.</span></h1><p>Against all odds.</p></div><span class="s2-live"><i></i> ROUND ROBIN</span></div><nav class="s2-tabs" aria-label="Split II sections">${tabs.map(([key,label])=>`<button data-split-tab="${key}" aria-pressed="${selected===key}">${label}</button>`).join('')}</nav>${state.error?'<p class="s2-reconnect" role="status">Reconnecting automatically. Your last loaded results stay visible.</p>':''}${content}<details class="s2-reporting"><summary>Tournament reporting <span>${state.enabled?'Connected':'Not connected'}</span></summary><div><p>${esc(state.message)}</p><p>Connect only when you want to upload a game requested through KOOK. Every upload needs administrator review; ranked inhouse points stay separate.</p><button class="secondary" data-split-connect ${demo?'disabled':''}>${state.enabled?'Disconnect reporting':'Connect reporting'}</button></div></details><p class="s2-sync">Results and standings update automatically · China time (UTC+8)</p>`;
    if(selectedReport){const report=d?.reports.find(r=>r.id===selectedReport);if(report)fillDialog(report);else dialog.close();}
  }
  function fillDialog(report){
    const p=report.payload,f=tournament().fixtures.find(v=>v.id===report.fixtureId);
    if(!f)return;
    dialog.innerHTML=`<div class="s2-dialog-heading"><div><p class="s2-eyebrow">ECL SPLIT II / MATCH STATS</p><h2 id="s2-match-title">${esc(team(f.homeTeamId).name)} vs ${esc(team(f.awayTeamId).name)}</h2><p>${esc(time(p.playedAt))} · ${duration(p.durationSeconds)}</p></div><button class="s2-dialog-close" data-s2-close aria-label="Close match stats">×</button></div>${[p.winnerTeamId,...[f.homeTeamId,f.awayTeamId].filter(id=>id!==p.winnerTeamId)].map(id=>`<section class="s2-score-team"><h3 class="${id===p.winnerTeamId?'s2-win':'s2-loss'}">${logo(team(id))}${esc(team(id).name)}<span>${id===p.winnerTeamId?'VICTORY':'DEFEAT'}</span></h3><div class="s2-scroll"><table class="s2-scoreboard"><thead><tr><th>Player</th><th>Items</th><th>K / D / A</th><th>Damage</th><th>Gold</th><th>Award</th></tr></thead><tbody>${p.players.filter(v=>v.teamId===id).map(v=>`<tr><th><span class="s2-score-player">${/^\d+$/.test(v.champion)?image(`champions/${v.champion}.png`,names.get(String(v.champion))||`Champion ${v.champion}`,'s2-champion'):''}<span><strong>${esc(v.name)}</strong><small>${esc(v.riotId)}</small>${v.position?`<small>${esc(v.position)}</small>`:''}</span></span></th><td>${Array.isArray(v.items)?`<span class="s2-items">${v.items.map(item=>Number.isInteger(item)&&item>0?image(`items/${item}.png`,`Item ${item}`):'<span class="s2-item-empty" aria-label="Empty item slot"></span>').join('')}</span>`:'—'}</td><td>${v.kills===undefined?'—':`${v.kills} / ${v.deaths} / ${v.assists}`}</td><td>${number(v.damage)}</td><td>${number(v.gold)}</td><td>${v.mvp?'<b class="s2-mvp">MVP</b>':''}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}`;
  }
  function renderCarousel(){
    if(!carousel)return;const d=tournament(),rows=d?.fixtures.filter(f=>f.stage==='ROUND_ROBIN'||!f.stage)||[];
    if(!rows.length){carousel.innerHTML='<p class="s2-sync">Round robin matchups are connecting…</p>';return;}
    const f=rows[carouselIndex%rows.length];
    carousel.innerHTML=`<button class="s2-carousel-match" data-s2-open aria-label="${esc(team(f.homeTeamId).name)} versus ${esc(team(f.awayTeamId).name)}. Open Split II fixtures.">${logo(team(f.homeTeamId))}<span>VS</span>${logo(team(f.awayTeamId))}</button><div class="s2-carousel-dots">${rows.map((v,i)=>`<button data-s2-slide="${i}" aria-label="Show matchup ${i+1}" aria-pressed="${carouselIndex%rows.length===i}"></button>`).join('')}</div>`;
  }
  root.addEventListener('click',async event=>{
    const tab=event.target.closest('[data-split-tab]');if(tab){selected=tab.dataset.splitTab;render();return;}
    const result=event.target.closest('[data-s2-result]');if(result){const report=tournament()?.reports.find(r=>r.id===result.dataset.s2Result);if(report){selectedReport=report.id;returnFocus=result;fillDialog(report);dialog.showModal();}return;}
    if(!event.target.closest('[data-split-connect]'))return;
    try{const result=await(state.enabled?api.splitTwoDisconnect():api.splitTwoConnect());if(!result.ok)throw new Error(result.error);if(result.data)state=result.data;render();}catch(error){state={...state,error:error.message};render();}
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-s2-close]'))dialog.close();});
  dialog.addEventListener('close',()=>{selectedReport=null;const original=returnFocus?.isConnected?returnFocus:[...root.querySelectorAll('[data-s2-result]')].find(b=>b.dataset.s2Result===returnFocus?.dataset.s2Result);original?.focus();});
  carousel?.addEventListener('mouseenter',()=>{paused=true;});carousel?.addEventListener('mouseleave',()=>{paused=false;});
  carousel?.addEventListener('click',event=>{const slide=event.target.closest('[data-s2-slide]');if(slide){carouselIndex=Number(slide.dataset.s2Slide);renderCarousel();return;}if(event.target.closest('[data-s2-open]')){selected='fixtures';render();document.querySelector('nav [data-tab="split2"]')?.click();}});
  return {start(initial){state=initial.splitTwo;demo=initial.demo;api.onSplitTwo(value=>{state=value;render();renderCarousel();});render();renderCarousel();carouselTimer=setInterval(()=>{if(paused||document.visibilityState==='hidden'||document.getElementById('dashboard')?.hidden||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||carousel?.contains(document.activeElement))return;carouselIndex++;renderCarousel();},6000);carouselTimer.unref?.();},dispose(){clearInterval(carouselTimer);dialog.remove();}};
}
