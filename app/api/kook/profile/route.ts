import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LookupBody = {
  kookUserId?: string;
  riotName?: string;
  riotTag?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-ecl-kook-secret");

  if (!process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as LookupBody;
  const kookUserId = clean(body.kookUserId);
  const riotName = clean(body.riotName);
  const riotTag = clean(body.riotTag);

  if (!kookUserId && (!riotName || !riotTag)) {
    return NextResponse.json(
      { message: "Provide kookUserId or riotName plus riotTag." },
      { status: 400 },
    );
  }

  const profile = await prisma.accountProfile.findFirst({
    where: kookUserId
      ? {
          kookId: kookUserId,
          verificationStatus: "VERIFIED",
          accountStatus: "ACTIVE",
        }
      : {
          riotName: {
            equals: riotName,
            mode: "insensitive",
          },
          riotTag: {
            equals: riotTag,
            mode: "insensitive",
          },
        },
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      chinaServerName: true,
      openId: true,
      kookId: true,
      verificationStatus: true,
      accountStatus: true,
      lzyumiVerifiedAt: true,
      lzyumiLastLookupAt: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ message: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
