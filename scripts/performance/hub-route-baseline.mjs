#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_WARM_RUNS = 3;
const DEFAULT_SETTLE_TIMEOUT_MS = 8_000;
const USER_AGENT = "ECL-Hub-Performance-Baseline/1.0";

export const HUB_ROUTES = [
  route("dashboard", "Dashboard", "/hub/dashboard", 1_000, 750),
  route("profile", "My Profile", "/hub/me", 3_000, 2_500),
  route("settings", "Account Settings", "/hub/settings", 3_000, 2_500),
  route("players", "Players", "/hub/players", 3_000, 2_500),
  route("leaderboard", "Ranked Ladder", "/hub/leaderboard", 7_000, 6_000),
  route("champions", "Champions", "/hub/champions", 5_000, 4_500),
  route("inhouses", "Inhouses", "/hub/inhouses", 6_500, 5_500),
];

function route(id, label, pathname, coldTtfbMs, warmP50TtfbMs) {
  return {
    id,
    label,
    path: pathname,
    requiresAuth: true,
    budget: {
      kind: "provisional-regression-ceiling",
      coldTtfbMs,
      warmP50TtfbMs,
      coldBrowserReadyMs: 8_000,
      warmP50BrowserReadyMs: 6_000,
    },
  };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: "",
    label: "manual",
    output: "",
    markdown: "",
    routes: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    settleTimeoutMs: DEFAULT_SETTLE_TIMEOUT_MS,
    warmRuns: DEFAULT_WARM_RUNS,
    requestDelayMs: 250,
    browser: false,
    browserChannel: "chromium",
    storageState: "",
    cookieEnv: "ECL_PERF_COOKIE",
    help: false,
  };

  const valueOptions = new Map([
    ["--base-url", "baseUrl"],
    ["--label", "label"],
    ["--output", "output"],
    ["--markdown", "markdown"],
    ["--routes", "routes"],
    ["--timeout-ms", "timeoutMs"],
    ["--settle-timeout-ms", "settleTimeoutMs"],
    ["--warm-runs", "warmRuns"],
    ["--request-delay-ms", "requestDelayMs"],
    ["--browser-channel", "browserChannel"],
    ["--storage-state", "storageState"],
    ["--cookie-env", "cookieEnv"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--browser") {
      options.browser = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    const key = valueOptions.get(argument);
    if (!key) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    index += 1;
    options[key] = value;
  }

  options.routes = typeof options.routes === "string"
    ? options.routes.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  options.timeoutMs = positiveInteger(options.timeoutMs, "--timeout-ms");
  options.settleTimeoutMs = positiveInteger(options.settleTimeoutMs, "--settle-timeout-ms");
  options.warmRuns = positiveInteger(options.warmRuns, "--warm-runs");
  options.requestDelayMs = nonNegativeInteger(options.requestDelayMs, "--request-delay-ms");
  if (!/^ECL_PERF_[A-Z0-9_]+$/.test(options.cookieEnv)) {
    throw new Error("--cookie-env must use a dedicated ECL_PERF_* variable name.");
  }

  return options;
}

function positiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative integer.`);
  }
  return parsed;
}

export function selectRoutes(routeIds, availableRoutes = HUB_ROUTES) {
  if (!routeIds.length) return availableRoutes;
  const requested = new Set(routeIds);
  const selected = availableRoutes.filter((candidate) => requested.has(candidate.id));
  const unknown = routeIds.filter((id) => !selected.some((candidate) => candidate.id === id));
  if (unknown.length) throw new Error(`Unknown route id(s): ${unknown.join(", ")}`);
  return selected;
}

export function validateBaseUrl(rawValue) {
  if (!rawValue) throw new Error("--base-url is required.");
  const parsed = new URL(rawValue);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("--base-url must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credentials must not be embedded in --base-url.");
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

export function sanitizeLabel(value) {
  const sanitized = String(value || "manual")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return sanitized || "manual";
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

export function percentile(values, percentileValue) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) return null;
  const index = Math.max(0, Math.ceil((percentileValue / 100) * finite.length) - 1);
  return round(finite[index]);
}

export function summarizeSamples(samples, fields) {
  const successful = samples.filter((sample) => !sample.error);
  const summary = {
    count: samples.length,
    successCount: successful.length,
    errorCount: samples.length - successful.length,
  };
  for (const field of fields) {
    const values = successful.map((sample) => sample[field]).filter(Number.isFinite);
    summary[field] = {
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      min: values.length ? round(Math.min(...values)) : null,
      max: values.length ? round(Math.max(...values)) : null,
    };
  }
  return summary;
}

export function sanitizeError(error) {
  const code = typeof error?.code === "string" && error.code
    ? error.code.replace(/[^A-Z0-9_-]/gi, "").slice(0, 64)
    : "BENCHMARK_ERROR";
  const name = typeof error?.name === "string" && error.name
    ? error.name.replace(/[^A-Z0-9_-]/gi, "").slice(0, 64)
    : "Error";
  return { name, code };
}

function safePath(url, expectedOrigin) {
  const parsed = url instanceof URL ? url : new URL(url);
  return parsed.origin === expectedOrigin ? parsed.pathname : "(cross-origin)";
}

function parseServerTiming(value) {
  if (!value) return [];
  return value.split(",").map((entry) => {
    const [rawName, ...parameters] = entry.trim().split(";");
    const durationParameter = parameters.find((parameter) => parameter.trim().startsWith("dur="));
    const duration = durationParameter ? Number(durationParameter.trim().slice(4)) : null;
    return {
      name: rawName.replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 64),
      durationMs: Number.isFinite(duration) ? round(duration) : null,
    };
  }).filter((entry) => entry.name);
}

function requestDocument(url, { agent, cookie, cold, timeoutMs }) {
  const transport = url.protocol === "https:" ? https : http;
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": USER_AGENT,
  };
  if (cookie) headers.Cookie = cookie;
  if (cold) {
    headers["Cache-Control"] = "no-cache";
    headers.Pragma = "no-cache";
    headers.Connection = "close";
  }

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const request = transport.request(url, { method: "GET", headers, agent }, (response) => {
      const ttfbMs = performance.now() - startedAt;
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += Buffer.byteLength(chunk);
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          location: response.headers.location ?? "",
          ttfbMs: round(ttfbMs),
          totalMs: round(performance.now() - startedAt),
          bytes,
          cacheStatus: String(response.headers["x-vercel-cache"] ?? response.headers["cf-cache-status"] ?? ""),
          cacheControl: String(response.headers["cache-control"] ?? "").slice(0, 160),
          serverTiming: parseServerTiming(String(response.headers["server-timing"] ?? "")),
        });
      });
    });

    request.setTimeout(timeoutMs, () => {
      const timeoutError = new Error("Benchmark request timed out.");
      timeoutError.code = "ETIMEDOUT";
      request.destroy(timeoutError);
    });
    request.on("error", reject);
    request.end();
  });
}

export async function measureHttpNavigation(url, options) {
  const expectedOrigin = url.origin;
  let currentUrl = new URL(url);
  let elapsedBeforeFinal = 0;
  let redirectCount = 0;

  while (redirectCount <= 5) {
    const response = await requestDocument(currentUrl, options);
    const isRedirect = response.status >= 300 && response.status < 400 && response.location;
    if (!isRedirect) {
      return {
        status: response.status,
        finalPath: safePath(currentUrl, expectedOrigin),
        expectedPathMatched: currentUrl.pathname === url.pathname,
        redirectCount,
        ttfbMs: round(elapsedBeforeFinal + response.ttfbMs),
        totalMs: round(elapsedBeforeFinal + response.totalMs),
        bytes: response.bytes,
        cacheStatus: response.cacheStatus,
        cacheControl: response.cacheControl,
        serverTiming: response.serverTiming,
      };
    }
    const nextUrl = new URL(response.location, currentUrl);
    if (nextUrl.origin !== expectedOrigin) {
      const redirectError = new Error("Cross-origin redirects are not followed.");
      redirectError.code = "CROSS_ORIGIN_REDIRECT";
      throw redirectError;
    }
    elapsedBeforeFinal += response.totalMs;
    redirectCount += 1;
    currentUrl = nextUrl;
  }

  const redirectError = new Error("Too many redirects.");
  redirectError.code = "TOO_MANY_REDIRECTS";
  throw redirectError;
}

async function captureHttpSample(url, options) {
  try {
    return await measureHttpNavigation(url, options);
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

async function runHttpRoute(baseUrl, routeConfig, options) {
  const routeUrl = new URL(routeConfig.path, baseUrl);
  const transport = routeUrl.protocol === "https:" ? https : http;
  const warmAgent = new transport.Agent({ keepAlive: true, maxSockets: 1 });
  const common = { cookie: options.cookie, timeoutMs: options.timeoutMs };

  const cold = await captureHttpSample(routeUrl, { ...common, agent: false, cold: true });
  await delay(options.requestDelayMs);

  // The warm-up is intentionally discarded. Recorded warm samples reuse its
  // connection/cache state instead of mixing connection setup into p50.
  await captureHttpSample(routeUrl, { ...common, agent: warmAgent, cold: false });
  await delay(options.requestDelayMs);

  const warm = [];
  for (let index = 0; index < options.warmRuns; index += 1) {
    warm.push(await captureHttpSample(routeUrl, { ...common, agent: warmAgent, cold: false }));
    if (index < options.warmRuns - 1) await delay(options.requestDelayMs);
  }
  warmAgent.destroy();

  return {
    cold,
    warm,
    warmSummary: summarizeSamples(warm, ["ttfbMs", "totalMs", "bytes"]),
  };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const dependencyError = new Error("Playwright is required for --browser mode. Run npm ci first.");
    dependencyError.code = "PLAYWRIGHT_NOT_INSTALLED";
    dependencyError.cause = error;
    throw dependencyError;
  }
}

async function measureBrowserNavigation(page, navigation, expectedUrl, options, eventCounts) {
  const before = { ...eventCounts };
  const startedAt = performance.now();
  try {
    const response = await navigation();
    let settled = true;
    try {
      await page.waitForLoadState("networkidle", { timeout: options.settleTimeoutMs });
    } catch {
      settled = false;
    }
    const readyMs = performance.now() - startedAt;
    const timing = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0];
      if (!entry) return null;
      return {
        ttfbMs: entry.responseStart,
        domContentLoadedMs: entry.domContentLoadedEventEnd,
        loadMs: entry.loadEventEnd,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      };
    });
    const currentUrl = new URL(page.url());
    return {
      status: response?.status() ?? 0,
      finalPath: safePath(currentUrl, expectedUrl.origin),
      expectedPathMatched: currentUrl.pathname === expectedUrl.pathname,
      ttfbMs: round(timing?.ttfbMs),
      domContentLoadedMs: round(timing?.domContentLoadedMs),
      loadMs: round(timing?.loadMs),
      browserReadyMs: round(readyMs),
      postLoadSettleMs: timing?.loadMs ? round(Math.max(0, readyMs - timing.loadMs)) : null,
      transferSize: timing?.transferSize ?? null,
      encodedBodySize: timing?.encodedBodySize ?? null,
      decodedBodySize: timing?.decodedBodySize ?? null,
      networkSettled: settled,
      failedRequestCount: eventCounts.failedRequestCount - before.failedRequestCount,
      consoleErrorCount: eventCounts.consoleErrorCount - before.consoleErrorCount,
      pageErrorCount: eventCounts.pageErrorCount - before.pageErrorCount,
    };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

async function runBrowserRoute(browser, baseUrl, routeConfig, options) {
  const contextOptions = {};
  if (options.storageState) contextOptions.storageState = options.storageState;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(options.timeoutMs);
  const eventCounts = { failedRequestCount: 0, consoleErrorCount: 0, pageErrorCount: 0 };
  page.on("requestfailed", () => { eventCounts.failedRequestCount += 1; });
  page.on("console", (message) => { if (message.type() === "error") eventCounts.consoleErrorCount += 1; });
  page.on("pageerror", () => { eventCounts.pageErrorCount += 1; });

  const routeUrl = new URL(routeConfig.path, baseUrl);
  const cold = await measureBrowserNavigation(
    page,
    () => page.goto(routeUrl.href, { waitUntil: "domcontentloaded", timeout: options.timeoutMs }),
    routeUrl,
    options,
    eventCounts,
  );
  await delay(options.requestDelayMs);

  const warm = [];
  for (let index = 0; index < options.warmRuns; index += 1) {
    warm.push(await measureBrowserNavigation(
      page,
      () => page.reload({ waitUntil: "domcontentloaded", timeout: options.timeoutMs }),
      routeUrl,
      options,
      eventCounts,
    ));
    if (index < options.warmRuns - 1) await delay(options.requestDelayMs);
  }

  await context.close();
  return {
    cold,
    warm,
    warmSummary: summarizeSamples(warm, [
      "ttfbMs",
      "domContentLoadedMs",
      "loadMs",
      "browserReadyMs",
      "postLoadSettleMs",
      "transferSize",
    ]),
  };
}

function evaluateBudget(routeResult) {
  const checks = [];
  const budget = routeResult.budget;
  const httpCold = routeResult.http?.cold?.ttfbMs;
  const httpWarm = routeResult.http?.warmSummary?.ttfbMs?.p50;
  const browserColdReady = routeResult.browser?.cold?.browserReadyMs;
  const browserWarmReady = routeResult.browser?.warmSummary?.browserReadyMs?.p50;

  addBudgetCheck(checks, "http-cold-ttfb", httpCold, budget.coldTtfbMs);
  addBudgetCheck(checks, "http-warm-p50-ttfb", httpWarm, budget.warmP50TtfbMs);
  addBudgetCheck(checks, "browser-cold-ready", browserColdReady, budget.coldBrowserReadyMs);
  addBudgetCheck(checks, "browser-warm-p50-ready", browserWarmReady, budget.warmP50BrowserReadyMs);

  const measured = checks.filter((check) => check.status !== "not-measured");
  return {
    status: !measured.length
      ? "not-measured"
      : measured.some((check) => check.status === "fail") ? "fail" : "pass",
    checks,
  };
}

function addBudgetCheck(checks, metric, measured, ceiling) {
  checks.push({
    metric,
    measuredMs: Number.isFinite(measured) ? measured : null,
    ceilingMs: ceiling,
    status: !Number.isFinite(measured) ? "not-measured" : measured <= ceiling ? "pass" : "fail",
  });
}

export async function runBenchmark(options, availableRoutes = HUB_ROUTES) {
  const baseUrl = validateBaseUrl(options.baseUrl);
  const selectedRoutes = selectRoutes(options.routes, availableRoutes);
  if (options.storageState) assertTmpPath(options.storageState, "--storage-state");
  const cookie = process.env[options.cookieEnv] || "";
  let browser = null;
  let browserLaunchError = null;

  if (options.browser) {
    try {
      const { chromium } = await loadPlaywright();
      const launchOptions = { headless: true };
      if (options.browserChannel !== "chromium") launchOptions.channel = options.browserChannel;
      browser = await chromium.launch(launchOptions);
    } catch (error) {
      browserLaunchError = sanitizeError(error);
    }
  }

  const routeResults = [];
  try {
    for (const routeConfig of selectedRoutes) {
      const reportRoute = {
        ...routeConfig,
        path: new URL(routeConfig.path, baseUrl).pathname,
      };
      const httpResult = await runHttpRoute(baseUrl, routeConfig, {
        cookie,
        timeoutMs: options.timeoutMs,
        warmRuns: options.warmRuns,
        requestDelayMs: options.requestDelayMs,
      });
      const browserResult = browser
        ? await runBrowserRoute(browser, baseUrl, routeConfig, options)
        : null;
      const result = { ...reportRoute, http: httpResult, browser: browserResult };
      result.budgetResult = evaluateBudget(result);
      routeResults.push(result);
    }
  } finally {
    if (browser) await browser.close();
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    label: sanitizeLabel(options.label),
    target: {
      origin: baseUrl.origin,
      authenticatedHttp: Boolean(cookie),
      authenticatedBrowser: Boolean(options.storageState),
    },
    method: {
      sequential: true,
      httpCold: "fresh connection with Cache-Control: no-cache",
      httpWarm: `discarded warm-up followed by ${options.warmRuns} keep-alive sample(s)`,
      browserEnabled: options.browser,
      browserCold: options.browser ? "fresh browser context and cache" : "not requested",
      browserWarm: options.browser ? `${options.warmRuns} reload sample(s) in the same context` : "not requested",
      browserReady: "time through Playwright network-idle; this includes hydration and client data waterfalls but is not a pure hydration measure",
      timeoutMs: options.timeoutMs,
      settleTimeoutMs: options.settleTimeoutMs,
      requestDelayMs: options.requestDelayMs,
    },
    browserLaunchError,
    routes: routeResults,
    summary: {
      routeCount: routeResults.length,
      passedBudgets: routeResults.filter((result) => result.budgetResult.status === "pass").length,
      failedBudgets: routeResults.filter((result) => result.budgetResult.status === "fail").length,
      unmeasuredBudgets: routeResults.filter((result) => result.budgetResult.status === "not-measured").length,
    },
  };
}

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : "n/a";
}

function formatBytes(value) {
  return Number.isFinite(value) ? `${Math.round(value / 1024)} KiB` : "n/a";
}

export function renderMarkdown(report) {
  const lines = [
    `# Hub performance baseline — ${report.label}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Target: \`${report.target.origin}\` (${report.target.authenticatedHttp || report.target.authenticatedBrowser ? "authenticated inputs supplied" : "signed out"})`,
    "",
    "## Method",
    "",
    `- HTTP cold: ${report.method.httpCold}.`,
    `- HTTP warm: ${report.method.httpWarm}.`,
    `- Browser: ${report.method.browserEnabled ? `${report.method.browserCold}; ${report.method.browserWarm}` : "not run"}.`,
    `- Browser ready metric: ${report.method.browserReady}.`,
    "- Requests run sequentially. Bodies, cookies, tokens, account IDs, query strings, and provider payloads are never written to the report.",
    "- Cold means a fresh client connection/cache state; it cannot guarantee a fresh serverless process.",
    "",
    "## Results",
    "",
    "| Route | HTTP cold TTFB | HTTP warm p50 / p95 | Cold bytes | Browser cold TTFB / ready | Browser warm p50 TTFB / ready | Provisional budget |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const routeResult of report.routes) {
    const httpWarm = routeResult.http?.warmSummary;
    const browserWarm = routeResult.browser?.warmSummary;
    lines.push(
      `| ${routeResult.label} (\`${routeResult.path}\`) | ${formatMs(routeResult.http?.cold?.ttfbMs)} | ${formatMs(httpWarm?.ttfbMs?.p50)} / ${formatMs(httpWarm?.ttfbMs?.p95)} | ${formatBytes(routeResult.http?.cold?.bytes)} | ${formatMs(routeResult.browser?.cold?.ttfbMs)} / ${formatMs(routeResult.browser?.cold?.browserReadyMs)} | ${formatMs(browserWarm?.ttfbMs?.p50)} / ${formatMs(browserWarm?.browserReadyMs?.p50)} | ${routeResult.budgetResult.status} |`,
    );
  }

  if (report.browserLaunchError) {
    lines.push("", `Browser mode did not start: \`${report.browserLaunchError.code}\`.`);
  }

  lines.push(
    "",
    "## Budget interpretation",
    "",
    "These ceilings are initial regression guardrails derived from the 2026-11-07 spot evidence, not final user-experience goals. A failed budget records the baseline honestly; it does not make the script fail. Tighten and enforce budgets only after representative authenticated preview/production measurements are reviewed.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function writeOutput(filePath, contents) {
  const resolved = assertTmpPath(filePath, "benchmark output");
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, contents, "utf8");
}

function assertTmpPath(filePath, label) {
  const resolved = path.resolve(filePath);
  const tmpRoot = path.resolve(".tmp");
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error(`${label} must stay inside the ignored .tmp directory.`);
    error.code = "UNSAFE_ARTIFACT_PATH";
    throw error;
  }
  return resolved;
}

function delay(milliseconds) {
  return milliseconds > 0
    ? new Promise((resolve) => setTimeout(resolve, milliseconds))
    : Promise.resolve();
}

function usage() {
  return `Usage:
  npm run perf:hub -- --base-url http://localhost:3000 [options]

Options:
  --routes dashboard,players   Limit the route set (default: all seven Hub routes)
  --warm-runs 3                Recorded warm samples after one discarded warm-up
  --timeout-ms 30000           Per-navigation timeout
  --request-delay-ms 250       Delay between HTTP samples
  --browser                    Also collect Playwright navigation timings
  --browser-channel msedge     Use an installed Chrome/Edge channel (default: bundled chromium)
  --storage-state .tmp/auth.json
                               Optional Playwright auth state; its path/content is never reported
  --cookie-env ECL_PERF_COOKIE Read an optional HTTP Cookie header from this environment variable
  --output .tmp/hub-perf.json  Write the sanitized JSON artifact
  --markdown .tmp/hub-perf.md  Write the sanitized Markdown summary
  --label preview-abc          Human-readable run label
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const report = await runBenchmark(options);
  const markdown = renderMarkdown(report);
  if (options.output) await writeOutput(options.output, `${JSON.stringify(report, null, 2)}\n`);
  if (options.markdown) await writeOutput(options.markdown, markdown);
  process.stdout.write(markdown);
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    const safe = sanitizeError(error);
    console.error(`Hub benchmark failed: ${safe.code}`);
    process.exitCode = 1;
  });
}
