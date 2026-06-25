#!/usr/bin/env bash
# フル監査モード: 公式ドキュメントに記載の "取得できる最大限" を有効化して
# Claude Code を起動する (この実行のみ・シェルに残さない)。
#
#   ./claude-audit-full.sh -p "..."        # 非対話
#   ./claude-audit-full.sh                 # 対話
#
# デフォルト(privacy)で隠れている以下を全て有効化:
#   - OTEL_LOG_USER_PROMPTS=1   : ユーザ入力本文
#   - OTEL_LOG_TOOL_DETAILS=1   : tool 入力引数 (bash command, file path, MCP名 ...)
#   - OTEL_LOG_TOOL_CONTENT=1   : tool 入出力コンテンツ (trace 必須, 60KB切詰)
#   - OTEL_LOG_RAW_API_BODIES=1 : Messages API の request/response 全文
#                                 (= Claude 出力本文・会話履歴。60KB切詰)
#   - traces(beta)              : interaction/llm_request/tool スパンを Tempo へ
#
# ※ これらは機微情報を大量に含む。検証用途でのみ使用すること。

exec env \
  CLAUDE_CODE_ENABLE_TELEMETRY=1 \
  CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1 \
  OTEL_METRICS_EXPORTER=otlp \
  OTEL_LOGS_EXPORTER=otlp \
  OTEL_TRACES_EXPORTER=otlp \
  OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
  OTEL_LOG_USER_PROMPTS=1 \
  OTEL_LOG_TOOL_DETAILS=1 \
  OTEL_LOG_TOOL_CONTENT=1 \
  OTEL_LOG_RAW_API_BODIES=1 \
  OTEL_METRIC_EXPORT_INTERVAL=10000 \
  OTEL_LOGS_EXPORT_INTERVAL=2000 \
  OTEL_TRACES_EXPORT_INTERVAL=2000 \
  claude "$@"
