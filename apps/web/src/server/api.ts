/**
 * Hono-based REST API layer: /api/v1/assets
 *
 * This is intentionally a thin adapter over @asset-locker/core.
 * It consumes the same business logic as the TanStack Start loaders and server
 * functions, proving that core is a genuine reusable package — not framework-coupled.
 *
 * Architecture note: we chose Hono over a TanStack Start API route because
 * TanStack Start 1.168 does not yet ship createAPIFileRoute in its public API.
 * Hono was listed as an acceptable choice in the brief.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createAsset,
  listAssets,
  getAssetById,
  deleteAsset,
  validateAssetName,
  validateFileSize,
  validateMetadata,
  validateLottieJson,
  CreateAssetInputSchema,
  PaginationSchema,
  ValidationError,
} from "@asset-locker/core";
import { db } from "./db.js";
import { broadcastAssetCreated } from "./sse.js";
import { registerSseClient } from "./sse.js";

const HARDCODED_USER_ID = "hardcoded-user";

export function createApiApp() {
  const app = new Hono();

  app.use("*", cors({ origin: "*" }));

  // GET /api/v1/assets — paginated list
  app.get("/api/v1/assets", async (c) => {
    const pagination = PaginationSchema.safeParse({
      page: c.req.query("page") ?? "1",
      pageSize: c.req.query("pageSize") ?? "20",
    });
    if (!pagination.success) {
      return c.json({ error: "Invalid pagination parameters" }, 400);
    }
    const result = await listAssets(db, pagination.data.page, pagination.data.pageSize);
    return c.json(result);
  });

  // POST /api/v1/assets — create asset
  app.post("/api/v1/assets", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = CreateAssetInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, 422);
    }

    const input = parsed.data;

    try {
      validateAssetName(input.name);
      validateFileSize(input.metadata.fileSizeBytes);
      validateMetadata(input.metadata);
      validateLottieJson(JSON.parse(input.rawJson) as unknown);
    } catch (err) {
      if (err instanceof ValidationError) {
        return c.json({ error: err.message, field: err.field }, 422);
      }
      throw err;
    }

    const asset = await createAsset(db, input);
    broadcastAssetCreated(HARDCODED_USER_ID, asset.id);
    return c.json(asset, 201);
  });

  // GET /api/v1/assets/:id — single asset
  app.get("/api/v1/assets/:id", async (c) => {
    const id = c.req.param("id");
    const asset = await getAssetById(db, id);
    if (!asset) return c.json({ error: "Asset not found" }, 404);
    return c.json(asset);
  });

  // DELETE /api/v1/assets/:id — delete asset
  app.delete("/api/v1/assets/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await deleteAsset(db, id);
    if (!deleted) return c.json({ error: "Asset not found" }, 404);
    return c.body(null, 204);
  });

  // GET /api/sse — Server-Sent Events for real-time updates
  app.get("/api/sse", (c) => {
    let cleanup: (() => void) | null = null;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Immediate "connected" event flushes the response headers
        controller.enqueue(encoder.encode(": connected\n\n"));
        cleanup = registerSseClient(HARDCODED_USER_ID, controller);
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            clearInterval(pingInterval);
          }
        }, 25_000);
      },
      cancel() {
        cleanup?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  return app;
}
