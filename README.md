# Asset Locker

A minimal Lottie asset library. Upload `.json` and `.lottie` animations, browse them in a paginated grid, and view full metadata — with server-side rendering and a Rust/WASM parser running in a Web Worker.

## Quick Start

**Requires: Docker, Node.js 20+, pnpm**

```bash
./dev.sh
```

Open http://localhost:5173

The script handles everything in order: starts PostgreSQL, builds the Rust/WASM module from source (first run only, ~5 minutes), installs dependencies, runs the database migration, then starts the dev server. On subsequent runs it skips the WASM build and just starts the server.

**What the script does, step by step:**

```bash
# 1. Start PostgreSQL
docker run -d --name asset-locker-pg \
  -e POSTGRES_USER=assetlocker -e POSTGRES_PASSWORD=assetlocker \
  -e POSTGRES_DB=assetlocker -p 5432:5432 postgres:16-alpine

# 2. Build Rust/WASM (skipped if apps/web/src/wasm/lottie_parser_bg.wasm exists)
docker run --rm -v $(pwd):/workspace -w /workspace/crates/lottie-parser \
  -e HOME=/root rust:1.96-slim-bookworm \
  bash -c "rustup target add wasm32-unknown-unknown && cargo install wasm-pack && \
           wasm-pack build --target web --out-dir /workspace/apps/web/src/wasm"

# 3. Install dependencies
pnpm install --frozen-lockfile

# 4. Run the database migration
cd apps/web && DATABASE_URL="postgres://assetlocker:assetlocker@localhost:5432/assetlocker" \
  pnpm db:migrate && cd ../..

# 5. Start the dev server
DATABASE_URL="postgres://assetlocker:assetlocker@localhost:5432/assetlocker" pnpm dev
```

## Architecture Decisions

### Monorepo structure

```
asset-locker/
├── packages/core/        # @asset-locker/core — pure business logic
├── apps/web/             # TanStack Start SSR app + Hono REST API
└── crates/lottie-parser/ # Rust → WASM parser
```

The `core` package contains all domain logic: Zod schemas, validation functions, Drizzle ORM schema, and repository functions. No framework imports. It can be consumed by:

- TanStack Start route loaders and server functions (current)
- The Hono REST API layer (current — `/api/v1/assets`)
- A future GraphQL resolver layer (see below)

### ORM: Drizzle over Prisma/Kysely

- **Not Prisma** (explicitly disallowed in the brief)
- **Drizzle vs Kysely**: Drizzle is schema-first — the table definition in `db-schema.ts` is the single source of truth for both TypeScript types and SQL. Kysely requires separate type generation. Drizzle's query API is closer to SQL, which maps well to the simple CRUD operations needed here.

### Real-time: SSE (Server-Sent Events)

SSE is a natural fit:

- Data flows strictly **one direction**: server → client (new asset notification)
- The browser's `EventSource` API handles reconnection automatically — no library needed
- Works over plain HTTP/1.1; no WebSocket upgrade handshake
- Simpler server state: one `Set<controller>` per process vs. a WS connection pool

**Tradeoff vs WebSockets**: WebSockets would allow bidirectional communication (useful for collaborative editing), but that's not needed here. BroadcastChannel only works within a single browser session and doesn't cross machines.

**Production caveat**: The current in-memory `Set<controller>` is process-scoped. With multiple server instances, we'd replace this with a Redis pub/sub subscription per SSE connection.

### TanStack Start mental model

**Loader data vs TanStack Query:**

- `loader` runs on the server during SSR and on navigation. It provides the initial dataset for first paint — no client-side roundtrip.
- `useQuery` with `initialData: loaderData` hydrates from the server payload and manages client cache thereafter. Post-hydration refetches (pagination changes, SSE invalidations) go through Query.
- The boundary: loaders own *when to fetch on the server*; Query owns *what to do with the data on the client*.

**Server functions vs API routes:**

- `createServerFn` (in `functions.ts`) is the primary mutation surface for TanStack Start's RPC model.
- The `/api/v1/assets` REST endpoint is implemented via Hono and wired into the server entry, because `createAPIFileRoute` is not yet public in TanStack Start 1.168. The brief explicitly allows Hono.

**Router context:**

- `QueryClient` is created in `getRouter()` and passed via router context.
- The root route reads it via `Route.useRouteContext()` and wraps the tree with `QueryClientProvider`.
- This avoids creating a second QueryClient on the client side, ensuring SSR-dehydrated queries hydrate into the correct instance.

### GraphQL extension path

The `core` package is already structured as a pure service layer. Adding a GraphQL resolver layer means:

```ts
// graphql/resolvers/Asset.ts
import { listAssets, getAssetById, createAsset, type Asset } from "@asset-locker/core";
import { db } from "../db.js"; // same Drizzle instance

const resolvers = {
  Query: {
    assets: (_: unknown, { page, pageSize }: { page: number; pageSize: number }) =>
      listAssets(db, page, pageSize),
    asset: (_: unknown, { id }: { id: string }) =>
      getAssetById(db, id),
  },
  Mutation: {
    createAsset: (_: unknown, { input }: { input: CreateAssetInput }) =>
      createAsset(db, input),
  },
};
```

`core` has zero framework imports. The GraphQL layer imports `core` exactly the same way the Hono API and TanStack Start server functions do — it's just another adapter.

### Rust/WASM parser

The `crates/lottie-parser` crate:

- Parses Lottie JSON (`.json`) and `.lottie` ZIP archives
- Computes SHA-256 content hash using the `sha2` crate
- Extracts: width, height, frame rate, duration, layer count, file size
- Validates magic bytes for `.lottie` ZIPs (`PK\x03\x04`)
- Exposed to JS via `wasm-bindgen` with clean types

**Why in Rust?** Lottie files can be 1–10+ MB. Computing SHA-256, JSON parsing, and ZIP traversal on a large file in the main thread would block UI. The WASM module runs in a Web Worker, so the main thread stays responsive.

**JS/WASM boundary**: Two public functions (`parse_lottie`, `parse_lottie_zip`) take `Uint8Array`, return an `AssetMetadata` class with `to_js_object()`. The JS side converts to a plain object before postMessage to avoid issues with transferring WASM heap references.

### What belongs in Rust vs JS

- **Rust**: hashing (deterministic, performance-sensitive), ZIP parsing (manual, no good WASM-compatible zip crate), JSON deserialization into typed structs
- **JS**: Worker lifecycle management, message routing, UI state, TanStack Query integration

## Where I cut scope

- **Thumbnail generation**: Rendering a Lottie frame in WASM would require a full canvas/renderer — significant scope. Placeholder SVG shown instead.
- **Optimistic UI**: Would add TanStack Query `optimisticMutation` pattern, rolling back via `onError` handler. The mutation structure in `UploadDialog.tsx` is ready for this — just needs `onMutate` added.
- **Benchmark**: See BENCHMARKS.md for the comparison approach I would have taken with more time.
- **GIF/MP4 conversion**: Would use `ffmpeg-wasm` or a server-side queue (Bull + FFmpeg binary). Not implemented due to time.
- **ScrollRestoration deprecation**: TanStack Router v1.17x moved `ScrollRestoration` to a router config option. Updated in `__root.tsx`.
