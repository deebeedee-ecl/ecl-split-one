import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

import { resolveApplicationDatabaseUrl } from "./lib/database-url";

loadEnvConfig(process.cwd());

const databaseUrl = resolveApplicationDatabaseUrl();
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
});
