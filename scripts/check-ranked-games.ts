import { prisma } from "@/lib/prisma";

async function main() {
  const profiles = await prisma.accountProfile.findMany({
    select: {
      id: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      openId: true,
      lzyumiRankedGames: true,
      lzyumiLastLookupAt: true,
    },
  });

  for (const p of profiles) {
    console.log(`\n--- ${p.riotName}#${p.riotTag} ---`);
    console.log("chinaServerId:", p.chinaServerId);
    console.log("openId:", p.openId ? p.openId.slice(0, 10) + "..." : null);
    console.log("lzyumiLastLookupAt:", p.lzyumiLastLookupAt);
    console.log("lzyumiRankedGames:", p.lzyumiRankedGames === null ? "NULL" : typeof p.lzyumiRankedGames === "object" ? JSON.stringify(p.lzyumiRankedGames).slice(0, 200) : p.lzyumiRankedGames);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
