const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const port = Number(process.env.ECL_CHINA_STATS_LCU_PORT);
const token = process.env.ECL_CHINA_STATS_LCU_TOKEN || "";
const outputPath = process.env.ECL_CHINA_STATS_SNAPSHOT_PATH || "";
const tiers = ["CHALLENGER", "GRANDMASTER", "MASTER"];
const queue = "RANKED_SOLO_5x5";

function requestJson(requestPath, { method = "GET", body } = {}) {
  return new Promise((resolve, reject) => {
    const encodedBody = body === undefined ? null : Buffer.from(JSON.stringify(body), "utf8");
    const request = https.request({
      hostname: "127.0.0.1",
      port,
      path: requestPath,
      method,
      rejectUnauthorized: false,
      headers: {
        Authorization: `Basic ${Buffer.from(`riot:${token}`).toString("base64")}`,
        Accept: "application/json",
        ...(encodedBody ? {
          "Content-Type": "application/json",
          "Content-Length": String(encodedBody.length),
        } : {}),
      },
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 32 * 1024 * 1024) {
          request.destroy(new Error("LCU response exceeded the size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`LCU HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(new Error("LCU returned invalid JSON."));
        }
      });
    });
    request.setTimeout(20_000, () => request.destroy(new Error("LCU request timed out.")));
    request.on("error", reject);
    if (encodedBody) request.write(encodedBody);
    request.end();
  });
}

async function resolveSummoners(standings) {
  const puuids = standings.map((row) => row?.puuid);
  if (puuids.some((value) => typeof value !== "string" || !value)) {
    throw new Error("An apex standing did not include a PUUID for local resolution.");
  }
  const resolved = new Map();
  for (let index = 0; index < puuids.length; index += 100) {
    const response = await requestJson("/lol-summoner/v2/summoners/puuid", {
      method: "POST",
      body: puuids.slice(index, index + 100),
    });
    if (!Array.isArray(response)) throw new Error("LCU batch summoner response was invalid.");
    for (const summoner of response) {
      if (typeof summoner?.puuid === "string") resolved.set(summoner.puuid, summoner);
    }
  }
  return resolved;
}

function integer(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function publicRows(standings, tier, summoners) {
  return standings.map((standing, index) => {
    const summoner = summoners.get(standing.puuid);
    const gameName = typeof summoner?.gameName === "string" ? summoner.gameName.trim() : "";
    const tagLine = typeof summoner?.tagLine === "string" ? summoner.tagLine.trim() : "";
    const rank = integer(standing.position ?? standing.rank ?? index + 1);
    const leaguePoints = integer(standing.leaguePoints);
    const wins = integer(standing.wins);
    const losses = integer(standing.losses);
    const profileIconId = integer(summoner?.profileIconId);
    if (!gameName || !tagLine || rank === null || rank < 1 || leaguePoints === null || wins === null || losses === null) {
      throw new Error(`The ${tier} standing could not be projected safely.`);
    }
    return {
      rank,
      riotId: `${gameName}#${tagLine}`,
      tier,
      leaguePoints,
      wins,
      losses,
      profileIconId,
    };
  });
}

function writeAtomically(value) {
  const directory = path.dirname(outputPath);
  fs.mkdirSync(directory, { recursive: true });
  const pending = `${outputPath}.${process.pid}.pending`;
  fs.writeFileSync(pending, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.renameSync(pending, outputPath);
}

(async () => {
  if (!Number.isInteger(port) || port < 1 || port > 65_535 || !token || !path.isAbsolute(outputPath)) {
    throw new Error("The elevated wrapper did not provide a valid local LCU connection and output path.");
  }

  const profile = await requestJson("/lol-summoner/v1/current-summoner");
  const party = await requestJson("/lol-lobby/v1/parties/player").catch(() => null);
  const platform = String(party?.platformId || profile?.platformId || "").trim().toUpperCase();
  if (!new Set(["HN1", "BGP2"]).has(platform)) {
    throw new Error("The connected client is not on Ionia or Super Server.");
  }

  const results = [];
  const publicIdentities = new Set();
  const publicRanks = new Set();
  for (const tier of tiers) {
    const payload = await requestJson(`/lol-ranked/v1/apex-leagues/${queue}/${tier}`);
    const divisions = Array.isArray(payload?.divisions) ? payload.divisions : [];
    const standings = divisions.flatMap((division) => Array.isArray(division?.standings) ? division.standings : []);
    if (standings.length === 0) throw new Error(`LCU returned no ${tier} standings.`);
    const selected = standings.slice(0, 100);
    const summoners = await resolveSummoners(selected);
    const rows = publicRows(selected, tier, summoners);
    if (rows.length !== selected.length) throw new Error(`LCU did not resolve every selected ${tier} identity.`);
    for (const row of rows) {
      const identity = row.riotId.toLocaleLowerCase("en-US");
      if (publicIdentities.has(identity) || publicRanks.has(row.rank)) {
        throw new Error("LCU returned a duplicate public ladder identity or rank.");
      }
      publicIdentities.add(identity);
      publicRanks.add(row.rank);
    }
    results.push({ queue, tier, ok: true, rowCount: standings.length, rows });
  }

  writeAtomically({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    connected: true,
    platform,
    results,
  });
  process.stdout.write(`Collected ${results.reduce((sum, result) => sum + result.rows.length, 0)} sanitized ${platform} ladder rows.\n`);
})().catch((error) => {
  const message = String(error?.message || error).split(token).join("[redacted]").slice(0, 500);
  process.stderr.write(`China ladder collection failed: ${message}\n`);
  process.exitCode = 1;
});
