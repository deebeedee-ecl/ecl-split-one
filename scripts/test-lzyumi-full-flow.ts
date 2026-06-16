import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://a.2025lol.top";
const infoEndpoint = `${baseUrl}/lzyumi/lol/info`;
const detailEndpoint = `${baseUrl}/lzyumi/lol/info/findOrderDetailInfoAll`;

type JsonRecord = Record<string, unknown>;

type DetailResponse = {
  code?: number | string;
  message?: string;
  msg?: string;
  data?: {
    wgBattleDetailInfo?: unknown[];
    teamDetails?: unknown[];
    [key: string]: unknown;
  } | null;
};

class CookieJar {
  private cookies = new Map<string, string>();

  store(headers: Headers) {
    const maybeHeaders = headers as Headers & {
      getSetCookie?: () => string[];
      raw?: () => Record<string, string[]>;
    };

    const setCookies =
      maybeHeaders.getSetCookie?.() ??
      maybeHeaders.raw?.()["set-cookie"] ??
      [];

    for (const cookie of setCookies) {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");

      if (separator > 0) {
        this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
  }

  header() {
    return [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg ? arg.slice(prefix.length) : undefined;
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function createSignature(now = new Date()) {
  const MM = String(now.getMonth() + 1);
  const DD = String(now.getDate());
  const HH = String(now.getHours());
  const mm = String(now.getMinutes());
  const ss = String(now.getSeconds());
  const paddedMM = MM.padStart(2, "0");
  const paddedDD = DD.padStart(2, "0");
  const paddedHH = HH.padStart(2, "0");
  const paddedMm = mm.padStart(2, "0");
  const paddedSs = ss.padStart(2, "0");

  const signSource = `dld${paddedMM}o${paddedDD}u${paddedHH}d${paddedMm}o${paddedSs}dld`;
  const lzyumiSign = md5(signSource);
  const signStr = `${MM}${DD}${HH}${mm}${ss}${MM.length * 3}${
    DD.length * 3
  }${HH.length * 3}${mm.length * 3}${ss.length * 3}`;

  return { lzyumiSign, signStr, signSource };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replaceTemplate(value: string, replacements: Record<string, string>) {
  let next = value;

  for (const [key, replacement] of Object.entries(replacements)) {
    next = next.replaceAll(`{${key}}`, encodeURIComponent(replacement));
  }

  return next;
}

function buildInfoUrl({
  player,
  areaId,
  openId,
}: {
  player: string;
  areaId: string;
  openId?: string;
}) {
  const { lzyumiSign, signStr } = createSignature();
  const normalizedPlayer = player.trim() || "有多少人和我一样";
  const encodedNickname = normalizedPlayer.replace("#", "*~*~*");
  const params = [
    `nickname=${encodedNickname}`,
    "allCount=10",
    `areaId=${areaId}`,
    `areaName=${encodeURIComponent(getAreaName(areaId))}`,
    "seleMe=1",
    "filter=1",
    `openId=${openId ?? ""}`,
    `lzyumiSign=${lzyumiSign}`,
    `signStr=${signStr}`,
  ];

  return `${infoEndpoint}?${params.join("&")}`;
}

function getAreaName(areaId: string) {
  const names: Record<string, string> = {
    "1": "艾欧尼亚",
    "14": "黑色玫瑰",
    "31": "峡谷之巅",
    "30": "男爵领域",
    "3": "祖安",
    "4": "诺克萨斯",
    "16": "恕瑞玛",
  };

  return names[areaId] ?? "艾欧尼亚";
}

function findValuesByKey(value: unknown, keyPattern: RegExp): string[] {
  const results: string[] = [];

  function visit(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!isRecord(node)) return;

    for (const [key, child] of Object.entries(node)) {
      if (keyPattern.test(key) && typeof child === "string" && child.trim()) {
        results.push(child);
      }

      visit(child);
    }
  }

  visit(value);
  return [...new Set(results)];
}

function pickEncodedGameId(candidates: string[]) {
  return (
    candidates.find((value) => /[=/+]/.test(value) && !/^\d+$/.test(value)) ??
    candidates[0]
  );
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { rawText: text };
  }
}

async function main() {
  const player = getArgValue("player") ?? "";
  const areaId = getArgValue("areaId") ?? getArgValue("areaid") ?? "1";
  const searchUrl = getArgValue("searchUrl");
  const recentUrl = getArgValue("recentUrl");
  let openId = getArgValue("openId") ?? getArgValue("openid");
  let gameId = getArgValue("gameId") ?? getArgValue("gameid");

  const jar = new CookieJar();
  const commonHeaders = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
    Referer: `${baseUrl}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  };

  async function sessionFetch(url: string) {
    const cookieHeader = jar.header();
    const response = await fetch(url, {
      headers: {
        ...commonHeaders,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    jar.store(response.headers);
    return response;
  }

  console.log("Step 1: GET home");
  const homeResponse = await sessionFetch(`${baseUrl}/`);
  console.log("home HTTP status:", homeResponse.status);
  console.log("cookie header after home:", jar.header() || "(none)");

  if (!openId) {
    if (!player && !searchUrl) {
      throw new Error(
        'Provide either --openId="..." or --player="RiotName#Tag".'
      );
    }

    const url = searchUrl
      ? replaceTemplate(searchUrl, { player, areaId })
      : buildInfoUrl({ player, areaId });
    console.log("Step 2: lookup player/recent games:", url);
    const response = await sessionFetch(url);
    const json = await readJson(response);
    const outputPath = path.join(process.cwd(), "scripts", "full-flow-search-response.json");

    await writeFile(outputPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    console.log("search HTTP status:", response.status);
    console.log("saved search response:", outputPath);

    const openIdCandidates = findValuesByKey(json, /^openId$/i);
    console.log("openId candidates:", openIdCandidates);
    openId = openIdCandidates[0];

    const gameIdCandidates = findValuesByKey(json, /^(gameId|orderId)$/i);
    console.log("gameId candidates from lookup:", gameIdCandidates);
    gameId = gameId ?? pickEncodedGameId(gameIdCandidates);
  } else {
    console.log("Step 2: using provided openId");
  }

  if (!openId) {
    throw new Error("Could not extract openId from search response.");
  }

  if (!gameId) {
    if (!recentUrl) {
      throw new Error(
        'Provide either --gameId="..." or --recentUrl="https://...{openId}...{areaId}...".'
      );
    }

    const url = replaceTemplate(recentUrl, { openId, areaId });
    console.log("Step 3: recent games:", url);
    const response = await sessionFetch(url);
    const json = await readJson(response);
    const outputPath = path.join(process.cwd(), "scripts", "full-flow-recent-response.json");

    await writeFile(outputPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    console.log("recent HTTP status:", response.status);
    console.log("saved recent response:", outputPath);

    const gameIdCandidates = findValuesByKey(json, /^(gameId|orderId)$/i);
    console.log("gameId candidates:", gameIdCandidates);
    gameId = pickEncodedGameId(gameIdCandidates);
  } else {
    console.log("Step 3: using provided gameId");
  }

  if (!gameId) {
    throw new Error("Could not extract encoded gameId from recent-games response.");
  }

  const { lzyumiSign, signStr, signSource } = createSignature();
  const detailUrl = new URL(detailEndpoint);

  detailUrl.searchParams.set("openId", openId);
  detailUrl.searchParams.set("gameId", gameId);
  detailUrl.searchParams.set("areaId", areaId);
  detailUrl.searchParams.set("lzyumiSign", lzyumiSign);
  detailUrl.searchParams.set("signStr", signStr);

  console.log("Step 4: match detail:", detailUrl.toString());
  console.log("sign source:", signSource);

  const detailResponse = await sessionFetch(detailUrl.toString());
  const detailJson = (await readJson(detailResponse)) as DetailResponse;
  const detailOutputPath = path.join(
    process.cwd(),
    "scripts",
    "full-flow-detail-response.json"
  );

  await writeFile(
    detailOutputPath,
    `${JSON.stringify(detailJson, null, 2)}\n`,
    "utf8"
  );

  const data = detailJson.data ?? null;
  const players = data?.wgBattleDetailInfo ?? [];
  const teams = data?.teamDetails ?? [];

  console.log("detail HTTP status:", detailResponse.status);
  console.log("detail code:", detailJson.code ?? null);
  console.log("detail message:", detailJson.message ?? detailJson.msg ?? null);
  console.log("detail data keys:", data ? Object.keys(data) : []);
  console.log("wgBattleDetailInfo exists:", Array.isArray(data?.wgBattleDetailInfo));
  console.log("wgBattleDetailInfo length:", players.length);
  console.log("teamDetails exists:", Array.isArray(data?.teamDetails));
  console.log("teamDetails length:", teams.length);
  console.log("saved detail response:", detailOutputPath);
}

main().catch((error: unknown) => {
  console.error("Full-flow test failed:", error);
  process.exitCode = 1;
});
