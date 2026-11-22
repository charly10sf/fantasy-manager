// lámina rotulada: node lamina.mjs <datos.json> <salida.png>
import fs from 'node:fs';
import { pw } from './comun.mjs';
const [, , fDatos, salida] = process.argv;
const L = JSON.parse(fs.readFileSync(fDatos, 'utf8'));
const F = '/home/claude/charly10sf/fantasy-manager/web/fonts';
const b64 = (f) => fs.readFileSync(f).toString('base64');
const AN = L.anchoMovil || 430, K = AN / 390, ALTO = Math.round((L.alto || 844) * K);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:BC;font-weight:700;src:url(data:font/woff2;base64,${b64(`${F}/barlow-condensed-700.woff2`)})}
@font-face{font-family:BC;font-weight:600;src:url(data:font/woff2;base64,${b64(`${F}/barlow-condensed-600.woff2`)})}
@font-face{font-family:B;font-weight:400;src:url(data:font/woff2;base64,${b64(`${F}/barlow-400.woff2`)})}
@font-face{font-family:B;font-weight:600;src:url(data:font/woff2;base64,${b64(`${F}/barlow-600.woff2`)})}
*{box-sizing:border-box;margin:0}body{background:#08080a;color:#f4f4f6;font:400 19px/1.35 B,sans-serif;padding:44px 48px 36px;width:${48 * 2 + L.paneles.length * AN + (L.paneles.length - 1) * 44}px}
h1{font:700 54px/1 BC;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:16px}
h1::before{content:'';width:20px;height:50px;background:#ee1c3c;transform:skewX(-14deg);flex:none}
.sub{color:#a9a9b3;font-size:21px;margin:12px 0 30px 36px;max-width:1500px}
.fila{display:flex;gap:44px;align-items:flex-start}
.p{width:${AN}px}
.movil{position:relative;width:${AN}px;height:${ALTO}px;border-radius:26px;overflow:hidden;border:2px solid #2a2a31;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.movil img{width:100%;height:100%;display:block}
.n{position:absolute;min-width:38px;height:38px;padding:0 9px;background:#ee1c3c;color:#fff;font:700 26px/38px BC;text-align:center;transform:skewX(-10deg);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.7)}
.n span{display:block;transform:skewX(10deg)}
.t{font:700 30px/1.05 BC;text-transform:uppercase;margin:20px 0 6px;display:flex;gap:12px;align-items:flex-start}
.t .n{position:static;flex:none;box-shadow:none}
.d{color:#d5d5dc;font-size:18.5px}.d b{color:#fff;font-weight:600}
.c{margin-top:9px;color:#a9a9b3;font-size:17px;border-left:3px solid #ee1c3c;padding-left:10px}
.pie{margin-top:28px;color:#8a8a94;font-size:16.5px}
</style></head><body>
<h1>${esc(L.titulo)}</h1><p class="sub">${esc(L.sub)}</p>
<div class="fila">${L.paneles.map((p) => `<div class="p"><div class="movil"><img src="data:image/png;base64,${b64(p.img)}">
${(p.marcas || []).map((m) => `<div class="n" style="left:${Math.max(4, Math.round(m.x * K))}px;top:${Math.max(4, Math.round(m.y * K))}px"><span>${esc(m.n)}</span></div>`).join('')}</div>
<div class="t"><div class="n"><span>${esc(p.n)}</span></div><span>${esc(p.t)}</span></div><p class="d">${p.d}</p><p class="c">${p.c}</p></div>`).join('')}</div>
<p class="pie">${esc(L.pie)}</p></body></html>`;
const nav = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'] });
const page = await (await nav.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })).newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(800);
const el = await page.$('body');
const caja = await el.boundingBox();
await page.setViewportSize({ width: Math.ceil(caja.width), height: Math.ceil(caja.height) });
await page.screenshot({ path: salida, fullPage: true });
console.log(salida, Math.ceil(caja.width), 'x', Math.ceil(caja.height));
await nav.close();
