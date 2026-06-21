import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_COOKIE = "ecl_admin_session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
