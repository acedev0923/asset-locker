import { eq, desc, count, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { assets } from "./db-schema.js";
import type { CreateAssetInput, PaginatedAssets, Asset } from "./schema.js";
import type * as schema from "./db-schema.js";

export type DB = PostgresJsDatabase<typeof schema>;

const HARDCODED_USER_ID = "hardcoded-user";

function rowToAsset(row: typeof assets.$inferSelect): Asset {
  return {
    id: row.id,
    name: row.name,
    originalFilename: row.originalFilename,
    fileType: row.fileType as "json" | "lottie",
    rawJson: row.rawJson,
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metadata: {
      width: row.width,
      height: row.height,
      frameRate: row.frameRate,
      durationSeconds: row.durationSeconds,
      layerCount: row.layerCount,
      fileSizeBytes: row.fileSizeBytes,
      contentHash: row.contentHash,
    },
  };
}

export async function createAsset(db: DB, input: CreateAssetInput): Promise<Asset> {
  const [row] = await db
    .insert(assets)
    .values({
      userId: HARDCODED_USER_ID,
      name: input.name,
      originalFilename: input.originalFilename,
      fileType: input.fileType,
      rawJson: input.rawJson,
      metadata: input.metadata,
      width: input.metadata.width,
      height: input.metadata.height,
      frameRate: input.metadata.frameRate,
      durationSeconds: input.metadata.durationSeconds,
      layerCount: input.metadata.layerCount,
      fileSizeBytes: input.metadata.fileSizeBytes,
      contentHash: input.metadata.contentHash,
    })
    .returning();

  if (!row) throw new Error("Insert returned no row");
  return rowToAsset(row);
}

export async function getAssetById(db: DB, id: string): Promise<Asset | null> {
  const [row] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);

  return row ? rowToAsset(row) : null;
}

export async function deleteAsset(db: DB, id: string): Promise<boolean> {
  const [row] = await db
    .delete(assets)
    .where(eq(assets.id, id))
    .returning({ id: assets.id });

  return row !== undefined;
}

export async function listAssets(
  db: DB,
  page: number,
  pageSize: number,
): Promise<PaginatedAssets> {
  const offset = (page - 1) * pageSize;

  const [rows, [countResult]] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(eq(assets.userId, HARDCODED_USER_ID))
      .orderBy(desc(assets.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(assets)
      .where(eq(assets.userId, HARDCODED_USER_ID)),
  ]);

  const total = countResult?.total ?? 0;

  return {
    assets: rows.map(rowToAsset),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
