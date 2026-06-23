import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgres://assetlocker:assetlocker@localhost:5432/assetlocker";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const sqlPath = join(__dirname, "../../drizzle/0001_init.sql");
const sql = readFileSync(sqlPath, "utf-8");

const client = postgres(DATABASE_URL, { max: 1 });

console.log("Running migrations...");
await client.unsafe(sql);
await client.end();
console.log("Migrations complete.");
