// la portada y la entrada, iguales que en main: node .github/liquid/portada.mjs  (compara 8766 = main con 8765)
import fs from 'node:fs';
const pw = await import(process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs');
const nav = await pw.chromium.launch();
fs.mkdirSync('portada', { recursive: true });
for (const [n, vp, ua] of [['movil', { width: 390, height: 844 }, 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'], ['iphone', { width: 390, height: 844 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1'], ['pc', { width: 1280, height: 800 }, undefined]]) {
  const sal = {};
  for (const [k, base] of [['main', 'http://127.0.0.1:8766'], ['rama', 'http://127.0.0.1:8765']]) {
    const ctx = await nav.newContext({ viewport: vp, userAgent: ua, deviceScaleFactor: 1, isMobile: n !== 'pc', hasTouch: n !== 'pc' });
    await ctx.addInitScript((b) => { localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-worker', b); localStorage.setItem('fm-proxy2', b); localStorage.setItem('fm-tour', '1'); }, base);
    await ctx.route((u) => !/127\.0\.0\.1/.test(u.href), (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(`${base}/index.html`);
    await p.waitForSelector('.portada', { timeout: 30000 });
    await p.waitForTimeout(2500);
    await p.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    await p.waitForTimeout(300);
    sal[k] = await p.screenshot({ path: `portada/${n}-${k}.png`, fullPage: true });
    if (k === 'rama') console.log(n, 'lq:', await p.evaluate(() => document.documentElement.classList.contains('lq')));
    await ctx.close();
  }
  console.log(n, sal.main.equals(sal.rama) ? 'IGUALES' : `DISTINTAS (${sal.main.length} / ${sal.rama.length} bytes)`);
}
await nav.close();
