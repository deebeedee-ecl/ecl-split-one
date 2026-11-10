export type LzyumiBrowserEndpoint = "profile" | "history" | "recent" | "detail";

export type LzyumiBrowserFailure =
  | "authentication"
  | "throttled"
  | "network-rejected"
  | "not-found"
  | "http-error"
  | "malformed"
  | "provider-error";

export type LzyumiOptionalRecentStat =
  | { status: "available"; value: Record<string, unknown> }
  | { status: "unavailable"; reason: LzyumiBrowserFailure };

type EndpointSpec = {
  path: string;
  successCodes: readonly number[];
  applicationFailures: Readonly<Record<number, LzyumiBrowserFailure>>;
};

const SHARED_PROFILE_FAILURES = {
  2: "not-found",
  6: "authentication",
  7: "throttled",
  8: "network-rejected",
} as const;

// Application codes are deliberately declared per endpoint. Do not reuse these
// semantics for unrelated Lzyumi endpoints such as token/session status.
const ENDPOINT_SPECS: Record<LzyumiBrowserEndpoint, EndpointSpec> = {
  profile: {
    path: "/lzyumi/lol/info",
    successCodes: [1],
    applicationFailures: { ...SHARED_PROFILE_FAILURES },
  },
  history: {
    path: "/lzyumi/lol/info",
    successCodes: [1],
    applicationFailures: { ...SHARED_PROFILE_FAILURES },
  },
  recent: {
    path: "/lzyumi/lol/info/getPlayerRecentStat",
    successCodes: [1],
    applicationFailures: {
      2: "not-found",
      6: "authentication",
      7: "throttled",
      8: "network-rejected",
    },
  },
  detail: {
    path: "/lzyumi/lol/info/findOrderDetailInfoAll",
    successCodes: [1],
    applicationFailures: {
      2: "not-found",
      6: "authentication",
      7: "throttled",
      8: "network-rejected",
    },
  },
};

export class LzyumiBrowserContractError extends Error {
  constructor(
    message: string,
    readonly endpoint: LzyumiBrowserEndpoint,
    readonly kind: LzyumiBrowserFailure,
    readonly providerCode?: number,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "LzyumiBrowserContractError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function providerCode(value: unknown) {
  const record = asRecord(value);
  const parsed = typeof record?.code === "number"
    ? record.code
    : typeof record?.code === "string" && record.code.trim()
      ? Number(record.code)
      : Number.NaN;

  return Number.isInteger(parsed) ? parsed : null;
}

function hasExpectedHistoryRows(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((row) => {
    const record = asRecord(row);
    return typeof record?.gameId === "string" && record.gameId.trim().length > 0;
  });
}

function requireSuccessCode(value: unknown, endpoint: LzyumiBrowserEndpoint) {
  const code = providerCode(value);
  const spec = ENDPOINT_SPECS[endpoint];

  if (code !== null && spec.successCodes.includes(code)) return;

  const kind = code === null
    ? "malformed"
    : spec.applicationFailures[code] ?? "provider-error";
  throw new LzyumiBrowserContractError(
    code === null
      ? `ECL.GG ${endpoint} response is missing an application code.`
      : `ECL.GG ${endpoint} request failed with provider code ${code}.`,
    endpoint,
    kind,
    code ?? undefined,
  );
}

export function buildLzyumiEndpointUrl(
  baseUrl: string,
  endpoint: LzyumiBrowserEndpoint,
) {
  const url = new URL(baseUrl);
  const marker = "/lzyumi/lol";
  const markerIndex = url.pathname.indexOf(marker);
  const configuredPath = url.pathname.replace(/\/+$/, "");
  const apiRoot = markerIndex >= 0
    ? `${url.pathname.slice(0, markerIndex)}${marker}`
    : configuredPath
        .replace(/\/info(?:\/(?:getPlayerRecentStat|findOrderDetailInfoAll))?$/, "")
        .replace(/\/(?:getPlayerRecentStat|findOrderDetailInfoAll)$/, "");
  const endpointSuffix = ENDPOINT_SPECS[endpoint].path.slice(marker.length);

  url.pathname = `${apiRoot}${endpointSuffix}`.replace(/\/{2,}/g, "/");
  url.search = "";
  url.hash = "";
  return url;
}

export function validateLzyumiProfileResponse(value: unknown) {
  const root = asRecord(value);
  requireSuccessCode(value, "profile");

  const battleInfo = asRecord(root?.battleInfo);
  const nameInfoNew = typeof battleInfo?.nameInfoNew === "string"
    ? battleInfo.nameInfoNew.trim()
    : "";
  const openId = typeof battleInfo?.openId === "string" ? battleInfo.openId.trim() : "";
  const areaId = Number(battleInfo?.areaId);

  if (
    !root ||
    !battleInfo ||
    !nameInfoNew ||
    !openId ||
    !Number.isInteger(areaId) ||
    areaId <= 0 ||
    !Array.isArray(battleInfo.mapOneInfoList) ||
    !hasExpectedHistoryRows(root.data)
  ) {
    throw new LzyumiBrowserContractError(
      "ECL.GG profile response is incomplete.",
      "profile",
      "malformed",
      providerCode(value) ?? undefined,
    );
  }

  return root;
}

export function validateLzyumiHistoryResponse(value: unknown) {
  const root = asRecord(value);
  requireSuccessCode(value, "history");

  if (!root || !hasExpectedHistoryRows(root.data)) {
    throw new LzyumiBrowserContractError(
      "ECL.GG history response is incomplete.",
      "history",
      "malformed",
      providerCode(value) ?? undefined,
    );
  }

  return root;
}

export function validateLzyumiRecentStatResponse(value: unknown) {
  const root = asRecord(value);
  requireSuccessCode(value, "recent");

  if (!root || !asRecord(root.data)) {
    throw new LzyumiBrowserContractError(
      "ECL.GG recent-stat response is incomplete.",
      "recent",
      "malformed",
      providerCode(value) ?? undefined,
    );
  }

  return root;
}

export function validateLzyumiDetailResponse(value: unknown) {
  const root = asRecord(value);
  requireSuccessCode(value, "detail");
  const data = asRecord(root?.data);
  const players = data?.wgBattleDetailInfo;
  const teams = data?.teamDetails;

  if (!root || !data || !Array.isArray(players) || players.length !== 10 || !Array.isArray(teams) || teams.length !== 2) {
    throw new LzyumiBrowserContractError(
      "ECL.GG match detail does not contain ten players and two teams.",
      "detail",
      "malformed",
      providerCode(value) ?? undefined,
    );
  }

  const teamIds = teams.map((team) => {
    const id = asRecord(team)?.teamId;
    return typeof id === "string" || typeof id === "number" ? String(id) : "";
  });
  const playerTeamIds = players.map((player) => {
    const id = asRecord(player)?.teamId;
    return typeof id === "string" || typeof id === "number" ? String(id) : "";
  });
  const teamCounts = teamIds.map(
    (teamId) => playerTeamIds.filter((playerTeamId) => playerTeamId === teamId).length,
  );

  if (
    teamIds.some((teamId) => !teamId) ||
    new Set(teamIds).size !== 2 ||
    playerTeamIds.some((teamId) => !teamIds.includes(teamId)) ||
    teamCounts.some((count) => count !== 5)
  ) {
    throw new LzyumiBrowserContractError(
      "ECL.GG match detail teams are incoherent.",
      "detail",
      "malformed",
      providerCode(value) ?? undefined,
    );
  }

  return root;
}

export function validateLzyumiBrowserResponse(
  value: unknown,
  endpoint: LzyumiBrowserEndpoint,
) {
  switch (endpoint) {
    case "profile":
      return validateLzyumiProfileResponse(value);
    case "history":
      return validateLzyumiHistoryResponse(value);
    case "recent":
      return validateLzyumiRecentStatResponse(value);
    case "detail":
      return validateLzyumiDetailResponse(value);
  }
}

export async function fetchLzyumiBrowserResponse(
  url: string,
  endpoint: LzyumiBrowserEndpoint,
  timeoutMs = 15_000,
  fetcher: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new LzyumiBrowserContractError(
      `ECL.GG ${endpoint} request could not reach the provider.`,
      endpoint,
      "network-rejected",
    );
  }

  if (!response.ok) {
    throw new LzyumiBrowserContractError(
      `ECL.GG ${endpoint} request failed with HTTP ${response.status}.`,
      endpoint,
      "http-error",
      undefined,
      response.status,
    );
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new LzyumiBrowserContractError(
      `ECL.GG ${endpoint} response is not valid JSON.`,
      endpoint,
      "malformed",
    );
  }

  return validateLzyumiBrowserResponse(value, endpoint);
}

export function unavailableLzyumiRecentStat(error: unknown): LzyumiOptionalRecentStat {
  return {
    status: "unavailable",
    reason: error instanceof LzyumiBrowserContractError ? error.kind : "network-rejected",
  };
}

export function validateLzyumiOptionalRecentStat(value: unknown): LzyumiOptionalRecentStat {
  const root = asRecord(value);
  if (root?.status === "unavailable") {
    const reason = root.reason;
    const allowed: LzyumiBrowserFailure[] = [
      "authentication",
      "throttled",
      "network-rejected",
      "not-found",
      "http-error",
      "malformed",
      "provider-error",
    ];
    if (typeof reason === "string" && allowed.includes(reason as LzyumiBrowserFailure)) {
      return { status: "unavailable", reason: reason as LzyumiBrowserFailure };
    }
  }

  if (root?.status === "available") {
    return { status: "available", value: validateLzyumiRecentStatResponse(root.value) };
  }

  throw new LzyumiBrowserContractError(
    "ECL.GG recent-stat availability is malformed.",
    "recent",
    "malformed",
  );
}
