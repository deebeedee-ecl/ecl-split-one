"use strict";

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

async function mapWithConcurrency(values, limit, mapper) {
  const items = Array.from(values || []);
  if (items.length === 0) return [];

  const results = new Array(items.length);
  const workerCount = Math.min(positiveInteger(limit, 1), items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index], index);
      }
    }),
  );

  return results;
}

async function retryProviderCode(task, {
  code,
  retries = 2,
  baseDelayMs = 1000,
  isMatch = (error) => String(error?.code || "") === String(code),
  onRetry = () => {},
  sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
} = {}) {
  const retryLimit = Math.max(0, Math.floor(Number(retries) || 0));
  const delayBase = Math.max(0, Number(baseDelayMs) || 0);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!isMatch(error) || attempt >= retryLimit) throw error;
      const delayMs = delayBase * (attempt + 1);
      await onRetry({ attempt: attempt + 1, delayMs, error });
      await sleep(delayMs);
    }
  }
}

module.exports = {
  mapWithConcurrency,
  retryProviderCode,
};
