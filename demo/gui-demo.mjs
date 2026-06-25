// Grafana GUI ウォークスルー録画 (Playwright)
// 各画面に日本語の字幕オーバーレイを出して「何を見ているか」を解説しながら録画する。
// 出力: demo/gui-demo.webm (後段で mp4/gif に変換)
//
// 実行: LD_LIBRARY_PATH=$(brew --prefix)/lib node demo/gui-demo.mjs
//   (build.sh から呼ばれる。chromium が brew の nss/nspr/alsa を要求するため)
import { chromium } from 'playwright';
import fs from 'node:fs';

// chrome 子プロセスが共有ライブラリを見つけられるように
const BREW_LIB = '/home/linuxbrew/.linuxbrew/lib';
process.env.LD_LIBRARY_PATH = `${BREW_LIB}:${process.env.LD_LIBRARY_PATH || ''}`;

// 公開リポジトリ用: 画面に映る機密情報(メール/組織ID/アカウントUUID/user.id/session.id)を
// ログファイルから収集して、録画中の DOM 上でマスクする。
function gatherSecrets() {
  const lits = new Set();
  if (process.env.PII_EMAIL) lits.add(process.env.PII_EMAIL);
  try {
    const txt = fs.readFileSync('data/otel-file/logs.json', 'utf8');
    const keys = ['user.email','organization.id','user.account_uuid','user.account_id','user.id','session.id'];
    for (const m of txt.matchAll(/"key":"([^"]+)","value":\{"stringValue":"([^"]+)"\}/g)) {
      if (keys.includes(m[1]) && m[2].length >= 8) lits.add(m[2]);
    }
  } catch {}
  return [...lits];
}

const G = 'http://localhost:3001';
const LOKI_UID = 'P8E80F9AEF21F6940';
const VIEW = { width: 1440, height: 810 };
const OUT_DIR = 'demo/_video';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Tempo から最新トレース ID を取得
async function latestTraceId() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const r = await fetch(`http://localhost:3200/api/search?q=${encodeURIComponent('{}')}&limit=1&start=${now-10800}&end=${now}`);
    const j = await r.json();
    return j.traces?.[0]?.traceID || null;
  } catch { return null; }
}

// 画面下部に字幕(タイトル+本文+ステップ番号)を表示
async function caption(page, { step, total, title, body, sub }) {
  await page.evaluate(({ step, total, title, body, sub }) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cap';
      document.body.appendChild(el);
      el.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
        'background:linear-gradient(to top, rgba(10,12,20,0.97), rgba(10,12,20,0.86))',
        'color:#fff', 'padding:18px 28px', 'font-family:\"Noto Sans CJK JP\",\"Hiragino Sans\",sans-serif',
        'box-shadow:0 -6px 24px rgba(0,0,0,.5)', 'border-top:3px solid #4ec9b0',
      ].join(';');
    }
    el.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:6px">
        <span style="background:#4ec9b0;color:#0a0c14;font-weight:700;border-radius:12px;padding:2px 12px;font-size:20px">${step}/${total}</span>
        <span style="font-size:30px;font-weight:700;color:#9be8d8">${title}</span>
      </div>
      <div style="font-size:23px;line-height:1.5">${body}</div>
      ${sub ? `<div style="font-size:18px;color:#f6c177;margin-top:6px">▶ ${sub}</div>` : ''}`;
  }, { step, total, title, body, sub });
}

async function clearCaption(page) {
  await page.evaluate(() => document.getElementById('__cap')?.remove());
}

// 任意要素を黄色枠でハイライト
async function highlight(page, selector) {
  await page.evaluate((sel) => {
    const t = document.querySelector(sel); if (!t) return;
    const r = t.getBoundingClientRect();
    let h = document.getElementById('__hl') || document.createElement('div');
    h.id = '__hl'; document.body.appendChild(h);
    h.style.cssText = `position:fixed;z-index:2147483646;border:4px solid #f6c177;border-radius:8px;
      box-shadow:0 0 0 4000px rgba(0,0,0,0.0);pointer-events:none;
      left:${r.left-4}px;top:${r.top-4}px;width:${r.width+8}px;height:${r.height+8}px;transition:all .3s`;
  }, selector).catch(()=>{});
}
async function clearHighlight(page){ await page.evaluate(()=>document.getElementById('__hl')?.remove()).catch(()=>{}); }

const TOTAL = 6;

(async () => {
  const tid = await latestTraceId();
  console.log('trace id:', tid);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: OUT_DIR, size: VIEW },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // ===== PII マスク (公開用) =====
  // メール / UUID / 64hex(user.id) / user_xxx(account_id) と既知リテラルを
  // 全テキストノードで継続的にマスク(SPA 再描画にも追従)。
  const secrets = gatherSecrets();
  console.log('mask literals:', secrets.length);
  await page.addInitScript((lits) => {
    const reEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const reUuid  = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const reHex64 = /\b[0-9a-f]{64}\b/gi;
    const reAcct  = /user_[A-Za-z0-9]{16,}/g;
    const mask = (s) => s.replace(reEmail, '••••••@••••••')
                         .replace(reAcct, 'user_••••••')
                         .replace(reUuid, '••••••••-••••-••••-••••-••••••••••••')
                         .replace(reHex64, '••••••••');
    const run = () => {
      const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
      const ns = []; while (w.nextNode()) ns.push(w.currentNode);
      for (const n of ns) {
        let v = n.nodeValue; if (!v) continue;
        let nv = mask(v);
        for (const l of lits) { if (l && nv.includes(l)) nv = nv.split(l).join('••••••'); }
        if (nv !== v) n.nodeValue = nv;
      }
    };
    setInterval(run, 350);
    document.addEventListener('DOMContentLoaded', run);
  }, secrets);

  // ===== 0. タイトルカード =====
  await page.goto(`${G}/?orgId=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id='__title';
    d.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0a0c14;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif';
    d.innerHTML='<div style="font-size:52px;font-weight:800;color:#9be8d8">Grafana で見る Claude Code 監査</div><div style="font-size:26px;margin-top:18px;color:#ccc">ダッシュボード → ログ(Loki) → トレース(Tempo) を順に解説</div>';
    document.body.appendChild(d);
  });
  await sleep(3500);
  await page.evaluate(() => document.getElementById('__title')?.remove());

  // ===== 1. ダッシュボード全体 =====
  await page.goto(`${G}/d/claude-code-audit/claude-code-audit?orgId=1&from=now-3h&to=now&kiosk`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('text=Total tokens', { timeout: 20000 }); } catch {}
  await sleep(2500);
  await caption(page, { step:1, total:TOTAL, title:'ダッシュボード: 利用状況の全体像',
    body:'上段の大きな数字は「累計トークン数・推定コスト・セッション数・変更行数」。一目で“どれだけ使ったか”が分かります。',
    sub:'コストは API 単価換算の推定値(定額プランでは実課金されない利用量の目安)' });
  await sleep(7000);

  // 時系列パネルへ言及
  await caption(page, { step:1, total:TOTAL, title:'ダッシュボード: 時系列とイベント',
    body:'中段は「トークン種別ごとの推移」と「モデル別コスト推移」。下段はログ(イベント)の一覧です。',
    sub:'右上の時間範囲(Last 3 hours)を変えれば任意期間を集計できます' });
  await sleep(6500);
  await clearCaption(page);

  // ===== 2. Explore + Loki: イベント一覧 =====
  const lokiPane = encodeURIComponent(JSON.stringify({
    loki1: { datasource: LOKI_UID,
      queries: [{ refId:'A', datasource:{type:'loki',uid:LOKI_UID}, expr:'{service_name="claude-code"}', queryType:'range' }],
      range: { from:'now-3h', to:'now' } }
  }));
  await page.goto(`${G}/explore?orgId=1&schemaVersion=1&panes=${lokiPane}`, { waitUntil:'domcontentloaded' });
  await caption(page, { step:2, total:TOTAL, title:'ログ/イベント (Loki): 何が起きたか',
    body:'<code>{service_name="claude-code"}</code> で Claude Code のイベントを時系列表示。1行が1イベント(user_prompt / tool_result / api_request …)。',
    sub:'“いつ・どの種類のイベントが起きたか”の生ログがここに溜まります' });
  // ログが実際に描画されるまで待つ
  try { await page.waitForSelector('text=/claude_code\\./', { timeout: 25000 }); } catch (e) { console.log('loki wait:', e.message); }
  await sleep(6000);

  // user_prompt の行を展開して属性(prompt 本文など)を見せる
  try {
    const r = page.getByText('claude_code.user_prompt').first();
    await r.scrollIntoViewIfNeeded({ timeout: 6000 });
    await r.click({ timeout: 6000 });
    await sleep(2500);
  } catch (e) { console.log('log row expand skip:', e.message); }
  await caption(page, { step:2, total:TOTAL, title:'ログ/イベント (Loki): 中身の属性',
    body:'行を開くと属性が見えます。<b>session.id / user.email / organization.id</b> に加え、フル監査時は <b>prompt(入力本文)</b> まで。',
    sub:'「誰が・どのセッションで・何を入力したか」を1イベント単位で監査できる' });
  await sleep(8500);
  await clearCaption(page);

  // ===== 3. Explore + Tempo: トレース =====
  if (tid) {
    const tmpPane = encodeURIComponent(JSON.stringify({
      tmp1: { datasource:'tempo',
        queries:[{ refId:'A', datasource:{type:'tempo',uid:'tempo'}, queryType:'traceql', query: tid }],
        range:{ from:'now-3h', to:'now' } }
    }));
    await page.goto(`${G}/explore?orgId=1&schemaVersion=1&panes=${tmpPane}`, { waitUntil:'domcontentloaded' });
    try { await page.waitForSelector('text=claude_code.interaction', { timeout: 25000 }); } catch (e) { console.log('tempo wait:', e.message); }
    await sleep(4500);
    await caption(page, { step:3, total:TOTAL, title:'トレース (Tempo): 処理の流れ',
      body:'1つのプロンプト処理を1本のトレースとして可視化。左のツリーが呼び出し階層、右の帯(ウォーターフォール)が各処理の時間です。',
      sub:'interaction(ユーザの1ターン)の下に llm_request(API)や tool がぶら下がる' });
    await sleep(8000);
    await caption(page, { step:4, total:TOTAL, title:'トレース (Tempo): どこで時間がかかったか',
      body:'<b>tool</b> の下に <b>blocked_on_user(権限待ち)</b> と <b>execution(実行)</b> が分かれて記録。帯の長さ＝所要時間。',
      sub:'「ツールのどの段階が遅いか」「権限承認にどれだけ待ったか」まで分解できる' });
    await sleep(8000);
    await clearCaption(page);
  } else {
    console.log('trace id 取得できず: Tempo ステップをスキップ');
  }

  // ===== 5. 相関 (トレース ⇄ ログ) =====
  await caption(page, { step:5, total:TOTAL, title:'相関: トレース ⇄ ログ ⇄ メトリクス',
    body:'ログの <code>trace_id</code> からトレースへ、トレースから関連ログへワンクリックで往復できるよう datasource にリンク設定済み。',
    sub:'「数字の異常 → 該当ログ → その処理のトレース」と一気通貫で追跡できる' });
  await sleep(7500);

  // ===== 6. まとめカード =====
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id='__end';
    d.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0a0c14;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;text-align:center';
    d.innerHTML='<div style="font-size:46px;font-weight:800;color:#9be8d8">Grafana だけで監査が完結</div>'+
      '<div style="font-size:24px;margin-top:20px;line-height:1.7;color:#ddd">メトリクスで“量”・ログで“中身”・トレースで“流れ”<br>すべてローカルの Laptop 内で追跡できる</div>';
    document.body.appendChild(d);
  });
  await sleep(4000);

  await ctx.close();   // ← これで webm が確定
  await browser.close();
  console.log('done');
})();
