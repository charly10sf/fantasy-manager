// (25 nov) Quien llega invitado, lo que caso-invitar.mjs no cubre (con el Worker de mentira de caso-invitar):
//   A. con el enlace ?inv=, el canje se hace solo al entrar en la liga (`invitarSiToca`);
//   B. desde Google Play (sin enlace): sale sola la ventana «¿Te ha invitado un amigo?» (hoja 'invitado'), y al cerrarla queda la
//      banda de arriba hasta que pone el código (que canjea, cierra la ventana y quita la banda);
//   C. «Nadie, la he encontrado yo» quita la banda para siempre;
//   D. quien invita ve su código grande y el mensaje que comparte lleva el código en su línea, en negrita de WhatsApp.
// Uso: node .github/ia/caso-invitado.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
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
const worker = async (ruta, cuerpo) => {
  const b = { uid: quien, cfg, ahora: reloj, dia: diaDe(reloj) };
  if (ruta === '/invitar') return invObjeto(st, { ...b, op: 'estado', primera });
  if (ruta === '/invitar/codigo') return invObjeto(st, { ...b, op: 'codigo' });
  if (ruta === '/invitar/canjear') return invObjeto(st, { ...b, op: 'canjear', cod: cuerpo.cod, enLiga: true, primera });
  if (ruta === '/invitar/rivales') return invObjeto(st, { ...b, op: 'rivales', i: cuerpo.i, liga: cuerpo.liga, tids: cuerpo.tids });
  return { ok: false, e: 'No existe' };
};

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
  ok(m.get('a|902') && m.get('a|902').por === '900', `A enlace: canje solo al entrar (${JSON.stringify(m.get('a|902'))})`);
  // B: Google Play, sin enlace, cuenta nueva 903: la ventana sola, la banda y la captura
  quien = '903';
  await page.evaluate(() => { window.S.D.yo = { ...window.S.D.yo, userId: '903' }; for (const k of ['fm-invitar','fm-inv-cod','fm-inv-preguntado','fm-inv-hecho','fm-inv-banda-cerrada']) localStorage.removeItem(k); });
  await page.evaluate(() => window.__inv({ ya: true }));
  await page.waitForTimeout(900);
  const t = await texto();
  ok(/¿Te ha invitado un amigo\?/.test(t) && !/Ganas tú/.test(t), `B Play: sale sola la ventana nueva (${t.slice(0, 120)})`);
  
  await page.fill('#invCod', 'zzzzzz'); await clic('[data-accion="canjearInv"]'); await page.waitForTimeout(500);
  ok(/no existe/i.test(await texto()), 'B: código que no existe, lo dice');
  
  await clic('[data-accion="cerrarHoja"]'); await page.waitForTimeout(400);
  const banda = await page.evaluate(() => document.querySelector('.banda-invitado')?.textContent || '');
  ok(/Te ha invitado un amigo/.test(banda), `B: la banda de arriba (${banda.trim()})`);
  await page.evaluate(() => window.scrollTo(0, 0));
  
  await clic('[data-accion="ponerCodigo"]'); await page.waitForTimeout(400);
  await page.fill('#invCod', cod.toLowerCase()); await clic('[data-accion="canjearInv"]'); await page.waitForTimeout(800);
  const tos = await page.evaluate(() => document.querySelector('.tostada.on')?.textContent || '');
  const fuera = await page.evaluate(() => ({ hoja: !!document.querySelector('.hoja.on, .hoja'), banda: !!document.querySelector('.banda-invitado') }));
  ok(m.get('a|903') && m.get('a|903').por === '900' && /invitación de tu amigo/.test(tos) && !fuera.banda, `B: desde la banda, canjea, se cierra y se va la banda (${JSON.stringify(fuera)})`);
  // C: «Nadie» quita la banda
  quien = '904';
  await page.evaluate(() => { window.S.D.yo = { ...window.S.D.yo, userId: '904' }; for (const k of ['fm-invitar','fm-inv-cod','fm-inv-preguntado','fm-inv-hecho','fm-inv-banda-cerrada']) localStorage.removeItem(k); });
  await page.evaluate(() => window.__inv({ ya: true })); await page.waitForTimeout(800);
  await clic('[data-accion="invitadoNo"]'); await page.waitForTimeout(400);
  await page.evaluate(() => window.__inv({ ya: true })); await page.waitForTimeout(600);
  ok(!(await page.evaluate(() => !!document.querySelector('.banda-invitado'))), 'C: «Nadie» quita la banda y no vuelve');
  // D: el que invita (900): su código grande y el mensaje
  quien = '900';
  await page.evaluate(() => { window.S.D.yo = { ...window.S.D.yo, userId: '900' }; localStorage.removeItem('fm-invitar'); });
  await clic('[data-accion="cerrarHoja"]'); await page.waitForTimeout(300);
  await accion('invitarAmigo'); await page.waitForTimeout(900);
  const t2 = await texto();
  ok(new RegExp(cod).test(t2) && /Copiar código/.test(t2), `D: el código grande en su ventana (${cod})`);
  
  const msg = await page.evaluate(async (c) => (await import('./js/invitar.js')).textoInv(c), cod);
  ok(msg.includes(`*${cod}*`) && /Mi código de invitación/.test(msg), 'D: el mensaje lleva el código en negrita');
  console.log('pedidos', pedidos.join(' '));
} catch (e) { ok(false, e.message); }
console.log('errores', errores);
await nav.close(); srv.close(); process.exit(mal ? 1 : 0);
