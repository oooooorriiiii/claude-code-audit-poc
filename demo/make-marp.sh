#!/usr/bin/env bash
# Marp スライド(presentation/slides.md)から PDF と HTML を生成する。
#   出力: presentation/slides.pdf / presentation/slides.html
# slides.md を編集して本スクリプトを実行すれば再生成できる。
set -euo pipefail
cd "$(dirname "$0")/.."

# Marp(Chromium)が要求する共有ライブラリと、動作確認済みの Chromium を指定
export LD_LIBRARY_PATH="$(brew --prefix 2>/dev/null)/lib:${LD_LIBRARY_PATH:-}"
CHROME="$(find "$HOME/.cache/ms-playwright"/chromium-*/chrome-linux64 -name chrome 2>/dev/null | sort | tail -1)"
[ -n "$CHROME" ] && export CHROME_PATH="$CHROME"
echo "CHROME_PATH=${CHROME_PATH:-(marp 既定)}"

cd presentation   # .marprc.yml(html:true / allowLocalFiles:true)を読ませる
echo "==> PDF 生成"
npx -y @marp-team/marp-cli@latest slides.md --pdf -o slides.pdf
echo "==> HTML 生成"
npx -y @marp-team/marp-cli@latest slides.md -o slides.html

command -v pdfinfo >/dev/null && pdfinfo slides.pdf | grep -E "Pages|Page size" || true
echo "==> 完了: presentation/slides.pdf, presentation/slides.html"
