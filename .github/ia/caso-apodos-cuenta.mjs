// (19 nov) Los apodos de los rivales en todos los dispositivos: dos navegadores con la misma cuenta y un Worker de mentira
// con la lógica de verdad (worker/src/apodos.js). Lo que pones en uno sale en el otro, gana el cambio más reciente, borrar
// también llega y sin red se sigue igual (se sube al volver la red).
// Uso: node .github/ia/caso-apodos-cuenta.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apodosObjeto } from '../../worker/src/apodos.js';

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

// el objeto de la cuenta, en memoria (los dos navegadores son la misma cuenta)
const m = new Map();
const st = { get: async (k) => m.get(k), put: async (k, v) => m.set(k, v), delete: async (k) => m.delete(k), deleteAll: async () => m.clear(), list: async ({ prefix }) => new Map([...m].filter(([k]) => k.startsWith(prefix))) };
let sinRed = false, llamadas = 0;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
async function navegador() {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname !== '/apodos') return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
    if (sinRed) return r.abort('internetdisconnected');
    llamadas++; if (process.env.DEPURA) console.log('llamada', q.method(), q.postData());
    const b = q.method() === 'GET' ? { op: 'leer', liga: u.searchParams.get('liga') } : { op: 'juntar', ...JSON.parse(q.postData() || '{}') };
    const j = await apodosObjeto(st, { ...b, ahora: Date.now() });
    return r.fulfill({ status: j.ok ? 200 : 400, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(`if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)}); }`);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
  // fuera de la liga de ejemplo (la misma cuenta y la misma liga en los dos)
  await page.evaluate(() => { localStorage.setItem('fm-demo', 'false'); });
  return { ctx, page, errores };
}
const A = await navegador(), B = await navegador();
const en = (P, f, x) => P.page.evaluate(f, x);
const poner = (P, tid, v) => en(P, async ([tid, v]) => { const Ap = await import('./js/apodos.js'); Ap.ponerApodo(tid, v); }, [tid, v]);
const sinc = (P) => en(P, async () => { const Ap = await import('./js/apodos.js'); return Ap.sincronizarApodos('4455', { ya: true }); });
const ver = (P) => en(P, async () => (await import('./js/apodos.js')).apodosLiga());
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
try {
  // A pone dos apodos: se suben solos al rato
  await en(A, async () => { const Ap = await import('./js/apodos.js'); await Ap.sincronizarApodos('4455', { ya: true }); });
  await poner(A, '508', 'el Tito, Titón'); await poner(A, '510', 'Leao');
  await espera(2500);
  ok(m.get('l|4455') && m.get('l|4455')['508'].v === 'el Tito, Titón' && m.get('l|4455')['510'].v === 'Leao', 'A los pone y se suben solos');
  // B (otro navegador, misma cuenta) los baja al entrar
  const cambiaB = await sinc(B);
  let vb = await ver(B);
  ok(cambiaB && vb['508'] === 'el Tito, Titón' && vb['510'] === 'Leao', `B los ve: ${JSON.stringify(vb)}`);
  // conflicto: B cambia el 508 más tarde; A lo cambia antes sin subir (sin red) → al juntar gana el de B
  sinRed = true;
  await poner(A, '508', 'Titi');
  await espera(1800);
  ok((await ver(A))['508'] === 'Titi', 'sin red, A sigue con lo suyo');
  sinRed = false;
  await espera(50);
  await poner(B, '508', 'Tito Grande');
  await espera(2500);
  await sinc(A);
  ok((await ver(A))['508'] === 'Tito Grande', `gana el cambio más reciente (el de B): ${(await ver(A))['508']}`);
  // A pone uno nuevo sin red: queda pendiente y se sube con la siguiente
  sinRed = true;
  await poner(A, '512', 'el Cholo');
  await espera(1800);
  ok(!m.get('l|4455')['512'] && (await en(A, () => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /^fm-apodos-pend/.test(k)) || 'null')))) === true, 'sin red: se queda pendiente');
  sinRed = false;
  await sinc(A);
  ok(m.get('l|4455')['512'] && m.get('l|4455')['512'].v === 'el Cholo', 'con red otra vez, se sube');
  // borrar en A llega a B
  await poner(A, '510', '');
  await espera(2500);
  await sinc(B);
  vb = await ver(B);
  ok(!vb['510'] && vb['512'] === 'el Cholo' && vb['508'] === 'Tito Grande', `borrar en uno lo borra en el otro: ${JSON.stringify(vb)}`);
  // en la liga de ejemplo no se manda nada
  const antes = llamadas;
  await en(A, async () => { localStorage.setItem('fm-demo', 'true'); const Ap = await import('./js/apodos.js'); Ap.ponerApodo('501', 'Demo'); await Ap.sincronizarApodos('4455', { ya: true }); localStorage.setItem('fm-demo', 'false'); });
  await espera(1800);
  ok(llamadas === antes, 'con la liga de ejemplo no va nada al servidor');
  ok(!A.errores.length && !B.errores.length, `sin errores en la página${A.errores.length || B.errores.length ? `: ${[...A.errores, ...B.errores][0]}` : ''}`);
} catch (e) { ok(false, `se ha parado: ${e.message}`); }
await nav.close(); srv.close();
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
