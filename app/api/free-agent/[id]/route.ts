import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { status } = await req.json();

    const updatedAgent = await prisma.freeAgentRegistration.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error("PATCH /api/free-agent/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to update free agent status" },
      { status: 500 }
    );
  }
}