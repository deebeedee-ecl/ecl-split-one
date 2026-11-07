"use strict";

const { mapWithConcurrency } = require("./async-utils.cjs");
const { LzyumiResponseError } = require("./lzyumi-client.cjs");

function isMalformedHistoryError(error) {
  return error instanceof LzyumiResponseError && error.reason === "malformed-history";
}

function malformedSummary(outcomes) {
  return outcomes
    .filter((outcome) => isMalformedHistoryError(outcome.error))
    .map((outcome) => ({
      filter: outcome.filter,
      responseShape: outcome.error.responseShape,
    }));
}

async function collectLzyumiHistoryResponses({
  filters,
  concurrency,
  fetchHistory,
  resetBrowserSession,
  malformedRetries = 1,
  onMalformed = () => {},
}) {
  const retryLimit = Math.max(0, Math.floor(Number(malformedRetries) || 0));

  for (let attempt = 0; ; attempt += 1) {
    const outcomes = await mapWithConcurrency(filters, concurrency, async (filter) => {
      try {
        return { filter, response: await fetchHistory(filter), error: null };
      } catch (error) {
        return { filter, response: null, error };
      }
    });

    const fatal = outcomes.find((outcome) => outcome.error && !isMalformedHistoryError(outcome.error));
    if (fatal) throw fatal.error;

    const malformed = outcomes.filter((outcome) => isMalformedHistoryError(outcome.error));
    if (malformed.length > 0) {
      await onMalformed({
        attempt: attempt + 1,
        willRetry: attempt < retryLimit,
        responses: malformedSummary(outcomes),
      });

      if (attempt < retryLimit) {
        await resetBrowserSession("malformed-history-response");
        continue;
      }
    }

    const usableResponses = outcomes
      .filter((outcome) => !outcome.error && outcome.response != null)
      .map((outcome) => outcome.response);

    if (usableResponses.length > 0) return usableResponses;

    if (malformed.length > 0) {
      throw new LzyumiResponseError(
        "Lzyumi history remained incomplete after refreshing the report browser session.",
        null,
        {
          reason: "malformed-history",
          responseShape: malformed[0].error.responseShape,
        },
      );
    }

    return [];
  }
}

module.exports = {
  collectLzyumiHistoryResponses,
  isMalformedHistoryError,
};
