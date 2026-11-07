const assert = require("node:assert/strict");
const test = require("node:test");
const { shouldRetryConfirmation } = require("../confirmation-utils.cjs");

test("confirmation retries transient rollout and service failures", () => {
  assert.equal(shouldRetryConfirmation(1), true);
  assert.equal(shouldRetryConfirmation(1, 500), true);
  assert.equal(shouldRetryConfirmation(1, 401), true);
  assert.equal(shouldRetryConfirmation(1, 403), true);
  assert.equal(shouldRetryConfirmation(1, 429), true);
});

test("confirmation stops on validation failures and after the attempt limit", () => {
  assert.equal(shouldRetryConfirmation(1, 400), false);
  assert.equal(shouldRetryConfirmation(1, 409), false);
  assert.equal(shouldRetryConfirmation(3, 500), false);
});
