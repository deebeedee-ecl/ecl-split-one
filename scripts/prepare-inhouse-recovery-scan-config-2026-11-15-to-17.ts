import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeRiotPart, normalizeRiotTag, riotIdKey, splitRiotId } from "../lib/riot-id";

type Candidate = {
  gameId?: unknown;
  raw?: {
    detail?: {
      data?: {
        wgBattleDetailInfo?: Array<Record<string, unknown>>;
      };
    };
  };
};

function requiredOption(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
  if (!value) throw new Error(`Missing ${name}=...`);
  return value;
}

function assertPrivatePath(filePath: string) {
  const relative = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
  if (!/^report-engine\/inhouse-discovery-[^/]+\.json$/.test(relative)) {
    throw new Error("Recovery scan config must use an ignored report-engine/inhouse-discovery-*.json path.");
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function main() {
  const inputPath = path.resolve(requiredOption("--input"));
  const outputPath = path.resolve(requiredOption("--output"));
  assertPrivatePath(inputPath);
  assertPrivatePath(outputPath);
  const discovery = JSON.parse(await readFile(inputPath, "utf8")) as { readOnly?: unknown; candidates?: Candidate[] };
  if (discovery.readOnly !== true || !Array.isArray(discovery.candidates)) {
    throw new Error("Input must be a read-only inhouse discovery artifact.");
  }
  const players = new Map<string, Record<string, unknown>>();
  const gameIds = new Set<string>();
  for (const candidate of discovery.candidates) {
    const gameId = clean(candidate.gameId);
    if (gameId) gameIds.add(gameId);
    const rows = candidate.raw?.detail?.data?.wgBattleDetailInfo;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const parts = splitRiotId(clean(row.nickNameStr) || clean(row.nickName));
      const riotName = normalizeRiotPart(parts.riotName);
      const riotTag = normalizeRiotTag(parts.riotTag);
      const key = riotIdKey(riotName, riotTag);
      const openId = clean(row.openIdNow);
      const chinaServerId = Number(row.translateAreaId);
      if (!key || !openId || chinaServerId !== 1) continue;
      const existing = players.get(key);
      if (existing && existing.openId !== openId) {
        throw new Error("An observed full Riot ID has conflicting provider openIds.");
      }
      players.set(key, {
        displayName: `${riotName}#${riotTag}`,
        riotName,
        riotTag,
        openId,
        chinaServerId,
      });
    }
  }
  if (gameIds.size !== 12) throw new Error("The recovery scan must stay bound to exactly 12 provider games.");
  if (players.size < 10) throw new Error("Too few verified observed players for a recovery scan.");
  const output = {
    players: [...players.values()],
    since: "2026-11-15",
    until: "2026-11-17",
    allCount: 100,
    historyPrefilter: true,
    knownGameIds: [...gameIds].sort(),
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({
    readOnly: true,
    playerCount: players.size,
    gameCount: gameIds.size,
    playerSetHash: hash([...players.keys()].sort()),
    gameSetHash: hash([...gameIds].sort()),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Recovery scan preparation failed.");
  process.exitCode = 1;
});
