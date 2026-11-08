# ECL Split One

ECL Split One is the web and operations repository for Expat China League. It contains three separate runtimes:

- the Next.js website and API;
- the Windows Electron companion app in `companion/`;
- the always-on match report worker in `report-engine/`.

The website uses PostgreSQL through Prisma, Supabase Auth for player accounts, and optional KOOK and match-reporting integrations.

## Requirements

- Node.js 20.9 or newer (Node.js 22 LTS is recommended)
- npm, using the committed `package-lock.json`
- PostgreSQL for database-backed pages and API routes
- A Supabase project for sign-in and account features
- Windows when running or packaging the Electron companion app
- Docker only when building the report-engine container

## Web setup

1. Install the exact locked dependencies:

   ```bash
   npm ci
   ```

   The `postinstall` script also generates the Prisma client.

2. Copy the environment template and replace only the values needed for the feature you are working on:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   On macOS or Linux:

   ```bash
   cp .env.example .env.local
   ```

3. At minimum, configure `DATABASE_URL` for database-backed pages. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` when working on authentication or account features.

4. For a new, disposable local PostgreSQL database only, create the schema from `prisma/schema.prisma`:

   ```bash
   npx prisma db push
   ```

   This repository does not yet contain a Prisma migration history. Do not run `prisma db push` against a shared, staging, or production database. Ask the repository owner for the approved database workflow when using an existing environment.

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment configuration

The root `.env.example` is the source of truth for supported variable names. It contains placeholders and safe local defaults only. Never commit `.env`, `.env.local`, database credentials, cookies, bot tokens, or service secrets.

| Configuration | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Prisma and all database-backed pages/APIs | Use a PostgreSQL connection string. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Hub/account sign-in | These values are browser-visible. Use only the Supabase public anon or publishable key. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Admin UI and APIs | Set all three to independent, non-empty values. Keep them server-only. |
| `ECL_KOOK_BOT_SECRET` | Trusted requests between the KOOK bot and web API | The same secret must be configured on both services. |
| `ECL_JOB_SECRET`, `ECL_REPORT_ENGINE_SECRET` | Scheduled jobs and report worker | Use separate random secrets where possible. |
| `KOOK_BOT_TOKEN` and KOOK channel IDs | KOOK notifications and tournament workflows | Optional for ordinary web development. |
| `NEXT_PUBLIC_SITE_URL`, `ECL_SITE_URL` | Absolute web URLs and worker callbacks | `http://localhost:3000` is suitable locally. |
| `LZYUMI_*`, `REPORT_ENGINE_*` | External match lookup and report worker | Optional unless working on reporting. Treat credentials, tokens, cookies, and proxy settings as secrets. |
| `ECL_DESKTOP_UPDATE_BLOB_BASE`, `ECL_UPDATE_PUBLIC_KEY_FILE` | Desktop update downloads and signing verification | Optional for companion release work. |

`NEXT_PUBLIC_*` variables are included in browser bundles. Do not put private keys or service-role credentials in them.

## Which features need external services?

| Area | PostgreSQL | Supabase | Other configuration |
| --- | --- | --- | --- |
| Static/public information pages | No | No | None |
| Leaderboards, matches, teams, registrations, tournament data | Yes | No | Feature-specific integrations may be optional. |
| `/hub` and account/profile flows | Yes | Yes | A valid Supabase user session is required for protected account data. |
| `/admin` | Yes | No | All admin variables must be configured. |
| KOOK, jobs, and inhouse reporting APIs | Yes | Sometimes | KOOK/job/report-engine secrets and upstream match configuration. |
| Electron companion | For live server data | Yes for sign-in | The build accepts only public Supabase configuration. |
| Report engine | Through the website API | No | Site URL, report-engine secret, and selected match-source credentials. |

Without `DATABASE_URL`, the development server can still show pages that do not query Prisma, but database-backed pages and routes will fail. Without Supabase configuration, public pages remain available while authentication and account features do not work.

## Web commands

Run these from the repository root:

```bash
npm run dev                 # Next.js development server
npm run build               # Prisma generation and production build
npm start                   # Serve an existing production build
npm test                    # Root regression tests
npm run test:focused        # Ranked, KOOK, tournament, and desktop-update tests
npx tsc --noEmit            # TypeScript check
npm run lint                # ESLint
npm run test:perf           # Focused Hub benchmark tests
```

Run the read-only Hub cold/warm audit against a local or isolated preview target:

```bash
npm run perf:hub -- --base-url http://localhost:3000 --warm-runs 3 --output .tmp/hub-performance.json --markdown .tmp/hub-performance.md
```

Add `--browser` for Playwright navigation timings. Authenticated runs use a local
ignored storage-state file and an approved test account; credentials and browser
state must never be committed. The full method, route budgets, and first sanitized
result are in [`docs/performance/HUB_BASELINE.md`](docs/performance/HUB_BASELINE.md).

GitHub Actions runs the locked web install, both test commands, TypeScript, the
standard production build, and the offline performance contract test on pull
requests and pushes to `main`. Reproduce that web CI path locally with:

```bash
npm ci
npm test
npm run test:focused
npx tsc --noEmit --incremental false
npm run build
npm run test:perf:ci
```

CI uploads `.tmp/ci/performance-tests.xml` as a short-lived artifact. That
artifact is produced entirely from local fixtures and normalizes workspace
paths, timings, request IDs, and ephemeral ports. It contains no target URL,
credential value, cookie value, identity, response body, or provider payload.
The live Hub benchmark and its provisional ceilings remain review evidence
rather than a blocking CI gate until representative authenticated budgets are
agreed.

Repository-wide lint is not part of this initial CI path because the existing
baseline is still noisy; new work should continue to run focused lint where
appropriate until the scopes and baseline are remediated separately.

Some maintenance scripts can write to the configured database. Do not run scripts whose names contain `release`, `repair`, `reset`, `sync`, `backfill`, or `apply` against any shared database unless the owner has explicitly approved the operation.

## Electron companion

The companion has its own dependency lockfile and commands:

```bash
cd companion
npm ci
npm test
npm run build
npm run demo
```

`npm run demo` uses labelled sample data. `npm start` launches the normal local app. Windows packaging commands and release safeguards are documented in [`companion/README.md`](companion/README.md).

The companion build reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the root `.env` or `.env.local`. It rejects server/service-role keys and does not package the other root secrets.

## Report engine

The report engine is a separate Node.js worker. It currently has no lockfile, so install and run it from its own directory:

```bash
cd report-engine
npm install
npm start
```

The worker reads `report-engine/.env` and the root `.env`; it does not read the root `.env.local`. Configure at least:

- `ECL_SITE_URL`;
- one of `ECL_REPORT_ENGINE_SECRET`, `ECL_JOB_SECRET`, or `ECL_KOOK_BOT_SECRET`;
- the credentials required by `REPORT_ENGINE_MATCH_SOURCE`.

`KOOK_BOT_TOKEN` is optional and is used only when the worker must send KOOK messages.

To build the worker container from the repository root:

```bash
docker build -t ecl-report-engine report-engine
docker run --env-file report-engine/.env ecl-report-engine
```

## Troubleshooting

- Run `npx prisma generate` if `@prisma/client` reports that it is not initialized.
- Check `DATABASE_URL` and PostgreSQL reachability for Prisma connection errors.
- Check both public Supabase variables if sign-in is unavailable.
- Ensure the website and worker use matching service secrets when a trusted API returns `401`.
- Remove `.next/` and rerun `npm run build` only when diagnosing stale generated output; do not delete project or database files.

## Contributing

Open or claim a GitHub issue before a substantial change, create a focused branch, and include the relevant build/type/test results in the pull request. Security findings should be reported through GitHub's private vulnerability reporting rather than a public issue.
