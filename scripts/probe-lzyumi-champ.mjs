import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const BASE = "https://a.2025lol.top/lzyumi/lol/info";
const OPEN_ID = "ZIw+mNLFwElvai3RS79B4gtLDPcKqTOR3mTW89J2kaQ=";
const AREA_ID = "1";
const AREA_NAME = encodeURIComponent("艾欧尼亚");

function sign() {
  const now = new Date();
  const MM = String(now.getMonth() + 1);
  const DD = String(now.getDate());
  const HH = String(now.getHours());
  const mm = String(now.getMinutes());
  const ss = String(now.getSeconds());
  const src = `dld${MM.padStart(2,"0")}o${DD.padStart(2,"0")}u${HH.padStart(2,"0")}d${mm.padStart(2,"0")}o${ss.padStart(2,"0")}dld`;
  const lzyumiSign = createHash("md5").update(src).digest("hex");
  const signStr = `${MM}${DD}${HH}${mm}${ss}${MM.length*3}${DD.length*3}${HH.length*3}${mm.length*3}${ss.length*3}`;
  return { lzyumiSign, signStr };
}

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  Referer: "https://a.2025lol.top/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function probe(label, url) {
  console.log(`\n--- ${label} ---`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    console.log("HTTP:", res.status, "size:", text.length);
    try {
      const json = JSON.parse(text);
      console.log("code:", json.code);
      console.log("message:", json.message ?? json.msg);
      console.log("top keys:", Object.keys(json));
      if (json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
        console.log("data keys:", Object.keys(json.data));
      }
      if (Array.isArray(json.data) && json.data.length > 0) {
        console.log("data length:", json.data.length);
        console.log("data[0] keys:", Object.keys(json.data[0]));
      }
      if (json.code === 1 || json.code === "1") {
        const fname = `scripts/snapshot-${label.replace(/[^a-z0-9]/gi,"_")}.json`;
        await writeFile(fname, JSON.stringify(json, null, 2));
        console.log(`*** SUCCESS - saved to ${fname} ***`);
      }
    } catch {
      console.log("raw (first 400):", text.slice(0, 400));
    }
  } catch (e) {
    console.log("fetch error:", e.message);
  }
}

const { lzyumiSign, signStr } = sign();
const oid = encodeURIComponent(OPEN_ID);

const candidates = [
  // The big one from the network tab - findUserSnapshotInfo
  ["findUserSnapshotInfo", `${BASE}/findUserSnapshotInfo?openId=${oid}&areaId=${AREA_ID}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  ["findUserSnapshotInfo+areaName", `${BASE}/findUserSnapshotInfo?openId=${oid}&areaId=${AREA_ID}&areaName=${AREA_NAME}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // getPlayerRecentStat
  ["getPlayerRecentStat", `${BASE}/getPlayerRecentStat?openId=${oid}&areaId=${AREA_ID}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  ["getPlayerRecentStat+areaName", `${BASE}/getPlayerRecentStat?openId=${oid}&areaId=${AREA_ID}&areaName=${AREA_NAME}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // rankPointListInfo
  ["rankPointListInfo", `${BASE}/rankPointListInfo?openId=${oid}&areaId=${AREA_ID}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // GetUserLabel
  ["GetUserLabel", `${BASE}/GetUserLabel?openId=${oid}&areaId=${AREA_ID}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // getRankEloInfo
  ["getRankEloInfo", `${BASE}/getRankEloInfo?openId=${oid}&areaId=${AREA_ID}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
];

for (const [label, url] of candidates) {
  await probe(label, url);
}
