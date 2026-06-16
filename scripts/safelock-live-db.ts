import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TableRef = {
  table_schema: string;
  table_name: string;
};

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function main() {
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "")
    .replaceAll(".", "")
    .replace("T", "-")
    .replace("Z", "Z");

  mkdirSync("backups", { recursive: true });

  const tables = await prisma.$queryRawUnsafe<TableRef[]>(`
    select table_schema, table_name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name
  `);

  const backup: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    source: "DATABASE_URL",
    tables: {},
    counts: {},
  };

  for (const table of tables) {
    const key = `${table.table_schema}.${table.table_name}`;
    const fullName = `${quoteIdent(table.table_schema)}.${quoteIdent(table.table_name)}`;
    const rows = await prisma.$queryRawUnsafe<unknown[]>(`select * from ${fullName}`);

    (backup.tables as Record<string, unknown[]>)[key] = rows;
    (backup.counts as Record<string, number>)[key] = rows.length;
  }

  const path = join("backups", `ecl-live-db-safelock-${stamp}.json`);
  writeFileSync(path, JSON.stringify(backup, jsonReplacer, 2));

  console.log(
    JSON.stringify(
      {
        path,
        tables: tables.length,
        counts: backup.counts,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
