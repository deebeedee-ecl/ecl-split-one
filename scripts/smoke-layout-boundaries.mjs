#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_SETTLE_MS = 2_500;

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

export const ROUTE_CASES = [
  {
    id: "public-hub",
    route: "/hub",
    expected: {
      bodyHeaderCount: 1,
      bodyFooterCount: 1,
      minimumPublicLoginLinks: 1,
      minimumPublicContactLinks: 1,
      hubSidebarLinks: 0,
    },
  },
  {
    id: "hub-dashboard",
    route: "/hub/dashboard",
    expected: {
      bodyHeaderCount: 0,
      bodyFooterCount: 0,
      publicLoginLinks: 0,
      publicContactLinks: 0,
      minimumHubSidebarLinks: 1,
    },
  },
];

export function parseArguments(argv) {
  const options = {
    baseUrl: "",
    label: "manual",
    output: "",
    screenshotDir: ".tmp/layout-smoke",
    browserChannel: "chromium",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    settleMs: DEFAULT_SETTLE_MS,
    screenshots: true,
    help: false,
  };
  const values = new Map([
    ["--base-url", "baseUrl"],
    ["--label", "label"],
    ["--output", "output"],
    ["--screenshot-dir", "screenshotDir"],
    ["--browser-channel", "browserChannel"],
    ["--timeout-ms", "timeoutMs"],
    ["--settle-ms", "settleMs"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-screenshots") {
      options.screenshots = false;
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
  options.baseUrl = validateBaseUrl(options.baseUrl);
  options.label = sanitizeLabel(options.label);
  options.timeoutMs = positiveInteger(options.timeoutMs, "--timeout-ms");
  options.settleMs = nonNegativeInteger(options.settleMs, "--settle-ms");
  if (options.output) options.output = assertTmpPath(options.output, "--output");
  if (options.screenshots) {
    options.screenshotDir = assertTmpPath(options.screenshotDir, "--screenshot-dir");
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

export function validateBaseUrl(value) {
  if (!value) throw new Error("--base-url is required.");
  const parsed = new URL(value);
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
  return String(value || "manual")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "manual";
}

export function assertTmpPath(value, option) {
  const resolved = path.resolve(value);
  const tmpRoot = path.resolve(".tmp");
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${option} must stay inside the ignored .tmp directory.`);
  }
  return resolved;
}

export function evaluateObservation(routeCase, observation) {
  const failures = [];
  const expected = routeCase.expected;
  const exactFields = [
    "bodyHeaderCount",
    "bodyFooterCount",
    "publicLoginLinks",
    "publicContactLinks",
    "hubSidebarLinks",
  ];

  if (observation.status !== 200) failures.push(`status expected 200, received ${observation.status}`);
  if (observation.pathname !== routeCase.route) {
    failures.push(`pathname expected ${routeCase.route}, received ${observation.pathname}`);
  }
  for (const field of exactFields) {
    if (field in expected && observation[field] !== expected[field]) {
      failures.push(`${field} expected ${expected[field]}, received ${observation[field]}`);
    }
  }
  if ("minimumPublicLoginLinks" in expected
    && observation.publicLoginLinks < expected.minimumPublicLoginLinks) {
    failures.push(`publicLoginLinks expected at least ${expected.minimumPublicLoginLinks}, received ${observation.publicLoginLinks}`);
  }
  if ("minimumPublicContactLinks" in expected
    && observation.publicContactLinks < expected.minimumPublicContactLinks) {
    failures.push(`publicContactLinks expected at least ${expected.minimumPublicContactLinks}, received ${observation.publicContactLinks}`);
  }
  if ("minimumHubSidebarLinks" in expected
    && observation.hubSidebarLinks < expected.minimumHubSidebarLinks) {
    failures.push(`hubSidebarLinks expected at least ${expected.minimumHubSidebarLinks}, received ${observation.hubSidebarLinks}`);
  }
  if (observation.horizontalOverflow) failures.push("document has horizontal overflow");
  return { pass: failures.length === 0, failures };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright is unavailable. Run npm ci first.");
  }
}

async function inspectPage(page, status) {
  return page.evaluate((responseStatus) => ({
    status: responseStatus,
    pathname: window.location.pathname,
    bodyHeaderCount: document.querySelectorAll("body > header").length,
    bodyFooterCount: document.querySelectorAll("body > footer").length,
    publicLoginLinks: document.querySelectorAll('header a[href="/login"]').length,
    publicContactLinks: document.querySelectorAll('footer a[href="/contact"]').length,
    hubSidebarLinks: document.querySelectorAll('aside a[href="/hub/dashboard"]').length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }), status);
}

export async function runSmoke(options) {
  const { chromium } = await loadPlaywright();
  const launchOptions = { headless: true };
  if (options.browserChannel !== "chromium") launchOptions.channel = options.browserChannel;
  const browser = await chromium.launch(launchOptions);
  const results = [];

  try {
    if (options.screenshots) await mkdir(options.screenshotDir, { recursive: true });
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(options.timeoutMs);

      for (const routeCase of ROUTE_CASES) {
        const target = new URL(routeCase.route, options.baseUrl);
        const response = await page.goto(target.href, {
          waitUntil: "domcontentloaded",
          timeout: options.timeoutMs,
        });
        await page.waitForTimeout(options.settleMs);
        const observation = await inspectPage(page, response?.status() ?? 0);
        const evaluation = evaluateObservation(routeCase, observation);
        let screenshot = null;
        if (options.screenshots) {
          screenshot = path.join(
            options.screenshotDir,
            `${options.label}-${viewportName}-${routeCase.id}.png`,
          );
          await page.screenshot({ path: screenshot, fullPage: false });
        }
        results.push({
          viewport: viewportName,
          route: routeCase.route,
          ...observation,
          ...evaluation,
          screenshot: screenshot ? path.relative(process.cwd(), screenshot) : null,
        });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  return {
    schemaVersion: 1,
    label: options.label,
    targetOrigin: options.baseUrl.origin,
    signedOut: true,
    passed: results.every((result) => result.pass),
    results,
  };
}

function usage() {
  return `Usage:
  npm run smoke:layouts -- --base-url http://localhost:3000 [options]

Options:
  --label value                       Artifact label (default: manual)
  --output .tmp/layout-smoke.json     Optional sanitized JSON report
  --screenshot-dir .tmp/layout-smoke  Screenshot directory
  --no-screenshots                    Do not capture screenshots
  --browser-channel msedge            Use an installed browser channel
  --timeout-ms 60000                  Navigation timeout
  --settle-ms 2500                    Wait after DOMContentLoaded

The smoke is signed-out and read-only. Output paths must stay under .tmp/.
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const report = await runSmoke(options);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, json, "utf8");
  }
  process.stdout.write(json);
  process.exitCode = report.passed ? 0 : 1;
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error(`Layout smoke failed: ${String(error?.message || "unknown error").slice(0, 200)}`);
    process.exitCode = 1;
  });
}
