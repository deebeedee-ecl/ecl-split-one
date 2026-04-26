import { prisma } from "@/lib/prisma";

async function main() {
  const count = await prisma.matchGamePlayerStat.count();
  console.log("MatchGamePlayerStat count:", count);

  const sample = await prisma.player.findMany({
    where: {
      gameStats: {
        some: {},
      },
    },
    select: {
      name: true,
      elo: true,
      winStreak: true,
      lossStreak: true,
      _count: {
        select: {
          gameStats: true,
        },
      },
    },
    take: 20,
  });

  console.log(sample);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });