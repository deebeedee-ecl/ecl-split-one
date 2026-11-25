import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CHINA_STATS_SERVERS,
  CHINA_STATS_SERVER_KEYS,
} from "../lib/china-stats-servers.ts";

test("China stats preview keeps Ionia and Super Server as fixed scopes", () => {
  assert.deepEqual(CHINA_STATS_SERVER_KEYS, ["ionia", "super-server"]);
  assert.equal(CHINA_STATS_SERVERS.ionia.areaId, 1);
  assert.equal(CHINA_STATS_SERVERS["super-server"].areaId, 31);
});

test("China stats is direct-link, feature-gated, authenticated in production, and noindex", async () => {
  const [layout, rootPage, hubShell, robots, environment] = await Promise.all([
    readFile("app/labs/china-stats/layout.tsx", "utf8"),
    readFile("app/labs/china-stats/page.tsx", "utf8"),
    readFile("app/(hub)/hub/_components/HubShell.tsx", "utf8"),
    readFile("app/robots.ts", "utf8"),
    readFile(".env.example", "utf8"),
  ]);

  assert.match(layout, /isChinaStatsPreviewEnabled/);
  assert.match(layout, /HubAccessGate/);
  assert.match(layout, /HubBootstrapProvider/);
  assert.match(layout, /robots:[\s\S]*index: false[\s\S]*follow: false/);
  assert.match(rootPage, /redirect\("\/labs\/china-stats\/live"\)/);
  assert.match(robots, /disallow: "\/labs\/"/);
  assert.match(environment, /CHINA_STATS_PREVIEW_ENABLED/);
  assert.doesNotMatch(hubShell, /\/labs\/china-stats/);
});
