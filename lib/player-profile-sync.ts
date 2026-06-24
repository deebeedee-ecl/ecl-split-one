import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRiotPart, normalizeRiotTag } from "@/lib/riot-id";

type PlayerDatabase = typeof prisma | Prisma.TransactionClient;

export type PlayerProfileIdentity = {
  displayName: string;
  email: string | null;
  riotName: string | null;
  riotTag: string | null;
};

export async function syncPlayerForProfile(
  profile: PlayerProfileIdentity,
  database: PlayerDatabase = prisma,
) {
  const displayName = profile.displayName.trim();
  const email = (profile.email ?? "").trim();
  const riotName = normalizeRiotPart(profile.riotName);
  const riotTag = normalizeRiotTag(profile.riotTag);

  const identityClauses = [
    ...(riotName && riotTag
      ? [
          {
            riotName: { equals: riotName, mode: "insensitive" as const },
            riotTag: { equals: riotTag, mode: "insensitive" as const },
          },
        ]
      : []),
    ...(email
      ? [{ email: { equals: email, mode: "insensitive" as const } }]
      : []),
  ];

  const existing =
    identityClauses.length > 0
      ? await database.player.findFirst({ where: { OR: identityClauses } })
      : null;

  const data = {
    name: displayName || riotName || email || "ECL Player",
    riotName: riotName || null,
    riotTag: riotTag || null,
    email: email || null,
  };

  if (existing) {
    return database.player.update({
      where: { id: existing.id },
      data,
    });
  }

  return database.player.create({ data });
}
