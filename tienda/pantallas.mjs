// Las pantallas de dentro de las tarjetas de las tiendas: la maqueta del rediseño «Liquid» (capa Mezcla) con la liga de
// ejemplo. Con la web de la rama `rediseno-maqueta` servida en 127.0.0.1:8765 (python3 -m http.server dentro de web/):
//   CARAS=caras.json node pantallas.mjs <carpeta> <ancho> <alto> [sinfotos] [solo=hoy,mercado…]
// Cuando el rediseño esté en la app, BASE apunta a la app de verdad y `ruta` deja de ir por la maqueta (ver «APP»).
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
  ['rival', 'rival', true, 0],
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
  /* fallo de main (ESTADO.md, punto del rediseño): «antes de mañana a las 14:0(» salía cortado; el rediseño lo arregla */
  .pp-cu { flex: none !important; overflow: visible !important; }
`;

const google = async (route) => {
  const url = route.request().url();
  if (/\/models\?/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] }] }) });
  const tr = []; for (let i = 0; i < RESPUESTA.length; i += 120) tr.push(RESPUESTA.slice(i, i + 120));
  const pieza = (t, fin) => 'data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: t }] }, ...(fin ? { finishReason: fin } : {}) }], usageMetadata: { promptTokenCount: 9000, candidatesTokenCount: 220 } }) + '\r\n\r\n';
  if (/alt=sse/.test(url)) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: tr.map((t, i) => pieza(t, i === tr.length - 1 ? 'STOP' : null)).join('') });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: RESPUESTA }] }, finishReason: 'STOP' }] }) });
};

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const nav = await pw.chromium.launch({ proxy });
for (const [nombre, p, top, , extra] of PANTALLAS) {
  if (solo && !solo.includes(nombre)) continue;
  const ctx = await nav.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await ctx.addInitScript((c) => { try { localStorage.setItem('fm-prueba', '1'); localStorage.setItem('fm-sin-tema', '1'); if (c) localStorage.setItem('fm-caras-demo', c); } catch (e) { /* nada */ } }, SINFOTOS ? null : caras);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('ERROR', nombre, e.message));
  await pg.route('**/generativelanguage.googleapis.com/**', google);
  const q = `dentro=1&d=M&p=${extra === 'chat' ? 'hoy' : p}&cap=1${top ? '&top=1' : ''}`;
  await pg.goto(`${BASE}/maqueta-liquid.html?${q}`);
  await pg.waitForFunction(() => document.documentElement.classList.contains('maq-lista'), null, { timeout: 90000 });
  await pg.addStyleTag({ content: CSS });
  // el aviso de la liga de ejemplo (la tarjeta ya dice que es la liga de ejemplo)
  await pg.evaluate(() => { for (const e of document.querySelectorAll('#vista .banda')) if (/datos inventados/.test(e.textContent)) e.remove(); });
  if (extra === 'ficha') {
    await pg.evaluate((n) => { const m = window.S.M.mias.find((x) => x.j && new RegExp(n, 'i').test(x.j.nombre)); const b = document.createElement('button'); b.dataset.j = m.pid; b.hidden = true; document.body.append(b); b.click(); b.remove(); }, process.env.FICHA || 'Bellingham');
    await pg.waitForFunction(() => document.querySelector('.hoja.on'), null, { timeout: 10000 });
    await pg.waitForTimeout(900);
  }
  if (extra === 'once') {
    await pg.evaluate(() => { const e = [...document.querySelectorAll('#vista h2, #vista h3, #vista .sec-t, #vista div, #vista span')].find((x) => x.children.length === 0 && /^tu once$/i.test(x.textContent.trim())); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 150); });
    await pg.waitForTimeout(700);
    await pg.evaluate(() => document.documentElement.classList.remove('nav-min'));
    await pg.waitForTimeout(500);
  }
  if (extra === 'tendencias') {
    await pg.evaluate(() => document.querySelector('[data-seg="mercado:tendencias"]')?.click());
    await pg.waitForTimeout(1500);
    await pg.evaluate(() => scrollTo(0, 0));
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
    await pg.evaluate(() => { document.activeElement?.blur?.(); const e = document.querySelector('.msg.yo'); const h = e && e.closest('.hoja-c, .hoja, .chat, #vista'); if (e) { const sc = (el) => { while (el && el.scrollHeight <= el.clientHeight + 2) el = el.parentElement; return el; }; const s = sc(e.parentElement); if (s && s !== document.body && s !== document.documentElement) s.scrollTop += e.getBoundingClientRect().top - s.getBoundingClientRect().top - 12; else window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 90); } });
  }
  // todas las imágenes a la vista cargadas
  await pg.waitForFunction(() => [...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width; }).every((i) => i.complete && i.naturalWidth), null, { timeout: 20000 }).catch(() => console.log('OJO: imágenes sin cargar en', nombre));
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${carpeta}/${nombre}.png` });
  console.log('hecha', nombre);
  await ctx.close();
}
await nav.close();
