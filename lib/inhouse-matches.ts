import { prisma } from "@/lib/prisma";
import type { LiveMatchData } from "@/app/hub/inhouses/InhouseMatchHistoryClient";

type OcrRawJson = {
  detail?: {
    data?: {
      wgBattleDetailInfo?: Array<{
        nickName?: string;
        nickNameStr?: string;
        detailChampionId?: string;
        teamId?: string;
        scoreInfo?: string;         // "K/D/A" string
        totalDamageDealt?: number;
        goldEarned?: number;
        win?: string;               // "1" = win, "0" = loss
        echartsMap?: Record<string, unknown>;
      }>;
      teamDetails?: Array<{
        teamId?: string;
        totalTurretsKilled?: number;
        totalDragonKills?: number;
        totalBaronKills?: number;
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

      // ── All 10 players come from the stored lzyumi OCR JSON ──────────────
      const ocr = game.ocrRawJson as OcrRawJson | null;
      const wgPlayers = ocr?.detail?.data?.wgBattleDetailInfo ?? [];

      // Group by lzyumi teamId — two groups (100/200 or 1/2 etc.)
      const groupedByTeam = new Map<string, typeof wgPlayers>();
      for (const p of wgPlayers) {
        const tid = p.teamId ?? "?";
        if (!groupedByTeam.has(tid)) groupedByTeam.set(tid, []);
        groupedByTeam.get(tid)!.push(p);
      }

      // Determine which group won by checking the `win` field
      let blueGroup: typeof wgPlayers = [];
      let redGroup: typeof wgPlayers = [];

      if (groupedByTeam.size === 2) {
        const [groupA, groupB] = Array.from(groupedByTeam.values());
        const groupAWon = groupA.some((p) => p.win === "1");
        if (blueWon) {
          blueGroup = groupAWon ? groupA : groupB;
          redGroup  = groupAWon ? groupB : groupA;
        } else {
          blueGroup = groupAWon ? groupB : groupA;
          redGroup  = groupAWon ? groupA : groupB;
        }
      } else {
        // Fallback: split 5/5 if teamId not available
        blueGroup = wgPlayers.slice(0, 5);
        redGroup  = wgPlayers.slice(5, 10);
      }

      // Fall back to MatchGamePlayerStat if wgBattleDetailInfo is empty
      const useDbStats = wgPlayers.length === 0;
      const dbBlueStats = game.playerStats.filter((p) => p.teamId === match.homeTeamId);
      const dbRedStats  = game.playerStats.filter((p) => p.teamId === match.awayTeamId);

      type DamageRow = [string, string, number, string];

      function wgToDamageRow(p: typeof wgPlayers[number]): DamageRow {
        const name    = p.nickNameStr ?? p.nickName ?? "?";
        const champId = p.detailChampionId ?? "";
        const dmgRaw  = p.totalDamageDealt ?? (p.echartsMap?.totalDamageDealt as number | undefined) ?? 0;
        const kda     = parseScoreInfo(p.scoreInfo);
        return [
          name,
          champId,
          dmgRaw / 1000,
          `${kda.kills}/${kda.deaths}/${kda.assists}`,
        ];
      }

      function dbToDamageRow(p: typeof dbBlueStats[number]): DamageRow {
        return [
          p.riotName ?? "?",
          "",
          (p.damage ?? 0) / 1000,
          formatKDA(p.kills, p.deaths, p.assists),
        ];
      }

      const blueDamage: DamageRow[] = useDbStats
        ? dbBlueStats.map(dbToDamageRow)
        : blueGroup.map(wgToDamageRow);
      const redDamage: DamageRow[] = useDbStats
        ? dbRedStats.map(dbToDamageRow)
        : redGroup.map(wgToDamageRow);

      const blueDraft = blueGroup.map((p) => p.detailChampionId ?? "").filter(Boolean);
      const redDraft  = redGroup.map((p) => p.detailChampionId ?? "").filter(Boolean);

      // Totals — prefer DB stats if available (already validated), else sum from lzyumi
      const blueStats = useDbStats ? dbBlueStats : [];
      const redStats  = useDbStats ? dbRedStats  : [];

      const blueKDA = blueStats.length > 0
        ? blueStats.reduce((a, p) => ({ k: a.k + p.kills, d: a.d + p.deaths, a: a.a + p.assists }), { k: 0, d: 0, a: 0 })
        : blueGroup.reduce((a, p) => {
            const s = parseScoreInfo(p.scoreInfo);
            return { k: a.k + s.kills, d: a.d + s.deaths, a: a.a + s.assists };
          }, { k: 0, d: 0, a: 0 });

      const redKDA = redStats.length > 0
        ? redStats.reduce((a, p) => ({ k: a.k + p.kills, d: a.d + p.deaths, a: a.a + p.assists }), { k: 0, d: 0, a: 0 })
        : redGroup.reduce((a, p) => {
            const s = parseScoreInfo(p.scoreInfo);
            return { k: a.k + s.kills, d: a.d + s.deaths, a: a.a + s.assists };
          }, { k: 0, d: 0, a: 0 });

      const blueGoldSum = blueStats.length > 0
        ? blueStats.reduce((s, p) => s + (p.gold ?? 0), 0)
        : blueGroup.reduce((s, p) => s + ((p.goldEarned ?? (p.echartsMap?.goldEarned as number | undefined)) ?? 0), 0);
      const redGoldSum = redStats.length > 0
        ? redStats.reduce((s, p) => s + (p.gold ?? 0), 0)
        : redGroup.reduce((s, p) => s + ((p.goldEarned ?? (p.echartsMap?.goldEarned as number | undefined)) ?? 0), 0);

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

      // Objectives
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
          kda: [formatKDA(blueKDA.k, blueKDA.d, blueKDA.a), formatKDA(redKDA.k, redKDA.d, redKDA.a)] as [string, string],
          gold: [formatGold(blueGoldSum), formatGold(redGoldSum)] as [string, string],
          towers: [str(game.homeTowers), str(game.awayTowers)] as [string, string],
          grubs: ["–", "–"] as [string, string],
          heralds: ["–", "–"] as [string, string],
          drakes: [str(game.homeDrakes), str(game.awayDrakes)] as [string, string],
          elders: ["–", "–"] as [string, string],
          barons: [str(game.homeBarons), str(game.awayBarons)] as [string, string],
        },
        blueDraft: blueDraft,
        redDraft: redDraft,
        blueDamage: blueDamage,
        redDamage: redDamage,
        goldDiff: [],
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null) as LiveMatchData[];
}
