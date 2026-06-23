import { pgTable, uuid, text, integer, real, bigint, timestamp, jsonb } from "drizzle-orm/pg-core";

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().default("hardcoded-user"),
  name: text("name").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type", { enum: ["json", "lottie"] }).notNull(),
  rawJson: text("raw_json").notNull(),
  // Stored as JSONB for future querying, also mirrored as columns for indexed search
  metadata: jsonb("metadata").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  frameRate: real("frame_rate").notNull(),
  durationSeconds: real("duration_seconds").notNull(),
  layerCount: integer("layer_count").notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AssetRow = typeof assets.$inferSelect;
export type NewAssetRow = typeof assets.$inferInsert;
