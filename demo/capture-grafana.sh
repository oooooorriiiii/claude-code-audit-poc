#!/usr/bin/env bash
# Grafana の /render API (image-renderer) でダッシュボードのパネルを PNG 化し、
# presentation/img/ に保存する。スライドに静止画として差し込む用途。
#
#   bash demo/capture-grafana.sh
#
# 前提: docker compose up -d 済み (renderer サービス含む)。
set -euo pipefail
cd "$(dirname "$0")/.."

G="http://admin:admin@localhost:3001"
UID_DASH="claude-code-audit"
OUT="presentation/img"
mkdir -p "$OUT"
FROM="now-3h"; TO="now"

# renderer の起動を待つ
echo "==> [capture] renderer 起動待ち"
for i in $(seq 1 30); do
  if curl -s "$G/api/health" >/dev/null 2>&1; then break; fi
  sleep 2
done

# panelId -> 出力名 (grafana/dashboards/claude-code-audit.json と対応)
declare -A PANELS=(
  [1]="stat-tokens"
  [2]="stat-cost"
  [3]="stat-sessions"
  [5]="ts-token-rate"
  [6]="ts-cost-rate"
  [7]="logs-events"
)

ok=0
render_panel() {
  local id="$1" name="$2" w="$3" h="$4"
  local url="$G/render/d-solo/$UID_DASH/$UID_DASH?orgId=1&panelId=$id&width=$w&height=$h&from=$FROM&to=$TO&theme=light"
  if curl -sf "$url" -o "$OUT/panel-$name.png" && [ -s "$OUT/panel-$name.png" ]; then
    echo "  OK  panel $id -> $OUT/panel-$name.png ($(wc -c <"$OUT/panel-$name.png") bytes)"
    ok=$((ok+1))
  else
    echo "  NG  panel $id ($name) のレンダリング失敗" >&2
  fi
}

echo "==> [capture] パネルを PNG 化"
render_panel 1 stat-tokens   500 260
render_panel 2 stat-cost     500 260
render_panel 3 stat-sessions 500 260
render_panel 5 ts-token-rate 900 380
render_panel 6 ts-cost-rate  900 380
render_panel 7 logs-events   1200 520

# ダッシュボード全体も1枚
if curl -sf "$G/render/d/$UID_DASH/$UID_DASH?orgId=1&width=1400&height=900&from=$FROM&to=$TO&theme=light&kiosk" \
     -o "$OUT/dashboard-full.png" && [ -s "$OUT/dashboard-full.png" ]; then
  echo "  OK  dashboard 全体 -> $OUT/dashboard-full.png"
  ok=$((ok+1))
fi

echo "==> [capture] 完了 ($ok 枚生成)"
[ "$ok" -gt 0 ] || { echo "WARN: PNG が1枚も生成できませんでした (renderer 未起動?)" >&2; exit 1; }
