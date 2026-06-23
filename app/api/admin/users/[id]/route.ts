import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function requireAdmin() {
  const jar = await cookies();
  return jar.get("ecl_admin_session")?.value === process.env.ADMIN_SESSION_SECRET;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow these fields to be updated
  const allowed = [
    "displayName",
    "riotName",
    "riotTag",
    "kookId",
    "kookUsername",
    "wechatId",
    "chinaServerId",
    "accountStatus",
    "verificationStatus",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      const val = body[key];
      if (key === "chinaServerId") {
        data[key] = val === "" || val === null ? null : Number(val);
      } else if (val === "") {
        data[key] = null;
      } else {
        data[key] = val;
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const profile = await prisma.accountProfile.update({
      where: { id },
      data,
      select: {
        id: true,
        displayName: true,
        riotName: true,
        riotTag: true,
        kookId: true,
        kookUsername: true,
        chinaServerId: true,
        accountStatus: true,
        verificationStatus: true,
      },
    });
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("[admin] PATCH /api/admin/users/[id]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Find the profile to get the userId for cascade deletion
    const profile = await prisma.accountProfile.findUnique({
      where: { id },
      select: { userId: true, displayName: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Deleting User cascades to AccountProfile + KookVerifications
    await prisma.user.delete({ where: { id: profile.userId } });

    return NextResponse.json({ ok: true, deleted: profile.displayName });
  } catch (err) {
    console.error("[admin] DELETE /api/admin/users/[id]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
