import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createAsset,
  getAssetById,
  listAssets,
  deleteAsset,
  validateAssetName,
  validateFileSize,
  validateMetadata,
  validateLottieJson,
  PaginationSchema,
  CreateAssetInputSchema,
  type Asset,
  type PaginatedAssets,
} from "@asset-locker/core";
import { db } from "./db.js";
import { broadcastAssetCreated } from "./sse.js";

const HARDCODED_USER_ID = "hardcoded-user";

export const getAssetsPage = createServerFn({ method: "GET" })
  .validator(PaginationSchema)
  .handler(async ({ data }): Promise<PaginatedAssets> => {
    return listAssets(db, data.page, data.pageSize);
  });

export const getAsset = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<Asset | null> => {
    return getAssetById(db, data.id);
  });

export const uploadAsset = createServerFn({ method: "POST" })
  .validator(CreateAssetInputSchema)
  .handler(async ({ data }): Promise<Asset> => {
    // All business logic lives in core — server fn is a thin adapter
    validateAssetName(data.name);
    validateFileSize(data.metadata.fileSizeBytes);
    validateMetadata(data.metadata);

    // Re-validate lottie JSON structure
    const parsed = JSON.parse(data.rawJson) as unknown;
    validateLottieJson(parsed);

    const asset = await createAsset(db, data);

    // Notify other tabs via SSE
    broadcastAssetCreated(HARDCODED_USER_ID, asset.id);

    return asset;
  });

export const removeAsset = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<{ deleted: boolean }> => {
    const deleted = await deleteAsset(db, data.id);
    return { deleted };
  });
