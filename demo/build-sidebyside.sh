#!/usr/bin/env bash
# 案A: 端末(VHS)と Grafana(Playwright)を「同じ時間帯」で同時録画し、
# ffmpeg で左右に連結した1本の動画を生成する。
#   左 = CLI で Claude Code を実行 / 右 = Grafana ダッシュボードが自動更新
# 出力: demo/side-by-side.mp4 / demo/side-by-side.gif
set -uo pipefail
cd "$(dirname "$0")/.."
export LD_LIBRARY_PATH="$(brew --prefix 2>/dev/null)/lib:${LD_LIBRARY_PATH:-}"
export PII_EMAIL="${PII_EMAIL:-yuu.mori06@gmail.com}"

echo "==> stack ready 確認"
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null)" = "200" ] \
   && [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8889/metrics 2>/dev/null)" = "200" ]; do sleep 2; done

rm -rf demo/_side; mkdir -p demo/_side

echo "==> 事前ウォームアップ(ダッシュボードに数値を出すための先行実行)"
# Collector の prometheus exporter は一定時間更新が無いとメトリクスを露出しなくなるため、
# 録画直前に1回実行してダッシュボードへ値を出しておく(録画中の実行で増分が見える)。
timeout 90 ./claude-audit-full.sh -p "Warm-up: what is 2+2? answer with the number only." --permission-mode acceptEdits >/dev/null 2>&1 || true
echo "   スクレイプ反映待ち(25s)"; sleep 25

echo "==> Grafana 録画を開始(バックグラウンド)"
DURATION_MS=66000 node demo/record-grafana-live.mjs &
GPID=$!
sleep 2   # 録画ウォームアップ後に端末側を開始(ほぼ同時刻)

echo "==> 端末録画(VHS) + 実 Claude Code 実行"
vhs demo/demo-side.tape

echo "==> Grafana 録画の終了待ち"
wait "$GPID"

GRAF=$(ls -t demo/_side/*.webm 2>/dev/null | head -1)
TERM=demo/_side/term.mp4
if [ ! -s "$TERM" ] || [ -z "${GRAF:-}" ]; then echo "ERROR: 録画ファイル不足 (term=$TERM graf=$GRAF)"; exit 1; fi
echo "  term=$TERM  graf=$GRAF"

echo "==> ffmpeg で左右連結"
ffmpeg -y -i "$TERM" -i "$GRAF" -filter_complex \
  "[0:v]fps=15,scale=-2:720,setsar=1,pad=iw+24:ih:0:0:color=white[l];\
   [1:v]fps=15,scale=-2:720,setsar=1[r];\
   [l][r]hstack=inputs=2,format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -crf 23 -movflags +faststart demo/side-by-side.mp4 2>/dev/null && echo "  mp4 OK"

ffmpeg -y -i demo/side-by-side.mp4 -vf "fps=10,scale=1280:-1:flags=lanczos" demo/side-by-side.gif 2>/dev/null && echo "  gif OK"

rm -rf demo/_side
echo "==> 完了:"; ls -la demo/side-by-side.mp4 demo/side-by-side.gif 2>/dev/null
