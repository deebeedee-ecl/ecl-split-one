# ECL documentation map

This directory separates durable product/architecture context from dated delivery records. Start here instead of assuming every Markdown file is current.

## Canonical context

| Document | Use it for |
| --- | --- |
| [`PRODUCT.md`](PRODUCT.md) | Product purpose, users, journeys, navigation, terms, and open product questions |
| [`UI_WALKTHROUGH.md`](UI_WALKTHROUGH.md) | Public and authenticated route map, access states, page contents, and known UI drift |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Runtime boundaries, data ownership, core flows, trust boundaries, and known structural risks |
| [`INTEGRATIONS.md`](INTEGRATIONS.md) | Lzyumi, KOOK, Supabase, report-engine, and companion contracts |
| [`RUNBOOK.md`](RUNBOOK.md) | Safe local setup, verification, diagnostics, deployment boundaries, and documentation upkeep |
| [`decisions/`](decisions/) | Accepted architectural decisions and their consequences |

These documents describe the best verified current understanding. They should be updated when an approved change alters behavior, ownership, or an external contract.

## Operational and historical records

- `ECL_SPLIT_II_*.md` and `database/tournaments/` record a specific tournament rollout. Check code and live state before reusing instructions.
- `desktop/` records companion releases, experiments, and handoffs. Current companion commands live in `companion/README.md`.
- `announcements/` contains publishable community copy, not technical requirements.
- `kook/` contains dated KOOK operator instructions.
- `kook-inhouse-bot.md` documents an integration iteration and may lag the adjacent bot repository.
- SQL files are operational artifacts. Never execute them merely because they are documented.

## Evidence labels

Canonical documents use these meanings:

- **Verified current** — confirmed in current code/schema/tests or user-provided current UI/operations evidence.
- **Product requirement** — intended behavior supplied by the project owner/operator; implementation still needs verification when relevant.
- **Historical** — true for a dated release or earlier design, not automatically true now.
- **Open question** — unresolved and must not be silently decided by an implementation.

## Maintenance rule

Keep `AGENTS.md` short and route task-specific knowledge here. Do not copy secrets, production identifiers, verification codes, personal account values, or private channel/user IDs into documentation.
