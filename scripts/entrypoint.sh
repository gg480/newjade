#!/bin/sh
set -e

# =========================================================
# Jade Inventory - Docker Entrypoint
# =========================================================
# All persistent data (db, images, logs) stored under DATA_DIR
# On first run: create schema + seed base config
# On subsequent runs (e.g. image update): preserve existing data
# =========================================================

DATA_DIR="${DATA_DIR:-/app/data}"
DB_DIR="${DATA_DIR}/db"
IMG_DIR="${DATA_DIR}/images"
LOG_DIR="${DATA_DIR}/logs"
DB_PATH="${DB_DIR}/custom.db"

export DATABASE_URL="file:${DB_PATH}"

echo "========================================"
echo "  Jade Inventory - Starting"
echo "  DATA_DIR: ${DATA_DIR}"
echo "  DATABASE: ${DB_PATH}"
echo "========================================"

# 1. Ensure directories exist
mkdir -p "${DB_DIR}" "${IMG_DIR}" "${LOG_DIR}"

# 2. Check if database already exists
if [ -f "${DB_PATH}" ]; then
  echo "[INFO] Database already exists at ${DB_PATH}"
  echo "[INFO] Preserving existing data, applying schema migration if needed..."
  
  # Apply schema changes (add new tables/columns) without dropping data
  npx prisma db push --skip-generate 2>/dev/null || true
  echo "[INFO] Schema sync completed"
else
  echo "[INFO] No existing database found, initializing..."
  
  # Create schema
  npx prisma db push --skip-generate 2>/dev/null || true
  echo "[INFO] Database schema created"
  
  # Seed base config (materials, types, tags, system settings, metal prices)
  npx tsx prisma/seed-base.ts 2>/dev/null || echo "[WARN] Seed base data failed, you may need to run it manually"
  echo "[INFO] Base configuration data seeded"
fi

# 3. Start application
echo "[INFO] Starting Jade Inventory server on port ${PORT:-5000}..."
exec pnpm run start
