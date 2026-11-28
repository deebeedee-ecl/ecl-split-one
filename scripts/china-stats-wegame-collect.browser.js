/* Run this entire file in Edge DevTools Console on the logged-in WeGame rank page. */
void (async () => {
  const selectedArea = Number(window.prompt("WeGame server area: 1 = Ionia, 31 = Super Server", "31"));
  const server = selectedArea === 1
    ? { platform: "HN1", label: "Ionia" }
    : selectedArea === 31
      ? { platform: "BGP2", label: "Super Server" }
      : null;
  if (!server) throw new Error("Choose area 1 or 31.");

  const endpoint = "/api/v1/wegame.pallas.game.LolBattle/GetTierRank";
  const tierName = new Map([[0, "CHALLENGER"], [7, "GRANDMASTER"], [6, "MASTER"]]);
  const tierOrder = new Map([[0, 0], [7, 1], [6, 2]]);
  const queue = "RANKED_SOLO_5x5";

  async function page(offset, limit = 10) {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "trpc-caller": "wegame.pallas.web.LolBattle",
      },
      body: JSON.stringify({
        rank_name: "solo",
        area: selectedArea,
        limit,
        offset,
        from_src: "lol_helper",
      }),
    });
    if (!response.ok) throw new Error(`WeGame returned HTTP ${response.status}.`);
    const body = await response.json();
    if (body?.result?.error_code !== 0 || !Array.isArray(body?.ranks)) {
      throw new Error("The logged-in WeGame rank request was rejected.");
    }
    return body;
  }

  async function at(offset) {
    const body = await page(offset, 1);
    const row = body.ranks[0];
    if (!row || !tierName.has(row.tier)) throw new Error(`No apex row at offset ${offset}.`);
    return { tier: row.tier, total: body.total };
  }

  async function lastOffsetThroughTier(expectedTier, total) {
    const expectedOrder = tierOrder.get(expectedTier);
    if (expectedOrder === undefined) throw new Error("Unsupported apex tier boundary.");
    let low = 0;
    let high = total - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const candidateOrder = tierOrder.get((await at(middle)).tier);
      if (candidateOrder !== undefined && candidateOrder <= expectedOrder) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  const first = await at(0);
  const total = first.total;
  if (!Number.isInteger(total) || total < 3 || total > 100_000 || first.tier !== 0) {
    throw new Error("WeGame returned an unexpected apex ladder shape.");
  }
  const lastChallengerOffset = await lastOffsetThroughTier(0, total);
  const lastGrandmasterOffset = await lastOffsetThroughTier(7, total);
  if (lastGrandmasterOffset <= lastChallengerOffset || lastGrandmasterOffset >= total - 1) {
    throw new Error("WeGame tier boundaries were not ordered as expected.");
  }

  const groups = [
    { tier: "CHALLENGER", code: 0, start: 0, count: lastChallengerOffset + 1 },
    { tier: "GRANDMASTER", code: 7, start: lastChallengerOffset + 1, count: lastGrandmasterOffset - lastChallengerOffset },
    { tier: "MASTER", code: 6, start: lastGrandmasterOffset + 1, count: total - lastGrandmasterOffset - 1 },
  ];
  const publicIdentities = new Set();
  const publicRanks = new Set();
  const results = [];

  for (const group of groups) {
    const rows = [];
    let offset = group.start;
    while (rows.length < 100 && offset < total && offset < group.start + group.count) {
      const body = await page(offset);
      if (body.ranks.length === 0) throw new Error(`WeGame stopped during ${group.tier}.`);
      for (const candidate of body.ranks) {
        if (candidate.tier !== group.code || rows.length >= 100) continue;
        const riotId = typeof candidate.name === "string" ? candidate.name.trim() : "";
        const rank = Number(candidate.ranking);
        const leaguePoints = Number(candidate.win_point);
        const profileIconId = Number(candidate.icon_id);
        const championIds = Array.isArray(candidate.champions)
          ? [...new Set(candidate.champions.map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 10_000))].slice(0, 5)
          : [];
        if (!riotId.includes("#") || !Number.isInteger(rank) || rank < 1
          || !Number.isInteger(leaguePoints) || leaguePoints < 0
          || !Number.isInteger(profileIconId) || profileIconId < 0) {
          throw new Error(`WeGame returned an invalid public ${group.tier} row.`);
        }
        const identityKey = riotId.toLocaleLowerCase("en-US");
        if (publicIdentities.has(identityKey) || publicRanks.has(rank)) {
          throw new Error("WeGame returned a duplicate public Riot ID or rank.");
        }
        publicIdentities.add(identityKey);
        publicRanks.add(rank);
        rows.push({ rank, riotId, tier: group.tier, leaguePoints, profileIconId, championIds });
      }
      offset += body.ranks.length;
    }
    if (rows.length !== Math.min(100, group.count)) {
      throw new Error(`WeGame did not return the expected ${group.tier} sample.`);
    }
    results.push({ queue, tier: group.tier, ok: true, rowCount: group.count, rows });
    console.info(`Collected ${rows.length} sanitized ${group.tier} rows.`);
  }

  const snapshot = {
    schemaVersion: 2,
    source: "WEGAME_TIER_RANK",
    capturedAt: new Date().toISOString(),
    connected: true,
    platform: server.platform,
    results,
  };
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (/"(?:puuid|summonerId|openId|openid|credentialSource)"\s*:/i.test(json)) {
    throw new Error("Private identifiers reached the sanitized projection.");
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "china-stats-ladder-snapshot.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  console.info(`Downloaded ${results.reduce((sum, result) => sum + result.rows.length, 0)} sanitized ${server.label} rows.`);
})();
