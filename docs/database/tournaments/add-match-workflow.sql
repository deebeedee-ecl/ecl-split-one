-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "captain_profile_id" TEXT NOT NULL,

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_members" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "pot" INTEGER,

    CONSTRAINT "tournament_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_fixtures" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
    "week" INTEGER NOT NULL,
    "best_of" INTEGER NOT NULL DEFAULT 1,
    "pair_key" TEXT NOT NULL,
    "home_team_id" TEXT NOT NULL,
    "away_team_id" TEXT NOT NULL,
    "schedule" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tournament_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_reports" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "game_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "league_game_id" TEXT,
    "payload" JSONB NOT NULL,
    "raw" JSONB,
    "evidence" JSONB,
    "review_note" TEXT,
    "replaces_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),

    CONSTRAINT "tournament_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_floater_appearances" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,

    CONSTRAINT "tournament_floater_appearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_notifications" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "delivery_key" TEXT,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_collection_jobs" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "league_game_id" TEXT NOT NULL,
    "game_number" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "report_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tournament_collection_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_tournament_id_key_key" ON "tournament_teams"("tournament_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_id_tournament_id_key" ON "tournament_teams"("id", "tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_members_tournament_id_profile_id_key" ON "tournament_members"("tournament_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_fixtures_tournament_id_code_key" ON "tournament_fixtures"("tournament_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_fixtures_tournament_id_stage_pair_key_key" ON "tournament_fixtures"("tournament_id", "stage", "pair_key");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_fixtures_id_tournament_id_key" ON "tournament_fixtures"("id", "tournament_id");

-- CreateIndex
CREATE INDEX "tournament_reports_tournament_id_status_idx" ON "tournament_reports"("tournament_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_reports_id_tournament_id_key" ON "tournament_reports"("id", "tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_floater_appearances_tournament_id_team_id_profil_key" ON "tournament_floater_appearances"("tournament_id", "team_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_notifications_dedupe_key_key" ON "tournament_notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "tournament_notifications_status_next_attempt_at_idx" ON "tournament_notifications"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "tournament_collection_jobs_profile_id_status_expires_at_idx" ON "tournament_collection_jobs"("profile_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_collection_jobs_fixture_id_profile_id_league_gam_key" ON "tournament_collection_jobs"("fixture_id", "profile_id", "league_game_id", "game_number");

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_captain_profile_id_fkey" FOREIGN KEY ("captain_profile_id") REFERENCES "AccountProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_members" ADD CONSTRAINT "tournament_members_team_id_tournament_id_fkey" FOREIGN KEY ("team_id", "tournament_id") REFERENCES "tournament_teams"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tournament_members" ADD CONSTRAINT "tournament_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "AccountProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_members" ADD CONSTRAINT "tournament_members_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "tournament_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_fixtures" ADD CONSTRAINT "tournament_fixtures_home_team_id_tournament_id_fkey" FOREIGN KEY ("home_team_id", "tournament_id") REFERENCES "tournament_teams"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tournament_fixtures" ADD CONSTRAINT "tournament_fixtures_away_team_id_tournament_id_fkey" FOREIGN KEY ("away_team_id", "tournament_id") REFERENCES "tournament_teams"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tournament_reports" ADD CONSTRAINT "tournament_reports_fixture_id_tournament_id_fkey" FOREIGN KEY ("fixture_id", "tournament_id") REFERENCES "tournament_fixtures"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tournament_floater_appearances" ADD CONSTRAINT "tournament_floater_appearances_team_id_tournament_id_fkey" FOREIGN KEY ("team_id", "tournament_id") REFERENCES "tournament_teams"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tournament_floater_appearances" ADD CONSTRAINT "tournament_floater_appearances_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "AccountProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_floater_appearances" ADD CONSTRAINT "tournament_floater_appearances_report_id_tournament_id_fkey" FOREIGN KEY ("report_id", "tournament_id") REFERENCES "tournament_reports"("id", "tournament_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tournament_notifications" ADD CONSTRAINT "tournament_notifications_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_collection_jobs" ADD CONSTRAINT "tournament_collection_jobs_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
