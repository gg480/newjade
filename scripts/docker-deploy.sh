#!/bin/bash
set -e

# ============================================================
# Jade ERP - Docker 部署脚本（极空间 NAS）
# 自动完成：环境检查 → 目录准备 → 停止旧容器 → 启动 → 健康检查
# ============================================================

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

CONTAINER_NAME="jade-erp"
SERVICE_PORT="5000"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Jade ERP - Docker 部署${NC}"
echo -e "${GREEN}========================================${NC}"

# ---- Step 1: 检查 Docker 环境 ----
echo ""
echo -e "${YELLOW}[Step 1/5] 检查 Docker 环境...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}[ERROR] 未检测到 Docker，请先安装 Docker${NC}"
  echo "  极空间 NAS: 在应用中心安装 Docker 应用"
  exit 1
fi

DOCKER_VERSION=$(docker --version 2>/dev/null | head -1)
echo -e "${GREEN}  [OK] ${DOCKER_VERSION}${NC}"

if ! docker compose version &> /dev/null; then
  echo -e "${RED}[ERROR] Docker Compose 不可用（需要 Docker 20.10+）${NC}"
  exit 1
fi

COMPOSE_VERSION=$(docker compose version 2>/dev/null | head -1)
echo -e "${GREEN}  [OK] ${COMPOSE_VERSION}${NC}"

# ---- Step 2: 定位项目目录 ----
echo ""
echo -e "${YELLOW}[Step 2/5] 定位项目目录...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f "Dockerfile" ] || [ ! -f "docker-compose.yml" ]; then
  echo -e "${RED}[ERROR] 未找到 Dockerfile 或 docker-compose.yml${NC}"
  echo "  请确认当前目录是项目根目录: $(pwd)"
  exit 1
fi

echo -e "${GREEN}  [OK] 项目目录: ${PROJECT_DIR}${NC}"

# ---- Step 3: 创建数据库目录 ----
echo ""
echo -e "${YELLOW}[Step 3/5] 准备数据库持久化目录...${NC}"

DB_DIR="${PROJECT_DIR}/db"
if [ ! -d "$DB_DIR" ]; then
  mkdir -p "$DB_DIR"
  echo -e "${GREEN}  [OK] 已创建 db/ 目录: ${DB_DIR}${NC}"
else
  echo -e "${GREEN}  [OK] db/ 目录已存在${NC}"
fi

# ---- Step 4: 停止旧容器并启动新容器 ----
echo ""
echo -e "${YELLOW}[Step 4/5] 部署容器...${NC}"

# 停止并移除旧容器（如果存在）
if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
  echo "  正在停止旧容器: ${CONTAINER_NAME}..."
  docker compose down --remove-orphans 2>/dev/null || true
  echo -e "${GREEN}  [OK] 旧容器已停止${NC}"
else
  echo "  未检测到运行中的旧容器"
fi

# 启动容器（后台运行）
echo "  正在启动容器..."
docker compose up -d

echo -e "${GREEN}  [OK] 容器已启动${NC}"

# ---- Step 5: 健康检查 ----
echo ""
echo -e "${YELLOW}[Step 5/5] 健康检查...${NC}"
echo "  等待服务就绪（最多等待 90 秒）..."

HEALTHY=false
MAX_WAIT=90
WAITED=0
INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
  sleep $INTERVAL
  WAITED=$((WAITED + INTERVAL))

  # 检查容器是否在运行
  CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "not_found")
  
  if [ "$CONTAINER_STATUS" != "running" ]; then
    echo -e "${RED}  [ERROR] 容器未正常运行，状态: ${CONTAINER_STATUS}${NC}"
    echo ""
    echo "查看日志: docker logs ${CONTAINER_NAME}"
    exit 1
  fi

  # 尝试访问健康检查端点
  HEALTH_RESPONSE=$(docker exec "${CONTAINER_NAME}" node -e "
    fetch('http://127.0.0.1:${SERVICE_PORT}/api/health')
      .then(r => r.ok ? 'OK' : 'FAIL:' + r.status)
      .catch(e => 'ERR:' + e.message)
  " 2>/dev/null || echo "N/A")

  if [ "$HEALTH_RESPONSE" = "OK" ]; then
    HEALTHY=true
    break
  fi

  echo "  ...等待中 (${WAITED}s/${MAX_WAIT}s) 状态: ${HEALTH_RESPONSE}"
done

if [ "$HEALTHY" = false ]; then
  echo -e "${RED}  [ERROR] 健康检查超时（${MAX_WAIT}秒），请手动检查${NC}"
  echo ""
  echo "查看日志: docker logs ${CONTAINER_NAME}"
  echo "查看状态: docker ps -a"
  exit 1
fi

# ---- 部署完成 ----
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  访问地址:  ${GREEN}http://<NAS-IP>:${SERVICE_PORT}${NC}"
echo -e "  容器名称:  ${CONTAINER_NAME}"
echo -e "  数据库:    ${DB_DIR}/custom.db"
echo ""
echo "常用命令:"
echo "  查看日志:  docker logs -f ${CONTAINER_NAME}"
echo "  停止服务:  docker compose down"
echo "  重启服务:  docker compose restart"
echo "  进入容器:  docker exec -it ${CONTAINER_NAME} sh"
