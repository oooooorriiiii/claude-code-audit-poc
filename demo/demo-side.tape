# VHS tape — 並列動画の「左ペイン(端末)」用
# 生成: vhs demo/demo-side.tape -> demo/_side/term.mp4
# Grafana 録画(demo/record-grafana-live.mjs)と同時に走らせ、ffmpeg で左右連結する。
Output demo/_side/term.mp4
Output demo/_side/term.gif

Set Shell "bash"
Set FontSize 20
Set Width 900
Set Height 760
Set Theme "Dracula"
Set Padding 14
Set TypingSpeed 38ms

Type "# 左: CLI で Claude Code を実行  →  右: Grafana が更新される"
Enter
Sleep 2s
Type "./claude-audit-full.sh -p 'Create poc.txt containing audit, read it back, then tell me one fun fact about otters.' --permission-mode acceptEdits"
Enter
Sleep 42s
Type "# 完了。右の Grafana にトークン/コスト/イベントが反映される"
Enter
Sleep 8s
