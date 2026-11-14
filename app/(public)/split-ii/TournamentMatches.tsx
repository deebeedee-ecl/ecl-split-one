import Image from 'next/image';
import type { TournamentData } from '@/lib/tournaments/match-types';
import { SPLIT_II_SEMIFINALS, SPLIT_II_SEMIFINAL_SIDE_RULE } from '@/lib/tournaments/split-ii-fixtures';
import TournamentResultList from './TournamentResultList';
import styles from './split-ii.module.css';
export const chinaTime=(value:string)=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Shanghai',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' CST';
const totalWinTime=(seconds:number)=>`${Math.floor(seconds/3600)}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
type Fixture=TournamentData['fixtures'][number];
function FixtureRows({data,fixtures}:{data:TournamentData;fixtures:Fixture[]}){
  const team=(id:string)=>data.teams.find(t=>t.id===id)!;
  return <ol className={`${styles.fixtureList} ${styles.liveFixtureList}`}>{fixtures.map(f=>{
    const target=Math.floor(f.bestOf/2)+1;
    const homeWon=f.homeScore>=target,awayWon=f.awayScore>=target;
    const complete=homeWon||awayWon;
    const outcome=(won:boolean)=>complete?(won?styles.fixtureWin:styles.fixtureLoss):'';
    const definition=SPLIT_II_SEMIFINALS.find(row=>row.code===f.code);
    const selector=definition&&data.teams.find(t=>t.key===definition.gameOneSideSelection);
    return <li key={f.id}>
      <span className={styles.fixtureNumber}>{f.code.replace(/^RR/,'')}</span>
      <div className={`${styles.fixtureTeam} ${outcome(homeWon)}`}><Image src={team(f.homeTeamId).logo} alt="" width={28} height={28}/><strong>{team(f.homeTeamId).name}{complete&&<span className={styles.srOnly}>{homeWon?' — Win':' — Loss'}</span>}</strong></div>
      <span className={styles.fixtureVersus}>{f.homeScore||f.awayScore?<><span className={outcome(homeWon)}>{f.homeScore}</span> : <span className={outcome(awayWon)}>{f.awayScore}</span></>:'vs'}</span>
      <div className={`${styles.fixtureTeam} ${styles.fixtureOpponent} ${outcome(awayWon)}`}><strong>{team(f.awayTeamId).name}{complete&&<span className={styles.srOnly}>{awayWon?' — Win':' — Loss'}</span>}</strong><Image src={team(f.awayTeamId).logo} alt="" width={28} height={28}/></div>
      {!complete&&(selector||f.schedule)&&<p className={styles.fixtureSchedule}>{selector&&<>Game 1 side selection: {selector.name}.{f.schedule&&' '}</>}{f.schedule&&<>{chinaTime(f.schedule.at)} / {f.schedule.state==='CONFIRMED'?'Confirmed':'Awaiting opposing captain'}</>}</p>}
    </li>;
  })}</ol>;
}
export function LiveFixtures({data}:{data:TournamentData}){
  const roundRobin=data.fixtures.filter(f=>f.stage==='ROUND_ROBIN');
  const semifinals=data.fixtures.filter(f=>f.stage==='SEMIFINAL').sort((a,b)=>a.code.localeCompare(b.code));
  const weeks=[...new Set(roundRobin.map(f=>f.week))].sort((a,b)=>a-b);
  return <section aria-labelledby="live-fixtures-heading">
    <div className={styles.sectionHeading}><div><p>ECL SPLIT II / FIXTURES</p><h3 id="live-fixtures-heading">Fixtures &amp; playoffs.</h3></div></div>
    <p className={styles.fixturesIntro}>Semifinals are Bo3. Round-robin fixtures remain below as the completed league record. All scheduled times are China time.</p>
    <div className={styles.fixtureWeeks}>
      {semifinals.length>0&&<section className={styles.fixtureWeek} aria-labelledby="live-fixtures-semifinals">
        <div className={styles.fixtureWeekHeading}><div><h4 id="live-fixtures-semifinals">Semifinals</h4><p>{semifinals.length} series / first to two wins</p></div><span>Bo3</span></div>
        <FixtureRows data={data} fixtures={semifinals}/>
        <p className={styles.fixtureRule}>{SPLIT_II_SEMIFINAL_SIDE_RULE}</p>
      </section>}
      {weeks.map(week=>{
      const fixtures=roundRobin.filter(f=>f.week===week);
      return <section key={week} className={styles.fixtureWeek} aria-labelledby={`live-fixtures-week-${week}`}>
        <div className={styles.fixtureWeekHeading}><div><h4 id={`live-fixtures-week-${week}`}>Week {week}</h4><p>{fixtures.length} matches</p></div><span>{[...new Set(fixtures.map(f=>`Bo${f.bestOf}`))].join(' / ')}</span></div>
        <FixtureRows data={data} fixtures={fixtures}/>
      </section>;
    })}</div>
  </section>;
}
export function TournamentStandings({data}:{data:TournamentData|null}){
  if(!data)return <p className={styles.fixturesIntro}>Load tournament data to view standings.</p>;
  return <section aria-labelledby="standings-heading">
    <div className={styles.sectionHeading}><div><p>ECL SPLIT II / STANDINGS</p><h3 id="standings-heading">The league table.</h3></div></div>
    <div className={styles.tableScroll}><table className={styles.resultsTable}>
      <caption>Round robin / 1 point per win. Equal wins are ranked by lower total time in games won. Exact ties (*) remain provisional.</caption>
      <thead><tr><th scope="col">Team</th><th scope="col">Played</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Win time</th><th scope="col">Points</th></tr></thead>
      <tbody>{data.standings.map(t=><tr key={t.id}><th scope="row">{t.name}{t.tied?' *':''}</th><td>{t.played}</td><td>{t.wins}</td><td>{t.losses}</td><td>{t.wins?totalWinTime(t.winTimeSeconds):'—'}</td><td>{t.wins}</td></tr>)}</tbody>
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
