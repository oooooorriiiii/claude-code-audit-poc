#!/usr/bin/env bash
# 統合ウォークスルー動画を生成する。
#   ① CLI 実行(実機の対話モードを録画)→ ② 結果1 メトリクス → ③ 結果2 ログ → ④ 結果3 トレース
#   各章で「CLI操作 ⇄ テレメトリ」の対応を日本語で明示。
# 画面の文言は demo/record-results.mjs 冒頭の CAPS で編集できる。
# 出力: demo/walkthrough.mp4
set -uo pipefail
cd "$(dirname "$0")/.."
export LD_LIBRARY_PATH="$(brew --prefix 2>/dev/null)/lib:${LD_LIBRARY_PATH:-}"
export PII_EMAIL="${PII_EMAIL:-yuu.mori06@gmail.com}"
TERM_BG="0x282a36"

echo "==> stack ready 確認"
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null)" = "200" ] \
   && [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8889/metrics 2>/dev/null)" = "200" ]; do sleep 2; done

rm -rf demo/_cli; mkdir -p demo/_cli

echo "==> ① CLI 実行を録画(実機の対話モード・実 Claude Code / 入力→処理→完了の全工程)"
vhs demo/demo-cli.tape
[ -s demo/_cli/cli.mp4 ] || { echo "ERROR: cli.mp4 生成失敗"; exit 1; }
# メール表示は許容するため、クロップ/トリミングは行わず全編をそのまま使う。

echo "==> メトリクス反映待ち(scrape, 22s)"; sleep 22

echo "==> ②③④ 結果チャプターを録画(Grafana + 日本語キャプション)"
node demo/record-results.mjs
RES=$(ls -t demo/_cli/*.webm 2>/dev/null | head -1)
[ -s "$RES" ] || { echo "ERROR: results.webm 生成失敗"; exit 1; }

echo "==> 連結: [① CLI タイトル] + [CLI 実機(全工程)] + [結果1/2/3]"
ffmpeg -y -loop 1 -t 3 -i demo/_cli/card-cli.png -i demo/_cli/cli.mp4 -i "$RES" \
  -filter_complex "[0:v]scale=1280:720,fps=15,setsar=1,format=yuv420p[a];\
[1:v]scale=1280:720,fps=15,setsar=1,format=yuv420p[b];\
[2:v]scale=1280:720,fps=15,setsar=1,format=yuv420p[c];\
[a][b][c]concat=n=3:v=1:a=0[v]" -map "[v]" -c:v libx264 -crf 23 -movflags +faststart demo/walkthrough.mp4

if [ -s demo/walkthrough.mp4 ]; then rm -rf demo/_cli; else echo "ERROR: 連結失敗(中間ファイルは demo/_cli に保持)"; exit 1; fi
rm -f report.txt 2>/dev/null
echo "==> 完了:"; ls -la demo/walkthrough.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 demo/walkthrough.mp4 2>/dev/null
