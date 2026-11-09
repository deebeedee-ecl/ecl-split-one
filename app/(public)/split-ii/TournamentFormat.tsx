import Image from "next/image";
import { SPLIT_II_TEAMS } from "@/lib/tournaments/split-ii-fixtures";
import styles from "./split-ii.module.css";

const teams = Object.entries(SPLIT_II_TEAMS).map(([logo, team]) => ({ logo, ...team }));

export default function TournamentFormat() {
  return (
    <section className={styles.formatPanel} aria-labelledby="format-heading">
      <div className={styles.sectionHeading}><div><p>ECL SPLIT II / TOURNAMENT FORMAT</p><h3 id="format-heading">The road to the title.</h3></div></div>
      <dl className={styles.formatStats}>
        <div><dt>Teams</dt><dd>5</dd></div>
        <div><dt>League games</dt><dd>10</dd></div>
        <div><dt>Round robin</dt><dd>Bo1</dd></div>
        <div><dt>Advance</dt><dd>Top 4</dd></div>
      </dl>
      <ul className={styles.formatTeams} aria-label="Participating teams">{teams.map(team => <li key={team.logo}><Image src={`/split-ii/teams/${team.logo}.png`} alt="" width={36} height={36} /><div><strong>{team.name}</strong><span>{team.tag}</span></div></li>)}</ul>

      <section className={styles.formatCard} aria-labelledby="league-format-heading">
        <div className={styles.formatCardTitle}><span>01</span><h4 id="league-format-heading">Round robin / Bo1</h4></div>
        <p>Every team plays every other team once. Each team plays four Bo1 games, for ten league games in total. A win earns one point.</p>
        <div className={styles.formatQualification}><span>1st</span><span>2nd</span><span>3rd</span><span>4th</span><strong>Advance to semifinals</strong></div>
        <p className={styles.formatElimination}>5th place is eliminated after any required tie-breakers.</p>
      </section>

      <section className={styles.formatCard} aria-labelledby="playoff-format-heading">
        <div className={styles.formatCardTitle}><span>02</span><h4 id="playoff-format-heading">Playoffs / Bo3</h4></div>
        <div className={styles.formatBracket} aria-label="Best-of-three semifinals lead to the best-of-three final">
          <div className={styles.formatSemifinals}>
            <div className={styles.formatMatch}><p>SEMIFINAL 1 / Bo3</p><div><strong>1st place</strong><span>vs</span><strong>4th place</strong></div></div>
            <div className={styles.formatMatch}><p>SEMIFINAL 2 / Bo3</p><div><strong>2nd place</strong><span>vs</span><strong>3rd place</strong></div></div>
          </div>
          <div className={`${styles.formatMatch} ${styles.formatFinal}`}><p>FINAL / Bo3 / 20 NOVEMBER</p><div><strong>Winner SF1</strong><span>vs</span><strong>Winner SF2</strong></div><span className={styles.formatChampion}>ECL SPLIT II CHAMPIONS</span></div>
        </div>
        <p className={styles.formatSeries}>Both semifinals and the final are best of three. Win two games to take the series.</p>
      </section>

      <section className={styles.formatCard} aria-labelledby="tie-format-heading">
        <div className={styles.formatCardTitle}><span>03</span><h4 id="tie-format-heading">Tie-breakers</h4></div>
        <p>Teams tied on wins play Bo1 tie-breakers to decide qualification and seeding.</p>
        <p>For a three-way tie for 3rd–5th, compare each team&apos;s total time in games they won. The slowest total win time is eliminated; the other two teams play a Bo1 for 3rd and 4th place.</p>
      </section>
    </section>
  );
}
