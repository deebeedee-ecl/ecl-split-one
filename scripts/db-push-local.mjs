import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not configured. Add the local database URL to .env.local.");
  process.exit(1);
}

let target;
try {
  target = new URL(databaseUrl);
} catch {
  console.error("DATABASE_URL is invalid. No database changes were made.");
  process.exit(1);
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const postgresProtocols = new Set(["postgres:", "postgresql:"]);

if (!postgresProtocols.has(target.protocol) || !localHosts.has(target.hostname.toLowerCase())) {
  console.error("Refusing to push the schema: db:push:local only accepts a loopback PostgreSQL target.");
  process.exit(1);
}

if (process.argv.includes("--check")) {
  console.log("Local PostgreSQL target confirmed. No database changes were made.");
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "db", "push"],
  { stdio: "inherit", windowsHide: true },
);

if (result.error) {
  console.error("Prisma could not be started. No credentials were printed.");
  process.exit(1);
}

process.exit(result.status ?? 1);
