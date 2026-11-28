// el contraste del texto sobre cristal con lo que le pasa por detrás: capturas sin el texto + las cajas y el color de cada texto
import fs from 'node:fs';
const pw = await import(process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs');
const [, , carpeta = 'contraste', pantsA = 'equipo,clubes,mercado,hoy,rivales,directo'] = process.argv;
fs.mkdirSync(carpeta, { recursive: true });
const caras = (process.env.CARAS && fs.existsSync(process.env.CARAS) ? fs.readFileSync(process.env.CARAS, 'utf8') : null);
const CAP = fs.readFileSync(new URL('./captura.css', import.meta.url), 'utf8');
const nav = await pw.chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.addInitScript((c) => { localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', '1'); localStorage.setItem('fm-beta-aviso', String(Date.now())); localStorage.setItem('fm-caras-demo', c); }, caras);
await ctx.route(/limites\.json/, async (r) => { const res = await r.fetch(); let j = {}; try { j = await res.json(); } catch (e) { /* nada */ } j.bloqueadas = []; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8765/index.html');
await p.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 60000 });
await p.addStyleTag({ content: CAP + '#vista, #vista * { animation-duration: 0s !important; } #vista .fila { content-visibility: visible !important; } html.sin-tx :is(.nav button, .tabs button, .sup-liga *, .sup-btns *, .sup-pos, .sup-pts) { color: transparent !important; } html.sin-tx :is(.nav .ic, .tabs .ic, .sup .ic, .sup-marca, .punto, .tab-n, .gl) { visibility: hidden !important; } html.sin-tx .b-ico::after { color: transparent !important; }' });
await p.evaluate(() => document.documentElement.classList.add('fm-captura'));
const out = [];
for (const pa of pantsA.split(',')) {
  await p.evaluate((x) => { window.scrollTo(0, 0); document.querySelector(`.nav [data-ir="${x}"]`).click(); }, pa);
  await p.waitForTimeout(900);
  const tope = await p.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
  for (let y = 0, i = 0; y <= Math.min(tope, +(process.env.HASTA || 2600)); y += +(process.env.PASO || 130), i++) {
    await p.evaluate((yy) => { window.scrollTo(0, yy); document.querySelector('.nav').classList.remove('nav-min'); }, y);
    await p.waitForTimeout(160);
    await p.evaluate(() => {
      const liga = document.querySelector('.sup-liga'), btns = document.querySelector('.sup-btns'); if (!liga || !btns) return;
      window.__caps ||= [0, 1].map(() => { const d = document.createElement('div'); d.className = 'fm-capsula'; document.body.append(d); return d; });
      const W = innerWidth, caja = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el, '::before'), n = (v) => parseFloat(v) || 0; return [r.left + n(c.left), r.top + n(c.top), r.right - n(c.right), r.bottom - n(c.bottom)]; };
      [caja(liga), caja(btns)].forEach(([x0, y0, x1, y1], k) => { const iz = Math.min(60, Math.max(0, x0)), de = Math.min(60, Math.max(0, W - x1)), ar = Math.min(60, Math.max(0, y0)), ab = 60; window.__caps[k].style.cssText = `left:${x0 - iz}px;top:${y0 - ar}px;width:${x1 - x0 + iz + de}px;height:${y1 - y0 + ar + ab}px;clip-path:inset(${ar}px ${de}px ${ab}px ${iz}px round 28px)`; });
    });
    const cajas = await p.evaluate(() => {
      const r = [];
      const mete = (tipo, el) => { const b = el.getBoundingClientRect(); if (b.width < 4 || b.bottom < 0 || b.top > innerHeight) return; r.push({ tipo, t: el.textContent.trim().slice(0, 18), x: b.left, y: b.top, w: b.width, h: b.height, c: getComputedStyle(el).color }); };
      const tx = (el) => { const ran = document.createRange(); const n = [...el.childNodes].find((k) => k.nodeType === 3 && k.textContent.trim()); if (!n) return null; ran.selectNodeContents(n); return ran; };
      for (const b of document.querySelectorAll('.nav button')) { const ran = tx(b); if (ran) { const q = ran.getBoundingClientRect(); r.push({ tipo: b.classList.contains('activo') ? 'barra-activa' : 'barra', t: b.textContent.trim(), x: q.left, y: q.top, w: q.width, h: q.height, c: getComputedStyle(b).color }); } }
      for (const b of document.querySelectorAll('#vista .tabs button')) { const ran = tx(b); if (ran) { const q = ran.getBoundingClientRect(); if (q.width > 3 && q.right > 14 && q.left < innerWidth - 14) r.push({ tipo: b.classList.contains('activo') ? 'selector-activo' : 'selector', t: b.textContent.trim().slice(0, 14), x: q.left, y: q.top, w: q.width, h: q.height, c: getComputedStyle(b).color }); } }
      const s = (sel, tipo) => { const e = document.querySelector(sel); if (e) mete(tipo, e); };
      s('#supLiga b', 'liga'); s('#supEstado .sup-tx', 'estado'); s('.sup-pts', 'puntos'); s('.sup-pos', 'puesto');
      for (const b of document.querySelectorAll('.sup-btns .b-ico')) { const q = b.getBoundingClientRect(); r.push({ tipo: 'boton-cabecera', t: b.dataset.et, x: q.left + 4, y: q.bottom - 20, w: q.width - 8, h: 16, c: getComputedStyle(b, '::after').color }); }
      return r;
    });
    await p.evaluate(() => document.documentElement.classList.add('sin-tx'));
    const f = `${carpeta}/${pa}-${i}.png`;
    await p.screenshot({ path: f });
    await p.evaluate(() => document.documentElement.classList.remove('sin-tx'));
    out.push({ f, pa, y, cajas });
  }
}
fs.writeFileSync(`${carpeta}/cajas.json`, JSON.stringify(out));
await nav.close();
console.log(out.length, 'capturas');
