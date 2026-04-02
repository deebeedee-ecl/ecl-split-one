import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Only protect admin routes
  if (url.pathname.startsWith("/admin")) {
    const authHeader = req.headers.get("authorization");

    const username = "admin";
    const password = "ecl2026"; // change this!

    const basicAuth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

    if (authHeader !== basicAuth) {
      return new NextResponse("Auth required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Secure Area"',
        },
      });
    }
  }

  return NextResponse.next();
}