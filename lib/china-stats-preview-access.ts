const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChinaStatsPreviewAccessEnvironment = Partial<Record<
  "NODE_ENV" | "CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS",
  string | undefined
>>;

type ChinaStatsPreviewProfileDatabase = {
  accountProfile: {
    findFirst(args: {
      where: { userId: string; accountStatus: "ACTIVE"; verificationStatus: "VERIFIED" };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

export function parseChinaStatsPreviewAllowedProfileIds(value: string | undefined) {
  const entries = value?.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? [];
  if (entries.length === 0 || entries.some((entry) => !PROFILE_ID_PATTERN.test(entry))) {
    return null;
  }
  return new Set(entries);
}

export function isChinaStatsPreviewProfileAllowed(
  profileId: string | null | undefined,
  environment: ChinaStatsPreviewAccessEnvironment = process.env,
) {
  const configured = environment.CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS;
  if (environment.NODE_ENV === "development" && configured === undefined) return true;
  const allowed = parseChinaStatsPreviewAllowedProfileIds(configured);
  return Boolean(profileId && allowed?.has(profileId.trim().toLowerCase()));
}

export async function resolveChinaStatsPreviewAccess({
  userId,
  database,
  environment = process.env,
}: {
  userId: string;
  database: ChinaStatsPreviewProfileDatabase;
  environment?: ChinaStatsPreviewAccessEnvironment;
}) {
  const profile = await database.accountProfile.findFirst({
    where: {
      userId,
      accountStatus: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    select: { id: true },
  });
  return isChinaStatsPreviewProfileAllowed(profile?.id, environment);
}
