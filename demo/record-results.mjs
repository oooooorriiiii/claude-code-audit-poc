// 統合ウォークスルーの「結果 1/2/3」チャプターを録画する(Playwright)。
// CLI 実行は別途 VHS で録った実機画面(demo/_cli/cli.mp4)を build スクリプトで連結する。
// 実テレメトリ(②③④)は直前の実 Claude 実行で生成済みのものを表示。PII はマスク。
// 出力: demo/_cli/results.webm ＋ CLI 章タイトル画像 demo/_cli/card-cli.png
import { chromium } from 'playwright';
import fs from 'node:fs';
process.env.LD_LIBRARY_PATH = '/home/linuxbrew/.linuxbrew/lib:' + (process.env.LD_LIBRARY_PATH || '');

// ===========================================================================
// ★編集ポイント: 画面の文言はすべてここ。編集後 `bash demo/build-walkthrough.sh` で再生成。
// ===========================================================================
const CAPS = {
  cliCard: { eyebrow: '① CLI 実行', title: 'Claude Code でタスクを実行する' },
  introCard: {
    title: 'CLI 実行 ⇄ テレメトリの対応',
    bodyHtml: '上の実行を構成する操作:<br>&nbsp;&nbsp;<b>①ユーザ入力</b> → <b>②Write</b> → <b>③Read</b> → <b>④Bash(echo)</b> → <b>⑤モデル応答</b><br><br>これらが Grafana の <b>メトリクス / ログ / トレース</b> のどこに現れるかを順に見る。',
  },
  metrics: '結果1 メトリクス',
  logs:    '結果2 ログ',
  traces:  '結果3 トレース',
  endCard: {
    title: '1回の CLI 実行が3信号で追える',
    bodyHtml: 'メトリクス=量 / ログ=中身 / トレース=流れ<br>同じ操作(①〜⑤)が各画面に対応して現れる',
  },
};
// ===========================================================================

const G = 'http://localhost:3001';
const LOKI_UID = 'P8E80F9AEF21F6940';
const VIEW = { width: 1280, height: 720 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function gatherSecrets() {
  const s = new Set(); if (process.env.PII_EMAIL) s.add(process.env.PII_EMAIL);
  try { const t = fs.readFileSync('data/otel-file/logs.json', 'utf8');
    const keys = ['user.email','organization.id','user.account_uuid','user.account_id','user.id','session.id'];
    for (const m of t.matchAll(/"key":"([^"]+)","value":\{"stringValue":"([^"]+)"\}/g))
      if (keys.includes(m[1]) && m[2].length >= 8) s.add(m[2]);
  } catch {} return [...s];
}
const MASK = (lits) => {
  const reU=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, reH=/\b[0-9a-f]{64}\b/gi,
        reA=/user_[A-Za-z0-9]{16,}/g, reE=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const m=s=>s.replace(reE,'••••••@••••••').replace(reA,'user_••••••').replace(reU,'••••••••-••••-••••-••••-••••••••••••').replace(reH,'••••••••');
  const run=()=>{const w=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);const ns=[];while(w.nextNode())ns.push(w.currentNode);
    for(const n of ns){let v=n.nodeValue;if(!v)continue;let nv=m(v);for(const l of lits){if(l&&nv.includes(l))nv=nv.split(l).join('••••••');}if(nv!==v)n.nodeValue=nv;}};
  setInterval(run,300);document.addEventListener('DOMContentLoaded',run);
};

async function cap(page, heading) {
  await page.evaluate((heading) => {
    let el=document.getElementById('__cap'); if(!el){el=document.createElement('div');el.id='__cap';document.body.appendChild(el);
      el.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:linear-gradient(to top,rgba(8,12,20,.96),rgba(8,12,20,.82));color:#fff;padding:16px 26px;font-family:\"Noto Sans CJK JP\",sans-serif;border-top:3px solid #4ec9b0';}
    el.innerHTML=`<div style="font-size:30px;font-weight:800;color:#9be8d8">${heading}</div>`;
  }, heading);
}
const clearCap = (page) => page.evaluate(()=>document.getElementById('__cap')?.remove());

async function card(page, title, bodyHtml, ms) {
  await page.evaluate(({title,bodyHtml})=>{ let d=document.getElementById('__card'); if(!d){d=document.createElement('div');d.id='__card';document.body.appendChild(d);}
    d.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#0a0c14;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:\"Noto Sans CJK JP\",sans-serif;padding:0 8%';
    d.innerHTML=`<div style="font-size:34px;font-weight:800;color:#9be8d8">${title}</div><div style="font-size:22px;margin-top:22px;line-height:1.9;text-align:left">${bodyHtml}</div>`; }, {title,bodyHtml});
  await sleep(ms);
  await page.evaluate(()=>document.getElementById('__card')?.remove());
}

async function scrollThrough(page, steps=6, dy=220, wait=950) {
  await page.mouse.move(VIEW.width*0.5, VIEW.height*0.55);
  for (let i=0;i<steps;i++){ await page.mouse.wheel(0, dy); await sleep(wait); }
}

(async () => {
  const lits = gatherSecrets();
  const browser = await chromium.launch({ args:['--no-sandbox'] });

  // CLI 章のタイトル画像(静止画・連結で使用)
  {
    const p = await (await browser.newContext({ viewport: VIEW })).newPage();
    await p.setContent(`<body style="margin:0;background:#0a0c14;color:#fff;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'Noto Sans CJK JP',sans-serif">
      <div style="font-size:30px;color:#9be8d8;letter-spacing:.1em">${CAPS.cliCard.eyebrow}</div>
      <div style="font-size:40px;font-weight:800;margin:18px 0">${CAPS.cliCard.title}</div></body>`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'demo/_cli/card-cli.png' });
    await p.context().close();
  }

  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: 'demo/_cli', size: VIEW } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.addInitScript(MASK, lits);

  // 対応関係の章扉
  await page.goto(`${G}/?orgId=1`, { waitUntil:'domcontentloaded' });
  await card(page, CAPS.introCard.title, CAPS.introCard.bodyHtml, 6000);

  // ② 結果1: メトリクス
  await page.goto(`${G}/d/claude-code-audit/claude-code-audit?orgId=1&from=now-15m&to=now&refresh=5s&kiosk`, { waitUntil:'domcontentloaded' });
  try { await page.waitForSelector('text=Total tokens', { timeout:20000 }); } catch {}
  await sleep(2000);
  await cap(page, CAPS.metrics);
  await sleep(6000);
  await scrollThrough(page, 3, 260, 1000);
  await sleep(1200);
  await clearCap(page);

  // ③ 結果2: ログ(中身をスクロールで見せる)
  const lokiPane = encodeURIComponent(JSON.stringify({
    l:{ datasource:LOKI_UID, queries:[{refId:'A',datasource:{type:'loki',uid:LOKI_UID},expr:'{service_name="claude-code"}',queryType:'range'}], range:{from:'now-15m',to:'now'} }
  }));
  await page.goto(`${G}/explore?orgId=1&schemaVersion=1&panes=${lokiPane}`, { waitUntil:'domcontentloaded' });
  await cap(page, CAPS.logs);
  try { await page.waitForSelector('text=/claude_code\\./', { timeout:25000 }); } catch (e) { console.log('loki wait', e.message); }
  await sleep(3000);
  await scrollThrough(page, 6, 230, 850);          // ログ一覧をスクロールして俯瞰
  await sleep(600);
  // 複数のイベント種別を順に展開して中身(属性)を確認
  for (const ev of ['claude_code.user_prompt','claude_code.tool_result','claude_code.api_response_body']) {
    try {
      const r = page.getByText(ev, { exact:true }).first();
      await r.scrollIntoViewIfNeeded({ timeout:6000 });
      await r.click({ timeout:6000, force:true });   // force: マスク用タイマーで不安定でもクリック
      await sleep(2600);
      await scrollThrough(page, 3, 190, 800);       // 展開した属性をスクロール
      await r.click({ timeout:4000, force:true }).catch(()=>{}); // 閉じて次へ
      await sleep(500);
    } catch (e) { console.log('expand '+ev, e.message); }
  }
  await sleep(1200);
  await clearCap(page);

  // ④ 結果3: トレース
  const now = Math.floor(Date.now()/1000);
  let tid=null;
  try { tid=(await (await fetch(`http://localhost:3200/api/search?q=${encodeURIComponent('{}')}&limit=1&start=${now-1800}&end=${now}`)).json()).traces?.[0]?.traceID; } catch {}
  if (tid) {
    const tp = encodeURIComponent(JSON.stringify({ t:{ datasource:'tempo', queries:[{refId:'A',datasource:{type:'tempo',uid:'tempo'},queryType:'traceql',query:tid}], range:{from:'now-30m',to:'now'} } }));
    await page.goto(`${G}/explore?orgId=1&schemaVersion=1&panes=${tp}`, { waitUntil:'domcontentloaded' });
    try { await page.waitForSelector('text=claude_code.interaction', { timeout:25000 }); } catch (e) { console.log('tempo wait', e.message); }
    await sleep(3000);
    await cap(page, CAPS.traces);
    await sleep(4000);
    await scrollThrough(page, 5, 220, 950);
    await sleep(1500);
    await clearCap(page);
  }

  await card(page, CAPS.endCard.title, CAPS.endCard.bodyHtml, 4500);
  await ctx.close(); await browser.close();
  console.log('results recording done');
})();
