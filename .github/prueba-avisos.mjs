// La pantalla de los avisos de fallo y «Quién usa la app» según quién mira (0.8.4). Un servidor de mentira para el Worker
// (/fallos/*, /hola) y la web de verdad, en el móvil y en el ordenador:
//  (a) quien ayuda con los fallos (Domy; `ve` del servidor): en Ajustes, «Avisos de fallo» y «Quién usa la app»; en los
//      avisos, la bandeja de todos con sus capturas, sin el diagnóstico, sin «Copiar avisos» y sin poder contestar
//  (b) el dueño: lo de siempre (contesta, ve el diagnóstico y «Copiar avisos»)
//  (c) cualquier otro: solo «Reportar un fallo o una idea» y sus avisos
// Uso: node .github/prueba-avisos.mjs   (PW_MODULO y CHROME como en prueba-web.mjs). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = http.createServer(async (q, r) => {
  const ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const b = await readFile(join(WEB, ruta.endsWith('/') ? `${ruta}index.html` : ruta)); r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
let mal = 0;
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) mal++; };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
const CAPTURA = `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='}`;
// el servidor de mentira: un aviso de otro (con diagnóstico y una captura) y lo que cada papel puede ver
function servidor(papel) {
  const aviso = { id: 'abc123def', t: Date.now() - 3600e3, quien: 'Pepe', equipo: 'Los Pepes', liga: 'Liga X', texto: 'Al abrir Mercado se queda en blanco', diag: 'LaLiga 200 · lo de Pepe', app: '0.8.4 · web', respuesta: null, respondida: null, vista: true, capturas: 1 };
  const admin = papel === 'dueño', ve = admin || papel === 'ayuda';
  return async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const json = (x, s = 200) => r.fulfill({ status: s, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(x) });
    if (u.pathname === '/hola') return json({ ok: true, admin, ve, ev: false });
    if (u.pathname === '/fallos/mios') return json({ lista: [], admin, ve, pendientes: admin ? 1 : null, yo: '1' });
    if (!ve) return json({ e: 'Solo para el dueño de la app' }, 403);
    if (u.pathname === '/fallos/todos') return json({ lista: [{ id: aviso.id, t: aviso.t, quien: aviso.quien, equipo: aviso.equipo, txt: aviso.texto, r: 0, v: 1, c: 1 }] });
    if (u.pathname === '/fallos/uno') { const { diag, ...sin } = aviso; return json(admin ? aviso : sin); }
    if (u.pathname === '/fallos/captura') return json({ img: CAPTURA });
    return json({ ok: true });
  };
}
async function pagina(papel, movil) {
  const ctx = await nav.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 860 }, timezoneId: 'Europe/Madrid', locale: 'es-ES', ...(movil ? { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36', isMobile: true, hasTouch: true } : {}) });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', servidor(papel));
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(`if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)}); }`);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
  // fuera de la liga de ejemplo, con la sesión puesta; lo que diga /hola (el papel) se apunta como al abrir la app
  await page.evaluate(async () => { localStorage.setItem('fm-demo', 'false'); const So = await import('./js/soporte.js'); await So.saludar({ v: 'x', canal: 'web' }); });
  return { ctx, page, errores };
}
const accion = (page, a, extra = {}) => page.evaluate(([x, e]) => { const b = document.createElement('button'); b.dataset.accion = x; Object.assign(b.dataset, e); document.body.appendChild(b); b.click(); b.remove(); }, [a, extra]);
// (textContent: lo de las secciones plegadas de Ajustes también cuenta)
const hojaTxt = (page) => page.evaluate(() => (document.querySelector('.hoja') || document.body).textContent.replace(/\s+/g, ' '));

try {
  for (const movil of [true, false]) {
    const donde = movil ? 'móvil' : 'ordenador';
    /* (a) quien ayuda */
    {
      const { ctx, page, errores } = await pagina('ayuda', movil);
      await accion(page, 'ajustes'); await page.waitForTimeout(400);
      let t = await hojaTxt(page);
      ok(/Avisos de fallo/.test(t) && /Los de todos/.test(t) && /Quién usa la app/.test(t) && /Para ayudar con los fallos/.test(t) && !/Reportar un fallo o una idea/.test(t), `(a) ${donde}: quien ayuda tiene en Ajustes «Avisos de fallo» y «Quién usa la app»`);
      await accion(page, 'avisos'); await page.waitForTimeout(900);
      t = await hojaTxt(page);
      ok(/Avisos recibidos/.test(t) && /Pepe/.test(t) && !/Copiar avisos/.test(t), `(a) ${donde}: la bandeja de todos, sin «Copiar avisos»`);
      await accion(page, 'abrirAviso', { id: 'abc123def' }); await page.waitForTimeout(900);
      t = await hojaTxt(page);
      const r = await page.evaluate(() => ({ resp: !!document.querySelector('#respTxt'), boton: !!document.querySelector('[data-accion="responderAviso"]'), img: !!document.querySelector('.aviso-capt img') }));
      ok(/se queda en blanco/.test(t) && r.img && !r.resp && !r.boton && !/Diagnóstico/.test(t), `(a) ${donde}: el aviso con su captura, sin diagnóstico y sin contestar (${JSON.stringify(r)})`);
      ok(!errores.length, `(a) ${donde}: sin errores${errores.length ? `: ${errores[0]}` : ''}`);
      await ctx.close();
    }
    /* (b) el dueño */
    {
      const { ctx, page, errores } = await pagina('dueño', movil);
      await accion(page, 'avisos'); await page.waitForTimeout(900);
      await accion(page, 'abrirAviso', { id: 'abc123def' }); await page.waitForTimeout(900);
      const t = await hojaTxt(page);
      const r = await page.evaluate(() => ({ resp: !!document.querySelector('#respTxt'), boton: !!document.querySelector('[data-accion="responderAviso"]'), copiar: !!document.querySelector('[data-accion="copiarAvisos"]') }));
      ok(r.resp && r.boton && r.copiar && /Diagnóstico/.test(t), `(b) ${donde}: el dueño contesta, ve el diagnóstico y «Copiar avisos» (${JSON.stringify(r)})`);
      ok(!errores.length, `(b) ${donde}: sin errores${errores.length ? `: ${errores[0]}` : ''}`);
      await ctx.close();
    }
    /* (c) cualquier otro */
    {
      const { ctx, page, errores } = await pagina('nadie', movil);
      await accion(page, 'ajustes'); await page.waitForTimeout(400);
      let t = await hojaTxt(page);
      ok(/Reportar un fallo o una idea/.test(t) && !/Quién usa la app/.test(t), `(c) ${donde}: los demás, solo «Reportar un fallo o una idea»`);
      await accion(page, 'avisos'); await page.waitForTimeout(900);
      t = await hojaTxt(page);
      ok(!/Avisos recibidos/.test(t) && /Mandar el aviso/.test(t), `(c) ${donde}: sin la bandeja de todos`);
      ok(!errores.length, `(c) ${donde}: sin errores${errores.length ? `: ${errores[0]}` : ''}`);
      await ctx.close();
    }
  }
} finally {
  await nav.close(); srv.close();
}
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
