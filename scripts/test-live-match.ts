import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint =
  "https://a.2025lol.top/lzyumi/lol/info/findOrderDetailInfoAll";

type PlayerDetail = {
  nickname?: unknown;
  nickName?: unknown;
  nickNameStr?: unknown;
  championId?: unknown;
  detailChampionId?: unknown;
};

type LiveMatchResponse = {
  code?: number | string;
  message?: string;
  msg?: string;
  data?: {
    wgBattleDetailInfo?: PlayerDetail[];
    teamDetails?: unknown[];
    [key: string]: unknown;
  } | null;
};

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

  return { lzyumiSign, signStr };
}

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg ? arg.slice(prefix.length) : undefined;
}

function getInputs() {
  const [, , positionalOpenId, positionalGameId, positionalAreaId] = process.argv;

  const openId =
    getArgValue("openId") ?? getArgValue("openid") ?? positionalOpenId;
  const gameId =
    getArgValue("gameId") ?? getArgValue("gameid") ?? positionalGameId;
  const areaId =
    getArgValue("areaId") ?? getArgValue("areaid") ?? positionalAreaId;

  if (!openId || !gameId || !areaId) {
    throw new Error(
      'Usage: npx.cmd tsx scripts/test-live-match.ts --openId="..." --gameId="..." --areaId="1"'
    );
  }

  return { openId, gameId, areaId };
}

function getResponseMessage(payload: LiveMatchResponse) {
  return payload.message ?? payload.msg ?? null;
}

function getPlayerNickname(player: PlayerDetail | undefined) {
  return player?.nickname ?? player?.nickName ?? player?.nickNameStr ?? null;
}

async function main() {
  const inputs = getInputs();
  const { lzyumiSign, signStr } = createSignature();
  const url = new URL(endpoint);

  url.searchParams.set("openId", inputs.openId);
  url.searchParams.set("gameId", inputs.gameId);
  url.searchParams.set("areaId", inputs.areaId);
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);

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
  let payload: LiveMatchResponse;

  try {
    payload = JSON.parse(text) as LiveMatchResponse;
  } catch {
    console.log("HTTP status:", response.status);
    console.log("Response was not valid JSON.");
    console.log("Raw response:", text.slice(0, 1_000));
    process.exitCode = 1;
    return;
  }

  const outputPath = path.join(
    process.cwd(),
    "scripts",
    "live-match-response.json"
  );
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const data = payload.data ?? null;
  const players = data?.wgBattleDetailInfo ?? [];
  const teams = data?.teamDetails ?? [];
  const firstPlayer = players[0];

  console.log("HTTP status:", response.status);
  console.log("response.code:", payload.code ?? null);
  console.log("response.message:", getResponseMessage(payload));
  console.log("response.data keys:", data ? Object.keys(data) : []);
  console.log("wgBattleDetailInfo length:", players.length);
  console.log("teamDetails length:", teams.length);
  console.log("first player nickname:", getPlayerNickname(firstPlayer));
  console.log("all player nicknames:", players.map(getPlayerNickname));
  console.log("saved full response:", outputPath);
}

main().catch((error: unknown) => {
  console.error("Request failed:", error);
  process.exitCode = 1;
});
