import Image from "next/image";
import { SPLIT_II_FIXTURE_WEEKS, SPLIT_II_TEAMS } from "@/lib/tournaments/split-ii-fixtures";
import styles from "./split-ii.module.css";

export default function TournamentFixtures() {
  return (
    <section aria-labelledby="fixtures-heading">
      <div className={styles.sectionHeading}>
        <div><p>ECL SPLIT II / FIXTURES</p><h3 id="fixtures-heading">Round robin fixtures.</h3></div>
      </div>
      <p className={styles.fixturesIntro}>Two Bo1 matches per team each week. Every team plays every other team once.</p>
      <p className={styles.fixturesTiming}>Match dates and times TBC.</p>
      <div className={styles.fixtureWeeks}>
        {SPLIT_II_FIXTURE_WEEKS.map(({ week, matches }) => (
          <section key={week} className={styles.fixtureWeek} aria-labelledby={`fixtures-week-${week}`}>
            <div className={styles.fixtureWeekHeading}>
              <div><h4 id={`fixtures-week-${week}`}>Week {week}</h4><p>5 matches / 2 per team</p></div>
              <span>Bo1</span>
            </div>
            <ol className={styles.fixtureList} aria-label={`Week ${week} fixtures`}>
              {matches.map(([first, second], index) => (
                <li key={`${first}-${second}`}>
                  <span className={styles.fixtureNumber}>{String((week - 1) * 5 + index + 1).padStart(2, "0")}</span>
                  <div className={styles.fixtureTeam}><Image src={`/split-ii/teams/${first}.png`} alt="" width={28} height={28} /><strong>{SPLIT_II_TEAMS[first].name}</strong></div>
                  <span className={styles.fixtureVersus}>vs</span>
                  <div className={`${styles.fixtureTeam} ${styles.fixtureOpponent}`}><strong>{SPLIT_II_TEAMS[second].name}</strong><Image src={`/split-ii/teams/${second}.png`} alt="" width={28} height={28} /></div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
