import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { LiveMatchData } from "@/app/hub/inhouses/InhouseMatchHistoryClient";

type WgPlayer = {
  nickName?: string;
  nickNameStr?: string;
  detailChampionId?: string;
  position?: string;
  teamId?: string;
  scoreInfo?: string;
  totalDamageDealt?: number;  // already-in-K value (e.g. 55.6)
  goldEarned?: number;        // already-in-K value (e.g. 18.5)
  win?: string;               // "Win" | "Fail"
  wasMvp?: string | number;   // "1" or 1 = MVP
  wasSvp?: string | number;   // "1" or 1 = SVP
  echartsMap?: {
    totalDamageDealt?: number; // raw int (e.g. 55557)
    goldEarned?: number;       // raw int (e.g. 18465)
    [key: string]: unknown;
  };
};

type OcrRawJson = {
  detail?: {
    data?: {
      wgBattleDetailInfo?: WgPlayer[];
      teamDetails?: Array<{
        teamId?: string;
        win?: string;              // "Win" | "Fail"
        totalTurretsKilled?: number;
        totalDampenKilled?: number;
        totalDragonKills?: number;
        totalBaronKills?: number;
        banInfoList?: Array<{ championId?: string; banChampionId?: string; [k: string]: unknown }>;
      }>;
    };
  };
  recentMatch?: {
    title?: string;
  };
};

function parseScoreInfo(value: string | undefined) {
  if (!value) return { kills: 0, deaths: 0, assists: 0 };
  const m = value.match(/(\d+)\/(\d+)\/(\d+)/);
  if (!m) return { kills: 0, deaths: 0, assists: 0 };
  return { kills: Number(m[1]), deaths: Number(m[2]), assists: Number(m[3]) };
}

function normalizeRole(position?: string) {
  const role = position?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (role === "TOP" || role === "TOP_LANE") return "TOP";
  if (role === "JUNGLE" || role === "JGL") return "JNG";
  if (role === "MID" || role === "MIDDLE" || role === "MID_LANE") return "MID";
  if (role === "ADC" || role === "BOT" || role === "BOTTOM" || role === "BOTTOM_LANE") return "ADC";
  if (role === "SUP" || role === "SUPPORT" || role === "UTILITY") return "SUPP";
  return "";
}

const roleOrder: Record<string, number> = {
  TOP: 0,
  JNG: 1,
  MID: 2,
  ADC: 3,
  SUPP: 4,
};

type DamageRow = [string, string, number, string?, string?, string?];

function sortDamageRowsByRole(rows: DamageRow[]) {
  return [...rows].sort((a, b) => {
    const aRole = normalizeRole(a[4]);
    const bRole = normalizeRole(b[4]);
    return (roleOrder[aRole] ?? 99) - (roleOrder[bRole] ?? 99);
  });
}

async function loadChampionNames() {
  const file = await readFile(
    path.join(process.cwd(), "public", "lol", "champions", "champions.json"),
    "utf8",
  );
  const champions = JSON.parse(file.replace(/^\uFEFF/, "")) as Array<{ id: number; name: string }>;
  return new Map(champions.map((champion) => [String(champion.id), champion.name]));
}

/** Damage in K — prefer raw echartsMap int, else top-level (already K) */
function playerDamageK(p: WgPlayer): number {
  if (p.echartsMap?.totalDamageDealt != null) return p.echartsMap.totalDamageDealt / 1000;
  return p.totalDamageDealt ?? 0; // top-level is already in K
}

/** Gold in raw units — prefer echartsMap int, else top-level × 1000 */
function playerGoldRaw(p: WgPlayer): number {
  if (p.echartsMap?.goldEarned != null) return p.echartsMap.goldEarned;
  return (p.goldEarned ?? 0) * 1000;
}

function isMvpFlag(p: WgPlayer) {
  return p.wasMvp === "1" || p.wasMvp === 1;
}
function isSvpFlag(p: WgPlayer) {
  return p.wasSvp === "1" || p.wasSvp === 1;
}

function formatGold(g: number) {
  return `${(g / 1000).toFixed(1)}K`;
}

function formatKDA(k: number, d: number, a: number) {
  return `${k}/${d}/${a}`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseDurationFromTitle(title: string): string | null {
  const m = title.match(/用时(\d+)分(\d+)秒/);
  if (m) return `${m[1]}:${m[2].padStart(2, "0")}`;
  return null;
}

export async function fetchInhouseMatches(): Promise<LiveMatchData[]> {
  const championNames = await loadChampionNames();
  const rawMatches = await prisma.match.findMany({
    where: {
      roundLabel: { startsWith: "IH" },
      status: "COMPLETED",
    },
    include: {
      games: {
        include: {
          playerStats: { orderBy: { damage: "desc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rawMatches
    .map((match): LiveMatchData | null => {
      const game = match.games[0];
      if (!game) return null;

      const blueWon = match.winnerTeamId === match.homeTeamId;

      // ── All 10 players from the stored lzyumi OCR JSON ───────────────────
      const ocr = game.ocrRawJson as OcrRawJson | null;
      const wgPlayers: WgPlayer[] = ocr?.detail?.data?.wgBattleDetailInfo ?? [];
      const teamDetails = ocr?.detail?.data?.teamDetails ?? [];

      // Group players by lzyumi teamId
      const groupedByTeam = new Map<string, WgPlayer[]>();
      for (const p of wgPlayers) {
        const tid = p.teamId ?? "?";
        if (!groupedByTeam.has(tid)) groupedByTeam.set(tid, []);
        groupedByTeam.get(tid)!.push(p);
      }

      // Assign blue/red: win === "Win" means winning team
      let blueGroup: WgPlayer[] = [];
      let redGroup: WgPlayer[] = [];
      let blueTeamId = "";
      let redTeamId = "";

      if (groupedByTeam.size === 2) {
        const [groupA, groupB] = Array.from(groupedByTeam.entries());
        const groupAWon = groupA[1].some((p) => p.win === "Win");
        if (blueWon) {
          [blueTeamId, blueGroup] = groupAWon ? groupA : groupB;
          [redTeamId,  redGroup]  = groupAWon ? groupB : groupA;
        } else {
          [blueTeamId, blueGroup] = groupAWon ? groupB : groupA;
          [redTeamId,  redGroup]  = groupAWon ? groupA : groupB;
        }
      } else {
        blueGroup = wgPlayers.slice(0, 5);
        redGroup  = wgPlayers.slice(5, 10);
      }

      // Objectives from teamDetails (not stored in DB for inhouse games)
      const blueTD = teamDetails.find((t) => t.teamId === blueTeamId);
      const redTD  = teamDetails.find((t) => t.teamId === redTeamId);

      // Bans from banInfoList
      const getBans = (td: typeof blueTD): string[] =>
        (td?.banInfoList ?? [])
          .map((b) => b.championId ?? b.banChampionId ?? "")
          .filter(Boolean);

      const blueBans = getBans(blueTD);
      const redBans  = getBans(redTD);

      // Damage rows — use echartsMap (raw int) / 1000 for accuracy
      function wgToDamageRow(p: WgPlayer): DamageRow {
        const name  = p.nickNameStr ?? p.nickName ?? "?";
        const champ = p.detailChampionId ?? "";
        const championName = championNames.get(String(champ)) ?? `Champion ${champ}`;
        const dmgK  = playerDamageK(p);
        const kda   = parseScoreInfo(p.scoreInfo);
        return [name, champ, dmgK, `${kda.kills}/${kda.deaths}/${kda.assists}`, p.position ?? "", championName];
      }

      // Fall back to DB stats only if no OCR data
      const useDbStats = wgPlayers.length === 0;
      const dbBlueStats = game.playerStats.filter((p) => p.teamId === match.homeTeamId);
      const dbRedStats  = game.playerStats.filter((p) => p.teamId === match.awayTeamId);

      function dbToDamageRow(p: typeof dbBlueStats[number]): DamageRow {
        return [p.riotName ?? "?", "", (p.damage ?? 0) / 1000, formatKDA(p.kills, p.deaths, p.assists)];
      }

      const blueDamage: DamageRow[] = sortDamageRowsByRole(
        useDbStats ? dbBlueStats.map(dbToDamageRow) : blueGroup.map(wgToDamageRow),
      );
      const redDamage:  DamageRow[] = sortDamageRowsByRole(
        useDbStats ? dbRedStats.map(dbToDamageRow)  : redGroup.map(wgToDamageRow),
      );

      // KDA totals
      const sumKDA = (players: WgPlayer[]) =>
        players.reduce((a, p) => {
          const s = parseScoreInfo(p.scoreInfo);
          return { k: a.k + s.kills, d: a.d + s.deaths, a: a.a + s.assists };
        }, { k: 0, d: 0, a: 0 });

      const blueKDA = useDbStats
        ? dbBlueStats.reduce((a, p) => ({ k: a.k + p.kills, d: a.d + p.deaths, a: a.a + p.assists }), { k: 0, d: 0, a: 0 })
        : sumKDA(blueGroup);
      const redKDA = useDbStats
        ? dbRedStats.reduce((a, p) => ({ k: a.k + p.kills, d: a.d + p.deaths, a: a.a + p.assists }), { k: 0, d: 0, a: 0 })
        : sumKDA(redGroup);

      // Gold totals (raw → K)
      const blueGoldRaw = useDbStats
        ? dbBlueStats.reduce((s, p) => s + (p.gold ?? 0), 0)
        : blueGroup.reduce((s, p) => s + playerGoldRaw(p), 0);
      const redGoldRaw = useDbStats
        ? dbRedStats.reduce((s, p) => s + (p.gold ?? 0), 0)
        : redGroup.reduce((s, p) => s + playerGoldRaw(p), 0);

      // MVP / SVP from lzyumi flags
      const mvpPlayer = wgPlayers.find(isMvpFlag);
      const svpPlayer = wgPlayers.find(isSvpFlag);
      const toStandout = (p: WgPlayer): [string, string, string, string?] => {
        const kda = parseScoreInfo(p.scoreInfo);
        const championId = p.detailChampionId ?? "";
        return [
          p.nickNameStr ?? p.nickName ?? "?",
          championId,
          `${kda.kills}/${kda.deaths}/${kda.assists}`,
          championNames.get(String(championId)) ?? `Champion ${championId}`,
        ];
      };
      const standouts = mvpPlayer && svpPlayer
        ? { mvp: toStandout(mvpPlayer), svp: toStandout(svpPlayer) }
        : undefined;

      // Duration
      let duration = "–";
      if (game.durationSeconds) {
        duration = formatDuration(game.durationSeconds);
      } else if (ocr?.recentMatch?.title) {
        duration = parseDurationFromTitle(ocr.recentMatch.title) ?? "–";
      }

      // Date
      const d = new Date(match.createdAt);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dateStr = `${d.getDate()} ${months[d.getMonth()]}`;

      const str = (v: number | null | undefined, fallback = "–") =>
        v != null ? String(v) : fallback;

      return {
        id: match.roundLabel ?? "IH Game",
        date: dateStr,
        blue: "Blue Side",
        red: "Red Side",
        score: `${match.homeScore} - ${match.awayScore}`,
        blueResult: blueWon ? "WIN" : "LOSS",
        redResult: blueWon ? "LOSS" : "WIN",
        duration,
        stage: "ECL Ranked Inhouses",
        game: match.roundLabel ?? "IH Game",
        stats: {
          kda:    [formatKDA(blueKDA.k, blueKDA.d, blueKDA.a), formatKDA(redKDA.k, redKDA.d, redKDA.a)] as [string, string],
          gold:   [formatGold(blueGoldRaw), formatGold(redGoldRaw)] as [string, string],
          towers: [str(blueTD?.totalTurretsKilled ?? game.homeTowers), str(redTD?.totalTurretsKilled ?? game.awayTowers)] as [string, string],
          grubs:  [str(blueTD?.totalDampenKilled ?? game.homeInhibitors), str(redTD?.totalDampenKilled ?? game.awayInhibitors)] as [string, string],
          heralds:["–", "–"] as [string, string],
          drakes: [str(blueTD?.totalDragonKills ?? game.homeDrakes), str(redTD?.totalDragonKills ?? game.awayDrakes)] as [string, string],
          elders: ["–", "–"] as [string, string],
          barons: [str(blueTD?.totalBaronKills ?? game.homeBarons), str(redTD?.totalBaronKills ?? game.awayBarons)] as [string, string],
        },
        blueDraft: blueBans,
        redDraft:  redBans,
        blueDamage,
        redDamage,
        goldDiff: [],
        ...(standouts ? { standouts } : {}),
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null) as LiveMatchData[];
}
