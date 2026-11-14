import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export type OpsPreflightTarget = "local" | "production-read-only";

export type OpsPreflightArguments = {
  target: OpsPreflightTarget;
  network: boolean;
};

type ToolProbe = {
  available: boolean;
  responsive: boolean;
};

function run(name: string, args: string[], timeout = 8_000) {
  let command = name;
  let commandArgs = args;
  let useShell = false;
  if (process.platform === "win32") {
    const located = spawnSync("where.exe", [name], { encoding: "utf8", windowsHide: true, timeout });
    const candidates = (located.stdout ?? "").split(/\r?\n/).filter(Boolean);
    const resolved = candidates.find(candidate => /\.(?:exe|cmd)$/i.test(candidate));
    if (!resolved) return { available: false, responsive: false, stdout: "" };
    if (/\.cmd$/i.test(resolved)) {
      if (args.some(argument => !/^[A-Za-z0-9=._/-]+$/.test(argument))) {
        return { available: true, responsive: false, stdout: "" };
      }
      command = `"${resolved}" ${args.join(" ")}`;
      commandArgs = [];
      useShell = true;
    } else command = resolved;
  }
  const options = {
    encoding: "utf8",
    windowsHide: true,
    timeout,
    env: { ...process.env, NO_COLOR: "1" },
  } as const;
  const result = useShell
    ? spawnSync(command, { ...options, shell: true })
    : spawnSync(command, commandArgs, options);
  return {
    available: result.error && "code" in result.error ? result.error.code !== "ENOENT" : true,
    responsive: result.status === 0,
    stdout: result.stdout ?? "",
  };
}

export function parseOpsPreflightArguments(args: string[]): OpsPreflightArguments {
  let target: OpsPreflightTarget = "local";
  let network = false;
  for (const argument of args) {
    if (argument === "--network") network = true;
    else if (argument === "--target=local") target = "local";
    else if (argument === "--target=production-read-only") target = "production-read-only";
    else throw new Error("Unknown ops preflight argument.");
  }
  return { target, network };
}

export function safeDatabaseConfiguration(value: string | undefined) {
  if (!value) return { configured: false, valid: false, protocol: null, schema: null };
  try {
    const url = new URL(value);
    const valid = ["postgres:", "postgresql:"].includes(url.protocol);
    return {
      configured: true,
      valid,
      protocol: valid ? url.protocol : null,
      schema: valid ? (url.searchParams.get("schema") ?? "default") : null,
    };
  } catch {
    return { configured: true, valid: false, protocol: null, schema: null };
  }
}

export function classifyDatabaseFailure(error: unknown) {
  const record = error && typeof error === "object"
    ? error as { message?: unknown; code?: unknown; errorCode?: unknown }
    : {};
  const message = typeof record.message === "string" ? record.message : "";
  const code = typeof record.code === "string"
    ? record.code
    : typeof record.errorCode === "string"
      ? record.errorCode
      : null;
  const category = /authentication failed|password authentication|credentials/i.test(message)
    ? "authentication"
    : /can't reach database server|connect timed out|connection refused|network/i.test(message)
      ? "unreachable"
      : /tls|ssl|certificate/i.test(message)
        ? "tls"
        : /does not exist/i.test(message)
          ? "missing-database"
          : "unknown";
  return { code, category };
}

function probeTool(name: string, localArgs: string[], networkArgs: string[], network: boolean): ToolProbe {
  const result = run(name, network ? networkArgs : localArgs);
  return { available: result.available, responsive: result.responsive };
}

async function probeDatabase() {
  const db = new PrismaClient({ log: [] });
  try {
    await db.$queryRaw`SELECT 1 AS ok`;
    return { attempted: true, status: "connected", category: null, code: null };
  } catch (error) {
    const failure = classifyDatabaseFailure(error);
    return { attempted: true, status: "failed", ...failure };
  } finally {
    await db.$disconnect();
  }
}

export async function runOpsPreflight({ target, network }: OpsPreflightArguments) {
  const branch = run("git", ["branch", "--show-current"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const status = run("git", ["status", "--porcelain"]);
  const databaseConfiguration = safeDatabaseConfiguration(process.env.DATABASE_URL);
  const database = network && databaseConfiguration.valid
    ? await probeDatabase()
    : { attempted: false, status: databaseConfiguration.valid ? "not-requested" : "not-configured", category: null, code: null };
  const tools = {
    github: probeTool("gh", ["--version"], ["auth", "status"], network),
    vercel: probeTool("vercel", ["--version"], ["whoami"], network),
    railway: probeTool("railway", ["--version"], ["whoami", "--json"], network),
  };
  const summary = {
    target,
    network,
    runtime: { node: process.version, platform: process.platform },
    git: {
      available: branch.available && head.available && status.available,
      branch: branch.responsive ? branch.stdout.trim() : null,
      head: head.responsive ? head.stdout.trim().slice(0, 12) : null,
      dirtyEntries: status.responsive ? status.stdout.split(/\r?\n/).filter(Boolean).length : null,
    },
    tools,
    databaseConfiguration,
    database,
    ready: databaseConfiguration.valid && (!network || database.status === "connected") && tools.github.responsive && tools.vercel.responsive,
  };
  return summary;
}
