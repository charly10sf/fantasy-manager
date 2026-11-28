// el tutorial paso a paso: node .github/liquid/tutorial.mjs <carpeta> [w] [BASE]
import fs from 'node:fs';
const pw = await import(process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs');
const [, , carpeta = 'tour', W = '390', BASE = 'http://127.0.0.1:8765'] = process.argv;
fs.mkdirSync(carpeta, { recursive: true });
const caras = (process.env.CARAS && fs.existsSync(process.env.CARAS) ? fs.readFileSync(process.env.CARAS, 'utf8') : null);
const nav = await pw.chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined });
const ctx = await nav.newContext({ viewport: { width: +W, height: +W > 1000 ? 800 : 844 }, deviceScaleFactor: 1, isMobile: +W < 1000, hasTouch: +W < 1000 });
await ctx.addInitScript((c) => { localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-prueba', '1'); localStorage.setItem('fm-beta-aviso', String(Date.now())); localStorage.setItem('fm-caras-demo', c); }, caras);
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERROR', e.message));
await p.goto(`${BASE}/index.html`);
await p.waitForSelector('.tour .tour-caja h2', { timeout: 60000 });
const basico = await p.$('.tour [data-t="todo"], .tour [data-t="completo"]');
let n = 0;
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(650);
  const info = await p.evaluate(() => {
    const f = document.querySelector('.tour-foco'), c = document.querySelector('.tour-caja'); if (!c) return null;
    const r = f.getBoundingClientRect(), k = c.getBoundingClientRect();
    const pisa = !(k.bottom <= r.top || k.top >= r.bottom || k.right <= r.left || k.left >= r.right) && !f.classList.contains('sin');
    return { t: c.querySelector('h2')?.textContent, foco: f.classList.contains('sin') ? 'sin' : `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`, pisa, fuera: k.left < 0 || k.right > innerWidth || k.top < 0 || k.bottom > innerHeight, btns: [...c.querySelectorAll('[data-t]')].map((b) => b.dataset.t).join(',') };
  });
  if (!info) break;
  console.log(String(i).padStart(2), info.t, '|', info.foco, info.pisa ? 'LA TARJETA PISA EL FOCO' : '', info.fuera ? 'TARJETA FUERA' : '', '|', info.btns);
  await p.screenshot({ path: `${carpeta}/${String(i).padStart(2, '0')}.png` }); n++;
  const sig = await p.$('.tour [data-t="todo"]') || await p.$('.tour [data-t="sig"]') || await p.$('.tour [data-t="siguiente"]');
  if (!sig) { const bs = await p.$$('.tour .tour-btns [data-t]'); if (!bs.length) break; await bs[bs.length - 1].click(); } else await sig.click();
  if (!(await p.$('.tour'))) break;
}
console.log('pasos', n);
await nav.close();
