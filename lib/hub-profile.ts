export type HubRole = "TOP" | "JNG" | "MID" | "ADC" | "SUPP" | "FILL";

export const HUB_ROLE_ICONS: Record<HubRole, string> = {
  TOP: "/lol/roles/top.png",
  JNG: "/lol/roles/jungle.png",
  MID: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  SUPP: "/lol/roles/support.png",
  FILL: "/lol/roles/fill.png",
};

export function normalizeHubRole(role: string | null | undefined): HubRole | null {
  const value = role?.trim().toUpperCase();
  if (!value) return null;
  if (["TOP", "TOPLANE"].includes(value)) return "TOP";
  if (["JNG", "JGL", "JUNGLE"].includes(value)) return "JNG";
  if (["MID", "MIDDLE"].includes(value)) return "MID";
  if (["ADC", "BOT", "BOTTOM"].includes(value)) return "ADC";
  if (["SUP", "SUPP", "SUPPORT"].includes(value)) return "SUPP";
  if (value === "FILL") return "FILL";
  return null;
}

export function hubRoleLabel(role: HubRole) {
  const labels: Record<HubRole, string> = {
    TOP: "Top",
    JNG: "Jungle",
    MID: "Middle",
    ADC: "Bottom",
    SUPP: "Support",
    FILL: "Fill",
  };

  return labels[role];
}

export type LzyumiRankRow = {
  wins?: number;
  total?: number;
  tier?: string;
  rate?: number;
  losses?: number;
  type?: string;
  winPoint?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getMapOneInfoList(raw: unknown) {
  const root = asRecord(raw);
  const data = asRecord(root?.data);
  const battleInfo = asRecord(root?.battleInfo) ?? asRecord(data?.battleInfo);
  const rows = battleInfo?.mapOneInfoList ?? data?.mapOneInfoList;

  return Array.isArray(rows) ? (rows as LzyumiRankRow[]) : [];
}

export function getLzyumiRankRows(raw: unknown, fallbackRank?: string | null) {
  const rows = getMapOneInfoList(raw);
  const rankedRows = rows.filter((row) => row.tier && row.tier !== "-");
  const fallback =
    fallbackRank && fallbackRank !== "Unranked"
      ? ({ tier: fallbackRank, type: "Solo/Duo" } satisfies LzyumiRankRow)
      : null;

  return {
    solo:
      rankedRows.find((row) => row.type?.includes("\u5355\u53cc\u6392")) ??
      rankedRows.find((row) => row.type?.includes("Solo")) ??
      rankedRows[0] ??
      fallback ??
      null,
    flex:
      rankedRows.find((row) => row.type?.includes("\u7075\u6d3b\u6392\u4f4d")) ??
      rankedRows.find((row) => row.type?.includes("Flex")) ??
      rankedRows[1] ??
      null,
  };
}

const TIER_TRANSLATIONS: Array<[string, string]> = [
  ["\u9ed1\u94c1", "Iron"],
  ["\u9752\u94dc", "Bronze"],
  ["\u767d\u94f6", "Silver"],
  ["\u9ec4\u91d1", "Gold"],
  ["\u94c2\u91d1", "Platinum"],
  ["\u7fe1\u7fe0", "Emerald"],
  ["\u94bb\u77f3", "Diamond"],
  ["\u5927\u5e08", "Master"],
  ["\u5b97\u5e08", "Grandmaster"],
  ["\u738b\u8005", "Challenger"],
];

export function translateLzyumiTier(tier: string | undefined) {
  if (!tier || tier === "-") return "Unranked";

  for (const [source, english] of TIER_TRANSLATIONS) {
    if (tier.startsWith(source)) {
      const division = tier.slice(source.length).trim();
      return division ? `${english} ${division}` : english;
    }
  }

  return tier;
}

export function lzyumiTierColor(tier: string | undefined) {
  const translated = translateLzyumiTier(tier);
  if (translated.startsWith("Iron")) return "text-[#8a8a8a]";
  if (translated.startsWith("Bronze")) return "text-[#cd7f32]";
  if (translated.startsWith("Silver")) return "text-[#c0c0c0]";
  if (translated.startsWith("Gold")) return "text-[#ffd84d]";
  if (translated.startsWith("Platinum")) return "text-[#4fc3a1]";
  if (translated.startsWith("Emerald")) return "text-[#48f0df]";
  if (translated.startsWith("Diamond")) return "text-[#7ec8e3]";
  if (translated.startsWith("Master")) return "text-[#c9a0ff]";
  if (translated.startsWith("Grandmaster")) return "text-[#ff6b6b]";
  if (translated.startsWith("Challenger")) return "text-[#f4c842]";
  return "text-[#aeb5da]";
}

export function formatLzyumiRank(row: LzyumiRankRow | null) {
  if (!row) return { label: "Unranked", lp: null };
  return { label: translateLzyumiTier(row.tier), lp: row.winPoint ?? 0 };
}

export function isSafeProfileImageUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.startsWith("data:image/") || url.startsWith("/") || url.startsWith("blob:");
}
