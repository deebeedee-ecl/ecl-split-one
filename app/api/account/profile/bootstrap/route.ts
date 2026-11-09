import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { userId: account.id },
    select: {
      id: true,
      accountStatus: true,
      verificationStatus: true,
    },
  });

  return NextResponse.json({ profile });
}
