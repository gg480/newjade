#!/bin/sh
# ============================================================
# Jade ERP - NAS 数据库备份脚本
# 用法：sh nas-backup.sh
# 建议：NAS 定时任务每日执行（cron: 0 3 * * *）
# ============================================================
set -e

CONTAINER_NAME="${CONTAINER_NAME:-jade-inventory}"
DB_CONTAINER_PATH="${DB_CONTAINER_PATH:-/app/data/db/custom.db}"
NAS_BACKUP_DIR="${NAS_BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${NAS_BACKUP_DIR}/custom_${TIMESTAMP}.db"

mkdir -p "${NAS_BACKUP_DIR}"

echo "[$(date)] === Jade ERP 数据库备份 ==="

# 检查容器是否运行
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
  echo "[WARN] 容器 ${CONTAINER_NAME} 未运行，使用宿主机直接备份"
  if [ -f "./data/db/custom.db" ]; then
    sqlite3 "./data/db/custom.db" ".backup '${BACKUP_FILE}'" 2>/dev/null || {
      echo "[WARN] .backup 失败，改用 cp（可能不一致）"
      cp "./data/db/custom.db" "${BACKUP_FILE}"
    }
  else
    echo "[ERROR] 找不到数据库文件"
    exit 1
  fi
else
  echo "[INFO] 容器运行中，使用 sqlite3 .backup 在线备份"
  docker exec "${CONTAINER_NAME}" sqlite3 "${DB_CONTAINER_PATH}" ".backup '/tmp/backup.db'" 2>/dev/null && {
    docker cp "${CONTAINER_NAME}:/tmp/backup.db" "${BACKUP_FILE}"
    docker exec "${CONTAINER_NAME}" rm -f /tmp/backup.db
  } || {
    echo "[WARN] .backup 失败，改用停服备份"
    docker compose stop "${CONTAINER_NAME}" 2>/dev/null || docker stop "${CONTAINER_NAME}"
    if [ -f "./data/db/custom.db" ]; then
      cp "./data/db/custom.db" "${BACKUP_FILE}"
    else
      docker cp "${CONTAINER_NAME}:${DB_CONTAINER_PATH}" "${BACKUP_FILE}"
    fi
    docker compose start "${CONTAINER_NAME}" 2>/dev/null || docker start "${CONTAINER_NAME}"
  }
fi

# 压缩备份
gzip -f "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"
echo "[INFO] 备份完成: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# 验证备份完整性
echo "[INFO] 验证备份..."
gunzip -c "${BACKUP_FILE}" > /tmp/jade_verify.db 2>/dev/null
if sqlite3 /tmp/jade_verify.db "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
  echo "[OK] 备份完整性验证通过"
  rm -f /tmp/jade_verify.db
else
  echo "[FAIL] 备份文件损坏！"
  rm -f /tmp/jade_verify.db
  exit 1
fi

# 清理过期备份
echo "[INFO] 清理 ${RETENTION_DAYS} 天前的备份..."
find "${NAS_BACKUP_DIR}" -name "custom_*.db.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

BACKUP_COUNT=$(ls -1 "${NAS_BACKUP_DIR}"/custom_*.db.gz 2>/dev/null | wc -l)
echo "[INFO] 当前备份数量: ${BACKUP_COUNT}"
echo "[$(date)] === 备份完成 ==="
