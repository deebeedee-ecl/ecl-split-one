// Directly add the lzyumiRankedGames column via Supabase REST API
import { readFileSync } from "node:fs";

// Read .env file
const env = readFileSync(".env", "utf8");
const lines = env.split("\n");
const envMap = {};
for (const line of lines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) envMap[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
}

const DATABASE_URL = envMap.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("No DATABASE_URL found in .env");
  process.exit(1);
}

console.log("DATABASE_URL found:", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));

// Use pg to run the SQL
const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  console.log("Connected to database");

  // Check if column exists
  const check = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'AccountProfile' AND column_name = 'lzyumiRankedGames'
  `);
  
  if (check.rows.length > 0) {
    console.log("Column lzyumiRankedGames already exists!");
  } else {
    await client.query(`ALTER TABLE "AccountProfile" ADD COLUMN IF NOT EXISTS "lzyumiRankedGames" JSONB`);
    console.log("Column lzyumiRankedGames added successfully!");
  }

  // Also check lzyumiRecentStat
  const check2 = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'AccountProfile' AND column_name = 'lzyumiRecentStat'
  `);
  console.log("lzyumiRecentStat exists:", check2.rows.length > 0);

  // Show all lzyumi columns
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'AccountProfile' AND column_name LIKE 'lzyumi%'
    ORDER BY column_name
  `);
  console.log("All lzyumi columns:", cols.rows.map(r => r.column_name));

} catch (err) {
  console.error("Error:", err.message);
} finally {
  await client.end();
}
