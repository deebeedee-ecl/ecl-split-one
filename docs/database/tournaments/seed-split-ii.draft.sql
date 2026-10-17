-- DRAFT FOR REVIEW. Creates only the event configuration, never registrations.
-- Dates confirmed by the user. Keep registration closed in DRAFT status;
-- the separate scheduled-opening step requires final release approval.
BEGIN;

INSERT INTO public.tournaments (
  id, slug, name, year, tagline, status, capacity, team_formation,
  first_prize_rmb, draft_date, starts_on, ends_on, timezone,
  terms_version, rules_version, registration_opens_at, updated_at
) VALUES (
  gen_random_uuid()::text, 'ecl-split-ii-2026', 'ECL Split II: Draft', 2026,
  'AGAINST ALL ODDS', 'DRAFT', 30, 'LOTTERY_DRAFT',
  3000, DATE '2026-10-23', DATE '2026-10-24', DATE '2026-11-20', 'Asia/Shanghai',
  'ecl-terms-2026-10-16', 'split-ii-registration-2026-10-16',
  TIMESTAMPTZ '2026-10-17 00:00:00+08', CURRENT_TIMESTAMP
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
