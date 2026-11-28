// Las pantallas de dentro de las tarjetas de las tiendas: LA APP DE VERDAD (0.9, con el rediseño «Liquid») con la liga de
// ejemplo. Con web/ servida en 127.0.0.1:8765 (python3 -m http.server dentro de web/):
//   CARAS=caras.json node pantallas.mjs <carpeta> <ancho> <alto> [sinfotos] [solo=hoy,mercado…]
// (27 nov, sesión de la 0.9) ya no va por la maqueta: abre index.html, navega como un usuario y, solo para la foto, alarga
// el cristal (CAPTURA: un Chromium sin tarjeta gráfica pinta mal el desenfoque de un cristal bajo; .github/liquid/captura.css).
import fs from 'node:fs';
const pw = await import(process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs');
const [, , carpeta = 'pant', W = '393', H = '852', modo = '', soloA = ''] = process.argv;
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const SINFOTOS = modo === 'sinfotos';
const caras = process.env.CARAS ? fs.readFileSync(process.env.CARAS, 'utf8') : null;
fs.mkdirSync(carpeta, { recursive: true });

// la respuesta, escrita a mano con las cifras que da la propia app en la liga de ejemplo (el plan, Hoy y Mercado):
// si cambia demo.js, revisarlas
const PREGUNTA = '¿Mantengo la puja por Courtois?';
const RESPUESTA = `**No: retírala antes de las 00:15.** Si la ganas, empiezas la jornada con −29,87 M, y en negativo no se puntúa.

- Tienes 6,43 M y ya hay 36,30 M pujados por él.
- Para llevártelo casi seguro habría que ir a 46,01 M: no compensa.
- En tu once ya juega Ionut Radu de portero.

Las cláusulas están cerradas hasta mañana a las 14:00: hasta entonces, mejor no tocar a los titulares.`.replace(/(\d) (M|mil|%|pts)/g, '$1 $2');

// [nombre, pantalla de la maqueta, función top abierta, desplazar (px o selector), pasos de más]
const PANTALLAS = [
  ['hoy', 'hoy', false, 0],
  ['mercado', 'mercado', false, 0, 'tendencias'],
  ['ficha', 'equipo', true, 0, 'ficha'],
  ['parte', 'rivales', true, 0],
  ['equipo', 'equipo', false, 0, 'once'],
  // (Carlos, 28 nov: el dinero de los rivales es lo primero) la lista de Rivales con el dinero de cada uno abierto, no la ficha de uno
  ['rival', 'dinero', true, 0],
  ['chat', 'pregunta', false, 0, 'chat'],
  ['clubes', 'clubes', false, 0],
];
const solo = soloA ? soloA.replace(/^solo=/, '').split(',') : null;

// lo de las capturas: sin la etiqueta BETA, sin el aviso de la liga de ejemplo (se dice en la tarjeta) y quieto
const CSS = `
  #vista, #vista *, .hoja, .hoja * { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }
  #vista .fila { content-visibility: visible !important; }
  .tour, .beta, .sello-beta, [class*="beta"] { display: none !important; }
  .aviso-demo, .demo-aviso, .banda-demo { display: none !important; }
`;

const google = async (route) => {
  const url = route.request().url();
  if (/\/models\?/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] }] }) });
  const tr = []; for (let i = 0; i < RESPUESTA.length; i += 120) tr.push(RESPUESTA.slice(i, i + 120));
  const pieza = (t, fin) => 'data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: t }] }, ...(fin ? { finishReason: fin } : {}) }], usageMetadata: { promptTokenCount: 9000, candidatesTokenCount: 220 } }) + '\r\n\r\n';
  if (/alt=sse/.test(url)) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: tr.map((t, i) => pieza(t, i === tr.length - 1 ? 'STOP' : null)).join('') });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: RESPUESTA }] }, finishReason: 'STOP' }] }) });
};

// (solo capturas) el cristal alargado y recortado: .github/liquid/captura.css del repo
const CAPTURA = fs.readFileSync(process.env.CAPTURA_CSS || new URL('./captura.css', import.meta.url), 'utf8');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const nav = await pw.chromium.launch({ proxy });
for (const [nombre, p, top, , extra] of PANTALLAS) {
  if (solo && !solo.includes(nombre)) continue;
  const ctx = await nav.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await ctx.addInitScript((c) => { try { localStorage.setItem('fm-prueba', '1'); localStorage.setItem('fm-sin-tema', '1'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-beta-aviso', String(Date.now())); localStorage.setItem('fm-n-gemini', 'AIzaMAQUETA-no-es-una-clave'); if (c) localStorage.setItem('fm-caras-demo', c); } catch (e) { /* nada */ } }, SINFOTOS ? null : caras);
  // lo de dentro de las funciones top, sin tocar limites.json
  if (top) await ctx.route(/limites\.json/, async (r) => { const res = await r.fetch(); let j = {}; try { j = await res.json(); } catch (e) { /* nada */ } j.bloqueadas = []; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
  // la liga de ejemplo va con el reloj: fijo (viernes 27 nov, 18:40 de Madrid), para que las ocho pantallas y la respuesta
  // escrita a mano del chat cuenten lo mismo («mañana a las 14:00», «antes de las 00:15»). RELOJ=<fecha ISO> lo cambia
  await ctx.clock.install({ time: new Date(process.env.RELOJ || '2026-11-27T17:40:00Z') });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('ERROR', nombre, e.message));
  await pg.route('**/generativelanguage.googleapis.com/**', google);
  await pg.goto(`${BASE}/index.html`);
  await pg.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 90000 });
  await pg.addStyleTag({ content: CSS + CAPTURA });
  await pg.evaluate(() => document.documentElement.classList.add('fm-captura'));
  // a su pantalla, como en la app
  await pg.evaluate(async (pa) => {
    const clic = (sel) => { const b = document.querySelector(sel); if (b) b.click(); return !!b; };
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const base = { rival: 'rivales', dinero: 'rivales' }[pa] || pa;
    clic(`.nav [data-ir="${base}"]`); await espera(250);
    if (pa === 'rivales') { clic('[data-seg="rivales:parte"]'); await espera(200); }
    if (pa === 'dinero') { clic('[data-seg="rivales:clasif"]'); await espera(300); const av = [...document.querySelectorAll('#vista *')].find((e) => /te ha dicho cu[aá]nto/i.test(e.textContent) && e.querySelector('button') && e.textContent.length < 400); const x = av && [...av.querySelectorAll('button')].pop(); if (x) x.click(); await espera(300); }
    if (pa === 'rival') { clic('.tabs [data-seg^="rivales:"]'); await espera(200); clic('#vista [data-r]'); for (let i = 0; i < 30 && !document.querySelector('.hoja.on'); i++) await espera(80); }
    await espera(500); window.scrollTo(0, 0);
  }, extra === 'chat' ? 'hoy' : p);
  await pg.waitForTimeout(500);
  // el aviso de la liga de ejemplo (la tarjeta ya dice que es la liga de ejemplo)
  await pg.evaluate(() => { for (const e of document.querySelectorAll('#vista .banda')) if (/datos inventados/.test(e.textContent)) e.remove(); });
  if (extra === 'ficha') {
    await pg.evaluate((n) => { const m = window.S.M.mias.find((x) => x.j && new RegExp(n, 'i').test(x.j.nombre)); const b = document.createElement('button'); b.dataset.j = m.pid; b.hidden = true; document.body.append(b); b.click(); b.remove(); }, process.env.FICHA || 'Bellingham');
    await pg.waitForFunction(() => document.querySelector('.hoja.on'), null, { timeout: 10000 });
    await pg.waitForTimeout(900);
  }
  if (extra === 'once') {
    await pg.evaluate((dy) => { const e = [...document.querySelectorAll('#vista h2, #vista h3, #vista .sec-t, #vista div, #vista span')].find((x) => x.children.length === 0 && /^tu once$/i.test(x.textContent.trim())); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - dy); }, +process.env.ONCE_Y || 150);
    await pg.waitForTimeout(700);
    await pg.evaluate(() => document.querySelector('.nav')?.classList.remove('nav-min'));
    await pg.waitForTimeout(500);
  }
  if (extra === 'tendencias') {
    await pg.evaluate(() => document.querySelector('[data-seg="mercado:tendencias"]')?.click());
    await pg.waitForTimeout(1500);
    await pg.evaluate(() => { scrollTo(0, 0); for (const t of document.querySelectorAll('#vista .tabs-in')) t.scrollLeft = 0; });
    await pg.waitForTimeout(400);
  }
  if (SINFOTOS) await pg.evaluate(() => document.documentElement.classList.add('sin-fotos'));
  if (extra === 'chat') {
    await pg.evaluate(() => document.querySelector('#bPregunta')?.click());
    await pg.waitForTimeout(900);
    const caja = await pg.$('.escribe textarea, #pregunta');
    await caja.fill(PREGUNTA);
    await pg.evaluate(() => { const b = document.querySelector('[data-accion="enviar"]'); b && b.click(); });
    await pg.waitForFunction(() => window.S && !window.S.charlando && document.querySelector('.msg.ia, .msg:not(.yo)'), null, { timeout: 40000 }).catch(() => console.log('OJO: el chat no ha acabado'));
    await pg.waitForTimeout(1200);
    await pg.evaluate(() => { document.activeElement?.blur?.(); const e = document.querySelector('.msg.yo'); const h = e && e.closest('.hoja-c, .hoja, .chat, #vista'); if (e) { const sc = (el) => { while (el && el.scrollHeight <= el.clientHeight + 2) el = el.parentElement; return el; }; const s = sc(e.parentElement); if (s && s !== document.body && s !== document.documentElement) s.scrollTop += e.getBoundingClientRect().top - s.getBoundingClientRect().top - 12; else window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 72); } });
  }
  // todas las imágenes a la vista cargadas
  await pg.waitForFunction(() => [...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width; }).every((i) => i.complete && i.naturalWidth), null, { timeout: 20000 }).catch(() => console.log('OJO: imágenes sin cargar en', nombre));
  await pg.evaluate(() => {
    document.querySelector('.nav')?.classList.remove('nav-min');
    const liga = document.querySelector('.sup-liga'), btns = document.querySelector('.sup-btns'); if (!liga || !btns) return;
    const caps = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'fm-capsula'; document.body.append(d); return d; });
    const W = innerWidth, caja = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el, '::before'), n = (v) => parseFloat(v) || 0; return [r.left + n(c.left), r.top + n(c.top), r.right - n(c.right), r.bottom - n(c.bottom)]; };
    [caja(liga), caja(btns)].forEach(([x0, y0, x1, y1], k) => { const iz = Math.min(60, Math.max(0, x0)), de = Math.min(60, Math.max(0, W - x1)), ar = Math.min(60, Math.max(0, y0)), ab = 60; caps[k].style.cssText = `left:${x0 - iz}px;top:${y0 - ar}px;width:${x1 - x0 + iz + de}px;height:${y1 - y0 + ar + ab}px;clip-path:inset(${ar}px ${de}px ${ab}px ${iz}px round 28px)`; });
  });
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${carpeta}/${nombre}.png` });
  console.log('hecha', nombre);
  await ctx.close();
}
await nav.close();
