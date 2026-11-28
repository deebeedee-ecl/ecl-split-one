import { timingSafeEqual } from "node:crypto";

const ADMIN_COOKIE = "ecl_admin_session";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function adminSessionSecret() {
  const configured = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (configured) return configured;

  return process.env.NODE_ENV === "production" ? null : "ecl2026";
}

function cookieValue(request: Request, name: string) {
  const item = request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  if (!item) return "";

  try {
    return decodeURIComponent(item.slice(name.length + 1));
  } catch {
    return "";
  }
}

export function hasAdminSession(request: Request) {
  const expected = adminSessionSecret();
  return Boolean(expected && safeEqual(cookieValue(request, ADMIN_COOKIE), expected));
}
