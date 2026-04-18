#!/bin/sh

# =========================================================
# Jade Inventory - Docker Entrypoint
# =========================================================
# Supports PUID/PGID for NAS permission compatibility
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
  if [ "$(id -u)" = "0" ]; then
    chown -R "${PUID}:${PGID}" "${DATA_DIR}" 2>/dev/null
    mkdir -p "${DB_DIR}" "${IMG_DIR}" "${LOG_DIR}" || {
      echo "[ERROR] Failed to create directories even after chown."
      echo "[ERROR] Try: PUID=0 PGID=0 or chmod 777 your data directory on NAS"
    }
  fi
}

# 2. Handle user switching for PUID/PGID
RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  chown -R "${PUID}:${PGID}" "${DATA_DIR}" 2>/dev/null || true

  if [ "${PUID}" != "0" ]; then
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
  
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} prisma db push --skip-generate 2>&1 || echo "[WARN] Schema migration had issues, continuing..."
  else
    prisma db push --skip-generate 2>&1 || echo "[WARN] Schema migration had issues, continuing..."
  fi
  echo "[INFO] Schema sync completed"
else
  echo "[INFO] No existing database found, initializing..."
  
  # Create schema
  echo "[INFO] Creating database schema..."
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} prisma db push --skip-generate 2>&1 || {
      echo "[ERROR] Failed to create database schema. Check Prisma schema and permissions."
      exit 1
    }
  else
    prisma db push --skip-generate 2>&1 || {
      echo "[ERROR] Failed to create database schema. Check Prisma schema and permissions."
      exit 1
    }
  fi
  echo "[INFO] Database schema created"
  
  # Seed base config (materials, types, tags, system settings, metal prices)
  echo "[INFO] Seeding base configuration data..."
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} node prisma/seed-base.js 2>&1 || {
      echo "[ERROR] Seed base data failed!"
      echo "[ERROR] The application may not work correctly without base data."
      echo "[ERROR] You can try running manually: node prisma/seed-base.js"
    }
  else
    node prisma/seed-base.js 2>&1 || {
      echo "[ERROR] Seed base data failed!"
      echo "[ERROR] The application may not work correctly without base data."
      echo "[ERROR] You can try running manually: node prisma/seed-base.js"
    }
  fi
fi

# 4. Verify base data exists
MATERIAL_COUNT=$(echo "SELECT COUNT(*) FROM DictMaterial;" | sqlite3 "${DB_PATH}" 2>/dev/null || echo "0")
echo "[INFO] DictMaterial count: ${MATERIAL_COUNT}"
if [ "${MATERIAL_COUNT}" = "0" ]; then
  echo "[WARN] No material data found! Attempting to re-seed..."
  node prisma/seed-base.js 2>&1 || echo "[WARN] Re-seed also failed"
fi

# 5. Start application (standalone mode)
echo "[INFO] Starting Jade Inventory server on port ${PORT:-5000}..."
if [ -n "${RUN_AS}" ]; then
  exec ${RUN_AS} node server.js
else
  exec node server.js
fi
