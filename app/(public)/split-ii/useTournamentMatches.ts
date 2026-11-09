"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import type { TournamentData } from '@/lib/tournaments/match-types';
const cacheKey='ecl:split-ii:public-matches:v1';
function valid(value:unknown):value is TournamentData {
  if(!value||typeof value!=='object')return false;
  const d=value as TournamentData;
  return Array.isArray(d.teams)&&Array.isArray(d.fixtures)&&Array.isArray(d.reports)&&Array.isArray(d.standings)&&Boolean(d.leaders)
    &&Array.isArray(d.leaders.kda)&&Array.isArray(d.leaders.assists)&&Array.isArray(d.leaders.mvps)
    &&d.reports.every(r=>Boolean(r.payload)&&Array.isArray((r.payload as {players?:unknown}).players))
    &&d.teams.every(t=>typeof t.id==='string'&&typeof t.name==='string'&&Array.isArray(t.members))
    &&d.fixtures.every(f=>typeof f.id==='string'&&Number.isFinite(f.homeScore)&&Number.isFinite(f.awayScore));
}
export function useTournamentMatches(disabled=false){
  const [data,setData]=useState<TournamentData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(!disabled);
  const revision=useRef(0),busy=useRef(false),retry=useRef<ReturnType<typeof setTimeout>|null>(null),failures=useRef(0),controller=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{
    if(disabled||busy.current)return;
    if(retry.current)clearTimeout(retry.current);
    busy.current=true;setLoading(true);const current=++revision.current;
    const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),15000);
    try{
      const response=await fetch('/api/tournaments/split-ii/matches',{cache:'no-store',signal:abort.signal}),value=await response.json();
      if(!response.ok||!valid(value))throw new Error('Tournament data is temporarily unavailable.');
      if(current!==revision.current)return;
      setData(value);setError('');failures.current=0;
      try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),data:value}));}catch{}
    }catch{
      if(current!==revision.current)return;
      setError('Tournament data is temporarily unavailable.');
      const delay=Math.min(30000,1500*2**Math.min(failures.current++,4));
      retry.current=setTimeout(()=>{if(document.visibilityState!=='hidden')void refresh();},delay);
    }finally{clearTimeout(timeout);if(current===revision.current){busy.current=false;setLoading(false);}}
  },[disabled]);
  const invalidate=useCallback(()=>{revision.current++;controller.current?.abort();busy.current=false;},[]);
  useEffect(()=>{
    if(disabled)return;
    try{const saved=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(saved&&Date.now()-saved.at<86400000&&valid(saved.data))setData(saved.data);}catch{}
    void refresh();
    const visible=()=>{if(document.visibilityState!=='hidden')void refresh();};
    const timer=setInterval(visible,60000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{invalidate();clearInterval(timer);if(retry.current)clearTimeout(retry.current);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[disabled,refresh,invalidate]);
  return {data,error,loading,refresh};
}
