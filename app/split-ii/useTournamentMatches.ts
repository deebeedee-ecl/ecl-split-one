"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import type { TournamentData } from '@/lib/tournaments/match-types';
export function useTournamentMatches(disabled=false){
  const [data,setData]=useState<TournamentData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(!disabled);
  const revision=useRef(0);
  const refresh=useCallback(async()=>{
    if(disabled)return;
    const current=++revision.current;setLoading(true);
    try{
      const response=await fetch('/api/tournaments/split-ii/matches',{cache:'no-store',signal:AbortSignal.timeout(15000)}),value=await response.json();
      if(!response.ok)throw new Error(value.message||'Match data could not load.');
      if(!Array.isArray(value.fixtures)||!Array.isArray(value.teams))throw new Error('Match data could not load.');
      if(current===revision.current){setData(value);setError('');}
    }catch(e){if(current===revision.current)setError(e instanceof Error?e.message:'Match data could not load.');}
    finally{if(current===revision.current)setLoading(false);}
  },[disabled]);
  const invalidate=useCallback(()=>{revision.current++;},[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);return()=>{invalidate();clearInterval(timer);};},[refresh,invalidate]);
  return {data,error,loading,refresh};
}
