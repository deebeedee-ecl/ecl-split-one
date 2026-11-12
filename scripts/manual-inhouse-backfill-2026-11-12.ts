import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isAuthorizedManualInhouseExcludedIdentity,
  MANUAL_INHOUSE_IMPORT_OPERATION,
  MANUAL_INHOUSE_IMPORT_TARGET,
  parseManualInhouseImportManifest,
} from "../lib/manual-inhouse-import";
import { riotIdKey, splitRiotId } from "../lib/riot-id";

type DiscoveryCandidate = {
  gameId?: unknown;
  gameTime?: unknown;
  raw?: {
    game?: unknown;
    detail?: {
      data?: {
        wgBattleDetailInfo?: Array<{ nickNameStr?: unknown; nickName?: unknown }>;
      };
    };
  };
};

function option(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function requiredOption(name: string) {
  const value = option(name);
  if (!value) throw new Error(`Missing ${name}=...`);
  return value;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function authorizedExcludedRiotId(candidate: DiscoveryCandidate, index: number) {
  const players = candidate.raw?.detail?.data?.wgBattleDetailInfo;
  if (!Array.isArray(players)) throw new Error(`Candidate ${index + 1} has no complete detail roster.`);
  const matches = players.flatMap((player) => {
    const riotId = typeof player.nickNameStr === "string"
      ? player.nickNameStr
      : typeof player.nickName === "string" ? player.nickName : "";
    const parts = splitRiotId(riotId);
    const key = riotIdKey(parts.riotName, parts.riotTag);
    return key && isAuthorizedManualInhouseExcludedIdentity(key) ? [riotId] : [];
  });
  if (matches.length !== 1) throw new Error(`Candidate ${index + 1} does not contain exactly one authorized exclusion.`);
  return matches[0];
}

async function prepare() {
  const inputPath = path.resolve(requiredOption("--input"));
  const outputPath = path.resolve(requiredOption("--output"));
  const discovery = object(JSON.parse(await readFile(inputPath, "utf8")), "discovery");
  if (discovery.readOnly !== true || !Array.isArray(discovery.candidates)) {
    throw new Error("Input must be a read-only discovery artifact.");
  }
  const candidates = discovery.candidates as DiscoveryCandidate[];
  const manifest = parseManualInhouseImportManifest({
    operationId: MANUAL_INHOUSE_IMPORT_OPERATION,
    target: MANUAL_INHOUSE_IMPORT_TARGET,
    notify: false,
    games: candidates.map((candidate, index) => ({
      providerGameId: candidate.gameId,
      playedAt: candidate.gameTime,
      game: candidate.raw?.game,
      detail: candidate.raw?.detail,
      excludedRiotIds: [authorizedExcludedRiotId(candidate, index)],
    })),
  });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({
    mode: "prepare",
    output: outputPath,
    operationId: manifest.operationId,
    gameCount: manifest.games.length,
    excludedSlots: manifest.games.reduce((sum, game) => sum + game.excludedRiotIds.length, 0),
    notify: manifest.notify,
  }, null, 2));
}

async function requestImport() {
  const inputPath = path.resolve(requiredOption("--input"));
  const auditPath = path.resolve(requiredOption("--audit"));
  const endpoint = new URL(requiredOption("--endpoint"));
  if (endpoint.href !== "https://eclchina.lol/api/admin/inhouse/backfill-2026-11-12") {
    throw new Error("The import endpoint must be the exact authorized production URL.");
  }
  const manifest = parseManualInhouseImportManifest(JSON.parse(await readFile(inputPath, "utf8")));
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--approved-production")) {
    throw new Error("Apply requires --approved-production after explicit operator authorization.");
  }
  const fingerprint = option("--fingerprint");
  if (apply && !fingerprint) throw new Error("Apply requires --fingerprint=<immediately-preceding-preflight-fingerprint>.");
  const secret = process.env.ECL_REPORT_ENGINE_SECRET || process.env.ECL_JOB_SECRET || process.env.ECL_KOOK_BOT_SECRET;
  if (!secret) throw new Error("Configure one approved ECL worker secret without printing it.");
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "x-ecl-report-engine-secret": secret,
      "x-ecl-manual-operation": MANUAL_INHOUSE_IMPORT_OPERATION,
    },
    body: JSON.stringify({ action: apply ? "apply" : "preflight", fingerprint, manifest }),
  });
  const result = await response.json() as unknown;
  await writeFile(auditPath, `${JSON.stringify({
    recordedAt: new Date().toISOString(),
    operationId: MANUAL_INHOUSE_IMPORT_OPERATION,
    mode: apply ? "apply" : "preflight",
    endpoint: endpoint.href,
    httpStatus: response.status,
    result,
  }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ httpStatus: response.status, result }, null, 2));
  if (!response.ok) process.exitCode = 1;
}

async function main() {
  if (process.argv.includes("--prepare")) {
    await prepare();
  } else {
    await requestImport();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Manual inhouse operation failed.");
  process.exitCode = 1;
});
