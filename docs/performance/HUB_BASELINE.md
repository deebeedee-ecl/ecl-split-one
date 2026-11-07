# Hub performance baseline

- Baseline date: 2026-11-07 (Asia/Shanghai)
- Source commit: `a43efad940b05e2d67b796f1f23ef9daeb61b040`
- Target: `https://eclchina.lol` production, signed out
- Measurement client: Windows, Node.js 26.13.0, Microsoft Edge through Playwright 1.63.0

This is the first reproducible baseline for roadmap issue #28. It records the current state before Hub data-loading changes. It is read-only and contains no cookies, tokens, account IDs, provider payloads, response bodies, query strings, or raw browser errors.

## Reproduce the measurement

Install the locked dependencies and run the focused unit test first:

```powershell
npm ci
npm run test:perf
```

Measure a local or isolated preview deployment before production:

```powershell
npm run perf:hub -- `
  --base-url http://localhost:3000 `
  --warm-runs 3 `
  --browser `
  --browser-channel msedge `
  --output .tmp/hub-performance.json `
  --markdown .tmp/hub-performance.md `
  --label local-main
```

The default route set is Dashboard, My Profile, Account Settings, Players, Ranked Ladder, Champions, and Inhouses. Use `--routes dashboard,players` to run a subset. Output belongs in `.tmp/`, which is ignored by Git.

For an authenticated browser pass, create a short-lived local Playwright storage-state file under `.tmp/`; never commit, paste, or attach it:

```powershell
npx playwright codegen --save-storage=.tmp/hub-auth.json https://eclchina.lol/login
npm run perf:hub -- `
  --base-url https://eclchina.lol `
  --browser `
  --browser-channel msedge `
  --storage-state .tmp/hub-auth.json `
  --output .tmp/hub-authenticated.json `
  --markdown .tmp/hub-authenticated.md `
  --label production-authenticated
```

Use only an approved test account. Delete the local storage-state file when the measurement is complete. HTTP cookie input is also supported through the `ECL_PERF_COOKIE` environment variable for a controlled CI secret, but the browser storage-state flow is preferred for manual authenticated runs.

## Cold and warm method

- HTTP cold is one fresh connection with `Cache-Control: no-cache`.
- HTTP warm discards one warm-up, then records three sequential keep-alive requests.
- Browser cold creates a fresh context/cache for each route.
- Browser warm records three reloads in the same context.
- Browser ready is elapsed time through Playwright `networkidle`. It includes document loading, JavaScript, hydration, client data waterfalls, and the required quiet window; it is not a pure hydration measurement.
- Cold client state does not guarantee a new Vercel/serverless process.
- Requests are sequential with a 500 ms gap to avoid turning the audit into a load test.
- Redirects are followed only on the same origin. Reports store pathnames, not query strings.

## Initial sanitized production result

Command:

```powershell
npm run perf:hub -- `
  --base-url https://eclchina.lol `
  --label production-signed-out-browser-2026-11-07 `
  --warm-runs 3 `
  --request-delay-ms 500 `
  --browser `
  --browser-channel msedge `
  --output .tmp/issue-28-production-browser.json `
  --markdown .tmp/issue-28-production-browser.md
```

| Route | HTTP cold TTFB | HTTP warm p50 / p95 | Cold response | Browser cold TTFB / ready | Browser warm p50 TTFB / ready | Guardrail |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Dashboard | 496 ms | 103 / 103 ms | 48 KiB | 517 / 4,987 ms | 88 / 2,860 ms | Pass |
| My Profile | 764 ms | 107 / 197 ms | 49 KiB | 418 / 4,659 ms | 84 / 2,770 ms | Pass |
| Account Settings | 447 ms | 102 / 204 ms | 48 KiB | 746 / 4,722 ms | 93 / 3,122 ms | Pass |
| Players | 1,826 ms | 1,215 / 1,283 ms | 56 KiB | 422 / 4,978 ms | 86 / 5,195 ms | Pass |
| Ranked Ladder | 3,762 ms | 3,051 / 3,188 ms | 153 KiB | 424 / 7,265 ms | 86 / 6,063 ms | **Fail** |
| Champions | 2,778 ms | 1,789 / 1,825 ms | 82 KiB | 466 / 6,089 ms | 95 / 5,395 ms | Pass |
| Inhouses | 3,474 ms | 2,644 / 2,707 ms | 115 KiB | 413 / 6,561 ms | 85 / 5,757 ms | Pass |

All 28 recorded browser navigations returned HTTP 200, stayed on the expected route, reached network-idle, and recorded zero failed requests, console errors, or page errors. This confirms measurement integrity; it does not confirm that private/authenticated content rendered.

The HTTP cache metadata explains part of the split: Dashboard, My Profile, and Account Settings were served from Vercel cache on warm requests, while Players, Ranked Ladder, Champions, and Inhouses remained cache misses. The latter group retained multi-second HTTP TTFB.

Ranked Ladder is the clearest initial regression target: its HTTP warm p50 was 3.05 seconds and browser warm ready was 6.06 seconds. Champions and Inhouses remain expensive even though the deliberately loose initial guardrails did not fail.

## Provisional regression ceilings

These are reviewable starting guardrails based on the 2026-11-07 spot evidence, not final user-experience goals and not yet a blocking CI check.

| Route | HTTP cold TTFB | HTTP warm p50 TTFB | Browser cold ready | Browser warm p50 ready |
| --- | ---: | ---: | ---: | ---: |
| Dashboard | 1,000 ms | 750 ms | 8,000 ms | 6,000 ms |
| My Profile | 3,000 ms | 2,500 ms | 8,000 ms | 6,000 ms |
| Account Settings | 3,000 ms | 2,500 ms | 8,000 ms | 6,000 ms |
| Players | 3,000 ms | 2,500 ms | 8,000 ms | 6,000 ms |
| Ranked Ladder | 7,000 ms | 6,000 ms | 8,000 ms | 6,000 ms |
| Champions | 5,000 ms | 4,500 ms | 8,000 ms | 6,000 ms |
| Inhouses | 6,500 ms | 5,500 ms | 8,000 ms | 6,000 ms |

The script reports budget failures but exits successfully. Issue #5 can turn stable, reviewed budgets into a CI artifact or blocking regression check later.

## Limitations and next evidence

- This committed result is signed out. It measures route responses and the public/access-gate browser path, not authenticated Profile or Settings readiness.
- It is one measurement series from one network/client. Compare medians across repeated preview and production runs before attributing small changes to code.
- Network-idle is a practical readiness proxy, not a React hydration marker.
- Query count, Prisma timing, authentication timing, provider timing, serialization, and request correlation are intentionally deferred to #28 PR 2.
- No application code, database state, provider state, KOOK state, or user data was changed by this baseline.
