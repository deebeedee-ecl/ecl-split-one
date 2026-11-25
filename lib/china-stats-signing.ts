import { buildLzyumiEndpointUrl } from "./lzyumi-browser-contract.ts";
import { createLzyumiSignature, getChinaServer } from "./lzyumi.ts";

const LZYUMI_BASE = "https://a.2025lol.top/lzyumi/lol";
const ALLOWED_AREA_IDS = new Set([1, 31]);
const MAX_IDENTITY_LENGTH = 160;
const MAX_GAME_ID_LENGTH = 200;

export type ChinaStatsSigningInput =
  | { type: "profile"; nickname: string; areaId: number }
  | { type: "history"; openId: string; areaId: number; filter: 2 | 3 }
  | { type: "recent"; openId: string; areaId: number }
  | { type: "detail"; openId: string; gameId: string; areaId: number };

export class ChinaStatsSigningInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChinaStatsSigningInputError";
  }
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new ChinaStatsSigningInputError(`${label} is invalid.`);
  }
  return text;
}

function allowedAreaId(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || !ALLOWED_AREA_IDS.has(value)) {
    throw new ChinaStatsSigningInputError("Select Ionia or Super Server.");
  }
  return value;
}

export function parseChinaStatsSigningInput(value: unknown): ChinaStatsSigningInput {
  const body = asRecord(value);
  if (!body) {
    throw new ChinaStatsSigningInputError("Lookup request is invalid.");
  }
  const type = body.type;
  const areaId = allowedAreaId(body.areaId);

  if (type === "profile") {
    return {
      type,
      areaId,
      nickname: requiredText(body.nickname, "Riot ID", MAX_IDENTITY_LENGTH),
    };
  }
  if (type === "history") {
    if (body.filter !== 2 && body.filter !== 3) {
      throw new ChinaStatsSigningInputError("Ranked queue is invalid.");
    }
    return {
      type,
      areaId,
      filter: body.filter,
      openId: requiredText(body.openId, "Player identity", MAX_IDENTITY_LENGTH),
    };
  }
  if (type === "recent") {
    return {
      type,
      areaId,
      openId: requiredText(body.openId, "Player identity", MAX_IDENTITY_LENGTH),
    };
  }
  if (type === "detail") {
    return {
      type,
      areaId,
      openId: requiredText(body.openId, "Player identity", MAX_IDENTITY_LENGTH),
      gameId: requiredText(body.gameId, "Match identity", MAX_GAME_ID_LENGTH),
    };
  }

  throw new ChinaStatsSigningInputError("Lookup type is invalid.");
}

export function buildChinaStatsSignedUrl(input: ChinaStatsSigningInput) {
  const server = getChinaServer(input.areaId);
  const { lzyumiSign, signStr } = createLzyumiSignature();

  if (input.type === "detail") {
    const url = buildLzyumiEndpointUrl(LZYUMI_BASE, "detail");
    url.searchParams.set("openId", input.openId);
    url.searchParams.set("gameId", input.gameId);
    url.searchParams.set("areaId", String(server.id));
    url.searchParams.set("lzyumiSign", lzyumiSign);
    url.searchParams.set("signStr", signStr);
    return url.toString();
  }

  if (input.type === "recent") {
    const url = buildLzyumiEndpointUrl(LZYUMI_BASE, "recent");
    url.searchParams.set("openId", input.openId);
    url.searchParams.set("areaId", String(server.id));
    url.searchParams.set("lzyumiSign", lzyumiSign);
    url.searchParams.set("signStr", signStr);
    return url.toString();
  }

  const url = buildLzyumiEndpointUrl(LZYUMI_BASE, input.type === "profile" ? "profile" : "history");
  url.searchParams.set("nickname", input.type === "profile" ? input.nickname.replace(/#/g, "*~*~*") : "");
  url.searchParams.set("allCount", "20");
  url.searchParams.set("areaId", String(server.id));
  url.searchParams.set("areaName", server.name);
  url.searchParams.set("seleMe", "1");
  url.searchParams.set("filter", String(input.type === "profile" ? 1 : input.filter));
  url.searchParams.set("openId", input.type === "history" ? input.openId : "");
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);
  return url.toString();
}

type RateBucket = { windowStartedAt: number; used: number };

export type ChinaStatsSigningRateStore = Map<string, RateBucket>;

const globalRateState = globalThis as typeof globalThis & {
  __eclChinaStatsSigningRateStore?: ChinaStatsSigningRateStore;
};

const defaultRateStore = globalRateState.__eclChinaStatsSigningRateStore
  ?? new Map<string, RateBucket>();

globalRateState.__eclChinaStatsSigningRateStore = defaultRateStore;

export function consumeChinaStatsSigningBudget({
  key,
  now = Date.now(),
  limit = 24,
  windowMs = 60_000,
  store = defaultRateStore,
}: {
  key: string;
  now?: number;
  limit?: number;
  windowMs?: number;
  store?: ChinaStatsSigningRateStore;
}) {
  const current = store.get(key);
  const bucket = !current || now - current.windowStartedAt >= windowMs
    ? { windowStartedAt: now, used: 0 }
    : current;

  if (bucket.used >= limit) {
    return {
      allowed: false as const,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.windowStartedAt + windowMs - now) / 1000)),
    };
  }

  bucket.used += 1;
  store.set(key, bucket);
  return {
    allowed: true as const,
    remaining: Math.max(0, limit - bucket.used),
    retryAfterSeconds: 0,
  };
}
