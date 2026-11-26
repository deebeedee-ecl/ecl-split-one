import { ChinaStatsLiveLookupClient } from "../ChinaStatsLiveLookupClient";
import { CHINA_STATS_SERVER_KEYS, type ChinaStatsServerKey } from "@/lib/china-stats-servers";

export default async function ChinaStatsLiveLookupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const riotId = typeof values.riotId === "string" ? values.riotId.slice(0, 80) : "";
  const server = CHINA_STATS_SERVER_KEYS.includes(values.server as ChinaStatsServerKey)
    ? values.server as ChinaStatsServerKey
    : "ionia";
  return <ChinaStatsLiveLookupClient initialRiotId={riotId} initialServer={server} />;
}
