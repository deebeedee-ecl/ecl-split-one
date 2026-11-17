import { createHash, timingSafeEqual } from "node:crypto";
import {
  offlineDryRun,
  RECOVERY_OPERATION,
  type RecoveryDryRun,
} from "@/lib/ranked-inhouse-recovery-review-2026-11-15-to-17";

const MAX_REQUEST_BYTES = 3_000_000;

type RecoveryPreflightDependencies = {
  expectedSecrets: Array<string | null | undefined>;
  runDatabasePreflight: (manifest: unknown) => Promise<RecoveryDryRun>;
  validateManifest?: (manifest: unknown) => unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function secureEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function configuredSecrets(values: RecoveryPreflightDependencies["expectedSecrets"]) {
  return values.map(clean).filter(Boolean);
}

export function buildRecoveryReadOnlyDatabaseUrl(value: string | null | undefined) {
  const raw = clean(value);
  if (!raw) throw new Error("Recovery database configuration is unavailable.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Recovery database configuration is invalid.");
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error("Recovery database must use PostgreSQL.");
  }
  const schema = url.searchParams.get("schema");
  if (schema && schema !== "public") throw new Error("Recovery database must target the public schema.");
  const currentOptions = clean(url.searchParams.get("options"));
  const requiredOptions = "-c default_transaction_read_only=on -c statement_timeout=30000";
  url.searchParams.set("options", [currentOptions, requiredOptions].filter(Boolean).join(" "));
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("application_name", "ecl-ranked-inhouse-recovery-readonly");
  return url.toString();
}

export async function recoveryPreflightResponse(
  request: Request,
  dependencies: RecoveryPreflightDependencies,
) {
  const secrets = configuredSecrets(dependencies.expectedSecrets);
  if (secrets.length === 0) {
    return json({ ok: false, code: "RECOVERY_AUTH_NOT_CONFIGURED" }, 503);
  }
  const suppliedSecret = clean(request.headers.get("x-ecl-report-engine-secret"));
  if (!suppliedSecret || !secrets.some((secret) => secureEqual(secret, suppliedSecret))) {
    return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  }
  if (request.headers.get("x-ecl-recovery-operation") !== RECOVERY_OPERATION) {
    return json({ ok: false, code: "RECOVERY_SCOPE_MISMATCH" }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, code: "EXPECTED_JSON" }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json({ ok: false, code: "REQUEST_TOO_LARGE" }, 413);
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) {
    return json({ ok: false, code: "REQUEST_TOO_LARGE" }, 413);
  }
  let manifest: unknown;
  try {
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body) || !("manifest" in body)) {
      throw new Error("invalid envelope");
    }
    manifest = (body as { manifest: unknown }).manifest;
    (dependencies.validateManifest ?? offlineDryRun)(manifest);
  } catch {
    return json({ ok: false, code: "INVALID_RECOVERY_MANIFEST" }, 400);
  }
  try {
    const result = await dependencies.runDatabasePreflight(manifest);
    return json({ ok: true, operationId: RECOVERY_OPERATION, result });
  } catch {
    return json({ ok: false, code: "RECOVERY_PREFLIGHT_UNAVAILABLE" }, 503);
  }
}
