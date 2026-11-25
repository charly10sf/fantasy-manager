// (25 nov) Quien llega invitado, lo que caso-invitar.mjs no cubre (con el Worker de mentira, que usa worker/src/invitar.js):
//   A. con el enlace ?inv=, el canje se hace solo al entrar en la liga (`invitarSiToca`, vía «enlace»);
//   B. una cuenta nueva SIN pistas (nadie de su liga con código, no abrió ningún enlace): ni ventana ni banda, solo Ajustes;
//   C. alguien de su liga ha sacado código: sale sola la ventana «¿Te ha invitado un amigo?» y, al cerrarla, la banda de
//      arriba hasta que pone el código (canjea, cierra y quita la banda); «Nadie, la he encontrado yo» la quita para siempre;
//   D. abrió el enlace desde su misma conexión hace poco: «Tu amigo te ha invitado» con el código ya puesto (vía «propuesto»);
//   E. quien invita ve su código grande y el mensaje que comparte lleva el código en su línea, en negrita de WhatsApp;
//   F. la web de un Android con ?inv=: la tarjeta con el código, que avisa de la llegada, lo copia y abre Google Play con el
//      código en el referrer; en el iPhone y el ordenador no sale.
// Uso: node .github/ia/caso-invitado.mjs   (PW_MODULO como en prueba-web.mjs; CAPTURAS=carpeta deja dos capturas). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invObjeto, cfgInvitar } from '../../worker/src/invitar.js';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer(async (q, r) => {
  const ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const b = await readFile(join(WEB, ruta.endsWith('/') ? `${ruta}index.html` : ruta)); r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
let mal = 0;
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) mal++; };

// el objeto del Worker, en memoria; `quien` es la cuenta que llama
const m = new Map();
const st = { get: async (k) => m.get(k), put: async (k, v) => m.set(k, v), delete: async (k) => m.delete(k), list: async ({ prefix }) => new Map([...m].filter(([k]) => k.startsWith(prefix))) };
const cfg = cfgInvitar({});
let quien = '900', primera = 0, reloj = Date.now();
const diaDe = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
let ids = [], red = 'a'.repeat(64);
const worker = async (ruta, cuerpo) => {
  const b = { uid: quien, cfg, ahora: reloj, dia: diaDe(reloj) };
  if (ruta === '/invitar') {
    const est = await invObjeto(st, { ...b, op: 'estado', primera });
    if (est.puedeCanjear) { const p = await invObjeto(st, { ...b, op: 'pista', red, ids }); est.propuesto = p.propuesto; est.ligaInvita = p.ligaInvita; }
    return est;
  }
  if (ruta === '/invitar/llega') return invObjeto(st, { ...b, op: 'llega', cod: cuerpo.cod, paso: cuerpo.paso, red });
  if (ruta === '/invitar/codigo') return invObjeto(st, { ...b, op: 'codigo' });
  if (ruta === '/invitar/canjear') return invObjeto(st, { ...b, op: 'canjear', cod: cuerpo.cod, via: cuerpo.via, enLiga: true, primera });
  if (ruta === '/invitar/rivales') return invObjeto(st, { ...b, op: 'rivales', i: cuerpo.i, liga: cuerpo.liga, tids: cuerpo.tids });
  return { ok: false, e: 'No existe' };
};
const cnt = () => Object.values(m.get('cnt') || {}).reduce((x, d) => { for (const [k, v] of Object.entries(d)) x[k] = (x[k] || 0) + v; return x; }, {});

const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
const pedidos = [];
await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', async (r) => {
  const q = r.request();
  if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  const u = new URL(q.url());
  if (!u.pathname.startsWith('/invitar')) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
  const cuerpo = JSON.parse(q.postData() || '{}');
  if (q.method() === 'GET') pedidos.push(u.search);
  pedidos.push(u.pathname);
  const j = await worker(u.pathname, cuerpo);
  return r.fulfill({ status: j.ok === false ? 400 : 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(j) });
});
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
await page.route('**/js/app.js*', async (r) => { const res = await r.fetch(); const t = await res.text(); r.fulfill({ response: res, body: t + '\nwindow.__inv = invitarSiToca;' }); });
await page.addInitScript(`if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-beta-aviso', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)}); }`);
const accion = (a, d = {}) => page.evaluate(([a, d]) => { const b = document.createElement('button'); b.dataset.accion = a; Object.assign(b.dataset, d); document.body.appendChild(b); b.click(); b.remove(); }, [a, d]);
const clic = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
const texto = () => page.evaluate(() => (document.querySelector('.hoja') || {}).textContent?.replace(/\s+/g, ' ').trim() || '');
try {
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M && window.__inv, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.setItem('fm-demo', 'false'); window.S.D.demo = false; window.S.D.liga = { ...(window.S.D.liga || {}), id: '4455' }; });
  quien = '900';
  const cod = (await worker('/invitar/codigo', {})).cod;
  // A: llega con el enlace (web), cuenta nueva 902
  quien = '902';
  await page.evaluate((c) => { window.S.D.yo = { ...window.S.D.yo, userId: '902' }; localStorage.removeItem('fm-invitar'); localStorage.setItem('fm-inv-cod', JSON.stringify({ cod: c, t: Date.now() })); window.S.hoja = null; }, cod);
  await page.evaluate(() => window.__inv({ ya: true }));
  await page.waitForTimeout(800);
  ok(m.get('a|902') && m.get('a|902').por === '900' && cnt().canje_enlace === 1, `A enlace: canje solo al entrar (${JSON.stringify(cnt())})`);
  ok(pedidos.includes('?liga=4455'), 'A: el estado se pide con la liga');
  const limpio = (u) => page.evaluate((u) => { window.S.D.yo = { ...window.S.D.yo, userId: u }; for (const k of ['fm-invitar', 'fm-inv-cod', 'fm-inv-preguntado', 'fm-inv-hecho', 'fm-inv-banda-cerrada']) localStorage.removeItem(k); }, u);
  const hayBanda = () => page.evaluate(() => !!document.querySelector('.banda-invitado'));
  // B: Google Play, sin pistas: nada
  quien = '903'; ids = ['600', '601']; red = 'b'.repeat(64);
  await limpio('903');
  await page.evaluate(() => window.__inv({ ya: true }));
  await page.waitForTimeout(800);
  ok(!(await texto()) && !(await hayBanda()), 'B sin pistas: ni ventana ni banda');
  await clic('[data-accion="ajustes"]'); await page.waitForTimeout(300);
  ok(/¿Te ha invitado alguien\?/.test(await texto()), 'B: en Ajustes sí puede ponerlo');
  await clic('[data-accion="cerrarHoja"]'); await page.waitForTimeout(300);
  // C: alguien de su liga (900) tiene código
  quien = '904'; ids = ['600', '900'];
  await limpio('904');
  await page.evaluate(() => window.__inv({ ya: true }));
  await page.waitForTimeout(900);
  const t = await texto();
  ok(/¿Te ha invitado un amigo\?/.test(t) && !/Ganas tú/.test(t) && !(await page.inputValue('#invCod')), `C liga: sale sola la ventana, vacía (${t.slice(0, 90)})`);
  await page.fill('#invCod', 'zzzzzz'); await clic('[data-accion="canjearInv"]'); await page.waitForTimeout(500);
  ok(/no existe/i.test(await texto()), 'C: código que no existe, lo dice');
  await clic('[data-accion="cerrarHoja"]'); await page.waitForTimeout(400);
  ok(await hayBanda(), 'C: al cerrarla, la banda de arriba');
  await clic('[data-accion="ponerCodigo"]'); await page.waitForTimeout(400);
  await page.fill('#invCod', cod.toLowerCase()); await clic('[data-accion="canjearInv"]'); await page.waitForTimeout(800);
  ok(m.get('a|904') && m.get('a|904').por === '900' && !(await hayBanda()) && !(await texto()) && cnt().canje_escrito === 1, `C: desde la banda canjea (escrito), se cierra y se va la banda (${JSON.stringify(cnt())})`);
  quien = '905';
  await limpio('905');
  await page.evaluate(() => window.__inv({ ya: true })); await page.waitForTimeout(800);
  await clic('[data-accion="invitadoNo"]'); await page.waitForTimeout(400);
  await page.evaluate(() => window.__inv({ ya: true })); await page.waitForTimeout(600);
  ok(!(await hayBanda()) && !(await texto()), 'C: «Nadie» quita la banda y no vuelve');
  // D: abrió el enlace desde esta conexión hace poco: el código ya puesto
  quien = '906'; ids = []; red = 'c'.repeat(64);
  await worker('/invitar/llega', { cod });
  await limpio('906');
  await page.evaluate(() => window.__inv({ ya: true })); await page.waitForTimeout(900);
  const td = await texto();
  ok(/Tu amigo te ha invitado/.test(td) && (await page.inputValue('#invCod')) === cod, `D propuesto: la ventana con el código ya puesto (${await page.inputValue('#invCod')})`);
  if (process.env.CAPTURAS) { await page.evaluate(() => document.querySelectorAll('.tostada').forEach((x) => x.remove())); await page.screenshot({ path: `${process.env.CAPTURAS}/propuesto.png` }); }
  await clic('[data-accion="canjearInv"]'); await page.waitForTimeout(800);
  ok(m.get('a|906') && m.get('a|906').por === '900' && cnt().canje_propuesto === 1 && !(await texto()), `D: «Listo» y dentro, como propuesto (${JSON.stringify(cnt())})`);
  // E: el que invita (900): su código grande y el mensaje
  quien = '900';
  await page.evaluate(() => { window.S.D.yo = { ...window.S.D.yo, userId: '900' }; localStorage.removeItem('fm-invitar'); });
  await accion('invitarAmigo'); await page.waitForTimeout(900);
  const t2 = await texto();
  ok(new RegExp(cod).test(t2) && /Copiar código/.test(t2), `E: el código grande en su ventana (${cod})`);
  const msg = await page.evaluate(async (c) => (await import('./js/invitar.js')).textoInv(c), cod);
  ok(msg.includes(`*${cod}*`) && /Mi código de invitación/.test(msg), 'E: el mensaje lleva el código en negrita');
  // F: la llegada a la web con ?inv= en un Android, un iPhone y un ordenador (sin sesión)
  for (const [disp, ua] of [['android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'], ['iphone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'], ['pc', '']]) {
    const c2 = await nav.newContext({ viewport: { width: 390, height: 844 }, ...(ua ? { userAgent: ua } : {}), timezoneId: 'Europe/Madrid', locale: 'es-ES' });
    await c2.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }).catch(() => {});
    const llegadas = [];
    await c2.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
    await c2.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', async (r) => {
      const q = r.request();
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      const u = new URL(q.url());
      if (u.pathname === '/invitar/llega') llegadas.push(JSON.parse(q.postData() || '{}').paso || 'llega');
      return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
    });
    let aPlay = '';
    await c2.route('https://play.google.com/**', (r) => { aPlay = r.request().url(); return r.fulfill({ status: 200, body: 'play' }); });
    const p2 = await c2.newPage();
    await p2.addInitScript(`localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev');`);
    await p2.goto(`${BASE}/index.html?inv=${cod.toLowerCase()}`);
    await p2.waitForTimeout(2500);
    const hay = await p2.evaluate(() => document.querySelector('.inv-llega')?.textContent.replace(/\s+/g, ' ').trim() || '');
    if (disp === 'android') {
      ok(hay.includes(cod) && /Copiar el código y descargar/.test(hay), `F android: la tarjeta con el código (${hay.slice(0, 80)})`);
      ok(llegadas.join() === 'llega', `F android: avisa de la llegada una vez (${llegadas})`);
      if (process.env.CAPTURAS) await p2.screenshot({ path: `${process.env.CAPTURAS}/llegada-android.png` });
      await p2.click('[data-accion="invCopiarPlay"]'); await p2.waitForTimeout(1200);
      ok(aPlay.includes('id=es.fantasymanager.app') && aPlay.includes(`referrer=inv%3D${cod}`) && llegadas.includes('copia'), `F android: copia y abre Google Play con el código (${aPlay.split('?')[1]})`);
    } else ok(!hay, `F ${disp}: sin tarjeta (se canjea solo al entrar)`);
    await c2.close();
  }
  console.log('pedidos', pedidos.join(' '));
} catch (e) { ok(false, e.message); }
console.log('errores', errores);
await nav.close(); srv.close(); process.exit(mal ? 1 : 0);
