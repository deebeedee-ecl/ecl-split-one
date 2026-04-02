import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const teams = await prisma.teamRegistration.findMany();

    // Sort: pending → approved → rejected, then newest first
    const sorted = teams.sort((a, b) => {
      const order = { pending: 0, approved: 1, rejected: 2 };

      if (
        order[a.status as keyof typeof order] !==
        order[b.status as keyof typeof order]
      ) {
        return (
          order[a.status as keyof typeof order] -
          order[b.status as keyof typeof order]
        );
      }

      return (
        new Date(b.submittedAt).getTime() -
        new Date(a.submittedAt).getTime()
      );
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("GET /api/team error:", error);

    return NextResponse.json(
      { error: "Failed to fetch team registrations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const team = await prisma.teamRegistration.create({
      data: {
        teamName: body.teamName,
        captainName: body.captainName,
        captainEmail: body.captainEmail,
        players: body.players || [], // safe fallback
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("POST /api/team error:", error);

    return NextResponse.json(
      { error: "Failed to create team registration" },
      { status: 500 }
    );
  }
}