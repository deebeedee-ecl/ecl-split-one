import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const freeAgents = await prisma.freeAgentRegistration.findMany({
      select: {
        id: true,
        playerName: true,
        email: true,
        riotName: true,
        riotTag: true,
        primaryRole: true,
        secondaryRole: true,
        currentRank: true,
        notes: true,
        status: true,
        signedToTeamId: true,
        signedToTeamName: true,
        submittedAt: true,
      },
    });

    const order = {
      pending: 0,
      approved: 1,
      signed: 2,
      rejected: 3,
    };

    const sorted = freeAgents.sort((a, b) => {
      const statusA = order[a.status as keyof typeof order] ?? 999;
      const statusB = order[b.status as keyof typeof order] ?? 999;

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      return (
        new Date(b.submittedAt).getTime() -
        new Date(a.submittedAt).getTime()
      );
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("GET /api/free-agent error:", error);

    return NextResponse.json(
      { error: "Failed to fetch free agents" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const freeAgent = await prisma.freeAgentRegistration.create({
      data: {
        playerName: body.playerName,
        email: body.email,
        riotName: body.riotName,
        riotTag: body.riotTag,
        primaryRole: body.primaryRole,
        secondaryRole: body.secondaryRole || null,
        currentRank: body.currentRank || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(freeAgent, { status: 201 });
  } catch (error) {
    console.error("POST /api/free-agent error:", error);

    return NextResponse.json(
      { error: "Failed to create free agent registration" },
      { status: 500 }
    );
  }
}