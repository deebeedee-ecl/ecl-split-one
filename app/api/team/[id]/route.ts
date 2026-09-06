import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const status = String(body.status || "");

    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid team status" },
        { status: 400 }
      );
    }

    const updated = await prisma.teamRegistration.update({
      where: { id },
      data: { status },
    });

    if (status === "approved") {
      await prisma.team.upsert({
        where: { name: updated.teamName },
        update: {},
        create: { name: updated.teamName },
      });
    }

    return NextResponse.json({ success: true, team: updated });
  } catch (error) {
    console.error("PATCH /api/team/[id] error:", error);

    return NextResponse.json(
      {
        error: "Failed to update team registration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
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

    const deleted = await prisma.$transaction(async (tx) => {
      const registration = await tx.teamRegistration.delete({
        where: { id },
      });

      await tx.team.deleteMany({
        where: { name: registration.teamName },
      });

      return registration;
    });

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("DELETE /api/team-registration/[id] error:", error);

    return NextResponse.json(
      {
        error: "Failed to delete team registration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
