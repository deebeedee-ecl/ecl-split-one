import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  buildReviewManifest,
  databaseDryRun,
  offlineDryRun,
  RECOVERY_DATABASE_URL_ENV,
  RECOVERY_OPERATION,
  RECOVERY_PRODUCTION_ENDPOINT,
  SUPPORTED_ACTIONS,
  type RecoveryDryRun,
} from "../lib/ranked-inhouse-recovery-review-2026-11-15-to-17";

export * from "../lib/ranked-inhouse-recovery-review-2026-11-15-to-17";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function option(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function requiredOption(name: string) {
  const value = option(name);
  if (!value) throw new Error(`Missing ${name}=...`);
  return value;
}

export function resolveReadOnlyDatabaseTarget(
  argv: string[],
  environment: Partial<Record<string, string | undefined>>,
) {
  if (!argv.includes("--database")) return null;
  if (!argv.includes("--target=production-read-only")) {
    throw new Error("Database dry run requires --target=production-read-only.");
  }
  const raw = environment[RECOVERY_DATABASE_URL_ENV];
  if (!raw) throw new Error(`${RECOVERY_DATABASE_URL_ENV} is not configured in the operator process.`);
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new Error(`${RECOVERY_DATABASE_URL_ENV} is not a valid URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error(`${RECOVERY_DATABASE_URL_ENV} must use PostgreSQL.`);
  }
  if (["127.0.0.1", "localhost", "::1"].includes(target.hostname.toLowerCase())) {
    throw new Error(`${RECOVERY_DATABASE_URL_ENV} must name the intended non-local read-only target.`);
  }
  const schema = target.searchParams.get("schema");
  if (schema && schema !== "public") {
    throw new Error(`${RECOVERY_DATABASE_URL_ENV} must target the public schema.`);
  }
  target.searchParams.set("connection_limit", "1");
  return target.toString();
}

export function resolveBackendTarget(argv: string[]) {
  if (!argv.includes("--backend")) return null;
  if (!argv.includes("--target=production-backend-read-only")) {
    throw new Error("Backend dry run requires --target=production-backend-read-only.");
  }
  const supplied = argv.find((argument) => argument.startsWith("--endpoint="))?.slice("--endpoint=".length) ?? "";
  if (supplied !== RECOVERY_PRODUCTION_ENDPOINT) {
    throw new Error("Backend dry run requires the exact authorized production endpoint.");
  }
  return supplied;
}

async function backendDryRun(manifest: unknown, endpoint: string): Promise<RecoveryDryRun> {
  const secret = resolveBackendSecret(process.env);
  if (!secret) throw new Error("A configured report-engine service secret is required.");
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "x-ecl-report-engine-secret": secret,
      "x-ecl-recovery-operation": RECOVERY_OPERATION,
    },
    body: JSON.stringify({ manifest }),
  });
  const envelope = await response.json().catch(() => null) as {
    ok?: unknown;
    code?: unknown;
    result?: unknown;
  } | null;
  if (!response.ok || envelope?.ok !== true || !envelope.result) {
    const code = typeof envelope?.code === "string" ? envelope.code : `HTTP_${response.status}`;
    throw new Error(`Backend preflight failed with sanitized code ${code}.`);
  }
  const result = envelope.result as RecoveryDryRun;
  if (result.readOnly !== true || result.applyAvailable !== false || result.summary?.operationId !== RECOVERY_OPERATION) {
    throw new Error("Backend preflight returned an invalid bounded response.");
  }
  return result;
}

export function resolveBackendSecret(
  environment: Partial<Record<string, string | undefined>>,
) {
  return environment.ECL_REPORT_ENGINE_SECRET
    || environment.ECL_JOB_SECRET
    || environment.ECL_KOOK_BOT_SECRET
    || "";
}

function assertPrivateOperationalOutput(filePath: string) {
  const relative = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
  if (!/^report-engine\/inhouse-discovery-[^/]+\.json$/.test(relative)) {
    throw new Error("Private manifest/audit output must use the ignored report-engine/inhouse-discovery-*.json path.");
  }
}

async function writeExclusive(filePath: string, value: unknown) {
  assertPrivateOperationalOutput(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

async function main() {
  const action = process.argv.includes("--prepare")
    ? "prepare"
    : process.argv.includes("--dry-run") ? "dry-run" : "";
  if (!SUPPORTED_ACTIONS.includes(action as typeof SUPPORTED_ACTIONS[number])) {
    throw new Error("Choose exactly one read-only action: --prepare or --dry-run. This tool has no apply mode.");
  }
  const inputPath = path.resolve(requiredOption("--input"));
  const input = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  if (action === "prepare") {
    const outputPath = path.resolve(requiredOption("--output"));
    const manifest = buildReviewManifest(input);
    await writeExclusive(outputPath, manifest);
    console.log(JSON.stringify({
      readOnly: true,
      applyAvailable: false,
      action,
      operationId: manifest.operationId,
      gameCount: manifest.games.length,
      completeGames: manifest.games.filter((game) => game.evidenceStatus === "COMPLETE_10_OF_10").length,
      partialGames: manifest.games.filter((game) => game.evidenceStatus === "PARTIAL_DETAIL").length,
      manifestFingerprint: hash(manifest),
    }, null, 2));
    return;
  }
  const databaseUrl = resolveReadOnlyDatabaseTarget(process.argv, process.env);
  const backendEndpoint = resolveBackendTarget(process.argv);
  if (databaseUrl && backendEndpoint) throw new Error("Choose either direct read-only database mode or backend mode, not both.");
  const auditOption = option("--audit");
  if ((databaseUrl || backendEndpoint) && !auditOption) {
    throw new Error("Production read-only dry run requires --audit=report-engine/inhouse-discovery-*.json.");
  }
  let prisma: PrismaClient | null = null;
  try {
    if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
    prisma = databaseUrl ? new PrismaClient({ log: ["error"] }) : null;
    const result = backendEndpoint
      ? await backendDryRun(input, backendEndpoint)
      : prisma ? await databaseDryRun(input, prisma) : offlineDryRun(input);
    if (auditOption) await writeExclusive(path.resolve(auditOption), result);
    console.log(JSON.stringify(result, null, 2));
    if (!result.clean) process.exitCode = 2;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Recovery review failed.");
    process.exitCode = 1;
  });
}
