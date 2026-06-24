import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { refreshAccountProfileStats } from "@/lib/account-stats-refresh";
import { createUniqueKookVerification, getKookVerificationExpiresAt } from "@/lib/kook-verification";
import { formatLzyumiRank, getLzyumiRankRows } from "@/lib/hub-profile";
import { getChinaServer, fetchLzyumiRecentStat, fetchLzyumiRankedGames, lookupLzyumiIdentity } from "@/lib/lzyumi";
import { syncPlayerForProfile } from "@/lib/player-profile-sync";
import { normalizeRiotPart, normalizeRiotTag } from "@/lib/riot-id";

type ProfilePayload = {
  displayName?: string;
  riotName?: string;
  riotTag?: string;
  chinaServerId?: string | number;
  chinaServerName?: string;
  openId?: string;
  kookUsername?: string;
  kookId?: string;
  wechatId?: string;
  primaryRole?: string;
  secondaryRole?: string;
  currentRank?: string;
  nationality?: string;
  timezone?: string;
  bio?: string;
  avatarStyle?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  dashboardTheme?: string;
  championPool?: unknown;
  privacySettings?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function required(value: unknown) {
  return clean(value).length > 0;
}

function normalizeRiotFields(payload: Pick<ProfilePayload, "riotName" | "riotTag">) {
  return {
    riotName: normalizeRiotPart(payload.riotName),
    riotTag: normalizeRiotTag(payload.riotTag),
  };
}

function riotValidationError(riotName: string, riotTag: string) {
  if (!riotName || !riotTag) {
    return "Riot ID must include a Riot name and tag number.";
  }

  if (riotName.includes("#")) {
    return "Riot name must not include '#'. Enter only the name part.";
  }

  if (riotTag.includes("#") || !/^\d+$/.test(riotTag)) {
    return "Riot tag must be numbers only without '#'.";
  }

  return null;
}

function cleanNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(clean(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function jsonField(value: unknown) {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
}

function hasRankedGames(value: unknown) {
  if (!value || typeof value !== "object") return false;

  const rankedGames = value as { soloGames?: unknown; flexGames?: unknown };

  return (
    (Array.isArray(rankedGames.soloGames) && rankedGames.soloGames.length > 0) ||
    (Array.isArray(rankedGames.flexGames) && rankedGames.flexGames.length > 0)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function hasLzyumiRankRows(value: unknown) {
  const root = asRecord(value);
  const data = asRecord(root?.data);
  const battleInfo = asRecord(root?.battleInfo) ?? asRecord(data?.battleInfo);
  const rows = battleInfo?.mapOneInfoList ?? data?.mapOneInfoList;

  return Array.isArray(rows) && rows.length > 0;
}

function getCurrentRankFromRawProfile(value: unknown) {
  const ranks = getLzyumiRankRows(value);
  const rank = ranks.solo ?? ranks.flex;
  const formatted = formatLzyumiRank(rank);

  return formatted.label === "Unranked" ? null : formatted.label;
}

function needsInitialLzyumiRefresh(profile: {
  lzyumiRawProfile?: unknown;
  lzyumiRecentStat?: unknown;
  lzyumiRankedGames?: unknown;
}) {
  return !profile.lzyumiRawProfile || !profile.lzyumiRecentStat || !profile.lzyumiRankedGames;
}

async function runInitialLzyumiRefresh(profile: {
  id: string;
  openId: string | null;
  chinaServerId: number | null;
  riotName: string;
  riotTag: string | null;
  lzyumiRawProfile?: unknown;
  lzyumiRecentStat?: unknown;
  lzyumiRankedGames?: unknown;
}) {
  if (!needsInitialLzyumiRefresh(profile)) return;

  try {
    await refreshAccountProfileStats(profile);
  } catch (error) {
    console.warn("Initial Lzyumi refresh failed:", error);
  }
}

async function resolveLzyumiIdentity(body: ProfilePayload) {
  const riotName = clean(body.riotName);
  const riotTag = clean(body.riotTag);
  const server = getChinaServer(cleanNumber(body.chinaServerId), clean(body.chinaServerName));

  if (!riotName || !riotTag) return null;

  try {
    const identity = await lookupLzyumiIdentity({
      riotName,
      riotTag,
      areaId: server.id,
    });

    // Fetch recent stat and ranked games in parallel if we have an openId
    const openId = identity.status === "matched" ? identity.openId : identity.rawProfile?.battleInfo?.openId;
    let recentStat = null;
    let rankedGames = null;
    if (openId) {
      try {
        recentStat = await fetchLzyumiRecentStat({ openId, areaId: server.id });
      } catch (err) {
        console.warn("Lzyumi recent stat fetch failed:", err);
      }
    }
    try {
      rankedGames = await fetchLzyumiRankedGames({ riotName, areaId: server.id });
    } catch (err) {
      console.warn("Lzyumi ranked games fetch failed:", err);
    }

    return { identity, recentStat, rankedGames };
  } catch (error) {
    console.warn("Lzyumi identity lookup failed:", error);
    return null;
  }
}

function lzyumiData(body: ProfilePayload, result: Awaited<ReturnType<typeof resolveLzyumiIdentity>>) {
  const server = getChinaServer(cleanNumber(body.chinaServerId), clean(body.chinaServerName));
  const now = new Date();
  const identity = result?.identity ?? null;
  const recentStat = result?.recentStat ?? null;
  const rankedGames = result?.rankedGames ?? null;

  if (identity?.status === "mismatch") {
    throw new Error(
      `ecl.gg resolved ${identity.resolvedName ?? "another account"} instead of ${clean(
        body.riotName,
      )}#${clean(body.riotTag)}.`,
    );
  }

  return {
    chinaServerId: identity?.areaId ?? server.id,
    chinaServerName: identity?.areaName ?? server.name,
    openId:
      identity?.status === "matched"
        ? identity.openId
        : clean(body.openId) || undefined,
    lzyumiVerifiedAt: identity?.status === "matched" ? now : undefined,
    lzyumiLastLookupAt: identity?.status === "matched" ? now : undefined,
    lzyumiRawProfile:
      identity?.status === "matched" && identity.rawProfile
        ? (identity.rawProfile as Prisma.InputJsonValue)
        : undefined,
    lzyumiRecentStat:
      recentStat && recentStat.data ? (recentStat as Prisma.InputJsonValue) : undefined,
    lzyumiRankedGames:
      hasRankedGames(rankedGames) ? (rankedGames as Prisma.InputJsonValue) : undefined,
    currentRank:
      identity?.status === "matched"
        ? getCurrentRankFromRawProfile(identity.rawProfile)
        : undefined,
  };
}

export async function GET(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: {
      userId: account.id,
    },
    include: {
      kookVerifications: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as ProfilePayload;
  const normalizedRiot = normalizeRiotFields(body);
  const riotError = riotValidationError(normalizedRiot.riotName, normalizedRiot.riotTag);

  if (riotError) {
    return NextResponse.json({ message: riotError }, { status: 400 });
  }

  const normalizedBody: ProfilePayload = {
    ...body,
    riotName: normalizedRiot.riotName,
    riotTag: normalizedRiot.riotTag,
  };

  const identity = await resolveLzyumiIdentity(normalizedBody);
  let lzyumi;

  try {
    lzyumi = lzyumiData(normalizedBody, identity);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "ecl.gg identity mismatch." },
      { status: 409 },
    );
  }

  const missing = [
    ["displayName", normalizedBody.displayName],
    ["riotName", normalizedBody.riotName],
    ["riotTag", normalizedBody.riotTag],
    ["kookUsername", normalizedBody.kookUsername],
    ["primaryRole", normalizedBody.primaryRole],
    ["timezone", normalizedBody.timezone],
  ].filter(([, value]) => !required(value));

  if (missing.length > 0) {
    return NextResponse.json(
      { message: "Missing required fields", fields: missing.map(([field]) => field) },
      { status: 400 }
    );
  }

  const expiresAt = getKookVerificationExpiresAt();

  let profile = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: {
        id: account.id,
      },
      update: {
        email: account.email,
      },
      create: {
        id: account.id,
        email: account.email,
      },
    });

    const savedProfile = await tx.accountProfile.upsert({
      where: {
        userId: user.id,
      },
      update: {
        displayName: clean(body.displayName),
        email: account.email,
        riotName: clean(normalizedBody.riotName),
        riotTag: clean(normalizedBody.riotTag),
        chinaServerId: lzyumi.chinaServerId,
        chinaServerName: lzyumi.chinaServerName,
        openId: lzyumi.openId ?? null,
        lzyumiVerifiedAt: lzyumi.lzyumiVerifiedAt,
        lzyumiLastLookupAt: lzyumi.lzyumiLastLookupAt,
        lzyumiRawProfile: lzyumi.lzyumiRawProfile,
        lzyumiRecentStat: lzyumi.lzyumiRecentStat,
        lzyumiRankedGames: lzyumi.lzyumiRankedGames,
        kookUsername: clean(body.kookUsername),
        wechatId: clean(body.wechatId) || null,
        primaryRole: clean(body.primaryRole),
        secondaryRole: clean(body.secondaryRole) || null,
        currentRank: lzyumi.currentRank ?? (clean(body.currentRank) || null),
        nationality: clean(body.nationality) || null,
        timezone: clean(body.timezone) || null,
        bio: clean(body.bio) || null,
        avatarStyle: clean(body.avatarStyle) || "crest",
        avatarUrl: clean(body.avatarUrl) || null,
        bannerUrl: clean(body.bannerUrl) || null,
        dashboardTheme: clean(body.dashboardTheme) || "crimson",
        championPool: jsonField(body.championPool),
        privacySettings: jsonField(body.privacySettings),
      },
      create: {
        userId: user.id,
        displayName: clean(body.displayName),
        email: account.email,
        riotName: clean(normalizedBody.riotName),
        riotTag: clean(normalizedBody.riotTag),
        chinaServerId: lzyumi.chinaServerId,
        chinaServerName: lzyumi.chinaServerName,
        openId: lzyumi.openId ?? null,
        lzyumiVerifiedAt: lzyumi.lzyumiVerifiedAt,
        lzyumiLastLookupAt: lzyumi.lzyumiLastLookupAt,
        lzyumiRawProfile: lzyumi.lzyumiRawProfile,
        lzyumiRecentStat: lzyumi.lzyumiRecentStat,
        lzyumiRankedGames: lzyumi.lzyumiRankedGames,
        kookUsername: clean(body.kookUsername),
        kookId: null,
        wechatId: clean(body.wechatId) || null,
        primaryRole: clean(body.primaryRole),
        secondaryRole: clean(body.secondaryRole) || null,
        currentRank: lzyumi.currentRank ?? (clean(body.currentRank) || null),
        nationality: clean(body.nationality) || null,
        timezone: clean(body.timezone) || null,
        bio: clean(body.bio) || null,
        avatarStyle: clean(body.avatarStyle) || "crest",
        avatarUrl: clean(body.avatarUrl) || null,
        bannerUrl: clean(body.bannerUrl) || null,
        dashboardTheme: clean(body.dashboardTheme) || "crimson",
        championPool: jsonField(body.championPool) ?? {},
        privacySettings: jsonField(body.privacySettings) ?? {},
      },
    });

    const existingPending = await tx.kookVerification.findFirst({
      where: {
        profileId: savedProfile.id,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!existingPending && savedProfile.verificationStatus !== "VERIFIED") {
      await createUniqueKookVerification(tx, savedProfile.id, expiresAt);
    }

    return tx.accountProfile.findUnique({
      where: {
        id: savedProfile.id,
      },
      include: {
        kookVerifications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });
  });

  if (profile) {
    await runInitialLzyumiRefresh(profile);
    profile = await prisma.accountProfile.findUnique({
      where: {
        id: profile.id,
      },
      include: {
        kookVerifications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as ProfilePayload;
  const shouldResolveLzyumi =
    body.riotName !== undefined ||
    body.riotTag !== undefined ||
    body.chinaServerId !== undefined ||
    body.chinaServerName !== undefined;
  const existing = shouldResolveLzyumi
    ? await prisma.accountProfile.findUnique({ where: { userId: account.id } })
    : null;
  const mergedForLookup: ProfilePayload = existing
    ? {
        riotName: existing.riotName,
        riotTag: existing.riotTag,
        chinaServerId: existing.chinaServerId ?? undefined,
        chinaServerName: existing.chinaServerName ?? undefined,
        ...body,
      }
    : body;
  const identity = shouldResolveLzyumi ? await resolveLzyumiIdentity(mergedForLookup) : null;
  let lzyumi: ReturnType<typeof lzyumiData> | null = null;

  try {
    lzyumi = shouldResolveLzyumi ? lzyumiData(mergedForLookup, identity) : null;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "ecl.gg identity mismatch." },
      { status: 409 },
    );
  }

  const profile = await prisma.accountProfile.update({
    where: {
      userId: account.id,
    },
    data: {
      displayName: body.displayName === undefined ? undefined : clean(body.displayName),
      riotName: body.riotName === undefined ? undefined : normalizeRiotPart(body.riotName),
      riotTag: body.riotTag === undefined ? undefined : normalizeRiotTag(body.riotTag),
      chinaServerId: lzyumi ? lzyumi.chinaServerId : undefined,
      chinaServerName: lzyumi ? lzyumi.chinaServerName : undefined,
      openId:
        lzyumi?.openId ??
        (body.openId === undefined ? undefined : clean(body.openId) || null),
      lzyumiVerifiedAt: lzyumi?.lzyumiVerifiedAt,
      lzyumiLastLookupAt: lzyumi?.lzyumiLastLookupAt,
      lzyumiRawProfile:
        lzyumi?.lzyumiRawProfile === undefined
          ? undefined
          : hasLzyumiRankRows(lzyumi.lzyumiRawProfile) || !hasLzyumiRankRows(existing?.lzyumiRawProfile)
            ? lzyumi.lzyumiRawProfile
            : undefined,
      lzyumiRecentStat: lzyumi?.lzyumiRecentStat,
      lzyumiRankedGames: lzyumi?.lzyumiRankedGames,
      kookUsername: body.kookUsername === undefined ? undefined : clean(body.kookUsername),
      wechatId: body.wechatId === undefined ? undefined : clean(body.wechatId) || null,
      primaryRole: body.primaryRole === undefined ? undefined : clean(body.primaryRole),
      secondaryRole: body.secondaryRole === undefined ? undefined : clean(body.secondaryRole) || null,
      currentRank:
        lzyumi?.currentRank ??
        (body.currentRank === undefined ? undefined : clean(body.currentRank) || null),
      nationality: body.nationality === undefined ? undefined : clean(body.nationality) || null,
      timezone: body.timezone === undefined ? undefined : clean(body.timezone) || null,
      bio: body.bio === undefined ? undefined : clean(body.bio) || null,
      avatarStyle: body.avatarStyle === undefined ? undefined : clean(body.avatarStyle) || "crest",
      avatarUrl: body.avatarUrl === undefined ? undefined : clean(body.avatarUrl) || null,
      bannerUrl: body.bannerUrl === undefined ? undefined : clean(body.bannerUrl) || null,
      dashboardTheme: body.dashboardTheme === undefined ? undefined : clean(body.dashboardTheme) || "crimson",
      championPool: jsonField(body.championPool),
      privacySettings: jsonField(body.privacySettings),
    },
    include: {
      kookVerifications: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (profile.verificationStatus === "VERIFIED" && profile.accountStatus === "ACTIVE") {
    await syncPlayerForProfile(profile);
  }

  return NextResponse.json({ profile });
}
