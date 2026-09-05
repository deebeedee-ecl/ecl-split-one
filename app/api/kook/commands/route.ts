import { NextResponse } from "next/server";
import {
  cancelActiveInhouseSession,
  formatCancelReportMessage,
  formatHelpMessage,
  formatLeaderboardMessage,
  formatMeMessage,
  formatRankMessage,
  formatReportPreviewMessage,
  formatStatusMessage,
  formatVerifyHelpMessage,
  formatWelcomeMessage,
  submitPendingReportMessage,
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
  const withoutPrefix = raw.startsWith("!") ? raw.slice(1) : raw;
  return withoutPrefix.split(/\s+/)[0] ?? "";
}

function parseArgs(body: CommandBody) {
  const raw = clean(body.command || body.action);
  const withoutPrefix = raw.startsWith("!") ? raw.slice(1) : raw;
  return withoutPrefix.split(/\s+/).slice(1).filter(Boolean);
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
  return ["me", "rank", "report", "result", "yes", "confirm", "no"].includes(command);
}

export async function POST(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CommandBody;
  const command = parseCommand(body);
  const args = parseArgs(body);
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

  try {
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
      case "report":
      case "result":
        reply = await formatReportPreviewMessage(kookUserId, args);
        break;
      case "yes":
      case "confirm":
        reply = await submitPendingReportMessage(kookUserId, new URL(request.url).origin);
        break;
      case "no":
        reply = await formatCancelReportMessage(kookUserId);
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
  } catch (error) {
    console.error("POST /api/kook/commands error:", error);
    return NextResponse.json(
      {
        ok: false,
        status: "COMMAND_FAILED",
        command,
        reply: "I could not complete that command right now. Please try again in a moment.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "OK",
    command,
    reply,
  });
}
