# VHS tape — Claude Code 監査 PoC 端末デモ (約90秒)
# 生成: vhs demo/demo.tape  ->  demo/demo.gif + demo/demo.mp4
# 前提: docker compose up -d 済み + demo/seed.sh 実行済み (データ投入済み)

Output demo/demo.gif
Output demo/demo.mp4

Set Shell "bash"
Set FontSize 18
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set Padding 16
Set TypingSpeed 35ms

Type "# Claude Code の利用ログをローカルで監査する PoC"
Enter
Sleep 1500ms

# --- 1. スタック稼働 ---
Type "docker compose ps --format '{{.Name}}\t{{.Status}}'"
Enter
Sleep 2500ms

# --- 2. 有効化フラグ (山場の伏線) ---
Type "sed -n '14,30p' claude-audit-full.sh"
Enter
Sleep 3500ms

# --- 3. フル監査モードで実行 (軽量プロンプト) ---
Type "./claude-audit-full.sh -p 'What is 17 * 23? Answer with the number only.' --permission-mode acceptEdits"
Enter
Sleep 12s

# --- 4〜7. 監査で取れる中身 ---
Type "demo/inspect.sh prompt"
Enter
Sleep 3s
Type "demo/inspect.sh output"
Enter
Sleep 3500ms
Type "demo/inspect.sh toolinput"
Enter
Sleep 3500ms
Type "demo/inspect.sh trace"
Enter
Sleep 4s

Type "# => 入力・出力・tool引数・トレースまで全部ローカルに残る"
Enter
Sleep 3s
