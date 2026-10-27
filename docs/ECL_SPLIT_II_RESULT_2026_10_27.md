# First Split II result and roster corrections

Owner supplied the Lzyumi detail response and matching recent-game entry for
NextGen vs Exodus (RR05), and explicitly requested publication on October 27.

- Exodus won the Bo1; NextGen led 33–17 in kills, which does not determine victory.
- Match timestamp supplied by Lzyumi: October 27, 2026, 20:38:41 China time.
- Duration: 41:15 (2,475 seconds). Joe is the provider-selected MVP.
- All ten players' K/D/A sums agree with the two team summaries. Champion IDs,
  seven item slots, full-unit champion damage and gold are preserved.
- Lzyumi provides an opaque provider game ID, not the numeric League Game ID.
  Keep it with private source evidence; do not invent a numeric ID or present
  it as a validated LCU match. Duplicate fixture/game approval remains guarded.
- The real result was submitted and approved through the tournament workflow.
  Publication for this request suppresses KOOK notifications. Ranked inhouse
  scoring is not invoked.

Owner-directed roster changes:

- Zeu5 (`Zeu5#39026`) replaces beef in NextGen's original drafted slot.
- beef moves to floaters. Totals remain 25 main players and five floaters.
- fayimo used `Hrnn#54564`; this is the owner-confirmed tournament account.
  His general Hub profile remains unchanged.
- Bernardt's tournament snapshot is aligned with the previously owner-requested
  `Zeus#11431` correction. He is a different player from Zeu5.

The administrative correction used event and registration-table locks. The
registration guard was restored before commit; exact row comparisons allowed
only the two pool changes and two tournament Riot ID corrections. Hashes of
AccountProfile and existing inhouse/legacy tables matched before/after. Consent
versions/timestamps, registration IDs and signup ordering were preserved. The
private audit is `.tmp/nextgen-replacement-2026-10-27.json`.

Tournament roster display, manual normalization and collection matching now use
the tournament registration's Riot identity, independently of later general Hub
profile changes. Owner-approved tournament account changes remain administrative
corrections, not automatic profile refreshes.

Results open an accessible dialog with team outcome, champion portraits, item
icons, K/D/A, damage, gold and MVP. X, Escape and the backdrop close the dialog;
focus returns to the result button. Missing statistics remain unavailable.
Existing local champion/item assets are reused. No database schema was changed.

Validation: isolated PostgreSQL registration/workflow checks, DOM interactions
(including dialog dismissal and focus restoration), lint, TypeScript and an
isolated production build. No fabricated games or KOOK test messages were used.

Desktop delivery uses the frozen, ECL-signed Hub 1.0.2 release. The owner approved
adding Development to the existing ECL-HUB project connection so this PC can
publish using OIDC. Production/Preview access is retained, and no static write
token is added. Only the public store ID/webhook public key configuration is
made nonsensitive, as required by Vercel for Development. Private keys and tokens
are not uploaded or committed. Publish immutable files first and `latest.yml`
last, after checking the public installer SHA-512 and signed envelope.

Installed trusted builds check after about 15 seconds on startup and every six
hours. They download verified updates automatically; the user restarts to apply
them when League/collection/reporting are idle. New tournament results then
refresh from the shared API every minute without another installer release.
The richer match dialog is a website feature; desktop 1.0.2 retains its native
results/standings and expandable player details.

Live verification completed October 27: RR05 is NextGen 0–1 Exodus; standings
award Exodus one point. The public report contains all ten players and item,
damage and gold details; fayimo displays Hrnn, Zeu5 is in NextGen and beef is
among the five floaters. The popup code is served by the production deployment.
LCU ingestion also preserves available items/damage/gold for future games;
missing fields remain absent.

The fixed public update feed now advertises 1.0.2. All 119,274,135 installer bytes
were downloaded in validated ranges and their SHA-512 matched the signed release
metadata before activation. The active public envelope verifies against the
existing pinned ECL key. Installer range access was verified after propagation.
No installed app was executed or restarted by these release checks. Private
evidence: `.tmp/hub-102-publication.json`, `.tmp/hub-102-live-verification.json`
and `.tmp/first-result-live-verification.json`.
