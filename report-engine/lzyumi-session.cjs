"use strict";

const { LzyumiResponseError } = require("./lzyumi-client.cjs");

function isLzyumiSessionError(error) {
  return error instanceof LzyumiResponseError && String(error.code) === "6";
}

function shouldFallbackToLzyumiBrowser(error) {
  return error instanceof LzyumiResponseError && ["6", "8"].includes(String(error.code));
}

function summarizeLzyumiTokenStatus(response) {
  const code = response?.code == null ? null : String(response.code).slice(0, 32);
  const endTime = typeof response?.data?.endTime === "string"
    ? response.data.endTime.trim().slice(0, 64)
    : null;

  return {
    code,
    authenticated: code === "1" || code === "2",
    loginRequired: code === "6",
    providerFailure: code === "8",
    endTime,
  };
}

function createSerializedOperationQueue() {
  let tail = Promise.resolve();

  return (operation) => {
    const current = tail.then(operation, operation);
    tail = current.catch(() => undefined);
    return current;
  };
}

async function withLzyumiSessionRecovery({
  operation,
  recoverSession,
  onRetry = () => {},
}) {
  try {
    return await operation();
  } catch (error) {
    if (!isLzyumiSessionError(error)) throw error;

    await onRetry(error);
    await recoverSession();
    return operation();
  }
}

module.exports = {
  createSerializedOperationQueue,
  isLzyumiSessionError,
  shouldFallbackToLzyumiBrowser,
  summarizeLzyumiTokenStatus,
  withLzyumiSessionRecovery,
};
