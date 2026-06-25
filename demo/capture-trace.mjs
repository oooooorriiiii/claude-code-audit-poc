// Tempo のトレース表示(span 階層 + 所要時間の横棒)を PNG 保存する。
// スライド10(分散トレース)の図に使用。PII は gui-demo.mjs と同様にマスクする。
// 出力: presentation/img/trace-waterfall.png
//
// 実行: LD_LIBRARY_PATH=$(brew --prefix)/lib node demo/capture-trace.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
process.env.LD_LIBRARY_PATH = '/home/linuxbrew/.linuxbrew/lib:' + (process.env.LD_LIBRARY_PATH || '');

const G = 'http://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function gatherSecrets() {
  const lits = new Set();
  if (process.env.PII_EMAIL) lits.add(process.env.PII_EMAIL);
  try {
    const txt = fs.readFileSync('data/otel-file/logs.json', 'utf8');
    const keys = ['user.email','organization.id','user.account_uuid','user.account_id','user.id','session.id'];
    for (const m of txt.matchAll(/"key":"([^"]+)","value":\{"stringValue":"([^"]+)"\}/g))
      if (keys.includes(m[1]) && m[2].length >= 8) lits.add(m[2]);
  } catch {}
  return [...lits];
}

async function latestTraceId() {
  const now = Math.floor(Date.now() / 1000);
  const r = await fetch(`http://localhost:3200/api/search?q=${encodeURIComponent('{}')}&limit=1&start=${now-86400}&end=${now}`);
  return (await r.json()).traces?.[0]?.traceID || null;
}

(async () => {
  const tid = await latestTraceId();
  if (!tid) { console.error('trace id 取得失敗'); process.exit(1); }
  console.log('trace id:', tid);
  const secrets = gatherSecrets();

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript((lits) => {
    const reUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const reHex64 = /\b[0-9a-f]{64}\b/gi; const reAcct = /user_[A-Za-z0-9]{16,}/g;
    const reEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const mask = (s) => s.replace(reEmail,'••••••@••••••').replace(reAcct,'user_••••••')
                         .replace(reUuid,'••••••••-••••-••••-••••-••••••••••••').replace(reHex64,'••••••••');
    const run = () => { const w=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);
      const ns=[]; while(w.nextNode()) ns.push(w.currentNode);
      for(const n of ns){ let v=n.nodeValue; if(!v) continue; let nv=mask(v);
        for(const l of lits){ if(l&&nv.includes(l)) nv=nv.split(l).join('••••••'); } if(nv!==v) n.nodeValue=nv; } };
    setInterval(run, 300); document.addEventListener('DOMContentLoaded', run);
  }, secrets);

  const pane = encodeURIComponent(JSON.stringify({
    t: { datasource:'tempo',
      queries:[{ refId:'A', datasource:{type:'tempo',uid:'tempo'}, queryType:'traceql', query: tid }],
      range:{ from:'now-24h', to:'now' } }
  }));
  await page.goto(`${G}/explore?orgId=1&schemaVersion=1&panes=${pane}`, { waitUntil:'domcontentloaded' });
  try { await page.waitForSelector('text=claude_code.interaction', { timeout: 25000 }); } catch (e) { console.log('wait:', e.message); }
  await sleep(3500);

  // トレースパネル部分を切り出して保存(なければ全体)
  let target = page.locator('[data-testid="trace-view-container"], .panel-container').first();
  try { await target.screenshot({ path: 'presentation/img/trace-waterfall.png' }); }
  catch { await page.screenshot({ path: 'presentation/img/trace-waterfall.png' }); }
  await browser.close();
  console.log('saved presentation/img/trace-waterfall.png');
})();
