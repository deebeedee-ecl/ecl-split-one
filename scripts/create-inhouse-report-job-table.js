const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const statements = [
  `
  CREATE TABLE IF NOT EXISTS "InhouseReportJob" (
    "id" TEXT PRIMARY KEY,
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
    CONSTRAINT "InhouseReportJob_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "InhouseSession"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS "InhouseReportJob_status_createdAt_idx" ON "InhouseReportJob"("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "InhouseReportJob_sessionId_idx" ON "InhouseReportJob"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "InhouseReportJob_requestedByKookId_idx" ON "InhouseReportJob"("requestedByKookId")`,
  `CREATE INDEX IF NOT EXISTS "InhouseReportJob_lockedAt_idx" ON "InhouseReportJob"("lockedAt")`,
];

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log("InhouseReportJob table ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
