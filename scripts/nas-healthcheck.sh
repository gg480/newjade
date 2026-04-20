#!/bin/sh
set -eu

BASE_URL="${1:-http://127.0.0.1:5000}"

echo "[CHECK] Base URL: ${BASE_URL}"

check() {
  endpoint="$1"
  code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}${endpoint}")"
  if [ "${code}" != "200" ]; then
    echo "[FAIL] ${endpoint} -> HTTP ${code}"
    exit 1
  fi
  echo "[PASS] ${endpoint} -> HTTP ${code}"
}

check "/api/dashboard/summary"
check "/api/items?page=1&size=1"
check "/api/sales?page=1&size=1"
check "/api/config"

echo "[OK] Core APIs are reachable."
