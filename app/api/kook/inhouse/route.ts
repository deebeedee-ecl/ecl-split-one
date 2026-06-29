import { NextResponse } from "next/server";
import {
  BLUE_SIDE_CHANNEL_ID,
  RANKED_INHOUSE_CHANNEL_ID,
  RED_SIDE_CHANNEL_ID,
  balanceInhouseTeams,
  createInhouseSession,
  findActiveInhouseSession,
  formatInhouseRoster,
  formatTeamList,
  normalizeInhouseMembers,
  resolveInhousePlayers,
  type KookInhouseMember,
} from "@/lib/kook-inhouse";

export const dynamic = "force-dynamic";

type InhouseBody = {
  action?: string;
  command?: string;
  channelId?: string;
  members?: KookInhouseMember[];
  voiceMembers?: KookInhouseMember[];
  isAdmin?: boolean;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAction(body: InhouseBody) {
  const raw = clean(body.action || body.command).toLowerCase();
  if (raw.startsWith("!")) return raw.slice(1);
  return raw || "inhouse";
}

function getMembers(body: InhouseBody) {
  const members = Array.isArray(body.members) ? body.members : body.voiceMembers;
  return normalizeInhouseMembers(Array.isArray(members) ? members : []);
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.ECL_SITE_URL || "https://eclchina.lol";
}

function formatServerErrorReply(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("emaxconnsession") ||
    lowerMessage.includes("max clients") ||
    lowerMessage.includes("pool_size")
  ) {
    return "ECL server/database is temporarily busy. Please wait 30 seconds, then try !inhouse or !ready again.";
  }

  return "ECL server hit an error while checking the inhouse. Please try again. If it repeats, ask an admin to check the Railway logs.";
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-ecl-kook-secret");

    if (!process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET) {
      return json(401, { message: "Unauthorized" });
    }

    const body = (await request.json()) as InhouseBody;
    const action = parseAction(body);
    const channelId = clean(body.channelId);
    const members = getMembers(body);
    const isAdmin = Boolean(body.isAdmin);

    if (channelId !== RANKED_INHOUSE_CHANNEL_ID) {
      return json(400, {
        ok: false,
        status: "WRONG_CHANNEL",
        reply: "Ranked inhouse can only be started from the Ranked IH 1 channel.",
        expectedChannelId: RANKED_INHOUSE_CHANNEL_ID,
      });
    }

    if (action !== "inhouse" && action !== "ready") {
      return json(400, {
        ok: false,
        status: "UNKNOWN_COMMAND",
        reply: "Use !inhouse to start the check or !ready when the 10 players are confirmed.",
      });
    }

    const activeSession = await findActiveInhouseSession(channelId);
    if (activeSession) {
      return NextResponse.json({
        ok: true,
        status: "ALREADY_ASSIGNED",
        reply:
          `${activeSession.gameLabel ?? "The current inhouse"} is already set.\n\n` +
          "Duplicate commands are ignored. Finish/report this game, or ask an admin to cancel the stuck session from the admin dashboard.\n\n" +
          "After it is cleared, type !inhouse to start the next game.",
        session: activeSession,
        moveInstructions: [],
      });
    }

    if (members.length < 10) {
      return NextResponse.json({
        ok: true,
        status: "WAITING",
        reply: `Ranked IH started. Waiting for ${10 - members.length} more player${
          10 - members.length === 1 ? "" : "s"
        } in the channel. Current count: ${members.length}/10.`,
        count: members.length,
        required: 10,
      });
    }

    if (members.length > 10) {
      return NextResponse.json({
        ok: false,
        status: "TOO_MANY_PLAYERS",
        reply: `There are ${members.length} people in Ranked IH 1. Please get it to exactly 10, then type !ready.`,
        count: members.length,
        required: 10,
      });
    }

    const players = await resolveInhousePlayers(members);
    const unverifiedPlayers = players.filter((player) => !player.verified);

    if (unverifiedPlayers.length > 0 && !isAdmin) {
      const siteUrl = getSiteUrl();

      return NextResponse.json({
        ok: false,
        status: "UNVERIFIED_PLAYERS",
        reply:
          "!ready blocked: some players in Ranked IH 1 are not verified on ECL yet.\n\n" +
          unverifiedPlayers.map((player) => `- ${player.displayName}`).join("\n") +
          "\n\nStarting a ranked inhouse with unverified players can hurt other players' LP/ELO because the bot cannot safely read their real ECL rating, track their match history, or apply the result correctly." +
          "\n\nPlease ask them to register/login and verify their KOOK account here:" +
          `\n${siteUrl}/signup` +
          "\n\nAfter they verify, run !inhouse again. If admins knowingly accept the risk, they can use !forceready.",
        players,
      });
    }

    if (action === "inhouse") {
      return NextResponse.json({
        ok: true,
        status: "READY_CHECK",
        reply:
          "Ranked IH 1 is full. Are these the 10 players?\n\n" +
          formatInhouseRoster(players) +
          "\n\nIf yes, type !ready.",
        players,
      });
    }

    const { blueTeam, redTeam } = balanceInhouseTeams(players);
    const session = await createInhouseSession({
      sourceChannelId: channelId,
      blueTeam,
      redTeam,
    });

    if (session.duplicate) {
      return NextResponse.json({
        ok: true,
        status: "ALREADY_ASSIGNED",
        reply: `${session.gameLabel ?? "This inhouse"} is already assigned. Ignoring the duplicate !ready.`,
        blueTeam,
        redTeam,
        session,
        moveInstructions: [],
      });
    }

    const moveInstructions = [
      ...blueTeam.players.map((player) => ({
        kookUserId: player.kookUserId,
        targetChannelId: BLUE_SIDE_CHANNEL_ID,
        side: "BLUE",
      })),
      ...redTeam.players.map((player) => ({
        kookUserId: player.kookUserId,
        targetChannelId: RED_SIDE_CHANNEL_ID,
        side: "RED",
      })),
    ];

    return NextResponse.json({
      ok: true,
      status: "ASSIGNED",
      reply:
        `**${session.gameLabel}** - teams are balanced!\n\n` +
        `Blue Side (${blueTeam.eloTotal} LP)\n${formatTeamList(blueTeam)}\n\n` +
        `Red Side (${redTeam.eloTotal} LP)\n${formatTeamList(redTeam)}\n\n` +
        `Players are being moved to their voice channels. GL HF!`,
      blueTeam,
      redTeam,
      session,
      moveInstructions,
    });
  } catch (error) {
    console.error("[kook-inhouse] command failed", error);

    return NextResponse.json({
      ok: false,
      status: "SERVER_ERROR",
      reply: formatServerErrorReply(error),
    });
  }
}
