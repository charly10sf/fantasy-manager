// Recorrido del overhaul (11 nov): capturas y axe de todas las pantallas. Uso: node .github/overhaul/recorrido.mjs web /tmp/tour (PARON=1 para la demo en el parón).
// Ayudas para las pruebas de la noche: sirve web/ en local, abre Chromium y pasa axe.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs');
const AXE = await readFile('/tmp/axe/node_modules/axe-core/axe.min.js', 'utf8');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

export async function servir(web, cambia = {}) {
  const s = http.createServer(async (q, r) => {
    let ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (ruta.endsWith('/')) ruta += 'index.html';
    try {
      let b = await readFile(join(web, ruta));
      if (cambia[ruta]) b = Buffer.from(cambia[ruta](b.toString()));
      r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' });
      r.end(b);
    } catch (e) { r.writeHead(404); r.end('no'); }
  });
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
  return { base: `http://127.0.0.1:${s.address().port}`, cerrar: () => s.close() };
}

export const nav = await pw.chromium.launch({ args: ['--disable-dev-shm-usage'] });

export async function pagina({ init = '', ancho = 390, alto = 844, tour = true, tactil = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: ancho < 600 ? 2 : 1, hasTouch: tactil, isMobile: false });
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return r.continue();
    return r.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(`${tour ? "localStorage.setItem('fm-tour', '1');" : ''} ${init}`);
  return { ctx, page, errores };
}

/** axe sobre la página (o un selector raíz); devuelve las violaciones resumidas */
export async function axe(page, raiz = null) {
  await page.evaluate(AXE);
  return page.evaluate(async (raiz) => {
    const r = await window.axe.run(raiz ? document.querySelector(raiz) || document : document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, ej: v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ') }));
  }, raiz);
}
