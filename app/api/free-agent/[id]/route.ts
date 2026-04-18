import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned === "" ? null : cleaned;
}

function normalizeRank(value: unknown) {
  const cleaned = cleanText(value).toLowerCase();

  if (cleaned.includes("challenger")) return "Challenger";
  if (cleaned.includes("grandmaster")) return "Grandmaster";
  if (cleaned.includes("master")) return "Master";
  if (cleaned.includes("diamond")) return "Diamond";
  if (cleaned.includes("emerald")) return "Emerald";
  if (cleaned.includes("platinum")) return "Platinum";
  if (cleaned.includes("gold")) return "Gold";
  if (cleaned.includes("silver")) return "Silver";
  if (cleaned.includes("bronze")) return "Bronze";
  if (cleaned.includes("iron")) return "Iron";

  return "Unranked";
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const existingAgent = await prisma.freeAgentRegistration.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: "Free agent not found" },
        { status: 404 }
      );
    }

    const nextStatus =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : existingAgent.status;

    const nextSignedToTeamId =
      body.signedToTeamId !== undefined
        ? normalizeNullableText(body.signedToTeamId)
        : existingAgent.signedToTeamId;

    const nextSignedToTeamName =
      body.signedToTeamName !== undefined
        ? normalizeNullableText(body.signedToTeamName)
        : existingAgent.signedToTeamName;

    const nextPlayerName =
      body.playerName !== undefined
        ? cleanText(body.playerName)
        : existingAgent.playerName;

    const nextEmail =
      body.email !== undefined ? cleanText(body.email) : existingAgent.email;

    const nextRiotName =
      body.riotName !== undefined
        ? cleanText(body.riotName)
        : existingAgent.riotName;

    const nextRiotTag =
      body.riotTag !== undefined
        ? cleanText(body.riotTag)
        : existingAgent.riotTag;

    const nextPrimaryRole =
      body.primaryRole !== undefined
        ? cleanText(body.primaryRole)
        : existingAgent.primaryRole;

    const nextSecondaryRole =
      body.secondaryRole !== undefined
        ? normalizeNullableText(body.secondaryRole)
        : existingAgent.secondaryRole;

    const nextCurrentRank =
      body.currentRank !== undefined
        ? normalizeRank(body.currentRank)
        : normalizeRank(existingAgent.currentRank);

    const nextNotes =
      body.notes !== undefined
        ? normalizeNullableText(body.notes)
        : existingAgent.notes;

    const updatedAgentData = {
      status: nextStatus,
      signedToTeamId: nextStatus === "signed" ? nextSignedToTeamId : null,
      signedToTeamName: nextStatus === "signed" ? nextSignedToTeamName : null,
      playerName: nextPlayerName,
      email: nextEmail,
      riotName: nextRiotName,
      riotTag: nextRiotTag,
      primaryRole: nextPrimaryRole,
      secondaryRole: nextSecondaryRole,
      currentRank: nextCurrentRank,
      notes: nextNotes,
    };

    if (
      updatedAgentData.status === "signed" &&
      (!updatedAgentData.signedToTeamId || !updatedAgentData.signedToTeamName)
    ) {
      return NextResponse.json(
        { error: "Missing signed team information" },
        { status: 400 }
      );
    }

    const updatedAgent = await prisma.freeAgentRegistration.update({
      where: { id },
      data: updatedAgentData,
    });

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error("PATCH /api/free-agent/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to update free agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const existingAgent = await prisma.freeAgentRegistration.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: "Free agent not found" },
        { status: 404 }
      );
    }

    await prisma.freeAgentRegistration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/free-agent/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to delete free agent" },
      { status: 500 }
    );
  }
}