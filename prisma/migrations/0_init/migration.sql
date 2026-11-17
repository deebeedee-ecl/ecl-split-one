BEGIN;
SET LOCAL search_path = public, pg_catalog;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('REGULAR_SEASON', 'PLAYOFFS', 'SEMIFINALS', 'FINALS');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'FORFEIT', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING_KOOK', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "KookVerificationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "riotName" TEXT NOT NULL,
    "riotTag" TEXT NOT NULL,
    "chinaServerId" INTEGER,
    "chinaServerName" TEXT,
    "openId" TEXT,
    "lzyumiVerifiedAt" TIMESTAMP(3),
    "lzyumiLastLookupAt" TIMESTAMP(3),
    "lzyumiRawProfile" JSONB,
    "lzyumiRecentStat" JSONB,
    "lzyumiRankedGames" JSONB,
    "kookUsername" TEXT NOT NULL,
    "kookId" TEXT,
    "wechatId" TEXT,
    "primaryRole" TEXT NOT NULL,
    "secondaryRole" TEXT,
    "currentRank" TEXT,
    "nationality" TEXT,
    "timezone" TEXT,
    "bio" TEXT,
    "avatarStyle" TEXT NOT NULL DEFAULT 'crest',
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "dashboardTheme" TEXT NOT NULL DEFAULT 'crimson',
    "championPool" JSONB,
    "privacySettings" JSONB,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING_KOOK',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountProfile_pkey" PRIMARY KEY ("id")
);

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
    "floaters_open" BOOLEAN NOT NULL DEFAULT false,
    "floater_rules_version" TEXT,
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
    "pool" TEXT NOT NULL DEFAULT 'MAIN',
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

-- CreateTable
CREATE TABLE "LzyumiRefreshQueue" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LzyumiRefreshQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KookVerification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "KookVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "kookUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KookVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "kitUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "riotName" TEXT,
    "riotTag" TEXT,
    "email" TEXT,
    "teamId" TEXT,
    "elo" INTEGER NOT NULL DEFAULT 800,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "lossStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeAgentRegistration" (
    "id" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "riotName" TEXT NOT NULL,
    "riotTag" TEXT NOT NULL,
    "primaryRole" TEXT NOT NULL,
    "secondaryRole" TEXT,
    "currentRank" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signedToTeamId" TEXT,
    "signedToTeamName" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeAgentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRegistration" (
    "id" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "captainName" TEXT NOT NULL,
    "captainEmail" TEXT NOT NULL,
    "players" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueWireItem" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "href" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueWireItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "stage" "MatchStage" NOT NULL,
    "roundLabel" TEXT,
    "matchLabel" TEXT,
    "bestOf" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "winnerTeamId" TEXT,
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "forfeitWinnerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchGame" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "winnerTeamId" TEXT,
    "durationSeconds" INTEGER,
    "homeKills" INTEGER,
    "awayKills" INTEGER,
    "homeGold" INTEGER,
    "awayGold" INTEGER,
    "homeTowers" INTEGER,
    "awayTowers" INTEGER,
    "homeInhibitors" INTEGER,
    "awayInhibitors" INTEGER,
    "homeBarons" INTEGER,
    "awayBarons" INTEGER,
    "homeDrakes" INTEGER,
    "awayDrakes" INTEGER,
    "mvpName" TEXT,
    "notes" TEXT,
    "ocrRawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchGamePlayerStat" (
    "id" TEXT NOT NULL,
    "matchGameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "riotName" TEXT,
    "riotTag" TEXT,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER,
    "damage" INTEGER,
    "cs" INTEGER,
    "visionScore" INTEGER,
    "isWin" BOOLEAN NOT NULL DEFAULT false,
    "isMVP" BOOLEAN NOT NULL DEFAULT false,
    "isSVP" BOOLEAN NOT NULL DEFAULT false,
    "lpChange" INTEGER NOT NULL DEFAULT 0,
    "eloBefore" INTEGER,
    "eloAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchGamePlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InhouseSession" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "gameLabel" TEXT,
    "sourceChannelId" TEXT NOT NULL,
    "blueChannelId" TEXT NOT NULL,
    "redChannelId" TEXT NOT NULL,
    "blueTeamId" TEXT,
    "redTeamId" TEXT,
    "matchId" TEXT,
    "matchGameId" TEXT,
    "lzyumiGameId" TEXT,
    "reportedByKookId" TEXT,
    "reportRawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InhouseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InhouseSessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kookUserId" TEXT NOT NULL,
    "profileId" TEXT,
    "playerId" TEXT,
    "displayName" TEXT NOT NULL,
    "riotName" TEXT,
    "riotTag" TEXT,
    "email" TEXT,
    "side" TEXT NOT NULL,
    "eloAtReady" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InhouseSessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InhouseReportJob" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestedByKookId" TEXT NOT NULL,
    "responseChannelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "rawMatchData" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InhouseReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AccountProfile_userId_key" ON "AccountProfile"("userId");

-- CreateIndex
CREATE INDEX "AccountProfile_email_idx" ON "AccountProfile"("email");

-- CreateIndex
CREATE INDEX "AccountProfile_riotName_riotTag_idx" ON "AccountProfile"("riotName", "riotTag");

-- CreateIndex
CREATE INDEX "AccountProfile_chinaServerId_riotName_riotTag_idx" ON "AccountProfile"("chinaServerId", "riotName", "riotTag");

-- CreateIndex
CREATE INDEX "AccountProfile_openId_idx" ON "AccountProfile"("openId");

-- CreateIndex
CREATE INDEX "AccountProfile_kookUsername_idx" ON "AccountProfile"("kookUsername");

-- CreateIndex
CREATE INDEX "AccountProfile_verificationStatus_idx" ON "AccountProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "AccountProfile_accountStatus_idx" ON "AccountProfile"("accountStatus");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournament_registrations_tournament_id_registered_at_id_idx" ON "tournament_registrations"("tournament_id", "registered_at", "id");

-- CreateIndex
CREATE INDEX "tournament_registrations_pool_order_idx" ON "tournament_registrations"("tournament_id", "pool", "registered_at", "id");

-- CreateIndex
CREATE INDEX "tournament_registrations_profile_id_idx" ON "tournament_registrations"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_profile_id_key" ON "tournament_registrations"("tournament_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_game_identity_key_key" ON "tournament_registrations"("tournament_id", "game_identity_key");

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

-- CreateIndex
CREATE UNIQUE INDEX "LzyumiRefreshQueue_profileId_key" ON "LzyumiRefreshQueue"("profileId");

-- CreateIndex
CREATE INDEX "LzyumiRefreshQueue_status_nextAttemptAt_idx" ON "LzyumiRefreshQueue"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "LzyumiRefreshQueue_attemptCount_idx" ON "LzyumiRefreshQueue"("attemptCount");

-- CreateIndex
CREATE INDEX "LzyumiRefreshQueue_notifiedAt_idx" ON "LzyumiRefreshQueue"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KookVerification_code_key" ON "KookVerification"("code");

-- CreateIndex
CREATE INDEX "KookVerification_profileId_idx" ON "KookVerification"("profileId");

-- CreateIndex
CREATE INDEX "KookVerification_code_idx" ON "KookVerification"("code");

-- CreateIndex
CREATE INDEX "KookVerification_status_idx" ON "KookVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Player_riotName_riotTag_idx" ON "Player"("riotName", "riotTag");

-- CreateIndex
CREATE INDEX "ContactMessage_status_idx" ON "ContactMessage"("status");

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Match_stage_idx" ON "Match"("stage");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_scheduledAt_idx" ON "Match"("scheduledAt");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE INDEX "MatchGame_matchId_idx" ON "MatchGame"("matchId");

-- CreateIndex
CREATE INDEX "MatchGame_winnerTeamId_idx" ON "MatchGame"("winnerTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchGame_matchId_gameNumber_key" ON "MatchGame"("matchId", "gameNumber");

-- CreateIndex
CREATE INDEX "MatchGamePlayerStat_matchGameId_idx" ON "MatchGamePlayerStat"("matchGameId");

-- CreateIndex
CREATE INDEX "MatchGamePlayerStat_playerId_idx" ON "MatchGamePlayerStat"("playerId");

-- CreateIndex
CREATE INDEX "MatchGamePlayerStat_teamId_idx" ON "MatchGamePlayerStat"("teamId");

-- CreateIndex
CREATE INDEX "MatchGamePlayerStat_isWin_idx" ON "MatchGamePlayerStat"("isWin");

-- CreateIndex
CREATE INDEX "MatchGamePlayerStat_isMVP_idx" ON "MatchGamePlayerStat"("isMVP");

-- CreateIndex
CREATE UNIQUE INDEX "MatchGamePlayerStat_matchGameId_playerId_key" ON "MatchGamePlayerStat"("matchGameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "InhouseSession_lzyumiGameId_key" ON "InhouseSession"("lzyumiGameId");

-- CreateIndex
CREATE INDEX "InhouseSession_status_idx" ON "InhouseSession"("status");

-- CreateIndex
CREATE INDEX "InhouseSession_createdAt_idx" ON "InhouseSession"("createdAt");

-- CreateIndex
CREATE INDEX "InhouseSession_reportedByKookId_idx" ON "InhouseSession"("reportedByKookId");

-- CreateIndex
CREATE INDEX "InhouseSessionPlayer_sessionId_idx" ON "InhouseSessionPlayer"("sessionId");

-- CreateIndex
CREATE INDEX "InhouseSessionPlayer_kookUserId_idx" ON "InhouseSessionPlayer"("kookUserId");

-- CreateIndex
CREATE INDEX "InhouseSessionPlayer_playerId_idx" ON "InhouseSessionPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "InhouseSessionPlayer_sessionId_kookUserId_key" ON "InhouseSessionPlayer"("sessionId", "kookUserId");

-- CreateIndex
CREATE INDEX "InhouseReportJob_status_createdAt_idx" ON "InhouseReportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InhouseReportJob_sessionId_idx" ON "InhouseReportJob"("sessionId");

-- CreateIndex
CREATE INDEX "InhouseReportJob_requestedByKookId_idx" ON "InhouseReportJob"("requestedByKookId");

-- CreateIndex
CREATE INDEX "InhouseReportJob_lockedAt_idx" ON "InhouseReportJob"("lockedAt");

-- AddForeignKey
ALTER TABLE "AccountProfile" ADD CONSTRAINT "AccountProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "AccountProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "LzyumiRefreshQueue" ADD CONSTRAINT "LzyumiRefreshQueue_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AccountProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KookVerification" ADD CONSTRAINT "KookVerification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AccountProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeAgentRegistration" ADD CONSTRAINT "FreeAgentRegistration_signedToTeamId_fkey" FOREIGN KEY ("signedToTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchGame" ADD CONSTRAINT "MatchGame_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchGame" ADD CONSTRAINT "MatchGame_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchGamePlayerStat" ADD CONSTRAINT "MatchGamePlayerStat_matchGameId_fkey" FOREIGN KEY ("matchGameId") REFERENCES "MatchGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchGamePlayerStat" ADD CONSTRAINT "MatchGamePlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchGamePlayerStat" ADD CONSTRAINT "MatchGamePlayerStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InhouseSessionPlayer" ADD CONSTRAINT "InhouseSessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InhouseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InhouseReportJob" ADD CONSTRAINT "InhouseReportJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InhouseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve production constraints that Prisma cannot represent.
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
  ),
  ADD CONSTRAINT tournament_registration_pool_valid CHECK (
    pool IN ('MAIN', 'FLOATER')
  );

ALTER TABLE public.tournament_members
  ADD CONSTRAINT tournament_member_pot CHECK (pot IS NULL OR pot BETWEEN 1 AND 5);

ALTER TABLE public.tournament_fixtures
  ADD CONSTRAINT tournament_fixture_shape CHECK (
    home_team_id <> away_team_id
    AND best_of IN (1, 3, 5)
    AND week > 0
    AND revision >= 0
    AND stage IN ('ROUND_ROBIN', 'SEMIFINAL', 'FINAL', 'TIEBREAKER')
  );

ALTER TABLE public.tournament_reports
  ADD CONSTRAINT tournament_report_shape CHECK (
    game_number BETWEEN 1 AND 5
    AND status IN ('PENDING', 'APPROVED', 'REJECTED', 'REPLACED')
    AND source IN ('MANUAL', 'JSON', 'HUB')
    AND platform ~ '^[A-Z0-9]{2,12}$'
    AND (league_game_id IS NULL OR league_game_id ~ '^[0-9]{5,20}$')
    AND jsonb_typeof(payload) = 'object'
  );

ALTER TABLE public.tournament_notifications
  ADD CONSTRAINT tournament_notification_shape CHECK (
    status IN ('PENDING', 'SENDING', 'SENT', 'UNKNOWN', 'FAILED')
    AND attempts BETWEEN 0 AND 8
    AND length(content) BETWEEN 1 AND 3500
    AND channel_id ~ '^[0-9]{1,30}$'
  );

ALTER TABLE public.tournament_collection_jobs
  ADD CONSTRAINT tournament_collection_shape CHECK (
    status IN ('PENDING', 'UPLOADED', 'CANCELLED')
    AND league_game_id ~ '^[0-9]{5,20}$'
    AND game_number BETWEEN 1 AND 5
    AND expires_at > created_at
  ),
  ADD CONSTRAINT tournament_collection_fixture
    FOREIGN KEY (fixture_id, tournament_id)
    REFERENCES public.tournament_fixtures(id, tournament_id),
  ADD CONSTRAINT tournament_collection_profile
    FOREIGN KEY (profile_id)
    REFERENCES public."AccountProfile"(id),
  ADD CONSTRAINT tournament_collection_report
    FOREIGN KEY (report_id, tournament_id)
    REFERENCES public.tournament_reports(id, tournament_id);

CREATE UNIQUE INDEX tournament_one_approved_game
  ON public.tournament_reports(fixture_id, game_number)
  WHERE status = 'APPROVED';

CREATE UNIQUE INDEX tournament_unique_league_game
  ON public.tournament_reports(platform, league_game_id)
  WHERE status = 'APPROVED' AND league_game_id IS NOT NULL;

-- Preserve the final production tournament guards.
CREATE FUNCTION public.guard_tournament_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  event public.tournaments%ROWTYPE;
  occupied bigint;
  main_capacity integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Tournament registration snapshots are immutable'
      USING ERRCODE = '23514';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Tournament registration requires READ COMMITTED isolation'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO event FROM public.tournaments
    WHERE id = NEW.tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = '23503';
  END IF;
  IF NEW.terms_version IS DISTINCT FROM event.terms_version THEN
    RAISE EXCEPTION 'Tournament consent versions have changed'
      USING ERRCODE = '23514';
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
    main_capacity := CASE
      WHEN event.slug = 'ecl-split-ii-2026' THEN LEAST(event.capacity, 25)
      ELSE event.capacity
    END;
    SELECT count(*) INTO occupied FROM public.tournament_registrations
      WHERE tournament_id = NEW.tournament_id AND pool = 'MAIN';
    IF occupied >= main_capacity THEN
      RAISE EXCEPTION 'Tournament capacity reached' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.pool = 'FLOATER' THEN
    IF NOT event.floaters_open
      OR event.status NOT IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS') THEN
      RAISE EXCEPTION 'Floater registration is closed' USING ERRCODE = '23514';
    END IF;
    IF event.floater_rules_version IS NULL
      OR NEW.rules_version IS DISTINCT FROM event.floater_rules_version THEN
      RAISE EXCEPTION 'Floater consent versions have changed' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid tournament player pool' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

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
  IF NEW.capacity < (
    SELECT count(*) FROM public.tournament_registrations
    WHERE tournament_id = NEW.id AND pool = 'MAIN'
  ) THEN
    RAISE EXCEPTION 'Capacity cannot be lower than existing main registrations'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tournament_member_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_registrations r
    WHERE r.id = NEW.registration_id
      AND r.tournament_id = NEW.tournament_id
      AND r.profile_id = NEW.profile_id
      AND r.pool = 'MAIN'
  ) THEN
    RAISE EXCEPTION 'Tournament membership requires the matching main registration';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tournament_floater_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_registrations r
    WHERE r.tournament_id = NEW.tournament_id
      AND r.profile_id = NEW.profile_id
      AND r.pool = 'FLOATER'
  ) THEN
    RAISE EXCEPTION 'Not a tournament floater';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_reports r
    JOIN public.tournament_fixtures f ON f.id = r.fixture_id
    WHERE r.id = NEW.report_id
      AND r.tournament_id = NEW.tournament_id
      AND r.status = 'APPROVED'
      AND NEW.team_id IN (f.home_team_id, f.away_team_id)
  ) THEN
    RAISE EXCEPTION 'Invalid floater match assignment';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.reject_tournament_game_in_legacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  source jsonb;
  game_id text;
BEGIN
  IF TG_TABLE_NAME = 'InhouseSession' THEN
    game_id := NEW."lzyumiGameId";
  ELSIF TG_TABLE_NAME = 'InhouseReportJob' THEN
    source := NEW."rawMatchData";
  ELSE
    source := NEW."ocrRawJson";
  END IF;
  game_id := COALESCE(game_id, source->>'gameId', source#>>'{raw,gameId}');
  IF game_id ~ '^[0-9]{5,20}$' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('HN1:' || game_id, 0));
    IF EXISTS (
      SELECT 1 FROM public.tournament_reports
      WHERE platform = 'HN1'
        AND league_game_id = game_id
        AND status = 'APPROVED'
    ) THEN
      RAISE EXCEPTION 'League game already approved in separate tournament workflow';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournament_registration_guard
BEFORE INSERT OR UPDATE ON public.tournament_registrations
FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_registration();

CREATE TRIGGER tournament_capacity_update_guard
BEFORE UPDATE OF capacity ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_capacity_update();

CREATE TRIGGER tournament_member_scope_guard
BEFORE INSERT OR UPDATE ON public.tournament_members
FOR EACH ROW EXECUTE FUNCTION public.tournament_member_scope_guard();

CREATE TRIGGER tournament_floater_scope_guard
BEFORE INSERT OR UPDATE ON public.tournament_floater_appearances
FOR EACH ROW EXECUTE FUNCTION public.tournament_floater_scope_guard();

CREATE TRIGGER tournament_legacy_game_guard
BEFORE INSERT OR UPDATE OF "ocrRawJson" ON public."MatchGame"
FOR EACH ROW EXECUTE FUNCTION public.reject_tournament_game_in_legacy();

CREATE TRIGGER tournament_legacy_report_guard
BEFORE INSERT OR UPDATE OF "rawMatchData" ON public."InhouseReportJob"
FOR EACH ROW EXECUTE FUNCTION public.reject_tournament_game_in_legacy();

CREATE TRIGGER tournament_legacy_session_guard
BEFORE INSERT OR UPDATE OF "lzyumiGameId" ON public."InhouseSession"
FOR EACH ROW EXECUTE FUNCTION public.reject_tournament_game_in_legacy();

-- Browser roles keep no direct access to tournament-owned tables.
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_floater_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_collection_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.tournaments,
  public.tournament_registrations,
  public.tournament_teams,
  public.tournament_members,
  public.tournament_fixtures,
  public.tournament_reports,
  public.tournament_floater_appearances,
  public.tournament_notifications,
  public.tournament_collection_jobs
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.guard_tournament_registration(),
  public.guard_tournament_capacity_update(),
  public.tournament_member_scope_guard(),
  public.tournament_floater_scope_guard(),
  public.reject_tournament_game_in_legacy()
FROM PUBLIC, anon, authenticated;

COMMIT;
