import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import {
  consumeLzyumiRefreshPermit,
  LzyumiRefreshPermitConfigurationError,
  readLzyumiRefreshPermitPolicy,
} from "@/lib/lzyumi-refresh-permit-runtime";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2_000_000;

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Snapshot is too large" }, { status: 413 });
  }

  let body: {
    permitToken?: unknown;
    targetProfileId?: unknown;
    profileResponse?: unknown;
    soloResponse?: unknown;
    flexResponse?: unknown;
    recentStat?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Snapshot is too large" }, { status: 413 });
  }

  const permitToken = typeof body.permitToken === "string"
    ? body.permitToken.trim()
    : "";
  const targetProfileId = typeof body.targetProfileId === "string"
    ? body.targetProfileId.trim()
    : "";
  if (permitToken.length < 32 || permitToken.length > 256 || !UUID.test(targetProfileId)) {
    return NextResponse.json({ ok: false, code: "PERMIT_INVALID" }, { status: 409 });
  }
  if (!body.profileResponse || !body.soloResponse || !body.flexResponse) {
    return NextResponse.json({
      message: "Complete profile, Solo, and Flex responses are required",
    }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof consumeLzyumiRefreshPermit>>;
  try {
    readLzyumiRefreshPermitPolicy();
    result = await consumeLzyumiRefreshPermit({
      requesterUserId: account.id,
      targetProfileId,
      permitToken,
      snapshot: {
        profileResponse: body.profileResponse,
        soloResponse: body.soloResponse,
        flexResponse: body.flexResponse,
        recentStat: body.recentStat,
      },
    });
  } catch (error) {
    if (error instanceof LzyumiRefreshPermitConfigurationError) {
      return NextResponse.json({
        ok: false,
        code: "PERMITS_UNAVAILABLE",
      }, { status: 503 });
    }
    throw error;
  }
  if (result.status === "rejected") {
    return NextResponse.json({ ok: false, code: result.code }, { status: 409 });
  }

  revalidatePath(`/hub/players/${result.targetProfileId}`);
  return NextResponse.json({
    ok: true,
    targetProfileId: result.targetProfileId,
    fetchedAt: result.fetchedAt.toISOString(),
    hasRecentStat: result.hasRecentStat,
    recentStatStatus: result.recentStatStatus,
  });
}
