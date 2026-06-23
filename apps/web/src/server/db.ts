import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@asset-locker/core";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgres://assetlocker:assetlocker@localhost:5432/assetlocker";

// Single connection pool shared across the server process
const client = postgres(DATABASE_URL, { max: 10 });

export const db = drizzle(client, { schema });
export type { DB } from "@asset-locker/core";
