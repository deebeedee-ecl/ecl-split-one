import { Prisma } from "@prisma/client";
import { reportedLzyumiGameIds } from "@/lib/lzyumi-report-dedupe";
import { prisma } from "@/lib/prisma";

export const REPORT_JOB_ACTIVE_STATUSES = ["PENDING", "PROCESSING"] as const;
export const REPORT_JOB_LOCK_MS = 2 * 60 * 1000;

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
  const job = await prisma.inhouseReportJob.findFirst({
    where: {
      OR: [
        { status: "PENDING" },
        {
          status: "PROCESSING",
          lockedAt: { lt: staleBefore },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      session: {
        include: { players: true },
      },
    },
  });

  if (!job) return null;

  const claimed = await prisma.inhouseReportJob.update({
    where: { id: job.id },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lockedAt: new Date(),
      lockedBy: workerId,
      lastError: null,
    },
    include: {
      session: {
        include: { players: true },
      },
    },
  });

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
      completedAt: new Date(),
    },
  });
}
