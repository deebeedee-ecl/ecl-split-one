import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DELETE, PATCH } from "../app/api/free-agent/[id]/route";
import { GET } from "../app/api/free-agent/route";
import { hasAdminSession } from "../lib/admin-session";

const context = { params: Promise.resolve({ id: "synthetic-free-agent" }) };

test("free-agent contact reads reject unauthenticated requests before database access", async () => {
  const response = await GET(new Request("http://localhost/api/free-agent"));

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { error: "Admin access required" });
});

test("free-agent mutations reject unauthenticated requests before database access", async () => {
  const patch = await PATCH(
    new Request("http://localhost/api/free-agent/synthetic-free-agent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    }),
    context,
  );
  const remove = await DELETE(
    new Request("http://localhost/api/free-agent/synthetic-free-agent", { method: "DELETE" }),
    context,
  );

  assert.equal(patch.status, 401);
  assert.equal(remove.status, 401);
  assert.deepEqual(await patch.json(), { error: "Admin access required" });
  assert.deepEqual(await remove.json(), { error: "Admin access required" });
});

test("admin-session matching is exact and fails closed in production", () => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousNodeEnv = process.env.NODE_ENV;

  try {
    process.env.ADMIN_SESSION_SECRET = "synthetic-admin-session";
    delete process.env.ADMIN_PASSWORD;

    assert.equal(hasAdminSession(new Request("http://localhost")), false);
    assert.equal(hasAdminSession(new Request("http://localhost", {
      headers: { cookie: "ecl_admin_session=wrong" },
    })), false);
    assert.equal(hasAdminSession(new Request("http://localhost", {
      headers: { cookie: "ecl_admin_session=synthetic-admin-session" },
    })), true);

    delete process.env.ADMIN_SESSION_SECRET;
    Reflect.set(process.env, "NODE_ENV", "production");
    assert.equal(hasAdminSession(new Request("http://localhost", {
      headers: { cookie: "ecl_admin_session=ecl2026" },
    })), false);
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
  }
});

test("public free-agent pages exclude contact fields and disclose their admin-only use", async () => {
  const [directory, registration] = await Promise.all([
    readFile("app/(public)/free-agents/page.tsx", "utf8"),
    readFile("app/(public)/register/free-agent/page.tsx", "utf8"),
  ]);

  assert.match(directory, /status:\s*true,[\s\S]+signedToTeamName:\s*true/);
  assert.doesNotMatch(directory, /email:\s*true|notes:\s*true|agent\.notes/);
  assert.match(registration, /email and notes are visible only to ECL administrators/i);
});
