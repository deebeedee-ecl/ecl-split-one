import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint =
  "https://a.2025lol.top/lzyumi/lol/info/findOrderDetailInfoAll";

const defaultTestValues = {
  openId: "ma1HBMBWqCtwrq5rsm5H0gWREsuEOL973mTW89J2kaQ=",
  gameId: "Me9Aar7qaTFFBF5lrPIfVw==",
  areaId: "1",
};

type LzyumiResponse = {
  code?: number | string;
  msg?: string;
  message?: string;
  data?: {
    gameType?: unknown;
    gameMode?: unknown;
    wgBattleDetailInfo?: Array<{
      nickname?: unknown;
      championId?: unknown;
      killNum?: unknown;
      deathNum?: unknown;
      assistNum?: unknown;
      kills?: unknown;
      deaths?: unknown;
      assists?: unknown;
      kda?: unknown;
    }>;
    teamDetails?: unknown[];
  };
};

type BattlePlayer = NonNullable<
  NonNullable<LzyumiResponse["data"]>["wgBattleDetailInfo"]
>[number];

type ArrayDiagnostic = {
  path: string;
  length: number;
  firstItemKeys: string[];
  matchingFields: string[];
};

const playerFieldHints = [
  "scoreInfo",
  "nickName",
  "nickNameStr",
  "detailChampionId",
  "teamId",
  "position",
  "wasMvp",
  "wasSvp",
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function createSignature(now = new Date()) {
  const MM = String(now.getMonth() + 1);
  const DD = pad2(now.getDate());
  const HH = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());

  const signSource = `dld${MM}o${DD}u${HH}d${mm}o${ss}`;
  const lzyumiSign = md5(signSource);
  const signStr = `${MM}${DD}${HH}${mm}${ss}${MM.length * 3}${
    DD.length * 3
  }${HH.length * 3}${mm.length * 3}${ss.length * 3}`;

  return {
    lzyumiSign,
    signStr,
    signSource,
  };
}

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg ? arg.slice(prefix.length) : undefined;
}

function getRequestValues() {
  const [, , positionalOpenId, positionalGameId, positionalAreaId] = process.argv;

  return {
    openId:
      getArgValue("openId") ??
      getArgValue("openid") ??
      positionalOpenId ??
      defaultTestValues.openId,
    gameId:
      getArgValue("gameId") ??
      getArgValue("gameid") ??
      positionalGameId ??
      defaultTestValues.gameId,
    areaId:
      getArgValue("areaId") ??
      getArgValue("areaid") ??
      positionalAreaId ??
      defaultTestValues.areaId,
  };
}

function getResponseMessage(payload: LzyumiResponse) {
  return payload.message ?? payload.msg ?? null;
}

function getPlayerKda(player: BattlePlayer) {
  if (player.kda != null) return player.kda;

  const kills = player.killNum ?? player.kills ?? "?";
  const deaths = player.deathNum ?? player.deaths ?? "?";
  const assists = player.assistNum ?? player.assists ?? "?";

  return `${kills}/${deaths}/${assists}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getKeys(value: unknown) {
  return isRecord(value) ? Object.keys(value) : [];
}

function findArrays(value: unknown, currentPath = "response"): ArrayDiagnostic[] {
  const diagnostics: ArrayDiagnostic[] = [];

  if (Array.isArray(value)) {
    const firstItem = value[0];
    const firstItemKeys = getKeys(firstItem);
    const matchingFields = firstItemKeys.filter((key) =>
      playerFieldHints.includes(key)
    );

    diagnostics.push({
      path: currentPath,
      length: value.length,
      firstItemKeys,
      matchingFields,
    });

    value.forEach((item, index) => {
      diagnostics.push(...findArrays(item, `${currentPath}[${index}]`));
    });

    return diagnostics;
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      diagnostics.push(...findArrays(child, `${currentPath}.${key}`));
    }
  }

  return diagnostics;
}

async function main() {
  const requestValues = getRequestValues();
  const generatedSignature = createSignature();
  const lzyumiSign =
    getArgValue("lzyumiSign") ?? getArgValue("sign") ?? generatedSignature.lzyumiSign;
  const signStr = getArgValue("signStr") ?? generatedSignature.signStr;
  const signSource = generatedSignature.signSource;
  const url = new URL(endpoint);

  url.searchParams.set("openId", requestValues.openId);
  url.searchParams.set("gameId", requestValues.gameId);
  url.searchParams.set("areaId", requestValues.areaId);
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);

  console.log("Final request URL:", url.toString());
  console.log(
    "Query params:",
    Object.fromEntries(url.searchParams.entries())
  );
  console.log("Sign source:", signSource);
  console.log("lzyumiSign:", lzyumiSign);
  console.log("signStr:", signStr);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://a.2025lol.top/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  });

  const text = await response.text();
  let payload: LzyumiResponse | null = null;

  try {
    payload = JSON.parse(text) as LzyumiResponse;
  } catch {
    console.log("HTTP status:", response.status);
    console.log("Response was not valid JSON.");
    console.log("Raw response:", text.slice(0, 1_000));
    process.exitCode = 1;
    return;
  }

  const debugPath = path.join(process.cwd(), "scripts", "lzyumi-debug-response.json");
  await writeFile(debugPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const data = payload.data;
  const players = data?.wgBattleDetailInfo ?? [];
  const teams = data?.teamDetails ?? [];
  const firstPlayer = players[0];

  console.log("HTTP status:", response.status);
  console.log("response code:", payload.code ?? null);
  console.log("response message:", getResponseMessage(payload));
  console.log("top-level keys:", Object.keys(payload));
  console.log("response.data keys:", data ? Object.keys(data) : []);
  console.log("gameType:", data?.gameType ?? null);
  console.log("gameMode:", data?.gameMode ?? null);
  console.log("players:", players.length);
  console.log("teams:", teams.length);
  console.log("first player nickname:", firstPlayer?.nickname ?? null);
  console.log("first player championId:", firstPlayer?.championId ?? null);
  console.log("first player KDA:", firstPlayer ? getPlayerKda(firstPlayer) : null);
  console.log("saved full response:", debugPath);

  const arrayDiagnostics = findArrays(payload);

  console.log("arrays found:", arrayDiagnostics.length);
  for (const item of arrayDiagnostics) {
    console.log("array path:", item.path);
    console.log("array length:", item.length);
    console.log("first item keys:", item.firstItemKeys);
    console.log("matching player hint fields:", item.matchingFields);
  }

  const success =
    response.status === 200 &&
    Number(payload.code) === 1 &&
    players.length === 10 &&
    teams.length === 2;

  console.log("POC success:", success);

  if (!success) {
    console.log("raw payload preview:", JSON.stringify(payload, null, 2)?.slice(0, 2_000));
    console.log("raw data preview:", JSON.stringify(data, null, 2)?.slice(0, 2_000));
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("Request failed:", error);
  process.exitCode = 1;
});
