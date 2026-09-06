import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const registrations = req.nextUrl.searchParams.get("registrations");

    if (registrations === "1" || registrations === "true") {
      const teams = await prisma.teamRegistration.findMany({
        orderBy: {
          submittedAt: "desc",
        },
      });

      return NextResponse.json(teams);
    }

    const teams = await prisma.team.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        kitUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET /api/team error:", error);

    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const account = await getAccountFromRequest(req);
    const body = await req.json();
    const captainProfile = account
      ? await prisma.accountProfile.findUnique({
          where: { userId: account.id },
          select: {
            id: true,
            userId: true,
            displayName: true,
            email: true,
            riotName: true,
            riotTag: true,
            primaryRole: true,
            secondaryRole: true,
            nationality: true,
          },
        })
      : null;

    const rawPlayers = Array.isArray(body.players) ? body.players : [];

    const players = rawPlayers.map((player: any) => ({
      playerName: String(player.playerName || "").trim(),
      riotName: String(player.riotName || "").trim(),
      riotTag: String(player.riotTag || "").trim(),
      currentRank: String(player.currentRank || player.rank || "").trim(),
      primaryRole: String(player.primaryRole || "").trim(),
      secondaryRole: String(player.secondaryRole || "").trim(),
      nationality: String(player.nationality || "").trim(),
      countryCode: String(player.countryCode || "").trim(),
      countryFlag: String(player.countryFlag || "").trim(),
    }));

    const teamCountry = {
      teamCountry: String(body.country || "").trim(),
      teamCountryCode: String(body.countryCode || "").trim(),
      teamCountryFlag: String(body.countryFlag || "").trim(),
      captainProfileId: captainProfile?.id ?? "",
      captainUserId: captainProfile?.userId ?? "",
    };
    const captainAsPlayer = captainProfile
      ? {
          playerName: captainProfile.displayName,
          riotName: captainProfile.riotName,
          riotTag: captainProfile.riotTag ?? "",
          currentRank: "",
          primaryRole: captainProfile.primaryRole,
          secondaryRole: captainProfile.secondaryRole ?? "",
          nationality: captainProfile.nationality ?? "",
          countryCode: "",
          countryFlag: "",
          ...teamCountry,
        }
      : null;
    const savedPlayers =
      players.length > 0
        ? players.map((player: any) => ({
            ...player,
            ...teamCountry,
          }))
        : captainAsPlayer
          ? [captainAsPlayer]
          : [teamCountry];

    const team = await prisma.teamRegistration.create({
      data: {
        teamName: String(body.teamName || "").trim(),
        captainName: String(body.captainName || captainProfile?.displayName || "").trim(),
        captainEmail: String(captainProfile?.email || account?.email || body.captainEmail || "").trim(),
        players: savedPlayers,
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
