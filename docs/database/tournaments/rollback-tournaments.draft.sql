-- DRAFT FOR REVIEW. Remove only the new, unused foundation.
-- This deliberately refuses to erase even one registration/consent record.
-- Once live signups exist, preserve/export data and design a forward fix instead.
BEGIN;
LOCK TABLE public.tournaments, public.tournament_registrations IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tournament_registrations) THEN
    RAISE EXCEPTION 'Rollback refused: preserve existing tournament registrations';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournaments WHERE slug <> 'ecl-split-ii-2026') THEN
    RAISE EXCEPTION 'Rollback refused: other tournament configurations exist';
  END IF;
END;
$$;

DROP TABLE public.tournament_registrations;
DROP TABLE public.tournaments;
DROP FUNCTION public.guard_tournament_registration();
DROP FUNCTION public.guard_tournament_capacity_update();
DROP TYPE public."TournamentStatus";
COMMIT;
