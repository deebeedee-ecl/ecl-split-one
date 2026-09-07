require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const SITE_URL = process.env.ECL_SITE_URL || "https://eclchina.lol";
const REPORT_ENGINE_SECRET = process.env.ECL_REPORT_ENGINE_SECRET || process.env.ECL_JOB_SECRET || process.env.ECL_KOOK_BOT_SECRET;
const KOOK_BOT_TOKEN = process.env.KOOK_BOT_TOKEN;
const WORKER_ID = process.env.REPORT_ENGINE_WORKER_ID || "ecl-report-engine";
const POLL_MS = Number(process.env.REPORT_ENGINE_POLL_MS || 5000);
const LZYUMI_TIMEOUT_MS = Number(process.env.REPORT_ENGINE_LZYUMI_TIMEOUT_MS || 15000);
const LZYUMI_BASE = "https://a.2025lol.top/lzyumi/lol";
const LZYUMI_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const INHOUSE_LABEL = "\u65b0\u6a21\u5f0f";
const REQUIRED_MATCHES = 10;

const CHINA_SERVERS = {
  1: "\u827e\u6b27\u5c3c\u4e9a",
  14: "\u9ed1\u8272\u73ab\u7470",
  31: "\u5ce1\u8c37\u4e4b\u5dc5",
  30: "\u7537\u7235\u9886\u57df",
  3: "\u7956\u5b89",
  4: "\u8bfa\u514b\u8428\u65af",
  16: "\u6055\u745e\u739b",
};

const LZYUMI_HEADERS = {
  Accept: "application/json, text/plain, */*",
  Referer: "https://a.2025lol.top/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function riotId(player) {
  const name = clean(player.riotName);
  const tag = clean(player.riotTag);
  return name && tag ? `${name}#${tag}` : name;
}

function splitRiotId(value) {
  const raw = normalize(value);
  const index = raw.lastIndexOf("#");
  if (index < 0) return { name: raw, tag: "" };
  return { name: raw.slice(0, index), tag: raw.slice(index + 1) };
}

function riotIdKey(name, tag) {
  const normalizedName = normalize(name);
  const normalizedTag = normalize(tag);
  return normalizedName && normalizedTag ? `${normalizedName}#${normalizedTag}` : "";
}

function riotNameKey(name) {
  return normalize(name);
}

function detailKeys(player) {
  return [player.nickNameStr, player.nickName].flatMap((value) => {
    const parts = splitRiotId(value);
    return [riotIdKey(parts.name, parts.tag), riotNameKey(parts.name)].filter(Boolean);
  });
}

function createLzyumiSignature() {
  const now = new Date();
  const month = String(now.getMonth() + 1);
  const day = String(now.getDate());
  const hours = String(now.getHours());
  const minutes = String(now.getMinutes());
  const seconds = String(now.getSeconds());
  const signSource = `dld${month.padStart(2, "0")}o${day.padStart(2, "0")}u${hours.padStart(2, "0")}d${minutes.padStart(2, "0")}o${seconds.padStart(2, "0")}dld`;
  return {
    lzyumiSign: crypto.createHash("md5").update(signSource).digest("hex"),
    signStr: `${month}${day}${hours}${minutes}${seconds}${month.length * 3}${day.length * 3}${hours.length * 3}${minutes.length * 3}${seconds.length * 3}`,
  };
}

async function lzyumiFetch(url) {
  const response = await axios.get(url, {
    headers: LZYUMI_HEADERS,
    timeout: LZYUMI_TIMEOUT_MS,
  });
  return response.data;
}

function lzyumiInfoUrl({ nickname, areaId, filter, allCount = 5 }) {
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const areaName = CHINA_SERVERS[areaId] || CHINA_SERVERS[1];
  const encodedNickname = clean(nickname).replace(/#/g, "*~*~*");
  const params = [
    `nickname=${encodeURIComponent(encodedNickname)}`,
    `allCount=${allCount}`,
    `areaId=${areaId}`,
    `areaName=${encodeURIComponent(areaName)}`,
    "seleMe=1",
    `filter=${filter}`,
    "openId=",
    `lzyumiSign=${lzyumiSign}`,
    `signStr=${signStr}`,
  ];
  return `${LZYUMI_BASE}/info?${params.join("&")}`;
}

function lzyumiDetailUrl({ openId, gameId, areaId }) {
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const url = new URL(`${LZYUMI_BASE}/findOrderDetailInfoAll`);
  url.searchParams.set("openId", openId);
  url.searchParams.set("gameId", gameId);
  url.searchParams.set("areaId", String(areaId));
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);
  return url.toString();
}

async function fetchRecentGamesForPlayer(player) {
  const areaId = player.chinaServerId || 1;
  const attempts = [clean(player.riotName), riotId(player)].filter(Boolean);

  for (const nickname of [...new Set(attempts)]) {
    const responses = await Promise.all(
      LZYUMI_FILTERS.map((filter) =>
        lzyumiFetch(lzyumiInfoUrl({ nickname, areaId, filter })).catch(() => null),
      ),
    );
    const hasData = responses.some(
      (response) => response?.battleInfo?.openId || response?.data?.length,
    );

    if (!hasData) continue;

    const profile = responses.find((response) => response?.battleInfo?.openId) || null;
    const openId = profile?.battleInfo?.openId;
    const gamesById = new Map();

    for (const response of responses) {
      for (const game of response?.data || []) {
        if (game?.gameId && !gamesById.has(game.gameId)) {
          gamesById.set(game.gameId, game);
        }
      }
    }

    if (openId && gamesById.size > 0) {
      return {
        player,
        areaId,
        profile,
        openId,
        games: [...gamesById.values()],
      };
    }
  }

  return null;
}

function matchRoster(players, detail) {
  const detailPlayerKeys = new Set((detail?.data?.wgBattleDetailInfo || []).flatMap(detailKeys));
  const matched = [];
  const missing = [];

  for (const player of players) {
    const fullKey = riotIdKey(player.riotName, player.riotTag);
    const nameKey = riotNameKey(player.riotName);
    if ((fullKey && detailPlayerKeys.has(fullKey)) || (nameKey && detailPlayerKeys.has(nameKey))) {
      matched.push(player.displayName);
    } else {
      missing.push(player.displayName);
    }
  }

  return { matched, missing };
}

function parseGameTime(game, sessionCreatedAt) {
  const raw = `${game.titleTime || ""} ${game.title || ""}`;
  const match = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const reference = new Date(sessionCreatedAt);
  const candidate = new Date(
    reference.getFullYear(),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5] || 0),
  );

  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function gameSortValue(game, sessionCreatedAt) {
  const gameTime = parseGameTime(game, sessionCreatedAt);
  if (!gameTime) return Number.MAX_SAFE_INTEGER;
  const delta = gameTime.getTime() - new Date(sessionCreatedAt).getTime();
  return Math.abs(delta) + (delta < 0 ? 24 * 60 * 60 * 1000 : 0);
}

function loadChampionNames() {
  try {
    const file = path.join(__dirname, "..", "public", "lol", "champions", "champions.json");
    const champions = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    return new Map(champions.map((champion) => [String(champion.id), champion.name]));
  } catch {
    return new Map();
  }
}

function summarizeReporter(job, detail, game) {
  const championNames = loadChampionNames();
  const reporter = job.reporter || {};
  const reporterOpenId = clean(reporter.openId);
  const detailPlayers = detail?.data?.wgBattleDetailInfo || [];
  const player =
    detailPlayers.find((entry) => reporterOpenId && entry.openIdNow === reporterOpenId) ||
    detailPlayers.find((entry) => {
      const keys = detailKeys(entry);
      return keys.includes(riotIdKey(reporter.riotName, reporter.riotTag)) ||
        keys.includes(riotNameKey(reporter.riotName));
    });

  const result = String(player?.win || "").toLowerCase();
  const outcome = ["1", "true", "win"].includes(result)
    ? "Win"
    : ["0", "false", "fail", "loss", "lose"].includes(result)
      ? "Loss"
      : "Unknown";
  const champion = championNames.get(String(player?.detailChampionId || "")) ||
    (player?.detailChampionId ? `Champion ${player.detailChampionId}` : "Champion unavailable");
  const kda = clean(player?.scoreInfo) || "KDA unknown";
  const name = clean(player?.nickNameStr || player?.nickName) ||
    riotId(reporter) ||
    clean(reporter.displayName) ||
    "Reporter";
  const time = clean(game.titleTime) || clean(game.title) || "Unknown time";

  return [
    `Report check: ${job.session.gameLabel || "Ranked Inhouse"}`,
    "",
    `Player: ${name}`,
    `Result: ${outcome}`,
    `Champion: ${champion}`,
    `KDA: ${kda}`,
    `Time: ${time}`,
    "",
    "Submit this result?",
    "Type !yes to submit, or !no to cancel.",
  ].join("\n");
}

async function findMatchingGame(job) {
  const players = job.session.players;
  const searchPlayers = [
    ...players.filter((player) => player.kookUserId === job.requestedByKookId),
    ...players.filter((player) => player.kookUserId !== job.requestedByKookId),
  ];
  const sources = (await Promise.all(searchPlayers.map(fetchRecentGamesForPlayer))).filter(Boolean);
  const gamesById = new Map();

  for (const source of sources) {
    for (const game of source.games) {
      if (!game?.gameId || job.reportedGameIds.includes(game.gameId) || gamesById.has(game.gameId)) {
        continue;
      }
      gamesById.set(game.gameId, { source, game });
    }
  }

  const candidates = [...gamesById.values()]
    .sort((a, b) => {
      const aIsInhouse = clean(a.game.title).includes(INHOUSE_LABEL) ? 0 : 1;
      const bIsInhouse = clean(b.game.title).includes(INHOUSE_LABEL) ? 0 : 1;
      if (aIsInhouse !== bIsInhouse) return aIsInhouse - bIsInhouse;
      return gameSortValue(a.game, job.session.createdAt) - gameSortValue(b.game, job.session.createdAt);
    })
    .slice(0, 12);

  const checked = (
    await Promise.all(
      candidates.map(async ({ source, game }) => {
        try {
          const detail = await lzyumiFetch(
            lzyumiDetailUrl({
              openId: source.openId,
              gameId: game.gameId,
              areaId: source.areaId,
            }),
          );
          return {
            source,
            game,
            detail,
            rosterMatch: matchRoster(players, detail),
          };
        } catch (error) {
          console.error("Detail lookup failed", game.gameId, error.message);
          return null;
        }
      }),
    )
  ).filter(Boolean);

  const exact = checked
    .filter((candidate) => candidate.rosterMatch.matched.length >= REQUIRED_MATCHES)
    .sort((a, b) => gameSortValue(a.game, job.session.createdAt) - gameSortValue(b.game, job.session.createdAt));

  if (exact[0]) return exact[0];

  const best = checked.sort((a, b) => b.rosterMatch.matched.length - a.rosterMatch.matched.length)[0];
  throw new Error(
    best
      ? `No matching inhouse found. Closest match was ${best.rosterMatch.matched.length}/10 players.`
      : "No recent ECL.GG games were found for this inhouse roster.",
  );
}

async function siteGet(pathname) {
  const response = await axios.get(`${SITE_URL}${pathname}`, {
    headers: { "x-ecl-report-engine-secret": REPORT_ENGINE_SECRET },
    timeout: 15000,
  });
  return response.data;
}

async function sitePost(pathname, body) {
  const response = await axios.post(`${SITE_URL}${pathname}`, body, {
    headers: {
      "Content-Type": "application/json",
      "x-ecl-report-engine-secret": REPORT_ENGINE_SECRET,
    },
    timeout: 15000,
  });
  return response.data;
}

async function sendKookMessage(channelId, content) {
  if (!KOOK_BOT_TOKEN || !channelId) return;
  await axios.post(
    "https://www.kookapp.cn/api/v3/message/create",
    { target_id: channelId, content, type: 1 },
    {
      headers: {
        Authorization: `Bot ${KOOK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    },
  );
}

async function processNextJob() {
  const { job } = await siteGet(`/api/jobs/inhouse-report?workerId=${encodeURIComponent(WORKER_ID)}`);
  if (!job) return;

  console.log(`Processing ${job.session.gameLabel || job.sessionId} (${job.id})`);

  try {
    const match = await findMatchingGame(job);
    const reply = summarizeReporter(job, match.detail, match.game);
    const result = await sitePost("/api/jobs/inhouse-report", {
      jobId: job.id,
      status: "FOUND",
      rawMatchData: {
        profile: match.source.profile,
        gameId: match.game.gameId,
        detail: match.detail,
      },
      reply,
    });

    await sendKookMessage(result.responseChannelId, result.reply);
    console.log(`Found report for ${job.session.gameLabel || job.sessionId}`);
  } catch (error) {
    const message = error.message || String(error);
    const result = await sitePost("/api/jobs/inhouse-report", {
      jobId: job.id,
      status: "FAILED",
      error: message,
    });
    await sendKookMessage(result.responseChannelId, result.reply);
    console.error(`Report job failed: ${message}`);
  }
}

async function main() {
  if (!REPORT_ENGINE_SECRET) {
    throw new Error("Missing ECL_REPORT_ENGINE_SECRET, ECL_JOB_SECRET, or ECL_KOOK_BOT_SECRET.");
  }

  console.log(`ECL Report Engine polling ${SITE_URL}`);
  for (;;) {
    try {
      await processNextJob();
    } catch (error) {
      console.error("Report Engine loop error:", error.response?.data || error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main();
