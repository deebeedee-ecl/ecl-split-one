import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const artifactPath = path.resolve(".tmp/ci/performance-tests.xml");
const testPath = "test/hub-route-baseline.test.mjs";
const result = spawnSync(process.execPath, [
  "--test",
  "--test-reporter=junit",
  testPath,
], {
  encoding: "utf8",
  env: process.env,
});

if (result.error) throw result.error;

const sanitized = sanitizeJUnit(result.stdout, process.cwd());
mkdirSync(path.dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, sanitized, "utf8");
process.stdout.write(sanitized);

if (result.stderr) process.stderr.write(sanitizeText(result.stderr, process.cwd()));
process.exitCode = result.status ?? 1;

function sanitizeJUnit(xml, workspace) {
  return sanitizeText(xml, workspace)
    .replace(/\s+time="[0-9.]+"/g, "")
    .replace(/\s*<!-- duration_ms [0-9.]+ -->\r?\n/g, "\n")
    .replace(/\s+file="[^"]*hub-route-baseline\.test\.mjs"/g, "");
}

function sanitizeText(value, workspace) {
  const normalizedWorkspace = workspace.replaceAll("\\", "/");
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll(workspace, "<workspace>")
    .replaceAll(normalizedWorkspace, "<workspace>")
    .replace(/perf-[a-f0-9-]{36}/gi, "perf-<request-id>")
    .replace(/127\.0\.0\.1:\d+/g, "127.0.0.1:<port>");
}
