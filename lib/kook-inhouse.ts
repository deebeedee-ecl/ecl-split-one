import { STARTING_ELO } from "@/lib/elo";
import { prisma } from "@/lib/prisma";

export const RANKED_INHOUSE_CATEGORY_ID =
  process.env.KOOK_RANKED_INHOUSE_CATEGORY_ID || "8024346698320304";
export const RANKED_INHOUSE_CHANNEL_ID =
  process.env.KOOK_RANKED_INHOUSE_CHANNEL_ID || "4175549527235352";
export const BLUE_SIDE_CHANNEL_ID =
  process.env.KOOK_BLUE_SIDE_CHANNEL_ID || "3522831675586808";
export const RED_SIDE_CHANNEL_ID =
  process.env.KOOK_RED_SIDE_CHANNEL_ID || "9801310073341652";

const INHOUSE_SIZE = 10;
const TEAM_SIZE = 5;

export type KookInhouseMember = {
  id?: string | null;
  userId?: string | null;
  username?: string | null;
  nickname?: string | null;
};

type NormalizedKookInhouseMember = {
  id: string;
  username: string | null;
};

export type ResolvedInhousePlayer = {
  kookUserId: string;
  displayName: string;
  riotId: string | null;
  riotName: string | null;
  riotTag: string | null;
  email: string | null;
  elo: number;
  profileId: string | null;
  playerId: string | null;
  verified: boolean;
  missingReason: string | null;
};

export type BalancedInhouseTeam = {
  channelId: string;
  eloTotal: number;
  players: ResolvedInhousePlayer[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanTag(value: string | null | undefined) {
  return clean(value).replace(/^#+/, "");
}

function riotKey(riotName: string | null | undefined, riotTag: string | null | undefined) {
  const name = clean(riotName).toLowerCase();
  const tag = cleanTag(riotTag).toLowerCase();

  if (!name || !tag) return null;
  return `${name}#${tag}`;
}

function formatRiotId(riotName: string | null | undefined, riotTag: string | null | undefined) {
  const name = clean(riotName);
  const tag = cleanTag(riotTag);

  if (!name) return null;
  return tag ? `${name}#${tag}` : name;
}

export function normalizeInhouseMembers(members: KookInhouseMember[]): NormalizedKookInhouseMember[] {
  const seen = new Set<string>();
  const normalized: NormalizedKookInhouseMember[] = [];

  for (const member of members) {
    const id = clean(member.id || member.userId);
    if (!id || seen.has(id)) continue;

    seen.add(id);
    normalized.push({
      id,
      username: clean(member.username || member.nickname) || null,
    });
  }

  return normalized;
}

export async function resolveInhousePlayers(
  members: KookInhouseMember[],
): Promise<ResolvedInhousePlayer[]> {
  const normalizedMembers = normalizeInhouseMembers(members);
  const kookIds = normalizedMembers.map((member) => member.id);

  const profiles = await prisma.accountProfile.findMany({
    where: {
      kookId: {
        in: kookIds,
      },
      verificationStatus: "VERIFIED",
      accountStatus: "ACTIVE",
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      riotName: true,
      riotTag: true,
      kookId: true,
    },
  });

  const profileByKookId = new Map(
    profiles
      .filter((profile) => profile.kookId)
      .map((profile) => [profile.kookId as string, profile]),
  );

  const playerLookups = profiles
    .map((profile) => ({
      key: riotKey(profile.riotName, profile.riotTag),
      email: clean(profile.email).toLowerCase(),
      riotName: clean(profile.riotName),
      riotTag: cleanTag(profile.riotTag),
    }))
    .filter((lookup) => lookup.key || lookup.email);

  const players =
    playerLookups.length === 0
      ? []
      : await prisma.player.findMany({
          where: {
            OR: playerLookups.flatMap((lookup) => {
              const clauses = [];

              if (lookup.riotName && lookup.riotTag) {
                clauses.push({
                  riotName: {
                    equals: lookup.riotName,
                    mode: "insensitive" as const,
                  },
                  riotTag: {
                    equals: lookup.riotTag,
                    mode: "insensitive" as const,
                  },
                });
              }

              if (lookup.email) {
                clauses.push({
                  email: {
                    equals: lookup.email,
                    mode: "insensitive" as const,
                  },
                });
              }

              return clauses;
            }),
          },
          select: {
            id: true,
            email: true,
            riotName: true,
            riotTag: true,
            elo: true,
          },
        });

  const playerByRiotId = new Map(
    players
      .map((player) => [riotKey(player.riotName, player.riotTag), player] as const)
      .filter((entry): entry is [string, (typeof players)[number]] => Boolean(entry[0])),
  );
  const playerByEmail = new Map(
    players
      .map((player) => [clean(player.email).toLowerCase(), player] as const)
      .filter((entry): entry is [string, (typeof players)[number]] => Boolean(entry[0])),
  );

  return normalizedMembers.map((member) => {
    const profile = profileByKookId.get(member.id);

    if (!profile) {
      return {
        kookUserId: member.id,
        displayName: member.username || member.id,
        riotId: null,
        riotName: null,
        riotTag: null,
        email: null,
        elo: STARTING_ELO,
        profileId: null,
        playerId: null,
        verified: false,
        missingReason: "KOOK account is not linked to a verified ECL profile.",
      };
    }

    const profileRiotKey = riotKey(profile.riotName, profile.riotTag);
    const player =
      (profileRiotKey ? playerByRiotId.get(profileRiotKey) : undefined) ||
      playerByEmail.get(clean(profile.email).toLowerCase());

    return {
      kookUserId: member.id,
      displayName: profile.displayName || member.username || member.id,
      riotId: formatRiotId(profile.riotName, profile.riotTag),
      riotName: profile.riotName,
      riotTag: cleanTag(profile.riotTag) || null,
      email: profile.email,
      elo: player?.elo ?? STARTING_ELO,
      profileId: profile.id,
      playerId: player?.id ?? null,
      verified: true,
      missingReason: player ? null : "No Player ELO record found; using starting ELO.",
    };
  });
}

export function balanceInhouseTeams(players: ResolvedInhousePlayer[]) {
  if (players.length !== INHOUSE_SIZE) {
    throw new Error(`Expected ${INHOUSE_SIZE} players to balance an inhouse.`);
  }

  let bestIndexes: number[] = [];
  let bestDiff = Number.POSITIVE_INFINITY;
  const totalElo = players.reduce((sum, player) => sum + player.elo, 0);

  function visit(startIndex: number, selected: number[], selectedElo: number) {
    if (selected.length === TEAM_SIZE) {
      const diff = Math.abs(totalElo - selectedElo * 2);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndexes = [...selected];
      }
      return;
    }

    for (let index = startIndex; index < players.length; index += 1) {
      visit(index + 1, [...selected, index], selectedElo + players[index].elo);
    }
  }

  visit(0, [], 0);

  const blueIndexes = new Set(bestIndexes);
  const bluePlayers = players.filter((_, index) => blueIndexes.has(index));
  const redPlayers = players.filter((_, index) => !blueIndexes.has(index));

  return {
    blueTeam: {
      channelId: BLUE_SIDE_CHANNEL_ID,
      eloTotal: bluePlayers.reduce((sum, player) => sum + player.elo, 0),
      players: bluePlayers,
    },
    redTeam: {
      channelId: RED_SIDE_CHANNEL_ID,
      eloTotal: redPlayers.reduce((sum, player) => sum + player.elo, 0),
      players: redPlayers,
    },
  };
}

export function formatInhouseRoster(players: ResolvedInhousePlayer[]) {
  return players
    .map((player, index) => {
      const riotId = player.riotId ? ` (${player.riotId})` : "";
      return `${index + 1}. ${player.displayName}${riotId} - ${player.elo} LP`;
    })
    .join("\n");
}

export function formatTeamList(team: BalancedInhouseTeam) {
  return team.players
    .map((player) => {
      const riotId = player.riotId ? ` (${player.riotId})` : "";
      return `- ${player.displayName}${riotId} - ${player.elo} LP`;
    })
    .join("\n");
}

export async function createInhouseSession({
  sourceChannelId,
  blueTeam,
  redTeam,
}: {
  sourceChannelId: string;
  blueTeam: BalancedInhouseTeam;
  redTeam: BalancedInhouseTeam;
}) {
  return prisma.inhouseSession.create({
    data: {
      sourceChannelId,
      blueChannelId: BLUE_SIDE_CHANNEL_ID,
      redChannelId: RED_SIDE_CHANNEL_ID,
      players: {
        create: [
          ...blueTeam.players.map((player) => ({
            kookUserId: player.kookUserId,
            profileId: player.profileId,
            playerId: player.playerId,
            displayName: player.displayName,
            riotName: player.riotName,
            riotTag: player.riotTag,
            email: player.email,
            side: "BLUE",
            eloAtReady: player.elo,
          })),
          ...redTeam.players.map((player) => ({
            kookUserId: player.kookUserId,
            profileId: player.profileId,
            playerId: player.playerId,
            displayName: player.displayName,
            riotName: player.riotName,
            riotTag: player.riotTag,
            email: player.email,
            side: "RED",
            eloAtReady: player.elo,
          })),
        ],
      },
    },
    select: {
      id: true,
      createdAt: true,
    },
  });
}
