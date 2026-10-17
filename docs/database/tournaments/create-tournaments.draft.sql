-- DRAFT FOR REVIEW. Not applied to any database.
-- Generated from local Prisma datamodels, with constraints/security appended below.
-- Apply only after the isolated PostgreSQL checks in README.md and explicit approval.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "tagline" TEXT,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "team_formation" TEXT NOT NULL DEFAULT 'LOTTERY_DRAFT',
    "first_prize_rmb" INTEGER NOT NULL DEFAULT 0,
    "draft_date" DATE,
    "starts_on" DATE,
    "ends_on" DATE,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "registration_opens_at" TIMESTAMPTZ(3),
    "registration_closes_at" TIMESTAMPTZ(3),
    "terms_version" TEXT,
    "rules_version" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_registrations" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "display_name_snapshot" TEXT NOT NULL,
    "primary_role_snapshot" TEXT NOT NULL,
    "secondary_role_snapshot" TEXT,
    "riot_name_snapshot" TEXT NOT NULL,
    "riot_tag_snapshot" TEXT NOT NULL,
    "china_server_id_snapshot" INTEGER,
    "game_identity_key" TEXT,
    "terms_version" TEXT NOT NULL,
    "rules_version" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ(3) NOT NULL,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournament_registrations_tournament_id_registered_at_id_idx" ON "tournament_registrations"("tournament_id", "registered_at", "id");

-- CreateIndex
CREATE INDEX "tournament_registrations_profile_id_idx" ON "tournament_registrations"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_profile_id_key" ON "tournament_registrations"("tournament_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_game_identity_key_key" ON "tournament_registrations"("tournament_id", "game_identity_key");

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "AccountProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- These checks and triggers are not expressed by the Prisma datamodel.
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_capacity_positive CHECK (capacity > 0),
  ADD CONSTRAINT tournaments_prize_nonnegative CHECK (first_prize_rmb >= 0),
  ADD CONSTRAINT tournaments_dates_ordered CHECK (
    (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on)
    AND (draft_date IS NULL OR starts_on IS NULL OR draft_date <= starts_on)
  ),
  ADD CONSTRAINT tournaments_registration_window_ordered CHECK (
    registration_opens_at IS NULL OR registration_closes_at IS NULL
    OR registration_opens_at < registration_closes_at
  ),
  ADD CONSTRAINT tournaments_open_requires_rules CHECK (
    status <> 'REGISTRATION_OPEN'
    OR (NULLIF(btrim(terms_version), '') IS NOT NULL
        AND NULLIF(btrim(rules_version), '') IS NOT NULL)
  );

ALTER TABLE public.tournament_registrations
  ADD CONSTRAINT tournament_registrations_required_snapshots CHECK (
    btrim(display_name_snapshot) <> '' AND btrim(primary_role_snapshot) <> ''
    AND btrim(riot_name_snapshot) <> '' AND btrim(riot_tag_snapshot) <> ''
    AND btrim(terms_version) <> '' AND btrim(rules_version) <> ''
  ),
  ADD CONSTRAINT tournament_registrations_identity_nonempty CHECK (
    game_identity_key IS NULL OR btrim(game_identity_key) <> ''
  ),
  ADD CONSTRAINT tournament_registrations_consent_ordered CHECK (
    consented_at <= registered_at
  );

-- Only the trusted server uses these tables. Browser roles get no direct access.
-- Confirm that the Prisma backend role owns the tables or has BYPASSRLS and
-- explicit table privileges; do not solve backend access by exposing these tables.
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tournaments, public.tournament_registrations
  FROM PUBLIC, anon, authenticated;

-- All inserts, including privileged SQL inserts, serialize on the event row.
-- Under READ COMMITTED the count is a separate query after obtaining the lock.
CREATE FUNCTION public.guard_tournament_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  event public.tournaments%ROWTYPE;
  occupied bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Tournament registration snapshots are immutable'
      USING ERRCODE = '23514';
  END IF;

  -- This draft algorithm requires READ COMMITTED; fail closed otherwise.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Tournament registration requires READ COMMITTED isolation'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO event FROM public.tournaments
    WHERE id = NEW.tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = '23503';
  END IF;

  IF event.status <> 'REGISTRATION_OPEN'
     OR (event.registration_opens_at IS NOT NULL AND clock_timestamp() < event.registration_opens_at)
     OR (event.registration_closes_at IS NOT NULL AND clock_timestamp() >= event.registration_closes_at) THEN
    RAISE EXCEPTION 'Tournament registration is closed' USING ERRCODE = '23514';
  END IF;

  IF NEW.terms_version IS DISTINCT FROM event.terms_version
     OR NEW.rules_version IS DISTINCT FROM event.rules_version THEN
    RAISE EXCEPTION 'Tournament consent versions have changed' USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO occupied FROM public.tournament_registrations
    WHERE tournament_id = NEW.tournament_id;
  IF occupied >= event.capacity THEN
    RAISE EXCEPTION 'Tournament capacity reached' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tournament_registration_guard
BEFORE INSERT OR UPDATE ON public.tournament_registrations
FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_registration();

CREATE FUNCTION public.guard_tournament_capacity_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Tournament capacity changes require READ COMMITTED isolation'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.capacity < (SELECT count(*) FROM public.tournament_registrations WHERE tournament_id = NEW.id) THEN
    RAISE EXCEPTION 'Capacity cannot be lower than existing registrations'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournament_capacity_update_guard
BEFORE UPDATE OF capacity ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_capacity_update();

REVOKE ALL ON FUNCTION public.guard_tournament_registration(),
  public.guard_tournament_capacity_update() FROM PUBLIC, anon, authenticated;

COMMIT;
