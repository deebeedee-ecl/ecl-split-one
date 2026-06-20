import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const BASE = "https://a.2025lol.top/lzyumi/lol/info";
const OPEN_ID = "ZIw+mNLFwElvai3RS79B4gtLDPcKqTOR3mTW89J2kaQ=";
const AREA_ID = "1";
const AREA_NAME = encodeURIComponent("艾欧尼亚");
const NICKNAME = encodeURIComponent("deebeedee");

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
  console.log("URL:", url);
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    console.log("HTTP:", res.status, "size:", text.length);
    try {
      const json = JSON.parse(text);
      console.log("code:", json.code);
      if (Array.isArray(json.data) && json.data.length > 0) {
        console.log("data length:", json.data.length);
        console.log("data[0] keys:", Object.keys(json.data[0]));
        // Show titles of all games
        json.data.forEach((g, i) => {
          console.log(`  [${i}] championId=${g.championId} title="${g.title?.slice(0,30)}" battleTypeInfo=${g.battleTypeInfo} isWin=${g.isWin}`);
        });
        if (json.code === 1 || json.code === "1") {
          await writeFile(`scripts/filter-${label.replace(/[^a-z0-9]/gi,"_")}.json`, JSON.stringify(json, null, 2));
          console.log(`Saved to scripts/filter-${label.replace(/[^a-z0-9]/gi,"_")}.json`);
        }
      } else {
        console.log("data:", JSON.stringify(json.data)?.slice(0, 200));
      }
    } catch {
      console.log("raw:", text.slice(0, 300));
    }
  } catch (e) {
    console.log("fetch error:", e.message);
  }
}

const { lzyumiSign, signStr } = sign();
const oid = encodeURIComponent(OPEN_ID);

// Test different filter values on the main info endpoint
// filter=1 is what we currently use (all modes)
// Try filter=2,3,4,5 to find ranked-only
const candidates = [
  // filter=1 = all modes (baseline)
  ["filter1-allCount10", `${BASE}?nickname=${NICKNAME}&allCount=10&areaId=${AREA_ID}&areaName=${AREA_NAME}&seleMe=1&filter=1&openId=&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // filter=2 = ?
  ["filter2-allCount10", `${BASE}?nickname=${NICKNAME}&allCount=10&areaId=${AREA_ID}&areaName=${AREA_NAME}&seleMe=1&filter=2&openId=&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // filter=3 = ?
  ["filter3-allCount10", `${BASE}?nickname=${NICKNAME}&allCount=10&areaId=${AREA_ID}&areaName=${AREA_NAME}&seleMe=1&filter=3&openId=&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // filter=4 = ?
  ["filter4-allCount10", `${BASE}?nickname=${NICKNAME}&allCount=10&areaId=${AREA_ID}&areaName=${AREA_NAME}&seleMe=1&filter=4&openId=&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // filter=5 = ?
  ["filter5-allCount10", `${BASE}?nickname=${NICKNAME}&allCount=10&areaId=${AREA_ID}&areaName=${AREA_NAME}&seleMe=1&filter=5&openId=&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  // Try with openId instead of nickname
  ["filter2-openId", `${BASE}?openId=${oid}&allCount=10&areaId=${AREA_ID}&seleMe=1&filter=2&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
  ["filter3-openId", `${BASE}?openId=${oid}&allCount=10&areaId=${AREA_ID}&seleMe=1&filter=3&lzyumiSign=${lzyumiSign}&signStr=${signStr}`],
];

for (const [label, url] of candidates) {
  await probe(label, url);
  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 300));
}
