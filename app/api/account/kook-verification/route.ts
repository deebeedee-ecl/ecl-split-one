import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { createUniqueKookVerification } from "@/lib/kook-verification";

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: {
      userId: account.id,
    },
    select: {
      id: true,
      verificationStatus: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ message: "Create your profile before requesting a KOOK code." }, { status: 404 });
  }

  if (profile.verificationStatus === "VERIFIED") {
    return NextResponse.json({ message: "This profile is already KOOK verified." }, { status: 409 });
  }

  const verification = await prisma.$transaction(async (tx) => {
    const existingPending = await tx.kookVerification.findFirst({
      where: {
        profileId: profile.id,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingPending) return existingPending;

    await tx.kookVerification.updateMany({
      where: {
        profileId: profile.id,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
      },
    });

    return createUniqueKookVerification(tx, profile.id);
  });

  return NextResponse.json({ verification });
}

