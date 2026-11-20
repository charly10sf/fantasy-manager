// La tarjeta de una novedad con «aviso» (invitar a un amigo, 0.8h) no se pierde (20 nov, Carlos: «he abierto la app y no
// me ha salido nada»): al actualizar desde Google Play, la web de dentro de la app la enseñaba al arrancar y la daba por
// vista, y a los pocos segundos la app bajaba la web publicada después y recargaba: no volvía a salir. Aquí, con la liga
// de ejemplo y un Android de mentira: sale con la liga cargada, la app no recarga con ella en pantalla, vuelve a salir
// si se cierra la app sin tocarla, deja de salir al cerrarla o pulsar su botón, la recupera quien ya tenía esta versión
// en la app sin haberla cerrado, y no sale en una instalación nueva ni a quien ya tenía esta versión en la web.
// node .github/prueba-aviso.mjs   (PW_MODULO y CHROME como en prueba-web)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PW_MODULO || 'playwright');
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
const { VERSION } = await import(join(WEB, 'js', 'version.js'));
let mal = 0;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer(async (q, r) => {
  let ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (ruta.endsWith('/')) ruta += 'index.html';
  try { const b = await readFile(join(WEB, ruta)); r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
const APP = `window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '7261', canal: () => 'play', hayQR: () => false, programarAvisos: () => {}, hayAnuncios: () => true, aLaVista: () => true,
  guardar: (k, v) => { localStorage.setItem('fm-n-' + k, v); }, borrar: (k) => { localStorage.removeItem('fm-n-' + k); }, leer: (k) => localStorage.getItem('fm-n-' + k) }, { get: (o, k) => (k in o ? o[k] : () => null) });`;
const BASE_LS = `if (!sessionStorage.getItem('puesto')) { sessionStorage.setItem('puesto', '1'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-beta-aviso', '1'); __EXTRA__ }`;
async function caso(nombre, espera, { app = true, vista = '0.8f', pasos }) {
  const ctx = await nav.newContext({ viewport: { width: 396, height: 859 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  const page = await ctx.newPage();
  const errores = []; page.on('pageerror', (e) => errores.push(String(e)));
  await page.addInitScript((app ? APP : '') + BASE_LS.replace('__EXTRA__', vista ? `localStorage.setItem('fm-version-vista2', JSON.stringify('${vista === 'ACTUAL' ? VERSION : vista}'));` : ''));
  await page.goto(`${BASE}/index.html`);
  const lista = async () => { await page.waitForFunction(() => window.S && window.S.D && window.S.M && document.querySelector('.nav'), null, { timeout: 30000 }); await page.waitForTimeout(2600); };
  await lista();
  const hay = () => page.evaluate(() => !!document.querySelector('.nvt'));
  const r = [];
  for (const p of pasos) {
    if (p === 'mira') r.push(await hay() ? 'TARJETA' : 'nada');
    if (p === 'recarga-app') { await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => r.push('(no recargó)')), page.evaluate(() => window.webBuscada('nueva'))]); await lista(); }
    if (p === 'reabre') { await page.reload(); await lista(); }
    if (p === 'ahora-no') { if (!(await hay())) { r.push('(sin tarjeta que cerrar)'); continue; } await page.click('.nvt [data-nvt="no"]'); await page.waitForTimeout(400); }
    if (p === 'invitar') { if (!(await hay())) { r.push('(sin tarjeta que pulsar)'); continue; } await page.click('.nvt [data-nvt="ir"]'); await page.waitForTimeout(900); r.push('hoja:' + await page.evaluate(() => (window.S.tipoHoja || [])[0] || (document.querySelector('.hoja') ? 'sí' : 'no'))); }
  }
  const sale = r.join(' → '), bien = sale === espera && !errores.length;
  if (!bien) mal++;
  console.log(`${bien ? 'BIEN' : 'MAL '} ${nombre}: ${sale}${bien ? '' : `  (se esperaba: ${espera})`}${errores.length ? '  ERRORES ' + errores.slice(0, 2).join(' | ') : ''}`);
  await ctx.close();
}
await caso('en la app, al venir de la 0.8f: sale, la app no recarga con ella en pantalla y sigue al reabrir', 'TARJETA → (no recargó) → TARJETA → TARJETA', { pasos: ['mira', 'recarga-app', 'mira', 'reabre', 'mira'] });
await caso('cerrada con «Ahora no», no vuelve', 'TARJETA → nada', { pasos: ['mira', 'ahora-no', 'reabre', 'mira'] });
await caso('sin tocarla, al reabrir la app vuelve a salir', 'TARJETA → TARJETA', { pasos: ['mira', 'reabre', 'mira'] });
await caso('quien ya tenía esta versión en la app sin haberla cerrado (la recarga se la llevó): la ve, el botón abre invitar y no vuelve', 'TARJETA → hoja:invitar → nada', { vista: 'ACTUAL', pasos: ['mira', 'invitar', 'reabre', 'mira'] });
await caso('quien ya tenía esta versión en la web: nada', 'nada', { app: false, vista: 'ACTUAL', pasos: ['mira'] });
await caso('instalación nueva en la app: nada', 'nada → nada', { vista: '', pasos: ['mira', 'reabre', 'mira'] });
await caso('en la web, al venir de la 0.8f: sale, el botón abre invitar y no vuelve', 'TARJETA → hoja:invitar → nada', { app: false, pasos: ['mira', 'invitar', 'reabre', 'mira'] });
await nav.close(); srv.close();
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
