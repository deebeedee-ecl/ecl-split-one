import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function confirmedProfileResponse(
  message: string,
  profile: {
    id: string;
    displayName: string;
    riotName: string;
    riotTag: string;
    chinaServerId: number | null;
    chinaServerName: string | null;
    openId: string | null;
    lzyumiVerifiedAt: Date | null;
  },
) {
  return NextResponse.json({
    message,
    profileId: profile.id,
    displayName: profile.displayName,
    riotName: profile.riotName,
    riotTag: profile.riotTag,
    chinaServerId: profile.chinaServerId,
    chinaServerName: profile.chinaServerName,
    openId: profile.openId,
    lzyumiVerifiedAt: profile.lzyumiVerifiedAt,
  });
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-ecl-kook-secret");

  if (!process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    code?: string;
    kookUserId?: string;
    kookUsername?: string;
  };

  const code = body.code?.trim().toUpperCase();
  const kookUserId = body.kookUserId?.trim();
  const kookUsername = body.kookUsername?.trim();

  if (!code) {
    return NextResponse.json({ message: "Verification code is required" }, { status: 400 });
  }

  if (!kookUserId) {
    return NextResponse.json({ message: "KOOK user ID is required" }, { status: 400 });
  }

  const verification = await prisma.kookVerification.findUnique({
    where: {
      code,
    },
    include: {
      profile: true,
    },
  });

  if (!verification) {
    return NextResponse.json({ message: "Code not found" }, { status: 404 });
  }

  if (verification.status === "CONFIRMED") {
    const sameKookAccount =
      verification.kookUserId === kookUserId || verification.profile.kookId === kookUserId;

    if (sameKookAccount && verification.profile.verificationStatus === "VERIFIED") {
      return confirmedProfileResponse("KOOK verification already confirmed", verification.profile);
    }

    return NextResponse.json({ message: "Code already used" }, { status: 409 });
  }

  if (verification.status !== "PENDING" || verification.expiresAt < new Date()) {
    return NextResponse.json({ message: "Code is not active" }, { status: 409 });
  }

  let updated;

  try {
    updated = await prisma.$transaction(async (tx) => {
      const existingLinkedProfile = await tx.accountProfile.findFirst({
        where: {
          kookId: kookUserId,
          verificationStatus: "VERIFIED",
          NOT: {
            id: verification.profileId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingLinkedProfile) {
        throw new Error("KOOK account already linked to another ECL profile");
      }

      await tx.kookVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          status: "CONFIRMED",
          kookUserId,
          confirmedAt: new Date(),
        },
      });

      return tx.accountProfile.update({
        where: {
          id: verification.profileId,
        },
        data: {
          verificationStatus: "VERIFIED",
          accountStatus: "ACTIVE",
          kookId: kookUserId,
          kookUsername: kookUsername || verification.profile.kookUsername,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "KOOK account already linked to another ECL profile"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    throw error;
  }

  return confirmedProfileResponse("KOOK verification confirmed", updated);
}
