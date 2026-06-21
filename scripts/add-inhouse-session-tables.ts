import { prisma } from "@/lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InhouseSession" (
      "id" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InhouseSession_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InhouseSessionPlayer" (
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
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "InhouseSession_lzyumiGameId_key"
      ON "InhouseSession"("lzyumiGameId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InhouseSession_status_idx"
      ON "InhouseSession"("status");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InhouseSession_createdAt_idx"
      ON "InhouseSession"("createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InhouseSession_reportedByKookId_idx"
      ON "InhouseSession"("reportedByKookId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "InhouseSessionPlayer_sessionId_kookUserId_key"
      ON "InhouseSessionPlayer"("sessionId", "kookUserId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InhouseSessionPlayer_sessionId_idx"
      ON "InhouseSessionPlayer"("sessionId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InhouseSessionPlayer_kookUserId_idx"
      ON "InhouseSessionPlayer"("kookUserId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InhouseSessionPlayer_playerId_idx"
      ON "InhouseSessionPlayer"("playerId");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'InhouseSessionPlayer_sessionId_fkey'
      ) THEN
        ALTER TABLE "InhouseSessionPlayer"
          ADD CONSTRAINT "InhouseSessionPlayer_sessionId_fkey"
          FOREIGN KEY ("sessionId")
          REFERENCES "InhouseSession"("id")
          ON DELETE CASCADE
          ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  console.log("Inhouse session tables are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
