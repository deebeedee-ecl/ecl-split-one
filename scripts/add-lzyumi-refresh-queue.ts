import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LzyumiRefreshQueue" (
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
      CONSTRAINT "LzyumiRefreshQueue_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "LzyumiRefreshQueue_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "AccountProfile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LzyumiRefreshQueue_profileId_key"
      ON "LzyumiRefreshQueue"("profileId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LzyumiRefreshQueue_status_nextAttemptAt_idx"
      ON "LzyumiRefreshQueue"("status", "nextAttemptAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LzyumiRefreshQueue_attemptCount_idx"
      ON "LzyumiRefreshQueue"("attemptCount");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LzyumiRefreshQueue_notifiedAt_idx"
      ON "LzyumiRefreshQueue"("notifiedAt");
  `);

  console.log("LzyumiRefreshQueue table is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
