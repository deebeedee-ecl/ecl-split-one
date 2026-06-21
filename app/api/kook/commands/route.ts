import { NextResponse } from "next/server";
import {
  cancelActiveInhouseSession,
  formatHelpMessage,
  formatLeaderboardMessage,
  formatMeMessage,
  formatRankMessage,
  formatStatusMessage,
  formatVerifyHelpMessage,
  formatWelcomeMessage,
} from "@/lib/kook-commands";
import type { KookInhouseMember } from "@/lib/kook-inhouse";

export const dynamic = "force-dynamic";

type CommandBody = {
  command?: string;
  action?: string;
  kookUserId?: string;
  members?: KookInhouseMember[];
  voiceMembers?: KookInhouseMember[];
  isAdmin?: boolean;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCommand(body: CommandBody) {
  const raw = clean(body.command || body.action).toLowerCase();
  return raw.startsWith("!") ? raw.slice(1) : raw;
}

function membersFromBody(body: CommandBody) {
  const members = Array.isArray(body.members) ? body.members : body.voiceMembers;
  return Array.isArray(members) ? members : [];
}

function unauthorized(request: Request) {
  const secret = request.headers.get("x-ecl-kook-secret");
  return !process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET;
}

function needsKookUser(command: string) {
  return command === "me" || command === "rank";
}

export async function POST(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CommandBody;
  const command = parseCommand(body);
  const kookUserId = clean(body.kookUserId);

  if (!command) {
    return NextResponse.json(
      {
        ok: false,
        status: "MISSING_COMMAND",
        reply: "Send a command such as !help, !me, !rank, !leaderboard, !status, or !welcome.",
      },
      { status: 400 },
    );
  }

  if (needsKookUser(command) && !kookUserId) {
    return NextResponse.json(
      {
        ok: false,
        status: "MISSING_KOOK_USER",
        reply: "KOOK user ID is required for this command.",
      },
      { status: 400 },
    );
  }

  let reply: string;

  switch (command) {
    case "welcome":
      reply = formatWelcomeMessage();
      break;
    case "help":
    case "commands":
      reply = formatHelpMessage();
      break;
    case "verify":
      reply = formatVerifyHelpMessage();
      break;
    case "leaderboard":
    case "top":
      reply = await formatLeaderboardMessage();
      break;
    case "me":
      reply = await formatMeMessage(kookUserId);
      break;
    case "rank":
      reply = await formatRankMessage(kookUserId);
      break;
    case "status":
      reply = await formatStatusMessage(membersFromBody(body));
      break;
    case "cancel":
      if (!body.isAdmin) {
        return NextResponse.json(
          {
            ok: false,
            status: "ADMIN_REQUIRED",
            reply: "!cancel is restricted to admins.",
          },
          { status: 403 },
        );
      }
      reply = await cancelActiveInhouseSession();
      break;
    default:
      reply = [
        "Unknown command.",
        "",
        formatHelpMessage(),
      ].join("\n");
      break;
  }

  return NextResponse.json({
    ok: true,
    status: "OK",
    command,
    reply,
  });
}
