import { z } from "zod";

export const AssetMetadataSchema = z.object({
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  frameRate: z.number().positive(),
  durationSeconds: z.number().nonnegative(),
  layerCount: z.number().int().nonnegative(),
  fileSizeBytes: z.number().int().positive(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/, "Must be a SHA-256 hex string"),
});

export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

export const CreateAssetInputSchema = z.object({
  name: z.string().min(1).max(255),
  originalFilename: z.string().min(1).max(255),
  fileType: z.enum(["json", "lottie"]),
  rawJson: z.string().min(2),
  metadata: AssetMetadataSchema,
});

export type CreateAssetInput = z.infer<typeof CreateAssetInputSchema>;

export const AssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  originalFilename: z.string(),
  fileType: z.enum(["json", "lottie"]),
  rawJson: z.string(),
  metadata: AssetMetadataSchema,
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Asset = z.infer<typeof AssetSchema>;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginatedAssetsSchema = z.object({
  assets: z.array(AssetSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginatedAssets = z.infer<typeof PaginatedAssetsSchema>;
