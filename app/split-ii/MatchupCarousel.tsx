"use client";
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {useTournamentMatches} from './useTournamentMatches';
import {SPLIT_II_FIXTURE_WEEKS,SPLIT_II_TEAMS} from '@/lib/tournaments/split-ii-fixtures';
import styles from './matchup-carousel.module.css';

const planned=SPLIT_II_FIXTURE_WEEKS.flatMap(w=>w.matches.map(([a,b])=>({id:`${a}-${b}`,home:{...SPLIT_II_TEAMS[a],logo:`/kook/split2/${a}.png`},away:{...SPLIT_II_TEAMS[b],logo:`/kook/split2/${b}.png`}})));
export default function MatchupCarousel(){
  const matches=useTournamentMatches(),[index,setIndex]=useState(0),[paused,setPaused]=useState(false);
  const items=matches.data?matches.data.fixtures.filter(f=>f.stage==='ROUND_ROBIN').flatMap(f=>{const home=matches.data!.teams.find(t=>t.id===f.homeTeamId),away=matches.data!.teams.find(t=>t.id===f.awayTeamId);return home&&away?[{id:f.id,home,away}]:[];}):planned;
  const count=items.length,active=items[index%Math.max(1,count)];
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');if(paused||media.matches||count<2)return;const timer=setInterval(()=>{if(document.visibilityState!=='hidden')setIndex(i=>(i+1)%count);},6000);return()=>clearInterval(timer);},[paused,count]);
  if(!active)return null;
  return <section className={styles.carousel} aria-label="Split II round robin matchups" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
    <div className={styles.heading}><div><p>ECL SPLIT II / 2026</p><h1>Round robin.</h1></div><Link href="/hub/split-ii">Open Split II <ChevronRight size={15}/></Link></div>
    <div className={styles.stage}>
      <button className={styles.arrow} aria-label="Previous matchup" onClick={()=>setIndex(i=>(i+count-1)%count)}><ChevronLeft/></button>
      <Link key={active.id} className={styles.match} href="/hub/split-ii" aria-label={`${active.home.name} versus ${active.away.name}. View Split II fixtures.`}>
        <Image src={active.home.logo} alt={active.home.name} width={160} height={160} preload/>
        <span>VS</span>
        <Image src={active.away.logo} alt={active.away.name} width={160} height={160} preload/>
      </Link>
      <button className={styles.arrow} aria-label="Next matchup" onClick={()=>setIndex(i=>(i+1)%count)}><ChevronRight/></button>
    </div>
    <div className={styles.dots} aria-label="Choose a matchup">{items.map((item,i)=><button key={item.id} aria-label={`Show ${item.home.name} versus ${item.away.name}`} aria-pressed={index%count===i} onClick={()=>setIndex(i)}/>)}</div>
  </section>;
}
