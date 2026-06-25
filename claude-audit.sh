#!/usr/bin/env bash
# Run Claude Code with audit telemetry enabled FOR THIS INVOCATION ONLY.
#
# 推奨方式: env 変数はこの claude プロセスにだけ渡り、あなたのシェルには
# 一切残りません。claude を終了すれば設定はゼロに戻ります(=PoC検証時のみ)。
#
#   ./claude-audit.sh             # 通常の `claude` と同じ
#   ./claude-audit.sh --resume    # claude への引数はそのまま渡る
#
# 通常運用(テレメトリ無し)で使いたいときは、ただ `claude` を実行するだけ。

exec env \
  CLAUDE_CODE_ENABLE_TELEMETRY=1 \
  OTEL_METRICS_EXPORTER=otlp \
  OTEL_LOGS_EXPORTER=otlp \
  OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
  OTEL_LOG_USER_PROMPTS=1 \
  OTEL_METRIC_EXPORT_INTERVAL=10000 \
  OTEL_LOGS_EXPORT_INTERVAL=2000 \
  claude "$@"
