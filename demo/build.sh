#!/usr/bin/env bash
# 発表用成果物を一括生成する再現エントリポイント。
#
#   bash demo/build.sh
#
# 生成物:
#   demo/demo.gif / demo/demo.mp4          (端末デモ動画 / VHS)
#   demo/gui-demo.mp4 / .gif / .webm       (Grafana GUI ウォークスルー / Playwright・字幕付き)
#   presentation/img/architecture.png|svg  (Mermaid アーキ図)
#   presentation/img/*.png                 (Grafana パネル静止画)
set -uo pipefail
cd "$(dirname "$0")/.."

BREW_LIB="$(brew --prefix 2>/dev/null)/lib"
export LD_LIBRARY_PATH="${BREW_LIB}:${LD_LIBRARY_PATH:-}"   # chromium が要求する nss/nspr/alsa

step() { echo; echo "============================================================"; echo "==> $*"; echo "============================================================"; }

# --- 0. 依存ツール ---
step "0. 依存ツール確認 / 導入"
if command -v brew >/dev/null 2>&1; then
  need=()
  for t in vhs ffmpeg ttyd; do command -v "$t" >/dev/null 2>&1 || need+=("$t"); done
  [ "${#need[@]}" -gt 0 ] && { echo "brew install ${need[*]}"; brew install "${need[@]}" || echo "WARN: brew install 失敗"; }
  # chromium 実行に必要な共有ライブラリ (sudo 不要で brew から供給)
  brew list nss      >/dev/null 2>&1 || brew install nss
  brew list nspr     >/dev/null 2>&1 || brew install nspr
  brew list alsa-lib >/dev/null 2>&1 || brew install alsa-lib
else
  echo "WARN: brew なし。vhs/ffmpeg/ttyd と libnss3/libnspr4/libasound2 を手動導入してください。"
fi
# Node 依存 (Playwright)
[ -d node_modules/playwright ] || npm i playwright@1.61.1 || echo "WARN: npm i 失敗"
npx playwright install chromium >/dev/null 2>&1 || echo "WARN: chromium 取得失敗"

# --- 1. stack ---
step "1. docker compose up -d (renderer 含む)"
docker compose up -d
echo "ready 待ち..."
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8889/metrics 2>/dev/null)" = "200" ] \
   && [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/ready 2>/dev/null)" = "200" ] \
   && [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null)" = "200" ]; do
  sleep 3
done
echo "stack ready"

# --- 2. seed ---
step "2. デモデータ投入 (demo/seed.sh)"
bash demo/seed.sh || echo "WARN: seed 一部失敗 (既存データで継続)"

# --- 3. Mermaid アーキ図 ---
step "3. Mermaid アーキ図 (architecture.png/svg)"
CH=$(find "$HOME/.cache/ms-playwright"/chromium-*/ -type f -name chrome 2>/dev/null | head -1)
if [ -n "$CH" ]; then
  printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }\n' "$CH" > /tmp/pptr.json
  npx -y @mermaid-js/mermaid-cli -p /tmp/pptr.json -i presentation/architecture.mmd -o presentation/img/architecture.svg -b transparent || echo "WARN: svg 失敗"
  npx -y @mermaid-js/mermaid-cli -p /tmp/pptr.json -i presentation/architecture.mmd -o presentation/img/architecture.png -b transparent -w 1600 || echo "WARN: png 失敗"
else
  echo "SKIP: chromium 未取得のため Mermaid をスキップ"
fi

# --- 4. Grafana パネル PNG ---
step "4. Grafana パネル PNG (demo/capture-grafana.sh)"
bash demo/capture-grafana.sh || echo "WARN: PNG 取得失敗 (renderer 確認)"

# --- 5. 端末デモ録画 (VHS) ---
step "5. 端末デモ録画 (vhs demo/demo.tape)"
if command -v vhs >/dev/null 2>&1; then
  vhs demo/demo.tape && echo "OK" || echo "WARN: vhs 失敗"
else
  echo "SKIP: vhs 未導入。導入後 'vhs demo/demo.tape' で生成可能。"
fi

# --- 6. Grafana GUI ウォークスルー録画 (Playwright) ---
step "6. GUI ウォークスルー録画 (demo/gui-demo.mjs)"
if [ -d node_modules/playwright ]; then
  rm -rf demo/_video; mkdir -p demo/_video
  if node demo/gui-demo.mjs; then
    W=$(ls -t demo/_video/*.webm 2>/dev/null | head -1)
    if [ -n "$W" ]; then
      cp "$W" demo/gui-demo.webm
      ffmpeg -y -i "$W" -vf "scale=1280:-2,format=yuv420p" -c:v libx264 -crf 24 -movflags +faststart demo/gui-demo.mp4 2>/dev/null && echo "OK mp4"
      ffmpeg -y -i "$W" -vf "fps=10,scale=960:-1:flags=lanczos" demo/gui-demo.gif 2>/dev/null && echo "OK gif"
    fi
  else
    echo "WARN: gui-demo.mjs 失敗"
  fi
else
  echo "SKIP: playwright 未導入のため GUI 録画スキップ。"
fi

# --- 7. サマリ ---
step "7. 生成物"
ls -la demo/demo.gif demo/demo.mp4 demo/gui-demo.mp4 demo/gui-demo.gif 2>/dev/null
ls -la presentation/img/*.png 2>/dev/null | tail -10
echo
echo "スライド: presentation/index.html をブラウザで開く (S キーで台本)"
echo "GUI 解説: presentation/gui-guide.md"
