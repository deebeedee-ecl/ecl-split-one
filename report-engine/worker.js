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
const FETCH_MODE = clean(process.env.REPORT_ENGINE_FETCH_MODE || "browser").toLowerCase();
const DEBUG_LZYUMI = ["1", "true", "yes", "on"].includes(
  clean(process.env.REPORT_ENGINE_DEBUG_LZYUMI).toLowerCase(),
);
const PROXY_URL = clean(process.env.REPORT_ENGINE_PROXY_URL);
const PROXY_SERVER = clean(process.env.REPORT_ENGINE_PROXY_SERVER);
const PROXY_USERNAME = clean(process.env.REPORT_ENGINE_PROXY_USERNAME);
const PROXY_PASSWORD = clean(process.env.REPORT_ENGINE_PROXY_PASSWORD);
const LZYUMI_BASE = "https://a.2025lol.top/lzyumi/lol";
const LZYUMI_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const INHOUSE_LABEL = "\u65b0\u6a21\u5f0f";
const REQUIRED_MATCHES = Number(process.env.REPORT_ENGINE_REQUIRED_MATCHES || 8);
const REPORT_GAME_EARLY_GRACE_MS = Number(process.env.REPORT_ENGINE_EARLY_GRACE_MINUTES || 10) * 60 * 1000;
const REPORT_GAME_LATE_WINDOW_MS = Number(process.env.REPORT_ENGINE_LATE_WINDOW_HOURS || 6) * 60 * 60 * 1000;

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

let browserPromise = null;
let browserPagePromise = null;
const INVISIBLE_CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/gu;
const RIOT_KEY_SPACING_PATTERN = /[\s\p{Zs}\u1160\uFFA0]+/gu;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value) {
  return clean(value).normalize("NFKC").replace(INVISIBLE_CONTROL_PATTERN, "").toLowerCase();
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
  const normalizedName = riotNameKey(name);
  const normalizedTag = normalize(tag).replace(/^#+/, "").replace(RIOT_KEY_SPACING_PATTERN, "");
  return normalizedName && normalizedTag ? `${normalizedName}#${normalizedTag}` : "";
}

function riotNameKey(name) {
  return normalize(name).replace(RIOT_KEY_SPACING_PATTERN, "");
}

function resolvedRiotIdMatches(resolvedName, riotName, riotTag) {
  const resolved = splitRiotId(resolvedName);
  return riotIdKey(resolved.name, resolved.tag) === riotIdKey(riotName, riotTag);
}

function detailRiotKeys(player) {
  return [player.nickNameStr, player.nickName].map(splitRiotId)
    .map((parts) => riotIdKey(parts.name, parts.tag))
    .filter(Boolean);
}

function detailNameKeys(player) {
  return [player.nickNameStr, player.nickName].map(splitRiotId)
    .map((parts) => riotNameKey(parts.name))
    .filter(Boolean);
}

function hasRiotTag(player) {
  return Boolean(normalize(player.riotTag).replace(/^#+/, "").replace(RIOT_KEY_SPACING_PATTERN, ""));
}

function detailPlayerMatches(player, detailPlayer) {
  const fullKey = riotIdKey(player.riotName, player.riotTag);
  if (fullKey && detailRiotKeys(detailPlayer).includes(fullKey)) return true;

  if (hasRiotTag(player)) return false;

  const nameKey = riotNameKey(player.riotName);
  return Boolean(nameKey && detailNameKeys(detailPlayer).includes(nameKey));
}

function reportEngineProxy() {
  if (PROXY_URL) {
    const parsed = new URL(PROXY_URL);
    const username = decodeURIComponent(parsed.username || "");
    const password = decodeURIComponent(parsed.password || "");
    parsed.username = "";
    parsed.password = "";

    return {
      server: parsed.toString().replace(/\/$/, ""),
      username,
      password,
    };
  }

  if (!PROXY_SERVER) return null;

  return {
    server: PROXY_SERVER,
    username: PROXY_USERNAME,
    password: PROXY_PASSWORD,
  };
}

function reportEngineProxyUrl() {
  if (PROXY_URL) return PROXY_URL;
  if (!PROXY_SERVER) return "";
  if (!PROXY_USERNAME && !PROXY_PASSWORD) return PROXY_SERVER;

  const parsed = new URL(PROXY_SERVER);
  parsed.username = PROXY_USERNAME;
  parsed.password = PROXY_PASSWORD;
  return parsed.toString();
}

function proxyLabel(proxy) {
  if (!proxy?.server) return "no proxy";
  try {
    const parsed = new URL(proxy.server);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "configured proxy";
  }
}

function lzyumiResponseSummary(response) {
  if (!response || typeof response !== "object") {
    return { type: typeof response };
  }

  return {
    keys: Object.keys(response),
    publicInfo: response.publicInfo ?? null,
    hasBattleInfo: Boolean(response.battleInfo),
    hasBattleOpenId: Boolean(response.battleInfo?.openId),
    dataLength: Array.isArray(response.data) ? response.data.length : null,
    firstGame: response.data?.[0]?.gameId
      ? {
          gameId: response.data[0].gameId,
          title: clean(response.data[0].title).slice(0, 80),
          titleTime: clean(response.data[0].titleTime),
        }
      : null,
  };
}

function debugLzyumi(label, detail) {
  if (!DEBUG_LZYUMI) return;
  console.log(`[lzyumi-debug] ${label} ${JSON.stringify(detail)}`);
}

function createLzyumiSignature() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const month = String(china.getUTCMonth() + 1);
  const day = String(china.getUTCDate());
  const hours = String(china.getUTCHours());
  const minutes = String(china.getUTCMinutes());
  const seconds = String(china.getUTCSeconds());
  const signSource = `dld${month.padStart(2, "0")}o${day.padStart(2, "0")}u${hours.padStart(2, "0")}d${minutes.padStart(2, "0")}o${seconds.padStart(2, "0")}dld`;
  return {
    lzyumiSign: crypto.createHash("md5").update(signSource).digest("hex"),
    signStr: `${month}${day}${hours}${minutes}${seconds}${month.length * 3}${day.length * 3}${hours.length * 3}${minutes.length * 3}${seconds.length * 3}`,
  };
}

async function lzyumiFetchDirect(url) {
  const proxyUrl = reportEngineProxyUrl();
  const agent = proxyUrl ? new (require("proxy-agent").ProxyAgent)(proxyUrl) : null;
  const response = await axios.get(url, {
    headers: LZYUMI_HEADERS,
    timeout: LZYUMI_TIMEOUT_MS,
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false,
  });
  return response.data;
}

async function getBrowserPage() {
  if (!browserPromise) {
    const { chromium } = require("playwright");
    const proxy = reportEngineProxy();
    browserPromise = chromium.launch({
      headless: true,
      proxy: proxy?.server
        ? {
            server: proxy.server,
            username: proxy.username || undefined,
            password: proxy.password || undefined,
          }
        : undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }

  if (!browserPagePromise) {
    browserPagePromise = browserPromise.then(async (browser) => {
      const context = await browser.newContext({
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        userAgent: LZYUMI_HEADERS["User-Agent"],
        extraHTTPHeaders: {
          Accept: LZYUMI_HEADERS.Accept,
        },
      });
      const page = await context.newPage();
      await page.goto("https://a.2025lol.top/", {
        waitUntil: "domcontentloaded",
        timeout: LZYUMI_TIMEOUT_MS,
      }).catch(() => null);
      return page;
    });
  }

  return browserPagePromise;
}

async function lzyumiFetchBrowser(url) {
  const page = await getBrowserPage();
  return page.evaluate(
    async ({ requestUrl, timeoutMs }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(requestUrl, {
          headers: {
            Accept: "application/json, text/plain, */*",
          },
          credentials: "include",
          signal: controller.signal,
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
        }
        return JSON.parse(text);
      } finally {
        clearTimeout(timeout);
      }
    },
    { requestUrl: url, timeoutMs: LZYUMI_TIMEOUT_MS },
  );
}

async function lzyumiFetch(url) {
  if (FETCH_MODE === "direct") return lzyumiFetchDirect(url);

  try {
    return await lzyumiFetchBrowser(url);
  } catch (error) {
    if (FETCH_MODE === "browser-strict") throw error;
    console.warn(`Browser Lzyumi fetch failed, falling back to direct fetch: ${error.message || error}`);
    return lzyumiFetchDirect(url);
  }
}

function lzyumiInfoUrl({ nickname, openId, areaId, filter, allCount = 5 }) {
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const areaName = CHINA_SERVERS[areaId] || CHINA_SERVERS[1];
  const encodedNickname = clean(nickname).replace(/#/g, "*~*~*");
  const encodedOpenId = encodeURIComponent(clean(openId));
  const params = [
    `nickname=${encodeURIComponent(encodedNickname)}`,
    `allCount=${allCount}`,
    `areaId=${areaId}`,
    `areaName=${encodeURIComponent(areaName)}`,
    "seleMe=1",
    `filter=${filter}`,
    `openId=${encodedOpenId}`,
    `lzyumiSign=${lzyumiSign}`,
    `signStr=${signStr}`,
  ];
  return `${LZYUMI_BASE}/info?${params.join("&")}`;
}

function lzyumiDetailUrl({ openId, gameId, areaId }) {
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const url = new URL(`${LZYUMI_BASE}/info/findOrderDetailInfoAll`);
  url.searchParams.set("openId", openId);
  url.searchParams.set("gameId", gameId);
  url.searchParams.set("areaId", String(areaId));
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);
  return url.toString();
}

async function fetchRecentGamesForPlayer(player) {
  const areaId = player.chinaServerId || 1;
  const savedOpenId = clean(player.openId);
  const lookupNames = [clean(player.riotName), riotId(player)].filter(Boolean);
  const attempts = savedOpenId
    ? [
        ...lookupNames.map((nickname) => ({ nickname, openId: savedOpenId })),
        { nickname: "", openId: savedOpenId },
        ...lookupNames.map((nickname) => ({ nickname, openId: "" })),
      ]
    : lookupNames.map((nickname) => ({ nickname, openId: "" }));
  const seenAttempts = new Set();

  for (const attempt of attempts) {
    const attemptKey = `${attempt.nickname}::${attempt.openId}`;
    if (seenAttempts.has(attemptKey)) continue;
    seenAttempts.add(attemptKey);
    const responses = await Promise.all(
      LZYUMI_FILTERS.map((filter) =>
        lzyumiFetch(lzyumiInfoUrl({ ...attempt, areaId, filter }))
          .then((response) => {
            debugLzyumi("info", {
              player: riotId(player) || clean(player.displayName),
              areaId,
              filter,
              nicknameSupplied: Boolean(clean(attempt.nickname)),
              openIdSupplied: Boolean(clean(attempt.openId)),
              response: lzyumiResponseSummary(response),
            });
            return response;
          })
          .catch((error) => {
            debugLzyumi("info-error", {
              player: riotId(player) || clean(player.displayName),
              areaId,
              filter,
              nicknameSupplied: Boolean(clean(attempt.nickname)),
              openIdSupplied: Boolean(clean(attempt.openId)),
              error: error.message || String(error),
            });
            return null;
          }),
      ),
    );
    const hasData = responses.some(
      (response) => response?.battleInfo?.openId || response?.data?.length,
    );

    if (!hasData) continue;

    const profile = responses.find((response) => response?.battleInfo?.openId) || null;
    const expectedRiotKey = riotIdKey(player.riotName, player.riotTag);
    const resolvedName = clean(profile?.battleInfo?.nameInfoNew);

    if (expectedRiotKey && !resolvedRiotIdMatches(resolvedName, player.riotName, player.riotTag)) {
      debugLzyumi("identity-mismatch", {
        player: riotId(player) || clean(player.displayName),
        suppliedOpenId: Boolean(clean(attempt.openId)),
        resolvedName,
      });
      continue;
    }

    const openId = clean(profile?.battleInfo?.openId) || attempt.openId;
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
        profile: profile || { battleInfo: { openId } },
        openId,
        games: [...gamesById.values()],
      };
    }
  }

  return null;
}

function matchRoster(players, detail) {
  const detailPlayers = detail?.data?.wgBattleDetailInfo || [];
  const matched = [];
  const missing = [];

  for (const player of players) {
    if (detailPlayers.some((detailPlayer) => detailPlayerMatches(player, detailPlayer))) {
      matched.push(player.displayName);
    } else {
      missing.push(player.displayName);
    }
  }

  return { matched, missing };
}

function formatRosterMiss(rosterMatch) {
  const matchedCount = rosterMatch?.matched?.length || 0;
  const missing = Array.isArray(rosterMatch?.missing) ? rosterMatch.missing.filter(Boolean) : [];
  const parts = [`No matching inhouse found. Closest match was ${matchedCount}/10 players.`];

  if (missing.length) {
    parts.push(`Missing from closest match: ${missing.join(", ")}.`);
  }

  return parts.join(" ");
}

function rosterMatchWarning(rosterMatch) {
  const matchedCount = rosterMatch?.matched?.length || 0;
  const missing = Array.isArray(rosterMatch?.missing) ? rosterMatch.missing.filter(Boolean) : [];

  if (matchedCount >= 10 || !missing.length) return "";

  return [
    `Roster Match: ${matchedCount}/10 players`,
    `Missing from Lzyumi detail: ${missing.join(", ")}`,
  ].join("\n");
}

function parseGameTime(game, sessionCreatedAt) {
  const raw = `${game.titleTime || ""} ${game.title || ""}`;
  const match = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const reference = new Date(sessionCreatedAt);
  const referenceChina = new Date(reference.getTime() + 8 * 60 * 60 * 1000);
  const candidate = new Date(Date.UTC(
    referenceChina.getUTCFullYear(),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[3]) - 8,
    Number(match[4]),
    Number(match[5] || 0),
  ));

  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function gameSortValue(game, sessionCreatedAt) {
  const gameTime = parseGameTime(game, sessionCreatedAt);
  if (!gameTime) return Number.MAX_SAFE_INTEGER;
  const delta = gameTime.getTime() - new Date(sessionCreatedAt).getTime();
  return Math.abs(delta) + (delta < 0 ? 24 * 60 * 60 * 1000 : 0);
}

function gameTimeWindowIssue(game, sessionCreatedAt) {
  const gameTime = parseGameTime(game, sessionCreatedAt);
  if (!gameTime) return "";

  const sessionTime = new Date(sessionCreatedAt);
  const delta = gameTime.getTime() - sessionTime.getTime();

  if (delta < -REPORT_GAME_EARLY_GRACE_MS) {
    return `closest candidate started ${Math.round(Math.abs(delta) / 60000)} minutes before the inhouse was created`;
  }

  if (delta > REPORT_GAME_LATE_WINDOW_MS) {
    return `closest candidate started ${Math.round(delta / 60000)} minutes after the inhouse was created`;
  }

  return "";
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

function summarizeReporter(job, detail, game, rosterMatch) {
  const championNames = loadChampionNames();
  const reporter = job.reporter || {};
  const reporterOpenId = clean(reporter.openId);
  const detailPlayers = detail?.data?.wgBattleDetailInfo || [];
  const player =
    detailPlayers.find((entry) => reporterOpenId && entry.openIdNow === reporterOpenId) ||
    detailPlayers.find((entry) => detailPlayerMatches(reporter, entry));

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

  const warning = rosterMatchWarning(rosterMatch);
  return [
    "ECL Inhouse Report",
    "",
    `Match: ${job.session.gameLabel || "Ranked Inhouse"}`,
    `Game Time: ${time}`,
    `Reporter: ${name}`,
    `Result: ${outcome}`,
    `Champion: ${champion}`,
    `KDA: ${kda}`,
    ...(warning ? ["", warning] : []),
    "",
    "Submit this result?",
    "Type !yes to submit, or !no to cancel.",
  ].join("\n");
}

function cliValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return clean(process.argv[index + 1]) || fallback;
}

function findDetailPlayerForSource(source, detail) {
  const detailPlayers = detail?.data?.wgBattleDetailInfo || [];
  const openId = clean(source.openId);
  if (openId) {
    const byOpenId = detailPlayers.find((entry) => entry.openIdNow === openId);
    if (byOpenId) return byOpenId;
  }

  return detailPlayers.find((entry) => {
    return detailPlayerMatches(source.player, entry);
  });
}

async function debugCheckPlayer() {
  const riot = cliValue("--check-player");
  const areaId = Number(cliValue("--area-id", "1")) || 1;
  const limit = Number(cliValue("--limit", "8")) || 8;
  const openId = cliValue("--open-id");
  const { name, tag } = splitRiotId(riot);

  if (!name && !openId) {
    throw new Error('Usage: node worker.js --check-player "Soul#67126" --area-id 1');
  }

  const player = {
    displayName: name || "Player",
    riotName: name,
    riotTag: tag || null,
    chinaServerId: areaId,
    openId: openId || null,
  };
  const source = await fetchRecentGamesForPlayer(player);

  if (!source) {
    console.log(`No recent ECL.GG games found for ${riot || name} on area ${areaId}.`);
    return;
  }

  const championNames = loadChampionNames();
  const games = source.games.slice(0, limit);
  console.log(`Found ${source.games.length} recent game(s) for ${riot || name}. Showing ${games.length}.`);

  for (const game of games) {
    try {
      const detail = await lzyumiFetch(
        lzyumiDetailUrl({
          openId: source.openId,
          gameId: game.gameId,
          areaId: source.areaId,
        }),
      );
      const detailPlayer = findDetailPlayerForSource(source, detail);
      const result = String(detailPlayer?.win || "").toLowerCase();
      const outcome = ["1", "true", "win"].includes(result)
        ? "Win"
        : ["0", "false", "fail", "loss", "lose"].includes(result)
          ? "Loss"
          : "Unknown";
      const champion = championNames.get(String(detailPlayer?.detailChampionId || "")) ||
        (detailPlayer?.detailChampionId ? `Champion ${detailPlayer.detailChampionId}` : "Champion unavailable");
      const kda = clean(detailPlayer?.scoreInfo) || "KDA unknown";
      const time = clean(game.titleTime) || clean(game.title) || "Unknown time";
      const title = clean(game.title).replace(/<br>/g, " ");
      console.log(`- ${time} | ${outcome} | ${champion} | ${kda} | ${title}`);
    } catch (error) {
      console.log(`- ${game.gameId}: detail lookup failed (${error.message || error})`);
    }
  }
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

  const sortedCandidates = [...gamesById.values()]
    .sort((a, b) => {
      const aIsInhouse = clean(a.game.title).includes(INHOUSE_LABEL) ? 0 : 1;
      const bIsInhouse = clean(b.game.title).includes(INHOUSE_LABEL) ? 0 : 1;
      if (aIsInhouse !== bIsInhouse) return aIsInhouse - bIsInhouse;
      return gameSortValue(a.game, job.session.createdAt) - gameSortValue(b.game, job.session.createdAt);
    });
  const outOfWindowCandidate = sortedCandidates.find(({ game }) =>
    gameTimeWindowIssue(game, job.session.createdAt),
  );
  const candidates = sortedCandidates
    .filter(({ game }) => !gameTimeWindowIssue(game, job.session.createdAt))
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
      ? formatRosterMiss(best.rosterMatch)
      : outOfWindowCandidate
        ? `No matching inhouse found in the expected time window; ${gameTimeWindowIssue(
            outOfWindowCandidate.game,
            job.session.createdAt,
          )}.`
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
    const reply = summarizeReporter(job, match.detail, match.game, match.rosterMatch);
    const result = await sitePost("/api/jobs/inhouse-report", {
      jobId: job.id,
      status: "FOUND",
      rawMatchData: {
        profile: match.source.profile,
        gameId: match.game.gameId,
        game: match.game,
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

  console.log(
    `ECL Report Engine polling ${SITE_URL} using ${FETCH_MODE} Lzyumi fetch with ${proxyLabel(reportEngineProxy())}`,
  );
  for (;;) {
    try {
      await processNextJob();
    } catch (error) {
      console.error("Report Engine loop error:", error.response?.data || error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

if (process.argv.includes("--check-player")) {
  debugCheckPlayer().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
} else {
  main();
}
