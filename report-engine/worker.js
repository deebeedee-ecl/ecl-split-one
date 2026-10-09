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
const LZYUMI_PROFILE_DIR = clean(process.env.REPORT_ENGINE_LZYUMI_PROFILE_DIR) ||
  path.join(__dirname, ".lzyumi-browser-profile");
const LZYUMI_WARMUP_MS = Number(process.env.REPORT_ENGINE_LZYUMI_WARMUP_MS || 2500);
const LZYUMI_HEADLESS = !["0", "false", "no", "off"].includes(
  clean(process.env.REPORT_ENGINE_LZYUMI_HEADLESS).toLowerCase(),
);
const BROWSER_EXECUTABLE_PATH = clean(process.env.REPORT_ENGINE_BROWSER_EXECUTABLE_PATH);
const LZYUMI_LOGIN_URL = clean(process.env.REPORT_ENGINE_LZYUMI_LOGIN_URL) || "https://l.lzyumi.top/login.html";
const LZYUMI_LOGIN_ID = clean(process.env.REPORT_ENGINE_LZYUMI_LOGIN_ID);
const LZYUMI_LOGIN_PASSWORD = clean(process.env.REPORT_ENGINE_LZYUMI_LOGIN_PASSWORD);
const LZYUMI_LOGIN_TARGET = clean(process.env.REPORT_ENGINE_LZYUMI_LOGIN_TARGET) || "PC";
const LZYUMI_TOKENSTR = clean(process.env.REPORT_ENGINE_LZYUMI_TOKENSTR);
const DEBUG_LZYUMI = ["1", "true", "yes", "on"].includes(
  clean(process.env.REPORT_ENGINE_DEBUG_LZYUMI).toLowerCase(),
);
const PROXY_URL = clean(process.env.REPORT_ENGINE_PROXY_URL);
const PROXY_SERVER = clean(process.env.REPORT_ENGINE_PROXY_SERVER);
const PROXY_USERNAME = clean(process.env.REPORT_ENGINE_PROXY_USERNAME);
const PROXY_PASSWORD = clean(process.env.REPORT_ENGINE_PROXY_PASSWORD);
const LZYUMI_BASE = clean(process.env.REPORT_ENGINE_LZYUMI_BASE) || "https://a.2025lol.top/lzyumi/lol";
const WEGAME_COOKIE = clean(process.env.REPORT_ENGINE_WEGAME_COOKIE);
const WEGAME_BASE = clean(process.env.REPORT_ENGINE_WEGAME_BASE) ||
  "https://www.wegame.com.cn/api/v1/wegame.pallas.game.LolBattle";
const WEGAME_TIMEOUT_MS = Number(process.env.REPORT_ENGINE_WEGAME_TIMEOUT_MS || 15000);
const WEGAME_LOGIN_BY_QQ_URL = clean(process.env.REPORT_ENGINE_WEGAME_LOGIN_BY_QQ_URL) ||
  "https://www.wegame.com.cn/api/middle/clientapi/auth/login_by_qq";
const WEGAME_AUTH_MODE = clean(process.env.REPORT_ENGINE_WEGAME_AUTH_MODE || "auto").toLowerCase();
const WEGAME_REFRESH_MARGIN_MS = Number(process.env.REPORT_ENGINE_WEGAME_REFRESH_MARGIN_SECONDS || 60) * 1000;
const WEGAME_LIST_COUNT = Number(process.env.REPORT_ENGINE_WEGAME_LIST_COUNT || 8);
const MATCH_SOURCE = clean(process.env.REPORT_ENGINE_MATCH_SOURCE || (WEGAME_COOKIE ? "wegame" : "lzyumi")).toLowerCase();
const DEBUG_WEGAME = ["1", "true", "yes", "on"].includes(
  clean(process.env.REPORT_ENGINE_DEBUG_WEGAME).toLowerCase(),
);
const LZYUMI_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const INHOUSE_LABEL = "\u65b0\u6a21\u5f0f";
const LZYUMI_ALL_COUNT = Number(process.env.REPORT_ENGINE_LZYUMI_ALL_COUNT || 10);
const REPORT_CANDIDATE_LIMIT = Number(process.env.REPORT_ENGINE_CANDIDATE_LIMIT || 24);
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
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,nl;q=0.6",
  Referer: "https://a.2025lol.top/",
  "Sec-CH-UA": '"Not=A?Brand";v="99", "Opera";v="135", "Chromium";v="151"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/135.0.0.0",
};

let browserContextPromise = null;
let browserPagePromise = null;
let championNamesPromise = null;
let wegameTicketState = null;
let wegameTicketPromise = null;
const INVISIBLE_CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/gu;
const RIOT_KEY_SPACING_PATTERN = /[\s\p{Zs}\u1160\uFFA0]+/gu;
const LZYUMI_RIOT_TAG_ISOLATE = "\u2066";

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

function parseRiotId(value) {
  const raw = clean(value);
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

function nodeProxyAgent(proxyUrl = reportEngineProxyUrl()) {
  if (!proxyUrl) return null;

  const protocol = new URL(proxyUrl).protocol.toLowerCase();
  if (protocol.startsWith("socks")) {
    const { SocksProxyAgent } = require("socks-proxy-agent");
    return new SocksProxyAgent(proxyUrl);
  }

  const { ProxyAgent } = require("proxy-agent");
  return new ProxyAgent(proxyUrl);
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
  const agent = nodeProxyAgent();
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
  if (!browserContextPromise) {
    const { chromium } = require("playwright");
    const proxy = reportEngineProxy();
    browserContextPromise = chromium.launchPersistentContext(LZYUMI_PROFILE_DIR, {
      headless: LZYUMI_HEADLESS,
      executablePath: BROWSER_EXECUTABLE_PATH || undefined,
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
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      userAgent: LZYUMI_HEADERS["User-Agent"],
      viewport: { width: 1365, height: 768 },
      extraHTTPHeaders: {
        Accept: LZYUMI_HEADERS.Accept,
        "Accept-Language": LZYUMI_HEADERS["Accept-Language"],
        "Sec-CH-UA": LZYUMI_HEADERS["Sec-CH-UA"],
        "Sec-CH-UA-Mobile": LZYUMI_HEADERS["Sec-CH-UA-Mobile"],
        "Sec-CH-UA-Platform": LZYUMI_HEADERS["Sec-CH-UA-Platform"],
      },
    }).then(async (context) => {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        Object.defineProperty(navigator, "languages", { get: () => ["zh-CN", "zh", "en-US", "en"] });
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      });
      return context;
    });
  }

  if (!browserPagePromise) {
    browserPagePromise = browserContextPromise.then(async (context) => {
      const page = context.pages()[0] || await context.newPage();
      await page.goto("https://a.2025lol.top/", {
        waitUntil: "networkidle",
        timeout: LZYUMI_TIMEOUT_MS,
      }).catch(() => null);
      await page.waitForTimeout(LZYUMI_WARMUP_MS).catch(() => null);
      return page;
    });
  }

  return browserPagePromise;
}

async function resetBrowserSession(reason) {
  debugLzyumi("browser-reset", { reason: reason || "unknown" });

  const context = await browserContextPromise?.catch(() => null);
  browserPagePromise = null;
  browserContextPromise = null;

  if (context) {
    await context.close().catch(() => null);
  }
}

async function lzyumiFetchBrowserOnce(url) {
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

async function lzyumiFetchPageFlow({ nickname, openId, areaId, filter = 1, allCount = LZYUMI_ALL_COUNT }) {
  const page = await getBrowserPage();
  await page.waitForFunction(
    () => typeof window.findOrderSeleMe === "function" && typeof window.$ === "function",
    null,
    { timeout: LZYUMI_TIMEOUT_MS },
  );

  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "GET" && response.url().includes("/lzyumi/lol/info?"),
    { timeout: LZYUMI_TIMEOUT_MS },
  );

  await page.evaluate(
    ({ nicknameValue, openIdValue, areaIdValue, filterValue, allCountValue }) => {
      const setValue = (selector, value) => {
        const element = document.querySelector(selector);
        if (element) element.value = value;
      };

      setValue("#orderSku", nicknameValue);
      setValue("#allCount", String(allCountValue));
      setValue("#areaId", String(areaIdValue));
      setValue("#filter", String(filterValue));
      setValue("#seleMe", "1");
      window.findOrderSeleMe("", 0, Number(areaIdValue), openIdValue || "");
    },
    {
      nicknameValue: clean(nickname),
      openIdValue: clean(openId),
      areaIdValue: areaId || 1,
      filterValue: filter || 1,
      allCountValue: allCount || LZYUMI_ALL_COUNT,
    },
  );

  const response = await responsePromise;
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}: ${text.slice(0, 200)}`);
  }

  const json = JSON.parse(text);
  debugLzyumi("page-flow-info", {
    status: response.status(),
    requestUrl: response.url(),
    response: lzyumiResponseSummary(json),
  });
  return json;
}

async function firstVisibleLocator(page, selector) {
  const locator = page.locator(selector);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function visibleControlSummary(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style && style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    return [...document.querySelectorAll("input, button, a, [role='button'], div, span")]
      .filter(isVisible)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || "",
        name: element.getAttribute("name") || "",
        id: element.id || "",
        value: element.getAttribute("value") || "",
        text: (element.textContent || "").trim().slice(0, 40),
      }))
      .filter((item) => item.type || item.name || item.id || item.value || item.text)
      .slice(0, 30);
  }).catch(() => []);
}

async function lzyumiLogin() {
  if (!LZYUMI_LOGIN_ID || !LZYUMI_LOGIN_PASSWORD) {
    throw new Error("Missing REPORT_ENGINE_LZYUMI_LOGIN_ID or REPORT_ENGINE_LZYUMI_LOGIN_PASSWORD.");
  }

  const page = await getBrowserPage();
  await page.goto(LZYUMI_LOGIN_URL, {
    waitUntil: "domcontentloaded",
    timeout: LZYUMI_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);

  const userInput = await firstVisibleLocator(
    page,
    [
      'input[name*="user" i]',
      'input[name*="account" i]',
      'input[name*="login" i]',
      'input[name*="id" i]',
      'input[type="text"]',
      'input:not([type])',
    ].join(", "),
  );
  const passwordInput = await firstVisibleLocator(page, 'input[type="password"]');

  if (!userInput || !passwordInput) {
    throw new Error("Could not find visible login/password inputs on Lzyumi login page.");
  }

  await userInput.fill(LZYUMI_LOGIN_ID);
  await passwordInput.fill(LZYUMI_LOGIN_PASSWORD);

  const submit = await firstVisibleLocator(
    page,
    [
      'button[type="submit"]',
      'input[type="submit"]',
      'input[type="button"]',
      '[role="button"]',
      'a:has-text("登录")',
      'button:has-text("登录")',
      'div:has-text("登录")',
      `div:text-is("${LZYUMI_LOGIN_TARGET}")`,
      `span:text-is("${LZYUMI_LOGIN_TARGET}")`,
      `a:text-is("${LZYUMI_LOGIN_TARGET}")`,
      'input[value*="登录"]',
      'button',
    ].join(", "),
  );

  if (submit) {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: LZYUMI_TIMEOUT_MS }).catch(() => null),
      submit.click(),
    ]);
  } else {
    console.log("Could not find a visible Lzyumi login button; trying Enter from password field.");
    console.log(`Visible controls: ${JSON.stringify(await visibleControlSummary(page))}`);
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: LZYUMI_TIMEOUT_MS }).catch(() => null),
      passwordInput.press("Enter"),
    ]);
  }
  await page.waitForTimeout(2000);

  const cookies = await page.context().cookies();
  const localStorageKeys = await page.evaluate(() => Object.keys(window.localStorage || {})).catch(() => []);

  console.log("Lzyumi login attempted.");
  console.log(`Login page URL: ${page.url()}`);
  console.log(`Login page title: ${await page.title().catch(() => "")}`);
  console.log(`Cookies saved: ${cookies.length}`);
  console.log(`LocalStorage keys: ${localStorageKeys.join(", ") || "(none)"}`);
}

async function browserTextFetch(url) {
  await getBrowserPage().catch(() => null);
  const context = await browserContextPromise;
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: LZYUMI_TIMEOUT_MS,
    });
    const text = await page.locator("body").innerText({ timeout: 5000 }).catch(async () => page.content());
    return {
      ok: Boolean(response?.ok()),
      status: response?.status() || 0,
      text,
    };
  } finally {
    await page.close().catch(() => null);
  }
}

async function directTextFetch(url) {
  const agent = nodeProxyAgent();
  const response = await axios.get(url, {
    headers: LZYUMI_HEADERS,
    timeout: LZYUMI_TIMEOUT_MS,
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false,
    responseType: "text",
    transformResponse: [(data) => data],
  });
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    text: String(response.data || ""),
  };
}

function isEmptyLzyumiInfoResponse(url, response) {
  if (url && !url.includes("/lzyumi/lol/info?")) return false;
  if (!response || typeof response !== "object") return false;
  return (
    !response.battleInfo?.openId &&
    (!Array.isArray(response.data) || response.data.length === 0)
  );
}

async function lzyumiFetch(url) {
  if (FETCH_MODE === "direct") return lzyumiFetchDirect(url);

  try {
    return await lzyumiFetchBrowserOnce(url);
  } catch (error) {
    if (FETCH_MODE === "browser-strict") throw error;
    console.warn(`Browser Lzyumi fetch failed, falling back to direct fetch: ${error.message || error}`);
    return lzyumiFetchDirect(url);
  }
}

function lzyumiInfoUrl({ nickname, openId, areaId, filter, allCount = LZYUMI_ALL_COUNT }) {
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const areaName = CHINA_SERVERS[areaId] || CHINA_SERVERS[1];
  const encodedNickname = clean(nickname).replace(/#/g, `*~*~*${LZYUMI_RIOT_TAG_ISOLATE}`);
  const params = [
    `nickname=${encodeURIComponent(encodedNickname)}`,
    `allCount=${allCount}`,
    `areaId=${areaId}`,
    `areaName=${encodeURIComponent(areaName)}`,
    "seleMe=1",
    `filter=${filter}`,
    `openId=${encodeURIComponent(clean(openId))}`,
    `lzyumiSign=${lzyumiSign}`,
    `signStr=${signStr}`,
  ];
  if (LZYUMI_TOKENSTR) {
    params.push(`lzyumitokenstr=${encodeURIComponent(LZYUMI_TOKENSTR)}`);
  }

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

function debugWeGame(label, detail) {
  if (!DEBUG_WEGAME) return;
  console.log(`[wegame-debug] ${label} ${JSON.stringify(detail)}`);
}

function requireWeGameCookie() {
  if (!WEGAME_COOKIE) {
    throw new Error("Missing REPORT_ENGINE_WEGAME_COOKIE.");
  }
}

function parseCookieHeader(header) {
  const cookies = {};
  for (const part of clean(header).split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return cookies;
}

function cookieHeaderFromObject(cookies) {
  return Object.entries(cookies)
    .filter(([, value]) => clean(value))
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function cookiesFromSetCookie(setCookie) {
  const cookies = {};
  for (const header of setCookie || []) {
    const pair = String(header).split(";", 1)[0];
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    cookies[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return cookies;
}

function qqNumberFromUin(uin) {
  return clean(uin).replace(/^o/, "").replace(/^0+/, "");
}

function wegameSeedCookies() {
  requireWeGameCookie();
  return parseCookieHeader(WEGAME_COOKIE);
}

function shouldUseWeGameTicketRefresh(seedCookies) {
  if (WEGAME_AUTH_MODE === "static" || WEGAME_AUTH_MODE === "cookie") return false;
  if (WEGAME_AUTH_MODE === "ticket") return true;
  return Boolean(clean(seedCookies.p_uin) && clean(seedCookies.p_skey));
}

async function mintWeGameTicket(seedCookies) {
  const uin = clean(seedCookies.p_uin);
  const pskey = clean(seedCookies.p_skey);
  if (!uin || !pskey) {
    throw new Error("Missing p_uin or p_skey in REPORT_ENGINE_WEGAME_COOKIE; cannot refresh WeGame ticket.");
  }

  const agent = nodeProxyAgent();
  const response = await axios.post(
    WEGAME_LOGIN_BY_QQ_URL,
    {
      login_info: {
        qq_info_type: 6,
        uin: qqNumberFromUin(uin),
        sig: pskey,
        qqinfo_ext: [],
      },
      config_params: {
        lang_type: 0,
      },
      mappid: "10001",
      mcode: "",
      clienttype: "1000005",
    },
    {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,nl;q=0.6",
        "Content-Type": "application/json;charset=UTF-8",
        Cookie: WEGAME_COOKIE,
        Origin: "https://www.wegame.com.cn",
        Referer: "https://www.wegame.com.cn/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0",
      },
      timeout: WEGAME_TIMEOUT_MS,
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
    },
  );

  const data = response.data?.data || {};
  const mintedCookies = cookiesFromSetCookie(response.headers["set-cookie"]);
  if (!mintedCookies.tgp_ticket) {
    throw new Error(`WeGame login_by_qq did not return tgp_ticket: ${JSON.stringify(response.data)}`);
  }

  const now = Date.now();
  const refreshSeconds = Number(data.refresh_wt_span || 1800) || 1800;
  const expiresSeconds = Number(data.expires || 604800) || 604800;
  const refreshAt = now + Math.max(60, refreshSeconds - 60) * 1000;
  const expiresAt = now + Math.max(120, expiresSeconds) * 1000 - WEGAME_REFRESH_MARGIN_MS;
  const cookie = cookieHeaderFromObject({ ...seedCookies, ...mintedCookies });

  debugWeGame("ticket-refresh", {
    result: response.data?.code ?? data.error_code,
    expiresSeconds,
    refreshSeconds,
    setCookies: Object.keys(mintedCookies),
  });

  return {
    cookie,
    refreshAt: Math.min(refreshAt, expiresAt),
    expiresAt,
  };
}

async function wegameCookieForRequest() {
  const seedCookies = wegameSeedCookies();
  if (!shouldUseWeGameTicketRefresh(seedCookies)) return WEGAME_COOKIE;

  const now = Date.now();
  if (wegameTicketState?.cookie && now < wegameTicketState.refreshAt) {
    return wegameTicketState.cookie;
  }

  if (!wegameTicketPromise) {
    wegameTicketPromise = mintWeGameTicket(seedCookies)
      .then((ticket) => {
        wegameTicketState = ticket;
        return ticket;
      })
      .finally(() => {
        wegameTicketPromise = null;
      });
  }

  const ticket = await wegameTicketPromise;
  return ticket.cookie;
}

function isWeGameLoginExpired(data) {
  const code = Number(data?.result?.error_code ?? data?.data?.error_code ?? data?.code);
  return code === 8025004;
}

async function wegamePost(endpoint, payload, options = {}) {
  requireWeGameCookie();
  const agent = nodeProxyAgent();
  const cookie = await wegameCookieForRequest();
  const response = await axios.post(`${WEGAME_BASE}/${endpoint}`, payload, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,nl;q=0.6",
      "Content-Type": "application/json;charset=UTF-8",
      Cookie: cookie,
      Origin: "https://www.wegame.com.cn",
      Referer: "https://www.wegame.com.cn/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0",
    },
    timeout: WEGAME_TIMEOUT_MS,
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false,
  });

  if (options.retry !== false && isWeGameLoginExpired(response.data)) {
    wegameTicketState = null;
    debugWeGame("login-expired-retry", { endpoint });
    return wegamePost(endpoint, payload, { retry: false });
  }

  debugWeGame(endpoint, {
    payload: endpoint === "SearchPlayer" ? payload : { ...payload, id: payload.id ? "[redacted]" : payload.id },
    result: response.data?.result,
  });
  return response.data;
}

function decodeWeGameName(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function wegamePlayerIdentityKey(player) {
  const full = riotId(player);
  return clean(full) || clean(player.riotName) || clean(player.displayName);
}

async function findWeGamePlayerIdentity(player) {
  const areaId = player.chinaServerId || 1;
  const expectedKey = riotIdKey(player.riotName, player.riotTag);
  const searchName = wegamePlayerIdentityKey(player);
  const responses = [];

  if (searchName) {
    responses.push(await wegamePost("SearchPlayer", {
      nickname: searchName,
      tag: 0,
      page_size: 20,
      from_src: "lol_helper",
    }));
  }

  if (player.riotName && player.riotTag && searchName !== player.riotName) {
    responses.push(await wegamePost("SearchPlayer", {
      nickname: player.riotName,
      tag: 0,
      page_size: 50,
      from_src: "lol_helper",
    }));
  }

  for (const response of responses) {
    const candidates = Array.isArray(response?.players) ? response.players : [];
    const exact = candidates.find((candidate) => {
      const candidateKey = riotIdKey(player.riotName, String(candidate.tag_num || ""));
      return (!expectedKey || candidateKey === expectedKey) && Number(candidate.area) === Number(areaId);
    });
    if (exact?.openid) return exact;
  }

  const savedOpenId = clean(player.openId);
  if (savedOpenId) {
    return {
      openid: savedOpenId,
      area: areaId,
      tag_num: clean(player.riotTag) || null,
    };
  }

  return null;
}

function wegameGameTimeLabel(game) {
  const value = Number(game?.game_start_time);
  if (!Number.isFinite(value)) return "";
  const china = new Date(value + 8 * 60 * 60 * 1000);
  const month = String(china.getUTCMonth() + 1).padStart(2, "0");
  const day = String(china.getUTCDate()).padStart(2, "0");
  const hours = String(china.getUTCHours()).padStart(2, "0");
  const minutes = String(china.getUTCMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function adaptWeGameRecentGame(game) {
  const gameId = clean(game?.game_id || game?.gameId);
  return {
    ...game,
    gameId,
    titleTime: wegameGameTimeLabel(game),
    title: [
      game?.game_queue_id ? `queue ${game.game_queue_id}` : "WeGame match",
      game?.champion_id ? `champion ${game.champion_id}` : "",
      clean(game?.win),
    ].filter(Boolean).join(" | "),
    isWin: clean(game?.win).toLowerCase() === "win" ? 1 : 0,
  };
}

function adaptWeGamePlayerDetail(player) {
  const name = decodeWeGameName(player?.tagName || player?.name);
  const kills = Number(player?.championsKilled ?? player?.kills ?? 0) || 0;
  const deaths = Number(player?.numDeaths ?? player?.deaths ?? 0) || 0;
  const assists = Number(player?.assists ?? 0) || 0;
  const battleHonour = player?.battleHonour || {};

  return {
    ...player,
    nickName: name,
    nickNameStr: name,
    scoreInfo: `${kills}/${deaths}/${assists}`,
    scoreInfoNum: Number(player?.gameScore || 0) || undefined,
    detailChampionId: String(player?.championId ?? player?.originchampionId ?? ""),
    duanweiInfo: clean(player?.battleHonour?.gameLevel),
    wasMvp: String(battleHonour.isMvp || 0),
    wasSvp: String(battleHonour.isSvp || 0),
    openIdNow: clean(player?.openid),
    translateAreaId: Number(player?.translate_areaId || player?.original_area_id || 0) || undefined,
    totalDamageDealt: Number(player?.totalDamageToChampions ?? player?.totalDamageDealt ?? 0) || 0,
    echartsMap: {
      goldEarned: Number(player?.goldEarned || 0) || 0,
      totalDamageDealt: Number(player?.totalDamageToChampions ?? player?.totalDamageDealt ?? 0) || 0,
    },
  };
}

function adaptWeGameDetail(detail) {
  const battle = detail?.battle_detail || {};
  return {
    ...detail,
    code: detail?.result?.error_code ?? 1,
    message: detail?.result?.error_message || "success",
    data: {
      ...battle,
      gameType: battle.game_type,
      gameMode: battle.game_mode,
      teamDetails: battle.team_details || [],
      wgBattleDetailInfo: (battle.player_details || []).map(adaptWeGamePlayerDetail),
    },
  };
}

async function wegameGetBattleList({ openId, areaId, count = WEGAME_LIST_COUNT }) {
  const response = await wegamePost("GetBattleList", {
    account_type: 2,
    area: areaId,
    id: openId,
    count,
    filter: "",
    offset: 0,
    from_src: "lol_helper",
  });

  const games = (response?.battles || []).map(adaptWeGameRecentGame).filter((game) => game.gameId);
  return { response, games };
}

async function wegameGetBattleDetail({ openId, areaId, gameId }) {
  const response = await wegamePost("GetBattleDetail", {
    account_type: 2,
    area: areaId,
    id: openId,
    game_id: gameId,
    from_src: "lol_helper",
  });
  return adaptWeGameDetail(response);
}

async function fetchRecentGamesForPlayerViaWeGame(player) {
  const identity = await findWeGamePlayerIdentity(player);
  if (!identity?.openid) return null;

  const areaId = Number(identity.area || player.chinaServerId || 1) || 1;
  const { response, games } = await wegameGetBattleList({
    openId: identity.openid,
    areaId,
    count: WEGAME_LIST_COUNT,
  });

  if (!games.length) return null;

  return {
    source: "wegame",
    player,
    areaId,
    profile: {
      battleInfo: {
        openId: identity.openid,
        areaId,
        nameInfoNew: riotId(player),
        wegamePlayer: identity,
      },
      wegameSearch: identity,
      wegameBattleList: response,
    },
    openId: identity.openid,
    games,
  };
}

async function fetchRecentGamesForPlayerViaLzyumi(player) {
  const areaId = player.chinaServerId || 1;
  const savedOpenId = clean(player.openId);
  const lookupNames = [clean(player.riotName), riotId(player)].filter(Boolean);
  const attempts = savedOpenId
    ? [
        ...lookupNames.map((nickname) => ({ nickname, openId: "" })),
        // Lzyumi's own browser page searches by nickname first, then uses the resolved openId.
        // A stale saved openId can make an otherwise valid nickname lookup return "unknown".
        ...lookupNames.map((nickname) => ({ nickname, openId: savedOpenId })),
        { nickname: "", openId: savedOpenId },
      ]
    : lookupNames.map((nickname) => ({ nickname, openId: "" }));
  const seenAttempts = new Set();

  for (const attempt of attempts) {
    const attemptKey = `${attempt.nickname}::${attempt.openId}`;
    if (seenAttempts.has(attemptKey)) continue;
    seenAttempts.add(attemptKey);

    const runAttempt = () => Promise.all(
      LZYUMI_FILTERS.map((filter) => {
        const url = lzyumiInfoUrl({ ...attempt, areaId, filter });
        return lzyumiFetch(url)
          .then((response) => {
            debugLzyumi("info", {
              player: riotId(player) || clean(player.displayName),
              areaId,
              filter,
              base: LZYUMI_BASE,
              tokenSupplied: Boolean(LZYUMI_TOKENSTR),
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
              base: LZYUMI_BASE,
              tokenSupplied: Boolean(LZYUMI_TOKENSTR),
              nicknameSupplied: Boolean(clean(attempt.nickname)),
              openIdSupplied: Boolean(clean(attempt.openId)),
              error: error.message || String(error),
            });
            return null;
          });
      }),
    );

    let responses = await runAttempt();
    const hasData = responses.some(
      (response) => response?.battleInfo?.openId || response?.data?.length,
    );

    if (!hasData && responses.some((response) => isEmptyLzyumiInfoResponse("", response))) {
      await resetBrowserSession("empty-player-attempt");
      responses = await runAttempt();
      debugLzyumi("player-attempt-retry", {
        player: riotId(player) || clean(player.displayName),
        nicknameSupplied: Boolean(clean(attempt.nickname)),
        openIdSupplied: Boolean(clean(attempt.openId)),
        hasData: responses.some((response) => response?.battleInfo?.openId || response?.data?.length),
      });
    }

    if (!responses.some((response) => response?.battleInfo?.openId || response?.data?.length)) continue;

    const profile = responses.find((response) => response?.battleInfo?.openId) || null;
    const expectedRiotKey = riotIdKey(player.riotName, player.riotTag);
    const resolvedName = clean(profile?.battleInfo?.nameInfoNew);

    if (expectedRiotKey && resolvedName && !resolvedRiotIdMatches(resolvedName, player.riotName, player.riotTag)) {
      debugLzyumi("identity-mismatch", {
        player: riotId(player) || clean(player.displayName),
        suppliedOpenId: Boolean(clean(attempt.openId)),
        resolvedName,
      });
      continue;
    }

    if (expectedRiotKey && !resolvedName && !clean(attempt.openId)) {
      debugLzyumi("identity-unverified", {
        player: riotId(player) || clean(player.displayName),
        suppliedOpenId: false,
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

async function fetchRecentGamesForPlayer(player) {
  if (MATCH_SOURCE !== "lzyumi" && WEGAME_COOKIE) {
    try {
      const source = await fetchRecentGamesForPlayerViaWeGame(player);
      if (source) return source;
      if (MATCH_SOURCE === "wegame") return null;
    } catch (error) {
      debugWeGame("fetch-player-error", {
        player: riotId(player) || clean(player.displayName),
        error: error.response?.data || error.message || String(error),
      });
      if (MATCH_SOURCE === "wegame") throw error;
    }
  }

  return fetchRecentGamesForPlayerViaLzyumi(player);
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

function candidateTimeLabel(game) {
  return clean(game?.titleTime) || clean(game?.title).replace(/<br>/g, " ") || "unknown time";
}

function formatCandidateSummary(candidate, sessionCreatedAt) {
  if (!candidate?.game) return "";

  const matched = candidate.rosterMatch?.matched?.length ?? 0;
  const missing = candidate.rosterMatch?.missing ?? [];
  const timeIssue = gameTimeWindowIssue(candidate.game, sessionCreatedAt);
  const parts = [
    `${candidateTimeLabel(candidate.game)}`,
    `${matched}/10 players`,
  ];

  if (timeIssue) parts.push(timeIssue);
  if (missing.length) parts.push(`missing ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "..." : ""}`);

  return parts.join(" - ");
}

async function loadChampionNames() {
  if (championNamesPromise) return championNamesPromise;

  championNamesPromise = (async () => {
    const localFiles = [
      path.join(__dirname, "champions.json"),
      path.join(__dirname, "..", "public", "lol", "champions", "champions.json"),
    ];

    for (const file of localFiles) {
      try {
        const champions = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
        return new Map(champions.map((champion) => [String(champion.id), champion.name]));
      } catch {
        // Try the next source.
      }
    }

    try {
      const response = await axios.get(`${SITE_URL}/lol/champions/champions.json`, { timeout: 10000 });
      const champions = Array.isArray(response.data) ? response.data : [];
      return new Map(champions.map((champion) => [String(champion.id), champion.name]));
    } catch {
      return new Map();
    }
  })();

  return championNamesPromise;
}

async function summarizeReporter(job, detail, game, rosterMatch) {
  const championNames = await loadChampionNames();
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

async function fetchDetailForSource(source, game) {
  if (source?.source === "wegame") {
    return wegameGetBattleDetail({
      openId: source.openId,
      gameId: game.gameId,
      areaId: source.areaId,
    });
  }

  return lzyumiFetch(
    lzyumiDetailUrl({
      openId: source.openId,
      gameId: game.gameId,
      areaId: source.areaId,
    }),
  );
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
  const riot = cliValue("--check-player") || cliValue("--wegame-check-player");
  const areaId = Number(cliValue("--area-id", "1")) || 1;
  const limit = Number(cliValue("--limit", "8")) || 8;
  const openId = cliValue("--open-id");
  const { name, tag } = parseRiotId(riot);

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

  const championNames = await loadChampionNames();
  const games = source.games.slice(0, limit);
  console.log(`Found ${source.games.length} recent game(s) for ${riot || name} via ${source.source || "lzyumi"}. Showing ${games.length}.`);

  for (const game of games) {
    try {
      const detail = await fetchDetailForSource(source, game);

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

async function debugPageCheckPlayer() {
  if (process.argv.includes("--lzyumi-login")) {
    await lzyumiLogin();
  }

  const riot = cliValue("--page-check-player");
  const areaId = Number(cliValue("--area-id", "1")) || 1;
  const filter = Number(cliValue("--filter", "1")) || 1;
  const limit = Number(cliValue("--limit", "8")) || 8;
  const openId = cliValue("--open-id");
  const { name, tag } = parseRiotId(riot);
  const nickname = name && tag ? `${name}#${tag}` : name;

  if (!nickname && !openId) {
    throw new Error('Usage: node worker.js --page-check-player "deebeedee#34323" --area-id 1');
  }

  const response = await lzyumiFetchPageFlow({
    nickname,
    openId,
    areaId,
    filter,
    allCount: Math.max(limit, LZYUMI_ALL_COUNT),
  });

  const summary = lzyumiResponseSummary(response);
  console.log(`Page-flow Lzyumi summary for ${riot || nickname || openId}:`);
  console.log(JSON.stringify(summary, null, 2));

  const games = Array.isArray(response.data) ? response.data.slice(0, limit) : [];
  for (const game of games) {
    const time = clean(game.titleTime) || clean(game.title) || "Unknown time";
    const title = clean(game.title).replace(/<br>/g, " ");
    console.log(`- ${game.gameId || "no-game-id"} | ${time} | ${title}`);
  }
}

function printTrace(label, result) {
  const lines = String(result.text || "")
    .split(/\r?\n/)
    .filter((line) => /^(ip|colo|loc|warp|gateway)=/.test(line));

  console.log(`${label}: HTTP ${result.status}`);
  console.log(lines.length ? lines.join("\n") : String(result.text || "").slice(0, 500));
}

async function debugProbeNetwork() {
  console.log(`Report Engine proxy: ${reportEngineProxyUrl() || "(none)"}`);

  const traceUrl = "https://www.cloudflare.com/cdn-cgi/trace";
  const directTrace = await directTextFetch(traceUrl).catch((error) => ({
    status: 0,
    text: error.message || String(error),
  }));
  printTrace("Node fetch", directTrace);

  const browserTrace = await browserTextFetch(traceUrl).catch((error) => ({
    status: 0,
    text: error.message || String(error),
  }));
  printTrace("Browser fetch", browserTrace);
}

async function findMatchingGame(job) {
  const players = job.session.players;
  const searchPlayers = [
    ...players.filter((player) => player.kookUserId === job.requestedByKookId),
    ...players.filter((player) => player.kookUserId !== job.requestedByKookId),
  ];
  const sources = (await Promise.all(searchPlayers.map(fetchRecentGamesForPlayer))).filter(Boolean);
  const gamesById = new Map();

  if (sources.length === 0) {
    throw new Error(
      `No recent ECL.GG games were found for this inhouse roster. Checked ${searchPlayers.length} players, but the configured match source returned no recent game lists.`,
    );
  }

  for (const source of sources) {
    for (const game of source.games) {
      if (!game?.gameId || job.reportedGameIds.includes(game.gameId) || gamesById.has(game.gameId)) {
        continue;
      }
      gamesById.set(game.gameId, { source, game });
    }
  }

  if (gamesById.size === 0) {
    throw new Error(
      `No unreported ECL.GG games were found for this inhouse roster. The configured match source returned games for ${sources.length}/${searchPlayers.length} players, but they were already reported or missing game IDs.`,
    );
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
    .slice(0, REPORT_CANDIDATE_LIMIT);

  if (candidates.length === 0) {
    throw new Error(
      outOfWindowCandidate
        ? `No matching inhouse found in the expected time window. Closest candidate: ${candidateTimeLabel(
            outOfWindowCandidate.game,
          )}; ${gameTimeWindowIssue(outOfWindowCandidate.game, job.session.createdAt)}.`
        : `No match candidates remained after filtering ${gamesById.size} recent games.`,
    );
  }

  const checked = (
    await Promise.all(
      candidates.map(async ({ source, game }) => {
        try {
          const detail = await fetchDetailForSource(source, game);

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

  if (checked.length === 0) {
    throw new Error(`The configured match source returned ${candidates.length} candidate games, but every detail lookup failed.`);
  }

  const exact = checked
    .filter((candidate) => candidate.rosterMatch.matched.length >= REQUIRED_MATCHES)
    .sort((a, b) => gameSortValue(a.game, job.session.createdAt) - gameSortValue(b.game, job.session.createdAt));

  if (exact[0]) return exact[0];

  const best = checked.sort((a, b) => b.rosterMatch.matched.length - a.rosterMatch.matched.length)[0];
  throw new Error(
    best
      ? `${formatRosterMiss(best.rosterMatch)} Best candidate: ${formatCandidateSummary(best, job.session.createdAt)}.`
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
    const reply = await summarizeReporter(job, match.detail, match.game, match.rosterMatch);
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

  if (MATCH_SOURCE === "wegame" && !WEGAME_COOKIE) {
    throw new Error("Missing REPORT_ENGINE_WEGAME_COOKIE while REPORT_ENGINE_MATCH_SOURCE=wegame.");
  }

  console.log(
    `ECL Report Engine polling ${SITE_URL} using ${MATCH_SOURCE} match source with ${proxyLabel(reportEngineProxy())}`,
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

if (process.argv.includes("--probe-network")) {
  debugProbeNetwork().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
} else if (process.argv.includes("--page-check-player")) {
  debugPageCheckPlayer().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
} else if (process.argv.includes("--lzyumi-login")) {
  lzyumiLogin().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
} else if (process.argv.includes("--check-player") || process.argv.includes("--wegame-check-player")) {
  debugCheckPlayer().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
} else {
  main();
}
