# Grafana 画面ガイド — 各 GUI が何を示すか（詳細解説）

> OTel/Grafana 未経験でも、ログ基盤の運用保守経験があれば読める粒度で解説します。
> 対応する動画: `demo/gui-demo.mp4`（字幕付きウォークスルー）。
> Grafana URL: http://localhost:3001 （匿名 Admin 有効）

---

## 0. 前提: Grafana の2つの入り口

| 機能 | 用途 | このデモでの使いどころ |
|------|------|----------------------|
| **Dashboards** | 決まったパネルを常設表示。定点観測・サマリ向き | 利用量の全体像（トークン/コスト/件数） |
| **Explore** | データソースに対してその場でクエリ。調査・ドリルダウン向き | ログ1件の中身確認、トレースの追跡 |

データソースは3つ登録済み: **Prometheus**(メトリクス) / **Loki**(ログ) / **Tempo**(トレース)。

---

## 1. ダッシュボード「Claude Code Audit」

`Dashboards → Claude Code Audit`。上から3段:

### 上段: スタットパネル（大きな数字）
- **Total tokens** … 累計トークン数。`claude_code_token_usage_tokens_total` の合計。
- **Total cost (USD)** … 推定コスト。`claude_code_cost_usage_USD_total` の合計。
  - ⚠️ **API 公開単価 × トークンで算出した“推定値”**。Pro/Max など定額プランでは**実際には課金されない**。利用ボリュームの目安。
- **Sessions** … セッション数。`claude_code_session_count_total`。
- **Lines of code changed** … Claude が追加/削除したコード行数。

> 数字の下にうっすら出る線は「スパークライン」(その値の時間推移の縮小グラフ)。

### 中段: 時系列グラフ
- **Token usage rate by type** … トークン消費レートを種別(input / output / cacheRead / cacheCreation)で色分け。
  - cacheRead が多い = プロンプトキャッシュが効いている、等が読める。
- **Cost rate by model (USD/s)** … モデル別(opus / haiku …)のコスト発生レート。どのモデルが効いているか。

### 下段: ログパネル
- **Claude Code events (Loki)** … `{service_name="claude-code"}` の生イベントを新しい順に表示。
  - `user_prompt` / `api_request` / `api_response_body` / `tool_result` / `tool_decision` などが流れる。

### 操作ポイント
- **右上の時間範囲(例: Last 3 hours)** … ここを変えると全パネルがその期間で再集計。監査対象期間を絞る基本操作。
- **Refresh(30s)** … 自動更新間隔。

---

## 2. Explore → Loki（ログ/イベントの中身）

`Explore` で データソース **Loki**、クエリ `{service_name="claude-code"}` を実行。

### 画面の見方
- **Logs volume(上部のヒストグラム)** … 時間帯ごとのイベント件数。スパイク = その時刻に多くの操作。
- **ログ行(下部)** … 1行 = 1イベント。左にタイムスタンプ、本文にイベント名(例 `claude_code.user_prompt`)。

### 行を開くと（重要）
ログ行をクリックすると属性(フィールド)が展開される:
- **共通**: `session.id` / `user.id` / `user.email` / `organization.id` / `terminal.type` / `event.timestamp`
- **user_prompt**: `prompt_length`、フル監査時は **`prompt`(入力本文そのもの)**
- **tool_result**: `tool_name` / `success` / `duration_ms`、フル監査時は **`tool_input`(bash コマンド等)**
- **api_response_body**(フル監査時): **`body` = Claude の応答 JSON(出力本文)**

→ 「**誰が・どのセッションで・何を入力し・どのツールをどう実行したか**」を1イベント単位で追える。

### よく使う絞り込み(LogQL)
```logql
{service_name="claude-code"} | event_name="tool_result"      # ツール実行だけ
{service_name="claude-code"} | event_name="user_prompt"      # 入力だけ
{service_name="claude-code"} |= "Bash"                        # 文字列マッチ
```

---

## 3. Explore → Tempo（トレース = 処理の流れ）

`Explore` で データソース **Tempo**。トレース ID を指定 or 検索すると、1プロンプトの処理が**1本のトレース**として表示。

### 画面の見方（ウォーターフォール）
- **左: スパンツリー** … 呼び出しの親子関係。
  - `claude_code.interaction`(ユーザの1ターン=ルート)
    - `claude_code.llm_request`(Claude API 呼び出し。複数回あり得る)
    - `claude_code.tool`(ツール実行)
      - `claude_code.tool.blocked_on_user`(**権限承認の待ち時間**)
      - `claude_code.tool.execution`(**ツール本体の実行時間**)
- **右: 帯(バー)** … 各スパンの開始位置と長さ。**バーの長さ = 所要時間**。

### ここで分かること
- 1ターンの**総所要時間**と、その内訳(API 待ち vs ツール実行 vs 権限待ち)。
- どのツール/どの API 呼び出しが**ボトルネック**か。
- スパンを開くと属性(`model` / `stop_reason` / `tokens` など)も確認可能。

---

## 4. 相関ジャンプ（トレース ⇄ ログ）

データソース設定で相互リンク済み:
- **Loki → Tempo**: ログの `trace_id` フィールドから、該当トレースへワンクリック(derived field)。
- **Tempo → Loki**: トレース画面から、その時間帯の関連ログへ(tracesToLogs)。

→ 監査の典型フロー: **ダッシュボードで異常な数字に気づく → Loki で該当イベントを見る → trace_id でトレースを開き処理全体を確認**、を画面遷移だけで一気通貫。

---

## 再生成

```bash
# Grafana 静止画(スライド用 PNG)
bash demo/capture-grafana.sh
# GUI ウォークスルー動画(字幕付き)
LD_LIBRARY_PATH=$(brew --prefix)/lib node demo/gui-demo.mjs   # -> demo/_video/*.webm
#   webm を mp4/gif へ変換するのは demo/build.sh が実施
```
