#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REPOSITORY = "deebeedee-ecl/ecl-split-one";
const DEFAULT_VERCEL_PROJECT = "ecl-split-one";
const DEFAULT_VERCEL_SCOPE = "deebeedee-ecls-projects";
const DEFAULT_LIMIT = 20;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const PASSING_CHECK_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);
const FAILED_DEPLOYMENT_STATES = new Set(["ERROR", "FAILED", "CRASHED", "CANCELED"]);

export function parseArguments(argv, env = process.env) {
  const options = {
    sha: "",
    repository: env.ECL_RELEASE_GITHUB_REPO || DEFAULT_REPOSITORY,
    vercelProject: env.ECL_RELEASE_VERCEL_PROJECT || DEFAULT_VERCEL_PROJECT,
    vercelScope: env.ECL_RELEASE_VERCEL_SCOPE || DEFAULT_VERCEL_SCOPE,
    vercelSha: "",
    railwayProject: env.ECL_RELEASE_RAILWAY_PROJECT || "",
    railwayEnvironment: env.ECL_RELEASE_RAILWAY_ENVIRONMENT || "",
    railwayService: env.ECL_RELEASE_RAILWAY_SERVICE || "",
    requireRailway: false,
    limit: DEFAULT_LIMIT,
    json: false,
    help: false,
  };

  const values = new Map([
    ["--sha", "sha"],
    ["--repo", "repository"],
    ["--vercel-project", "vercelProject"],
    ["--vercel-scope", "vercelScope"],
    ["--vercel-sha", "vercelSha"],
    ["--railway-project", "railwayProject"],
    ["--railway-environment", "railwayEnvironment"],
    ["--railway-service", "railwayService"],
    ["--limit", "limit"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--require-railway") {
      options.requireRailway = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    const key = values.get(argument);
    if (!key) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    options[key] = value;
    index += 1;
  }

  if (options.help) return options;
  options.sha = validateSha(options.sha, "--sha");
  options.vercelSha = validateSha(options.vercelSha || options.sha, "--vercel-sha");
  if (!/^[^/\s]+\/[^/\s]+$/.test(options.repository)) {
    throw new Error("--repo must use owner/name format.");
  }
  if (!options.vercelProject || !options.vercelScope) {
    throw new Error("Both --vercel-project and --vercel-scope are required.");
  }
  options.vercelProject = validateCliIdentifier(options.vercelProject, "--vercel-project");
  options.vercelScope = validateCliIdentifier(options.vercelScope, "--vercel-scope");

  const railwayValues = [
    options.railwayProject,
    options.railwayEnvironment,
    options.railwayService,
  ];
  const railwayScopeCount = railwayValues.filter(Boolean).length;
  if (railwayScopeCount !== 0 && railwayScopeCount !== railwayValues.length) {
    throw new Error("Railway checks require project, environment, and service together.");
  }
  if (railwayScopeCount === railwayValues.length) {
    options.railwayProject = validateCliIdentifier(options.railwayProject, "--railway-project");
    options.railwayEnvironment = validateCliIdentifier(options.railwayEnvironment, "--railway-environment");
    options.railwayService = validateCliIdentifier(options.railwayService, "--railway-service");
  }
  if (options.requireRailway && railwayScopeCount === 0) {
    throw new Error("--require-railway requires an explicit Railway scope.");
  }

  options.limit = positiveInteger(options.limit, "--limit", 100);
  return options;
}

function validateCliIdentifier(value, option) {
  const normalized = String(value || "").trim();
  if (!/^[a-zA-Z0-9._-]{1,160}$/.test(normalized)) {
    throw new Error(`${option} contains unsupported characters.`);
  }
  return normalized;
}

export function validateSha(value, option = "SHA") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(normalized)) {
    throw new Error(`${option} must be a 7-40 character hexadecimal Git SHA.`);
  }
  return normalized;
}

function positiveInteger(value, option, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`${option} must be an integer between 1 and ${maximum}.`);
  }
  return parsed;
}

export function shaMatches(expected, actual) {
  if (!expected || !actual) return false;
  const left = String(expected).toLowerCase();
  const right = String(actual).toLowerCase();
  return left === right || left.startsWith(right) || right.startsWith(left);
}

export function summarizeChecks(checkRuns = []) {
  const checks = checkRuns.map((check) => ({
    name: String(check.name || "unnamed").slice(0, 160),
    status: String(check.status || "unknown").toLowerCase(),
    conclusion: check.conclusion ? String(check.conclusion).toLowerCase() : null,
    detailsUrl: safePublicUrl(check.details_url),
  }));

  let status = "NOT_FOUND";
  if (checks.some((check) => check.status !== "completed")) status = "PENDING";
  if (checks.length && checks.every((check) => (
    check.status === "completed" && PASSING_CHECK_CONCLUSIONS.has(check.conclusion)
  ))) status = "SUCCESS";
  if (checks.some((check) => (
    check.status === "completed" && !PASSING_CHECK_CONCLUSIONS.has(check.conclusion)
  ))) status = "FAILED";

  return { status, checks };
}

function safePublicUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

function safeText(value, maximum = 240) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

export async function runCommand(command, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const useWindowsShimShell = process.platform === "win32"
      && ["vercel", "railway"].includes(command);
    let executableName = command;
    let executableArgs = args;
    if (useWindowsShimShell) {
      const tokens = [command, ...args];
      if (tokens.some((token) => !/^[a-zA-Z0-9._=-]+$/.test(token))) {
        reject(new Error(`${command} received an unsafe Windows command token.`));
        return;
      }
      executableName = process.env.ComSpec || "cmd.exe";
      executableArgs = ["/d", "/s", "/c", tokens.join(" ")];
    }
    const child = spawn(executableName, executableArgs, {
      cwd: process.cwd(),
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;

    const collect = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        reject(new Error(`${command} output exceeded the safe capture limit.`));
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };

    child.stdout.on("data", collect("stdout"));
    child.stderr.on("data", collect("stderr"));
    child.on("error", () => reject(new Error(`${command} is unavailable.`)));
    child.on("close", (code) => {
      if (code !== 0) {
        const classification = /not logged in|not signed in|unauthorized/i.test(stderr)
          ? "authentication required"
          : "command failed";
        reject(new Error(`${command}: ${classification} (exit ${code}).`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function collectGitHub(options, runner) {
  const endpoint = `repos/${options.repository}/commits/${options.sha}/check-runs?per_page=100`;
  const { stdout } = await runner("gh", ["api", endpoint]);
  const payload = parseJson(stdout, "GitHub CLI");
  return summarizeChecks(payload.check_runs || []);
}

async function gitTree(sha, runner) {
  const { stdout } = await runner("git", ["rev-parse", `${sha}^{tree}`]);
  const tree = stdout.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(tree)) throw new Error("Git returned an invalid tree SHA.");
  return tree;
}

async function collectVercel(options, runner) {
  const { stdout } = await runner("vercel", [
    "ls",
    options.vercelProject,
    "--environment",
    "production",
    "--json",
    "--limit",
    String(options.limit),
    "--scope",
    options.vercelScope,
  ]);
  const payload = parseJson(stdout, "Vercel CLI");
  const deployment = (payload.deployments || []).find((candidate) => (
    shaMatches(options.vercelSha, candidate?.meta?.githubCommitSha)
  ));
  if (!deployment) {
    return {
      status: "NOT_FOUND",
      deploymentId: null,
      sourceSha: options.vercelSha,
      releaseSha: options.sha,
      treeEquivalent: options.vercelSha === options.sha ? true : null,
    };
  }

  const deploymentHost = String(deployment.url || "").trim();
  if (!/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(deploymentHost)) {
    throw new Error("Vercel returned an invalid deployment hostname.");
  }

  const { stdout: inspectStdout } = await runner("vercel", [
    "inspect",
    deploymentHost,
    "--json",
    "--scope",
    options.vercelScope,
  ]);
  const inspection = parseJson(inspectStdout, "Vercel inspect");
  let treeEquivalent = true;
  if (!shaMatches(options.sha, options.vercelSha)) {
    const [releaseTree, sourceTree] = await Promise.all([
      gitTree(options.sha, runner),
      gitTree(options.vercelSha, runner),
    ]);
    treeEquivalent = releaseTree === sourceTree;
  }

  return {
    status: String(deployment.state || inspection.readyState || "UNKNOWN").toUpperCase(),
    deploymentId: safeText(inspection.id, 96) || null,
    url: safePublicUrl(`https://${deploymentHost}`),
    sourceSha: safeText(deployment?.meta?.githubCommitSha, 40) || options.vercelSha,
    releaseSha: options.sha,
    treeEquivalent,
    createdAt: Number.isFinite(deployment.createdAt)
      ? new Date(deployment.createdAt).toISOString()
      : null,
  };
}

async function collectRailway(options, runner) {
  if (!options.railwayProject) {
    return { status: "SKIPPED", reason: "scope-not-supplied", deploymentId: null };
  }

  const railwayEnv = {
    ...process.env,
    RAILWAY_CALLER: "ecl-release-status",
    RAILWAY_AGENT_SESSION: `ecl-release-status-${options.sha.slice(0, 12)}`,
  };
  const { stdout } = await runner("railway", [
    "deployment",
    "list",
    "--project",
    options.railwayProject,
    "--environment",
    options.railwayEnvironment,
    "--service",
    options.railwayService,
    "--limit",
    String(options.limit),
    "--json",
  ], { env: railwayEnv });
  const payload = parseJson(stdout, "Railway CLI");
  const deployments = Array.isArray(payload) ? payload : payload.deployments || [];
  const deployment = deployments.find((candidate) => (
    shaMatches(options.sha, candidate?.meta?.commitHash)
  ));
  if (!deployment) {
    return { status: "NOT_FOUND", deploymentId: null, commitSha: options.sha };
  }
  return {
    status: String(deployment.status || "UNKNOWN").toUpperCase(),
    deploymentId: safeText(deployment.id, 96) || null,
    commitSha: safeText(deployment?.meta?.commitHash, 40) || options.sha,
    createdAt: safeText(deployment.createdAt, 64) || null,
  };
}

export function deriveExitCode(report, { requireRailway = false } = {}) {
  if (report.github.status === "FAILED") return 1;
  if (FAILED_DEPLOYMENT_STATES.has(report.vercel.status)) return 1;
  if (report.vercel.treeEquivalent === false) return 1;
  if (FAILED_DEPLOYMENT_STATES.has(report.railway.status)) return 1;

  if (["PENDING", "NOT_FOUND"].includes(report.github.status)) return 2;
  if (report.vercel.status !== "READY") return 2;
  if (requireRailway && report.railway.status !== "SUCCESS") return 2;
  return 0;
}

export async function collectReleaseStatus(options, runner = runCommand) {
  const [github, vercel, railway] = await Promise.all([
    collectGitHub(options, runner),
    collectVercel(options, runner),
    collectRailway(options, runner),
  ]);
  const report = {
    schemaVersion: 1,
    releaseSha: options.sha,
    github,
    vercel,
    railway,
  };
  return {
    ...report,
    exitCode: deriveExitCode(report, options),
  };
}

export function renderText(report) {
  const lines = [
    "ECL release status",
    `Release SHA: ${report.releaseSha}`,
    `GitHub: ${report.github.status} (${report.github.checks.length} check(s))`,
  ];
  for (const check of report.github.checks) {
    lines.push(`  - ${check.name}: ${check.status}${check.conclusion ? `/${check.conclusion}` : ""}`);
  }
  lines.push(
    `Vercel: ${report.vercel.status}${report.vercel.deploymentId ? ` (${report.vercel.deploymentId})` : ""}`,
    `  source SHA: ${report.vercel.sourceSha}`,
  );
  if (!shaMatches(report.vercel.releaseSha, report.vercel.sourceSha)) {
    lines.push(`  tree equivalent to release: ${report.vercel.treeEquivalent ? "yes" : "no"}`);
  }
  lines.push(
    `Railway: ${report.railway.status}${report.railway.deploymentId ? ` (${report.railway.deploymentId})` : ""}`,
  );
  if (report.railway.status === "SKIPPED") {
    lines.push("  supply project, environment, and service scope to check Railway");
  }
  return `${lines.join("\n")}\n`;
}

function usage() {
  return `Usage:
  npm run release:status -- --sha <merge-sha> [options]

Options:
  --repo owner/name                 GitHub repository (default: ${DEFAULT_REPOSITORY})
  --vercel-project name            Vercel project (default: ${DEFAULT_VERCEL_PROJECT})
  --vercel-scope name              Vercel team scope (default: ${DEFAULT_VERCEL_SCOPE})
  --vercel-sha sha                 Alternate preview source SHA; Git trees must match
  --railway-project id             Explicit Railway project scope
  --railway-environment id         Explicit Railway environment scope
  --railway-service id             Explicit Railway service scope
  --require-railway                Exit incomplete unless the exact Railway deploy is SUCCESS
  --limit number                   Deployment history depth (default: ${DEFAULT_LIMIT})
  --json                           Print the sanitized machine-readable report

Railway can also be scoped with the dedicated ECL_RELEASE_RAILWAY_PROJECT,
ECL_RELEASE_RAILWAY_ENVIRONMENT, and ECL_RELEASE_RAILWAY_SERVICE variables.
The command is read-only and never prints creator/email fields or raw CLI payloads.
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const report = await collectReleaseStatus(options);
  process.stdout.write(options.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : renderText(report));
  process.exitCode = report.exitCode;
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error(`Release status failed: ${safeText(error?.message || "unknown error", 200)}`);
    process.exitCode = 1;
  });
}
