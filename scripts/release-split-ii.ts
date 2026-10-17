// Read-only unless a write action is explicitly accompanied by --apply.
// Loads the same environment precedence as Next.js; never prints connection URLs.
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { SPLIT_II_SLUG } from "../lib/tournaments/split-ii-config";

class ReleaseError extends Error {}

async function main() {
  const action = process.argv[2] ?? "check";
  if (!["check", "prepare", "open", "close"].includes(action)) throw new ReleaseError("Use check, prepare, open or close.");
  if (action !== "check" && !process.argv.includes("--apply")) throw new ReleaseError("Write actions require explicit release approval and the --apply flag.");
  loadEnvConfig(process.cwd(), false);
  if (!process.env.DATABASE_URL) throw new ReleaseError("The application database is not configured.");
  const configuredSchema = new URL(process.env.DATABASE_URL).searchParams.get("schema");
  if (configuredSchema && configuredSchema !== "public") throw new ReleaseError("Review the target schema: the release SQL is scoped to public.");
  const db = new PrismaClient({ log: [] });
  try {
    const roles = await db.$queryRaw<Array<{ bypass: boolean; can_create: boolean }>>`
      SELECT rolbypassrls AS bypass, has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
      FROM pg_roles WHERE rolname = current_user
    `;
    const existing = await db.$queryRaw<Array<{ events: boolean; registrations: boolean; profiles: boolean }>>`
      SELECT to_regclass('public.tournaments') IS NOT NULL AS events,
        to_regclass('public.tournament_registrations') IS NOT NULL AS registrations,
        to_regclass('public."AccountProfile"') IS NOT NULL AS profiles
    `;
    if (!existing[0].profiles) throw new ReleaseError("This is not the existing ECL profile database. No changes made.");
    const columns = await db.$queryRaw<Array<{ data_type: string }>>`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'AccountProfile' AND column_name = 'id'
    `;
    if (columns[0]?.data_type !== "text") throw new ReleaseError("The existing profile ID type differs from the reviewed SQL. Stop and adapt the new foreign key before applying.");
    if (existing[0].events !== existing[0].registrations) throw new ReleaseError("Only one tournament table exists. Review the database before proceeding.");
    console.log(JSON.stringify({ action, tablesExist: existing[0].events, backendBypassesRls: roles[0].bypass, canCreate: roles[0].can_create }));

    function execute(file: string) {
      const engine = path.resolve("node_modules/@prisma/engines/schema-engine-windows.exe");
      const environment = { ...process.env, ...(existsSync(engine) ? { PRISMA_SCHEMA_ENGINE_BINARY: engine } : {}) };
      const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "execute", "--schema", "prisma/schema.prisma", "--file", path.join("docs/database/tournaments", file)], {
        env: environment, encoding: "utf8", windowsHide: true, timeout: 90_000, stdio: "pipe",
      });
      if (result.status !== 0) throw new ReleaseError(`SQL step failed: ${file}. Stop and inspect before continuing; credentials are not printed.`);
      console.log(`Applied ${file}`);
    }

    if (action === "prepare") {
      if (!roles[0].bypass || !roles[0].can_create) throw new ReleaseError("The migration/backend role needs reviewed DDL privileges and RLS bypass.");
      if (existing[0].events) throw new ReleaseError("Tournament tables already exist. Use check; do not overwrite or rerun the creation step.");
      execute("create-tournaments.draft.sql");
      execute("seed-split-ii.draft.sql");
      console.log("Tournament tables prepared; Split II remains in DRAFT and accepts no registrations.");
    }
    if (action === "open" || action === "close") {
      if (!existing[0].events) throw new ReleaseError("Prepare the tables before scheduling or closing registration.");
      execute(action === "open" ? "schedule-split-ii.draft.sql" : "close-split-ii.sql");
    }
    if (existing[0].events || action === "prepare") {
      const event = await db.tournament.findUnique({ where: { slug: SPLIT_II_SLUG }, select: {
        status: true, capacity: true, registrationOpensAt: true, registrationClosesAt: true,
        draftDate: true, startsOn: true, endsOn: true, _count: { select: { registrations: true } },
      } });
      console.log(JSON.stringify({ event }));
    }
  } finally { await db.$disconnect(); }
}

main().catch(error => {
  console.error(error instanceof ReleaseError ? error.message : "Release operation failed. No credentials or player data are printed.");
  process.exitCode = 1;
});
