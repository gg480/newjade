#!/bin/sh
# ============================================================
# Jade ERP - NAS 安全更新部署脚本
# 用法：sh nas-update.sh [--no-backup]
# 流程：备份DB → 记录版本 → pull → down → up → 健康检查 → 成功/回滚
# ============================================================
set -e

CONTAINER_NAME="${CONTAINER_NAME:-jade-inventory}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5000/api/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
NO_BACKUP=false

for arg in "$@"; do
  case "$arg" in
    --no-backup) NO_BACKUP=true ;;
    -h|--help)
      echo "用法: sh nas-update.sh [--no-backup]"
      echo "  --no-backup  跳过数据库备份（不推荐）"
      exit 0
      ;;
  esac
done

echo "============================================"
echo "  Jade ERP - 安全更新部署"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ==== Step 1: 备份当前版本号 ====
echo ""
echo "=== [1/5] 记录当前版本 ==="
if [ -f ".env" ]; then
  OLD_VERSION=$(grep JADE_VERSION .env 2>/dev/null | cut -d= -f2 || echo "latest")
  echo "  当前版本: ${OLD_VERSION}"
  cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
else
  echo "  未找到 .env 文件，将使用 latest"
  OLD_VERSION="latest"
fi

# ==== Step 2: 备份数据库 ====
if [ "$NO_BACKUP" = false ]; then
  echo ""
  echo "=== [2/5] 备份数据库 ==="
  if [ -f "scripts/nas-backup.sh" ]; then
    sh scripts/nas-backup.sh
  else
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="./backups"
    mkdir -p "${BACKUP_DIR}"

    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
      echo "  使用 sqlite3 .backup 在线备份..."
      docker exec "${CONTAINER_NAME}" sqlite3 /app/data/db/custom.db ".backup '/tmp/jade_preupdate.db'" 2>/dev/null || {
        echo "  .backup 失败，改用停服备份..."
        docker compose stop "${CONTAINER_NAME}" 2>/dev/null || docker stop "${CONTAINER_NAME}"
        docker cp "${CONTAINER_NAME}:/app/data/db/custom.db" "${BACKUP_DIR}/custom_preupdate_${TIMESTAMP}.db"
        docker compose start "${CONTAINER_NAME}" 2>/dev/null || docker start "${CONTAINER_NAME}"
      }
      docker cp "${CONTAINER_NAME}:/tmp/jade_preupdate.db" "${BACKUP_DIR}/custom_preupdate_${TIMESTAMP}.db" 2>/dev/null && {
        docker exec "${CONTAINER_NAME}" rm -f /tmp/jade_preupdate.db
      }
    else
      echo "  容器未运行，直接备份数据库文件..."
      if [ -f "./data/db/custom.db" ]; then
        cp "./data/db/custom.db" "${BACKUP_DIR}/custom_preupdate_${TIMESTAMP}.db"
      fi
    fi
    echo "  备份保存至: ${BACKUP_DIR}/custom_preupdate_${TIMESTAMP}.db"
  fi
else
  echo ""
  echo "=== [2/5] 跳过备份（--no-backup） ==="
fi

# ==== Step 3: 拉取新镜像 ====
echo ""
echo "=== [3/5] 拉取新镜像 ==="
docker compose pull 2>/dev/null || {
  echo "  docker compose pull 失败，尝试 docker pull..."
  IMAGE=$(grep "image:" docker-compose.yml 2>/dev/null | head -1 | awk '{print $2}' | sed 's/\${JADE_VERSION:-latest}/latest/g')
  if [ -n "${IMAGE}" ]; then
    docker pull "${IMAGE}"
  else
    echo "[ERROR] 无法确定镜像地址"
    exit 1
  fi
}

# ==== Step 4: 停止旧容器并启动新版本 ====
echo ""
echo "=== [4/5] 切换版本 ==="
docker compose down 2>/dev/null || true
docker compose up -d

# ==== Step 5: 健康检查 ====
echo ""
echo "=== [5/5] 健康检查 (最多 ${HEALTH_RETRIES}x${HEALTH_INTERVAL}s = $((HEALTH_RETRIES * HEALTH_INTERVAL))s) ==="
SUCCESS=false
for i in $(seq 1 ${HEALTH_RETRIES}); do
  printf "  [%2d/${HEALTH_RETRIES}] " "${i}"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${HEALTH_URL}" 2>/dev/null || echo "000")
  echo "HTTP ${HTTP_CODE}"

  if [ "${HTTP_CODE}" = "200" ]; then
    echo "  [OK] 健康检查通过！部署成功。"
    SUCCESS=true
    break
  fi

  CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "missing")
  if [ "${CONTAINER_STATUS}" = "exited" ] || [ "${CONTAINER_STATUS}" = "dead" ]; then
    echo "  [WARN] 容器状态: ${CONTAINER_STATUS}，继续等待..."
  fi

  sleep "${HEALTH_INTERVAL}"
done

# ==== 结果处理 ====
if [ "${SUCCESS}" = true ]; then
  echo ""
  echo "============================================"
  echo "  部署成功！"
  echo "  新版本: $(grep JADE_VERSION .env 2>/dev/null | cut -d= -f2 || echo latest)"
  echo "============================================"
  exit 0
fi

# ==== 自动回滚 ====
echo ""
echo "============================================"
echo "  [FAIL] 健康检查未通过，执行自动回滚..."
echo "============================================"

docker compose down 2>/dev/null || true

# 恢复旧版本号
LATEST_BACKUP=$(ls -1t .env.backup.* 2>/dev/null | head -1)
if [ -n "${LATEST_BACKUP}" ]; then
  echo "  恢复版本配置: ${LATEST_BACKUP}"
  cp "${LATEST_BACKUP}" .env
fi

docker compose up -d

echo ""
echo "  等待回滚版本启动..."
sleep 10

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${HEALTH_URL}" 2>/dev/null || echo "000")
if [ "${HTTP_CODE}" = "200" ]; then
  echo "  [OK] 回滚成功，服务已恢复。"
else
  echo "  [ERROR] 回滚后服务仍异常！HTTP ${HTTP_CODE}"
  echo "  请手动检查: docker compose logs --tail=50"
  exit 2
fi
