import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { hasChinaStatsPreviewAccess } from "@/lib/china-stats-preview-access-runtime";
import {
  buildChinaStatsSignedUrl,
  ChinaStatsSigningInputError,
  consumeChinaStatsSigningBudget,
  parseChinaStatsSigningInput,
} from "@/lib/china-stats-signing";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Vary: "Authorization",
};

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);
  const developmentBypass = process.env.NODE_ENV === "development";
  if (!account && !developmentBypass) {
    return NextResponse.json(
      { message: "Sign in to search China ranked profiles." },
      { status: 401, headers: responseHeaders },
    );
  }
  if (account && !developmentBypass && !await hasChinaStatsPreviewAccess(account.id, request.headers.get("authorization"))) {
    return NextResponse.json(
      { message: "This ECL account is not invited to the China Stats preview." },
      { status: 403, headers: responseHeaders },
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateKey = account?.id ?? `development:${forwardedFor || "local"}`;
  const budget = consumeChinaStatsSigningBudget({ key: rateKey });
  if (!budget.allowed) {
    return NextResponse.json(
      { message: "Too many lookups right now. Try again in a moment." },
      {
        status: 429,
        headers: {
          ...responseHeaders,
          "Retry-After": String(budget.retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  try {
    const body = await request.json();
    const input = parseChinaStatsSigningInput(body);
    return NextResponse.json(
      { url: buildChinaStatsSignedUrl(input) },
      {
        headers: {
          ...responseHeaders,
          "X-RateLimit-Remaining": String(budget.remaining),
        },
      },
    );
  } catch (error) {
    const message = error instanceof ChinaStatsSigningInputError
      ? error.message
      : "The lookup could not be prepared.";
    return NextResponse.json({ message }, { status: 400, headers: responseHeaders });
  }
}
