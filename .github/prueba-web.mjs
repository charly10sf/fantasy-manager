// Prueba de la web antes de publicarla (revisión total, A13). Sirve web/ en local, abre la liga de ejemplo con Chromium
// (Playwright) y corta todo lo que no sea localhost (también el Worker de verdad de soporte.js). Comprueba:
//   1. que la demo arranca sin errores de la página;
//   2. que las 7 pestañas (las 6 de abajo y Pregunta) pintan sin «.error-c», en el móvil y en el ordenador;
//   3. que una liga guardada rota (un campo que el motor no espera) no deja la app en «Abriendo…» (C2);
//   4. que con el Worker y Deno colgados la carga acaba en una pantalla con salida en menos de 40 s (A7);
//   5. que con el almacenamiento lleno de otras ligas y de la demo la sesión y el chat se siguen guardando (A8);
//   6. que en el parón el sitio de Directo es la pestaña Parón y su selector vuelve a Directo (21).
// Uso: node .github/prueba-web.mjs   (PW_MODULO: ruta del index.mjs de playwright o playwright-core si no se encuentra
//      solo; CHROME: el ejecutable de Chromium, si no es el de Playwright). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const servidor = http.createServer(async (q, r) => {
  const ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const b = await readFile(join(WEB, ruta.endsWith('/') ? `${ruta}index.html` : ruta));
    r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' });
    r.end(b);
  } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}`;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });

let fallos = 0;
const bien = (m) => console.log(`BIEN ${m}`);
const mal = (m) => { fallos++; console.log(`MAL  ${m}`); };
const texto = async (page) => ((await page.textContent('#app').catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 140);

/** una página nueva: lo de fuera, cortado; `colgar` deja sin respuesta lo que vaya a esos hosts (el agujero negro) */
async function pagina({ init = '', ancho = 390, alto = 844, colgar = [] } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto } });
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return r.continue();
    if (colgar.includes(u.hostname)) {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      return new Promise(() => {});
    }
    return r.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(`localStorage.setItem('fm-tour', '1'); ${init}`);
  return { ctx, page, errores };
}

// 1 y 2: arranca y pinta las 7 pestañas
for (const [ancho, alto, nombre] of [[390, 844, 'móvil'], [1280, 800, 'ordenador']]) {
  const { ctx, page, errores } = await pagina({ ancho, alto });
  const t0 = Date.now();
  await page.goto(`${BASE}/index.html`);
  try {
    await page.waitForSelector('#vista', { timeout: 25000 });
    bien(`${nombre}: la demo arranca en ${Date.now() - t0} ms`);
  } catch (e) { mal(`${nombre}: la demo no arranca en 25 s: ${await texto(page)}`); await ctx.close(); continue; }
  const pestanas = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-ir]')].map((b) => b.dataset.ir))]);
  if (pestanas.length < 7) mal(`${nombre}: solo hay ${pestanas.length} pestañas (${pestanas.join(', ')})`);
  for (const p of pestanas) {
    await page.click(`[data-ir="${p}"] >> visible=true`).catch(async () => page.evaluate((x) => document.querySelector(`[data-ir="${x}"]`).click(), p));
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => ({ err: [...document.querySelectorAll('#vista .error-c')].map((e) => e.textContent.trim().slice(0, 160)), largo: (document.querySelector('#vista') || {}).textContent?.trim().length || 0 }));
    if (r.err.length) mal(`${nombre}: la pestaña ${p} pinta un error: ${r.err[0]}`);
    else if (r.largo < 40) mal(`${nombre}: la pestaña ${p} sale vacía (${r.largo} caracteres)`);
    else bien(`${nombre}: pestaña ${p} (${r.largo} caracteres)`);
  }
  if (errores.length) mal(`${nombre}: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 3: una liga guardada rota no bloquea el arranque
{
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForSelector('#vista', { timeout: 25000 }).catch(() => {});
  for (const [campo, valor] of [['clasif', null], ['partidos', {}], ['yo', null], ['maestro', null]]) {
    await page.evaluate(([k, v]) => { const D = JSON.parse(localStorage.getItem('fm-datos-demo')); D[k] = v; D.t = Date.now(); localStorage.setItem('fm-datos-demo', JSON.stringify(D)); }, [campo, valor]);
    const t0 = Date.now();
    await page.reload();
    try {
      await page.waitForSelector('#vista', { timeout: 15000 });
      bien(`con la liga guardada rota (${campo}: ${JSON.stringify(valor)}) arranca en ${Date.now() - t0} ms`);
    } catch (e) {
      mal(`con la liga guardada rota (${campo}: ${JSON.stringify(valor)}) se queda en: ${await texto(page)}`);
      await page.evaluate(() => localStorage.removeItem('fm-datos-demo'));
      await page.reload();
      await page.waitForSelector('#vista', { timeout: 25000 }).catch(() => {});
    }
  }
  if (errores.length) mal(`liga rota: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 4: la red colgada (el Worker y Deno no contestan nunca): tiene que salir algo con salida, sin esperar minutos
{
  const sesion = JSON.stringify({ token: 'x', renovar: 'y', caduca: Date.now() + 864e5, desde: Date.now() });
  const init = `localStorage.setItem('fm-worker', 'https://worker.prueba'); localStorage.setItem('fm-proxy2', 'https://deno.prueba'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)});`;
  const { ctx, page } = await pagina({ init, colgar: ['worker.prueba', 'deno.prueba'] });
  const t0 = Date.now();
  await page.goto(`${BASE}/index.html`);
  let fin = null;
  while (Date.now() - t0 < 60000) {
    fin = await page.evaluate(() => (document.querySelector('.carga.mal') ? 'la pantalla de error' : document.querySelector('#vista') ? 'la liga' : null));
    if (fin) break;
    await page.waitForTimeout(500);
  }
  const s = Math.round((Date.now() - t0) / 1000);
  if (fin && s <= 40) bien(`con la red colgada sale ${fin} a los ${s} s`);
  else mal(`con la red colgada: ${fin ? `${fin} a los ${s} s (más de 40)` : `sin salida a los ${s} s`}: ${await texto(page)}`);
  await ctx.close();
}

// 5: el almacenamiento lleno de la demo y de otra liga: la sesión, la clave y el chat de la liga de ahora caben
{
  const init = "localStorage.setItem('fm-worker', 'https://worker.prueba'); localStorage.setItem('fm-cfg', JSON.stringify({ ligaId: 'L1' })); localStorage.setItem('fm-liga-principal', '\"L1\"');";
  const { ctx, page } = await pagina({ init });
  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const P = await import('/js/puente.js'); const U = await import('/js/util.js'); const Dt = await import('/js/datos.js');
    const bases = ['hist', 'datos', 'det', 'chat', 'planes', 'vivo', 'hechos', 'acthist', 'previs', 'notas', 'ia'];
    const bloque = 'x'.repeat(250000);
    for (const k of bases.flatMap((b) => [`fm-${b}-demo`, `fm-${b}-l999`, `fm-${b}-l998`])) { try { localStorage.setItem(k, bloque); } catch (e) { break; } }
    let resto = 'y'.repeat(50000), z = 0;
    while (resto.length > 10) { const k = `fm-${bases[z % bases.length]}-l9${z}`; z++; try { localStorage.setItem(k, resto); } catch (e) { resto = resto.slice(0, resto.length / 2); } }
    P.guardar('sesion', { token: 't'.repeat(1500), renovar: 'r'.repeat(1500), caduca: Date.now() + 864e5 });
    P.guardar('gemini', `AIza${'k'.repeat(35)}`);
    const chat = U.LS.set(Dt.K('chat'), Array.from({ length: 30 }, () => ({ r: 'yo', t: 'mensaje '.repeat(80), ts: Date.now() })));
    return { sesion: localStorage.getItem('fm-n-sesion') != null, clave: localStorage.getItem('fm-n-gemini') != null, chat };
  });
  if (r.sesion && r.clave && r.chat) bien('con el almacenamiento lleno se guardan la sesión, la clave y el chat');
  else mal(`con el almacenamiento lleno no se guarda: ${Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
  await ctx.close();
}

// 6: en el parón (la demo con la jornada 10 a 12 días), el sitio de Directo es la pestaña Parón, con sus cuentas, y su
// selector vuelve al Directo de siempre (21, 9 nov)
for (const [ancho, alto, nombre] of [[390, 844, 'móvil'], [1280, 800, 'ordenador']]) {
  const { ctx, page, errores } = await pagina({ ancho, alto });
  await ctx.route('**/js/demo.js', async (r) => {
    const cuerpo = (await readFile(join(WEB, 'js', 'demo.js'), 'utf8')).replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,');
    r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: cuerpo });
  });
  await page.goto(`${BASE}/index.html`);
  await page.waitForSelector('#vista', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(800);
  const etiqueta = await page.evaluate(() => (document.querySelector('.nav button[data-ir="directo"]') || {}).textContent || '');
  await page.evaluate(() => document.querySelector('.nav button[data-ir="directo"]').click());
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({ hero: !!document.querySelector('#vista .pnz-hero'), secs: document.querySelectorAll('#vista .pnz-sec').length, err: !!document.querySelector('#vista .error-c') }));
  await page.evaluate(() => document.querySelector('[data-seg="paron:directo"]').click());
  await page.waitForTimeout(500);
  const dir = await page.evaluate(() => !document.querySelector('#vista .pnz-hero') && !!document.querySelector('#vista .titulo'));
  if (!/Parón/.test(etiqueta)) mal(`${nombre}: en el parón el botón de Directo no dice «Parón» (${etiqueta.trim()})`);
  else if (!r.hero || r.secs < 2 || r.err) mal(`${nombre}: la pestaña Parón no pinta bien (${JSON.stringify(r)})`);
  else if (!dir) mal(`${nombre}: el selector de la pestaña Parón no vuelve a Directo`);
  else bien(`${nombre}: en el parón, pestaña Parón (${r.secs} secciones) y su selector a Directo`);
  if (errores.length) mal(`${nombre} en el parón: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

await nav.close();
servidor.close();
console.log(fallos ? `\n${fallos} MAL` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
