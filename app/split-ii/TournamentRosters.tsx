import Image from "next/image";
import type { CSSProperties } from "react";
import { SPLIT_II_TEAMS } from "@/lib/tournaments/split-ii-fixtures";
import { SPLIT_II_ROSTERS } from "@/lib/tournaments/split-ii-rosters";
import styles from "./split-ii.module.css";

export default function TournamentRosters() {
  return (
    <section aria-labelledby="team-rosters-heading">
      <div className={styles.rosterBoardHeading}>
        <p>ECL SPLIT II / ROSTER BOARD</p>
        <h3 id="team-rosters-heading">The final five.</h3>
        <span>The teams are drawn. Captains lead the way. Each pick keeps its original pot number.</span>
      </div>
      <div className={styles.teamRosterGrid} aria-label="Split II team rosters">
        {SPLIT_II_ROSTERS.map(roster => {
          const team = SPLIT_II_TEAMS[roster.team];
          const members = [{ name: roster.captain, pot: null }, ...roster.picks];
          return (
            <article key={roster.team} className={styles.teamRosterCard} style={{ "--team-accent": roster.accent } as CSSProperties} aria-labelledby={`roster-${roster.team}`}>
              <div className={styles.teamRosterLogo}><Image src={`/kook/split2/${roster.team}.png`} alt="" width={72} height={72} /></div>
              <p className={styles.teamRosterEyebrow}>ECL SPLIT II / TEAM ROSTER</p>
              <h4 id={`roster-${roster.team}`}>{team.name}</h4>
              <ol className={styles.teamRosterList} aria-label={`${team.name} players`}>
                {members.map(member => (
                  <li key={member.name} data-captain={member.pot === null || undefined}>
                    <span className={styles.teamRosterLabel}>{member.pot === null ? "Team captain" : `Pot ${String(member.pot).padStart(2, "0")}`}</span>
                    <strong><span className={styles.teamRosterTag}>{team.tag}</span>{" "}<span className={styles.teamRosterName}>{member.name}</span></strong>
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
    </section>
  );
}
