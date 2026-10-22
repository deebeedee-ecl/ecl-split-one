-- Run after the new site is deployed and checked. Never removes registrations.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$
DECLARE event public.tournaments%ROWTYPE;
BEGIN
  SELECT * INTO event FROM public.tournaments WHERE slug = 'ecl-split-ii-2026' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Split II not found'; END IF;
  IF event.capacity NOT IN (25, 30) OR event.status NOT IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS')
    OR event.terms_version IS DISTINCT FROM 'ecl-terms-2026-10-16'
    OR event.rules_version NOT IN ('split-ii-registration-2026-10-16', 'split-ii-registration-2026-10-22') THEN
    RAISE EXCEPTION 'Unexpected Split II configuration; review before activation';
  END IF;
  IF (SELECT count(*) FROM public.tournament_registrations WHERE tournament_id = event.id AND pool = 'MAIN') > 25 THEN
    RAISE EXCEPTION 'More than 25 main registrations; preserve entries and review';
  END IF;
  UPDATE public.tournaments SET capacity = 25,
    rules_version = 'split-ii-registration-2026-10-22',
    floater_rules_version = 'split-ii-floaters-2026-10-22', floaters_open = true,
    updated_at = CURRENT_TIMESTAMP WHERE id = event.id;
END;
$$;
COMMIT;
