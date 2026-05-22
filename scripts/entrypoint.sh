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

# 0. Generate Prisma Client（每次启动必须，确保与当前 schema 一致）
echo "[INFO] Generating Prisma Client..."
npx prisma generate 2>&1 || {
  echo "[ERROR] Prisma Client generation failed!"
  exit 1
}
echo "[INFO] Prisma CLI: $(npx prisma -v 2>/dev/null | awk -F': ' '/Prisma CLI Version/{print $2}' || echo unknown)"

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
    ${RUN_AS} npx prisma db push --accept-data-loss 2>&1 || {
      echo "[ERROR] Schema sync failed!"
      echo "[ERROR] Check Prisma schema and database permissions."
      exit 1
    }
  else
    npx prisma db push --accept-data-loss 2>&1 || {
      echo "[ERROR] Schema sync failed!"
      echo "[ERROR] Check Prisma schema and database permissions."
      exit 1
    }
  fi
  echo "[INFO] Schema sync completed"

  # Re-apply base seed to fix any schema-driven data issues (e.g. new columns, role assignments)
  # seed-base.ts uses upsert — safe to run repeatedly on existing databases
  echo "[INFO] Re-applying base seed to fix data integrity..."
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} npx tsx prisma/seed-base.ts 2>&1 || echo "[WARN] Seed re-apply had issues, continuing..."
  else
    npx tsx prisma/seed-base.ts 2>&1 || echo "[WARN] Seed re-apply had issues, continuing..."
  fi
else
  echo "[INFO] No existing database found, initializing..."
  
  # Create schema
  echo "[INFO] Creating database schema..."
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} npx prisma db push --accept-data-loss 2>&1 || {
      echo "[ERROR] Failed to create database schema. Check Prisma schema and permissions."
      exit 1
    }
  else
    npx prisma db push --accept-data-loss 2>&1 || {
      echo "[ERROR] Failed to create database schema. Check Prisma schema and permissions."
      exit 1
    }
  fi
  echo "[INFO] Database schema created"
  
  # Seed base config (materials, types, tags, system settings, metal prices)
  echo "[INFO] Seeding base configuration data..."
  if [ -n "${RUN_AS}" ]; then
    ${RUN_AS} npx tsx prisma/seed-base.ts 2>&1 || {
      echo "[ERROR] Seed base data failed!"
      echo "[ERROR] The application may not work correctly without base data."
      echo "[ERROR] You can try running manually: npx tsx prisma/seed-base.ts"
    }
  else
    npx tsx prisma/seed-base.ts 2>&1 || {
      echo "[ERROR] Seed base data failed!"
      echo "[ERROR] The application may not work correctly without base data."
      echo "[ERROR] You can try running manually: npx tsx prisma/seed-base.ts"
    }
  fi
fi

# 4. Verify base data exists
MATERIAL_COUNT=$(echo "SELECT COUNT(*) FROM DictMaterial;" | sqlite3 "${DB_PATH}" 2>/dev/null || echo "0")
echo "[INFO] DictMaterial count: ${MATERIAL_COUNT}"
if [ "${MATERIAL_COUNT}" = "0" ]; then
  echo "[WARN] No material data found! Attempting to re-seed..."
  npx tsx prisma/seed-base.ts 2>&1 || echo "[WARN] Re-seed also failed"
fi

# 5. Start application
echo "[INFO] Starting Jade Inventory server on port ${PORT:-5000}..."
if [ -n "${RUN_AS}" ]; then
  exec ${RUN_AS} npx next start -p ${PORT:-5000}
else
  exec npx next start -p ${PORT:-5000}
fi
