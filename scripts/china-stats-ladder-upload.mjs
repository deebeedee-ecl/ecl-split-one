import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const inputArgument = process.argv.slice(2).find((argument) => argument.startsWith("--input="));
const inputValue = inputArgument?.slice("--input=".length) || ".tmp/china-stats-ladder-snapshot.json";
const repositoryRoot = process.cwd();
const privateDirectory = path.resolve(repositoryRoot, ".tmp");
const inputPath = path.resolve(repositoryRoot, inputValue);
const relativeInput = path.relative(privateDirectory, inputPath);

if (!relativeInput || relativeInput.startsWith("..") || path.isAbsolute(relativeInput) || !/\.json$/i.test(inputPath)) {
  throw new Error("The collector input must be a JSON file under the repository .tmp directory.");
}

const baseValue = (process.env.CHINA_STATS_COLLECTOR_BASE_URL || "").trim();
const secret = (process.env.CHINA_STATS_COLLECTOR_SECRET || "").trim();
if (secret.length < 32) throw new Error("CHINA_STATS_COLLECTOR_SECRET is missing or too short.");

let base;
try {
  base = new URL(baseValue);
} catch {
  throw new Error("CHINA_STATS_COLLECTOR_BASE_URL must be an absolute URL.");
}
const localTarget = (base.hostname === "localhost" || base.hostname === "127.0.0.1") && base.protocol === "http:";
if ((!localTarget && base.protocol !== "https:") || base.username || base.password || base.search || base.hash) {
  throw new Error("The collector target must be HTTPS, or HTTP loopback for local testing, without credentials or query parameters.");
}

const metadata = await stat(inputPath);
if (!metadata.isFile() || metadata.size < 2 || metadata.size > MAX_BODY_BYTES) {
  throw new Error("The sanitized collector snapshot has an invalid size.");
}
const body = await readFile(inputPath, "utf8");
if (/"(?:puuid|summonerId|openId|openid|credentialSource)"\s*:/i.test(body)
  || /remoting-auth-token/i.test(body)) {
  throw new Error("The collector snapshot contains a private identifier or credential marker and will not be uploaded.");
}
JSON.parse(body);

const endpoint = new URL("/api/jobs/china-stats-ladder", base);
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-ecl-china-stats-secret": secret,
  },
  body,
  redirect: "error",
});
const responseText = await response.text();
let result = {};
try {
  result = JSON.parse(responseText);
} catch {
  throw new Error(`Collector upload failed with HTTP ${response.status}.`);
}
if (!response.ok || result.ok !== true) {
  const code = typeof result.code === "string" ? result.code : "UPLOAD_FAILED";
  throw new Error(`Collector upload failed with HTTP ${response.status}: ${code}.`);
}
process.stdout.write(`Stored ${result.rows} ${result.server} rows captured at ${result.capturedAt} (${result.status}).\n`);
