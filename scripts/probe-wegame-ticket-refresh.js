#!/usr/bin/env node

/*
 * Probe whether QQ/WeGame browser auth values can mint fresh WeGame API tickets.
 *
 * Inputs can come from env or a .env file:
 *   REPORT_ENGINE_WEGAME_COOKIE    Full browser Cookie header, optional.
 *   WEGAME_UIN / REPORT_ENGINE_WEGAME_UIN
 *   WEGAME_SKEY / REPORT_ENGINE_WEGAME_SKEY
 *   WEGAME_PSKEY / REPORT_ENGINE_WEGAME_PSKEY
 *   WEGAME_SEARCH_NAME             Defaults to Zeu5#39026.
 */

const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const LOGIN_BY_QQ_URL = "https://www.wegame.com.cn/api/middle/clientapi/auth/login_by_qq";
const SEARCH_PLAYER_URL = "https://www.wegame.com.cn/api/v1/wegame.pallas.game.LolBattle/SearchPlayer";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseCookieHeader(cookieHeader) {
  const cookies = {};
  for (const part of clean(cookieHeader).split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .filter(([, value]) => clean(value))
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function redact(value, visible = 6) {
  const raw = clean(value);
  if (!raw) return "";
  if (raw.length <= visible * 2) return `${raw.slice(0, 2)}...`;
  return `${raw.slice(0, visible)}...${raw.slice(-visible)}`;
}

function postJson(url, payload, headers = {}) {
  const body = JSON.stringify(payload);
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: parsed.hostname,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
          "Content-Type": "application/json;charset=UTF-8",
          "Content-Length": Buffer.byteLength(body),
          Origin: "https://www.wegame.com.cn",
          Referer: "https://www.wegame.com.cn/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
          ...headers,
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // Keep raw text.
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text,
            json,
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.write(body);
    req.end();
  });
}

function cookiesFromSetCookie(setCookie) {
  const result = {};
  for (const header of setCookie || []) {
    const pair = header.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    result[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return result;
}

function qqNumberFromUin(uin) {
  return clean(uin).replace(/^o/, "").replace(/^0+/, "");
}

function loginPayloads({ uin, skey, pskey }) {
  const qq = qqNumberFromUin(uin);
  return [
    {
      label: "qqinfo_ext_with_skey_pskey",
      payload: {
        qq,
        qq_info_type: 6,
        qqinfo_ext: {
          skey,
          p_skey: pskey,
        },
      },
    },
    {
      label: "qqinfo_ext_with_pskey_only",
      payload: {
        qq,
        qq_info_type: 6,
        qqinfo_ext: {
          p_skey: pskey,
        },
      },
    },
    {
      label: "flat_skey_pskey",
      payload: {
        qq,
        qq_info_type: 6,
        skey,
        p_skey: pskey,
      },
    },
  ];
}

async function testSearch(cookieHeaderValue, searchName) {
  const response = await postJson(
    SEARCH_PLAYER_URL,
    {
      nickname: searchName,
      tag: 0,
      page_size: 10,
      from_src: "lol_helper",
    },
    { Cookie: cookieHeaderValue },
  );
  return response;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const existingCookie = clean(process.env.REPORT_ENGINE_WEGAME_COOKIE || process.env.WEGAME_COOKIE);
  const parsedCookie = parseCookieHeader(existingCookie);
  const uin = clean(process.env.WEGAME_UIN || process.env.REPORT_ENGINE_WEGAME_UIN || parsedCookie.p_uin);
  const skey = clean(process.env.WEGAME_SKEY || process.env.REPORT_ENGINE_WEGAME_SKEY || parsedCookie.skey);
  const pskey = clean(process.env.WEGAME_PSKEY || process.env.REPORT_ENGINE_WEGAME_PSKEY || parsedCookie.p_skey);
  const searchName = clean(process.env.WEGAME_SEARCH_NAME || process.argv[2]) || "Zeu5#39026";

  console.log("inputs", {
    hasCookie: Boolean(existingCookie),
    uin: redact(uin),
    hasSkey: Boolean(skey),
    hasPskey: Boolean(pskey),
    searchName,
  });

  if (!uin || !pskey) {
    throw new Error("Need p_uin and p_skey. Provide REPORT_ENGINE_WEGAME_COOKIE or WEGAME_UIN + WEGAME_PSKEY.");
  }

  if (existingCookie) {
    const currentSearch = await testSearch(existingCookie, searchName);
    console.log("current-cookie-search", {
      http: currentSearch.status,
      result: currentSearch.json?.result || null,
      players: Array.isArray(currentSearch.json?.players) ? currentSearch.json.players.length : null,
    });
  }

  for (const attempt of loginPayloads({ uin, skey, pskey })) {
    console.log(`\ntrying ${attempt.label}`, {
      qq: redact(attempt.payload.qq),
      hasSkey: Boolean(skey),
      hasPskey: Boolean(pskey),
    });

    const login = await postJson(
      LOGIN_BY_QQ_URL,
      attempt.payload,
      existingCookie ? { Cookie: existingCookie } : {},
    );
    const mintedCookies = cookiesFromSetCookie(login.headers["set-cookie"]);
    const mergedCookie = cookieHeader({ ...parsedCookie, ...mintedCookies });

    console.log("login_by_qq", {
      http: login.status,
      result: login.json?.result || login.json || login.text.slice(0, 200),
      setCookies: Object.keys(mintedCookies),
      tgpId: redact(mintedCookies.tgp_id || parsedCookie.tgp_id),
      hasTgpTicket: Boolean(mintedCookies.tgp_ticket || parsedCookie.tgp_ticket),
    });

    if (!mergedCookie) continue;

    const search = await testSearch(mergedCookie, searchName);
    console.log("minted-cookie-search", {
      http: search.status,
      result: search.json?.result || null,
      players: Array.isArray(search.json?.players) ? search.json.players.length : null,
    });

    if (search.json?.result?.error_code === 0) {
      console.log("SUCCESS: this login_by_qq payload can produce a usable WeGame API session.");
      return;
    }
  }

  console.log("\nNo tested login_by_qq payload produced a usable SearchPlayer session.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
