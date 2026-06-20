import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";

export const runtime = "nodejs";

const maxBannerBytes = 2 * 1024 * 1024; // 2MB
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("banner");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Upload an image file named banner." }, { status: 400 });
  }

  const extension = allowedTypes.get(file.type);

  if (!extension) {
    return NextResponse.json({ message: "Banner must be a JPG, PNG, or WebP image." }, { status: 400 });
  }

  if (file.size > maxBannerBytes) {
    return NextResponse.json({ message: "Banner must be 2MB or smaller." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "banners");
  const filename = `${account.id}-${randomUUID()}.${extension}`;

  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));

  return NextResponse.json({
    bannerUrl: `/uploads/banners/${filename}`,
  });
}
