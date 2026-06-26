# Claude Code Audit PoC

ローカル Laptop 1 台で、Claude Code (Pro プラン) の利用ログを **Audit 目的**で収集・保存・可視化するための PoC 環境。

```
Host                          Docker (docker-compose)
┌──────────────┐  OTLP        ┌───────────────────────────────────────────┐
│ Claude Code  │  gRPC :4317  │  OTel Collector                           │
│ (Pro)        │ ───────────► │   ├─ metrics ─► Prometheus  (scrape :8889)│
│              │  HTTP :4318  │   ├─ logs    ─► Loki        (OTLP push)   │
└──────────────┘              │   ├─ traces  ─► Tempo       (OTLP)        │
                              │   ├─ all     ─► file (./data/otel-file)   │
                              │   └─ all     ─► debug (stdout)            │
                              │                                           │
                              │  Grafana :3000  ◄── Prometheus/Loki/Tempo │
                              └───────────────────────────────────────────┘
```

## 構成ファイル

| パス | 役割 |
|------|------|
| `docker-compose.yml` | 全サービス定義 |
| `otel/config.yaml` | Collector: receivers / processors / exporters / pipelines |
| `prometheus/prometheus.yml` | Collector の `:8889` をスクレイプ |
| `loki/config.yaml` | 単一バイナリ Loki、OTLP 取り込み、30日保持 |
| `tempo/config.yaml` | 単一バイナリ Tempo、OTLP 受信 |
| `grafana/provisioning/` | データソース + ダッシュボード自動登録 |
| `grafana/dashboards/claude-code-audit.json` | スターターダッシュボード |
| `claude-code-env.sh` | ホストで Claude Code に設定する環境変数 |
| `claude-audit.sh` / `claude-audit-full.sh` | 通常 / フル監査の実行ラッパー(env はそのプロセス限り) |
| `presentation/` | **スライド(Marp)**: `slides.md`(★編集元・文書型) → `slides.pdf` / `slides.html`(生成物)。`gui-guide.md`(GUI解説)。旧版 reveal.js: `index.html` / `index-lightning.html` / `script.md` |
| `demo/` | デモ自動化: `build.sh`(一括) / `make-marp.sh`(スライド生成) / `seed.sh` / `gui-demo.mjs` ほか |

## 発表 / デモ資料

スライドは **Marp(Markdown)** で記述。`presentation/slides.md` を編集して再生成する:

```bash
bash demo/make-marp.sh        # slides.md -> slides.pdf / slides.html を生成
# 発表: presentation/slides.pdf を開く(オフライン可・17ページ・16:9)
#       または presentation/slides.html(ブラウザ表示)
```

<!-- 旧 reveal.js 版も残置: presentation/index.html(文書型) / index-lightning.html(LT型) -->
バックエンド/動画の一括生成: `bash demo/build.sh`(ツール導入→stack→データ投入→Grafana PNG→動画)。
生成物(動画):
- **`demo/walkthrough.mp4`** — 統合デモ(主)。①実機の Claude Code CLI で実行(Write/Read/Bash が画面に出る)→②メトリクス→③ログ→④トレース。各章で「CLI操作⇄テレメトリ」の対応を日本語で明示。文言は `demo/record-results.mjs` 冒頭の `CAPS` で編集(`demo/build-walkthrough.sh`)
- `demo/side-by-side.mp4` `.gif` — 左=CLI / 右=Grafana を同一時系列で対比(`demo/build-sidebyside.sh`)
- `demo/gui-demo.mp4` `.gif` — Grafana GUI 詳細ウォークスルー(字幕付き)。字幕は `demo/gui-demo.mjs` 冒頭の `STEPS` で編集可
- `demo/demo.gif` `.mp4` — 端末のみの簡易デモ(VHS)

生成物(図):
- `presentation/img/architecture.png`(Mermaid)/ `trace-waterfall.png`(Tempo)/ `panel-*.png`(Grafana 静止画)

台本: `presentation/script.md`(5分ライトニング、GUI 詳説で伸長可) / GUI 各画面の解説: `presentation/gui-guide.md`。

## 使い方

### 1. バックエンドを起動

```bash
docker compose up -d
docker compose ps
```

URL:
- Grafana: http://localhost:3000 (匿名 Admin 有効 / admin/admin)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100
- Tempo: http://localhost:3200

### 2. Claude Code をテレメトリ付きで起動 (ホスト側)

**推奨 (検証時のみ・シェルに残さない):**

```bash
./claude-audit.sh        # この実行に限りテレメトリ ON。引数は claude に渡る
```

ラッパーは env 変数を claude プロセスにだけ渡すため、終了後はシェルに何も残りません。
通常運用に戻すときは、ただ `claude` を実行するだけ。

**別法 (シェルセッション全体で ON):**

```bash
source ./claude-code-env.sh      # 以降このシェルの claude はテレメトリ ON
claude
source ./claude-code-env-unset.sh   # 同じシェルで停止したいとき
```

何度かプロンプトを投げ、ツールを使わせる (ファイル編集・bash 実行など)。

> **テレメトリの ON/OFF について**
> 有効化は env 変数のみで行い、`~/.claude/settings.json` や shell rc には一切書き込みません。
> そのため **明示的に上記スクリプトを使った時だけ**送信され、新しいターミナル・再起動後・
> 通常の `claude` 実行では送信されません(=PoC 検証時以外は情報を取得しない)。

### 3. 確認

- **Grafana**: ダッシュボード "Claude Code Audit" (フォルダ: Claude Code Audit)
- **生ファイル**: `./data/otel-file/{metrics,logs,traces}.json`
- **Collector の生ログ**: `docker compose logs -f otel-collector` (debug exporter)

```bash
# 受信した logs/events を生で覗く
tail -f data/otel-file/logs.json | jq .
```

## Audit でどこまで取れるか

Claude Code が OTLP で出すのは **metrics** と **logs(events)** の 2 種類。

### Metrics (→ Prometheus)
Prometheus 上ではドットが `_` に、counter には `_total` が付く。

| OTLP メトリクス | Prometheus 名 | 主なラベル |
|------|------|------|
| `claude_code.session.count` | `claude_code_session_count_total` | session.id, user.id |
| `claude_code.token.usage` | `claude_code_token_usage_tokens_total` | **type** (input/output/cacheRead/cacheCreation), model |
| `claude_code.cost.usage` | `claude_code_cost_usage_USD_total` | model |
| `claude_code.lines_of_code.count` | `claude_code_lines_of_code_count_total` | type (added/removed) |
| `claude_code.commit.count` / `pull_request.count` | `..._total` | |
| `claude_code.code_edit_tool.decision` | `claude_code_code_edit_tool_decision_total` | decision (accept/reject), tool |
| `claude_code.active_time.total` | `claude_code_active_time_seconds_total` | |

> 上記は本 PoC で Claude Code v2.1.179 から実測した名前。バージョンで前後し得るので、
> 実際の名前は http://localhost:8889/metrics または Prometheus の `/targets` で確認のこと。
>
> **実測したメトリクスラベル(監査に有用)**: `model`, `type`(input/output/cacheRead/cacheCreation),
> `session_id`, `user_id`, `user_email`, `user_account_uuid`, `organization_id`,
> `terminal_type`, `service_version`, `query_source`, `os_type`, `host_arch` など。

### Logs / Events (→ Loki, ファイル)
監査の中身はほぼここに入る。各イベントに `session.id` / `user.id` /
`organization.id` / `user.account_uuid` / `app.version` / `terminal.type` 等の
リソース属性が付く。Loki では `service_name="claude-code"` で絞れる。

| イベント | 主な内容 | Audit 観点 |
|------|------|------|
| `claude_code.user_prompt` | prompt_length、(任意で) prompt 本文 | **ユーザ入力** |
| `claude_code.tool_result` | tool_name、success、duration_ms、decision | **tool call / result** |
| `claude_code.tool_decision` | 許可/拒否の判断 | 権限監査 |
| `claude_code.api_request` | model、input/output tokens、cost、duration、ttft | **token usage / API** |
| `claude_code.api_error` | error、status_code、model | **API error** |

**Loki でのイベント絞り込み** (属性は structured metadata 化される):
```logql
{service_name="claude-code"} | event_name="tool_result"
{service_name="claude-code"} | event_name="user_prompt"
```

**本 PoC での実測 (v2.1.179, 1セッション)** — 実際に届いたイベントと主な属性:
- `user_prompt`: `prompt`(本文/`OTEL_LOG_USER_PROMPTS=1`時), `prompt_length`, `prompt.id`
- `api_request`: `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cost_usd`, `duration_ms`
- `tool_result`: `tool_name`(例 Write/Read), `success`, `duration_ms`
- `tool_decision`: `tool_name`, `decision`(accept/reject), `source`(config/user 等)

全イベント共通: `session.id`, `user.id`, `user.email`, `user.account_uuid`,
`organization.id`, `terminal.type`, `event.timestamp`, `event.sequence`。

#### 取得できる / できない の整理 (公式ドキュメントで確認・実証済み)
出典: https://code.claude.com/docs/ja/monitoring-usage

**デフォルト(基本ラッパー `claude-audit.sh`)で取得:**
- ✅ tool call (どのツールを呼んだか)、tool result の成否・所要時間・サイズ
- ✅ token usage / cost / model / session / user / org / 権限決定 (tool_decision)
- ✅ API error / api_refusal / 各種イベント (auth, mcp接続, plugin, skill 等)

**追加フラグで取得できる (既定 OFF。`claude-audit-full.sh` で全部有効化):**
- ✅ **ユーザ入力本文** … `OTEL_LOG_USER_PROMPTS=1`
- ✅ **tool 入力引数** (bash command, file path, MCP名 等) … `OTEL_LOG_TOOL_DETAILS=1`
  → `tool_result`/`tool_decision` に `tool_input` / `tool_parameters` が付く
- ✅ **tool 入出力コンテンツ** … `OTEL_LOG_TOOL_CONTENT=1` (**traces 必須**, 60KB切詰)
  → `claude_code.tool` スパンの `tool.output` イベントに input/output
- ✅ **Claude の出力本文・会話履歴全体** … `OTEL_LOG_RAW_API_BODIES=1`(60KB切詰) または
  `=file:<dir>`(全文をディスク保存) → `api_request_body` / `api_response_body` イベント。
  response body の `content[].text` が assistant 出力そのもの。
  ※ 拡張思考(extended thinking)コンテンツのみマスクされる。
- ✅ **traces (ベータ)** … `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` + `OTEL_TRACES_EXPORTER=otlp`
  → Tempo にスパン到達。階層: `interaction` → `llm_request` / `tool`(→ `blocked_on_user` /
  `execution`) / `hook`。`llm_request` に `stop_reason`, `ttft_ms`, `request_id` 等。

> **本 PoC で v2.1.179 を使い実証**: `claude-audit-full.sh` で再実行し、
> Loki に `api_response_body`(Claude の回答文), `tool_result.tool_input`(bash引数),
> Tempo に `claude_code.interaction` トレース一式、`tool.output` の実出力 が
> すべて届くことを確認済み。**「テレメトリでは取れない」は誤りで、フラグ次第で取得可能。**
>
> 唯一の実質的注意点: extended thinking 本文のみ常にマスクされる。それ以外の
> 会話全文・ツール入出力は取得できる(機微情報を大量に含むため取扱い注意)。

## 停止 / 後片付け

```bash
docker compose down          # コンテナ停止 (データボリュームは保持)
docker compose down -v       # ボリュームも削除 (Prometheus/Loki/Tempo/Grafana を初期化)
```

生の監査ファイル `./data/otel-file/` はホストに残る。
