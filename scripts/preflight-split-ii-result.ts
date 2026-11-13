import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tournamentIdentity } from "../lib/tournaments/identity";
import { guestParticipantId } from "../lib/tournaments/match-policy";
import { SPLIT_II_SLUG } from "../lib/tournaments/split-ii-config";

type ManifestPlayer = {
  teamKey: string;
  riotId: string;
  kills: number;
  deaths: number;
  assists: number;
  champion?: string;
  items?: number[];
  damage?: number;
  gold?: number;
  position?: string;
  mvp?: boolean;
  guestSubstitute?: boolean;
};

export type ResultManifest = {
  fixtureCode: string;
  gameNumber: number;
  leagueGameId: string | null;
  providerId?: string;
  platform: "HN1";
  winnerTeamKey: string;
  playedAt: string;
  durationSeconds: number;
  note?: string;
  players: ManifestPlayer[];
};

const cancelledJobStatuses = [
  "CANCELLED",
  "FAILED",
  "DESKTOP_CANCELLED",
  "DESKTOP_EXPIRED",
  "DESKTOP_REJECTED",
] as const;

function option(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function integer(value: unknown, label: string, minimum = 0) {
  if (!Number.isInteger(value) || Number(value) < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
  return Number(value);
}

function optionalInteger(value: unknown, label: string) {
  if (value === undefined) return undefined;
  return integer(value, label);
}

export function parseManifest(value: unknown): ResultManifest {
  const input = object(value, "manifest");
  if (!Array.isArray(input.players) || input.players.length !== 10) {
    throw new Error("manifest.players must contain exactly ten players.");
  }

  const players = input.players.map((value, index): ManifestPlayer => {
    const player = object(value, `players[${index}]`);
    const riotId = text(player.riotId, `players[${index}].riotId`);
    if (!riotId.includes("#")) throw new Error(`players[${index}].riotId must be a full Riot ID.`);
    const items = player.items === undefined
      ? undefined
      : Array.isArray(player.items) && player.items.length <= 7
        ? player.items.map((item, itemIndex) => integer(item, `players[${index}].items[${itemIndex}]`))
        : (() => { throw new Error(`players[${index}].items must contain at most seven numeric item IDs.`); })();

    if (player.mvp !== undefined && typeof player.mvp !== "boolean") {
      throw new Error(`players[${index}].mvp must be a boolean.`);
    }
    if (player.guestSubstitute !== undefined && typeof player.guestSubstitute !== "boolean") {
      throw new Error(`players[${index}].guestSubstitute must be a boolean.`);
    }
    if (
      player.champion !== undefined &&
      typeof player.champion !== "string" &&
      typeof player.champion !== "number"
    ) {
      throw new Error(`players[${index}].champion must be a string or number.`);
    }

    return {
      teamKey: text(player.teamKey, `players[${index}].teamKey`).toLowerCase(),
      riotId,
      kills: integer(player.kills, `players[${index}].kills`),
      deaths: integer(player.deaths, `players[${index}].deaths`),
      assists: integer(player.assists, `players[${index}].assists`),
      ...(player.champion === undefined ? {} : { champion: text(String(player.champion), `players[${index}].champion`) }),
      ...(items === undefined ? {} : { items }),
      ...(optionalInteger(player.damage, `players[${index}].damage`) === undefined ? {} : { damage: Number(player.damage) }),
      ...(optionalInteger(player.gold, `players[${index}].gold`) === undefined ? {} : { gold: Number(player.gold) }),
      ...(player.position === undefined ? {} : { position: text(player.position, `players[${index}].position`) }),
      ...(player.mvp === undefined ? {} : { mvp: player.mvp }),
      ...(player.guestSubstitute === undefined ? {} : { guestSubstitute: player.guestSubstitute }),
    };
  });

  const leagueGameId = input.leagueGameId === undefined || input.leagueGameId === null ? null : text(input.leagueGameId, "manifest.leagueGameId");
  if (leagueGameId && !/^\d{6,30}$/.test(leagueGameId)) throw new Error("manifest.leagueGameId must be numeric.");
  const providerId = input.providerId === undefined ? undefined : text(input.providerId, "manifest.providerId");
  if (providerId && !/^[A-Za-z0-9+/_=-]{8,200}$/.test(providerId)) throw new Error("manifest.providerId has an invalid format.");
  if (!leagueGameId && !providerId) throw new Error("manifest requires leagueGameId or providerId.");
  const playedAt = text(input.playedAt, "manifest.playedAt");
  if (!Number.isFinite(Date.parse(playedAt))) throw new Error("manifest.playedAt must be an ISO timestamp.");
  const durationSeconds = integer(input.durationSeconds, "manifest.durationSeconds", 1);
  if (durationSeconds > 6 * 60 * 60) throw new Error("manifest.durationSeconds exceeds six hours.");
  if (input.platform !== "HN1") throw new Error("Split II preflight currently requires platform HN1.");

  return {
    fixtureCode: text(input.fixtureCode, "manifest.fixtureCode").toUpperCase(),
    gameNumber: integer(input.gameNumber, "manifest.gameNumber", 1),
    leagueGameId,
    ...(providerId === undefined ? {} : { providerId }),
    platform: "HN1",
    winnerTeamKey: text(input.winnerTeamKey, "manifest.winnerTeamKey").toLowerCase(),
    playedAt,
    durationSeconds,
    ...(input.note === undefined ? {} : { note: text(input.note, "manifest.note") }),
    players,
  };
}

function normalizedRiotId(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export type IdentityIntegrityInput = {
  suppliedRiotId: string;
  riotNameSnapshot: string;
  riotTagSnapshot: string;
  chinaServerIdSnapshot: number | null;
  gameIdentityKey: string | null;
  profile: {
    riotName: string;
    riotTag: string;
    chinaServerId: number | null;
    openId: string | null;
  };
};

export function identityIntegrityIssues(input: IdentityIntegrityInput) {
  const issues: string[] = [];
  const snapshotRiotId = `${input.riotNameSnapshot}#${input.riotTagSnapshot.replace(/^#+/, "")}`;
  const currentRiotId = `${input.profile.riotName}#${input.profile.riotTag.replace(/^#+/, "")}`;
  if (normalizedRiotId(input.suppliedRiotId) !== normalizedRiotId(snapshotRiotId)) {
    issues.push("SUPPLIED_RIOT_ID_MISMATCH");
  }
  if (input.chinaServerIdSnapshot !== 1 || input.profile.chinaServerId !== 1) {
    issues.push("IONIA_IDENTITY_MISMATCH");
  }
  const openId = input.profile.openId?.trim() ?? "";
  if (!openId) {
    issues.push("OPEN_ID_MISSING");
  } else if (input.gameIdentityKey !== `${input.profile.chinaServerId}:${openId}`) {
    issues.push("GAME_IDENTITY_KEY_MISMATCH");
  }
  if (normalizedRiotId(currentRiotId) !== normalizedRiotId(snapshotRiotId)) {
    issues.push("CURRENT_RIOT_ID_DRIFT");
  }
  return issues;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function publicManifestSummary(manifest: ResultManifest) {
  return {
    fixtureCode: manifest.fixtureCode,
    gameNumber: manifest.gameNumber,
    leagueGameId: manifest.leagueGameId,
    providerIdPresent: Boolean(manifest.providerId),
    platform: manifest.platform,
    winnerTeamKey: manifest.winnerTeamKey,
    playedAt: manifest.playedAt,
    durationSeconds: manifest.durationSeconds,
    playerCount: manifest.players.length,
    teamCounts: Object.fromEntries(
      [...new Set(manifest.players.map((player) => player.teamKey))].sort().map((teamKey) => [
        teamKey,
        manifest.players.filter((player) => player.teamKey === teamKey).length,
      ]),
    ),
    completeStatLines: manifest.players.filter((player) =>
      player.champion !== undefined &&
      player.items !== undefined &&
      player.damage !== undefined &&
      player.gold !== undefined &&
      player.position !== undefined
    ).length,
    mvpCount: manifest.players.filter((player) => player.mvp).length,
    guestSubstituteCount: manifest.players.filter((player) => player.guestSubstitute).length,
  };
}

async function main() {
  if (process.argv.includes("--apply")) {
    throw new Error("This command is read-only and does not support --apply.");
  }
  const inputPath = option("--input");
  if (!inputPath) throw new Error("Use --input=<ignored-local-manifest.json>.");
  const absoluteInputPath = path.resolve(inputPath);
  const manifest = parseManifest(JSON.parse(await readFile(absoluteInputPath, "utf8")));

  if (process.argv.includes("--validate-only")) {
    console.log(JSON.stringify({
      mode: "validate-only",
      readOnly: true,
      providerRequested: false,
      manifest: publicManifestSummary(manifest),
    }, null, 2));
    return;
  }

  const target = option("--target");
  if (!target || !/^[a-zA-Z0-9._-]{1,80}$/.test(target)) {
    throw new Error("Live preflight requires a non-secret --target=<environment-label>.");
  }

  loadEnvConfig(process.cwd(), false);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const db = new PrismaClient({ log: [] });
  const blockers: string[] = [];
  const warnings: string[] = [];

  try {
    const event = await db.tournament.findUnique({
      where: { slug: SPLIT_II_SLUG },
      select: { id: true, name: true },
    });
    if (!event) throw new Error("Split II tournament is not configured.");

    const fixture = await db.tournamentFixture.findFirst({
      where: { tournamentId: event.id, code: manifest.fixtureCode },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!fixture) throw new Error(`Fixture ${manifest.fixtureCode} was not found.`);
    if (manifest.gameNumber > fixture.bestOf) blockers.push("Game number exceeds the fixture series format.");

    const fixtureTeams = [fixture.homeTeam, fixture.awayTeam];
    const teamByKey = new Map(fixtureTeams.map((team) => [team.key.toLowerCase(), team]));
    const manifestTeamKeys = new Set(manifest.players.map((player) => player.teamKey));
    for (const teamKey of manifestTeamKeys) {
      if (!teamByKey.has(teamKey)) blockers.push(`A lineup team key does not belong to ${manifest.fixtureCode}: ${teamKey}.`);
    }
    const winner = teamByKey.get(manifest.winnerTeamKey);
    if (!winner) blockers.push("Winner team is not one of the fixture teams.");
    for (const team of fixtureTeams) {
      if (manifest.players.filter((player) => player.teamKey === team.key.toLowerCase()).length !== 5) {
        blockers.push(`${team.key} must have exactly five players.`);
      }
    }
    if (Date.parse(manifest.playedAt) > Date.now() + 5 * 60 * 1000) {
      blockers.push("Completed match timestamp is in the future.");
    }

    const registrations = await db.tournamentRegistration.findMany({
      where: { tournamentId: event.id },
      include: {
        profile: { select: { riotName: true, riotTag: true, chinaServerId: true, openId: true } },
        memberships: { select: { teamId: true } },
      },
      orderBy: { id: "asc" },
    });
    const registrationByIdentity = new Map<string, typeof registrations>();
    for (const registration of registrations) {
      const identity = tournamentIdentity(registration);
      const key = normalizedRiotId(`${identity.name}#${identity.tag}`);
      registrationByIdentity.set(key, [...(registrationByIdentity.get(key) ?? []), registration]);
    }

    const resolvedPlayers: Array<{
      slot: number;
      teamKey: string;
      profileId: string;
      teamId: string;
      eligibility: "ROSTER" | "FLOATER" | "GUEST_SUBSTITUTE";
      kills: number;
      deaths: number;
      assists: number;
      mvp: boolean;
    }> = [];
    for (const [index, player] of manifest.players.entries()) {
      const candidates = registrationByIdentity.get(normalizedRiotId(player.riotId)) ?? [];
      const team = teamByKey.get(player.teamKey);
      if (player.guestSubstitute) {
        if (!team) continue;
        if (candidates.length) blockers.push(`players[${index}] is registered and must not be submitted as a guest substitute.`);
        resolvedPlayers.push({
          slot: index,
          teamKey: team.key,
          profileId: guestParticipantId(manifest.platform, player.riotId),
          teamId: team.id,
          eligibility: "GUEST_SUBSTITUTE",
          kills: player.kills,
          deaths: player.deaths,
          assists: player.assists,
          mvp: Boolean(player.mvp),
        });
        continue;
      }
      if (candidates.length !== 1) {
        blockers.push(`players[${index}] did not resolve to exactly one registered full Riot ID.`);
        continue;
      }
      const registration = candidates[0];
      if (!team) continue;
      const identityIssues = identityIntegrityIssues({
        suppliedRiotId: player.riotId,
        riotNameSnapshot: registration.riotNameSnapshot,
        riotTagSnapshot: registration.riotTagSnapshot,
        chinaServerIdSnapshot: registration.chinaServerIdSnapshot,
        gameIdentityKey: registration.gameIdentityKey,
        profile: registration.profile,
      });
      if (identityIssues.includes("SUPPLIED_RIOT_ID_MISMATCH")) {
        blockers.push(`players[${index}] does not match the registered tournament Riot ID snapshot.`);
      }
      if (identityIssues.includes("IONIA_IDENTITY_MISMATCH")) {
        blockers.push(`players[${index}] does not have a coherent Ionia registration/profile identity.`);
      }
      if (identityIssues.includes("OPEN_ID_MISSING")) {
        blockers.push(`players[${index}] has no verified provider openId.`);
      }
      if (identityIssues.includes("GAME_IDENTITY_KEY_MISMATCH")) {
        blockers.push(`players[${index}] registration gameIdentityKey no longer matches the verified profile identity.`);
      }
      if (identityIssues.includes("CURRENT_RIOT_ID_DRIFT")) {
        blockers.push(`players[${index}] current Riot ID differs from the tournament snapshot; reconcile the alias explicitly.`);
      }
      const rosterMember = registration.memberships.some((membership) => membership.teamId === team.id);
      const floater = registration.pool === "FLOATER";
      if (!rosterMember && !floater) {
        blockers.push(`players[${index}] is neither on ${team.key}'s roster nor a registered floater.`);
        continue;
      }
      resolvedPlayers.push({
        slot: index,
        teamKey: team.key,
        profileId: registration.profileId,
        teamId: team.id,
        eligibility: rosterMember ? "ROSTER" : "FLOATER",
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        mvp: Boolean(player.mvp),
      });
    }
    if (new Set(resolvedPlayers.map((player) => player.profileId)).size !== resolvedPlayers.length) {
      blockers.push("The lineup contains a duplicate stable participant identity.");
    }

    const floaterLines = resolvedPlayers.filter((player) => player.eligibility === "FLOATER");
    const priorFloaterAppearances = floaterLines.length
      ? await db.tournamentFloaterAppearance.findMany({
          where: {
            tournamentId: event.id,
            OR: floaterLines.map((player) => ({ teamId: player.teamId, profileId: player.profileId })),
          },
          select: { teamId: true, profileId: true, reportId: true },
        })
      : [];
    if (priorFloaterAppearances.length) {
      blockers.push("A proposed floater has already appeared for that tournament team.");
    }
    const guestLines = resolvedPlayers.filter((player) => player.eligibility === "GUEST_SUBSTITUTE");
    const priorGuestReports = guestLines.length
      ? await db.tournamentReport.findMany({
          where: { tournamentId: event.id, status: "APPROVED" },
          select: { id: true, payload: true },
        })
      : [];
    const repeatedGuestAppearances = guestLines.flatMap((player) => priorGuestReports
      .filter((report) => {
        const payload = report.payload as unknown as { players?: Array<{ profileId?: string; teamId?: string; guestSubstitute?: boolean }> };
        return payload.players?.some((existing) => existing.guestSubstitute && existing.profileId === player.profileId && existing.teamId === player.teamId);
      })
      .map((report) => ({ profileId: player.profileId, teamId: player.teamId, reportId: report.id })));
    if (repeatedGuestAppearances.length) blockers.push("A proposed guest substitute has already appeared for that tournament team.");

    const mvpPlayers = resolvedPlayers.filter((player) => player.mvp);
    if (mvpPlayers.length > 1) blockers.push("At most one player may be marked MVP.");
    if (mvpPlayers.length === 1 && winner && mvpPlayers[0].teamId !== winner.id) {
      blockers.push("MVP must belong to the winning team.");
    }
    if (!mvpPlayers.length) warnings.push("No MVP was supplied; review whether the evidence supports one.");
    if (publicManifestSummary(manifest).completeStatLines !== 10) {
      warnings.push("One or more optional champion/item/damage/gold/position stat lines are incomplete.");
    }

    const externalGameId = manifest.leagueGameId ?? manifest.providerId!;
    const numericGameId = manifest.leagueGameId ? Number(manifest.leagueGameId) : Number.NaN;
    const gameIdVariants: Prisma.InputJsonValue[] = [externalGameId];
    if (manifest.leagueGameId && Number.isSafeInteger(numericGameId)) gameIdVariants.push(numericGameId);
    const jsonPaths = [
      ["gameId"],
      ["raw", "gameId"],
      ["recentMatch", "gameId"],
      ["raw", "recentMatch", "gameId"],
    ];
    const [tournamentReports, reportJob, legacyGame, inhouseSession] = await Promise.all([
      db.tournamentReport.findMany({
        where: {
          tournamentId: event.id,
          OR: [
            { fixtureId: fixture.id, gameNumber: manifest.gameNumber },
            ...(manifest.leagueGameId ? [{ leagueGameId: manifest.leagueGameId }] : []),
            ...(manifest.providerId ? [{ raw: { path: ["providerGameId"], equals: manifest.providerId } }] : []),
          ],
        },
        select: { id: true, status: true, fixtureId: true, gameNumber: true, leagueGameId: true },
      }),
      db.inhouseReportJob.findFirst({
        where: {
          status: { notIn: [...cancelledJobStatuses] },
          OR: gameIdVariants.flatMap((gameId) => jsonPaths.map((jsonPath) => ({
            rawMatchData: { path: jsonPath, equals: gameId },
          }))),
        },
        select: { id: true },
      }),
      db.matchGame.findFirst({
        where: {
          OR: gameIdVariants.flatMap((gameId) => jsonPaths.map((jsonPath) => ({
            ocrRawJson: { path: jsonPath, equals: gameId },
          }))),
        },
        select: { id: true },
      }),
      db.inhouseSession.findFirst({
        where: { lzyumiGameId: externalGameId },
        select: { id: true },
      }),
    ]);
    if (tournamentReports.length) blockers.push("The fixture slot or external game identity already exists in tournament reports.");
    if (reportJob) blockers.push("The external game identity already exists in a non-cancelled ranked report job.");
    if (legacyGame) blockers.push("The external game identity already exists in legacy/ranked MatchGame data.");
    if (inhouseSession) blockers.push("The external game identity already exists on an inhouse session.");

    const allReports = await db.tournamentReport.findMany({
      where: { tournamentId: event.id },
      select: { id: true, fixtureId: true, gameNumber: true, status: true, leagueGameId: true, reviewedAt: true },
      orderBy: { id: "asc" },
    });
    const stateFingerprint = fingerprint({
      eventId: event.id,
      fixture: {
        id: fixture.id,
        revision: fixture.revision,
        bestOf: fixture.bestOf,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
      },
      reports: allReports,
      registrations: registrations.map((registration) => ({
        id: registration.id,
        profileId: registration.profileId,
        pool: registration.pool,
        identity: tournamentIdentity(registration),
        currentRiotId: `${registration.profile.riotName}#${registration.profile.riotTag.replace(/^#+/, "")}`,
        chinaServerIdSnapshot: registration.chinaServerIdSnapshot,
        currentChinaServerId: registration.profile.chinaServerId,
        openIdPresent: Boolean(registration.profile.openId?.trim()),
        gameIdentityKeyHash: fingerprint(registration.gameIdentityKey),
        teamIds: registration.memberships.map((membership) => membership.teamId).sort(),
      })),
      priorFloaterAppearances,
      repeatedGuestAppearances,
      duplicateChecks: {
        tournamentReports: tournamentReports.map((report) => report.id),
        reportJob: reportJob?.id ?? null,
        legacyGame: legacyGame?.id ?? null,
        inhouseSession: inhouseSession?.id ?? null,
      },
      proposal: manifest,
    });

    const output = {
      mode: "dry-run",
      readOnly: true,
      providerRequested: false,
      target,
      fingerprint: stateFingerprint,
      clean: blockers.length === 0,
      blockers,
      warnings,
      fixture: {
        code: fixture.code,
        gameNumber: manifest.gameNumber,
        bestOf: fixture.bestOf,
        homeTeamKey: fixture.homeTeam.key,
        awayTeamKey: fixture.awayTeam.key,
        winnerTeamKey: manifest.winnerTeamKey,
      },
      manifest: publicManifestSummary(manifest),
      identityChecks: resolvedPlayers.map((player) => ({
        slot: player.slot,
        teamKey: player.teamKey,
        eligibility: player.eligibility,
      })),
      duplicateChecks: {
        tournament: tournamentReports.length === 0,
        rankedReportJob: !reportJob,
        legacyMatchGame: !legacyGame,
        inhouseSession: !inhouseSession,
      },
      invariants: {
        notify: false,
        rankedLp: false,
        inhouseWrite: false,
        durableRiotIdentityWrite: false,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    if (blockers.length) process.exitCode = 2;
  } finally {
    await db.$disconnect();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
