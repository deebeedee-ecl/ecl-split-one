import { Prisma } from "@prisma/client";
import {
  CONFIRMATION_PENDING_STATUSES,
  DISCOVERY_PENDING_STATUSES,
  claimedReportJobStatus,
  reportJobAction,
} from "@/lib/inhouse-report-job-state";
import { reportedLzyumiGameIds } from "@/lib/lzyumi-report-dedupe";
import { prisma } from "@/lib/prisma";

export const REPORT_JOB_ACTIVE_STATUSES = DISCOVERY_PENDING_STATUSES;
export const REPORT_CONFIRMATION_ACTIVE_STATUSES = CONFIRMATION_PENDING_STATUSES;
export const REPORT_JOB_LOCK_MS = 2 * 60 * 1000;
export const REPORT_CONFIRMATION_LOCK_MS = 6 * 60 * 1000;

export type ReportJobRawMatchData = {
  profile: unknown;
  gameId: string;
  game?: unknown;
  detail: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function unauthorizedReportWorker(request: Request) {
  const expectedSecrets = [
    process.env.ECL_REPORT_ENGINE_SECRET,
    process.env.ECL_JOB_SECRET,
    process.env.ECL_KOOK_BOT_SECRET,
  ].map(clean).filter(Boolean);
  const suppliedSecret =
    request.headers.get("x-ecl-report-engine-secret") ??
    request.headers.get("x-ecl-job-secret") ??
    request.headers.get("x-ecl-kook-secret");

  return expectedSecrets.length === 0 || !expectedSecrets.includes(clean(suppliedSecret));
}

export async function enqueueInhouseReportJob({
  sessionId,
  requestedByKookId,
  responseChannelId,
}: {
  sessionId: string;
  requestedByKookId: string;
  responseChannelId?: string | null;
}) {
  const existing = await prisma.inhouseReportJob.findFirst({
    where: {
      sessionId,
      requestedByKookId,
      status: { in: [...REPORT_JOB_ACTIVE_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return prisma.inhouseReportJob.update({
      where: { id: existing.id },
      data: {
        responseChannelId: clean(responseChannelId) || existing.responseChannelId,
      },
    });
  }

  return prisma.inhouseReportJob.create({
    data: {
      sessionId,
      requestedByKookId,
      responseChannelId: clean(responseChannelId) || null,
    },
  });
}

export async function claimNextInhouseReportJob(workerId: string) {
  const staleBefore = new Date(Date.now() - REPORT_JOB_LOCK_MS);
  const confirmationStaleBefore = new Date(Date.now() - REPORT_CONFIRMATION_LOCK_MS);
  const job =
    (await prisma.inhouseReportJob.findFirst({
      where: {
        OR: [
          { status: "CONFIRM_PENDING" },
          { status: "CONFIRM_PROCESSING", lockedAt: { lt: confirmationStaleBefore } },
        ],
      },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.inhouseReportJob.findFirst({
      where: {
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING", lockedAt: { lt: staleBefore } },
        ],
      },
      orderBy: { createdAt: "asc" },
    }));

  if (!job) return null;

  const action = reportJobAction(job.status);
  if (!action) return null;

  const claimedStatus = claimedReportJobStatus(action);
  const claim = await prisma.inhouseReportJob.updateMany({
    where: { id: job.id, status: job.status },
    data: {
      status: claimedStatus,
      attempts: { increment: 1 },
      lockedAt: new Date(),
      lockedBy: workerId,
      lastError: null,
    },
  });

  if (claim.count !== 1) return null;

  const claimed = await prisma.inhouseReportJob.findUniqueOrThrow({
    where: { id: job.id },
    include: {
      session: {
        include: { players: true },
      },
    },
  });

  if (action === "CONFIRM") {
    return {
      action,
      id: claimed.id,
      sessionId: claimed.sessionId,
      requestedByKookId: claimed.requestedByKookId,
      responseChannelId: claimed.responseChannelId,
      attempts: claimed.attempts,
      rawMatchData: claimed.rawMatchData,
      session: {
        id: claimed.session.id,
        gameLabel: claimed.session.gameLabel,
        createdAt: claimed.session.createdAt.toISOString(),
        players: [],
      },
      reporter: null,
      reportedGameIds: [],
    };
  }

  const profileIds = claimed.session.players
    .map((player) => player.profileId)
    .filter((id): id is string => Boolean(id));
  const kookIds = claimed.session.players
    .filter((player) => !player.profileId)
    .map((player) => player.kookUserId);

  const [profilesById, profilesByKook, reporterProfile, reportedGameIds] = await Promise.all([
    profileIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { id: { in: profileIds } },
          select: {
            id: true,
            kookId: true,
            displayName: true,
            riotName: true,
            riotTag: true,
            chinaServerId: true,
            openId: true,
          },
        })
      : Promise.resolve([]),
    kookIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { kookId: { in: kookIds } },
          select: {
            id: true,
            kookId: true,
            displayName: true,
            riotName: true,
            riotTag: true,
            chinaServerId: true,
            openId: true,
          },
        })
      : Promise.resolve([]),
    prisma.accountProfile.findFirst({
      where: { kookId: claimed.requestedByKookId },
      select: {
        id: true,
        kookId: true,
        displayName: true,
        riotName: true,
        riotTag: true,
        chinaServerId: true,
        openId: true,
      },
    }),
    reportedLzyumiGameIds([], claimed.sessionId),
  ]);

  const profileById = new Map(profilesById.map((profile) => [profile.id, profile]));
  const profileByKook = new Map(profilesByKook.map((profile) => [profile.kookId!, profile]));

  return {
    action,
    id: claimed.id,
    sessionId: claimed.sessionId,
    requestedByKookId: claimed.requestedByKookId,
    responseChannelId: claimed.responseChannelId,
    attempts: claimed.attempts,
    session: {
      id: claimed.session.id,
      gameLabel: claimed.session.gameLabel,
      createdAt: claimed.session.createdAt.toISOString(),
      players: claimed.session.players.map((player) => {
        const profile =
          (player.profileId ? profileById.get(player.profileId) : null) ??
          profileByKook.get(player.kookUserId) ??
          null;

        return {
          kookUserId: player.kookUserId,
          displayName: player.displayName,
          side: player.side,
          riotName: player.riotName || profile?.riotName || null,
          riotTag: player.riotTag || profile?.riotTag || null,
          chinaServerId: profile?.chinaServerId ?? null,
          openId: profile?.openId ?? null,
        };
      }),
    },
    reporter: reporterProfile,
    reportedGameIds,
  };
}

export async function completeInhouseReportJob({
  jobId,
  rawMatchData,
  reply,
}: {
  jobId: string;
  rawMatchData: ReportJobRawMatchData;
  reply?: string | null;
}) {
  const gameId = clean(rawMatchData.gameId);
  if (!gameId) {
    throw new Error("rawMatchData.gameId is required.");
  }

  const job = await prisma.inhouseReportJob.findUnique({
    where: { id: jobId },
    include: { session: true },
  });

  if (!job) throw new Error("Report job not found.");

  const rawPayload = toJson(rawMatchData);

  await prisma.$transaction([
    prisma.inhouseSession.update({
      where: { id: job.sessionId },
      data: {
        reportRawJson: toJson({
          source: "kook-report-preview",
          pendingConfirmation: {
            reporterKookUserId: job.requestedByKookId,
            gameId,
            createdAt: new Date().toISOString(),
            rawMatchData: rawMatchData as unknown,
          },
        }),
      },
    }),
    prisma.inhouseReportJob.update({
      where: { id: job.id },
      data: {
        status: "FOUND",
        rawMatchData: rawPayload,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        completedAt: new Date(),
      },
    }),
  ]);

  return {
    job,
    reply:
      clean(reply) ||
      [
        `Report check: ${job.session.gameLabel ?? "Ranked Inhouse"}`,
        "",
        "I found a matching ECL.GG inhouse game.",
        "",
        "Type !yes to submit, or !no to cancel.",
      ].join("\n"),
  };
}

export async function queueInhouseReportConfirmation({
  sessionId,
  requestedByKookId,
}: {
  sessionId: string;
  requestedByKookId: string;
}) {
  const job = await prisma.inhouseReportJob.findFirst({
    where: {
      sessionId,
      requestedByKookId,
      status: { in: ["FOUND", "CONFIRM_FAILED", ...REPORT_CONFIRMATION_ACTIVE_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!job?.rawMatchData) {
    throw new Error("The saved report preview is missing its worker result. Type !report again.");
  }

  if ((REPORT_CONFIRMATION_ACTIVE_STATUSES as readonly string[]).includes(job.status)) {
    return { job, queued: false };
  }

  const queued = await prisma.inhouseReportJob.updateMany({
    where: { id: job.id, status: { in: ["FOUND", "CONFIRM_FAILED"] } },
    data: {
      status: "CONFIRM_PENDING",
      attempts: 0,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      completedAt: null,
    },
  });

  if (queued.count !== 1) {
    const active = await prisma.inhouseReportJob.findFirst({
      where: {
        id: job.id,
        status: { in: [...REPORT_CONFIRMATION_ACTIVE_STATUSES] },
      },
    });
    if (active) return { job: active, queued: false };
    throw new Error("The report confirmation changed before it could be queued. Check !status before retrying.");
  }

  return {
    job: await prisma.inhouseReportJob.findUniqueOrThrow({ where: { id: job.id } }),
    queued: true,
  };
}

export async function completeInhouseReportConfirmationJob({
  jobId,
}: {
  jobId: string;
}) {
  const changed = await prisma.inhouseReportJob.updateMany({
    where: { id: jobId, status: "CONFIRM_PROCESSING" },
    data: {
      status: "CONFIRMED",
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
    },
  });
  const job = await prisma.inhouseReportJob.findUnique({ where: { id: jobId } });
  if (!job || (changed.count !== 1 && job.status !== "CONFIRMED")) {
    throw new Error("The report confirmation is not currently being processed.");
  }
  return job;
}

export async function retryInhouseReportConfirmationJob({
  jobId,
  error,
}: {
  jobId: string;
  error: string;
}) {
  const changed = await prisma.inhouseReportJob.updateMany({
    where: { id: jobId, status: "CONFIRM_PROCESSING" },
    data: {
      status: "CONFIRM_PENDING",
      lastError: clean(error) || "Confirmation will be retried.",
      lockedAt: null,
      lockedBy: null,
      completedAt: null,
    },
  });
  if (changed.count !== 1) {
    throw new Error("The report confirmation is not currently being processed.");
  }
  return prisma.inhouseReportJob.findUniqueOrThrow({ where: { id: jobId } });
}

export async function failInhouseReportConfirmationJob({
  jobId,
  error,
}: {
  jobId: string;
  error: string;
}) {
  const changed = await prisma.inhouseReportJob.updateMany({
    where: { id: jobId, status: "CONFIRM_PROCESSING" },
    data: {
      status: "CONFIRM_FAILED",
      lastError: clean(error) || "The report confirmation failed.",
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
    },
  });
  if (changed.count !== 1) {
    throw new Error("The report confirmation is not currently being processed.");
  }
  return prisma.inhouseReportJob.findUniqueOrThrow({ where: { id: jobId } });
}

export async function failInhouseReportJob({
  jobId,
  error,
}: {
  jobId: string;
  error: string;
}) {
  return prisma.inhouseReportJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      lastError: clean(error) || "Report Engine could not find a matching inhouse game.",
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
    },
  });
}
