import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "ecl_admin_session";

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    "ecl2026"
  );
}

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

function isAdminApiPath(pathname: string) {
  return pathname.startsWith("/api/admin");
}

function isPublicAdminPath(pathname: string) {
  return pathname === "/admin/login" || pathname === "/api/admin/login";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if ((!isAdminPath(pathname) && !isAdminApiPath(pathname)) || isPublicAdminPath(pathname)) {
    return NextResponse.next();
  }

  const session = req.cookies.get(ADMIN_COOKIE)?.value;

  if (session === getAdminSessionSecret()) {
    return NextResponse.next();
  }

  if (isAdminApiPath(pathname)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
