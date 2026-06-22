import { NextResponse } from "next/server";
import {
  BLUE_SIDE_CHANNEL_ID,
  RANKED_INHOUSE_CHANNEL_ID,
  RED_SIDE_CHANNEL_ID,
  balanceInhouseTeams,
  createInhouseSession,
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

export async function POST(request: Request) {
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
    return NextResponse.json({
      ok: false,
      status: "UNVERIFIED_PLAYERS",
      reply:
        "Some players in the channel have not verified their ECL account through KOOK yet:\n" +
        unverifiedPlayers.map((player) => `- ${player.displayName}`).join("\n") +
        "\n\nAsk them to verify first, then run !inhouse again. Admins can use !forceready to override.",
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
      `Teams balanced. Move Blue to ${BLUE_SIDE_CHANNEL_ID} and Red to ${RED_SIDE_CHANNEL_ID}.\n\n` +
      `Blue Side (${blueTeam.eloTotal} LP)\n${formatTeamList(blueTeam)}\n\n` +
      `Red Side (${redTeam.eloTotal} LP)\n${formatTeamList(redTeam)}`,
    blueTeam,
    redTeam,
    session,
    moveInstructions,
  });
}
