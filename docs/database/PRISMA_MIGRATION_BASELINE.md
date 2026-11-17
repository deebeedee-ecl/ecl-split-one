# Prisma migration baseline plan

Status: `prisma/migrations/0_init` represents the verified production `public` schema and has passed an isolated restore test. Production migration metadata has not been changed; Phase 5 still requires separate explicit authorization.

Tracking: GitHub issue #4.

## Purpose

ECL has an established PostgreSQL database and a current `prisma/schema.prisma`, but no committed Prisma migration history. The goal is to introduce reproducible Prisma 6 migrations without resetting production, losing historical records, or pretending that an unverified datamodel is identical to the live public schema.

Prisma's official [Prisma 6 baselining workflow](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining) generates an initial migration from an empty database and later records that migration as already applied on an existing database. Supabase [documents platform and logical backups](https://supabase.com/docs/guides/platform/backups), with availability depending on the project plan and backup configuration. Verify the actual project plan and restore capability instead of assuming either is available.

## Non-negotiable boundaries

- Never run `prisma db push`, `prisma migrate dev`, or `prisma migrate reset` against a shared/staging/production database.
- Never run `prisma migrate resolve`, `prisma migrate deploy`, SQL, or a restore against production without a separately reviewed command and explicit authorization naming production.
- Do not read a developer `.env*` file or put a connection URL in a command argument, tracked file, terminal transcript, issue, or artifact.
- Use a direct PostgreSQL session connection for migration operations, not a transaction-pooler URL.
- Keep dumps, schema exports, drift SQL, and private manifests under ignored `.tmp/` or `backups/`. They may contain operationally sensitive schema or data.
- Treat `prisma/schema.prisma` and the live database as two inputs until drift is resolved. Neither silently overwrites the other.
- Prisma manages ECL application objects in `public`; Supabase-managed auth/storage schemas are outside this baseline.

## Phase 1 - credential-free preflight

The repository command defaults to a plan and does not contact a database:

```powershell
npm run db:baseline:inspect -- --target=production-read-only
```

It reports the required process environment variable and ignored output directory without printing or loading credentials.

## Phase 2 - verified recovery point

Before generating or marking a baseline:

1. Identify the exact production Supabase/PostgreSQL project without copying its identifiers into tracked files.
2. Confirm the latest platform backup/PITR timestamp and retention in the provider dashboard, or create a fresh logical backup with the provider-supported CLI/`pg_dump` path.
3. Record the recovery owner, backup timestamp, type, retention, and restore target in an ignored private manifest. Never record the connection URL.
4. Restore to a new/disposable project or local PostgreSQL instance and prove that the dump is readable before relying on it as rollback.
5. Do not restore over production as a test.

The host currently has no standalone `pg_dump`, `pg_restore`, or `psql`. If a manual logical backup is required, use a reviewed pinned PostgreSQL container or the repository-pinned Supabase CLI rather than installing an untracked database client. Image download, production read access, and backup creation each require explicit authorization.

## Phase 3 - read-only live-schema comparison

Supply the direct production connection only as `ECL_PRISMA_BASELINE_DATABASE_URL` in the operator process. Do not store it in `.env.local` for Codex to read and do not pass it on the command line.

After explicit production read authorization:

```powershell
npm run db:baseline:inspect -- `
  --target=production-read-only `
  --execute-read-only
```

The command runs Prisma 6 `migrate diff` from the datasource described by the live database to the checked-in datamodel. It writes only to:

- `.tmp/prisma-baseline/live-to-prisma.txt`
- `.tmp/prisma-baseline/live-to-prisma.sql`
- `.tmp/prisma-baseline/manifest.json`

The console output is bounded to target, drift status, and artifact paths. Review the ignored artifacts locally. A generated SQL diff is evidence, not an approved migration and must not be executed.

Also compare a schema-only logical dump for database objects Prisma cannot represent, including policies, triggers, functions, extensions, grants, and manually created indexes. Classify every difference as:

- represented in `prisma/schema.prisma` and required in the baseline;
- intentionally provider-managed/outside `public`;
- required public-schema SQL that must be added manually to the baseline;
- obsolete drift that needs a separate reviewed cleanup migration, never silent deletion.

## Phase 4 - create and validate the baseline

Only after backup validation and drift review are complete:

1. Generate `prisma/migrations/0_init/migration.sql` with the repository-pinned Prisma 6 CLI using `migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
2. Add reviewed public-schema SQL that Prisma cannot represent. Do not include Supabase-managed schemas or seed/private data.
3. Apply the baseline to an empty disposable PostgreSQL database.
4. Restore the verified production backup into a separate disposable target and compare its public schema to the baseline end state.
5. Run application tests and critical read journeys against the disposable target.
6. Commit the baseline migration and this runbook in a focused PR. A baseline file is not permission to touch production.

### Verified baseline evidence

On November 14, 2026, the operator created an ignored local logical recovery set for the production `public` schema and data after confirming that the Supabase project had no available physical backup and PITR was disabled. The private manifest records artifact hashes, sizes, and timestamps without connection details or project identifiers.

The recovery set was restored into a separate local Supabase PostgreSQL database. The generated `0_init` was then applied to another empty disposable database and the same production data backup loaded successfully. A catalog comparison covering columns/defaults, constraints, indexes, functions, triggers, RLS state, and policies produced 512 signatures for each schema with zero differences.

The exact baseline SQL was also applied to a separate empty Supabase preview project. A subsequent remote schema-only dump confirmed 25 application tables, RLS on all nine tournament-owned tables, all five custom functions, all seven triggers, both partial unique indexes, and all three collection-job foreign keys. This preview project contains no production data and is not the production project.

The baseline deliberately includes manual SQL for production objects Prisma cannot fully represent: tournament checks, three collection-job foreign keys, two partial unique indexes, five guard functions, seven triggers, RLS on nine tournament tables, and browser-role privilege revocation. Do not regenerate `0_init` from the Prisma datamodel alone, because doing so would silently remove those objects. `LzyumiRefreshQueue.updatedAt` and `InhouseReportJob.updatedAt` include both `@default(now())` and `@updatedAt` so the datamodel matches their live database defaults.

This evidence validates the checked-in baseline and local recovery path only. It does not authorize `prisma migrate resolve`, later migrations, a production restore, or any other shared-database mutation.

## Phase 5 - mark production as baselined

After the exact baseline commit is reviewed and production authorization is granted, run the repository-pinned Prisma 6 `migrate resolve --applied 0_init` against the direct production connection. This writes Prisma migration metadata even though it does not recreate application tables, so it is a production database mutation.

Immediately verify:

- `_prisma_migrations` contains exactly the reviewed baseline checksum/status;
- `prisma migrate status` reports no pending migration or history conflict;
- a fresh read-only live-to-datamodel diff reports no unresolved ECL schema drift;
- critical account, Hub, tournament, ranked-inhouse, and report-engine reads remain healthy.

Do not deploy a later schema migration in the same first baseline operation.

For normal development after Phase 5, create a new migration against a disposable local database, review the SQL, and validate both forward application and application compatibility. Shared preview/production environments use `prisma migrate deploy`; never use `prisma db push` there. Rollback remains restore-or-forward-repair based: do not edit `_prisma_migrations` manually and do not bundle destructive cleanup into the first compatible deployment.

## Recovery boundary

Before the production metadata write, the rollback target is “no Prisma migration history.” If `migrate resolve` records the wrong migration or checksum, stop all migration activity. Do not improvise by deleting `_prisma_migrations` rows. Use the reviewed backup/restore or a separately reviewed metadata-repair operation, then rerun drift/status checks.

The first real schema change after baselining must be a separate backward-compatible expand migration with its own rollback and application compatibility plan.
