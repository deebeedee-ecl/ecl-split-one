import { riotIdKey, splitRiotId } from "@/lib/riot-id";

export type InhouseRawPlayer = {
  nickNameStr?: string;
  nickName?: string;
  detailChampionId?: string | number;
  position?: string;
  teamId?: string | number;
  scoreInfoNum?: number;
  echartsMap?: { goldEarned?: number; totalDamageDealt?: number; killAssisScore?: number };
};

export function normalizeInhouseRole(value?: string | null) {
  const role = value?.trim().toUpperCase();
  if (role === "TOP" || role === "TOP_LANE") return "TOP";
  if (["JUNGLE", "JGL", "JNG"].includes(role ?? "")) return "JGL";
  if (["MID", "MIDDLE", "MID_LANE"].includes(role ?? "")) return "MID";
  if (["ADC", "BOT", "BOTTOM", "BOTTOM_LANE"].includes(role ?? "")) return "ADC";
  if (["SUP", "SUPP", "SUPPORT", "UTILITY"].includes(role ?? "")) return "SUP";
  return null;
}

export function inhouseRawPlayer(report: unknown, name?: string | null, tag?: string | null) {
  const target = riotIdKey(name, tag);
  if (!target) return null;
  const rows = (report as { detail?: { data?: { wgBattleDetailInfo?: InhouseRawPlayer[] } } } | null)?.detail?.data?.wgBattleDetailInfo;
  if (!Array.isArray(rows)) return null;
  return rows.find(player => {
    if (!player || typeof player !== "object") return false;
    const parsed = splitRiotId(player.nickNameStr ?? player.nickName);
    return riotIdKey(parsed.riotName, parsed.riotTag) === target;
  }) ?? null;
}

export function inhouseChampionId(raw?: InhouseRawPlayer | null) {
  const id = String(raw?.detailChampionId ?? "");
  return /^\d{1,6}$/.test(id) && Number(id) > 0 ? id : null;
}
