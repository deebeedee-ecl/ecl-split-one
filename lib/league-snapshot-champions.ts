export function leagueSnapshotChampions(snapshot: unknown) {
  const rows = (snapshot as { data?: { recentState?: { common_use_champions?: unknown } } } | null)?.data?.recentState?.common_use_champions;
  if (!Array.isArray(rows)) return [];
  const champions = new Map<string, number>();
  for (const row of rows.slice(0, 1000)) {
    if (!row || typeof row !== "object") continue;
    const championId = String(row.key ?? "");
    const games = typeof row.value === "number" || typeof row.value === "string" ? Number(row.value) : NaN;
    if (!/^\d{1,6}$/.test(championId) || Number(championId) <= 0 || !Number.isSafeInteger(games) || games <= 0) continue;
    champions.set(championId, Math.max(games, champions.get(championId) ?? 0));
  }
  return [...champions].map(([championId, games]) => ({ championId, games }))
    .sort((a, b) => b.games - a.games || Number(a.championId) - Number(b.championId)).slice(0, 3);
}
