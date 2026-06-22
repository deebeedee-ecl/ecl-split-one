import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";

export const runtime = "nodejs";

const maxBannerBytes = 8 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  return `data:${file.type};base64,${base64}`;
}

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
    return NextResponse.json({ message: "Banner must be 8MB or smaller." }, { status: 400 });
  }

  return NextResponse.json({
    bannerUrl: await fileToDataUrl(file),
  });
}
