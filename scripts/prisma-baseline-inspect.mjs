import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BASELINE_DATABASE_URL_ENV = "ECL_PRISMA_BASELINE_DATABASE_URL";
export const DEFAULT_BASELINE_OUTPUT_DIR = ".tmp/prisma-baseline";

function readOption(argv, name) {
  const prefix = `${name}=`;
  const matches = argv.filter((argument) => argument.startsWith(prefix));
  if (matches.length > 1) throw new Error(`${name} may be supplied only once.`);
  return matches[0]?.slice(prefix.length) ?? null;
}

function assertKnownArguments(argv) {
  const known = new Set([
    "--execute-read-only",
    "--target=production-read-only",
  ]);

  for (const argument of argv) {
    if (known.has(argument) || argument.startsWith("--output-dir=")) continue;
    throw new Error(
      "Unknown argument. Use only --target, --output-dir, and --execute-read-only.",
    );
  }
}

function resolveOutputDir(cwd, requested) {
  const allowedRoot = path.resolve(cwd, DEFAULT_BASELINE_OUTPUT_DIR);
  const resolved = path.resolve(cwd, requested || DEFAULT_BASELINE_OUTPUT_DIR);
  const relative = path.relative(allowedRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Baseline artifacts must stay under ${DEFAULT_BASELINE_OUTPUT_DIR}.`,
    );
  }

  return resolved;
}

export function parsePrismaBaselineInspectArgs(argv, cwd = process.cwd()) {
  assertKnownArguments(argv);

  if (!argv.includes("--target=production-read-only")) {
    throw new Error("Use --target=production-read-only to name the intended environment.");
  }

  return {
    executeReadOnly: argv.includes("--execute-read-only"),
    outputDir: resolveOutputDir(cwd, readOption(argv, "--output-dir")),
  };
}

export function validateBaselineDatabaseUrl(value) {
  if (!value) {
    throw new Error(`${BASELINE_DATABASE_URL_ENV} is not configured.`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${BASELINE_DATABASE_URL_ENV} is not a valid URL.`);
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error(`${BASELINE_DATABASE_URL_ENV} must use PostgreSQL.`);
  }

  const schema = parsed.searchParams.get("schema");
  if (schema && schema !== "public") {
    throw new Error("Baseline inspection is restricted to the public schema.");
  }

  return value;
}

function findPrismaCli(cwd) {
  const candidates = [
    path.join(cwd, "node_modules", "prisma", "build", "index.js"),
    path.join(cwd, "..", "..", "node_modules", "prisma", "build", "index.js"),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error("The repository-pinned Prisma CLI is not installed.");
  return match;
}

function runDiff({ cwd, databaseUrl, outputPath, script }) {
  const args = [
    findPrismaCli(cwd),
    "migrate",
    "diff",
    "--from-schema-datasource",
    "prisma/schema.prisma",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--exit-code",
    "--output",
    outputPath,
  ];
  if (script) args.push("--script");

  const result = spawnSync(process.execPath, args, {
    cwd,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (result.error) {
    throw new Error("Prisma drift inspection could not be started.");
  }
  if (result.status !== 0 && result.status !== 2) {
    throw new Error(
      `Prisma drift inspection failed with exit code ${result.status ?? "unknown"}.`,
    );
  }

  return result.status === 2;
}

export function baselineInspectPlan(
  { outputDir, executeReadOnly },
  cwd = process.cwd(),
) {
  return {
    schemaVersion: 1,
    target: "production-read-only",
    mode: executeReadOnly ? "execute-read-only" : "plan",
    databaseUrlEnv: BASELINE_DATABASE_URL_ENV,
    outputDir: path.relative(cwd, outputDir),
    writesDatabase: false,
    printsDatabaseUrl: false,
  };
}

export function runPrismaBaselineInspection({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const options = parsePrismaBaselineInspectArgs(argv, cwd);
  const plan = baselineInspectPlan(options, cwd);

  if (!options.executeReadOnly) {
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }

  const databaseUrl = validateBaselineDatabaseUrl(
    env[BASELINE_DATABASE_URL_ENV],
  );
  mkdirSync(options.outputDir, { recursive: true });

  const summaryPath = path.join(options.outputDir, "live-to-prisma.txt");
  const scriptPath = path.join(options.outputDir, "live-to-prisma.sql");
  const summaryDrift = runDiff({
    cwd,
    databaseUrl,
    outputPath: summaryPath,
    script: false,
  });
  const scriptDrift = runDiff({
    cwd,
    databaseUrl,
    outputPath: scriptPath,
    script: true,
  });

  if (summaryDrift !== scriptDrift) {
    throw new Error("Prisma drift outputs disagreed; do not continue baselining.");
  }

  const manifest = {
    ...plan,
    inspectedAt: new Date().toISOString(),
    driftDetected: summaryDrift,
    artifacts: {
      summary: path.relative(cwd, summaryPath),
      script: path.relative(cwd, scriptPath),
    },
  };
  const manifestPath = path.join(options.outputDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({
    target: manifest.target,
    driftDetected: manifest.driftDetected,
    outputDir: path.relative(cwd, options.outputDir),
    manifest: path.relative(cwd, manifestPath),
  }));

  return manifest;
}

const isMain = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    runPrismaBaselineInspection();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Baseline inspection failed.");
    process.exitCode = 1;
  }
}
