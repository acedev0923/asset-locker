#!/usr/bin/env bash
set -euo pipefail

DB_URL="postgres://assetlocker:assetlocker@localhost:5432/assetlocker"
WASM_OUT="apps/web/src/wasm/lottie_parser_bg.wasm"

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RESET='\033[0m'

step() { echo -e "\n${BOLD}${CYAN}▸ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✓ $1${RESET}"; }
info() { echo -e "  ${YELLOW}→ $1${RESET}"; }

# ── 1. PostgreSQL ──────────────────────────────────────────────────────────────
step "PostgreSQL"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^asset-locker-pg$'; then
  ok "Container already running"
elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^asset-locker-pg$'; then
  docker start asset-locker-pg > /dev/null
  ok "Container restarted"
else
  docker run -d \
    --name asset-locker-pg \
    -e POSTGRES_USER=assetlocker \
    -e POSTGRES_PASSWORD=assetlocker \
    -e POSTGRES_DB=assetlocker \
    -p 5432:5432 \
    postgres:16-alpine > /dev/null
  ok "Container created and started"
fi

info "Waiting for PostgreSQL to accept connections..."
until docker exec asset-locker-pg pg_isready -U assetlocker > /dev/null 2>&1; do
  sleep 1
done
ok "PostgreSQL ready"

# ── 2. WASM ────────────────────────────────────────────────────────────────────
step "Rust/WASM module"
if [ -f "$WASM_OUT" ]; then
  ok "Already built — skipping (delete $WASM_OUT to force a rebuild)"
else
  info "Building from source via Docker (first run takes ~5 minutes)..."
  docker run --rm \
    -v "$(pwd)":/workspace \
    -w /workspace/crates/lottie-parser \
    -e HOME=/root \
    rust:1.96-slim-bookworm \
    bash -c "rustup target add wasm32-unknown-unknown && cargo install wasm-pack && wasm-pack build --target web --out-dir /workspace/apps/web/src/wasm"
  ok "WASM built → apps/web/src/wasm/"
fi

# ── 3. Dependencies ────────────────────────────────────────────────────────────
step "Dependencies"
pnpm install --frozen-lockfile
ok "Installed"

# ── 4. Migration ───────────────────────────────────────────────────────────────
step "Database migration"
cd apps/web && DATABASE_URL="$DB_URL" pnpm db:migrate && cd ../..
ok "Schema up to date"

# ── 5. Dev server ──────────────────────────────────────────────────────────────
step "Starting dev server → http://localhost:5173"
echo ""
DATABASE_URL="$DB_URL" pnpm dev
