import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
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
    const account = await getAccountFromRequest(req);
    const body = await req.json();
    const isWorldCupApplication = String(body.notes || "").includes("World Cup Team Application");
    const profile =
      account && isWorldCupApplication
        ? await prisma.accountProfile.findUnique({
            where: { userId: account.id },
            select: {
              displayName: true,
              email: true,
              riotName: true,
              riotTag: true,
              primaryRole: true,
              secondaryRole: true,
              currentRank: true,
            },
          })
        : null;

    if (isWorldCupApplication && !profile) {
      return NextResponse.json(
        { error: "Log in with a Hub profile before applying for the World Cup." },
        { status: 401 },
      );
    }

    const freeAgent = await prisma.freeAgentRegistration.create({
      data: {
        playerName: String(profile?.displayName || body.playerName || "").trim(),
        email: String(profile?.email || body.email || "").trim(),
        riotName: String(profile?.riotName || body.riotName || "").trim(),
        riotTag: String(profile?.riotTag || body.riotTag || "").trim(),
        primaryRole: String(profile?.primaryRole || body.primaryRole || "").trim(),
        secondaryRole: profile?.secondaryRole || body.secondaryRole ? String(profile?.secondaryRole || body.secondaryRole).trim() : null,
        currentRank: profile?.currentRank || body.currentRank ? String(profile?.currentRank || body.currentRank).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
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
