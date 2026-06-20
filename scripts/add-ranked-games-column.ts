import { prisma } from "@/lib/prisma";

async function main() {
  // Use raw SQL to add the column if it doesn't exist
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AccountProfile" ADD COLUMN IF NOT EXISTS "lzyumiRankedGames" JSONB
  `);
  console.log("Column lzyumiRankedGames ensured.");

  // Verify all lzyumi columns
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'AccountProfile' AND column_name LIKE 'lzyumi%'
    ORDER BY column_name
  `);
  console.log("All lzyumi columns:", cols.map((r) => r.column_name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
