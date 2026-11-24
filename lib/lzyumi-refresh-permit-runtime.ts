import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";
import {
  evaluateLzyumiRefreshPermitIssue,
  evaluateLzyumiRefreshPermitUse,
  type LzyumiRefreshPermitPolicy,
} from "@/lib/lzyumi-refresh-permit";
import { buildLzyumiEndpointUrl } from "@/lib/lzyumi-browser-contract";
import {
  createLzyumiSignature,
  getChinaServer,
} from "@/lib/lzyumi";
import {
  LzyumiSnapshotValidationError,
  resolveLzyumiSnapshotRefresh,
  shouldRefreshLzyumiSnapshots,
} from "@/lib/lzyumi-snapshot";
import { LzyumiBrowserContractError } from "@/lib/lzyumi-browser-contract";

const DEFAULT_LZYUMI_BROWSER_BASE = "https://a.2025lol.top/lzyumi/lol";

export class LzyumiRefreshPermitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LzyumiRefreshPermitConfigurationError";
  }
}

type PermitEnvironment = Readonly<Record<string, string | undefined>>;

function positiveInteger(environment: PermitEnvironment, name: string) {
  const raw = environment[name]?.trim() ?? "";
  const parsed = Number(raw);
  if (!raw || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new LzyumiRefreshPermitConfigurationError(
      `${name} must be configured as a positive safe integer.`,
    );
  }
  return parsed;
}

export function readLzyumiRefreshPermitPolicy(
  environment: PermitEnvironment = process.env,
): LzyumiRefreshPermitPolicy {
  if (environment.LZYUMI_MANUAL_REFRESH_PERMITS_ENABLED !== "true") {
    throw new LzyumiRefreshPermitConfigurationError(
      "Manual Lzyumi refresh permits are not enabled.",
    );
  }

  const policy = {
    permitTtlMs: positiveInteger(environment, "LZYUMI_MANUAL_REFRESH_PERMIT_TTL_MS"),
    profileCooldownMs: positiveInteger(
      environment,
      "LZYUMI_MANUAL_REFRESH_PROFILE_COOLDOWN_MS",
    ),
    requesterCooldownMs: positiveInteger(
      environment,
      "LZYUMI_MANUAL_REFRESH_REQUESTER_COOLDOWN_MS",
    ),
    requesterWindowMs: positiveInteger(
      environment,
      "LZYUMI_MANUAL_REFRESH_REQUESTER_WINDOW_MS",
    ),
    requesterMaxPermitsPerWindow: positiveInteger(
      environment,
      "LZYUMI_MANUAL_REFRESH_REQUESTER_MAX_PERMITS",
    ),
  } satisfies LzyumiRefreshPermitPolicy;

  if (policy.permitTtlMs > policy.profileCooldownMs) {
    throw new LzyumiRefreshPermitConfigurationError(
      "Permit TTL must not exceed the profile cooldown.",
    );
  }
  if (policy.requesterCooldownMs > policy.requesterWindowMs) {
    throw new LzyumiRefreshPermitConfigurationError(
      "Requester cooldown must not exceed the requester window.",
    );
  }

  return policy;
}

export function hashLzyumiRefreshPermitToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function orderedLzyumiRefreshPermitLockKeys(
  requesterProfileId: string,
  targetProfileId: string,
) {
  return [
    `lzyumi-refresh-permit:requester:${requesterProfileId}`,
    `lzyumi-refresh-permit:target:${targetProfileId}`,
  ].sort();
}

type PermitTarget = {
  id: string;
  riotName: string;
  riotTag: string;
  chinaServerId: number | null;
  chinaServerName: string | null;
  openId: string | null;
  verificationStatus: string;
  accountStatus: string;
  lzyumiLastLookupAt: Date | null;
  lzyumiRawProfile: unknown;
  lzyumiRecentStat: unknown;
  lzyumiRankedGames: unknown;
};

const targetSelect = {
  id: true,
  riotName: true,
  riotTag: true,
  chinaServerId: true,
  chinaServerName: true,
  openId: true,
  verificationStatus: true,
  accountStatus: true,
  lzyumiLastLookupAt: true,
  lzyumiRawProfile: true,
  lzyumiRecentStat: true,
  lzyumiRankedGames: true,
} satisfies Prisma.AccountProfileSelect;

type PermitRow = {
  id: string;
  tokenHash: string;
  requesterProfileId: string;
  targetProfileId: string;
  status: "ISSUED" | "COMPLETED" | "REJECTED" | "EXPIRED";
  expiresAt: Date;
};

async function lockPermitScopes(
  transaction: Prisma.TransactionClient,
  requesterProfileId: string,
  targetProfileId: string,
) {
  for (const key of orderedLzyumiRefreshPermitLockKeys(
    requesterProfileId,
    targetProfileId,
  )) {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

function currentRank(raw: unknown) {
  const ranks = getLzyumiRankRows(raw);
  const rank = ranks.solo ?? ranks.flex;
  const formatted = formatLzyumiRank(rank);
  return formatted.label === "Unranked" ? null : formatted.label;
}

function sanitizedTerminalCode(error: unknown) {
  if (error instanceof LzyumiBrowserContractError) {
    return `PROVIDER_${error.endpoint.toUpperCase()}_${error.kind.toUpperCase().replaceAll("-", "_")}`;
  }
  if (error instanceof LzyumiSnapshotValidationError) return error.code;
  return "SNAPSHOT_REJECTED";
}

function infoUrl({
  target,
  filter,
  allCount,
  now,
}: {
  target: PermitTarget;
  filter: 1 | 2 | 3;
  allCount: 10 | 20;
  now: Date;
}) {
  const base = process.env.LZYUMI_BASE_URL ?? DEFAULT_LZYUMI_BROWSER_BASE;
  const url = buildLzyumiEndpointUrl(base, "profile");
  const server = getChinaServer(target.chinaServerId, target.chinaServerName);
  const { lzyumiSign, signStr } = createLzyumiSignature(now);
  url.searchParams.set("nickname", target.riotName.trim());
  url.searchParams.set("allCount", String(allCount));
  url.searchParams.set("areaId", String(server.id));
  url.searchParams.set("areaName", server.name);
  url.searchParams.set("seleMe", "1");
  url.searchParams.set("filter", String(filter));
  url.searchParams.set("openId", target.openId?.trim() ?? "");
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);
  return url.toString();
}

function recentUrl(target: PermitTarget, now: Date) {
  const base = process.env.LZYUMI_BASE_URL ?? DEFAULT_LZYUMI_BROWSER_BASE;
  const url = buildLzyumiEndpointUrl(base, "recent");
  const server = getChinaServer(target.chinaServerId, target.chinaServerName);
  const { lzyumiSign, signStr } = createLzyumiSignature(now);
  url.searchParams.set("openId", target.openId?.trim() ?? "");
  url.searchParams.set("areaId", String(server.id));
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);
  return url.toString();
}

function browserRequestBundle(target: PermitTarget, now: Date) {
  return {
    profile: infoUrl({ target, filter: 1, allCount: 10, now }),
    solo: infoUrl({ target, filter: 2, allCount: 20, now }),
    flex: infoUrl({ target, filter: 3, allCount: 20, now }),
    recent: recentUrl(target, now),
  };
}

export type LzyumiRefreshPermitIssueResult =
  | {
      status: "issued";
      permitToken: string;
      targetProfileId: string;
      expiresAt: Date;
      requests: ReturnType<typeof browserRequestBundle>;
    }
  | {
      status: "rejected";
      code: string;
      retryAt: Date | null;
    };

export async function issueLzyumiRefreshPermit({
  requesterUserId,
  targetProfileId,
  policy,
  now = new Date(),
  database = prisma,
}: {
  requesterUserId: string;
  targetProfileId: string;
  policy: LzyumiRefreshPermitPolicy;
  now?: Date;
  database?: typeof prisma;
}): Promise<LzyumiRefreshPermitIssueResult> {
  const requester = await database.accountProfile.findUnique({
    where: { userId: requesterUserId },
    select: { id: true },
  });
  if (!requester) {
    return { status: "rejected", code: "UNAUTHENTICATED", retryAt: null };
  }

  return database.$transaction(async (transaction) => {
    await lockPermitScopes(transaction, requester.id, targetProfileId);

    const [currentRequester, target] = await Promise.all([
      transaction.accountProfile.findUnique({
        where: { id: requester.id },
        select: { id: true },
      }),
      transaction.accountProfile.findUnique({
        where: { id: targetProfileId },
        select: targetSelect,
      }),
    ]);

    const unavailableTarget: PermitTarget = {
      id: targetProfileId,
      riotName: "",
      riotTag: "",
      chinaServerId: null,
      chinaServerName: null,
      openId: null,
      verificationStatus: "",
      accountStatus: "",
      lzyumiLastLookupAt: null,
      lzyumiRawProfile: null,
      lzyumiRecentStat: null,
      lzyumiRankedGames: null,
    };
    const selectedTarget = (target ?? unavailableTarget) as PermitTarget;
    const windowStart = new Date(now.getTime() - policy.requesterWindowMs);

    const [latestTargetPermit, requesterWindow] = await Promise.all([
      transaction.$queryRaw<Array<{ issuedAt: Date }>>(Prisma.sql`
        SELECT issued_at AS "issuedAt"
        FROM public.lzyumi_refresh_permits
        WHERE target_profile_id = ${targetProfileId}
        ORDER BY issued_at DESC
        LIMIT 1
      `),
      transaction.$queryRaw<Array<{ count: bigint; oldest: Date | null; latest: Date | null }>>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS count,
          MIN(issued_at) AS oldest,
          MAX(issued_at) AS latest
        FROM public.lzyumi_refresh_permits
        WHERE requester_profile_id = ${requester.id}
          AND issued_at >= ${windowStart}
      `),
    ]);
    const requesterFacts = requesterWindow[0] ?? {
      count: BigInt(0),
      oldest: null,
      latest: null,
    };

    const decision = evaluateLzyumiRefreshPermitIssue({
      now,
      requesterProfileId: currentRequester?.id ?? null,
      target: {
        profileId: selectedTarget.id,
        active: selectedTarget.accountStatus === "ACTIVE",
        verified: selectedTarget.verificationStatus === "VERIFIED",
        riotName: selectedTarget.riotName,
        riotTag: selectedTarget.riotTag,
        chinaServerId: selectedTarget.chinaServerId,
        openId: selectedTarget.openId,
        snapshotIsStale: shouldRefreshLzyumiSnapshots(
          selectedTarget.lzyumiRawProfile,
          selectedTarget.lzyumiRankedGames,
          selectedTarget.lzyumiLastLookupAt,
          now.getTime(),
        ),
      },
      lastProfilePermitIssuedAt: latestTargetPermit[0]?.issuedAt ?? null,
      lastRequesterPermitIssuedAt: requesterFacts.latest,
      requesterPermitCountInWindow: Number(requesterFacts.count),
      oldestRequesterPermitInWindowAt: requesterFacts.oldest,
    }, policy);

    if (decision.status === "rejected") return decision;

    const permitToken = randomBytes(32).toString("base64url");
    const tokenHash = hashLzyumiRefreshPermitToken(permitToken);
    const permitId = randomUUID();
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO public.lzyumi_refresh_permits (
        id,
        token_hash,
        requester_profile_id,
        target_profile_id,
        status,
        issued_at,
        expires_at,
        updated_at
      ) VALUES (
        ${permitId}::uuid,
        ${tokenHash},
        ${requester.id},
        ${targetProfileId},
        'ISSUED'::public."LzyumiRefreshPermitStatus",
        ${now},
        ${decision.expiresAt},
        ${now}
      )
    `);

    return {
      status: "issued" as const,
      permitToken,
      targetProfileId,
      expiresAt: decision.expiresAt,
      requests: browserRequestBundle(selectedTarget, now),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 10_000,
    timeout: 15_000,
  });
}

export type LzyumiRefreshPermitSnapshotInput = {
  profileResponse: unknown;
  soloResponse: unknown;
  flexResponse: unknown;
  recentStat?: unknown;
};

export type LzyumiRefreshPermitConsumeResult =
  | {
      status: "completed";
      targetProfileId: string;
      fetchedAt: Date;
      hasRecentStat: boolean;
      recentStatStatus: "available" | "unavailable";
    }
  | {
      status: "rejected";
      code: string;
    };

export async function consumeLzyumiRefreshPermit({
  requesterUserId,
  targetProfileId,
  permitToken,
  snapshot,
  now = new Date(),
  database = prisma,
}: {
  requesterUserId: string;
  targetProfileId: string;
  permitToken: string;
  snapshot: LzyumiRefreshPermitSnapshotInput;
  now?: Date;
  database?: typeof prisma;
}): Promise<LzyumiRefreshPermitConsumeResult> {
  const requester = await database.accountProfile.findUnique({
    where: { userId: requesterUserId },
    select: { id: true },
  });
  if (!requester) return { status: "rejected", code: "PERMIT_INVALID" };

  const tokenHash = hashLzyumiRefreshPermitToken(permitToken);
  const result = await database.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<PermitRow[]>(Prisma.sql`
      SELECT
        id,
        token_hash AS "tokenHash",
        requester_profile_id AS "requesterProfileId",
        target_profile_id AS "targetProfileId",
        status,
        expires_at AS "expiresAt"
      FROM public.lzyumi_refresh_permits
      WHERE token_hash = ${tokenHash}
      FOR UPDATE
    `);
    const permit = rows[0] ?? null;
    const decision = evaluateLzyumiRefreshPermitUse({
      permit,
      requesterProfileId: requester.id,
      targetProfileId,
      now,
    });
    if (decision.status === "rejected") {
      if (permit?.status === "ISSUED" && decision.code === "PERMIT_EXPIRED") {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE public.lzyumi_refresh_permits
          SET
            status = 'EXPIRED'::public."LzyumiRefreshPermitStatus",
            terminal_code = 'PERMIT_EXPIRED',
            completed_at = ${now},
            updated_at = ${now}
          WHERE id = ${permit.id}::uuid
            AND status = 'ISSUED'::public."LzyumiRefreshPermitStatus"
        `);
      }
      return decision;
    }

    // A signed request bundle does not attest the provider response returned
    // through a browser. Recheck ownership during consumption as well as
    // issuance so a previously issued or manually inserted viewer permit
    // cannot write a browser-controlled snapshot to another profile.
    if (requester.id !== targetProfileId) {
      await rejectPermit(transaction, permit!.id, "OWNER_ONLY", now);
      return { status: "rejected" as const, code: "OWNER_ONLY" };
    }

    await transaction.$queryRaw(Prisma.sql`
      SELECT id
      FROM public."AccountProfile"
      WHERE id = ${targetProfileId}
      FOR UPDATE
    `);
    const target = await transaction.accountProfile.findUnique({
      where: { id: targetProfileId },
      select: targetSelect,
    }) as PermitTarget | null;
    if (!target) return { status: "rejected" as const, code: "TARGET_UNAVAILABLE" };

    if (!shouldRefreshLzyumiSnapshots(
      target.lzyumiRawProfile,
      target.lzyumiRankedGames,
      target.lzyumiLastLookupAt,
      now.getTime(),
    )) {
      await rejectPermit(transaction, permit!.id, "SNAPSHOT_FRESH", now);
      return { status: "rejected" as const, code: "SNAPSHOT_FRESH" };
    }

    const refresh = resolveLzyumiSnapshotRefresh(
      {
        rawProfile: target.lzyumiRawProfile,
        recentStat: target.lzyumiRecentStat,
        rankedGames: target.lzyumiRankedGames,
        lastLookupAt: target.lzyumiLastLookupAt,
      },
      {
        profileResponse: snapshot.profileResponse,
        soloResponse: snapshot.soloResponse,
        flexResponse: snapshot.flexResponse,
        recentStat: snapshot.recentStat ?? {
          status: "unavailable",
          reason: "network-rejected",
        },
        riotName: target.riotName,
        riotTag: target.riotTag,
        areaId: target.chinaServerId!,
        existingOpenId: target.openId,
        fetchedAt: now,
      },
    );
    if (refresh.status === "rejected") {
      const code = sanitizedTerminalCode(refresh.error);
      await rejectPermit(transaction, permit!.id, code, now);
      return { status: "rejected" as const, code };
    }

    const ranks = getLzyumiRankRows(refresh.rawProfile);
    const updated = await transaction.accountProfile.updateMany({
      where: {
        id: targetProfileId,
        lzyumiLastLookupAt: target.lzyumiLastLookupAt,
      },
      data: {
        openId: refresh.identity.openId,
        lzyumiVerifiedAt: now,
        lzyumiLastLookupAt: now,
        lzyumiRawProfile: refresh.rawProfile as Prisma.InputJsonValue,
        lzyumiRecentStat: refresh.recentStat
          ? (refresh.recentStat as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lzyumiRankedGames: refresh.rankedGames as Prisma.InputJsonValue,
        currentRank: ranks.solo || ranks.flex ? currentRank(refresh.rawProfile) : null,
      },
    });
    if (updated.count !== 1) {
      await rejectPermit(transaction, permit!.id, "CONCURRENT_REFRESH", now);
      return { status: "rejected" as const, code: "CONCURRENT_REFRESH" };
    }

    const completed = await transaction.$executeRaw(Prisma.sql`
      UPDATE public.lzyumi_refresh_permits
      SET
        status = 'COMPLETED'::public."LzyumiRefreshPermitStatus",
        terminal_code = 'SNAPSHOT_REPLACED',
        completed_at = ${now},
        updated_at = ${now}
      WHERE id = ${permit!.id}::uuid
        AND status = 'ISSUED'::public."LzyumiRefreshPermitStatus"
    `);
    if (completed !== 1) {
      throw new Error("The refresh permit could not be completed exactly once.");
    }

    return {
      status: "completed" as const,
      targetProfileId,
      fetchedAt: now,
      hasRecentStat: Boolean(refresh.recentStat),
      recentStatStatus: refresh.recentStatStatus,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 10_000,
    timeout: 15_000,
  });

  return result;
}

async function rejectPermit(
  transaction: Prisma.TransactionClient,
  permitId: string,
  code: string,
  now: Date,
) {
  await transaction.$executeRaw(Prisma.sql`
    UPDATE public.lzyumi_refresh_permits
    SET
      status = 'REJECTED'::public."LzyumiRefreshPermitStatus",
      terminal_code = ${code},
      completed_at = ${now},
      updated_at = ${now}
    WHERE id = ${permitId}::uuid
      AND status = 'ISSUED'::public."LzyumiRefreshPermitStatus"
  `);
}
