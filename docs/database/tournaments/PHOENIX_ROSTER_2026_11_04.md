# Phoenix manual roster change — 4 November 2026

Owner directed Biaomei to replace Doolittlesy, withdraw Doolittlesy from Split II entirely, and appoint **Shidian** as Phoenix captain. Owner explicitly confirmed Biaomei had accepted the tournament rules and ToS.

Read-only checks found Biaomei's existing confirmed Supabase login, with no public User, ECL profile or tournament registration. The manual entry attaches to that existing login; no new auth account, password, invitation or email was created. His profile uses his own supplied Riot ID and KOOK identity. The jungle role follows the outgoing roster slot. Verification is an owner-authorized manual entry, not a claimed automatic Lzyumi or site-signup check.

The transaction backed up the outgoing registration and roster, preserved Doolittlesy's Hub profile, withdrew his unused tournament entry, created Biaomei's main-pool entry, reused the drafted member slot and assigned captaincy to Shidian. Biaomei's consent timestamp records the owner's confirmation at manual entry; it does not assert that he clicked the website consent form. The outgoing registration's consent/version evidence is retained in the private audit and manual match evidence.

There remain **25 main players, five Phoenix players and 25 team memberships**. Other registrations, existing profiles, inhouse matches, ratings and report jobs matched their before/after fingerprints. No schema change or trigger disabling was needed; the registration guard remains enabled. No KOOK messages were sent.

The website roster now uses the stored captain flag instead of the original draft pot. Shidian is shown first as captain while retaining Pot 02; the incoming player in the original captain's slot is labelled Replacement. The website dashboard layout is preserved. Existing Hub apps receive roster/captain changes through automatic data refresh.

Private evidence: `.tmp/biaomei-manual-entry-result.json`, `.tmp/phoenix-biaomei-replacement-before.json`, and the local onboarding preflight. Personal email and KOOK identifiers are intentionally excluded from this document.

## BB vs Phoenix report

Owner supplied two Lzyumi scoreboard screenshots for **RR01**, game ID **11436337984**. They show a BallBreakers victory on 3 November, **30:42**, with **Epifanio MVP**. All ten Riot IDs now map to the correct tournament players, including Biaomei. Screenshot KDA totals are BB 40/28/79 and Phoenix 27/40/42; the single extra BB death is retained as shown rather than forced to match opposing kills.

The text attachment was zero bytes when read. The manual report therefore uses the screenshots' exact KDA and champions. Rounded individual damage/gold are not converted into invented exact values; item IDs are not guessed. The report is prepared for pending review and is not automatically published by the roster change.

Validation: focused client tests pass, including captain reassignment with preserved pots; isolated production build passes. Live registration/roster and pending report status are checked after the change.
