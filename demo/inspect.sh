#!/usr/bin/env bash
# デモ用: 投入済みテレメトリから「監査で取れる中身」を整形表示する。
# VHS の録画から呼ぶ。各サブコマンドが1つの見せ場に対応。
#
#   demo/inspect.sh prompt     # ユーザ入力本文
#   demo/inspect.sh output     # Claude の出力本文 (api_response_body)
#   demo/inspect.sh toolinput  # tool 入力引数 (tool_result.tool_input)
#   demo/inspect.sh trace      # Tempo のトレース階層
set -euo pipefail
cd "$(dirname "$0")/.."
LOGS=data/otel-file/logs.json
C_TITLE='\033[1;36m'; C_OFF='\033[0m'

case "${1:-}" in
  prompt)
    echo -e "${C_TITLE}# ① ユーザ入力本文  (OTEL_LOG_USER_PROMPTS)${C_OFF}"
    jq -r '.resourceLogs[].scopeLogs[].logRecords[]
      | select(.body.stringValue=="claude_code.user_prompt")
      | (.attributes[]|select(.key=="prompt")|.value.stringValue)' "$LOGS" \
      | tail -2 | sed 's/^/  > /'
    ;;
  output)
    echo -e "${C_TITLE}# ② Claude の出力本文  (OTEL_LOG_RAW_API_BODIES)${C_OFF}"
    jq -r '.resourceLogs[].scopeLogs[].logRecords[]
      | select(.body.stringValue=="claude_code.api_response_body")
      | (.attributes[]|select(.key=="body")|.value.stringValue)' "$LOGS" \
      | jq -r 'try (.content[]?|select(.type=="text")|.text) catch empty' \
      | grep -vE '^\s*$|^\{' | tail -2 | fold -s -w 76 | sed 's/^/  /'
    ;;
  toolinput)
    echo -e "${C_TITLE}# ③ tool 入力引数  (OTEL_LOG_TOOL_DETAILS)${C_OFF}"
    jq -r '.resourceLogs[].scopeLogs[].logRecords[]
      | select(.body.stringValue=="claude_code.tool_result")
      | (.attributes[]|select(.key=="tool_input")|.value.stringValue)' "$LOGS" \
      | grep . | tail -3 | sed 's/^/  /'
    ;;
  trace)
    echo -e "${C_TITLE}# ④ 分散トレース階層  (CLAUDE_CODE_ENHANCED_TELEMETRY_BETA -> Tempo)${C_OFF}"
    TID=$(curl -s -G "http://localhost:3200/api/search" --data-urlencode 'q={}' \
            --data-urlencode "limit=1" | jq -r '.traces[0].traceID')
    curl -s "http://localhost:3200/api/traces/$TID" \
      | jq -r '.batches[].scopeSpans[].spans[]
          | [(.startTimeUnixNano),
             (if (.parentSpanId//"")=="" then "ROOT" else "CHILD" end),
             .name,
             (((.endTimeUnixNano|tonumber)-(.startTimeUnixNano|tonumber))/1e6|floor)] | @tsv' \
      | sort | awk -F'\t' '{
          n=$3;
          if ($2=="ROOT") ind="";
          else if (n ~ /\.tool\./) ind="      └ ";
          else ind="  └ ";
          print "  " ind n "  (" $4 "ms)"
        }'
    ;;
  *) echo "usage: inspect.sh {prompt|output|toolinput|trace}" >&2; exit 1 ;;
esac
