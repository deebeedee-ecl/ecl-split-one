-- Additive rollout: old entries remain MAIN with original IDs/snapshots/consent.
-- Apply before the new site; floaters remain disabled until activation.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.tournaments
  ADD COLUMN floaters_open boolean NOT NULL DEFAULT false,
  ADD COLUMN floater_rules_version text;
ALTER TABLE public.tournament_registrations
  ADD COLUMN pool text NOT NULL DEFAULT 'MAIN',
  ADD CONSTRAINT tournament_registration_pool_valid CHECK (pool IN ('MAIN', 'FLOATER'));
CREATE INDEX tournament_registrations_pool_order_idx
  ON public.tournament_registrations(tournament_id, pool, registered_at, id);

CREATE OR REPLACE FUNCTION public.guard_tournament_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE
  event public.tournaments%ROWTYPE;
  occupied bigint;
  main_capacity integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Tournament registration snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Tournament registration requires READ COMMITTED isolation' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO event FROM public.tournaments WHERE id = NEW.tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found' USING ERRCODE = '23503'; END IF;
  IF NEW.terms_version IS DISTINCT FROM event.terms_version THEN
    RAISE EXCEPTION 'Tournament consent versions have changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.pool = 'MAIN' THEN
    IF event.status <> 'REGISTRATION_OPEN'
      OR (event.registration_opens_at IS NOT NULL AND clock_timestamp() < event.registration_opens_at)
      OR (event.registration_closes_at IS NOT NULL AND clock_timestamp() >= event.registration_closes_at) THEN
      RAISE EXCEPTION 'Tournament registration is closed' USING ERRCODE = '23514';
    END IF;
    IF NEW.rules_version IS DISTINCT FROM event.rules_version THEN
      RAISE EXCEPTION 'Tournament consent versions have changed' USING ERRCODE = '23514';
    END IF;
    main_capacity := CASE WHEN event.slug = 'ecl-split-ii-2026' THEN LEAST(event.capacity, 25) ELSE event.capacity END;
    SELECT count(*) INTO occupied FROM public.tournament_registrations
      WHERE tournament_id = NEW.tournament_id AND pool = 'MAIN';
    IF occupied >= main_capacity THEN
      RAISE EXCEPTION 'Tournament capacity reached' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.pool = 'FLOATER' THEN
    IF NOT event.floaters_open OR event.status NOT IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS') THEN
      RAISE EXCEPTION 'Floater registration is closed' USING ERRCODE = '23514';
    END IF;
    IF event.floater_rules_version IS NULL OR NEW.rules_version IS DISTINCT FROM event.floater_rules_version THEN
      RAISE EXCEPTION 'Floater consent versions have changed' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid tournament player pool' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tournament_capacity_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Tournament capacity changes require READ COMMITTED isolation' USING ERRCODE = '23514';
  END IF;
  IF NEW.capacity < (SELECT count(*) FROM public.tournament_registrations WHERE tournament_id = NEW.id AND pool = 'MAIN') THEN
    RAISE EXCEPTION 'Capacity cannot be lower than existing main registrations' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
-- CREATE OR REPLACE retains the existing restricted function privileges.
COMMIT;
