import { Prisma } from "@prisma/client";
import { readFile } from "fs/promises";
import path from "path";
import { STARTING_ELO } from "@/lib/elo";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import {
  getFrozenInhouseLeaderboardRows,
  type InhouseLeaderboardRow,
} from "@/lib/inhouse-leaderboard";
import { translateLzyumiTier } from "@/lib/hub-profile";
import {
  fetchLzyumiMatchDetail,
  fetchLzyumiRecentGames,
  findPlayerInDetail,
  findPlayerInDetailByRiotId,
  getChinaServer,
  type LzyumiDetailResponse,
  type LzyumiLookupResponse,
  type LzyumiPlayerDetail,
  type LzyumiRecentMatch,
} from "@/lib/lzyumi";
import {
  RANKED_INHOUSE_CHANNEL_ID,
  normalizeInhouseMembers,
  type KookInhouseMember,
} from "@/lib/kook-inhouse";
import { prisma } from "@/lib/prisma";
import {
  formatRiotId,
  normalizeRiotPart,
  normalizeRiotTag,
  riotIdKey,
  riotNameKey,
  splitRiotId,
} from "@/lib/riot-id";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const ACTIVE_REPORT_HOURS = 48;
const REPORT_CONFIRM_MINUTES = 20;
const REQUIRED_REPORT_MATCHES = 10;
const REPORT_CANDIDATE_LIMIT = 16;
const LZYUMI_INHOUSE_LABEL = "\u65b0\u6a21\u5f0f";

let championNamesCache: Map<string, string> | null = null;

type PendingKookReport = {
  source: "kook-report-preview";
  pendingConfirmation: {
    reporterKookUserId: string;
    gameId: string;
    createdAt: string;
    rawMatchData: {
      profile: LzyumiLookupResponse;
      gameId: string;
      detail: LzyumiDetailResponse;
    };
  };
};

function parseScore(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : null;
}

function formatLzyumiResult(value: unknown) {
  const normalized = clean(value).toLowerCase();
  if (["1", "true", "win"].includes(normalized)) return "Win";
  if (["0", "false", "fail", "loss", "lose"].includes(normalized)) return "Loss";
  return "Unknown";
}

async function loadChampionNamesForKook() {
  if (championNamesCache) return championNamesCache;

  const file = await readFile(
    path.join(process.cwd(), "public", "lol", "champions", "champions.json"),
    "utf8",
  );
  const champions = JSON.parse(file.replace(/^\uFEFF/, "")) as Array<{
    id: number;
    name: string;
  }>;
  championNamesCache = new Map(champions.map((champion) => [String(champion.id), champion.name]));
  return championNamesCache;
}

function championName(championId: unknown, championNames: ReadonlyMap<string, string>) {
  const key = clean(String(championId ?? ""));
  if (!key) return "Champion unavailable";
  return championNames.get(key) ?? `Champion ${key}`;
}

function roleName(position: unknown) {
  const normalized = clean(position).toUpperCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    TOP: "Top",
    TOP_LANE: "Top",
    JUNGLE: "Jungle",
    JGL: "Jungle",
    MID: "Mid",
    MIDDLE: "Mid",
    MID_LANE: "Mid",
    ADC: "ADC",
    BOT: "ADC",
    BOTTOM: "ADC",
    BOTTOM_LANE: "ADC",
    SUPPORT: "Support",
    SUP: "Support",
    UTILITY: "Support",
  };

  return labels[normalized] ?? "Role unavailable";
}

function formatGameTime(match: LzyumiRecentMatch) {
  if (match.titleTime) return match.titleTime;
  if (match.title?.includes("<br>")) return match.title.split("<br>").at(-1)?.trim() || "Unknown time";
  return match.title || "Unknown time";
}

function parseLzyumiGameTime(match: LzyumiRecentMatch, referenceDate: Date) {
  const raw = `${match.titleTime ?? ""} ${match.title ?? ""}`;
  const parsed = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!parsed) return null;

  const year = referenceDate.getFullYear();
  const candidate = new Date(
    year,
    Number(parsed[1]) - 1,
    Number(parsed[2]),
    Number(parsed[3]),
    Number(parsed[4]),
    Number(parsed[5] ?? 0),
  );

  if (Number.isNaN(candidate.getTime())) return null;

  const monthDelta = candidate.getTime() - referenceDate.getTime();
  if (monthDelta > 180 * 24 * 60 * 60 * 1000) {
    candidate.setFullYear(year - 1);
  }

  return candidate;
}

function reportCandidateSortValue(
  candidate: ReportMatchCandidate,
  sessionCreatedAt: Date,
) {
  const gameTime = parseLzyumiGameTime(candidate.recentMatch, sessionCreatedAt);
  if (!gameTime) return Number.MAX_SAFE_INTEGER;

  const delta = gameTime.getTime() - sessionCreatedAt.getTime();
  const beforePenalty = delta < 0 ? 24 * 60 * 60 * 1000 : 0;
  return Math.abs(delta) + beforePenalty;
}

function formatReporterLine(
  player: LzyumiPlayerDetail | null,
  championNames: ReadonlyMap<string, string>,
) {
  if (!player) return "Player details unavailable.";

  const riotId = clean(player.nickNameStr || player.nickName) || "Unknown player";
  const kda = parseScore(player.scoreInfo) ?? "KDA unknown";
  const result = formatLzyumiResult(player.win);
  const champion = championName(player.detailChampionId, championNames);
  const role = roleName(player.position);

  return [
    `Player: ${riotId}`,
    `Result: ${result}`,
    `Champion: ${champion}`,
    `Role: ${role}`,
    `KDA: ${kda}`,
  ].join("\n");
}

function playerRiotKeys(player: LzyumiPlayerDetail) {
  return [player.nickNameStr, player.nickName]
    .map(splitRiotId)
    .map((parts) => riotIdKey(parts.riotName, parts.riotTag))
    .filter((value): value is string => Boolean(value));
}

function playerRiotNameKeys(player: LzyumiPlayerDetail) {
  return [player.nickNameStr, player.nickName]
    .map(splitRiotId)
    .map((parts) => riotNameKey(parts.riotName))
    .filter((value): value is string => Boolean(value));
}

async function matchSessionPlayersToDetail(
  session: Awaited<ReturnType<typeof findReportSessions>>[number],
  detail: LzyumiDetailResponse,
) {
  const detailPlayers = detail.data?.wgBattleDetailInfo ?? [];
  const detailByRiotKey = new Map<string, LzyumiPlayerDetail>();
  const detailByNameKey = new Map<string, LzyumiPlayerDetail | null>();

  for (const player of detailPlayers) {
    for (const key of playerRiotKeys(player)) {
      detailByRiotKey.set(key, player);
    }
    for (const key of playerRiotNameKeys(player)) {
      detailByNameKey.set(key, detailByNameKey.has(key) ? null : player);
    }
  }

  const missingProfileIds = session.players
    .filter((player) => (!player.riotName || !player.riotTag) && player.profileId)
    .map((player) => player.profileId as string);
  const missingKookIds = session.players
    .filter((player) => (!player.riotName || !player.riotTag) && !player.profileId)
    .map((player) => player.kookUserId);

  const [profiles, kookProfiles] = await Promise.all([
    missingProfileIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { id: { in: missingProfileIds } },
          select: { id: true, riotName: true, riotTag: true },
        })
      : Promise.resolve([]),
    missingKookIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { kookId: { in: missingKookIds } },
          select: { kookId: true, riotName: true, riotTag: true },
        })
      : Promise.resolve([]),
  ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const profileByKook = new Map(kookProfiles.map((profile) => [profile.kookId!, profile]));
  const matched = [];
  const missing = [];

  for (const sessionPlayer of session.players) {
    const profile =
      (sessionPlayer.profileId ? profileById.get(sessionPlayer.profileId) : null) ??
      profileByKook.get(sessionPlayer.kookUserId) ??
      null;
    const riotName = sessionPlayer.riotName || profile?.riotName || null;
    const riotTag = normalizeRiotTag(sessionPlayer.riotTag || profile?.riotTag) || null;
    const key = riotIdKey(riotName, riotTag);
    const nameKey = riotNameKey(riotName);
    const detailPlayer =
      (key ? detailByRiotKey.get(key) : undefined) ??
      (nameKey ? detailByNameKey.get(nameKey) ?? undefined : undefined);

    if (detailPlayer) {
      matched.push(sessionPlayer.displayName);
    } else {
      missing.push(sessionPlayer.displayName);
    }
  }

  return { matched, missing };
}

type ReportMatchCandidate = {
  profile: LzyumiLookupResponse;
  recentMatch: LzyumiRecentMatch;
  detail: LzyumiDetailResponse;
  player: LzyumiPlayerDetail | null;
  rosterMatch: Awaited<ReturnType<typeof matchSessionPlayersToDetail>>;
};

async function findMatchingReportCandidate({
  session,
  profile,
  areaId,
}: {
  session: Awaited<ReturnType<typeof findReportSessions>>[number];
  profile: NonNullable<Awaited<ReturnType<typeof findVerifiedProfile>>>;
  areaId: number;
}): Promise<ReportMatchCandidate | null> {
  const lookupNames = Array.from(
    new Set(
      [
        profile.riotName,
        formatRiotId(profile.riotName, profile.riotTag),
      ].filter((value): value is string => Boolean(clean(value))),
    ),
  );

  let lookupProfile: LzyumiLookupResponse | null = null;
  let recentGames: LzyumiRecentMatch[] = [];

  for (const riotName of lookupNames) {
    const result = await fetchLzyumiRecentGames({ riotName, areaId });
    lookupProfile = result.profile ?? lookupProfile;
    recentGames = result.games;
    if (lookupProfile?.battleInfo?.openId && recentGames.length > 0) break;
  }

  const openId = lookupProfile?.battleInfo?.openId;
  if (!lookupProfile || !openId || recentGames.length === 0) return null;

  const candidateGameIds = recentGames
    .map((game) => game.gameId)
    .filter((gameId): gameId is string => Boolean(gameId));
  const reportedSessions =
    candidateGameIds.length > 0
      ? await prisma.inhouseSession.findMany({
          where: {
            lzyumiGameId: { in: candidateGameIds },
            NOT: { id: session.id },
          },
          select: { lzyumiGameId: true },
        })
      : [];
  const reportedGameIds = new Set(
    reportedSessions
      .map((reportedSession) => reportedSession.lzyumiGameId)
      .filter((gameId): gameId is string => Boolean(gameId)),
  );
  const sortedCandidates = [...recentGames]
    .filter((game) => game.gameId && !reportedGameIds.has(game.gameId))
    .sort((a, b) => {
      const aIsInhouse = clean(a.title).includes(LZYUMI_INHOUSE_LABEL) ? 0 : 1;
      const bIsInhouse = clean(b.title).includes(LZYUMI_INHOUSE_LABEL) ? 0 : 1;
      return aIsInhouse - bIsInhouse;
    })
    .slice(0, REPORT_CANDIDATE_LIMIT);

  const exactMatches: ReportMatchCandidate[] = [];
  let bestCandidate: ReportMatchCandidate | null = null;

  for (const recentMatch of sortedCandidates) {
    if (!recentMatch.gameId) continue;
    const detail = await fetchLzyumiMatchDetail({
      openId,
      gameId: recentMatch.gameId,
      areaId,
    });
    const rosterMatch = await matchSessionPlayersToDetail(session, detail);
    const player =
      findPlayerInDetail(detail, openId) ??
      findPlayerInDetailByRiotId(detail, profile.riotName, normalizeRiotTag(profile.riotTag));

    const candidate = {
      profile: lookupProfile,
      recentMatch,
      detail,
      player,
      rosterMatch,
    };

    if (!bestCandidate || rosterMatch.matched.length > bestCandidate.rosterMatch.matched.length) {
      bestCandidate = candidate;
    }

    if (rosterMatch.matched.length >= REQUIRED_REPORT_MATCHES) {
      exactMatches.push(candidate);
    }
  }

  if (exactMatches.length > 0) {
    return exactMatches.sort(
      (a, b) =>
        reportCandidateSortValue(a, session.createdAt) -
        reportCandidateSortValue(b, session.createdAt),
    )[0];
  }

  return bestCandidate;
}

function pendingReportFromJson(value: unknown): PendingKookReport["pendingConfirmation"] | null {
  if (!value || typeof value !== "object") return null;
  const source = "source" in value ? value.source : null;
  const pendingConfirmation = "pendingConfirmation" in value ? value.pendingConfirmation : null;

  if (source !== "kook-report-preview" || !pendingConfirmation || typeof pendingConfirmation !== "object") {
    return null;
  }

  const pending = pendingConfirmation as PendingKookReport["pendingConfirmation"];
  if (!pending.reporterKookUserId || !pending.gameId || !pending.rawMatchData) return null;

  return pending;
}

async function findReportSessions(kookUserId: string) {
  const activeSince = new Date(Date.now() - ACTIVE_REPORT_HOURS * 60 * 60 * 1000);

  return prisma.inhouseSession.findMany({
    where: {
      status: "ASSIGNED",
      lzyumiGameId: null,
      createdAt: { gte: activeSince },
      players: { some: { kookUserId } },
    },
    include: { players: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

function pickReportSession<T extends { id: string }>(sessions: T[], args: string[] = []) {
  const selector = clean(args[0]);
  if (!selector) return sessions.length === 1 ? sessions[0] : null;

  const numeric = Number(selector);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= sessions.length) {
    return sessions[numeric - 1];
  }

  return sessions.find((session) => session.id.startsWith(selector) || session.id === selector) ?? null;
}

function multipleSessionMessage(sessions: Awaited<ReturnType<typeof findReportSessions>>) {
  return [
    "You have multiple pending inhouses.",
    "",
    ...sessions.map((session, index) => {
      const blue = session.players.filter((player) => player.side === "BLUE").map((player) => player.displayName).join(", ");
      const red = session.players.filter((player) => player.side === "RED").map((player) => player.displayName).join(", ");
      return `${index + 1}. ${session.gameLabel ?? "Ranked Inhouse"} - Blue: ${blue || "-"} / Red: ${red || "-"}`;
    }),
    "",
    "Type !report 1, !report 2, etc.",
  ].join("\n");
}

function verifyInstructions() {
  return [
    "To verify your ECL account:",
    "",
    "1. Go to https://eclchina.lol",
    "2. Register or log in",
    "3. Open your Hub/profile",
    "4. Find your KOOK verification code",
    "5. Come back here and type:",
    "",
    "!verify YOURCODE",
    "",
    "Example: !verify AB12CD",
    "",
    "验证 ECL 账号：",
    "1. 打开 https://eclchina.lol",
    "2. 注册或登录",
    "3. 进入 Hub / 个人资料页面",
    "4. 找到 KOOK 验证码",
    "5. 回到 KOOK 输入：!verify 你的验证码",
  ].join("\n");
}

export function formatWelcomeMessage() {
  return [
    "Welcome to the Expat China League (ECL)",
    "欢迎来到 Expat China League（ECL）",
    "",
    "We're a League of Legends community in China, active since 2016 - mixing expats and local players.",
    "我们是一个在中国活跃的英雄联盟社区，成立于2016年，汇聚来自世界各地的玩家与中国本地玩家。",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "Start here / 新手指南:",
    "- Jump into any channel",
    "- DM an admin if you need help",
    "- Check the guide if you're new to CN servers",
    "",
    "- 可以加入任意频道交流",
    "- 有问题可以私信管理员",
    "- 新玩家请查看新手指南",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "Want to play? / 想参加比赛？",
    "",
    "Find a team, sign up as a free agent, or verify your account for ranked inhouses:",
    "寻找队伍、以自由人身份报名，或验证账号参加排位内战：",
    "",
    "https://eclchina.lol",
    "",
    "To play ranked inhouses, create/log in to your ECL account, open your Hub/profile, copy your KOOK verification code, then type:",
    "如果想参加排位内战，请登录 ECL 账号，进入 Hub / 个人资料页面，复制 KOOK 验证码，然后输入：",
    "",
    "!verify YOURCODE",
  ].join("\n");
}

export function formatHelpMessage() {
  return [
    "ECL KOOK Commands",
    "",
    "!help - show this command list",
    "!verify CODE - verify your ECL account",
    "!me - check if your KOOK account is verified",
    "!rank - show your ECL ladder rank",
    "!leaderboard - show the top 10 ECL players",
    "!inhouse - check/start ranked inhouse",
    "!ready - confirm the 10 players and balance teams",
    "!forceready - admin only: force start if admins accept the risk",
    "!status - show current inhouse status",
    "!report - report the completed inhouse through ECL.GG",
    "!cancel - admin only: cancel the active inhouse session",
    "!welcome - show the ECL welcome message",
  ].join("\n");
}

export function formatVerifyHelpMessage() {
  return verifyInstructions();
}

async function getLeaderboardRows(): Promise<(InhouseLeaderboardRow & { riotId: string | null })[]> {
  return (await getFrozenInhouseLeaderboardRows()).map((row) => ({
    ...row,
    riotId: formatRiotId(row.riotName, row.riotTag),
  }));
}

async function findVerifiedProfile(kookUserId: string) {
  return prisma.accountProfile.findFirst({
    where: {
      kookId: kookUserId,
      verificationStatus: "VERIFIED",
      accountStatus: "ACTIVE",
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      currentRank: true,
      lzyumiVerifiedAt: true,
    },
  });
}

async function findPlayerForProfile(profile: Awaited<ReturnType<typeof findVerifiedProfile>>) {
  if (!profile) return null;

  const riotName = normalizeRiotPart(profile.riotName);
  const riotTag = normalizeRiotTag(profile.riotTag);
  const email = clean(profile.email);

  return prisma.player.findFirst({
    where: {
      OR: [
        ...(riotName && riotTag
          ? [
              {
                riotName: {
                  equals: riotName,
                  mode: "insensitive" as const,
                },
                riotTag: {
                  equals: riotTag,
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
        ...(email
          ? [
              {
                email: {
                  equals: email,
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
      ],
    },
    include: {
      gameStats: {
        where: INHOUSE_MATCH_FILTER,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function formatLeaderboardMessage() {
  const leaderboard = (await getLeaderboardRows()).slice(0, 10);

  if (leaderboard.length === 0) {
    return "The ECL leaderboard is empty for now. Play ranked inhouses to get on the board.";
  }

  return [
    "ECL Top 10",
    "",
    ...leaderboard.map((row) => {
      const riotId = row.riotId ? ` (${row.riotId})` : "";
      return `${row.rank}. ${row.name}${riotId} - ${row.elo} LP - ${row.wins}W/${row.losses}L`;
    }),
  ].join("\n");
}

export async function formatMeMessage(kookUserId: string) {
  const profile = await findVerifiedProfile(kookUserId);

  if (!profile) {
    return [
      "You are not verified yet.",
      "",
      "Go to https://eclchina.lol, create/log in to your account, open your Hub/profile, copy your KOOK verification code, then type:",
      "",
      "!verify YOURCODE",
    ].join("\n");
  }

  const player = await findPlayerForProfile(profile);
  const gamesPlayed = player?.gameStats.length ?? 0;
  const wins = player?.gameStats.filter((stat) => stat.isWin).length ?? 0;
  const losses = gamesPlayed - wins;
  const elo = player?.elo ?? STARTING_ELO;

  return [
    "You are verified.",
    "",
    `Player: ${profile.displayName}`,
    `Riot ID: ${formatRiotId(profile.riotName, profile.riotTag) ?? "-"}`,
    `ECL LP: ${elo}`,
    `Record: ${wins}W/${losses}L`,
    `China rank: ${translateLzyumiTier(profile.currentRank || undefined)}`,
  ].join("\n");
}

export async function formatRankMessage(kookUserId: string) {
  const profile = await findVerifiedProfile(kookUserId);

  if (!profile) {
    return [
      "I cannot show your rank yet because your KOOK account is not verified.",
      "",
      "Use !verify CODE after getting your code from https://eclchina.lol.",
    ].join("\n");
  }

  const player = await findPlayerForProfile(profile);
  const leaderboard = await getLeaderboardRows();
  const row = player ? leaderboard.find((entry) => entry.playerId === player.id) : null;

  if (!row) {
    return [
      `${profile.displayName} is verified but has not played a ranked ECL inhouse yet.`,
      `Starting LP: ${STARTING_ELO}`,
    ].join("\n");
  }

  return [
    `${profile.displayName} is ranked #${row.rank} on ECL.`,
    `LP: ${row.elo}`,
    `Record: ${row.wins}W/${row.losses}L`,
    `Win rate: ${row.winRate}`,
    `Streak: ${row.streak}`,
  ].join("\n");
}

export async function formatStatusMessage(members: KookInhouseMember[] = []) {
  const normalizedMembers = normalizeInhouseMembers(members);
  const activeSession = await prisma.inhouseSession.findFirst({
    where: {
      status: "ASSIGNED",
    },
    include: {
      players: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (activeSession) {
    const blueCount = activeSession.players.filter((player) => player.side === "BLUE").length;
    const redCount = activeSession.players.filter((player) => player.side === "RED").length;

    return [
      "Ranked inhouse is active.",
      "",
      `Session: ${activeSession.id}`,
      `Blue Side: ${blueCount}/5`,
      `Red Side: ${redCount}/5`,
      "",
      "After the game, any player in the match can type !report.",
    ].join("\n");
  }

  if (normalizedMembers.length > 0) {
    const remaining = Math.max(0, 10 - normalizedMembers.length);
    return [
      "Ranked IH status",
      "",
      `Channel: ${RANKED_INHOUSE_CHANNEL_ID}`,
      `Players: ${normalizedMembers.length}/10`,
      remaining > 0 ? `Waiting for: ${remaining} more` : "Ready for !inhouse",
    ].join("\n");
  }

  return [
    "No active ranked inhouse session is saved right now.",
    "",
    "Join the Ranked IH voice channel and type !inhouse to start.",
  ].join("\n");
}

export async function formatReportPreviewMessage(kookUserId: string, args: string[] = []) {
  const profile = await findVerifiedProfile(kookUserId);

  if (!profile) {
    return [
      "I cannot report for you yet because your KOOK account is not verified.",
      "",
      "Use !verify CODE after getting your code from https://eclchina.lol.",
    ].join("\n");
  }

  const sessions = await findReportSessions(kookUserId);

  if (sessions.length === 0) {
    return "No pending inhouse session found for your KOOK account.";
  }

  const session = pickReportSession(sessions, args);

  if (!session) {
    return multipleSessionMessage(sessions);
  }

  const server = getChinaServer(profile.chinaServerId);
  let candidate: ReportMatchCandidate | null;
  try {
    candidate = await findMatchingReportCandidate({
      session,
      profile,
      areaId: server.id,
    });
  } catch (error) {
    console.error("KOOK report ECL.GG lookup failed:", error);
    return "I could not reach ECL.GG for the report check. Please try !report again in a moment.";
  }

  if (!candidate?.recentMatch.gameId || !candidate.detail) {
    return "I could not find a recent ECL.GG match for your Riot account.";
  }

  const rosterMatch = candidate.rosterMatch;
  if (rosterMatch.matched.length < REQUIRED_REPORT_MATCHES) {
    await prisma.inhouseSession.update({
      where: { id: session.id },
      data: { reportRawJson: Prisma.JsonNull },
    });

    return [
      `I searched your recent ECL.GG games, but none look like ${session.gameLabel ?? "this inhouse"}.`,
      "",
      `Closest recent match: ${rosterMatch.matched.length}/10 inhouse players.`,
      rosterMatch.missing.length > 0
        ? `Missing: ${rosterMatch.missing.join(", ")}`
        : "Missing players could not be identified.",
      "",
      "I did not create a report confirmation. Wait for ECL.GG to show the inhouse game, or ask an admin to submit it from the dashboard.",
    ].join("\n");
  }

  const championNames = await loadChampionNamesForKook();

  await prisma.inhouseSession.update({
    where: { id: session.id },
    data: {
      reportRawJson: toJson({
        source: "kook-report-preview",
        pendingConfirmation: {
          reporterKookUserId: kookUserId,
          gameId: candidate.recentMatch.gameId,
          createdAt: new Date().toISOString(),
          rawMatchData: {
            profile: candidate.profile,
            gameId: candidate.recentMatch.gameId,
            detail: candidate.detail,
          },
        },
      } satisfies PendingKookReport),
    },
  });

  return [
    `Report check: ${session.gameLabel ?? "Ranked Inhouse"}`,
    "",
    formatReporterLine(candidate.player, championNames),
    `Time: ${formatGameTime(candidate.recentMatch)}`,
    "",
    "Submit this result?",
    "Type !yes to submit, or !no to cancel.",
  ].join("\n");
}

export async function formatCancelReportMessage(kookUserId: string) {
  const sessions = await findReportSessions(kookUserId);
  const pendingSession = sessions.find((session) => {
    const pending = pendingReportFromJson(session.reportRawJson);
    return pending?.reporterKookUserId === kookUserId;
  });

  if (!pendingSession) {
    return "No pending report confirmation found.";
  }

  await prisma.inhouseSession.update({
    where: { id: pendingSession.id },
    data: { reportRawJson: Prisma.JsonNull },
  });

  return "Cancelled that pending report confirmation.";
}

export async function submitPendingReportMessage(kookUserId: string, origin: string) {
  const sessions = await findReportSessions(kookUserId);
  const pendingSession = sessions.find((session) => {
    const pending = pendingReportFromJson(session.reportRawJson);
    return pending?.reporterKookUserId === kookUserId;
  });

  if (!pendingSession) {
    return "No pending report confirmation found. Type !report first.";
  }

  const pending = pendingReportFromJson(pendingSession.reportRawJson);
  if (!pending) {
    return "No pending report confirmation found. Type !report first.";
  }

  const ageMs = Date.now() - new Date(pending.createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > REPORT_CONFIRM_MINUTES * 60 * 1000) {
    await prisma.inhouseSession.update({
      where: { id: pendingSession.id },
      data: { reportRawJson: Prisma.JsonNull },
    });
    return "That report confirmation expired. Type !report again for a fresh lookup.";
  }

  const reportRes = await fetch(`${origin}/api/kook/inhouse/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ecl-kook-secret": process.env.ECL_KOOK_BOT_SECRET ?? "",
    },
    body: JSON.stringify({
      command: "!report",
      reporterKookUserId: kookUserId,
      sessionId: pendingSession.id,
      rawMatchData: pending.rawMatchData,
    }),
  });

  const payload = await reportRes.json().catch(() => ({}));
  return payload.reply ?? payload.message ?? (reportRes.ok ? "Reported." : "Report failed.");
}

export async function cancelActiveInhouseSession() {
  const activeSession = await prisma.inhouseSession.findFirst({
    where: {
      status: "ASSIGNED",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!activeSession) {
    return "No active ranked inhouse session is saved right now.";
  }

  await prisma.inhouseSession.update({
    where: {
      id: activeSession.id,
    },
    data: {
      status: "CANCELLED",
    },
  });

  return `Cancelled active ranked inhouse session ${activeSession.id}.`;
}
