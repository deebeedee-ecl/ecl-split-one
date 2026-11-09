import assert from "node:assert/strict";
import test from "node:test";

import {
  collectReleaseStatus,
  deriveExitCode,
  parseArguments,
  shaMatches,
} from "../scripts/release-status.mjs";

const releaseSha = "18b5398c6e7b369757625f61c19817ee06281949";
const previewSha = "ae59ac33c182e9b70fa6f5d5ca8bf6dd71855afd";
const sharedTree = "f44f7bce8a0d21f789b5d876e8ec28562e3d8250";

test("release status arguments require complete Railway scope", () => {
  assert.throws(
    () => parseArguments(["--sha", releaseSha, "--railway-project", "project"]),
    /project, environment, and service together/,
  );
  assert.throws(
    () => parseArguments(["--sha", releaseSha, "--require-railway"]),
    /requires an explicit Railway scope/,
  );
  assert.throws(
    () => parseArguments(["--sha", releaseSha, "--vercel-scope", "unsafe & scope"]),
    /unsupported characters/,
  );
});

test("SHA matching accepts full and unambiguous prefix forms", () => {
  assert.equal(shaMatches(releaseSha, releaseSha), true);
  assert.equal(shaMatches("18b5398", releaseSha), true);
  assert.equal(shaMatches(releaseSha, "18b5398"), true);
  assert.equal(shaMatches("18b5398", "18b5399"), false);
});

test("release status verifies alternate Vercel source tree and keeps absent Railway explicit", async () => {
  const options = parseArguments([
    "--sha", releaseSha,
    "--vercel-sha", previewSha,
    "--railway-project", "project",
    "--railway-environment", "environment",
    "--railway-service", "service",
  ]);
  const runner = async (command: string, args: string[]) => {
    if (command === "gh") {
      return {
        stdout: JSON.stringify({
          check_runs: [{
            name: "Build, typecheck, and focused tests",
            status: "completed",
            conclusion: "success",
            details_url: "https://github.com/example/check?private=query",
          }],
        }),
        stderr: "",
      };
    }
    if (command === "vercel" && args[0] === "ls") {
      return {
        stdout: JSON.stringify({
          deployments: [{
            url: "preview.example.vercel.app",
            state: "READY",
            createdAt: 1_794_221_172_630,
            creator: { email: "must-not-leak@example.com" },
            meta: { githubCommitSha: previewSha },
          }],
        }),
        stderr: "",
      };
    }
    if (command === "vercel" && args[0] === "inspect") {
      return { stdout: JSON.stringify({ id: "dpl_verified", readyState: "READY" }), stderr: "" };
    }
    if (command === "git") {
      return { stdout: `${sharedTree}\n`, stderr: "" };
    }
    if (command === "railway") {
      return {
        stdout: JSON.stringify([{
          id: "older",
          status: "SUCCESS",
          creator: { email: "must-not-leak@example.com" },
          meta: { commitHash: "a8015fa9a2f15fddef319550aa8c32d40d2428b8" },
        }]),
        stderr: "",
      };
    }
    throw new Error(`Unexpected command: ${command}`);
  };

  const report = await collectReleaseStatus(options, runner);
  assert.equal(report.github.status, "SUCCESS");
  assert.equal(report.github.checks[0].detailsUrl, "https://github.com/example/check");
  assert.equal(report.vercel.status, "READY");
  assert.equal(report.vercel.treeEquivalent, true);
  assert.equal(report.railway.status, "NOT_FOUND");
  assert.equal(report.exitCode, 0);
  assert.equal(JSON.stringify(report).includes("must-not-leak"), false);
});

test("tree mismatch is a release failure", () => {
  const report = {
    github: { status: "SUCCESS" },
    vercel: { status: "READY", treeEquivalent: false },
    railway: { status: "SKIPPED" },
  };
  assert.equal(deriveExitCode(report), 1);
});

test("required Railway deployment stays incomplete until exact SUCCESS", () => {
  const report = {
    github: { status: "SUCCESS" },
    vercel: { status: "READY", treeEquivalent: true },
    railway: { status: "NOT_FOUND" },
  };
  assert.equal(deriveExitCode(report, { requireRailway: true }), 2);
  assert.equal(deriveExitCode(report, { requireRailway: false }), 0);
});
