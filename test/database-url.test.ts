import assert from "node:assert/strict";
import test from "node:test";

import { resolveApplicationDatabaseUrl } from "../lib/database-url";

test("DATABASE_URL keeps priority over the Supabase integration fallback", () => {
  assert.equal(
    resolveApplicationDatabaseUrl({
      DATABASE_URL: "postgresql://primary.invalid/ecl",
      POSTGRES_PRISMA_URL: "postgresql://fallback.invalid/ecl",
    }),
    "postgresql://primary.invalid/ecl",
  );
});

test("POSTGRES_PRISMA_URL is used when DATABASE_URL is absent", () => {
  assert.equal(
    resolveApplicationDatabaseUrl({
      POSTGRES_PRISMA_URL: "postgresql://isolated.invalid/ecl",
    }),
    "postgresql://isolated.invalid/ecl",
  );
});

test("blank database variables are not accepted as configured", () => {
  assert.equal(
    resolveApplicationDatabaseUrl({
      DATABASE_URL: "  ",
      POSTGRES_PRISMA_URL: "\t",
    }),
    undefined,
  );
});
