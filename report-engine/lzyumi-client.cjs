"use strict";

const crypto = require("crypto");

const DEFAULT_LZYUMI_BASE_URL = "https://l.lzyumi.top/lzyumi/lol";
const RIOT_TAG_SEPARATOR = "*~*~*\u2066";

class LzyumiResponseError extends Error {
  constructor(message, code = null, options = {}) {
    super(message);
    this.name = "LzyumiResponseError";
    this.code = code;
    this.reason = options.reason || null;
    this.responseShape = options.responseShape || null;
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function chinaTimeParts(value = new Date()) {
  const input = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(input.getTime())) {
    throw new TypeError("A valid timestamp is required for Lzyumi request signing.");
  }

  const china = new Date(input.getTime() + 8 * 60 * 60 * 1000);
  const month = String(china.getUTCMonth() + 1);
  const day = String(china.getUTCDate());
  const hours = String(china.getUTCHours());
  const minutes = String(china.getUTCMinutes());
  const seconds = String(china.getUTCSeconds());

  return {
    month,
    day,
    hours,
    minutes,
    seconds,
    MM: month.padStart(2, "0"),
    DD: day.padStart(2, "0"),
    HH: hours.padStart(2, "0"),
    mm: minutes.padStart(2, "0"),
    ss: seconds.padStart(2, "0"),
  };
}

function createLzyumiSignature(value = new Date()) {
  const parts = chinaTimeParts(value);
  const signSource = `d${parts.MM}o${parts.DD}u${parts.HH}d${parts.mm}o${parts.ss}d`;

  return {
    lzyumiSign: crypto.createHash("md5").update(signSource).digest("hex"),
    signStr: [
      parts.month,
      parts.day,
      parts.hours,
      parts.minutes,
      parts.seconds,
      parts.month.length * 3,
      parts.day.length * 3,
      parts.hours.length * 3,
      parts.minutes.length * 3,
      parts.seconds.length * 3,
    ].join(""),
  };
}

function lzyumiEndpoints(baseUrl = DEFAULT_LZYUMI_BASE_URL) {
  const parsed = new URL(clean(baseUrl) || DEFAULT_LZYUMI_BASE_URL);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new TypeError("Lzyumi base URL must use HTTP or HTTPS.");
  }

  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";

  const configuredPath = parsed.pathname.replace(/\/+$/, "");
  const apiPath = configuredPath.endsWith("/info")
    ? configuredPath.slice(0, -"/info".length)
    : configuredPath;

  const endpoint = (suffix) => {
    const url = new URL(parsed.toString());
    url.pathname = `${apiPath}/${suffix}`.replace(/\/{2,}/g, "/");
    return url;
  };

  return {
    info: endpoint("info"),
    detail: endpoint("info/findOrderDetailInfoAll"),
  };
}

function addSignedParameters(url, { areaId, sessionToken, timestamp }) {
  const { lzyumiSign, signStr } = createLzyumiSignature(timestamp);
  url.searchParams.set("areaId", String(Number(areaId) || 1));
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);
  if (clean(sessionToken)) {
    url.searchParams.set("lzyumitokenstr", clean(sessionToken));
  }
}

function lzyumiInfoUrl({
  baseUrl = DEFAULT_LZYUMI_BASE_URL,
  nickname = "",
  openId = "",
  areaId = 1,
  areaName = "",
  filter = 1,
  allCount = 10,
  sessionToken = "",
  timestamp = new Date(),
} = {}) {
  const { info } = lzyumiEndpoints(baseUrl);
  const encodedNickname = clean(nickname).replace(/#/g, RIOT_TAG_SEPARATOR);

  info.searchParams.set("nickname", encodedNickname);
  info.searchParams.set("allCount", String(Number(allCount) || 10));
  info.searchParams.set("areaName", clean(areaName));
  info.searchParams.set("seleMe", "1");
  info.searchParams.set("filter", String(Number(filter) || 1));
  info.searchParams.set("openId", clean(openId));
  addSignedParameters(info, { areaId, sessionToken, timestamp });
  return info.toString();
}

function lzyumiDetailUrl({
  baseUrl = DEFAULT_LZYUMI_BASE_URL,
  openId,
  gameId,
  areaId = 1,
  sessionToken = "",
  timestamp = new Date(),
} = {}) {
  if (!clean(openId) || !clean(gameId)) {
    throw new TypeError("Lzyumi match details require openId and provider gameId.");
  }

  const { detail } = lzyumiEndpoints(baseUrl);
  detail.searchParams.set("openId", clean(openId));
  detail.searchParams.set("gameId", clean(gameId));
  addSignedParameters(detail, { areaId, sessionToken, timestamp });
  return detail.toString();
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LzyumiResponseError(`Lzyumi ${label} response was not a JSON object.`);
  }
}

function assertApplicationSuccess(value, label) {
  assertObject(value, label);
  if (value.code !== undefined && String(value.code) !== "1") {
    const code = String(value.code).slice(0, 32);
    throw new LzyumiResponseError(
      `Lzyumi ${label} request failed with application code ${code}.`,
      code,
    );
  }
}

function lzyumiResponseShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: Array.isArray(value) ? "array" : typeof value };
  }

  const code = ["string", "number", "boolean"].includes(typeof value.code)
    ? String(value.code).slice(0, 32)
    : null;

  return {
    type: "object",
    keys: Object.keys(value).sort().slice(0, 24),
    code,
    dataType: Array.isArray(value.data) ? "array" : typeof value.data,
    hasBattleInfo: Boolean(value.battleInfo && typeof value.battleInfo === "object"),
  };
}

function assertLzyumiHistoryResponse(value) {
  assertApplicationSuccess(value, "history");
  if (!Array.isArray(value.data)) {
    throw new LzyumiResponseError(
      "Lzyumi history response is missing its data array.",
      null,
      {
        reason: "malformed-history",
        responseShape: lzyumiResponseShape(value),
      },
    );
  }
  return value;
}

function assertLzyumiDetailResponse(value) {
  assertApplicationSuccess(value, "match-details");
  const players = value.data?.wgBattleDetailInfo;
  if (!Array.isArray(players)) {
    throw new LzyumiResponseError("Lzyumi match-details response is missing its player list.");
  }
  if (players.length !== 10) {
    throw new LzyumiResponseError(
      `Lzyumi match-details response contained ${players.length}/10 players.`,
    );
  }
  return value;
}

module.exports = {
  DEFAULT_LZYUMI_BASE_URL,
  LzyumiResponseError,
  RIOT_TAG_SEPARATOR,
  assertLzyumiDetailResponse,
  assertLzyumiHistoryResponse,
  createLzyumiSignature,
  lzyumiResponseShape,
  lzyumiDetailUrl,
  lzyumiEndpoints,
  lzyumiInfoUrl,
};
