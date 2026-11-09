import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  ROUTE_CASES,
  assertTmpPath,
  evaluateObservation,
  validateBaseUrl,
} from "../scripts/smoke-layout-boundaries.mjs";

test("layout smoke accepts only credential-free HTTP targets", () => {
  assert.equal(validateBaseUrl("https://eclchina.lol/hub?x=1").href, "https://eclchina.lol/");
  assert.throws(() => validateBaseUrl("file:///tmp/site"), /http or https/);
  assert.throws(() => validateBaseUrl("https://user:secret@example.com"), /Credentials/);
});

test("layout smoke artifacts stay under ignored .tmp", () => {
  const safe = assertTmpPath(".tmp/layout-smoke/result.json", "--output");
  assert.equal(path.relative(process.cwd(), safe), path.join(".tmp", "layout-smoke", "result.json"));
  assert.throws(() => assertTmpPath("result.json", "--output"), /must stay inside/);
});

test("public Hub and application Hub shell expectations are distinct", () => {
  const publicResult = evaluateObservation(ROUTE_CASES[0], {
    status: 200,
    pathname: "/hub",
    bodyHeaderCount: 1,
    bodyFooterCount: 1,
    publicLoginLinks: 1,
    publicContactLinks: 1,
    hubSidebarLinks: 0,
    horizontalOverflow: false,
  });
  const hubResult = evaluateObservation(ROUTE_CASES[1], {
    status: 200,
    pathname: "/hub/dashboard",
    bodyHeaderCount: 0,
    bodyFooterCount: 0,
    publicLoginLinks: 0,
    publicContactLinks: 0,
    hubSidebarLinks: 2,
    horizontalOverflow: false,
  });
  assert.equal(publicResult.pass, true);
  assert.equal(hubResult.pass, true);
});

test("hidden public shell behind Hub fails the smoke", () => {
  const result = evaluateObservation(ROUTE_CASES[1], {
    status: 200,
    pathname: "/hub/dashboard",
    bodyHeaderCount: 1,
    bodyFooterCount: 1,
    publicLoginLinks: 1,
    publicContactLinks: 1,
    hubSidebarLinks: 2,
    horizontalOverflow: false,
  });
  assert.equal(result.pass, false);
  assert.deepEqual(result.failures, [
    "bodyHeaderCount expected 0, received 1",
    "bodyFooterCount expected 0, received 1",
    "publicLoginLinks expected 0, received 1",
    "publicContactLinks expected 0, received 1",
  ]);
});
