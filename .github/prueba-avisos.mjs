// La pantalla de los avisos de fallo y «Quién usa la app» según quién mira (0.8.4). Un servidor de mentira para el Worker
// (/fallos/*, /hola) y la web de verdad, en el móvil y en el ordenador:
//  (a) quien ayuda con los fallos (Domy; `ve` del servidor): en Ajustes, «Avisos de fallo» y «Quién usa la app»; en los
//      avisos, la bandeja de todos con sus capturas, sin el diagnóstico, sin «Copiar avisos» y sin poder contestar
//  (b) el dueño: lo de siempre (contesta, ve el diagnóstico y «Copiar avisos»)
//  (c) cualquier otro: solo «Reportar un fallo o una idea» y sus avisos
//  (d) (fase 3) quien lo mandó: su aviso es una conversación en burbujas (lo suyo a la derecha), con las capturas de cada
//      mensaje, «Visto» y la caja para seguirla con capturas; lo que escribe se añade
//  (e) el dueño: contesta otra vez y se añade (no pisa), con captura; quien ayuda no tiene caja
//  (f) un servidor de antes (sin `msgs`): el texto y la respuesta salen igual, como dos burbujas
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
// el servidor de mentira, con estado: el aviso de Pepe (otro, para el dueño y quien ayuda) y el tuyo (para «Tus avisos"),
// cada uno una conversación; lo que se escribe se añade. `viejo`: un servidor de antes de la 0.8.4 (sin msgs)
function servidor(papel, { viejo = false } = {}) {
  const t0 = Date.now() - 3600e3;
  const hilo = (id, quien, extra = {}) => ({ id, t: t0, quien, equipo: `Los ${quien}`, liga: 'Liga X', app: '0.8.4 · web', diag: `LaLiga 200 · lo de ${quien}`, vu: 0, vd: 0, msgs: [{ n: 0, de: 'u', t: t0, texto: 'Al abrir Mercado se queda en blanco', caps: 1 }], ...extra });
  const pepe = hilo('abc123def', 'Pepe');
  const mio = hilo('mio123abc', 'Yo', { msgs: [{ n: 0, de: 'u', t: t0, texto: 'No me sale el plan', caps: 1 }, { n: 1, de: 'd', t: t0 + 60e3, texto: 'Lo miro. ¿Desde cuándo?', caps: 0, por: 'Fantasy Manager' }], vd: t0 + 60e3 });
  const vistos = { escribir: [], responder: [] };
  // como lo da el servidor: lo de ahora (msgs, de, ult) y lo de antes (texto, respuesta…)
  const app = (h) => {
    const ultD = [...h.msgs].reverse().find((m) => m.de === 'd'), ult = h.msgs[h.msgs.length - 1];
    const antes = { id: h.id, t: h.t, quien: h.quien, equipo: h.equipo, liga: h.liga, app: h.app, texto: h.msgs[0].texto, capturas: h.msgs[0].caps, respuesta: ultD ? ultD.texto : null, respondida: ultD ? ultD.t : null, vista: !ultD || h.vu >= ultD.t, por: ultD ? 'Fantasy Manager' : undefined };
    return viejo ? antes : { ...antes, msgs: h.msgs, de: ult.de, ult: ult.t, n: h.msgs.length, vu: h.vu, vd: h.vd };
  };
  const admin = papel === 'dueño', ve = admin || papel === 'ayuda';
  const ruta = async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const json = (x, s = 200) => r.fulfill({ status: s, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(x) });
    const b = q.method() === 'POST' ? JSON.parse(q.postData() || '{}') : {};
    if (u.pathname === '/hola') return json({ ok: true, admin, ve, ev: false });
    if (u.pathname === '/fallos/mios') return json({ lista: [app(mio)], admin, ve, pendientes: admin ? 1 : null, yo: '1' });
    if (u.pathname === '/fallos/visto') { mio.vu = Date.now(); return json({ ok: true }); }
    if (u.pathname === '/fallos/escribir') { vistos.escribir.push(b); mio.msgs.push({ n: mio.msgs.length, de: 'u', t: Date.now(), texto: b.texto, caps: (b.capturas || []).length }); return json({ ok: true, n: mio.msgs.length - 1 }); }
    if (u.pathname === '/fallos/captura') return json({ img: CAPTURA });
    if (!ve) return json({ e: 'Solo para el dueño de la app' }, 403);
    if (u.pathname === '/fallos/todos') { const ult = pepe.msgs[pepe.msgs.length - 1]; return json({ lista: [{ id: pepe.id, t: pepe.t, quien: pepe.quien, equipo: pepe.equipo, txt: pepe.msgs[0].texto, r: ult.de === 'd' ? ult.t : 0, v: 0, c: 1, n: pepe.msgs.length, de: ult.de, ult: ult.t }], pendientes: ult.de === 'u' ? 1 : 0 }); }
    if (u.pathname === '/fallos/uno') { const h = app(pepe); return json(admin ? { ...h, diag: pepe.diag } : h); }
    if (u.pathname === '/fallos/responder' && admin) { vistos.responder.push(b); pepe.msgs.push({ n: pepe.msgs.length, de: 'd', t: Date.now(), texto: b.respuesta, caps: (b.capturas || []).length, por: 'Fantasy Manager' }); return json({ ok: true, n: pepe.msgs.length - 1 }); }
    return json({ ok: true });
  };
  return { ruta, vistos, pepe, mio };
}
async function pagina(papel, movil, op = {}) {
  const ctx = await nav.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 860 }, timezoneId: 'Europe/Madrid', locale: 'es-ES', ...(movil ? { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36', isMobile: true, hasTouch: true } : {}) });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  const sv = servidor(papel, op);
  await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', sv.ruta);
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(`if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)}); }`);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
  // fuera de la liga de ejemplo, con la sesión puesta; lo que diga /hola (el papel) se apunta como al abrir la app
  await page.evaluate(async () => { localStorage.setItem('fm-demo', 'false'); const So = await import('./js/soporte.js'); await So.saludar({ v: 'x', canal: 'web' }); });
  return { ctx, page, errores, sv };
}
const accion = (page, a, extra = {}) => page.evaluate(([x, e]) => { const b = document.createElement('button'); b.dataset.accion = x; Object.assign(b.dataset, e); document.body.appendChild(b); b.click(); b.remove(); }, [a, extra]);
// (textContent: lo de las secciones plegadas de Ajustes también cuenta)
// una captura ya preparada para mandar (lo que deja elegirCapturas), para no abrir el selector de archivos
const ponerCaptura = (page) => page.evaluate((img) => { window.S.av.capHilo = [{ url: img, mini: img }]; }, CAPTURA);
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
      const r = await page.evaluate(() => ({ resp: !!document.querySelector('#hiloTxt'), boton: !!document.querySelector('[data-accion="responderAviso"]'), img: !!document.querySelector('.aviso-capt img') }));
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
      const r = await page.evaluate(() => ({ resp: !!document.querySelector('#hiloTxt'), boton: !!document.querySelector('[data-accion="responderAviso"]'), copiar: !!document.querySelector('[data-accion="copiarAvisos"]') }));
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
    /* (d) quien lo mandó: su aviso, como conversación */
    {
      const { ctx, page, errores, sv } = await pagina('nadie', movil);
      await accion(page, 'avisos'); await page.waitForTimeout(900);
      let t = await hojaTxt(page);
      ok(/Tus avisos/.test(t) && /2 mensajes/.test(t) && /Fantasy Manager: Lo miro/.test(t), `(d) ${donde}: cerrado, el aviso dice cuántos mensajes y lo último`);
      await accion(page, 'abrirHilo', { id: 'mio123abc' }); await page.waitForTimeout(900);
      let r = await page.evaluate(() => { const ms = [...document.querySelectorAll('.aviso.abierto .msg')]; return { n: ms.length, lados: ms.map((m) => (m.classList.contains('mio') ? 'mio' : 'suyo')).join(','), quien: ms.map((m) => m.querySelector('b').textContent).join(','), img: !!document.querySelector('.aviso.abierto .msg .aviso-capt img'), caja: !!document.querySelector('#hiloTxt'), adj: !!document.querySelector('[data-accion="capturaHilo"]') }; });
      ok(r.n === 2 && r.lados === 'mio,suyo' && r.quien === 'Tú,Fantasy Manager' && r.img && r.caja && r.adj, `(d) ${donde}: abierto, en burbujas (lo suyo a la derecha), con su captura y la caja con el botón de adjuntar (${JSON.stringify(r)})`);
      ok(sv.mio.vu > 0, `(d) ${donde}: al abrirlo, la respuesta queda leída`);
      await page.fill('#hiloTxt', 'Desde ayer, con la última versión');
      await ponerCaptura(page);
      await accion(page, 'escribirHilo', { id: 'mio123abc' }); await page.waitForTimeout(1200);
      r = await page.evaluate(() => { const ms = [...document.querySelectorAll('.aviso.abierto .msg')]; const u = ms[ms.length - 1]; return { n: ms.length, ultMio: u && u.classList.contains('mio'), txt: u && u.textContent, img: !!(u && u.querySelector('img')), caja: (document.querySelector('#hiloTxt') || {}).value }; });
      ok(sv.vistos.escribir.length === 1 && sv.vistos.escribir[0].capturas.length === 1 && r.n === 3 && r.ultMio && /Desde ayer/.test(r.txt) && r.img && r.caja === '', `(d) ${donde}: lo que escribe se añade al hilo, con su captura, y la caja se vacía (${JSON.stringify(r)})`);
      sv.mio.vd = Date.now() + 1000; await accion(page, 'avisos'); await page.waitForTimeout(900); await accion(page, 'abrirHilo', { id: 'mio123abc' }); await page.waitForTimeout(600);
      t = await hojaTxt(page);
      ok(/Visto/.test(t), `(d) ${donde}: «Visto» cuando Fantasy Manager lo ha leído`);
      // (FOTOS=<carpeta>: cómo se ve, para mirarlo)
      if (process.env.FOTOS) await page.evaluate(() => document.querySelector('.aviso.abierto').scrollIntoView()).then(() => page.screenshot({ path: `${process.env.FOTOS}/avisos-usuario-${donde}.png` }));
      ok(!errores.length, `(d) ${donde}: sin errores${errores.length ? `: ${errores[0]}` : ''}`);
      await ctx.close();
    }
    /* (e) el dueño contesta otra vez: se añade */
    {
      const { ctx, page, errores, sv } = await pagina('dueño', movil);
      await accion(page, 'avisos'); await page.waitForTimeout(900);
      await accion(page, 'abrirAviso', { id: 'abc123def' }); await page.waitForTimeout(900);
      await page.fill('#hiloTxt', 'Lo miro, ¿qué móvil tienes?');
      await accion(page, 'responderAviso', { id: 'abc123def' }); await page.waitForTimeout(1000);
      await page.fill('#hiloTxt', 'Y otra cosa');
      await ponerCaptura(page);
      await accion(page, 'responderAviso', { id: 'abc123def' }); await page.waitForTimeout(1000);
      const r = await page.evaluate(() => { const ms = [...document.querySelectorAll('.aviso.abierto .msg')]; return { n: ms.length, lados: ms.map((m) => (m.classList.contains('mio') ? 'mio' : 'suyo')).join(','), txt: ms.map((m) => m.querySelector('p') ? m.querySelector('p').textContent : '').join('|') }; });
      if (process.env.FOTOS) await page.evaluate(() => document.querySelector('.aviso.abierto .msgs').scrollIntoView()).then(() => page.screenshot({ path: `${process.env.FOTOS}/avisos-dueno-${donde}.png` }));
      ok(sv.vistos.responder.length === 2 && sv.vistos.responder[1].capturas.length === 1 && r.n === 3 && r.lados === 'suyo,mio,mio' && /qué móvil/.test(r.txt) && /otra cosa/.test(r.txt), `(e) ${donde}: dos respuestas seguidas, las dos en el hilo (la segunda con captura) (${JSON.stringify(r)})`);
      ok(!errores.length, `(e) ${donde}: sin errores${errores.length ? `: ${errores[0]}` : ''}`);
      await ctx.close();
    }
    /* (f) un servidor de antes (sin msgs) */
    {
      const { ctx, page, errores } = await pagina('nadie', movil, { viejo: true });
      await accion(page, 'avisos'); await page.waitForTimeout(900);
      await accion(page, 'abrirHilo', { id: 'mio123abc' }); await page.waitForTimeout(700);
      const n = await page.evaluate(() => document.querySelectorAll('.aviso.abierto .msg').length);
      ok(n === 2, `(f) ${donde}: con un servidor de antes, el texto y la respuesta como dos burbujas (${n})`);
      ok(!errores.length, `(f) ${donde}: sin errores${errores.length ? `: ${errores[0]}` : ''}`);
      await ctx.close();
    }
  }
} finally {
  await nav.close(); srv.close();
}
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
