import { riotIdKey, splitRiotId } from "@/lib/riot-id";

export type InhouseRawPlayer = {
  nickNameStr?: string;
  nickName?: string;
  detailChampionId?: string | number;
  position?: string;
  teamId?: string | number;
  scoreInfoNum?: number;
  totalDamageDealt?: number;
  goldEarned?: number;
  visionScore?: number;
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

function recordedNumber(value: unknown) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function inhouseScoreboardMetrics(report: unknown, raw: InhouseRawPlayer | null, stored: { damage: number | null; gold: number | null; visionScore: number | null }) {
  const legacy = Array.isArray((report as { detail?: { data?: { wgBattleDetailInfo?: unknown } } } | null)?.detail?.data?.wgBattleDetailInfo);
  const metric = (exact: unknown, thousands: unknown, canonical: number | null) => {
    const precise = recordedNumber(exact);
    if (precise !== null) return { value: Math.round(precise), approximate: false };
    const rounded = recordedNumber(thousands);
    // Lzyumi's top-level damage/gold are K values; echartsMap contains full units.
    if (rounded !== null) return { value: Math.round(rounded * 1000), approximate: true };
    return { value: legacy ? null : recordedNumber(canonical), approximate: false };
  };
  const damage = metric(raw?.echartsMap?.totalDamageDealt, raw?.totalDamageDealt, stored.damage);
  const gold = metric(raw?.echartsMap?.goldEarned, raw?.goldEarned, stored.gold);
  return {
    damage: damage.value, gold: gold.value, damageApproximate: damage.approximate, goldApproximate: gold.approximate,
    vision: recordedNumber(stored.visionScore) ?? recordedNumber(raw?.visionScore),
  };
}
