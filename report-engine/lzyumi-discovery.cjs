"use strict";

const OBSERVED_CUSTOM_BATTLE_TYPES = new Set(["0", "7", "10"]);
const OBSERVED_MATCHED_BATTLE_TYPES = new Set(["1", "5", "6", "9", "11"]);

class LzyumiDiscoveryBudgetError extends Error {
  constructor(kind, limit) {
    super(`Lzyumi ${kind} request budget of ${limit} was exhausted.`);
    this.name = "LzyumiDiscoveryBudgetError";
    this.kind = kind;
    this.limit = limit;
  }
}

class LzyumiDiscoveryCooldownError extends Error {
  constructor(retryAfterMs) {
    super(`Lzyumi discovery is cooling down after provider pressure; retry in ${Math.ceil(retryAfterMs / 1000)} seconds.`);
    this.name = "LzyumiDiscoveryCooldownError";
    this.retryAfterMs = retryAfterMs;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function createDiscoveryRequestBudget({ historyLimit = 8, detailLimit = 4 } = {}) {
  const limits = {
    history: positiveInteger(historyLimit, 8),
    detail: positiveInteger(detailLimit, 4),
  };
  const used = { history: 0, detail: 0 };

  const consume = (kind) => {
    if (used[kind] >= limits[kind]) {
      throw new LzyumiDiscoveryBudgetError(kind, limits[kind]);
    }
    used[kind] += 1;
  };

  return {
    consumeHistory: () => consume("history"),
    consumeDetail: () => consume("detail"),
    remainingHistory: () => limits.history - used.history,
    remainingDetail: () => limits.detail - used.detail,
    snapshot: () => ({
      history: { used: used.history, limit: limits.history },
      detail: { used: used.detail, limit: limits.detail },
    }),
  };
}

function providerPressureCode(error) {
  const code = error?.code == null ? "" : String(error.code);
  return code === "7" || code === "8" ? code : null;
}

function createProviderPressureCooldown({ cooldownMs = 60_000, now = () => Date.now() } = {}) {
  const durationMs = Math.max(0, Number(cooldownMs) || 0);
  let blockedUntil = 0;

  return {
    assertAvailable() {
      const retryAfterMs = blockedUntil - now();
      if (retryAfterMs > 0) throw new LzyumiDiscoveryCooldownError(retryAfterMs);
    },
    record(error) {
      if (!providerPressureCode(error) || durationMs === 0) return false;
      blockedUntil = Math.max(blockedUntil, now() + durationMs);
      return true;
    },
    remainingMs() {
      return Math.max(0, blockedUntil - now());
    },
  };
}

function historyCandidatePriority(game) {
  const battleType = game?.battleTypeInfo == null ? "" : String(game.battleTypeInfo).trim();
  if (OBSERVED_CUSTOM_BATTLE_TYPES.has(battleType)) return 0;
  if (OBSERVED_MATCHED_BATTLE_TYPES.has(battleType)) return null;
  return 1;
}

function detailConfirmsCustomGame(detail) {
  return String(detail?.data?.gameType || "").trim().toUpperCase() === "CUSTOM_GAME";
}

function nonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function classifyLzyumiDiscoveryResult(result) {
  if (result?.match) return { kind: "match", match: result.match };

  const historyFailures = nonNegativeInteger(result?.historyFailures);
  const detailFailures = nonNegativeInteger(result?.detailFailures);
  if (historyFailures > 0 || detailFailures > 0) {
    return { kind: "provider-incomplete", historyFailures, detailFailures };
  }

  if (result?.best) return { kind: "roster-miss", best: result.best };
  if (result?.closestOutOfWindow) {
    return { kind: "out-of-window", closestOutOfWindow: result.closestOutOfWindow };
  }
  return { kind: "not-found" };
}

function formatIncompleteLzyumiDiscovery(outcome) {
  const failures = [];
  if (outcome?.historyFailures > 0) {
    failures.push(`${outcome.historyFailures} history request${outcome.historyFailures === 1 ? "" : "s"}`);
  }
  if (outcome?.detailFailures > 0) {
    failures.push(
      `${outcome.detailFailures} match-detail request${outcome.detailFailures === 1 ? "" : "s"}`,
    );
  }

  const failedRequests = failures.join(" and ") || "one or more provider requests";
  return `Lzyumi could not complete the inhouse lookup because ${failedRequests} failed. ` +
    "This is a provider failure, not evidence that the game is missing. " +
    "Wait a few minutes and type !report again if the inhouse is still active.";
}

function sourceMatchesExpectedIdentity({
  player,
  profile,
  openId,
  areaId,
  resolvedRiotIdMatches,
}) {
  const battleInfo = profile?.battleInfo;
  const resolvedName = typeof battleInfo?.nameInfoNew === "string"
    ? battleInfo.nameInfoNew.trim()
    : "";
  if (!battleInfo || !resolvedName || !resolvedRiotIdMatches(resolvedName, player.riotName, player.riotTag)) {
    return false;
  }

  const savedOpenId = typeof player.openId === "string" ? player.openId.trim() : "";
  if (!savedOpenId || openId !== savedOpenId) return false;

  const expectedAreaId = Number(player.chinaServerId);
  const requestedAreaId = Number(areaId);
  const resolvedAreaId = Number(battleInfo.areaId ?? battleInfo.area ?? battleInfo.translateAreaId);
  return Number.isFinite(expectedAreaId) && expectedAreaId > 0 &&
    Number.isFinite(requestedAreaId) && requestedAreaId === expectedAreaId &&
    Number.isFinite(resolvedAreaId) && resolvedAreaId === expectedAreaId;
}

function detailParticipantMatchesExpectedIdentity({ player, detailPlayer }) {
  const savedOpenId = typeof player.openId === "string" ? player.openId.trim() : "";
  const resolvedOpenId = typeof detailPlayer?.openIdNow === "string" ? detailPlayer.openIdNow.trim() : "";
  if (!savedOpenId || resolvedOpenId !== savedOpenId) return false;

  const expectedAreaId = Number(player.chinaServerId);
  const resolvedAreaId = Number(
    detailPlayer?.translateAreaId ??
    detailPlayer?.areaId ??
    detailPlayer?.area,
  );
  return Number.isFinite(expectedAreaId) && expectedAreaId > 0 &&
    Number.isFinite(resolvedAreaId) && resolvedAreaId === expectedAreaId;
}

async function findBoundedLzyumiMatch({
  players,
  filters,
  historyConcurrency = 2,
  budget,
  reportedGameIds = [],
  fetchHistory,
  fetchDetail,
  isInWindow,
  sortValue,
  matchRoster,
  requiredMatches,
  onLookupError = () => {},
}) {
  const searchPlayers = Array.from(players || []);
  const historyFilters = Array.from(filters || []);
  const concurrency = Math.min(2, positiveInteger(historyConcurrency, 1));
  const reported = new Set(reportedGameIds || []);
  const candidatesByGameId = new Map();
  const attemptedDetails = new Set();
  let best = null;
  let closestOutOfWindow = null;
  let historyFailures = 0;
  let detailFailures = 0;
  let sourcesChecked = 0;
  let candidatesConsidered = 0;

  const result = (match = null) => ({
    match,
    best,
    closestOutOfWindow,
    historyFailures,
    detailFailures,
    sourcesChecked,
    candidatesConsidered,
    budget: budget.snapshot(),
  });

  const attemptCandidates = async (candidates, maxPriority = Number.POSITIVE_INFINITY) => {
    const pending = candidates
      .filter((candidate) =>
        !attemptedDetails.has(candidate.gameId) && candidate.priority <= maxPriority)
      .sort((a, b) => a.priority - b.priority || sortValue(a.game) - sortValue(b.game));

    for (const candidate of pending) {
      if (budget.remainingDetail() <= 0) return null;
      attemptedDetails.add(candidate.gameId);

      let detail;
      try {
        detail = await fetchDetail(candidate.source, candidate.game, budget);
      } catch (error) {
        if (providerPressureCode(error)) throw error;
        if (!(error instanceof LzyumiDiscoveryBudgetError)) {
          detailFailures += 1;
          await onLookupError({
            stage: "detail",
            error,
            playerIndex: candidate.playerIndex,
            filter: candidate.filter,
          });
        }
        continue;
      }

      if (!detailConfirmsCustomGame(detail)) continue;
      const rosterMatch = matchRoster(detail);
      const checked = { ...candidate, detail, rosterMatch };
      if (!best || rosterMatch.matched.length > best.rosterMatch.matched.length) best = checked;
      if (rosterMatch.matched.length >= requiredMatches) return checked;
    }

    return null;
  };

  outer:
  for (const filter of historyFilters) {
    for (let playerIndex = 0; playerIndex < searchPlayers.length;) {
      const available = budget.remainingHistory();
      if (available <= 0 || budget.remainingDetail() <= 0) break outer;

      const batchSize = Math.min(concurrency, available, searchPlayers.length - playerIndex);
      const batch = searchPlayers
        .slice(playerIndex, playerIndex + batchSize)
        .map((player, offset) => ({ player, playerIndex: playerIndex + offset }));
      playerIndex += batchSize;

      const outcomes = await Promise.all(batch.map(async ({ player, playerIndex: sourcePlayerIndex }) => {
        try {
          const source = await fetchHistory(player, filter, budget);
          return { filter, playerIndex: sourcePlayerIndex, source, error: null };
        } catch (error) {
          return { filter, playerIndex: sourcePlayerIndex, source: null, error };
        }
      }));

      const pressure = outcomes.find((outcome) => providerPressureCode(outcome.error));
      if (pressure) throw pressure.error;

      for (const outcome of outcomes) {
        if (outcome.error) {
          if (!(outcome.error instanceof LzyumiDiscoveryBudgetError)) {
            historyFailures += 1;
            await onLookupError({
              stage: "history",
              error: outcome.error,
              playerIndex: outcome.playerIndex,
              filter: outcome.filter,
            });
          }
          continue;
        }
        if (!outcome.source) continue;

        sourcesChecked += 1;
        for (const game of outcome.source.games || []) {
          const gameId = String(game?.gameId || "").trim();
          if (!gameId || reported.has(gameId) || attemptedDetails.has(gameId)) continue;

          const priority = historyCandidatePriority(game);
          if (priority == null) continue;
          if (!isInWindow(game)) {
            if (!closestOutOfWindow || sortValue(game) < sortValue(closestOutOfWindow.game)) {
              closestOutOfWindow = { source: outcome.source, game };
            }
            continue;
          }

          const existing = candidatesByGameId.get(gameId);
          if (!existing) {
            candidatesConsidered += 1;
          }
          if (!existing || priority < existing.priority ||
              (priority === existing.priority && sortValue(game) < sortValue(existing.game))) {
            candidatesByGameId.set(gameId, {
              source: outcome.source,
              game,
              gameId,
              priority,
              playerIndex: outcome.playerIndex,
              filter: outcome.filter,
            });
          }
        }
      }
    }

    // Search this filter across the roster before spending detail requests. This
    // prevents one reporter's stale history from consuming the complete history
    // budget before another participant can expose the shared custom game.
    const match = await attemptCandidates([...candidatesByGameId.values()], 0);
    if (match) return result(match);
  }

  // Unknown history types remain valid discovery candidates, but only after
  // observed custom-game candidates from the fair roster sweep were attempted.
  const fallbackMatch = await attemptCandidates([...candidatesByGameId.values()]);
  if (fallbackMatch) return result(fallbackMatch);

  return result();
}

module.exports = {
  LzyumiDiscoveryBudgetError,
  LzyumiDiscoveryCooldownError,
  classifyLzyumiDiscoveryResult,
  createDiscoveryRequestBudget,
  createProviderPressureCooldown,
  detailConfirmsCustomGame,
  detailParticipantMatchesExpectedIdentity,
  findBoundedLzyumiMatch,
  formatIncompleteLzyumiDiscovery,
  historyCandidatePriority,
  providerPressureCode,
  sourceMatchesExpectedIdentity,
};
