import { NextResponse } from "next/server";
import { createLzyumiSignature } from "@/lib/lzyumi";

export async function GET() {
  const signature = createLzyumiSignature();

  return NextResponse.json({
    ok: true,
    service: "lzyumi",
    baseUrl: process.env.LZYUMI_BASE_URL ?? "https://a.2025lol.top/lzyumi/lol/info",
    signatureReady: Boolean(signature.lzyumiSign && signature.signStr),
  });
}
