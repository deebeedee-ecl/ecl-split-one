import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const teamTags = {
  BIY: "Bean In Your Mum",
  EB: "Exiled Bunzz",
  FLA: "Flanmingos",
  MFG: "Make France Great Again",
  NIU: "niuniupower",
  ZAF: "Zycope and friends",
} as const;

const trades = [
  { player: "MAD CUZ BAD", from: "MFG", to: "ZAF" },
  { player: "WEILA", from: "ZAF", to: "FLA" },
  { player: "DNAWENTI", from: "ZAF", to: "FLA" },
  { player: "deebeedee", from: "FLA", to: "BIY" },
  { player: "BDA", from: "FLA", to: "MFG" },
] as const;

type TeamTag = keyof typeof teamTags;
type RegistrationPlayer = {
  name?: string;
  playerName?: string;
  riotName?: string;
  riotTag?: string;
  [key: string]: unknown;
};

function asRegistrationPlayers(value: Prisma.JsonValue): RegistrationPlayer[] {
  if (!Array.isArray(value)) return [];

  const players: RegistrationPlayer[] = [];

  for (const entry of value) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      players.push({ ...(entry as Record<string, unknown>) });
    }
  }

  return players;
}

function toInputJson(value: RegistrationPlayer[]): Prisma.InputJsonValue {
  return value.map((entry) => ({ ...entry })) as Prisma.InputJsonValue;
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function playerMatches(player: RegistrationPlayer, targetName: string) {
  const target = normalize(targetName);

  return [player.name, player.playerName, player.riotName].some(
    (value) => normalize(value) === target
  );
}

async function findTeamByTag(tag: TeamTag) {
  const teamName = teamTags[tag];
  const team = await prisma.team.findFirst({
    where: {
      name: {
        equals: teamName,
        mode: "insensitive",
      },
    },
  });

  if (!team) {
    throw new Error(`Could not find team ${tag} (${teamName})`);
  }

  return team;
}

async function findRegistrationByTag(tag: TeamTag) {
  const teamName = teamTags[tag];
  const registration = await prisma.teamRegistration.findFirst({
    where: {
      teamName: {
        equals: teamName,
        mode: "insensitive",
      },
    },
    orderBy: {
      submittedAt: "desc",
    },
  });

  if (!registration) {
    throw new Error(`Could not find team registration ${tag} (${teamName})`);
  }

  return registration;
}

async function main() {
  const teamsByTag = new Map<TeamTag, Awaited<ReturnType<typeof findTeamByTag>>>();
  const registrationsByTag = new Map<
    TeamTag,
    Awaited<ReturnType<typeof findRegistrationByTag>>
  >();
  const registrationPlayersByTag = new Map<TeamTag, RegistrationPlayer[]>();

  for (const tag of Object.keys(teamTags) as TeamTag[]) {
    teamsByTag.set(tag, await findTeamByTag(tag));
    const registration = await findRegistrationByTag(tag);
    registrationsByTag.set(tag, registration);
    registrationPlayersByTag.set(tag, asRegistrationPlayers(registration.players));
  }

  const summary: Array<{
    player: string;
    from: TeamTag;
    to: TeamTag;
    previousTeam: string | null;
    registrationMoved: boolean;
  }> = [];

  for (const trade of trades) {
    const destinationTeam = teamsByTag.get(trade.to);

    if (!destinationTeam) {
      throw new Error(`Missing destination team ${trade.to}`);
    }

    const player = await prisma.player.findFirst({
      where: {
        OR: [
          {
            name: {
              equals: trade.player,
              mode: "insensitive",
            },
          },
          {
            riotName: {
              equals: trade.player,
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        team: true,
      },
    });

    if (!player) {
      throw new Error(`Could not find player ${trade.player}`);
    }

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        teamId: destinationTeam.id,
      },
    });

    const fromRegistration = registrationsByTag.get(trade.from);
    const toRegistration = registrationsByTag.get(trade.to);

    if (!fromRegistration || !toRegistration) {
      throw new Error(`Missing registration for ${trade.from} or ${trade.to}`);
    }

    const fromPlayers = registrationPlayersByTag.get(trade.from) ?? [];
    const toPlayers = registrationPlayersByTag.get(trade.to) ?? [];

    const movingPlayerIndex = fromPlayers.findIndex((entry) =>
      playerMatches(entry, trade.player)
    );
    const movingPlayer =
      movingPlayerIndex >= 0
        ? fromPlayers.splice(movingPlayerIndex, 1)[0]
        : ({
            playerName: player.name,
            riotName: player.riotName ?? "",
            riotTag: player.riotTag ?? "",
          } satisfies RegistrationPlayer);

    const alreadyInDestination = toPlayers.some((entry) =>
      playerMatches(entry, trade.player)
    );

    if (!alreadyInDestination) {
      toPlayers.push(movingPlayer);
    }

    await prisma.teamRegistration.update({
      where: {
        id: fromRegistration.id,
      },
      data: {
        players: toInputJson(fromPlayers),
      },
    });

    await prisma.teamRegistration.update({
      where: {
        id: toRegistration.id,
      },
      data: {
        players: toInputJson(toPlayers),
      },
    });

    registrationPlayersByTag.set(trade.from, fromPlayers);
    registrationPlayersByTag.set(trade.to, toPlayers);

    summary.push({
      player: player.name,
      from: trade.from,
      to: trade.to,
      previousTeam: player.team?.name ?? null,
      registrationMoved: movingPlayerIndex >= 0,
    });
  }

  console.table(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
