import { prisma } from "@/lib/prisma";

async function main() {
  await prisma.matchGamePlayerStat.deleteMany({});

  await prisma.player.updateMany({
    data: {
      elo: 1000,
      winStreak: 0,
      lossStreak: 0,
    },
  });

  console.log("Leaderboard reset complete.");
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });