import type { Prisma } from "@prisma/client";
import {
  LZYUMI_REFRESH_INTERVAL_MS,
  refreshAccountProfileStats,
} from "@/lib/account-stats-refresh";
import { hasKookAdminNotifier, notifyKookAdmins } from "@/lib/kook-notifier";
import { prisma } from "@/lib/prisma";

const INACTIVE_AFTER_DAYS = 90;
const MAX_ATTEMPTS_BEFORE_NOTIFY = 3;
const RETRY_DELAY_MS = 1000 * 60 * 60 * 6;

type RefreshProfile = {
  id: string;
  displayName: string;
  riotName: string;
  riotTag: string | null;
  openId: string | null;
  chinaServerId: number | null;
  lzyumiLastLookupAt: Date | null;
};

function cutoffDate(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function addMs(ms: number) {
  return new Date(Date.now() + ms);
}

function riotId(profile: Pick<RefreshProfile, "riotName" | "riotTag">) {
  return profile.riotTag ? `${profile.riotName}#${profile.riotTag}` : profile.riotName;
}

function truncateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown refresh error.");
  return message.slice(0, 1000);
}

function activeProfileWhere(staleBefore: Date): Prisma.AccountProfileWhereInput {
  const activeAfter = cutoffDate(INACTIVE_AFTER_DAYS);

  return {
    accountStatus: "ACTIVE",
    verificationStatus: "VERIFIED",
    riotName: { not: "" },
    chinaServerId: { not: null },
    OR: [
      { createdAt: { gte: activeAfter } },
      { updatedAt: { gte: activeAfter } },
      { lzyumiLastLookupAt: { gte: activeAfter } },
      { lzyumiLastLookupAt: null },
      {
        lzyumiRefreshQueue: {
          is: {
            lastSuccessAt: { gte: activeAfter },
          },
        },
      },
    ],
    AND: [
      {
        OR: [
          { lzyumiLastLookupAt: null },
          { lzyumiLastLookupAt: { lt: staleBefore } },
          {
            lzyumiRefreshQueue: {
              is: {
                status: { in: ["PENDING", "FAILED"] },
                nextAttemptAt: { lte: new Date() },
              },
            },
          },
        ],
      },
    ],
  };
}

export async function enqueueDueLzyumiRefreshes(limit: number) {
  const staleBefore = new Date(Date.now() - LZYUMI_REFRESH_INTERVAL_MS);
  const profiles = await prisma.accountProfile.findMany({
    where: activeProfileWhere(staleBefore),
    orderBy: [
      { lzyumiLastLookupAt: "asc" },
      { updatedAt: "asc" },
      { createdAt: "asc" },
    ],
    take: limit,
    select: {
      id: true,
    },
  });

  await Promise.all(
    profiles.map((profile) =>
      prisma.lzyumiRefreshQueue.upsert({
        where: { profileId: profile.id },
        update: {
          status: "PENDING",
          nextAttemptAt: new Date(),
        },
        create: {
          profileId: profile.id,
          status: "PENDING",
          nextAttemptAt: new Date(),
        },
      }),
    ),
  );

  return profiles.length;
}

async function nextQueuedProfiles(limit: number) {
  await prisma.lzyumiRefreshQueue.updateMany({
    where: {
      status: "PROCESSING",
      lastAttemptAt: {
        lt: new Date(Date.now() - 30 * 60 * 1000),
      },
    },
    data: {
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  });

  const rows = await prisma.lzyumiRefreshQueue.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: new Date() },
      profile: {
        accountStatus: "ACTIVE",
        verificationStatus: "VERIFIED",
        riotName: { not: "" },
        chinaServerId: { not: null },
      },
    },
    orderBy: [
      { nextAttemptAt: "asc" },
      { updatedAt: "asc" },
    ],
    take: limit,
    include: {
      profile: {
        select: {
          id: true,
          displayName: true,
          riotName: true,
          riotTag: true,
          openId: true,
          chinaServerId: true,
          lzyumiLastLookupAt: true,
        },
      },
    },
  });

  return rows;
}

async function notifyFailedRefresh(profile: RefreshProfile, errorMessage: string, attempts: number) {
  await notifyKookAdmins(
    [
      "**ecl.gg stat refresh failed 3 times**",
      `**Player:** ${profile.displayName}`,
      `**Riot ID:** ${riotId(profile)}`,
      `**Profile ID:** ${profile.id}`,
      `**Attempts:** ${attempts}`,
      "",
      errorMessage,
    ].join("\n"),
  );
}

export async function processLzyumiRefreshQueue(limit: number) {
  const rows = await nextQueuedProfiles(limit);
  const results = [];

  for (const row of rows) {
    await prisma.lzyumiRefreshQueue.update({
      where: { id: row.id },
      data: {
        status: "PROCESSING",
        lastAttemptAt: new Date(),
      },
    });

    try {
      const result = await refreshAccountProfileStats(row.profile);

      if (!result.ok) {
        throw new Error(result.message);
      }

      await prisma.lzyumiRefreshQueue.update({
        where: { id: row.id },
        data: {
          status: "SUCCEEDED",
          attemptCount: 0,
          nextAttemptAt: addMs(LZYUMI_REFRESH_INTERVAL_MS),
          lastSuccessAt: new Date(),
          lastError: null,
          notifiedAt: null,
        },
      });

      results.push({
        ...result,
        displayName: row.profile.displayName,
        riotId: riotId(row.profile),
      });
    } catch (error) {
      const attemptCount = row.attemptCount + 1;
      const message = truncateError(error);
      const shouldNotify =
        hasKookAdminNotifier() &&
        attemptCount >= MAX_ATTEMPTS_BEFORE_NOTIFY &&
        !row.notifiedAt;

      await prisma.lzyumiRefreshQueue.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          attemptCount,
          nextAttemptAt: addMs(RETRY_DELAY_MS),
          lastError: message,
          notifiedAt: shouldNotify ? new Date() : row.notifiedAt,
        },
      });

      if (shouldNotify) {
        notifyFailedRefresh(row.profile, message, attemptCount).catch((notifyError) => {
          console.error("KOOK admin refresh failure notification failed:", notifyError);
        });
      }

      results.push({
        ok: false,
        profileId: row.profile.id,
        displayName: row.profile.displayName,
        riotId: riotId(row.profile),
        message,
        attemptCount,
      });
    }
  }

  return results;
}

export async function getLzyumiRefreshQueueSnapshot() {
  const [failed, pending, processing] = await Promise.all([
    prisma.lzyumiRefreshQueue.findMany({
      where: { status: "FAILED" },
      orderBy: [{ attemptCount: "desc" }, { updatedAt: "desc" }],
      take: 10,
      include: {
        profile: {
          select: {
            displayName: true,
            riotName: true,
            riotTag: true,
          },
        },
      },
    }),
    prisma.lzyumiRefreshQueue.count({ where: { status: "PENDING" } }),
    prisma.lzyumiRefreshQueue.count({ where: { status: "PROCESSING" } }),
  ]);

  return {
    pending,
    processing,
    failed: failed.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      displayName: row.profile.displayName,
      riotId: riotId(row.profile),
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
      lastAttemptAt: row.lastAttemptAt,
      lastError: row.lastError,
      notifiedAt: row.notifiedAt,
    })),
  };
}
