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
      const blueStats = game.playerStats.filter((p) => p.teamId === match.homeTeamId);
      const redStats = game.playerStats.filter((p) => p.teamId === match.awayTeamId);

      // Parse champion IDs from ocrRawJson
      const ocr = game.ocrRawJson as OcrRawJson | null;
      const wgPlayers = ocr?.detail?.data?.wgBattleDetailInfo ?? [];
      const champMap = new Map<string, string>();
      for (const p of wgPlayers) {
        const name = p.nickName ?? p.nickNameStr?.split("#")[0] ?? "";
        if (name && p.detailChampionId) champMap.set(name.toLowerCase(), p.detailChampionId);
      }

      const getChampion = (riotName: string | null) => {
        if (!riotName) return "";
        return champMap.get(riotName.toLowerCase()) ?? "";
      };

      const buildDamageRow = (stats: typeof blueStats): [string, string, number, string][] =>
        stats.map((p) => [
          p.riotName ?? "?",
          getChampion(p.riotName),
          (p.damage ?? 0) / 1000,
          formatKDA(p.kills, p.deaths, p.assists),
        ]);

      // Totals
      const blueKDA = blueStats.reduce(
        (a, p) => ({ k: a.k + p.kills, d: a.d + p.deaths, a: a.a + p.assists }),
        { k: 0, d: 0, a: 0 },
      );
      const redKDA = redStats.reduce(
        (a, p) => ({ k: a.k + p.kills, d: a.d + p.deaths, a: a.a + p.assists }),
        { k: 0, d: 0, a: 0 },
      );
      const blueGold = blueStats.reduce((s, p) => s + (p.gold ?? 0), 0);
      const redGold = redStats.reduce((s, p) => s + (p.gold ?? 0), 0);

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
          gold: [formatGold(blueGold), formatGold(redGold)] as [string, string],
          towers: [str(game.homeTowers), str(game.awayTowers)] as [string, string],
          grubs: ["–", "–"] as [string, string],
          heralds: ["–", "–"] as [string, string],
          drakes: [str(game.homeDrakes), str(game.awayDrakes)] as [string, string],
          elders: ["–", "–"] as [string, string],
          barons: [str(game.homeBarons), str(game.awayBarons)] as [string, string],
        },
        blueDraft: [],
        redDraft: [],
        blueDamage: buildDamageRow(blueStats),
        redDamage: buildDamageRow(redStats),
        goldDiff: [],
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null) as LiveMatchData[];
}
