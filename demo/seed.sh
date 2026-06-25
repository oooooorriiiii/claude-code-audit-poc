#!/usr/bin/env bash
# デモ用データ投入: フル監査モードで Claude Code を数回実行し、
# user_prompt / api_request(_body) / api_response_body / tool_result(tool_input) /
# tool_decision / traces を各バックエンド (Prometheus/Loki/Tempo) と
# ファイル (data/otel-file/*.json) に投入する。
#
#   bash demo/seed.sh
#
# 前提: docker compose up -d 済み・ホストで claude にログイン済み (Pro)。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x ./claude-audit-full.sh ]; then
  echo "ERROR: claude-audit-full.sh が見つかりません" >&2; exit 1
fi

echo "==> [seed] フル監査モードで Claude Code を実行 (1/2: bash ツール)"
timeout 180 ./claude-audit-full.sh -p \
  "Run the bash command 'echo hello-from-demo', then give me a one-sentence fun fact about otters." \
  --permission-mode acceptEdits || echo "(1回目 タイムアウト/失敗。継続)"

echo "==> [seed] (2/2: 計算 QA)"
timeout 120 ./claude-audit-full.sh -p "What is 17 * 23? Answer with the number only." \
  --permission-mode acceptEdits || echo "(2回目 タイムアウト/失敗。継続)"

echo "==> [seed] エクスポートのフラッシュ待ち (12s)"
sleep 12

echo "==> [seed] 投入結果サマリ"
echo -n "  Loki events: "
curl -s -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query=sum(count_over_time({service_name="claude-code"}[1h]))' \
  --data-urlencode "start=$(($(date +%s)-3600))000000000" \
  | jq -r '.data.result[0].values[-1][1] // "0"' 2>/dev/null || echo "?"
echo -n "  tokens total: "
curl -s 'http://localhost:9090/api/v1/query?query=sum(claude_code_token_usage_tokens_total)' \
  | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "?"
echo "  files: $(ls -1 data/otel-file/*.json 2>/dev/null | tr '\n' ' ')"
echo "==> [seed] 完了"
