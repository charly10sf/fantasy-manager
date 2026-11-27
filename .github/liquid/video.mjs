// (rediseño «Liquid», maqueta) un vídeo corto por dirección: cambiar de pestaña tres veces, bajar por Mercado (la barra
// se encoge y la cabecera pasa a cristal), abrir una ficha y cerrarla arrastrando. Menos de 15 s, en mp4. Playwright graba
// a 390×844 (no multiplica por la densidad de pantalla): ffmpeg lo dobla para que en el móvil no se vea tan blando.
//   node .github/liquid/video.mjs <carpeta> [dirs=A,B,C,D]      (CARAS=<caras.json> como en capturas.mjs)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const PW = process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const [, , carpeta = 'video', dirsA = 'A,B,C,D'] = process.argv;
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const caras = process.env.CARAS ? fs.readFileSync(process.env.CARAS, 'utf8') : null;
fs.mkdirSync(carpeta, { recursive: true });
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const nav = await chromium.launch({ proxy });

for (const d of dirsA.split(',')) {
  const tmp = `${carpeta}/tmp-${d}`;
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: tmp, size: { width: 390, height: 844 } } });
  await ctx.addInitScript((c) => { try { localStorage.setItem('fm-prueba', '1'); if (c) localStorage.setItem('fm-caras-demo', c); } catch (e) { /* nada */ } }, caras);
  const p = await ctx.newPage();
  const t0 = Date.now();
  const cdp = await ctx.newCDPSession(p);
  await p.goto(`${BASE}/maqueta-liquid.html?dentro=1&d=${d}&p=hoy&top=1&cap=1`);
  await p.waitForFunction(() => document.documentElement.classList.contains('maq-lista'), null, { timeout: 60000 });
  await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(500);
  const empieza = (Date.now() - t0) / 1000;
  const tocar = async (sel) => { const r = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel); if (r) await p.touchscreen.tap(r[0], r[1]); };
  const desliza = (sel, a, ms) => p.evaluate(([sel, a, ms]) => new Promise((ok) => {
    const el = sel ? document.querySelector(sel) : document.scrollingElement, de = el.scrollTop, t0 = performance.now();
    const paso = (t) => { const k = Math.min(1, (t - t0) / ms), s = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2; el.scrollTop = de + (a - de) * s; if (k < 1) requestAnimationFrame(paso); else ok(); };
    requestAnimationFrame(paso);
  }), [sel, a, ms]);
  await p.waitForTimeout(600);
  await tocar('.nav [data-ir="equipo"]'); await p.waitForTimeout(850);
  await tocar('.nav [data-ir="rivales"]'); await p.waitForTimeout(850);
  await tocar('.nav [data-ir="mercado"]'); await p.waitForTimeout(900);
  await desliza(null, 980, 2300); await p.waitForTimeout(250);
  await desliza(null, 760, 700); await p.waitForTimeout(450);
  // una ficha: la primera fila que se ve entera
  const fila = await p.evaluate(() => { const f = [...document.querySelectorAll('#vista .fila[data-j]')].find((e) => { const r = e.getBoundingClientRect(); return r.top > 170 && r.bottom < 640; }); if (!f) return null; const r = f.getBoundingClientRect(); return [r.left + 150, r.top + r.height / 2]; });
  if (fila) await p.touchscreen.tap(fila[0], fila[1]);
  await p.waitForTimeout(1300);
  await desliza('.hoja.on', 300, 800); await p.waitForTimeout(200);
  await desliza('.hoja.on', 0, 450); await p.waitForTimeout(250);
  // cerrarla arrastrando el asa
  const asa = await p.evaluate(() => { const a = document.querySelector('.hoja.on .asa'); if (!a) return null; const r = a.getBoundingClientRect(); return [r.left + r.width / 2, r.top + 16]; });
  if (asa) {
    const toque = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: asa[0], y, id: 1 }] });
    await toque('touchStart', asa[1]);
    for (let i = 1; i <= 16; i++) { await toque('touchMove', asa[1] + (460 * i * i) / 256); await p.waitForTimeout(28); }
    await toque('touchEnd');
  }
  await p.waitForTimeout(1000);
  const dura = (Date.now() - t0) / 1000 - empieza;
  await ctx.close();
  const webm = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
  const sal = `${carpeta}/liquid-${d}.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', empieza.toFixed(2), '-i', `${tmp}/${webm}`, '-t', Math.min(14.8, dura).toFixed(2), '-vf', 'scale=780:1688:flags=lanczos,unsharp=3:3:0.6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'slow', '-movflags', '+faststart', '-an', sal]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(sal, `${dura.toFixed(1)} s`, `${Math.round(fs.statSync(sal).size / 1024)} KB`);
}
await nav.close();
