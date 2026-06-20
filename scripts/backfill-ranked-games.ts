import { prisma } from "@/lib/prisma";
import { fetchLzyumiRankedGames } from "@/lib/lzyumi";
import { Prisma } from "@prisma/client";

async function main() {
  const profiles = await prisma.accountProfile.findMany({
    select: {
      id: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      lzyumiRankedGames: true,
    },
  });

  console.log(`Found ${profiles.length} profile(s)`);

  for (const p of profiles) {
    console.log(`\n--- ${p.riotName}#${p.riotTag} ---`);
    console.log("chinaServerId:", p.chinaServerId);
    console.log("lzyumiRankedGames currently:", p.lzyumiRankedGames === null ? "NULL" : "HAS DATA");

    if (!p.chinaServerId) {
      console.log("Skipping — no chinaServerId");
      continue;
    }

    try {
      const rankedGames = await fetchLzyumiRankedGames({
        riotName: p.riotName,
        areaId: p.chinaServerId,
      });

      console.log("soloGames fetched:", rankedGames.soloGames.length);
      console.log("flexGames fetched:", rankedGames.flexGames.length);

      if (rankedGames.soloGames.length > 0) {
        console.log("Solo game[0] title:", rankedGames.soloGames[0].title?.slice(0, 50));
      }
      if (rankedGames.flexGames.length > 0) {
        console.log("Flex game[0] title:", rankedGames.flexGames[0].title?.slice(0, 50));
      }

      await prisma.accountProfile.update({
        where: { id: p.id },
        data: {
          lzyumiRankedGames: rankedGames as Prisma.InputJsonValue,
          lzyumiLastLookupAt: new Date(),
        },
      });

      console.log("✓ Saved to DB");
    } catch (err) {
      console.error("Error fetching ranked games:", err);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
