import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  measureHttpNavigation,
  parseArguments,
  renderMarkdown,
  runBenchmark,
  sanitizeLabel,
  summarizeSamples,
  validateBaseUrl,
} from "../scripts/performance/hub-route-baseline.mjs";

test("parses explicit benchmark options and rejects credentials in the target URL", () => {
  const options = parseArguments([
    "--base-url", "https://example.com",
    "--routes", "dashboard,players",
    "--warm-runs", "5",
    "--browser",
    "--browser-channel", "msedge",
  ]);

  assert.deepEqual(options.routes, ["dashboard", "players"]);
  assert.equal(options.warmRuns, 5);
  assert.equal(options.browser, true);
  assert.equal(options.browserChannel, "msedge");
  const credentialUrl = new URL("https://example.invalid");
  credentialUrl.username = "fixture-user";
  credentialUrl.password = "fixture-secret";
  assert.throws(() => validateBaseUrl(credentialUrl.href), /Credentials must not be embedded/);
  assert.equal(sanitizeLabel("preview account 123"), "preview-account-123");
  assert.throws(
    () => parseArguments(["--base-url", "https://example.com", "--cookie-env", "DATABASE_URL"]),
    /dedicated ECL_PERF_/,
  );
});

test("summarizes successful samples without letting errors skew percentiles", () => {
  const summary = summarizeSamples([
    { ttfbMs: 10 },
    { error: { code: "ETIMEDOUT" } },
    { ttfbMs: 30 },
    { ttfbMs: 20 },
  ], ["ttfbMs"]);

  assert.equal(summary.count, 4);
  assert.equal(summary.successCount, 3);
  assert.equal(summary.errorCount, 1);
  assert.deepEqual(summary.ttfbMs, { p50: 20, p95: 30, min: 10, max: 30 });
});

test("follows only same-origin redirects and stores no query string", async () => {
  const server = http.createServer((request, response) => {
    if (request.url === "/start") {
      response.writeHead(302, { Location: "/final?private=value" });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("hello");
  });

  const baseUrl = await listen(server);
  try {
    const sample = await measureHttpNavigation(new URL("/start", baseUrl), {
      agent: false,
      cookie: "",
      cold: true,
      timeoutMs: 2_000,
    });

    assert.equal(sample.status, 200);
    assert.equal(sample.finalPath, "/final");
    assert.equal(sample.redirectCount, 1);
    assert.equal(JSON.stringify(sample).includes("private=value"), false);
  } finally {
    await close(server);
  }
});

test("produces a sanitized cold/warm report while sending an opt-in cookie", async () => {
  let cookieObserved = false;
  const server = http.createServer((request, response) => {
    cookieObserved ||= request.headers.cookie === "session=do-not-report";
    response.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Length": "6",
      "X-Vercel-Cache": "HIT",
    });
    response.end("sample");
  });

  const baseUrl = await listen(server);
  process.env.ECL_PERF_TEST_COOKIE = "session=do-not-report";
  try {
    const report = await runBenchmark({
      baseUrl,
      label: "local-test",
      routes: [],
      timeoutMs: 2_000,
      settleTimeoutMs: 1_000,
      warmRuns: 2,
      requestDelayMs: 0,
      browser: false,
      browserChannel: "chromium",
      storageState: "",
      cookieEnv: "ECL_PERF_TEST_COOKIE",
    }, [{
      id: "test",
      label: "Test route",
      path: "/hub/test?discard=this",
      requiresAuth: true,
      budget: {
        kind: "test",
        coldTtfbMs: 10_000,
        warmP50TtfbMs: 10_000,
        coldBrowserReadyMs: 10_000,
        warmP50BrowserReadyMs: 10_000,
      },
    }]);

    const serialized = JSON.stringify(report);
    const markdown = renderMarkdown(report);
    assert.equal(cookieObserved, true);
    assert.equal(serialized.includes("do-not-report"), false);
    assert.equal(serialized.includes("discard=this"), false);
    assert.equal(markdown.includes("do-not-report"), false);
    assert.equal(report.target.authenticatedHttp, true);
    assert.equal(report.routes[0].http.warmSummary.successCount, 2);
  } finally {
    delete process.env.ECL_PERF_TEST_COOKIE;
    await close(server);
  }
});

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
