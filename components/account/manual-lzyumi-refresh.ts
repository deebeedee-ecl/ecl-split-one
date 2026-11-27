import {
  fetchLzyumiBrowserResponse,
  unavailableLzyumiRecentStat,
  type LzyumiOptionalRecentStat,
} from "../../lib/lzyumi-browser-contract";

type ManualRefreshFetcher = typeof fetch;

type PermitBundle = {
  profile: string;
  solo: string;
  flex: string;
  recent: string;
};

type IssuedPermit = {
  ok: true;
  permitToken: string;
  targetProfileId: string;
  expiresAt: string;
  requests: PermitBundle;
};

type RejectedPermit = {
  ok?: false;
  code?: string;
  retryAt?: string | null;
  message?: string;
};

export type ManualLzyumiRefreshResult =
  | {
      status: "success";
      fetchedAt: string;
      recentStatStatus: "available" | "unavailable";
    }
  | {
      status: "up-to-date" | "cooldown" | "unavailable" | "failure";
      code: string;
      retryAt: string | null;
      message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function isIssuedPermit(value: unknown, expectedTargetProfileId: string): value is IssuedPermit {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.requests)) return false;
  const requests = value.requests;
  return (
    typeof value.permitToken === "string" &&
    value.permitToken.length >= 32 &&
    value.targetProfileId === expectedTargetProfileId &&
    typeof value.expiresAt === "string" &&
    !Number.isNaN(new Date(value.expiresAt).getTime()) &&
    typeof requests.profile === "string" &&
    typeof requests.solo === "string" &&
    typeof requests.flex === "string" &&
    typeof requests.recent === "string"
  );
}

function rejectedResult(
  response: Response,
  value: unknown,
): Exclude<ManualLzyumiRefreshResult, { status: "success" }> {
  const rejection = isRecord(value) ? value as RejectedPermit : {};
  const code = typeof rejection.code === "string" ? rejection.code : `HTTP_${response.status}`;
  const retryAt = typeof rejection.retryAt === "string" &&
    !Number.isNaN(new Date(rejection.retryAt).getTime())
    ? rejection.retryAt
    : null;

  if (code === "SNAPSHOT_FRESH") {
    return {
      status: "up-to-date",
      code,
      retryAt: null,
      message: "Your verified League snapshot is already up to date.",
    };
  }

  if (
    code === "PROFILE_COOLDOWN" ||
    code === "REQUESTER_COOLDOWN" ||
    code === "REQUESTER_BUDGET_EXHAUSTED"
  ) {
    return {
      status: "cooldown",
      code,
      retryAt,
      message: retryAt
        ? "Refresh is on cooldown. Try again after the displayed time."
        : "Refresh is temporarily on cooldown. Try again later.",
    };
  }

  if (code === "PERMITS_UNAVAILABLE") {
    return {
      status: "unavailable",
      code,
      retryAt: null,
      message: "Manual League refresh is temporarily unavailable.",
    };
  }

  if (response.status === 401) {
    return {
      status: "failure",
      code: "UNAUTHENTICATED",
      retryAt: null,
      message: "Your session expired. Please log in again.",
    };
  }

  return {
    status: "failure",
    code,
    retryAt,
    message: "League data could not be refreshed. Your previous snapshot was kept.",
  };
}

export async function runManualLzyumiRefresh({
  targetProfileId,
  accessToken,
  fetcher = fetch,
}: {
  targetProfileId: string;
  accessToken: string;
  fetcher?: ManualRefreshFetcher;
}): Promise<ManualLzyumiRefreshResult> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  let issueResponse: Response;
  try {
    issueResponse = await fetcher("/api/hub/lzyumi-refresh-permits", {
      method: "POST",
      headers,
      body: JSON.stringify({ targetProfileId }),
    });
  } catch {
    return {
      status: "failure",
      code: "ISSUE_NETWORK_ERROR",
      retryAt: null,
      message: "Manual League refresh could not be started. Your previous snapshot was kept.",
    };
  }
  const issueBody = await readJson(issueResponse);
  if (!issueResponse.ok) return rejectedResult(issueResponse, issueBody);
  if (!isIssuedPermit(issueBody, targetProfileId)) {
    return {
      status: "failure",
      code: "INVALID_PERMIT_RESPONSE",
      retryAt: null,
      message: "Manual League refresh returned an invalid request bundle.",
    };
  }

  let profileResponse: Record<string, unknown>;
  let soloResponse: Record<string, unknown>;
  let flexResponse: Record<string, unknown>;
  try {
    [profileResponse, soloResponse, flexResponse] = await Promise.all([
      fetchLzyumiBrowserResponse(issueBody.requests.profile, "profile", 15_000, fetcher),
      fetchLzyumiBrowserResponse(issueBody.requests.solo, "history", 15_000, fetcher),
      fetchLzyumiBrowserResponse(issueBody.requests.flex, "history", 15_000, fetcher),
    ]);
  } catch {
    return {
      status: "failure",
      code: "PROVIDER_CORE_UNAVAILABLE",
      retryAt: null,
      message: "ECL.GG did not return a complete profile, Solo, and Flex snapshot. Your previous snapshot was kept.",
    };
  }

  let recentStat: LzyumiOptionalRecentStat;
  try {
    recentStat = {
      status: "available",
      value: await fetchLzyumiBrowserResponse(
        issueBody.requests.recent,
        "recent",
        15_000,
        fetcher,
      ),
    };
  } catch (error) {
    recentStat = unavailableLzyumiRecentStat(error);
  }

  let consumeResponse: Response;
  try {
    consumeResponse = await fetcher("/api/hub/lzyumi-refresh-permits/consume", {
      method: "POST",
      headers,
      body: JSON.stringify({
        permitToken: issueBody.permitToken,
        targetProfileId,
        profileResponse,
        soloResponse,
        flexResponse,
        recentStat,
      }),
    });
  } catch {
    return {
      status: "failure",
      code: "CONSUME_NETWORK_ERROR",
      retryAt: null,
      message: "League data could not be saved. Your previous snapshot was kept.",
    };
  }
  const consumeBody = await readJson(consumeResponse);
  if (!consumeResponse.ok) return rejectedResult(consumeResponse, consumeBody);
  if (
    !isRecord(consumeBody) ||
    consumeBody.ok !== true ||
    consumeBody.targetProfileId !== targetProfileId ||
    typeof consumeBody.fetchedAt !== "string" ||
    Number.isNaN(new Date(consumeBody.fetchedAt).getTime()) ||
    (consumeBody.recentStatStatus !== "available" &&
      consumeBody.recentStatStatus !== "unavailable")
  ) {
    return {
      status: "failure",
      code: "INVALID_CONSUME_RESPONSE",
      retryAt: null,
      message: "League data was submitted, but the saved result could not be confirmed.",
    };
  }

  return {
    status: "success",
    fetchedAt: consumeBody.fetchedAt,
    recentStatStatus: consumeBody.recentStatStatus,
  };
}
