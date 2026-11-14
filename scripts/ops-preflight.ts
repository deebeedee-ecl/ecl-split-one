import { loadEnvConfig } from "@next/env";
import { parseOpsPreflightArguments, runOpsPreflight } from "../lib/ops-preflight";

async function main() {
  const options = parseOpsPreflightArguments(process.argv.slice(2));
  loadEnvConfig(process.cwd(), options.target === "local");
  const summary = await runOpsPreflight(options);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ready) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error && error.message === "Unknown ops preflight argument."
    ? error.message
    : "Ops preflight failed without exposing credentials.";
  console.error(message);
  process.exitCode = 1;
});
