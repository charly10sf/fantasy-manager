// (19 nov) Invita a un amigo, en el navegador, con un Worker de mentira que usa la lógica de verdad (worker/src/invitar.js):
//   1. la entrada con ?inv=CODIGO guarda el código y lo quita de la barra;
//   2. «¿Te ha invitado alguien?» (Ajustes y su ventana) y meter el código;
//   3. el contador («Llevas 2 de 3…») y el aviso cuando entra un amigo;
//   4. elegir 2 rivales: su dinero queda abierto 24 h (limite.js) y la ventana del candado lleva «Invita a un amigo»;
//   5. los premios: la semana doble dobla los planes y preguntas de los textos y los 30 días sin intersticiales los quitan.
// Uso: node .github/ia/caso-invitar.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
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
await page.addInitScript(`if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)}); }`);
const texto = () => page.evaluate(() => (document.querySelector('.hoja') || {}).textContent?.replace(/\s+/g, ' ').trim() || '');
const tostada = () => page.evaluate(() => (document.querySelector('.tostada.on') || {}).textContent || '');
const accion = (a, d = {}) => page.evaluate(([a, d]) => { const b = document.createElement('button'); b.dataset.accion = a; Object.assign(b.dataset, d); document.body.appendChild(b); b.click(); b.remove(); }, [a, d]);
const clic = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);

try {
  // 1. la entrada con ?inv=
  await page.goto(`${BASE}/index.html?inv=ab-c234`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
  const e1 = await page.evaluate(() => ({ cod: JSON.parse(localStorage.getItem('fm-inv-cod') || 'null'), url: location.search }));
  ok(e1.cod && e1.cod.cod === 'ABC234' && !/inv=/.test(e1.url), `?inv= se guarda (${e1.cod && e1.cod.cod}) y sale de la barra (${e1.url || 'vacía'})`);
  // fuera de la liga de ejemplo: la cuenta 900 en la liga de la demo
  await page.evaluate(() => { localStorage.setItem('fm-demo', 'false'); window.S.D.demo = false; window.S.D.liga = { ...(window.S.D.liga || {}), id: '4455' }; });
  const L = (f) => page.evaluate(f);
  await L(async () => { const Li = await import('./js/limite.js'); Li.fijarLiga('4455'); Li.fijarYo({ nombre: 'X', teamId: '500', userId: '900', ligas: [] }, false); });

  // 2. el amigo (cuenta 901, nueva) mete el código del que invita (900)
  quien = '900';
  const cod = (await worker('/invitar/codigo', {})).cod;
  quien = '901';
  await page.evaluate(() => { window.S.D.yo = { ...window.S.D.yo, userId: '901' }; });
  await clic('[data-accion="ajustes"]');
  await page.waitForTimeout(300);
  ok(/Invita a un amigo/.test(await texto()), 'Ajustes lleva «Invita a un amigo»');
  await clic('[data-accion="invitarAmigo"]');
  await page.waitForFunction(() => /¿Te ha invitado alguien\?/.test(document.querySelector('.hoja')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/¿Te ha invitado alguien\?/.test(await texto()), 'a una cuenta nueva le sale «¿Te ha invitado alguien?»');
  await page.fill('#invCod', 'zzzzzz');
  await clic('[data-accion="canjearInv"]');
  await page.waitForTimeout(500);
  ok(/no existe/i.test(await texto()), 'un código que no existe: lo dice debajo');
  await page.fill('#invCod', cod.toLowerCase());
  await clic('[data-accion="canjearInv"]');
  await page.waitForTimeout(600);
  ok(/invitación de tu amigo/.test(await tostada()) && !/¿Te ha invitado alguien\?/.test(await texto()), `con el bueno (${cod}), entra y ya no se lo pregunta`);
  ok(m.get('a|901') && m.get('a|901').por === '900', 'el servidor apunta que a la 901 la invitó la 900');
  ok(!/premio|ganas/i.test(await L(async () => (await import('./js/invitar.js')).textoInv('ABC234'))), 'el mensaje que se comparte no le promete nada al amigo');

  // 3. el que invita (900): el aviso de que ha entrado y el contador
  quien = '900';
  await page.evaluate(() => { window.S.D.yo = { ...window.S.D.yo, userId: '900' }; localStorage.removeItem('fm-invitar'); });
  const r0 = await L(async () => { const I = await import('./js/invitar.js'); await I.leerInvitar('900', { ya: true }); return I.estadoInv('900'); });
  ok(r0.entran === 1 && r0.cuentan === 0, `la 900 ve 1 amigo dentro (${r0.entran}/${r0.cuentan})`);
  quien = '902'; await worker('/invitar/canjear', { cod });
  quien = '900';
  const r1 = await L(async () => { const I = await import('./js/invitar.js'); return I.leerInvitar('900', { ya: true }); });
  ok(r1.nuevos === 1, `entra otro amigo: aviso de 1 nuevo (${r1.nuevos})`);
  // vuelven otro día los dos
  reloj += 26 * 3600e3;
  for (const u of ['901', '902']) { quien = u; await worker('/invitar', {}); }
  quien = '900';
  await L(async () => { const I = await import('./js/invitar.js'); await I.leerInvitar('900', { ya: true }); });
  reloj -= 26 * 3600e3;
  const ct = await L(async () => (await import('./js/invitar.js')).contadorTxt());
  ok(ct === 'Llevas 2 de 3 para la semana doble', `el contador: «${ct}»`);

  // 4. elegir rivales (los plazos son de la hora de entrar, que en la página va con el reloj de verdad)
  await accion('invitarAmigo');
  await page.waitForFunction(() => /elige 2 rivales/.test(document.querySelector('.hoja')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Tu amigo ya ha entrado: elige 2 rivales/.test(await texto()), 'la ventana dice «Tu amigo ya ha entrado: elige 2 rivales»');
  ok(/Llevas 2 de 3/.test(await texto()), 'y el contador');
  const tids = await page.evaluate(() => [...document.querySelectorAll('.inv-elegir')[0].querySelectorAll('[data-accion="invElegir"]')].slice(0, 3).map((b) => b.dataset.tid));
  for (const t of tids) await clic(`.inv-elegir [data-accion="invElegir"][data-tid="${t}"]`);
  const elegidos = await page.evaluate(() => [...document.querySelectorAll('.inv-elegir')[0].querySelectorAll('.pill.on')].map((b) => b.dataset.tid));
  ok(elegidos.length === 2, `como mucho 2 elegidos a la vez (${elegidos.join(', ')})`);
  await clic('.inv-elegir [data-accion="invAbrir"]');
  await page.waitForTimeout(700);
  const ab = await L(async () => { const Li = await import('./js/limite.js'); return { ab: Li.rivalesAbiertos(), bloq: Li.bloqueada('dineroRivales', window.S.M.rivales.find((r) => Li.rivalesAbiertos().includes(String(r.e.teamId)))?.e.teamId), hasta: Li.rivalAbiertoHasta(Li.rivalesAbiertos()[0]) }; });
  ok(elegidos.every((t) => ab.ab.includes(t)) && ab.bloq === false, `su dinero, abierto (${ab.ab.join(', ')})`);
  ok(Math.abs(ab.hasta - (m.get('k|900').inv[0].t + 24 * 3600e3)) < 1000, '24 h desde que entró el amigo, no desde que eliges');
  ok(/abierto/i.test(await tostada()), `y lo dice: «${await tostada()}»`);
  // la ventana del candado (en la web) lleva «Invita a un amigo»
  await clic('[data-accion="cerrarHoja"]');
  await page.waitForTimeout(300);
  await accion('bloqueada', { clave: 'dineroRivales' });
  await page.waitForTimeout(400);
  ok(/Invita a un amigo|Elegir rivales/.test(await texto()), 'la ventana del candado del dinero lleva «Invita a un amigo»');

  // 5. los premios
  const pr = await L(async () => {
    const I = await import('./js/invitar.js'), Li = await import('./js/limite.js');
    const g = JSON.parse(localStorage.getItem('fm-invitar'));
    const antes = { p: Li.planesCfg().gratis, q: Li.preguntasCfg().gratis };
    g.est.premios = { doble: { desde: Date.now(), hasta: Date.now() + 7 * 864e5 } };
    localStorage.setItem('fm-invitar', JSON.stringify(g));
    const doble = { p: Li.planesCfg().gratis, q: Li.preguntasCfg().gratis };
    Li.fijarYo({ nombre: 'X', teamId: '500', userId: '900', ligas: [] }, false);
    const conInter = Li.intersticialParaMi();
    g.est.premios.sinIntersticiales = { desde: Date.now(), hasta: Date.now() + 30 * 864e5 };
    localStorage.setItem('fm-invitar', JSON.stringify(g));
    return { antes, doble, conInter, sinInter: Li.intersticialParaMi(), sin: I.sinIntersticiales() };
  });
  ok(pr.doble.p === pr.antes.p * 2 && pr.doble.q === pr.antes.q * 2, `semana doble: planes ${pr.antes.p}→${pr.doble.p}, preguntas ${pr.antes.q}→${pr.doble.q}`);
  ok(pr.sin && (pr.conInter === false || pr.sinInter === false) && pr.sinInter === false, `30 días sin intersticiales (antes ${pr.conInter}, ahora ${pr.sinInter})`);
  ok(!errores.length, `sin errores en la página${errores.length ? `: ${errores[0]}` : ''}`);
} catch (e) { ok(false, `se ha parado: ${e.message}`); }
await nav.close(); srv.close();
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
