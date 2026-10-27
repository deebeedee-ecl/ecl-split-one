"use client";

import Image from 'next/image';
import { useRef,useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { TournamentData } from '@/lib/tournaments/match-types';
import type { MatchPayload } from '@/lib/tournaments/match-policy';
import styles from './split-ii.module.css';
import champions from '@/public/lol/champions/champions.json';

const duration=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
const date=(value:string)=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' CST';
const championNames=new Map(champions.map(c=>[String(c.id),c.name]));

export default function TournamentResultList({data}:{data:TournamentData}){
  const [selected,setSelected]=useState<string|null>(null);
  const opener=useRef<HTMLButtonElement|null>(null);
  const report=data.reports.find(r=>r.id===selected);
  const payload=report?.payload as unknown as MatchPayload|undefined;
  const fixture=report&&data.fixtures.find(f=>f.id===report.fixtureId);
  const team=(id:string)=>data.teams.find(t=>t.id===id)!;
  return <>
    {!data.reports.length?<p className={styles.fixturesIntro}>No approved results yet. Games appear here after administrator review.</p>:<div className={styles.matchCards}>{data.reports.map(r=>{
      const p=r.payload as unknown as MatchPayload,f=data.fixtures.find(v=>v.id===r.fixtureId)!;
      const winner=team(p.winnerTeamId),loser=team(f.homeTeamId===winner.id?f.awayTeamId:f.homeTeamId);
      return <button key={r.id} className={styles.resultRow} onClick={event=>{opener.current=event.currentTarget;setSelected(r.id);}} aria-label={`View ${winner.name} vs ${loser.name} match stats`}>
        <span className={`${styles.resultSide} ${styles.fixtureWin}`}><Image src={winner.logo} alt="" width={34} height={34}/><strong>{winner.name}</strong></span>
        <span className={styles.resultScore}><b className={styles.fixtureWin}>1</b><span>–</span><b className={styles.fixtureLoss}>0</b></span>
        <span className={`${styles.resultSide} ${styles.fixtureLoss}`}><Image src={loser.logo} alt="" width={34} height={34}/><strong>{loser.name}</strong></span>
        <span className={styles.resultOpen}>View match stats <ArrowUpRight size={15}/></span>
        <span className={styles.resultMeta}>{date(p.playedAt)} · {duration(p.durationSeconds)}{f.bestOf>1?` · Game ${r.gameNumber}`:''}</span>
      </button>;
    })}</div>}
    <Dialog open={Boolean(report&&payload&&fixture)} onOpenChange={open=>{if(!open)setSelected(null);}}>
      <DialogContent className={styles.resultDialog} overlayClassName={styles.resultOverlay} onCloseAutoFocus={event=>{event.preventDefault();opener.current?.focus();}}>
        {report&&payload&&fixture&&<>
          <DialogTitle className={styles.resultTitle}>{team(fixture.homeTeamId).name} vs {team(fixture.awayTeamId).name}</DialogTitle>
          <DialogDescription className={styles.resultMeta}>{date(payload.playedAt)} · {duration(payload.durationSeconds)}{fixture.bestOf>1?` · Game ${report.gameNumber}`:''}</DialogDescription>
          {[payload.winnerTeamId,...[fixture.homeTeamId,fixture.awayTeamId].filter(id=>id!==payload.winnerTeamId)].map(id=><section key={id} aria-label={`${team(id).name} scoreboard`}>
            <h4 className={`${styles.scoreTeamHeading} ${id===payload.winnerTeamId?styles.fixtureWin:styles.fixtureLoss}`}><Image src={team(id).logo} alt="" width={30} height={30}/>{team(id).name}<span>{id===payload.winnerTeamId?'VICTORY':'DEFEAT'}</span></h4>
            <div className={styles.tableScroll}><table className={`${styles.resultsTable} ${styles.scoreboard}`}>
              <thead><tr><th>Player / Champion</th><th>Items</th><th>K / D / A</th><th>Damage</th><th>Gold</th><th>Award</th></tr></thead>
              <tbody>{payload.players.filter(p=>p.teamId===id).map(p=><tr key={p.profileId}>
                <th scope="row"><div className={styles.scorePlayer}>{p.champion&&/^\d+$/.test(p.champion)?<Image src={`/lol/champions/${p.champion}.png`} alt={championNames.get(p.champion)??`Champion ${p.champion}`} title={championNames.get(p.champion)} width={38} height={38}/>:<span className={styles.missingChampion}>?</span>}<span>{p.name}<small>{p.riotId}</small>{p.position&&<small>{p.position}</small>}</span></div></th>
                <td>{p.items?<div className={styles.scoreItems}>{p.items.map((item,i)=>item?<Image key={i} src={`/lol/items/${item}.png`} alt={`Item ${item}`} width={26} height={26}/>:<span key={i} className={styles.emptyItem} aria-label="Empty item slot"/>)}</div>:<span className={styles.resultMeta}>Not reported</span>}</td>
                <td>{p.kills===undefined?'Not reported':`${p.kills} / ${p.deaths} / ${p.assists}`}</td>
                <td>{p.damage?.toLocaleString('en-GB')??'—'}</td><td>{p.gold?.toLocaleString('en-GB')??'—'}</td>
                <td>{p.mvp&&<span className={styles.mvpBadge}>MVP</span>}</td>
              </tr>)}</tbody>
            </table></div>
          </section>)}
          {payload.note&&<p className={styles.resultMeta}>{payload.note}</p>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
