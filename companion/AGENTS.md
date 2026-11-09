# Companion instructions

This folder is an independently built Electron application. It supports local collection and desktop Hub workflows, but it is not required for ordinary profile/rank/history refresh while the signed-browser Lzyumi flow works.

## Security and product boundaries

- Package only browser-safe Supabase configuration. Never bundle a service-role key, database credential, bot/worker secret, provider token/cookie, or signing private key.
- Keep privileged Node/Electron capabilities behind the preload boundary; do not expose unrestricted filesystem, shell, or network primitives to renderer code.
- Preserve local user privacy and the documented raw-data lifecycle. Sample/demo data must be clearly labelled and non-personal.
- Update verification and release-signature behavior together. Never weaken signature checks to make an update/install test pass.
- Keep English/Chinese installer and critical player instructions aligned when changing a user-facing flow.

## Verification and release safety

- Run `npm test` for changes in this folder; add build/demo checks for UI or bundling changes.
- Packaging, version freezing, signing, update publication, and distribution require explicit user approval.
- Dated files under `docs/desktop/` are release checkpoints, not automatically current architecture.
