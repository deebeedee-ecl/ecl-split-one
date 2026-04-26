import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Players:", await prisma.player.count());
  console.log("Teams:", await prisma.team.count());
  console.log("Matches:", await prisma.match.count());
  console.log("MatchGames:", await prisma.matchGame.count());
  console.log("MatchGamePlayerStats:", await prisma.matchGamePlayerStat.count());
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });