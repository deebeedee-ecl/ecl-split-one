import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_COOKIE = "ecl_admin_session";

function getAdminUsername() {
  return process.env.ADMIN_USERNAME ?? "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "ecl2026";
}

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    "ecl2026"
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: unknown; password?: unknown }
    | null;

  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (username !== getAdminUsername() || password !== getAdminPassword()) {
    return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: getAdminSessionSecret(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
