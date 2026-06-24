#!/bin/bash
# =============================================================================
# jade-topic-writeback.sh — OpenClaw → ERP 选题批量回写脚本
# 版本：v2.0 | 日期：2026-06-23
# 用途：将 Phase 2 LLM 聚合输出的选题 JSON 写入 ERP
# 依赖：JADE_ERP_BASE_URL, JADE_ERP_API_KEY 环境变量
# 部署位置：/root/.openclaw/workspace/jade-topic-writeback.sh
# =============================================================================
set -euo pipefail

# === 配置 ===
PHASE2_FILE="${1:-/tmp/phase2.json}"
LOG_DIR="/root/.openclaw/workspace/jade-xhs-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# === 环境变量检查 ===
: "${JADE_ERP_BASE_URL:?必须设置 JADE_ERP_BASE_URL}"
: "${JADE_ERP_API_KEY:?必须设置 JADE_ERP_API_KEY}"

# === Step 1: 输入存在性检查 ===
if [ ! -f "$PHASE2_FILE" ]; then
    log "[ERROR] Phase 2 输出文件不存在: $PHASE2_FILE"
    exit 1
fi

# === Step 2: 6 项机器验证 ===
log "[INFO] ====== 开始 6 项格式验证 ======"

VALIDATION_RESULT=$(python3 -c "
import json, sys
data = json.load(open('$PHASE2_FILE'))
assert isinstance(data, list), '不是 JSON 数组'
for i, t in enumerate(data):
    meta = t.get('aiMetadata', {})
    assert meta.get('version', '').startswith('2.'), f'#{i}: version 非 v2 (got: {meta.get(\"version\")})'
    sc = meta.get('scoring', {})
    assert 0 <= sc.get('externalDemand', -1) <= 1, f'#{i}: demand 溢出 (got: {sc.get(\"externalDemand\")})'
    assert 0 <= sc.get('externalTrend', -1) <= 1, f'#{i}: trend 溢出 (got: {sc.get(\"externalTrend\")})'
    assert 3 <= len(sc.get('autoKeywords', [])) <= 8, f'#{i}: 关键词数量不符 (got: {len(sc.get(\"autoKeywords\", []))})'
    assert sc.get('externalDemand', 0) >= 0.3, f'#{i}: demand<0.3 (got: {sc.get(\"externalDemand\")})'
    assert 10 <= len(sc.get('reasoning', '')) <= 200, f'#{i}: reasoning 长度不符 (got: {len(sc.get(\"reasoning\", \"\"))})'
    signals = meta.get('signals', {})
    assert len(signals) >= 1, f'#{i}: 无 signals'
print(f'OK: {len(data)} 条选题全部通过 6 项验证')
" 2>&1) || true

echo "$VALIDATION_RESULT" | tee -a "$LOG_FILE"

if ! echo "$VALIDATION_RESULT" | grep -q '^OK:'; then
    log "[ERROR] 验证失败，不提交 ERP。详情: $VALIDATION_RESULT"
    exit 2
fi

# === Step 3: 逐条回写 ===
WRITE_BACK_LOG="$LOG_DIR/$(date +%Y-%m-%d)-writeback.jsonl"
: > "$WRITE_BACK_LOG"

CREATED=0
SKIPPED=0
FAILED=0
TOTAL=$(jq -c '.[]' "$PHASE2_FILE" | wc -l)

log "[INFO] ====== 开始回写 $TOTAL 条选题到 ERP ======"

jq -c '.[]' "$PHASE2_FILE" | while read -r topic; do
    title=$(echo "$topic" | jq -r '.title // "untitled"')
    log "[INFO] → 回写: $title"

    # 等幂检查：按 title 去重
    ENCODED_TITLE=$(echo "$title" | jq -sRr @uri)
    EXISTING=$(curl -s \
        "${JADE_ERP_BASE_URL}/api/promotion/topics?keyword=${ENCODED_TITLE}&limit=1" \
        -H "Authorization: Bearer ${JADE_ERP_API_KEY}" | \
        jq -r '.data.items[0].id // ""')

    if [ -n "$EXISTING" ]; then
        log "[SKIP] 选题已存在 (id=$EXISTING)"
        echo "{\"action\":\"skip\",\"title\":\"$title\",\"id\":\"$EXISTING\",\"reason\":\"duplicate\"}" >> "$WRITE_BACK_LOG"
        continue
    fi

    # POST 回写
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST "${JADE_ERP_BASE_URL}/api/promotion/topics" \
        -H "Authorization: Bearer ${JADE_ERP_API_KEY}" \
        -H "Content-Type: application/json" \
        -H "x-user-id: openclaw-agent" \
        -d "$topic")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        ID=$(echo "$BODY" | jq -r '.data.id // "unknown"')
        log "[OK]   回写成功 (id=$ID, http=$HTTP_CODE)"
        echo "{\"action\":\"created\",\"title\":\"$title\",\"id\":\"$ID\",\"http\":$HTTP_CODE}" >> "$WRITE_BACK_LOG"
    elif [ "$HTTP_CODE" -eq 409 ]; then
        log "[SKIP] 冲突 (title已存在)"
        echo "{\"action\":\"conflict\",\"title\":\"$title\",\"http\":409}" >> "$WRITE_BACK_LOG"
    else
        log "[FAIL] 回写失败 (http=$HTTP_CODE): ${BODY:0:200}"
        echo "{\"action\":\"failed\",\"title\":\"$title\",\"http\":$HTTP_CODE,\"body\":\"${BODY:0:200}\"}" >> "$WRITE_BACK_LOG"
    fi

    sleep 1
done

# === Step 4: 汇总报告 ===
CREATED=$(grep -c '"created"' "$WRITE_BACK_LOG" 2>/dev/null || echo 0)
SKIPPED=$(grep -c '"skip"\|"conflict"' "$WRITE_BACK_LOG" 2>/dev/null || echo 0)
FAILED=$(grep -c '"failed"' "$WRITE_BACK_LOG" 2>/dev/null || echo 0)

log ""
log "====== 回写完成 ======"
log "总计=$TOTAL  成功=$CREATED  跳过=$SKIPPED  失败=$FAILED"
log "日志文件: $LOG_FILE"
log "回写明细: $WRITE_BACK_LOG"
log "====================="
