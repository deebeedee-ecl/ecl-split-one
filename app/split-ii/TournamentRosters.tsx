import Image from "next/image";
import type { CSSProperties } from "react";
import { SPLIT_II_TEAMS } from "@/lib/tournaments/split-ii-fixtures";
import { SPLIT_II_ROSTERS } from "@/lib/tournaments/split-ii-rosters";
import type { TournamentRosterEntry } from "@/lib/tournaments/split-ii-config";
import type { TournamentData } from '@/lib/tournaments/match-types';
import styles from "./split-ii.module.css";

export default function TournamentRosters({ players, loading, teams }: { players: readonly TournamentRosterEntry[]; loading: boolean; teams?:TournamentData['teams'] }) {
  const normalize = (name: string) => name.trim().toLowerCase();
  const riotIds = new Map<string, string | undefined>();
  for (const player of players) {
    const key = normalize(player.name);
    // Never choose an identity arbitrarily if display names are ambiguous.
    riotIds.set(key, riotIds.has(key) ? undefined : player.riotId);
  }
  return (
    <section aria-labelledby="team-rosters-heading">
      <div className={styles.rosterBoardHeading}>
        <p>ECL SPLIT II / ROSTER BOARD</p>
        <h3 id="team-rosters-heading">The final five.</h3>
        <span>The teams are drawn. Captains lead the way. Each pick keeps its original pot number.</span>
      </div>
      <div className={styles.teamRosterGrid} aria-label="Split II team rosters">
        {SPLIT_II_ROSTERS.map(roster => {
          const stored=teams?.find(t=>t.key===roster.team);
          const team = stored??SPLIT_II_TEAMS[roster.team];
          const members: {name:string;pot:number|null;riotId?:string}[] = stored?.members??[{ name: roster.captain, pot: null }, ...roster.picks];
          return (
            <article key={roster.team} className={styles.teamRosterCard} style={{ "--team-accent": roster.accent } as CSSProperties} aria-labelledby={`roster-${roster.team}`}>
              <div className={styles.teamRosterLogo}><Image src={`/kook/split2/${roster.team}.png`} alt="" width={72} height={72} /></div>
              <p className={styles.teamRosterEyebrow}>ECL SPLIT II / TEAM ROSTER</p>
              <h4 id={`roster-${roster.team}`}>{team.name}</h4>
              <ol className={styles.teamRosterList} aria-label={`${team.name} players`}>
                {members.map(member => (
                  <li key={member.name} data-captain={member.pot === null || undefined}>
                    <span className={styles.teamRosterLabel}>{member.pot === null ? "Team captain" : `Pot ${String(member.pot).padStart(2, "0")}`}</span>
                    <div className={styles.teamRosterIdentity}>
                      <strong><span className={styles.teamRosterTag}>{team.tag}</span>{" "}<span className={styles.teamRosterName}>{member.name}</span></strong>
                      <span className={styles.teamRosterRiotId}>{member.riotId??riotIds.get(normalize(member.name)) ?? (loading ? "Loading Riot ID…" : "Riot ID unavailable")}</span>
                    </div>
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
