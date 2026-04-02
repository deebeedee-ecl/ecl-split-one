import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    console.log("Deleting team registration id:", id);

    const deleted = await prisma.teamRegistration.delete({
      where: { id },
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