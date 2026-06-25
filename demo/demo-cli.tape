# 統合ウォークスルーの「CLI 実行」チャプター(実機の対話モードを録画)
# 生成: vhs demo/demo-cli.tape -> demo/_cli/cli.mp4
# 上部の welcome バナー(メール等)は後段の ffmpeg で切り取る。
Output demo/_cli/cli.mp4

Set Shell "bash"
Set FontFamily "Noto Sans Mono CJK JP"
Set FontSize 18
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set Padding 16

Hide
Type "cd ~/workspace/claude-code-audit-poc"
Enter
Show
Type "./claude-audit-full.sh --permission-mode acceptEdits --allowedTools Bash Read Write Edit"
Enter
Sleep 6s
Type "report.txt というファイルを作成して『audit ok』と書き込み、その内容を読み返し、最後に bash で echo build-done を実行してください。"
Enter
Sleep 36s
