// 並列動画の「右ペイン(Grafana)」用録画。
// ダッシュボードを自動更新(5秒)させながら一定時間録画する。左ペイン(端末)で
// claude を実行している間に、数値・ログが増えていく様子を同じ時間帯で捉える。
// 出力: demo/_side/graf.webm
import { chromium } from 'playwright';
import fs from 'node:fs';
process.env.LD_LIBRARY_PATH = '/home/linuxbrew/.linuxbrew/lib:' + (process.env.LD_LIBRARY_PATH || '');

const G = 'http://localhost:3001';
const DURATION = Number(process.env.DURATION_MS || 64000);
const VIEW = { width: 1000, height: 760 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function secrets() {
  const s = new Set(); if (process.env.PII_EMAIL) s.add(process.env.PII_EMAIL);
  try { const t = fs.readFileSync('data/otel-file/logs.json', 'utf8');
    const keys = ['user.email','organization.id','user.account_uuid','user.account_id','user.id','session.id'];
    for (const m of t.matchAll(/"key":"([^"]+)","value":\{"stringValue":"([^"]+)"\}/g))
      if (keys.includes(m[1]) && m[2].length >= 8) s.add(m[2]);
  } catch {} return [...s];
}

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: VIEW, recordVideo: { dir: 'demo/_side', size: VIEW } });
  const page = await ctx.newPage();
  await page.addInitScript((lits) => {
    const reU=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, reH=/\b[0-9a-f]{64}\b/gi,
          reA=/user_[A-Za-z0-9]{16,}/g, reE=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const mask=s=>s.replace(reE,'••••••@••••••').replace(reA,'user_••••••').replace(reU,'••••••••-••••-••••-••••-••••••••••••').replace(reH,'••••••••');
    const run=()=>{const w=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);const ns=[];while(w.nextNode())ns.push(w.currentNode);
      for(const n of ns){let v=n.nodeValue;if(!v)continue;let nv=mask(v);for(const l of lits){if(l&&nv.includes(l))nv=nv.split(l).join('••••••');}if(nv!==v)n.nodeValue=nv;}};
    setInterval(run,300);document.addEventListener('DOMContentLoaded',run);
  }, secrets());

  // 直近15分・5秒自動更新でダッシュボードを表示
  await page.goto(`${G}/d/claude-code-audit/claude-code-audit?orgId=1&from=now-15m&to=now&refresh=5s&kiosk`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('text=Total tokens', { timeout: 20000 }); } catch {}
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id='__cap';
    d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(14,116,144,.95);color:#fff;padding:8px 14px;font:600 18px sans-serif';
    d.textContent='Grafana ダッシュボード(5秒ごと自動更新) — 左の CLI 実行に伴い数値・ログが増える';
    document.body.appendChild(d);
  });
  await sleep(DURATION);
  await ctx.close(); await b.close();
  console.log('grafana recording done');
})();
