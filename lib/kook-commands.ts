import { STARTING_ELO } from "@/lib/elo";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import { translateLzyumiTier } from "@/lib/hub-profile";
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
} from "@/lib/riot-id";

type LeaderboardRow = {
  rank: number;
  playerId: string;
  name: string;
  riotId: string | null;
  elo: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: string;
  streak: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    "!report - report the completed inhouse through Lzyumi",
    "!cancel - admin only: cancel the active inhouse session",
    "!welcome - show the ECL welcome message",
  ].join("\n");
}

export function formatVerifyHelpMessage() {
  return verifyInstructions();
}

function inhouseStreak(stats: { isWin: boolean }[]): string {
  // stats ordered desc (most recent first)
  let w = 0, l = 0;
  for (const s of stats) {
    if (s.isWin) { if (l > 0) break; w++; }
    else         { if (w > 0) break; l++; }
  }
  return w > 0 ? `W${w}` : l > 0 ? `L${l}` : "-";
}

async function getLeaderboardRows(): Promise<LeaderboardRow[]> {
  const players = await prisma.player.findMany({
    include: {
      gameStats: {
        where: INHOUSE_MATCH_FILTER,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return players
    .map((player) => {
      const gamesPlayed = player.gameStats.length;
      const wins = player.gameStats.filter((stat) => stat.isWin).length;
      const losses = gamesPlayed - wins;
      const winRate = gamesPlayed === 0 ? "-" : `${Math.round((wins / gamesPlayed) * 100)}%`;
      const elo = player.elo;
      const streak = inhouseStreak(player.gameStats);

      return {
        rank: 0,
        playerId: player.id,
        name: player.name,
        riotId: formatRiotId(player.riotName, player.riotTag),
        elo,
        wins,
        losses,
        gamesPlayed,
        winRate,
        streak,
      };
    })
    .filter((row) => row.gamesPlayed > 0)
    .sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return a.name.localeCompare(b.name);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
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
