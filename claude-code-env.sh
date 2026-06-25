#!/usr/bin/env bash
# Source this on the HOST before launching Claude Code so it ships telemetry
# to the local OTel Collector running in Docker:
#
#     source ./claude-code-env.sh
#     claude
#
# Telemetry is independent of the Pro/Max/Team plan — it works on Pro.

# Master switch.
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# Export both metrics and logs/events over OTLP.
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp

# --- Transport -----------------------------------------------------------
# gRPC (default below). The collector listens on 4317.
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# HTTP alternative — comment the two lines above and uncomment these:
# export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
# export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# --- Audit richness ------------------------------------------------------
# Include the actual user prompt text in the user_prompt event.
# OFF by default for privacy; required to audit *what users typed*.
export OTEL_LOG_USER_PROMPTS=1

# --- PoC: export frequently so data shows up fast (defaults are 60s/5s) ---
export OTEL_METRIC_EXPORT_INTERVAL=10000   # 10s
export OTEL_LOGS_EXPORT_INTERVAL=2000      # 2s

echo "Claude Code telemetry -> ${OTEL_EXPORTER_OTLP_ENDPOINT} (${OTEL_EXPORTER_OTLP_PROTOCOL})"
