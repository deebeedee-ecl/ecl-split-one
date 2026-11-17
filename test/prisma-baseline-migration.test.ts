import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "prisma/migrations/0_init/migration.sql";
const metadataLockMigrationPath =
  "prisma/migrations/20261117095944_lock_prisma_migration_metadata/migration.sql";
const productionBaselineChecksum =
  "49587901e862df8530d1f52e0cfe1f21ccfc48b364245664508bef08031082a4";

async function read(path: string) {
  return readFile(path, "utf8");
}

function occurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

test("0_init is an atomic schema-only PostgreSQL baseline", async () => {
  const [migration, lock] = await Promise.all([
    read(migrationPath),
    read("prisma/migrations/migration_lock.toml"),
  ]);

  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(lock, /provider = "postgresql"/);
  assert.doesNotMatch(migration, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(migration, /\bCOPY\b[\s\S]*\bFROM\s+stdin\b/i);
  assert.doesNotMatch(migration, /\b(?:auth|storage)\./i);
});

test("recorded production baseline checksum remains immutable", async () => {
  const migration = await readFile(migrationPath);
  const checksum = createHash("sha256").update(migration).digest("hex");

  assert.equal(checksum, productionBaselineChecksum);
});

test("metadata lock migration only revokes Supabase browser roles", async () => {
  const migration = await read(metadataLockMigrationPath);

  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(
    migration,
    /REVOKE ALL PRIVILEGES ON TABLE public\."_prisma_migrations" FROM anon, authenticated;/,
  );
  assert.doesNotMatch(
    migration,
    /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT)\b/i,
  );
  assert.equal(occurrences(migration, "REVOKE"), 1);
  assert.equal(occurrences(migration, "_prisma_migrations"), 1);
});

test("0_init preserves production-only tournament integrity objects", async () => {
  const migration = await read(migrationPath);

  const constraints = [
    "tournaments_capacity_positive",
    "tournaments_prize_nonnegative",
    "tournaments_dates_ordered",
    "tournaments_registration_window_ordered",
    "tournaments_open_requires_rules",
    "tournament_registrations_required_snapshots",
    "tournament_registrations_identity_nonempty",
    "tournament_registrations_consent_ordered",
    "tournament_registration_pool_valid",
    "tournament_member_pot",
    "tournament_fixture_shape",
    "tournament_report_shape",
    "tournament_notification_shape",
    "tournament_collection_shape",
    "tournament_collection_fixture",
    "tournament_collection_profile",
    "tournament_collection_report",
  ];
  for (const constraint of constraints) {
    assert.equal(occurrences(migration, constraint), 1, constraint);
  }

  for (const index of [
    "tournament_one_approved_game",
    "tournament_unique_league_game",
  ]) {
    assert.equal(occurrences(migration, index), 1, index);
  }
});

test("0_init preserves tournament guards and browser isolation", async () => {
  const migration = await read(migrationPath);

  for (const fn of [
    "guard_tournament_registration",
    "guard_tournament_capacity_update",
    "tournament_member_scope_guard",
    "tournament_floater_scope_guard",
    "reject_tournament_game_in_legacy",
  ]) {
    assert.match(migration, new RegExp(`CREATE FUNCTION public\\.${fn}\\(\\)`));
  }

  for (const trigger of [
    "tournament_registration_guard",
    "tournament_capacity_update_guard",
    "tournament_member_scope_guard",
    "tournament_floater_scope_guard",
    "tournament_legacy_game_guard",
    "tournament_legacy_report_guard",
    "tournament_legacy_session_guard",
  ]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER ${trigger}`));
  }

  assert.equal(occurrences(migration, "ENABLE ROW LEVEL SECURITY"), 9);
  assert.match(migration, /FROM PUBLIC, anon, authenticated;/);
});

test("Prisma models retain the two live updatedAt defaults", async () => {
  const schema = await read("prisma/schema.prisma");
  for (const model of ["LzyumiRefreshQueue", "InhouseReportJob"]) {
    const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(block, model);
    assert.match(block[1], /updatedAt\s+DateTime\s+@default\(now\(\)\)\s+@updatedAt/);
  }
});
