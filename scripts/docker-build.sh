#!/bin/bash
set -e

# ============================================================
# Jade ERP - Docker 镜像构建脚本
# 自动检测 CPU 架构，构建对应平台镜像
# 标签格式：jade-erp:YYYYMMDD
# ============================================================

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Jade ERP - Docker 镜像构建${NC}"
echo -e "${GREEN}========================================${NC}"

# 1. 检测 CPU 架构
ARCH=$(uname -m)
case "$ARCH" in
  x86_64|amd64)
    DOCKER_PLATFORM="linux/amd64"
    ARCH_NAME="x86_64"
    ;;
  aarch64|arm64)
    DOCKER_PLATFORM="linux/arm64"
    ARCH_NAME="ARM64"
    ;;
  armv7l)
    DOCKER_PLATFORM="linux/arm/v7"
    ARCH_NAME="ARMv7"
    ;;
  *)
    echo -e "${RED}[ERROR] 不支持的 CPU 架构: $ARCH${NC}"
    exit 1
    ;;
esac

echo -e "${YELLOW}[INFO] 检测到 CPU 架构: $ARCH_NAME ($DOCKER_PLATFORM)${NC}"

# 2. 生成日期标签
DATE_TAG=$(date +%Y%m%d)
IMAGE_NAME="jade-erp"
FULL_TAG="${IMAGE_NAME}:${DATE_TAG}"
LATEST_TAG="${IMAGE_NAME}:latest"

echo -e "${YELLOW}[INFO] 镜像标签: ${FULL_TAG}${NC}"

# 3. 检查项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f "Dockerfile" ]; then
  echo -e "${RED}[ERROR] 未找到 Dockerfile，请确认在项目根目录执行${NC}"
  exit 1
fi

# 4. 构建镜像
echo -e "${YELLOW}[INFO] 开始构建镜像 (平台: ${DOCKER_PLATFORM})...${NC}"
echo -e "${YELLOW}[INFO] 预计耗时 3-8 分钟，请耐心等待...${NC}"

docker buildx build \
  --platform "${DOCKER_PLATFORM}" \
  --tag "${FULL_TAG}" \
  --tag "${LATEST_TAG}" \
  --load \
  .

BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo -e "${RED}[ERROR] 镜像构建失败 (exit code: ${BUILD_EXIT})${NC}"
  exit $BUILD_EXIT
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  构建完成！${NC}"
echo -e "${GREEN}  镜像: ${FULL_TAG}${NC}"
echo -e "${GREEN}  镜像: ${LATEST_TAG}${NC}"
echo -e "${GREEN}  平台: ${ARCH_NAME}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "查看镜像:  docker images jade-erp"
echo "部署运行:  bash scripts/docker-deploy.sh"
