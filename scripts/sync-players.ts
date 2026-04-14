import { prisma } from "@/lib/prisma";
import { syncAllPlayers } from "@/lib/player-sync";

async function main() {
  const result = await syncAllPlayers();
  console.log("🎉 Sync complete:", result);
}

main()
  .catch((error) => {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });