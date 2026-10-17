-- Run only after explicit release approval, table migration and production checks.
-- Latest user confirmation: October 17 at 12:00 NOON, Asia/Shanghai.
-- An automatic closing time has not been supplied; close manually before the draw.
BEGIN;
DO $$
BEGIN
  PERFORM id FROM public.tournaments WHERE slug = 'ecl-split-ii-2026' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Split II event is missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE slug = 'ecl-split-ii-2026' AND capacity = 30
      AND terms_version = 'ecl-terms-2026-10-16'
      AND rules_version = 'split-ii-registration-2026-10-16'
      AND (
        registration_opens_at = TIMESTAMPTZ '2026-10-17 12:00:00+08'
        OR (status = 'DRAFT'
          AND registration_opens_at = TIMESTAMPTZ '2026-10-17 00:00:00+08'
          AND NOT EXISTS (SELECT 1 FROM public.tournament_registrations
            WHERE tournament_id = tournaments.id))
      )
      AND draft_date = DATE '2026-10-23' AND starts_on = DATE '2026-10-24'
      AND ends_on = DATE '2026-11-20'
      AND status IN ('DRAFT', 'REGISTRATION_OPEN')
  ) THEN
    RAISE EXCEPTION 'Split II release configuration does not match the approved schedule';
  END IF;
END;
$$;
UPDATE public.tournaments SET status = 'REGISTRATION_OPEN',
  registration_opens_at = TIMESTAMPTZ '2026-10-17 12:00:00+08', updated_at = CURRENT_TIMESTAMP
WHERE slug = 'ecl-split-ii-2026' AND status = 'DRAFT';
COMMIT;
