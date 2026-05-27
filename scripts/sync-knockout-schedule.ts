import { prisma } from "@/lib/prisma";
import { syncKnockoutBracketToSchedule } from "@/lib/knockout-schedule";

async function main() {
  const result = await syncKnockoutBracketToSchedule(prisma);
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
