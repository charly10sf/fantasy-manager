// Recorrido de toda la app para la revisión del overhaul: capturas y axe de cada pantalla, en móvil y ordenador.
import { servir, pagina, axe, nav } from './base.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const web = process.argv[2];
const SAL = process.argv[3] || '/tmp/tour';
const paron = process.env.PARON === '1';
const { base, cerrar } = await servir(web, paron ? { '/js/demo.js': (t) => t.replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,') } : {});
const PUENTE = "window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, hayAlarma: () => true, probarAlarma: () => {}, version: () => '5241', canal: () => 'github', hayQR: () => true, programarAvisos: () => {}, notificar: () => {}, estadoWeb: () => ({ activa: true }) }, { get: (o, k) => (k in o ? o[k] : undefined) }); localStorage.setItem('fm-cfg-avisos', '{\"on\":true}');";
const LIM_ABIERTO = JSON.stringify({ bloqueadas: [], abre: '2020-01-01T00:00:00Z' });
const informe = [];
let n = 0;

async function limites(ctx, cuerpo) {
  await ctx.route(/limites\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: cuerpo }));
}
const espera = (page, ms = 500) => page.waitForTimeout(ms);
async function cap(page, ancho, nombre, { raiz = null, completa = false } = {}) {
  n++;
  const archivo = `${SAL}/${ancho}/${String(n).padStart(3, '0')}-${nombre}.png`;
  await page.screenshot({ path: archivo, fullPage: completa }).catch(() => {});
  const v = await axe(page, raiz).catch((e) => [{ id: 'axe-error', impacto: '', n: 0, ej: String(e.message).slice(0, 80) }]);
  informe.push({ ancho, nombre, archivo, axe: v });
  return v;
}
const clic = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
const boton = (page, attrs) => page.evaluate((a) => { const b = document.createElement('button'); Object.assign(b.dataset, a); b.style.display = 'none'; document.body.append(b); b.click(); b.remove(); }, attrs);
const cerrarHoja = (page) => page.evaluate(() => { const b = document.querySelector('.hoja [data-accion="cerrarHoja"]'); if (b) b.click(); });
const scrollHoja = (page, f) => page.evaluate((f) => { const h = document.querySelector('.hoja .hoja-cuerpo, .hoja'); if (h) h.scrollTop = h.scrollHeight * f; }, f);

for (const [ancho, alto] of [[390, 844], [1280, 800]]) {
  await mkdir(`${SAL}/${ancho}`, { recursive: true });
  const movil = ancho < 600;

  // 1 · la web de verdad, sin liga: portada y entrada
  {
    const { ctx, page } = await pagina({ ancho, alto, tour: false, init: "localStorage.setItem('fm-worker','http://localhost:9');" });
    await page.goto(base + '/index.html');
    await espera(page, 2500);
    await cap(page, ancho, 'portada', { completa: true });
    const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find((x) => /entrar|empezar|mi liga/i.test(x.textContent || '') && !/ejemplo/i.test(x.textContent || '')); if (b) b.click(); return b ? b.textContent.trim() : null; });
    await espera(page, 1200);
    if (ok) await cap(page, ancho, 'entrada', { completa: true });
    await ctx.close();
  }

  // 2 · la carga y la cuenta atrás (limites.json con «abre» en el futuro) y la pantalla de error (red colgada)
  {
    const { ctx, page } = await pagina({ ancho, alto, init: "localStorage.setItem('fm-demo','true');" });
    await limites(ctx, JSON.stringify({ bloqueadas: [], abre: new Date(Date.now() + 5 * 3600e3).toISOString() }));
    await page.goto(base + '/index.html', { waitUntil: 'commit' });
    await espera(page, 250);
    await cap(page, ancho, 'carga');
    await espera(page, 4000);
    await cap(page, ancho, 'limite-cuenta-atras');
    await ctx.close();
  }
  {
    const sesion = JSON.stringify({ token: 'x', renovar: 'y', caduca: Date.now() + 864e5, desde: Date.now() });
    const { ctx, page } = await pagina({ ancho, alto, init: `localStorage.setItem('fm-worker', 'http://localhost:9'); localStorage.setItem('fm-proxy2', 'http://localhost:9'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)});` });
    await page.goto(base + '/index.html');
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) { if (await page.evaluate(() => !!document.querySelector('.carga.mal'))) break; await espera(page, 500); }
    await cap(page, ancho, 'error-carga');
    await ctx.close();
  }

  // 3 · la liga de ejemplo con todo abierto (en el móvil, como en la app de Android)
  const { ctx, page, errores } = await pagina({ ancho, alto, tactil: movil, init: `localStorage.setItem('fm-demo','true'); ${movil ? PUENTE : ''}` });
  await limites(ctx, LIM_ABIERTO);
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 });
  await espera(page, 1200);

  // las 7 pestañas, cada una con sus secciones
  for (const t of ['hoy', 'equipo', 'directo', 'rivales', 'mercado', 'clubes', 'ia']) {
    await page.evaluate((t) => { const b = document.querySelector(`[data-ir="${t}"]`); if (b) b.click(); }, t);
    await espera(page, 900);
    await page.evaluate(() => window.scrollTo(0, 0));
    await cap(page, ancho, `${t}`, { completa: true });
    const segs = await page.evaluate((t) => [...new Set([...document.querySelectorAll(`#vista [data-seg^="${t}:"], #vista [data-seg^="paron:"]`)].map((b) => b.dataset.seg))], t);
    for (const sg of segs.slice(1, 9)) {
      await page.evaluate((sg) => { const b = document.querySelector(`#vista [data-seg="${sg}"]`); if (b) b.click(); }, sg);
      await espera(page, 800);
      await page.evaluate(() => window.scrollTo(0, 0));
      await cap(page, ancho, `${t}-${sg.split(':')[1]}`, { completa: true });
    }
    if (segs.length) await page.evaluate((sg) => { const b = document.querySelector(`#vista [data-seg="${sg}"]`); if (b) b.click(); }, segs[0]);
  }
  await page.evaluate(() => document.querySelector('[data-ir="hoy"]').click());
  await espera(page, 600);

  // las fichas: jugador tuyo, de un rival y libre, rival, club, partido y sustitutos
  const ids = await page.evaluate(() => {
    const { M } = window.S;
    const mio = M.mias[0] && M.mias[0].pid;
    const riv = M.clausulas[0] && M.clausulas[0].pid;
    const libre = (M.mercado.find((m) => m.tipo === 'liga') || {}).pid;
    const tid = M.clausulas[0] && M.clausulas[0].teamId;
    const club = M.mias[0] && M.mias[0].j.equipoId;
    return { mio, riv, libre, tid, club };
  });
  for (const [k, attrs] of [['ficha-jugador-mio', { j: ids.mio }], ['ficha-jugador-rival', { j: ids.riv }], ['ficha-jugador-libre', { j: ids.libre }], ['ficha-rival', { r: ids.tid }], ['ficha-club', { club: ids.club }], ['ficha-sustitutos', { accion: 'sustituto', pid: ids.mio }]]) {
    if (Object.values(attrs).some((v) => v == null)) continue;
    await boton(page, attrs);
    await espera(page, 1200);
    await cap(page, ancho, k, { raiz: '.hoja' });
    await scrollHoja(page, 0.45); await espera(page, 300);
    await cap(page, ancho, `${k}-medio`, { raiz: '.hoja' });
    await scrollHoja(page, 1); await espera(page, 300);
    await cap(page, ancho, `${k}-final`, { raiz: '.hoja' });
    if (k === 'ficha-club') {
      const pes = await page.evaluate(() => [...document.querySelectorAll('.hoja [data-accion="segClub"]')].map((b) => b.dataset.s));
      for (const s of pes.slice(1)) { await page.evaluate((s) => document.querySelector(`.hoja [data-accion="segClub"][data-s="${s}"]`)?.click(), s); await espera(page, 700); await scrollHoja(page, 0); await cap(page, ancho, `ficha-club-${s}`, { raiz: '.hoja' }); }
    }
    await cerrarHoja(page); await espera(page, 400);
  }
  // la ficha de un partido, desde Directo
  await page.evaluate(() => document.querySelector('[data-ir="directo"]').click());
  await espera(page, 900);
  if (await clic(page, '#vista [data-accion="verPartido"]')) { await espera(page, 1500); await cap(page, ancho, 'ficha-partido', { raiz: '.hoja' }); await scrollHoja(page, 0.6); await espera(page, 300); await cap(page, ancho, 'ficha-partido-medio', { raiz: '.hoja' }); await cerrarHoja(page); }
  await page.evaluate(() => document.querySelector('[data-ir="hoy"]').click());
  await espera(page, 600);
  // el marcador (Tu equipo hoy)
  if (await clic(page, '#vista .marcador')) { await espera(page, 800); await cap(page, ancho, 'hoja-tu-equipo', { raiz: '.hoja' }); await cerrarHoja(page); }

  // Ajustes: cerrado y cada sección abierta; diagnóstico, avisos de fallo y tutorial
  await clic(page, '#bAjustes'); await espera(page, 700);
  await cap(page, ancho, 'ajustes', { raiz: '.hoja' });
  const secs = await page.evaluate(() => [...document.querySelectorAll('details.aj-sec')].map((d) => d.dataset.k));
  for (const k of secs) {
    await page.evaluate((k) => { document.querySelectorAll('details.aj-sec[open]').forEach((d) => d.querySelector('summary').click()); const d = document.querySelector(`details.aj-sec[data-k="${k}"]`); d.querySelector('summary').click(); d.scrollIntoView({ block: 'start' }); }, k);
    await espera(page, 500);
    await cap(page, ancho, `ajustes-${k}`, { raiz: '.hoja' });
  }
  await page.fill('#buscaAj', 'once').catch(() => {}); await espera(page, 400);
  await cap(page, ancho, 'ajustes-buscando', { raiz: '.hoja' });
  await page.fill('#buscaAj', '').catch(() => {});
  await clic(page, '.hoja [data-accion="diag"]'); await espera(page, 900);
  await cap(page, ancho, 'diagnostico', { raiz: '.hoja' });
  await cerrarHoja(page); await espera(page, 300);
  await clic(page, '#bAjustes'); await espera(page, 600);
  await clic(page, '.hoja [data-accion="avisos"]'); await espera(page, 900);
  await cap(page, ancho, 'avisos-de-fallo', { raiz: '.hoja' });
  await cerrarHoja(page); await espera(page, 300);
  await clic(page, '#bAjustes'); await espera(page, 600);
  await clic(page, '.hoja [data-accion="tutorial"]'); await espera(page, 1200);
  await cap(page, ancho, 'tutorial-1');
  for (let i = 2; i <= 4; i++) { await page.evaluate(() => { const b = [...document.querySelectorAll('.tour button, [class*="tour"] button')].find((x) => /siguiente|todo|vamos|empezar|ver/i.test(x.textContent)); if (b) b.click(); }); await espera(page, 900); await cap(page, ancho, `tutorial-${i}`); }
  await page.keyboard.press('Escape').catch(() => {});
  await ctx.close();
  if (errores.length) informe.push({ ancho, nombre: 'ERRORES', errores });

  // 4 · los candados y la hoja de una función top (limites.json de siempre: la inercia y el dinero de los rivales, cerrados)
  {
    const { ctx: c2, page: p2 } = await pagina({ ancho, alto, init: "localStorage.setItem('fm-demo','true');" });
    await limites(c2, JSON.stringify({ bloqueadas: ['dineroRivales', 'quienPaga', 'inercia'], abre: '2020-01-01T00:00:00Z' }));
    await p2.goto(base + '/index.html');
    await p2.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 });
    await espera(p2, 800);
    await p2.evaluate(() => document.querySelector('[data-ir="rivales"]').click());
    await espera(p2, 900);
    await cap(p2, ancho, 'rivales-con-candados', { completa: true });
    if (await clic(p2, '#vista [data-accion="bloqueada"], [data-accion="bloqueada"]')) { await espera(p2, 900); await cap(p2, ancho, 'hoja-candado', { raiz: '.hoja' }); }
    await c2.close();
  }
}

await writeFile(`${SAL}/informe.json`, JSON.stringify(informe, null, 1));
console.log(`${informe.length} capturas`);
const malos = informe.filter((x) => x.axe && x.axe.length);
console.log(`${malos.length} con fallos de axe`);
await nav.close(); cerrar();
