import { riotIdKey, riotNameKey, splitRiotId } from "@/lib/riot-id";

type DisplayPlayer = {
  nickNameStr?: string;
  nickName?: string;
  detailChampionId?: string | number;
  position?: string;
  win?: string;
  scoreInfo?: string;
};

const roleLabels: Record<string, string> = {
  TOP: "Top",
  TOP_LANE: "Top",
  JUNGLE: "Jungle",
  JGL: "Jungle",
  MID: "Mid",
  MIDDLE: "Mid",
  MID_LANE: "Mid",
  ADC: "ADC",
  BOT: "ADC",
  BOTTOM: "ADC",
  BOTTOM_LANE: "ADC",
  SUPPORT: "Support",
  SUP: "Support",
  UTILITY: "Support",
};

export type LzyumiPlayerSummary = {
  champion: string;
  role: string;
  result: "Win" | "Loss" | "Result unavailable";
  kda: string | null;
};

export async function loadChampionNames() {
  const text = await fetch("/lol/champions/champions.json").then((response) => response.text());
  const champions = JSON.parse(text.replace(/^\uFEFF/, "")) as Array<{
    id: number;
    name: string;
  }>;
  return new Map(champions.map((champion) => [String(champion.id), champion.name]));
}

export function championName(
  championId: string | number | null | undefined,
  championNames?: ReadonlyMap<string, string>,
) {
  if (championId === null || championId === undefined) return "Champion unavailable";
  return championNames?.get(String(championId)) ?? `Champion ${championId}`;
}

export function roleName(position: string | null | undefined) {
  const normalized = position?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
  return roleLabels[normalized] ?? "Role unavailable";
}

export function resultName(result: string | null | undefined): LzyumiPlayerSummary["result"] {
  const normalized = result?.trim().toLowerCase();
  if (normalized === "win" || normalized === "victory") return "Win";
  if (normalized === "fail" || normalized === "loss" || normalized === "defeat") return "Loss";
  return "Result unavailable";
}

export function summarizeLzyumiPlayer(
  player: DisplayPlayer,
  championNames?: ReadonlyMap<string, string>,
): LzyumiPlayerSummary {
  return {
    champion: championName(player.detailChampionId, championNames),
    role: roleName(player.position),
    result: resultName(player.win),
    kda: player.scoreInfo?.trim() || null,
  };
}

export function findLzyumiPlayer(
  players: DisplayPlayer[],
  riotName: string | null | undefined,
  riotTag?: string | null,
) {
  const targetKey = riotIdKey(riotName, riotTag);
  const targetNameKey = riotNameKey(riotName);
  if (!targetKey && !targetNameKey) return null;

  const fullMatch = targetKey
    ? players.find((player) => {
      const parsed = splitRiotId(player.nickNameStr ?? player.nickName);
      return riotIdKey(parsed.riotName, parsed.riotTag) === targetKey;
    })
    : null;

  if (fullMatch) return fullMatch;

  if (!targetNameKey) return null;

  const nameMatches = players.filter((player) => {
    const parsed = splitRiotId(player.nickNameStr ?? player.nickName);
    return riotNameKey(parsed.riotName) === targetNameKey;
  });

  return nameMatches.length === 1 ? nameMatches[0] : null;
}

export function englishDuration(title?: string, titleTime?: string) {
  const source = `${title ?? ""} ${titleTime ?? ""}`;
  const chinese = source.match(/(?:\u7528\u65f6)?\s*(\d+)\s*\u5206\s*(\d+)\s*\u79d2/);
  if (chinese) return `${Number(chinese[1])}m ${Number(chinese[2])}s`;

  const clock = source.match(/\b(\d{1,2}):(\d{2})\b/);
  if (clock) return `${Number(clock[1])}m ${Number(clock[2])}s`;

  return "Duration unavailable";
}
