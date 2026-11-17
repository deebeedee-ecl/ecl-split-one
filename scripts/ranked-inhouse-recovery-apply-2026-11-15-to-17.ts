import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECOVERY_APPLY_ENDPOINT,
  RECOVERY_APPLY_OPERATION,
  type RecoveryApplyPlan,
} from "../lib/ranked-inhouse-recovery-apply-2026-11-15-to-17";

function option(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function requiredOption(name: string) {
  const value = option(name);
  if (!value) throw new Error(`Missing ${name}=...`);
  return value;
}

function privatePath(filePath: string) {
  const relative = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
  if (!/^report-engine\/inhouse-discovery-[^/]+\.json$/.test(relative)) {
    throw new Error("Recovery input/audit must use an ignored report-engine/inhouse-discovery-*.json path.");
  }
}

async function main() {
  const preflight = process.argv.includes("--preflight");
  const apply = process.argv.includes("--apply");
  if (preflight === apply) throw new Error("Choose exactly one action: --preflight or --apply.");
  if (!process.argv.includes("--target=production")) throw new Error("Recovery requests require --target=production.");
  if (apply && !process.argv.includes("--approved-production")) {
    throw new Error("Apply requires --approved-production after explicit owner authorization.");
  }
  const endpoint = requiredOption("--endpoint");
  if (endpoint !== RECOVERY_APPLY_ENDPOINT) throw new Error("Recovery endpoint does not match the exact dated production route.");
  const inputPath = path.resolve(requiredOption("--input"));
  const auditPath = path.resolve(requiredOption("--audit"));
  privatePath(inputPath);
  privatePath(auditPath);
  const fingerprint = option("--fingerprint");
  if (apply && !fingerprint) throw new Error("Apply requires the immediately preceding clean preflight fingerprint.");
  const secret = process.env.ECL_REPORT_ENGINE_SECRET || process.env.ECL_JOB_SECRET || process.env.ECL_KOOK_BOT_SECRET;
  if (!secret) throw new Error("A configured report-engine service secret is required.");
  const manifest = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "x-ecl-report-engine-secret": secret,
      "x-ecl-recovery-operation": RECOVERY_APPLY_OPERATION,
    },
    body: JSON.stringify({ action: apply ? "apply" : "preflight", fingerprint, manifest }),
  });
  const result = await response.json().catch(() => null) as { ok?: unknown; code?: unknown; plan?: RecoveryApplyPlan; result?: unknown } | null;
  const audit = {
    recordedAt: new Date().toISOString(), operationId: RECOVERY_APPLY_OPERATION,
    mode: apply ? "apply" : "preflight", endpoint, httpStatus: response.status, result,
  };
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ httpStatus: response.status, result }, null, 2));
  if (!response.ok || result?.ok !== true) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Recovery request failed.");
    process.exitCode = 1;
  });
}
