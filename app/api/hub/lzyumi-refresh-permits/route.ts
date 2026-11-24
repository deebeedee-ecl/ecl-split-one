import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import {
  issueLzyumiRefreshPermit,
  LzyumiRefreshPermitConfigurationError,
  readLzyumiRefreshPermitPolicy,
} from "@/lib/lzyumi-refresh-permit-runtime";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function rejectionStatus(code: string) {
  if (code === "OWNER_ONLY") return 403;
  if (code === "PROFILE_COOLDOWN" || code === "REQUESTER_COOLDOWN" || code === "REQUESTER_BUDGET_EXHAUSTED") {
    return 429;
  }
  if (code === "TARGET_UNAVAILABLE") return 404;
  return 409;
}

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let body: { targetProfileId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const targetProfileId = typeof body.targetProfileId === "string"
    ? body.targetProfileId.trim()
    : "";
  if (!UUID.test(targetProfileId)) {
    return NextResponse.json({ message: "Invalid target profile" }, { status: 400 });
  }

  try {
    const result = await issueLzyumiRefreshPermit({
      requesterUserId: account.id,
      targetProfileId,
      policy: readLzyumiRefreshPermitPolicy(),
    });
    if (result.status === "rejected") {
      return NextResponse.json({
        ok: false,
        code: result.code,
        retryAt: result.retryAt?.toISOString() ?? null,
      }, { status: rejectionStatus(result.code) });
    }

    return NextResponse.json({
      ok: true,
      permitToken: result.permitToken,
      targetProfileId: result.targetProfileId,
      expiresAt: result.expiresAt.toISOString(),
      requests: result.requests,
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
}
