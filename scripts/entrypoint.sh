#!/bin/sh

# =========================================================
# Jade Inventory - Docker Entrypoint
# =========================================================
# Supports PUID/PGID for NAS permission compatibility
# - PUID/PGID=0 (default): run as root, no permission issues
# - PUID/PGID=1000: run as user uid=1000
# All persistent data (db, images, logs) stored under DATA_DIR
# On first run: create schema + seed base config
# On subsequent runs (e.g. image update): preserve existing data
# =========================================================

DATA_DIR="${DATA_DIR:-/app/data}"
DB_DIR="${DATA_DIR}/db"
IMG_DIR="${DATA_DIR}/images"
LOG_DIR="${DATA_DIR}/logs"
DB_PATH="${DB_DIR}/custom.db"
PUID="${PUID:-0}"
PGID="${PGID:-0}"

export DATABASE_URL="file:${DB_PATH}"

echo "========================================"
echo "  Jade Inventory - Starting"
echo "  DATA_DIR: ${DATA_DIR}"
echo "  DATABASE: ${DB_PATH}"
echo "  PUID: ${PUID}  PGID: ${PGID}"
echo "========================================"

# 1. Ensure directories exist (with permission fix)
mkdir -p "${DB_DIR}" "${IMG_DIR}" "${LOG_DIR}" 2>/dev/null || {
  echo "[WARN] Cannot create subdirs in ${DATA_DIR}, trying to fix permissions..."
  # If running as root, chown the data directory
  if [ "$(id -u)" = "0" ]; then
    chown -R "${PUID}:${PGID}" "${DATA_DIR}" 2>/dev/null
    mkdir -p "${DB_DIR}" "${IMG_DIR}" "${LOG_DIR}" || {
      echo "[ERROR] Failed to create directories even after chown. Check volume permissions."
      echo "[ERROR] Try: PUID=0 PGID=0 or chmod 777 your data directory on NAS"
    }
  fi
}

# 2. Handle user switching for PUID/PGID
RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  # Running as root — ensure data dir ownership matches PUID/PGID
  chown -R "${PUID}:${PGID}" "${DATA_DIR}" 2>/dev/null || true

  if [ "${PUID}" != "0" ]; then
    # Create or update runtime user with the specified PUID/PGID
    if id appuser 2>/dev/null; then
      deluser appuser 2>/dev/null || true
    fi
    addgroup -g "${PGID}" appgroup 2>/dev/null || true
    adduser -D -u "${PUID}" -G appgroup appuser 2>/dev/null || true
    RUN_AS="su-exec appuser"
    echo "[INFO] Switching to appuser (uid=${PUID}, gid=${PGID})"
  else
    echo "[INFO] Running as root (PUID=0)"
  fi
fi

# 3. Check if database already exists
if [ -f "${DB_PATH}" ]; then
  echo "[INFO] Database already exists at ${DB_PATH}"
  echo "[INFO] Preserving existing data, applying schema migration if needed..."
  
  # Apply schema changes (add new tables/columns) without dropping data
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} npx prisma db push --skip-generate 2>/dev/null || true
  else
    npx prisma db push --skip-generate 2>/dev/null || true
  fi
  echo "[INFO] Schema sync completed"
else
  echo "[INFO] No existing database found, initializing..."
  
  # Create schema
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} npx prisma db push --skip-generate 2>/dev/null || true
  else
    npx prisma db push --skip-generate 2>/dev/null || true
  fi
  echo "[INFO] Database schema created"
  
  # Seed base config (materials, types, tags, system settings, metal prices)
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} npx tsx prisma/seed-base.ts 2>/dev/null || echo "[WARN] Seed base data failed, you may need to run it manually"
  else
    npx tsx prisma/seed-base.ts 2>/dev/null || echo "[WARN] Seed base data failed, you may need to run it manually"
  fi
  echo "[INFO] Base configuration data seeded"
fi

# 4. Start application
echo "[INFO] Starting Jade Inventory server on port ${PORT:-5000}..."
if [ -n "${RUN_AS}" ]; then
  exec ${RUN_AS} pnpm run start
else
  exec pnpm run start
fi
