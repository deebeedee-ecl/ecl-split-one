import Link from "next/link";
import workbookJson from "@/scripts/winter-cup-xlsx-debug.json";
import leaderboardJson from "@/scripts/winter-cup-leaderboard-debug.json";
import { WinterCupArchiveCarousel } from "./WinterCupArchiveCarousel";

type WorkbookSheet = {
  name: string;
  rows: string[][];
};

type RosterTeam = {
  code: string;
  logoUrl: string;
  players: Array<{
    role: string;
    name: string;
  }>;
};

type BracketMatch = {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  winner: string;
};

type BracketRound = {
  stage: string;
  matches: BracketMatch[];
};

type PlayerStat = {
  team: string;
  match: string;
  opponent: string;
  stage: string;
  role: string;
  player: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  won: boolean;
};

type TeamLeaderboardRow = {
  team: string;
  games: number;
  minutes: number;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  towers: number;
  dragons: number;
  goldPerMin: number;
  killsPerMin: number;
  dragonsPerGame: number;
};

type TeamRecordRow = TeamLeaderboardRow & {
  wins: number;
  losses: number;
};

type PlayerLeaderboardRow = {
  player: string;
  team: string;
  role: string;
  games: number;
  minutes: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  kda: number;
  csPerMin: number;
  killsPerMin: number;
  assistsPerMin: number;
};

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const teamCodes = ["HPC", "SK", "BTDT", "KD", "BBB", "SLW"];
const winterCupLogos: Record<string, string> = {
  BBB: "/logos/winter-cup/transparent/BBB.png",
  BTDT: "/logos/winter-cup/transparent/BTDT.png",
  HPC: "/logos/winter-cup/transparent/HPC.png",
  KD: "/logos/winter-cup/transparent/KD.png",
  SK: "/logos/winter-cup/transparent/SK.png",
  SLW: "/logos/winter-cup/transparent/SLW.png",
};

const groups = [
  {
    name: "Group A",
    teams: ["HPC", "BBB", "KD"],
    matches: [
      { home: "HPC", away: "BBB", homeScore: 0, awayScore: 1, winner: "BBB" },
      { home: "BBB", away: "KD", homeScore: 0, awayScore: 1, winner: "KD" },
      { home: "KD", away: "HPC", homeScore: 1, awayScore: 0, winner: "KD" },
    ],
  },
  {
    name: "Group B",
    teams: ["BTDT", "SLW", "SK"],
    matches: [
      { home: "BTDT", away: "SLW", homeScore: 0, awayScore: 1, winner: "SLW" },
      { home: "SK", away: "BTDT", homeScore: 0, awayScore: 1, winner: "BTDT" },
      { home: "SLW", away: "SK", homeScore: 1, awayScore: 0, winner: "SLW" },
    ],
  },
];

const bracketPath: BracketRound[] = [
  {
    stage: "Double Elimination R1",
    matches: [
      { home: "BBB", away: "SK", homeScore: 0, awayScore: 1, winner: "SK" },
      { home: "BTDT", away: "HPC", homeScore: 0, awayScore: 1, winner: "HPC" },
    ],
  },
  {
    stage: "Upper Bracket",
    matches: [
      { home: "SLW", away: "SK", homeScore: 1, awayScore: 0, winner: "SLW" },
      { home: "KD", away: "HPC", homeScore: 1, awayScore: 0, winner: "KD" },
    ],
  },
  {
    stage: "Lower Bracket",
    matches: [
      { home: "BTDT", away: "SK", homeScore: 0, awayScore: 1, winner: "SK" },
      { home: "BBB", away: "HPC", homeScore: 1, awayScore: 0, winner: "BBB" },
    ],
  },
  {
    stage: "Semi-Finals",
    matches: [
      { home: "SLW", away: "BBB", homeScore: 2, awayScore: 0, winner: "SLW" },
      { home: "SK", away: "KD", homeScore: 0, awayScore: 2, winner: "KD" },
    ],
  },
  {
    stage: "Final",
    matches: [
      { home: "SLW", away: "KD", homeScore: 2, awayScore: 0, winner: "SLW" },
    ],
  },
];

function getSheet(name: string) {
  return (workbookJson as WorkbookSheet[]).find((sheet) => sheet.name === name);
}

function getLeaderboardSheet(name: string) {
  return (leaderboardJson as WorkbookSheet[]).find((sheet) => sheet.name === name);
}

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDecimal(value: number, digits = 2) {
  return value.toFixed(digits);
}

function formatGoldTotal(value: number) {
  return `${Math.round(value / 1000)}k`;
}

function cleanCell(value: string | undefined) {
  if (!value || value === "System.Xml.XmlElement") return "";
  return value.trim();
}

function parseOpponent(matchLabel: string) {
  const match = matchLabel.match(/^vs\s+([A-Z]+)/);
  return match?.[1] ?? "";
}

function parseStage(matchLabel: string) {
  const match = matchLabel.match(/\(([^)]+)\)/);
  return match?.[1] ?? "Unknown";
}

function parseRosters(rows: string[][]): RosterTeam[] {
  const header = rows[1] ?? [];
  const roleRows = rows.slice(2, 7);

  return teamCodes.map((code) => {
    const column = header.findIndex((cell) => cleanCell(cell) === code);

    return {
      code,
      logoUrl: winterCupLogos[code] ?? "",
      players: roleRows.map((row) => ({
        role: cleanCell(row[0]),
        name: cleanCell(row[column]),
      })),
    };
  });
}

function parsePlayerStats(rows: string[][]): PlayerStat[] {
  const stats: PlayerStat[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];

    for (let col = 0; col < row.length; col++) {
      const team = cleanCell(row[col]);
      const isHeader =
        teamCodes.includes(team) &&
        cleanCell(row[col + 1]) === "Kills" &&
        cleanCell(row[col + 2]) === "Deaths" &&
        cleanCell(row[col + 3]) === "Assists" &&
        cleanCell(row[col + 4]) === "CS";

      if (!isHeader) continue;

      const labelRow = rows[rowIndex - 1] ?? [];
      const match = cleanCell(labelRow[col + 1]);
      const won = cleanCell(labelRow[col + 5]) !== "LOSER";
      const opponent = parseOpponent(match);
      const stage = parseStage(match);

      for (let offset = 1; offset <= 5; offset++) {
        const playerRow = rows[rowIndex + offset] ?? [];
        const role = cleanCell(playerRow[col]);

        if (!roles.includes(role)) continue;

        const player = cleanCell(playerRow[col + 1]);
        const kills = toNumber(playerRow[col + 2]);
        const deaths = toNumber(playerRow[col + 3]);
        const assists = toNumber(playerRow[col + 4]);
        const cs = toNumber(playerRow[col + 5]);

        if (!player || player === "/" || player === "??") continue;

        stats.push({
          team,
          match,
          opponent,
          stage,
          role,
          player,
          kills,
          deaths,
          assists,
          cs,
          won,
        });
      }
    }
  }

  return stats;
}

function parseTeamRecordsFromStats(rows: string[][], teamLeaderboard: TeamLeaderboardRow[]) {
  const records = new Map<string, { wins: number; losses: number }>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];

    for (let col = 0; col < row.length; col++) {
      const team = cleanCell(row[col]);
      const isHeader =
        teamCodes.includes(team) &&
        cleanCell(row[col + 1]) === "Kills" &&
        cleanCell(row[col + 2]) === "Deaths" &&
        cleanCell(row[col + 3]) === "Assists" &&
        cleanCell(row[col + 4]) === "CS";

      if (!isHeader) continue;

      const labelRow = rows[rowIndex - 1] ?? [];
      const match = cleanCell(labelRow[col + 1]);
      const result = cleanCell(labelRow[col + 5]);
      const topRow = rows[rowIndex + 1] ?? [];
      const topPlayer = cleanCell(topRow[col + 1]);

      if (!match.startsWith("vs ") || !topPlayer || topPlayer === "/" || topPlayer === "??") {
        continue;
      }

      const record = records.get(team) ?? { wins: 0, losses: 0 };
      if (result === "LOSER") {
        record.losses += 1;
      } else {
        record.wins += 1;
      }
      records.set(team, record);
    }
  }

  return new Map(
    teamLeaderboard.map((team) => {
      const parsedRecord = records.get(team.team);
      const wins = parsedRecord?.wins ?? 0;
      const fallbackLosses = Math.max(0, team.games - wins);

      return [
        team.team,
        {
          ...team,
          wins,
          losses: parsedRecord?.losses ?? fallbackLosses,
        },
      ];
    })
  );
}

function parseTeamLeaderboard(rows: string[][]): TeamLeaderboardRow[] {
  return rows
    .slice(1)
    .filter((row) => cleanCell(row[0]) && cleanCell(row[0]) !== "0")
    .map((row) => ({
      team: cleanCell(row[0]),
      games: toNumber(row[1]),
      minutes: toNumber(row[2]),
      kills: toNumber(row[3]),
      deaths: toNumber(row[4]),
      assists: toNumber(row[5]),
      gold: toNumber(row[6]),
      towers: toNumber(row[7]),
      dragons: toNumber(row[8]),
      goldPerMin: toNumber(row[9]),
      killsPerMin: toNumber(row[10]),
      dragonsPerGame: toNumber(row[11]),
    }));
}

function parsePlayerLeaderboard(rows: string[][]): PlayerLeaderboardRow[] {
  return rows
    .slice(1)
    .filter((row) => cleanCell(row[0]) && cleanCell(row[0]) !== "0")
    .map((row) => ({
      player: cleanCell(row[0]),
      team: cleanCell(row[1]),
      role: cleanCell(row[2]),
      games: toNumber(row[3]),
      minutes: toNumber(row[4]),
      kills: toNumber(row[5]),
      deaths: toNumber(row[6]),
      assists: toNumber(row[7]),
      cs: toNumber(row[8]),
      kda: toNumber(row[9]),
      csPerMin: toNumber(row[10]),
      killsPerMin: toNumber(row[11]),
      assistsPerMin: toNumber(row[12]),
    }));
}

function parseChampionHistory(rows: string[][]) {
  const start = rows.findIndex((row) => cleanCell(row[0]) === "Match History Per Team");
  if (start === -1) return new Map<string, Record<string, string[]>>();

  const history = new Map<string, Record<string, string[]>>();
  let currentTeam = "";

  for (const row of rows.slice(start + 1)) {
    const first = cleanCell(row[0]);

    if (first === "Match #") {
      currentTeam = row.map(cleanCell).find((cell) => teamCodes.includes(cell)) ?? "";
      if (currentTeam) {
        history.set(currentTeam, Object.fromEntries(roles.map((role) => [role, []])));
      }
      continue;
    }

    if (!currentTeam || !first || first === "Match History Per Team") continue;

    const playedChampions = row.slice(2, 7).map(cleanCell);
    if (playedChampions.every((champion) => !champion || champion === "/" || champion === "??")) {
      continue;
    }

    for (const [index, champ] of playedChampions.entries()) {
      if (champ && champ !== "/" && champ !== "??") {
        const role = roles[index];
        history.get(currentTeam)?.[role]?.push(champ);
      }
    }
  }

  return history;
}

function topChampions(champions: string[], limit = 4) {
  const counts = new Map<string, number>();
  for (const champion of champions) {
    counts.set(champion, (counts.get(champion) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([champion, count]) => ({ champion, count }));
}

export default function WinterCupPage() {
  const matchesSheet = getSheet("Matches");
  const statsSheet = getSheet("Stats");
  const teamLeaderboardSheet = getLeaderboardSheet("Team_Input");
  const playerLeaderboardSheet = getLeaderboardSheet("Player_Input");

  if (!matchesSheet || !statsSheet || !teamLeaderboardSheet || !playerLeaderboardSheet) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-20 text-white">
        <div className="mx-auto max-w-5xl border border-[#1f1f1f] bg-[#0d0d0d] p-8">
          Winter Cup workbook data could not be loaded.
        </div>
      </main>
    );
  }

  const rosters = parseRosters(matchesSheet.rows);
  const stats = parsePlayerStats(statsSheet.rows);
  const teamLeaderboard = parseTeamLeaderboard(teamLeaderboardSheet.rows);
  const playerLeaderboard = parsePlayerLeaderboard(playerLeaderboardSheet.rows);
  const championHistory = parseChampionHistory(matchesSheet.rows);
  const teamRecordsByCode = parseTeamRecordsFromStats(statsSheet.rows, teamLeaderboard);

  const killLeader = playerLeaderboard.slice().sort((a, b) => b.kills - a.kills)[0];
  const assistLeader = playerLeaderboard.slice().sort((a, b) => b.assists - a.assists)[0];
  const csLeader = playerLeaderboard.slice().sort((a, b) => b.cs - a.cs)[0];
  const kdaLeader = playerLeaderboard.slice().sort((a, b) => b.kda - a.kda)[0];
  const teamKillLeader = teamLeaderboard.slice().sort((a, b) => b.kills - a.kills)[0];
  const objectiveLeader = teamLeaderboard.slice().sort((a, b) => b.dragons - a.dragons)[0];
  const goldLeader = teamLeaderboard.slice().sort((a, b) => b.gold - a.gold)[0];
  const towerLeader = teamLeaderboard.slice().sort((a, b) => b.towers - a.towers)[0];

  const leaderboard = playerLeaderboard
    .slice()
    .sort((a, b) => b.kda - a.kda || b.kills - a.kills);
  const teamCards = rosters.map((team) => {
    const teamStats = teamRecordsByCode.get(team.code);
    const roleChampions = championHistory.get(team.code) ?? {};

    return {
      ...team,
      record: {
        games: teamStats?.games ?? 0,
        wins: teamStats?.wins ?? 0,
        losses: teamStats?.losses ?? 0,
      },
      stats: teamStats ?? null,
      championsByRole: Object.fromEntries(
        roles.map((role) => [role, topChampions(roleChampions[role] ?? [], 3)])
      ),
    };
  });

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate min-h-[760px] overflow-hidden border-b border-[#1f1f1f] bg-[#050505]">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          src="/videos/winter-cup.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#050505_0%,rgba(5,5,5,0.92)_26%,rgba(5,5,5,0.52)_58%,rgba(5,5,5,0.78)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_38%,rgba(177,18,38,0.32),transparent_34%),linear-gradient(115deg,rgba(177,18,38,0.24),transparent_34%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#050505] via-[#050505]/78 to-transparent" />
        <div className="absolute left-0 top-0 hidden h-full w-[34vw] skew-x-[-12deg] bg-[#b11226]/24 blur-[1px] lg:block" />

        <div className="relative mx-auto flex min-h-[760px] max-w-7xl flex-col justify-center px-4 py-24 sm:px-6 lg:py-32">
          <Link
            href="/tournaments"
            className="inline-flex w-fit border border-white/10 bg-black/60 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#d1d5db] backdrop-blur transition hover:border-[#b11226] hover:text-white"
          >
            Back to Tournaments
          </Link>

          <h1
            className="mt-10 max-w-6xl font-black uppercase text-white drop-shadow-[0_24px_54px_rgba(0,0,0,0.82)] [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]"
            style={{ fontSize: "clamp(5.5rem, 11vw, 11rem)", lineHeight: 0.78 }}
          >
            Winter
            <span className="block text-[#b11226] drop-shadow-[0_10px_24px_rgba(177,18,38,0.4)]">Cup</span>
          </h1>
          <p className="mt-9 max-w-4xl text-xl leading-9 text-[#e5e7eb] drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
            Archived Winter Cup records parsed from the supplied match-history
            workbook: rosters, bracket path, final series, champion pools, and
            player stat leaders.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat label="Champion" value="SLW" />
            <HeroStat label="Runner-up" value="KD" />
            <HeroStat label="Teams" value={rosters.length} />
            <HeroStat label="Tracked Players" value={playerLeaderboard.length} />
          </div>
        </div>
      </section>

      <WinterCupArchiveCarousel
        groups={groups}
        bracketPath={bracketPath}
        awards={[
          { label: "Kill Leader", name: killLeader?.player ?? "TBC", meta: killLeader ? `${killLeader.team} / ${killLeader.role}` : "-", value: `${killLeader?.kills ?? 0} kills` },
          { label: "Assist Leader", name: assistLeader?.player ?? "TBC", meta: assistLeader ? `${assistLeader.team} / ${assistLeader.role}` : "-", value: `${assistLeader?.assists ?? 0} assists` },
          { label: "KDA Leader", name: kdaLeader?.player ?? "TBC", meta: kdaLeader ? `${kdaLeader.team} / ${kdaLeader.role}` : "-", value: `${kdaLeader ? formatDecimal(kdaLeader.kda) : "0.00"} KDA` },
          { label: "CS Leader", name: csLeader?.player ?? "TBC", meta: csLeader ? `${csLeader.team} / ${csLeader.role}` : "-", value: `${csLeader?.cs ?? 0} CS` },
        ]}
        teamAwards={[
          { label: "Most Kills", name: teamKillLeader?.team ?? "TBC", meta: teamKillLeader ? `${teamKillLeader.games} games / ${formatDecimal(teamKillLeader.killsPerMin)} kills per min` : "-", value: `${teamKillLeader?.kills ?? 0} kills` },
          { label: "Most Dragons", name: objectiveLeader?.team ?? "TBC", meta: objectiveLeader ? `${formatDecimal(objectiveLeader.dragonsPerGame)} dragons per game` : "-", value: `${objectiveLeader?.dragons ?? 0} dragons` },
          { label: "Most Gold", name: goldLeader?.team ?? "TBC", meta: goldLeader ? `${formatDecimal(goldLeader.goldPerMin)} gold per min` : "-", value: formatGoldTotal(goldLeader?.gold ?? 0) },
          { label: "Most Towers", name: towerLeader?.team ?? "TBC", meta: towerLeader ? `${towerLeader.games} games` : "-", value: `${towerLeader?.towers ?? 0} towers` },
        ]}
        leaderboard={leaderboard}
        teams={teamCards}
      />
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-white/10 bg-black/58 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b8bec8]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
