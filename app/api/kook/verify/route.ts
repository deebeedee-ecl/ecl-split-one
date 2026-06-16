import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = request.headers.get("x-ecl-kook-secret");

  if (!process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    code?: string;
    kookUserId?: string;
  };

  const code = body.code?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ message: "Verification code is required" }, { status: 400 });
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

  if (verification.status !== "PENDING" || verification.expiresAt < new Date()) {
    return NextResponse.json({ message: "Code is not active" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.kookVerification.update({
      where: {
        id: verification.id,
      },
      data: {
        status: "CONFIRMED",
        kookUserId: body.kookUserId?.trim() || null,
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
        kookId: body.kookUserId?.trim() || verification.profile.kookId,
      },
    });
  });

  return NextResponse.json({
    message: "KOOK verification confirmed",
    profileId: updated.id,
    displayName: updated.displayName,
    riotName: updated.riotName,
    riotTag: updated.riotTag,
    chinaServerId: updated.chinaServerId,
    chinaServerName: updated.chinaServerName,
    openId: updated.openId,
    lzyumiVerifiedAt: updated.lzyumiVerifiedAt,
  });
}
