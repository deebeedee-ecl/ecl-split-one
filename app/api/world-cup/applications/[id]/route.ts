import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";
import { notesWithCaptainDecision, parseWorldCupApplication } from "@/lib/world-cup-applications";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAccountFromRequest(req);
    if (!account) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const teamId = clean(body.teamId);
    const decision = clean(body.decision);

    if (!teamId || !["Accepted", "Rejected"].includes(decision)) {
      return NextResponse.json({ error: "Invalid application action." }, { status: 400 });
    }

    const [profile, team, application] = await Promise.all([
      prisma.accountProfile.findUnique({
        where: { userId: account.id },
        select: { id: true, userId: true },
      }),
      prisma.teamRegistration.findUnique({
        where: { id: teamId },
        select: { id: true, players: true },
      }),
      prisma.freeAgentRegistration.findUnique({
        where: { id },
        select: { id: true, notes: true },
      }),
    ]);

    const teamPlayers = Array.isArray(team?.players) ? team.players as Array<Record<string, unknown>> : [];
    const isCaptain = Boolean(
      profile &&
        team &&
        (teamPlayers.some(
        (player) =>
          String(player.captainProfileId || "") === profile.id ||
          String(player.captainUserId || "") === profile.userId,
        )),
    );

    if (!team || !isCaptain) {
      return NextResponse.json({ error: "Only this team's captain can review applications." }, { status: 403 });
    }

    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const meta = parseWorldCupApplication(application.notes);
    if (!meta.isWorldCup || meta.requestedTeamId !== team.id) {
      return NextResponse.json({ error: "Application does not belong to this team." }, { status: 400 });
    }

    const updated = await prisma.freeAgentRegistration.update({
      where: { id },
      data: {
        status: decision === "Rejected" ? "rejected" : "pending",
        notes: notesWithCaptainDecision(application.notes, decision as "Accepted" | "Rejected"),
      },
    });

    return NextResponse.json({ application: updated });
  } catch (error) {
    console.error("PATCH /api/world-cup/applications/[id] error:", error);
    return NextResponse.json({ error: "Failed to update application." }, { status: 500 });
  }
}
