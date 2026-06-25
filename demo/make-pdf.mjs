// reveal.js スライド(presentation/index.html)を 1スライド=1ページ の PDF に変換する。
// 各スライドを画像化し、1280x720 のページに1枚ずつ並べて PDF 出力する(動画はポスターフレームで静止)。
// 実行: LD_LIBRARY_PATH=$(brew --prefix)/lib node demo/make-pdf.mjs
// 出力: presentation/slides.pdf
import { chromium } from 'playwright';
import fs from 'node:fs';
process.env.LD_LIBRARY_PATH = '/home/linuxbrew/.linuxbrew/lib:' + (process.env.LD_LIBRARY_PATH || '');

const url = 'file://' + process.cwd() + '/presentation/index.html';
const TMP = '/tmp/_slides';
const W = 1280, H = 720;

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const shotPage = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();

  await shotPage.goto(url, { waitUntil: 'networkidle' });
  await shotPage.waitForTimeout(1500);
  const total = await shotPage.evaluate(() => (window.Reveal ? Reveal.getTotalSlides() : 1));
  console.log('total slides:', total);

  const imgs = [];
  for (let i = 0; i < total; i++) {
    await shotPage.goto(`${url}#/${i}`, { waitUntil: 'networkidle' });
    await shotPage.waitForTimeout(1100);
    const p = `${TMP}/s-${String(i).padStart(2,'0')}.png`;
    await shotPage.screenshot({ path: p });   // 1280x720 (DSF1)
    imgs.push(p);
  }

  // 1スライド=1ページの PDF を組み立て(画像は base64 で確実に埋め込む)
  const tags = imgs.map(p => {
    const b64 = fs.readFileSync(p).toString('base64');
    return `<div class="pg"><img src="data:image/png;base64,${b64}"></div>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{ size:${W}px ${H}px; margin:0; }
    html,body{ margin:0; padding:0; }
    .pg{ width:${W}px; height:${H}px; overflow:hidden; break-after:page; }
    .pg:last-child{ break-after:auto; }
    img{ width:${W}px; height:${H}px; display:block; }
  </style></head><body>${tags}</body></html>`;
  const pdfPage = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await pdfPage.setContent(html, { waitUntil: 'load' });
  await pdfPage.waitForTimeout(500);
  await pdfPage.pdf({
    path: 'presentation/slides.pdf',
    preferCSSPageSize: true,
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  await b.close();
  console.log('wrote presentation/slides.pdf');
})();
