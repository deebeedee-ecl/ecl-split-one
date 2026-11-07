import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export const PERFORMANCE_REQUEST_HEADER = "x-ecl-performance-request-id";
export const PERFORMANCE_RESPONSE_HEADER = "x-ecl-performance-request-id";

const SLOW_QUERY_THRESHOLD_MS = 250;
const REQUEST_ID_PATTERN = /^perf-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_NAME_PATTERN = /[^a-zA-Z0-9_.-]/g;

export type PerformanceRoute =
  | "hub.players.page"
  | "hub.leaderboard.page"
  | "hub.champions.page"
  | "hub.inhouses.page"
  | "api.account.profile.get"
  | "api.hub.my-inhouse-history.get";

type PerformancePhase = {
  name: string;
  durationMs: number;
};

type DatabaseQuery = PerformancePhase;

export type PerformanceRecord = {
  schemaVersion: 1;
  event: "ecl.performance";
  requestId: string;
  route: PerformanceRoute;
  outcome: "ok" | "error";
  status: number | null;
  totalDurationMs: number;
  phases: PerformancePhase[];
  database: {
    queryCount: number;
    totalDurationMs: number;
    slowQueryThresholdMs: number;
    slowQueryCount: number;
    slowQueries: DatabaseQuery[];
  };
};

type PerformanceTraceOptions = {
  route: PerformanceRoute;
  requestId?: string | null;
  logger?: (record: PerformanceRecord) => void;
};

const activeTrace = new AsyncLocalStorage<PerformanceTrace>();

function roundDuration(value: number) {
  return Math.round(Math.max(0, value) * 10) / 10;
}

function safeName(value: string, fallback: string) {
  const sanitized = value.replace(SAFE_NAME_PATTERN, "-").replace(/-+/g, "-").slice(0, 64);
  return sanitized || fallback;
}

export function normalizePerformanceRequestId(value?: string | null) {
  const candidate = value?.trim() ?? "";
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : `perf-${randomUUID()}`;
}

function defaultLogger(record: PerformanceRecord) {
  console.info(JSON.stringify(record));
}

export class PerformanceTrace {
  readonly requestId: string;
  readonly route: PerformanceRoute;

  private readonly startedAt = performance.now();
  private readonly phases: PerformancePhase[] = [];
  private readonly databaseQueries: DatabaseQuery[] = [];
  private readonly logger: (record: PerformanceRecord) => void;
  private status: number | null = null;
  private finished = false;

  constructor(options: PerformanceTraceOptions) {
    this.requestId = normalizePerformanceRequestId(options.requestId);
    this.route = options.route;
    this.logger = options.logger ?? defaultLogger;
  }

  async phase<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      this.phases.push({
        name: safeName(name, "server"),
        durationMs: roundDuration(performance.now() - startedAt),
      });
    }
  }

  phaseSync<T>(name: string, operation: () => T): T {
    const startedAt = performance.now();
    try {
      return operation();
    } finally {
      this.phases.push({
        name: safeName(name, "server"),
        durationMs: roundDuration(performance.now() - startedAt),
      });
    }
  }

  recordDatabaseQuery(model: string | undefined, operation: string, durationMs: number) {
    const modelName = safeName(model ?? "raw", "raw");
    const operationName = safeName(operation, "query");
    this.databaseQueries.push({
      name: `${modelName}.${operationName}`,
      durationMs: roundDuration(durationMs),
    });
  }

  addResponseHeaders(response: Response) {
    this.status = response.status;
    if (/\bpublic\b/i.test(response.headers.get("cache-control") ?? "")) {
      return;
    }
    const totalDurationMs = roundDuration(performance.now() - this.startedAt);
    const serverTiming = [
      ...this.phases.map((phase) => `${phase.name};dur=${phase.durationMs}`),
      `database;dur=${this.databaseDurationMs()}`,
      `total;dur=${totalDurationMs}`,
    ];
    response.headers.set("Server-Timing", serverTiming.join(", "));
    response.headers.set(PERFORMANCE_RESPONSE_HEADER, this.requestId);
  }

  finish(outcome: "ok" | "error") {
    if (this.finished) return;
    this.finished = true;
    const totalDurationMs = roundDuration(performance.now() - this.startedAt);
    const slowQueries = this.databaseQueries.filter(
      (query) => query.durationMs >= SLOW_QUERY_THRESHOLD_MS,
    );
    this.logger({
      schemaVersion: 1,
      event: "ecl.performance",
      requestId: this.requestId,
      route: this.route,
      outcome,
      status: this.status,
      totalDurationMs,
      phases: [...this.phases],
      database: {
        queryCount: this.databaseQueries.length,
        totalDurationMs: this.databaseDurationMs(),
        slowQueryThresholdMs: SLOW_QUERY_THRESHOLD_MS,
        slowQueryCount: slowQueries.length,
        slowQueries,
      },
    });
  }

  private databaseDurationMs() {
    return roundDuration(
      this.databaseQueries.reduce((total, query) => total + query.durationMs, 0),
    );
  }
}

export async function withPerformanceTrace<T>(
  options: PerformanceTraceOptions,
  operation: (trace: PerformanceTrace) => Promise<T>,
): Promise<T> {
  const trace = new PerformanceTrace(options);
  return activeTrace.run(trace, async () => {
    try {
      const result = await operation(trace);
      if (result instanceof Response) trace.addResponseHeaders(result);
      trace.finish("ok");
      return result;
    } catch (error) {
      trace.finish("error");
      throw error;
    }
  });
}

export function recordActiveDatabaseQuery(
  model: string | undefined,
  operation: string,
  durationMs: number,
) {
  activeTrace.getStore()?.recordDatabaseQuery(model, operation, durationMs);
}
