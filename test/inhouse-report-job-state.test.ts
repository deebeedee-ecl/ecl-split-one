import assert from "node:assert/strict";
import test from "node:test";
import {
  claimedReportJobStatus,
  reportJobAction,
} from "../lib/inhouse-report-job-state.ts";

test("report job states distinguish discovery from confirmation work", () => {
  assert.equal(reportJobAction("PENDING"), "DISCOVER");
  assert.equal(reportJobAction("PROCESSING"), "DISCOVER");
  assert.equal(reportJobAction("CONFIRM_PENDING"), "CONFIRM");
  assert.equal(reportJobAction("CONFIRM_PROCESSING"), "CONFIRM");
  assert.equal(reportJobAction("FOUND"), null);
  assert.equal(claimedReportJobStatus("DISCOVER"), "PROCESSING");
  assert.equal(claimedReportJobStatus("CONFIRM"), "CONFIRM_PROCESSING");
});
