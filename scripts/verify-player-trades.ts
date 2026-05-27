import { prisma } from "@/lib/prisma";

const players = ["MAD CUZ BAD", "WEILA", "DNAWENTI", "deebeedee", "BDA"];
const teamNames = [
  "Bean In Your Mum",
  "Flanmingos",
  "Make France Great Again",
  "Zycope and friends",
];

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function getRegistrationPlayerNames(playersJson: unknown) {
  if (!Array.isArray(playersJson)) return [];

  return playersJson
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return "";
      }

      const row = entry as {
        name?: string;
        playerName?: string;
        riotName?: string;
      };

      return row.playerName || row.name || row.riotName || "";
    })
    .filter(Boolean);
}

async function main() {
  const rows = await prisma.player.findMany({
    where: {
      OR: players.flatMap((player) => [
        {
          name: {
            equals: player,
            mode: "insensitive" as const,
          },
        },
        {
          riotName: {
            equals: player,
            mode: "insensitive" as const,
          },
        },
      ]),
    },
    include: {
      team: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.table(
    rows.map((player) => ({
      name: player.name,
      riotName: player.riotName,
      riotTag: player.riotTag,
      team: player.team?.name ?? null,
    }))
  );

  const registrations = await prisma.teamRegistration.findMany({
    where: {
      teamName: {
        in: teamNames,
      },
    },
    orderBy: {
      teamName: "asc",
    },
  });

  console.table(
    registrations.map((registration) => {
      const roster = getRegistrationPlayerNames(registration.players);

      return {
        team: registration.teamName,
        roster: roster.join(", "),
        trackedPlayers: players
          .filter((player) =>
            roster.some((rosterPlayer) => normalize(rosterPlayer) === normalize(player))
          )
          .join(", "),
      };
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
