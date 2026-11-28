// La tarjeta del dinero de cada rival, desde la ficha de uno (0.9d: la tarjeta de arriba con el desglose y los movimientos)
import fs from 'node:fs';
const pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs');
const [, , salida = '/tmp/t3/rival.png', W = '393', H = '852', modo = ''] = process.argv;
const RIVAL = process.env.RIVAL || 'Hércules';
const caras = fs.readFileSync('/tmp/t3/caras.json', 'utf8');
const CSS = `#vista, #vista *, .hoja, .hoja * { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }
 #vista .fila { content-visibility: visible !important; } .tour, .beta, .sello-beta, [class*="beta"] { display: none !important; }`;
const CAPTURA = fs.readFileSync('/home/claude/fm/.github/liquid/captura.css', 'utf8');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const nav = await pw.chromium.launch({ proxy });
const ctx = await nav.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript((c) => { localStorage.setItem('fm-prueba', '1'); localStorage.setItem('fm-sin-tema', '1'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-beta-aviso', String(Date.now())); if (c) localStorage.setItem('fm-caras-demo', c); }, modo === 'sinfotos' ? null : caras);
await ctx.clock.install({ time: new Date(process.env.RELOJ || '2026-11-27T17:40:00Z') });
const pg = await ctx.newPage();
// (solo para la foto) el equipo con otro nombre y unas semanas de mercado más, para que su saldo tenga historia
const NOMBRE = process.env.NOMBRE || 'FC Bayern de los Caídos';
await pg.route('**/js/demo.js*', async (route) => { const r = await route.fetch(); let t = await r.text();
  t = t.replace("['Rayo Vallekano', 'Iván']", `['${NOMBRE}', 'Iván']`);
  t = t.replace('  void nombres;', `  { const q = clasif.find((e) => e.nombre === '${NOMBRE}'); if (q) { const suyos = plantillas[q.teamId] || [];
    const plan = [[13.6, 31, 0], [12.2, 33, 1], [11.1, 31, 1], [9.8, 33, 2], [8.4, 32, 2], [7.3, 33, 3], [6.1, 31, 3], [5.2, 33, 4]];
    plan.forEach(([d, tipo, k], j) => { const baratos = libresDemo.filter((p) => maestro[p].valor < 12e6); const pid = tipo === 33 ? baratos[(k * 7 + 3) % baratos.length] : suyos[k % suyos.length].pid; const otro = tipo === 32 ? clasif.find((e) => e !== q && !e.esYo) : null;
      actividad.push({ id: 'fb' + j, t: ahora - d * DIA - 3 * HORA, tipo, clase: { 31: 'compra', 32: 'clausula', 33: 'venta' }[tipo], quien: q.manager, quienId: q.userId, otro: otro ? otro.manager : '', otroId: otro ? otro.userId : '', pid, jugador: maestro[pid].nombre, importe: Math.round(maestro[pid].valor * (tipo === 33 ? 1 : 1.12)), texto: '' }); }); } }
  void nombres;`);
  return route.fulfill({ response: r, body: t }); });
pg.on('pageerror', (e) => console.log('ERROR', e.message));
await pg.goto('http://127.0.0.1:8765/index.html');
await pg.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 90000 });
await pg.addStyleTag({ content: CSS + CAPTURA });
await pg.evaluate(() => document.documentElement.classList.add('fm-captura'));
await pg.evaluate(async ([n, DES]) => {
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  document.querySelector('.nav [data-ir="rivales"]')?.click(); await espera(400);
  const fila = [...document.querySelectorAll('#vista [data-r]')].find((e) => e.textContent.includes(n));
  fila?.click(); for (let i = 0; i < 30 && !document.querySelector('.hoja.on'); i++) await espera(80);
  await espera(500);
  const ver = [...document.querySelectorAll('.hoja.on button, .hoja.on [data-accion]')].find((b) => /ver el desglose/i.test(b.textContent));
  if (DES) { ver?.click(); await espera(800); }
}, [RIVAL, !!process.env.DESGLOSE]);
if (modo === 'sinfotos') await pg.evaluate(() => document.documentElement.classList.add('sin-fotos'));
const info = await pg.evaluate(() => { const h = document.querySelector('.hoja.on'); return h ? h.innerText.slice(0, 2500) : 'sin hoja'; });
if (process.env.VER) console.log(info);
// desplazar dentro de la hoja si se pide
if (process.env.HASTA) await pg.evaluate(([t, dy]) => { const h = document.querySelector('.hoja.on'); const el = [...h.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim().toUpperCase() === t); const sc = [h, ...h.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - dy; }, [process.env.HASTA, +(process.env.DY || 20)]);
await pg.waitForTimeout(900);
await pg.screenshot({ path: salida });
await nav.close();
