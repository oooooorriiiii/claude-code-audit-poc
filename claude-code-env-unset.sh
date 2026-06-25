#!/usr/bin/env bash
# `source ./claude-code-env.sh` を使った後、同じシェルでテレメトリを止めたいとき:
#
#     source ./claude-code-env-unset.sh
#
# これで現在のシェルから OTel 関連 env 変数が消え、以降の `claude` は
# テレメトリを送信しなくなります。

unset CLAUDE_CODE_ENABLE_TELEMETRY \
      OTEL_METRICS_EXPORTER \
      OTEL_LOGS_EXPORTER \
      OTEL_EXPORTER_OTLP_PROTOCOL \
      OTEL_EXPORTER_OTLP_ENDPOINT \
      OTEL_LOG_USER_PROMPTS \
      OTEL_METRIC_EXPORT_INTERVAL \
      OTEL_LOGS_EXPORT_INTERVAL

echo "Claude Code telemetry env vars を unset しました (このシェルでは送信停止)"
