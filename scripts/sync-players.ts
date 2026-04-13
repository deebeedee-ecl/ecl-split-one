import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TeamRegistrationPlayer = {
  name?: string;
  playerName?: string;
  riotName?: string;
  riotId?: string;
  riotTag?: string | number;
  email?: string;
};

function normalizeStatus(status?: string | null) {
  return (status || "").trim().toLowerCase();
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanTag(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^#/, "");
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function extractRosterPlayers(playersJson: unknown): TeamRegistrationPlayer[] {
  if (!Array.isArray(playersJson)) return [];

  return playersJson.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;

    return {
      name:
        cleanString(row.name) ||
        cleanString(row.playerName) ||
        cleanString(row.summonerName) ||
        cleanString(row.riotName) ||
        undefined,
      playerName: cleanString(row.playerName) || undefined,
      riotName:
        cleanString(row.riotName) ||
        cleanString(row.riotId) ||
        cleanString(row.summonerName) ||
        undefined,
      riotId: cleanString(row.riotId) || undefined,
      riotTag: cleanTag(row.riotTag) || undefined,
      email: cleanString(row.email) || undefined,
    };
  });
}

async function findExistingPlayer({
  name,
  riotName,
  riotTag,
}: {
  name?: string | null;
  riotName?: string | null;
  riotTag?: string | null;
}) {
  if (riotName && riotTag) {
    const exactRiot = await prisma.player.findFirst({
      where: {
        riotName,
        riotTag,
      },
    });

    if (exactRiot) return exactRiot;
  }

  if (name) {
    const exactName = await prisma.player.findFirst({
      where: {
        name,
      },
    });

    if (exactName) return exactName;
  }

  return null;
}

async function syncTeamRegistrationPlayers() {
  const teamRegistrations = await prisma.teamRegistration.findMany({
    where: {
      status: "approved",
    },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const registration of teamRegistrations) {
    const team = await prisma.team.findFirst({
      where: {
        name: registration.teamName,
      },
    });

    if (!team) {
      console.log(
        `⚠️ Skipping team registration "${registration.teamName}" because no matching Team row was found.`
      );
      skipped += 1;
      continue;
    }

    const rosterPlayers = extractRosterPlayers(registration.players);

    for (const rosterPlayer of rosterPlayers) {
      const name =
        rosterPlayer.name ||
        rosterPlayer.playerName ||
        rosterPlayer.riotName ||
        "Unknown Player";

      const riotName = rosterPlayer.riotName || null;
      const riotTag = cleanTag(rosterPlayer.riotTag);
      const email = rosterPlayer.email || null;

      const existing = await findExistingPlayer({
        name,
        riotName,
        riotTag,
      });

      if (existing) {
        await prisma.player.update({
          where: { id: existing.id },
          data: {
            name,
            riotName: riotName ?? existing.riotName,
            riotTag: riotTag ?? existing.riotTag,
            email: email ?? existing.email,
            teamId: team.id,
          },
        });

        updated += 1;
        continue;
      }

      await prisma.player.create({
        data: {
          name,
          riotName,
          riotTag,
          email,
          teamId: team.id,
        },
      });

      created += 1;
    }
  }

  return { created, updated, skipped };
}

async function syncFreeAgents() {
  const freeAgents = await prisma.freeAgentRegistration.findMany();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const freeAgent of freeAgents) {
    const status = normalizeStatus(freeAgent.status);

    if (status !== "approved" && status !== "signed") {
      skipped += 1;
      continue;
    }

    const name = freeAgent.playerName;
    const riotName = freeAgent.riotName || null;
    const riotTag = cleanTag(freeAgent.riotTag);
    const email = freeAgent.email || null;

    const existing = await findExistingPlayer({
      name,
      riotName,
      riotTag,
    });

    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          name,
          riotName: riotName ?? existing.riotName,
          riotTag: riotTag ?? existing.riotTag,
          email: email ?? existing.email,
        },
      });

      updated += 1;
      continue;
    }

    await prisma.player.create({
      data: {
        name,
        riotName,
        riotTag,
        email,
        teamId: null,
      },
    });

    created += 1;
  }

  return { created, updated, skipped };
}

async function main() {
  console.log("🚀 Starting player sync...");

  const teamResults = await syncTeamRegistrationPlayers();
  console.log("✅ TeamRegistration sync done:", teamResults);

  const freeAgentResults = await syncFreeAgents();
  console.log("✅ FreeAgentRegistration sync done:", freeAgentResults);

  const totalPlayers = await prisma.player.count();
  console.log(`📊 Total players now in Player table: ${totalPlayers}`);
}

main()
  .catch((error) => {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });