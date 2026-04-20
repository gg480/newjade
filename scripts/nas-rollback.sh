#!/bin/sh
set -eu

if [ $# -lt 1 ]; then
  echo "Usage: sh scripts/nas-rollback.sh <image-tag>"
  echo "Example: sh scripts/nas-rollback.sh crpi-xxx/jadeerp/jadeerp:sha-abc123"
  exit 1
fi

IMAGE_TAG="$1"
ENV_FILE=".env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "[ERROR] .env not found. Copy .env.nas.example to .env first."
  exit 1
fi

if grep -q '^JADE_IMAGE=' "${ENV_FILE}"; then
  sed -i.bak "s|^JADE_IMAGE=.*|JADE_IMAGE=${IMAGE_TAG}|g" "${ENV_FILE}"
else
  printf "\nJADE_IMAGE=%s\n" "${IMAGE_TAG}" >> "${ENV_FILE}"
fi

echo "[INFO] JADE_IMAGE set to ${IMAGE_TAG}"
echo "[INFO] Restarting service..."
docker compose pull
docker compose up -d
docker compose ps

echo "[INFO] Rollback done. Run health check next:"
echo "  sh scripts/nas-healthcheck.sh http://127.0.0.1:5000"
