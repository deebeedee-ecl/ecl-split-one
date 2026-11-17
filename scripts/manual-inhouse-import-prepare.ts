import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildManualInhouseImportManifest } from "../lib/manual-inhouse-import";

function option(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function requiredOption(name: string) {
  const value = option(name);
  if (!value) throw new Error(`Missing ${name}=...`);
  return value;
}

function assertPrivateOperationalPath(filePath: string) {
  const relative = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
  if (!/^report-engine\/inhouse-discovery-[^/]+\.json$/.test(relative)) {
    throw new Error("Discovery, review, and manifest files must use ignored report-engine/inhouse-discovery-*.json paths.");
  }
}

async function main() {
  const discoveryPath = path.resolve(requiredOption("--discovery"));
  const reviewPath = path.resolve(requiredOption("--review"));
  const outputPath = path.resolve(requiredOption("--output"));
  [discoveryPath, reviewPath, outputPath].forEach(assertPrivateOperationalPath);

  const [discovery, review] = await Promise.all([
    readFile(discoveryPath, "utf8").then((value) => JSON.parse(value.replace(/^\uFEFF/, "")) as unknown),
    readFile(reviewPath, "utf8").then((value) => JSON.parse(value.replace(/^\uFEFF/, "")) as unknown),
  ]);
  const manifest = buildManualInhouseImportManifest(discovery, review);
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({
    batchId: manifest.batchId,
    gameCount: manifest.games.length,
    sinceChinaDay: manifest.scope.sinceChinaDay,
    untilChinaDay: manifest.scope.untilChinaDay,
    approvedUnregisteredParticipants: manifest.operatorReview.approvedUnregisteredParticipants === true,
    output: path.relative(process.cwd(), outputPath).replaceAll("\\", "/"),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Manual inhouse manifest preparation failed.");
  process.exitCode = 1;
});
