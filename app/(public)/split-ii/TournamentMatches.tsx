import Image from 'next/image';
import type { TournamentData } from '@/lib/tournaments/match-types';
import TournamentResultList from './TournamentResultList';
import styles from './split-ii.module.css';
export const chinaTime=(value:string)=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' CST';
export function LiveFixtures({data}:{data:TournamentData}){
  const team=(id:string)=>data.teams.find(t=>t.id===id)!;
  const weeks=[...new Set(data.fixtures.map(f=>f.week))].sort((a,b)=>a-b);
  return <section aria-labelledby="live-fixtures-heading">
    <div className={styles.sectionHeading}><div><p>ECL SPLIT II / FIXTURES</p><h3 id="live-fixtures-heading">Round robin fixtures.</h3></div></div>
    <p className={styles.fixturesIntro}>Two Bo1 matches per team each week. All times are China time.</p>
    <div className={styles.fixtureWeeks}>{weeks.map(week=>{
      const fixtures=data.fixtures.filter(f=>f.week===week);
      return <section key={week} className={styles.fixtureWeek} aria-labelledby={`live-fixtures-week-${week}`}>
        <div className={styles.fixtureWeekHeading}><div><h4 id={`live-fixtures-week-${week}`}>Week {week}</h4><p>{fixtures.length} matches</p></div><span>{[...new Set(fixtures.map(f=>`Bo${f.bestOf}`))].join(' / ')}</span></div>
        <ol className={`${styles.fixtureList} ${styles.liveFixtureList}`} aria-label={`Week ${week} fixtures`}>{fixtures.map(f=>{
          const target=Math.floor(f.bestOf/2)+1;
          const homeWon=f.homeScore>=target,awayWon=f.awayScore>=target;
          const complete=homeWon||awayWon;
          const outcome=(won:boolean)=>complete?(won?styles.fixtureWin:styles.fixtureLoss):'';
          return <li key={f.id}>
            <span className={styles.fixtureNumber}>{f.code.replace(/^RR/,'')}</span>
            <div className={`${styles.fixtureTeam} ${outcome(homeWon)}`}><Image src={team(f.homeTeamId).logo} alt="" width={28} height={28}/><strong>{team(f.homeTeamId).name}{complete&&<span className={styles.srOnly}>{homeWon?' — Win':' — Loss'}</span>}</strong></div>
            <span className={styles.fixtureVersus}>{f.homeScore||f.awayScore?<><span className={outcome(homeWon)}>{f.homeScore}</span> : <span className={outcome(awayWon)}>{f.awayScore}</span></>:'vs'}</span>
            <div className={`${styles.fixtureTeam} ${styles.fixtureOpponent} ${outcome(awayWon)}`}><strong>{team(f.awayTeamId).name}{complete&&<span className={styles.srOnly}>{awayWon?' — Win':' — Loss'}</span>}</strong><Image src={team(f.awayTeamId).logo} alt="" width={28} height={28}/></div>
            {!complete&&f.schedule&&<p className={styles.fixtureSchedule}>{chinaTime(f.schedule.at)} / {f.schedule.state==='CONFIRMED'?'Confirmed':'Awaiting opposing captain'}</p>}
          </li>;
        })}</ol>
      </section>;
    })}</div>
  </section>;
}
export function TournamentStandings({data}:{data:TournamentData|null}){
  if(!data)return <p className={styles.fixturesIntro}>Load tournament data to view standings.</p>;
  return <section aria-labelledby="standings-heading">
    <div className={styles.sectionHeading}><div><p>ECL SPLIT II / STANDINGS</p><h3 id="standings-heading">The league table.</h3></div></div>
    <div className={styles.tableScroll}><table className={styles.resultsTable}>
      <caption>Round robin / 1 point per win. Approved results only. Ties (*) remain provisional until resolved under the tournament rules.</caption>
      <thead><tr><th scope="col">Team</th><th scope="col">Played</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Points</th></tr></thead>
      <tbody>{data.standings.map(t=><tr key={t.id}><th scope="row">{t.name}{t.tied?' *':''}</th><td>{t.played}</td><td>{t.wins}</td><td>{t.losses}</td><td>{t.wins}</td></tr>)}</tbody>
    </table></div>
  </section>;
}
export function TournamentResults({data}:{data:TournamentData|null}){
  if(!data)return <p className={styles.fixturesIntro}>Load tournament data to view approved results.</p>;
  return <section aria-labelledby="results-heading"><div className={styles.sectionHeading}><div><p>ECL SPLIT II / APPROVED RESULTS</p><h3 id="results-heading">Every game counts.</h3></div></div><TournamentResultList data={data}/></section>;
}
export function TournamentLeaders({data}:{data:TournamentData|null}){
  return <section aria-labelledby="leaders-heading"><div className={styles.sectionHeading}><div><p>ECL SPLIT II / PLAYER STATS</p><h3 id="leaders-heading">Setting the pace.</h3></div></div><p className={styles.fixturesIntro}>Approved tournament games only. KDA = (kills + assists) / max(1, deaths). Unreported stats are excluded; MVPs are selected during review.</p><div className={styles.leaderGrid}>{(['kda','assists','mvps'] as const).map(key=><article key={key} className={styles.matchCard}><h4>Top 3 {key==='kda'?'KDA':key==='mvps'?'MVPs':'assists'}</h4>{!data?.leaders[key].length?<p>No approved stats yet.</p>:<ol>{data.leaders[key].map(p=><li key={p.profileId}><strong>{p.name}</strong><span>{key==='kda'?p.kda?.toFixed(2):p[key]} <small>/ {key==='mvps'?p.games:p.statGames} games</small></span></li>)}</ol>}</article>)}</div></section>;
}
