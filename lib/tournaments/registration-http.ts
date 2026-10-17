import { NextResponse } from "next/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthenticatedAccount } from "@/lib/account-auth";

import { getRegistrationState, registerForSplitTwo, RegistrationError } from "@/lib/tournaments/registration";



const headers = { "Cache-Control": "private, no-store" };

function failure(error: unknown) {
  if (error instanceof RegistrationError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status, headers });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ code: "DUPLICATE", message: "An entry already exists for this player. Refresh to view your registration." }, { status: 409, headers });
  }
  // Log only a classification, never tokens, query text, profile data or raw errors.
  console.warn("Tournament registration unavailable", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "server-error");
  return NextResponse.json({ code: "UNAVAILABLE", message: "Registration is temporarily unavailable. Please try again shortly." }, { status: 503, headers });
}

export function createRegistrationHandlers(database: PrismaClient, authenticate: (request: Request) => Promise<AuthenticatedAccount | null>) {
async function GET(request: Request) {
  try {
    const account = request.headers.has("authorization") ? await authenticate(request) : null;
    if (request.headers.has("authorization") && !account) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Please sign in again." }, { status: 401, headers });
    return NextResponse.json(await getRegistrationState(database, account), { headers });
  } catch (error) { return failure(error); }
}

async function POST(request: Request) {
  try {
    const account = await authenticate(request);
    if (!account) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Sign in to your ECL account before registering." }, { status: 401, headers });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Expected a JSON registration request." }, { status: 415, headers });
    }
    const text = await request.text();
    if (text.length > 4096) return NextResponse.json({ code: "INVALID_REQUEST", message: "Registration request is too large." }, { status: 413, headers });
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid registration request." }, { status: 400, headers });
    }
    if (body.accepted !== true || typeof body.termsVersion !== "string" || typeof body.rulesVersion !== "string") {
      return NextResponse.json({ code: "CONSENT_REQUIRED", message: "Please accept the terms and tournament rules before registering." }, { status: 400, headers });
    }
    const result = await registerForSplitTwo(database, account, { accepted: true, termsVersion: body.termsVersion, rulesVersion: body.rulesVersion });
    return NextResponse.json(result.state, { status: result.created ? 201 : 200, headers });
  } catch (error) { return failure(error); }
}

return { GET, POST };
}
