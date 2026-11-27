// Prueba de la web antes de publicarla (revisión total, A13). Sirve web/ en local, abre la liga de ejemplo con Chromium
// (Playwright) y corta todo lo que no sea localhost (también el Worker de verdad de soporte.js). Comprueba:
//   1. que la demo arranca sin errores de la página;
//   2. que las 7 pestañas (las 6 de abajo y Pregunta) pintan sin «.error-c», en el móvil y en el ordenador;
//   3. que una liga guardada rota (un campo que el motor no espera) no deja la app en «Abriendo…» (C2);
//   4. que con el Worker y Deno colgados la carga acaba en una pantalla con salida en menos de 40 s (A7);
//   5. que con el almacenamiento lleno de otras ligas y de la demo la sesión y el chat se siguen guardando (A8);
//   6. que en el parón el sitio de Directo es la pestaña Parón y su selector vuelve a Directo (21);
//   7. Ajustes (40): las secciones plegadas, el buscador, la antelación de cada aviso y «Avisarme» en la ficha, y que
//      calcular (avisos.js) usa la antelación elegida (rivales, tuyas, el once y un jugador concreto).
//   8. Novedades (11 nov): a quien no es el dueño, solo lo importante de cada versión y sus arreglos en pequeño, sin lo de otra plataforma.
//   9. (41) avisos del mercado con la app cerrada: puja ganada o perdida y los que te interesan y salen al mercado.
//  10. el plan sin IA, la IA (cuadrarPlan) y Hoy usan la misma regla para clausular (mereceClausula).
//  11. (24) el Parón mira el hueco en la plantilla y lo que sacarías vendiendo.
//  12. todas las fichas y hojas (Tu equipo hoy, jugador, rival, club, sustitutos, Ajustes, diagnóstico) abren sin error.
//  15. el plan con la IA de la app (el Worker, /plan, interceptado): llega, se repite tras un corte, sin cupo y con la ruta caída.
//  17. (22 nov, Domy) en Directo, los de tu once de la jornada cuentan como tuyos aunque ya los hayas vendido.
//  16. (22 nov) las bajas de la jornada: la cruz de Clubes, «pueden jugar» de Equipo, las pestañas, la ficha con «‹ Bajas» y la vuelta.
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

/* (21 nov) El reloj fijo. La liga de ejemplo se monta alrededor de «ahora» (demo.js: la jornada 10 empieza el próximo
   sábado a las 14:00), así que dos comprobaciones, la 10 (plan y Hoy) y la del fichaje en el parón, salían mal según la
   hora a la que se pasara la prueba: todo el lunes (jornada en juego), el sábado de 13:00 a 14:00 (la jornada ya jugada
   queda como «próxima» con las cláusulas cerradas) y ratos sueltos del domingo y el martes. El 21 nov eso paró una
   publicación a las 13:00. Esas dos se pasan ahora con el reloj de la página puesto en el miércoles a las 12:00 de Madrid
   (el de esta semana o el siguiente): simulada la semana entera cada 3 h, de miércoles a viernes no falla nunca, y el
   miércoles a las 12:00 tampoco en seis semanas distintas, con horario de invierno y de verano. No se saltan: se pasan
   siempre a la misma hora. `RELOJ=2026-11-28T13:30:00+01:00` las pasa a otra hora, para volver a ver el fallo. */
function miercolesAlas12() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZoneName: 'shortOffset' });
  for (let k = 0; k < 8; k++) {
    const p = Object.fromEntries(f.formatToParts(new Date(Date.now() + k * 864e5)).map((x) => [x.type, x.value]));
    if (p.weekday !== 'Wed') continue;
    const m = String(p.timeZoneName || '').match(/GMT([+-]\d+)(?::(\d+))?/);
    const off = m ? `${m[1].startsWith('-') ? '-' : '+'}${String(Math.abs(+m[1])).padStart(2, '0')}:${m[2] || '00'}` : '+01:00';
    return Date.parse(`${p.year}-${p.month}-${p.day}T12:00:00${off}`);
  }
  return Date.now();
}
const RELOJ = process.env.RELOJ ? Date.parse(process.env.RELOJ) : miercolesAlas12();

/** una página nueva: lo de fuera, cortado; `colgar` deja sin respuesta lo que vaya a esos hosts (el agujero negro);
    `reloj`: la hora (ms) en la que arranca el reloj de la página, que luego corre normal */
async function pagina({ init = '', ancho = 390, alto = 844, colgar = [], reloj = 0 } = {}) {
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
  await page.addInitScript(`localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); ${init}`);
  if (reloj) await page.clock.install({ time: reloj });
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
// selector vuelve al Directo de siempre (21, 9 nov). (14 nov) La 9, 14 días antes del sábado de la demo: con 9, un sábado
// por la tarde (el «próximo sábado» ya es el siguiente) la 9 seguía en juego y no había parón
for (const [ancho, alto, nombre] of [[390, 844, 'móvil'], [1280, 800, 'ordenador']]) {
  const { ctx, page, errores } = await pagina({ ancho, alto });
  await ctx.route('**/js/demo.js', async (r) => {
    const cuerpo = (await readFile(join(WEB, 'js', 'demo.js'), 'utf8')).replace('9: base - 7 * DIA, 10: base,', '9: base - 14 * DIA, 10: base + 7 * DIA,');
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

// 7: Ajustes (40), como en la app (un puente de Android de mentira): secciones, buscador, antelaciones y «Avisarme»
{
  const PUENTE = `window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, probarAlarma: () => {}, version: () => '1', canal: () => 'github', hayQR: () => false, programarAvisos: () => {}, notificar: () => {}, pedirPermisoAvisos: () => {} }, { get: (o, k) => (k in o ? o[k] : undefined) }); localStorage.setItem('fm-demo', 'true'); if (!localStorage.getItem('fm-cfg-avisos')) localStorage.setItem('fm-cfg-avisos', '{"on":true}');`;
  const { ctx, page, errores } = await pagina({ init: PUENTE });
  await page.goto(`${BASE}/index.html`);
  await page.waitForSelector('#vista', { timeout: 25000 }).catch(() => {});
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 15000 }).catch(() => {});
  // calcular con antelaciones que no son las de siempre
  const c = await page.evaluate(async () => {
    const A = await import('./js/avisos.js');
    const { D, M } = window.S, ahora = Date.now(), DIA = 864e5;
    const ok = (t) => t > ahora + 60e3 && t < ahora + 13 * DIA;
    const xs = M.clausulas.filter((x) => !x.abierta && x.protegidoHasta && !x.veda && ok(x.protegidoHasta - 30 * 60e3));
    if (!xs.length) return { sin: true };
    const jug = xs[0], riv = xs.filter((x) => x.pid !== jug.pid);
    const base = { ...A.cfgAvisos(), on: true, plan: false, rivales: true, mias: true, mercado: false, jornada: true, diario: false, interes: 0 };
    const cfg = { ...base, antes: { ...A.ANTES, rivales: 5, mias: 60, jornada: 30 }, jugadores: { [jug.pid]: { antes: 2 } } };
    const l = A.calcular(D, M, cfg);
    const porId = (id) => l.find((a) => a.id === id);
    const j = porId(`jug-${jug.pid}`);
    const r = riv.map((x) => porId(`cl15-${x.teamId}-${x.pid}`)).find(Boolean);
    const rx = r && riv.find((x) => r.id === `cl15-${x.teamId}-${x.pid}`);
    const jo = l.find((a) => a.id.startsWith('jornada-'));
    const miasB = A.calcular(D, M, { ...cfg, miasTodas: false }).filter((a) => /^mias?-/.test(a.id)).length, miasT = A.calcular(D, M, { ...cfg, miasTodas: true }).filter((a) => /^mias?-/.test(a.id)).length;
    const mia = l.find((a) => a.id.startsWith('mia-'));
    return {
      jug: !!j && Math.abs(j.t - (jug.protegidoHasta - 2 * 60e3)) < 1000 && /En 2 min/.test(j.titulo),
      sinRepetir: !l.some((a) => a.id === `cl15-${jug.teamId}-${jug.pid}`),
      // los de rivales salen solo si se pueden clausular (esClausulable); si no sale ninguno, no hay nada que mirar
      riv: !r || (Math.abs(r.t - (rx.protegidoHasta - 5 * 60e3)) < 1000 && /En 5 min/.test(r.titulo)),
      // (los «reabre15-» son de cláusulas en veda, que aquí no se miran: xs las deja fuera y avisos.js solo da «cl15-» a las
      // que no están en veda; contándolos, la prueba fallaba a las horas en que solo quedaban de veda)
      rivAlguno: !!r || !l.some((a) => /^cl15-/.test(a.id)),
      once: !M.proxima || !ok(M.proxima.ini) || (!!jo && /30 min/.test(jo.titulo) && Math.abs(jo.t - (M.proxima.ini - 30 * 60e3)) < 1000),
      mias: miasT >= miasB && (!mia || /1 h de protección/.test(mia.titulo)),
      txt: (A.tiempoTxt(90) === '1 h 30 min' && A.tiempoTxt(1440) === '1 día' && A.antesTxt(0) === 'Al abrirse'),
    };
  });
  if (c.sin) mal('Ajustes: la liga de ejemplo no trae cláusulas de rivales para probar calcular');
  else {
    const fallan = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
    if (fallan.length) mal(`calcular con la antelación elegida falla en: ${fallan.join(', ')}`);
    else bien('calcular usa la antelación elegida (jugador 2 min, rivales 5 min, tuyas 1 h, once 30 min)');
  }
  // Ajustes: cinco secciones cerradas; el buscador abre la que tiene lo buscado y esconde lo demás
  await page.evaluate(() => document.querySelector('#bAjustes').click());
  await page.waitForSelector('details.aj-sec', { timeout: 5000 }).catch(() => {});
  const a0 = await page.evaluate(() => ({ n: document.querySelectorAll('details.aj-sec').length, abiertas: document.querySelectorAll('details.aj-sec[open]').length, botonEnSummary: !!document.querySelector('details.aj-sec summary button, details.aj-sec summary select, details.aj-sec summary a') }));
  await page.fill('#buscaAj', 'once');
  const a1 = await page.evaluate(() => ({ abiertas: [...document.querySelectorAll('details.aj-sec[open]')].map((d) => d.dataset.k), filas: [...document.querySelectorAll('details.aj-sec .ajuste:not([hidden])')].filter((f) => !f.closest('details[hidden]')).map((f) => f.querySelector('b').textContent) }));
  await page.fill('#buscaAj', 'zzzz');
  const a2 = await page.evaluate(() => ({ nada: !document.querySelector('#aj-nada').hidden, visibles: document.querySelectorAll('details.aj-sec:not([hidden])').length }));
  await page.fill('#buscaAj', '');
  // cambiar la antelación de los rivales desde Ajustes
  await page.evaluate(() => { const d = document.querySelector('details.aj-sec[data-k="avisos"]'); if (!d.open) d.querySelector('summary').click(); });
  await page.waitForTimeout(200);
  await page.selectOption('select[data-cambia="avisoAntes"][data-k="rivales"]', '30').catch(() => {});
  await page.waitForTimeout(300);
  const a3 = await page.evaluate(async () => { const A = await import('./js/avisos.js'); return { antes: A.cfgAvisos().antes.rivales, sigueAbierta: !!document.querySelector('details.aj-sec[data-k="avisos"][open]') }; });
  // (0.8a) seis: con «Apodos de los rivales»
  if (a0.n !== 6 || a0.abiertas || a0.botonEnSummary) mal(`Ajustes: secciones mal (${JSON.stringify(a0)})`);
  else if (!a1.abiertas.includes('avisos') || !a1.filas.includes('Poner el once') || a1.filas.length > 3) mal(`Ajustes: el buscador no encuentra «once» bien (${JSON.stringify(a1)})`);
  else if (!a2.nada || a2.visibles) mal(`Ajustes: buscando algo que no hay no sale el aviso (${JSON.stringify(a2)})`);
  else if (a3.antes !== 30 || !a3.sigueAbierta) mal(`Ajustes: la antelación de rivales no se guarda o se cierra la sección (${JSON.stringify(a3)})`);
  else bien('Ajustes: 5 secciones cerradas, el buscador y la antelación de rivales');
  // «Avisarme» en la ficha de un jugador de un rival
  const f = await page.evaluate(async () => {
    const x = window.S.M.clausulas.find((y) => !y.abierta && y.protegidoHasta);
    if (!x) return { sin: true };
    document.querySelector('[data-accion="cerrarHoja"]').click();
    await new Promise((ok) => setTimeout(ok, 300));
    const b = document.createElement('button'); b.dataset.j = x.pid; document.body.append(b); b.click(); b.remove();
    await new Promise((ok) => setTimeout(ok, 400));
    return { pid: x.pid, hay: !!document.querySelector(`select[data-cambia="avisoJ"][data-pid="${x.pid}"]`) };
  });
  if (!f.sin) {
    await page.selectOption(`select[data-cambia="avisoJ"][data-pid="${f.pid}"]`, '15').catch(() => {});
    await page.waitForTimeout(300);
    const g = await page.evaluate(async (pid) => { const A = await import('./js/avisos.js'); const j = A.cfgAvisos().jugadores[pid]; return { antes: j && j.antes, on: A.cfgAvisos().on, marca: !!document.querySelector('.avisar-j.on') }; }, f.pid);
    if (!f.hay || g.antes !== 15 || !g.on || !g.marca) mal(`la ficha: «Avisarme» no funciona (${JSON.stringify({ ...f, ...g })})`);
    else bien('la ficha: «Avisarme de su cláusula» se guarda (15 min antes)');
  }
  if (errores.length) mal(`Ajustes: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 8: Novedades para todos (11 nov): en Ajustes → La app, a quien no es el dueño solo lo importante (importante: true),
// sin arreglos y sin lo de otra plataforma; en la web, nada de lo que es solo de la app (y nunca más de los que llevan importante:
// antes era un tope fijo de 8, que saltó al añadir la ficha del rival en la 0.7.8e)
// (20 nov, Carlos: «no quiero que les salga nada de las novedades a no ser que yo te lo estipule») esa lista solo sale con
// «novedadesImportantes» en limites.json; sin eso, a quien no es el dueño no le sale la fila de Novedades en Ajustes
// (la página lee limites.json del servidor de la prueba: se le sirve el de verdad con esa clave puesta o sin ella)
const LIMITES_DE_VERDAD = JSON.parse((await import('node:fs')).readFileSync(new URL('../web/limites.json', import.meta.url), 'utf8'));
for (const [nombre, init, conLista] of [['web', '', true], ['app', "window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '1', canal: () => 'github', hayQR: () => false, programarAvisos: () => {} }, { get: (o, k) => (k in o ? o[k] : undefined) }); localStorage.setItem('fm-demo', 'true');", true], ['web, sin encender', '', false]]) {
  // (la app lo lee de fuera, que aquí está cortado, y tira de lo guardado; la web, del servidor de la prueba: las dos cosas)
  const lim = conLista ? { ...LIMITES_DE_VERDAD, novedadesImportantes: true } : LIMITES_DE_VERDAD;
  const { ctx, page, errores } = await pagina({ init: `${init} localStorage.setItem('fm-limites', JSON.stringify({ t: Date.now(), cfg: ${JSON.stringify(lim)} }));` });
  await page.route('**/limites.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(lim) }));
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  // (a que la página haya leído limites.json)
  await page.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('fm-limites') || 'null'); } catch (e) { return false; } }, null, { timeout: 10000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const { NOVEDADES } = await import('./js/version.js');
    document.querySelector('#bAjustes').click();
    await new Promise((ok) => setTimeout(ok, 400));
    const fila = [...document.querySelectorAll('.ajuste')].find((f) => /^Novedades/.test(f.querySelector('b')?.textContent || ''));
    if (!fila) return { sinFila: true };
    const sub = fila.textContent;
    fila.querySelector('[data-accion="novedades"]').click();
    await new Promise((ok) => setTimeout(ok, 400));
    const t = [...document.querySelectorAll('.hoja .nvl-c b')].map((b) => b.textContent);
    const imp = NOVEDADES.flatMap((n) => n.cosas.filter((c) => c.importante));
    const arr = NOVEDADES.flatMap((n) => n.cosas.filter((c) => c.tipo === 'arreglo')); const li = [...document.querySelectorAll('.hoja .nvl-arreglos li')].map((x) => x.textContent);
    return { nuevo: /Nuevo en la/.test(sub), t, nImp: imp.length, soloImp: t.every((x) => imp.some((c) => c.t === x)), arreglos: !(li.length && li.every((x) => arr.some((c) => c.t === x))), alarmas: t.includes('Tus alarmas, cuándo quieras'), ajustes: t.includes('Ajustes, por secciones') };
  });
  if (!conLista) { if (r.sinFila) bien('Novedades (sin «novedadesImportantes»): a quien no es el dueño no le sale la fila en Ajustes'); else mal(`Novedades (${nombre}): sale la fila sin haberla encendido: ${JSON.stringify(r).slice(0, 200)}`); }
  else if (r.sinFila) mal(`Novedades (${nombre}): no sale la fila en Ajustes`);
  else if (!r.nuevo || !r.soloImp || r.arreglos || !r.ajustes || r.alarmas !== (nombre === 'app') || r.t.length > r.nImp) mal(`Novedades (${nombre}): ${JSON.stringify(r)}`);
  else bien(`Novedades (${nombre}): solo lo importante (${r.t.length}) y los arreglos en pequeño${nombre === 'web' ? ', sin lo de la app' : ''}`);
  if (errores.length) mal(`Novedades: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 9: (41) avisos del mercado con la app cerrada: puja ganada, puja perdida (con quién se lo lleva) y los que te interesan
// y salen al mercado; cada uno se apaga con su interruptor de Ajustes → Avisos y alarmas
{
  const { ctx, page, errores } = await pagina({ init: "localStorage.setItem('fm-cfg-avisos', '{\"on\":true}');" });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M && window.S.M.mercado, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const F = await import('./js/fondo.js'), A = await import('./js/avisos.js'), Fav = await import('./js/favoritos.js');
    const { D, M } = window.S, yo = D.yo.teamId;
    const antes = JSON.parse(JSON.stringify(D)); antes.demo = false; antes.t = Date.now() - 2 * 3600e3;
    const pidW = D.plantillas[yo][0].pid;
    antes.plantillas[yo] = antes.plantillas[yo].filter((f) => f.pid !== pidW);
    const otro = Object.keys(D.plantillas).find((t) => t !== yo && D.plantillas[t].length);
    const pidL = D.plantillas[otro][0].pid;
    antes.mercado.push({ id: 'pg', pid: pidW, tipo: 'liga', miPuja: 1e6 }, { id: 'pp', pid: pidL, tipo: 'liga', miPuja: 2e6 });
    M.actividad = [...(M.actividad || []), { pid: pidL, clase: 'compra', esYo: false, quien: 'Rival de prueba', importe: 3e6, t: Date.now() }];
    // uno del mercado de LaLiga, como favorito, que antes no estaba
    const nuevo = M.mercado.find((m) => m.tipo !== 'manager' && !m.miPuja);
    if (!Fav.esFav(nuevo.pid)) Fav.cambiarFav(nuevo.pid);
    antes.mercado = antes.mercado.filter((m) => m.pid !== nuevo.pid);
    const l = F.avisosNuevos(antes, D, M);
    A.guardarCfgAvisos({ pujas: false, enMercado: false });
    const apagado = F.avisosNuevos(antes, D, M);
    A.guardarCfgAvisos({ pujas: true, enMercado: true });
    const k = (x) => l.find((a) => a.k.startsWith(x));
    return {
      gana: !!k(`puja-gana:${pidW}`) && !k(`entra:${pidW}`),
      pierde: !!k(`puja-pierde:${pidL}`) && /Rival de prueba/.test(k(`puja-pierde:${pidL}`).texto),
      mercado: l.some((a) => a.k.startsWith('en-mercado:') && (a.k.includes(nuevo.pid) || /que te interesan/.test(a.titulo))),
      apagado: !apagado.some((a) => /^(puja-|en-mercado)/.test(a.k)) && apagado.some((a) => a.k.startsWith(`entra:${pidW}`)),
    };
  });
  const fallan = Object.entries(r).filter(([, v]) => !v).map(([x]) => x);
  if (fallan.length) mal(`avisos del mercado (41) fallan en: ${fallan.join(', ')}`);
  else bien('avisos del mercado (41): puja ganada, puja perdida, el favorito que sale y los interruptores');
  if (errores.length) mal(`avisos del mercado: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 10: (11 nov) el plan sin IA (planAuto) y Hoy/las alarmas (esClausulable) dicen lo mismo de una cláusula: con un
// hueco en su puesto y el dinero de sobra, el plan la manda si y solo si Hoy la da por clausulable (antes, con interés 52
// Hoy sí y el plan no; sin `mejora` y a 2 veces su valor, el plan sí y Hoy no)
{
  const { ctx, page, errores } = await pagina({ reloj: RELOJ });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    // (19 nov) con el plan del motor (plan.js), que es el que se ve sin IA desde el 14 nov: con planAuto, el de antes (solo
    // de reserva si el motor se rompe), fallaba según el día (el 18-19 nov esperaba a Niño por las pujas puestas)
    const Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js');
    const { D, c } = window.S;
    const M = Object.create(window.S.M);
    // (14 nov) una que esté abierta de verdad: con una cerrada, cuadrarPlan la descarta por la fecha y no por la regla
    const sano = (y) => !['injured', 'suspended', 'out_of_league'].includes(y.j.estado);
    const x = M.clausulas.find((y) => sano(y) && y.abierta) || M.clausulas.find(sano);
    if (!x) return { sin: true };
    M.clausulas = [x]; x.abierta = true; x.meLlega = true; x.ratio = 2; D.dinero = Math.max(D.dinero, x.clausula * 2 + 1e6);
    M.mias = M.mias.filter((y) => y.j.pos !== x.j.pos);
    Object.assign(M, { sobrecoste: () => ({ indice: -100 }), tolerancia: () => 100, conSalida: () => true, compraCal: () => ({ ok: true }) });
    const caso = (interes, mejora) => {
      x.interes = interes; M.mejora = () => mejora;
      return { plan: (Pm.planMotor(D, M, c).operaciones || []).some((o) => o.accion === 'clausular' && o.pid === x.pid), hoy: Mo.esClausulable(M, x) };
    };
    const res = { bueno: caso(80, 1), sinMejora: caso(80, 0), interes52: caso(52, 1), interes45: caso(45, 1) };
    // y la IA: una cláusula para el once que Hoy no da por buena sale en descartes, con el motivo
    const I = await import('./js/ia.js'), S0 = window.S.M, y = S0.clausulas.find((z) => z.pid === x.pid) || x;
    const P = () => ({ t: Date.now(), operaciones: [{ accion: 'clausular', ref: `C-${y.pid}`, jugador: y.j.nombre, objetivo: 'titular', importe: y.clausula, motivo: 'prueba' }] });
    const mej = S0.mejora, rat = y.ratio;
    S0.mejora = () => 0; y.ratio = 2;
    const op = (I.cuadrarPlan(P(), D, S0).ops || [])[0] || {};
    S0.mejora = mej; y.ratio = rat;
    res.ia = { plan: !op.descartada, hoy: false }; // Hoy no la enseña: el plan de la IA tampoco
    // (14 nov) según el día, la de la demo puede estar aún cerrada: entonces se descarta por la fecha, que también vale
    res.iaMotivo = !!op.descartada && /no es una cláusula que la app recomiende|no se abre hasta/.test(op.aviso || '');
    return res;
  });
  if (r.sin) mal('plan y Hoy: la liga de ejemplo no trae cláusulas para probar');
  else if (!r.iaMotivo) mal(`la IA: una cláusula que Hoy no da por buena no se descarta (${JSON.stringify(r.ia)})`);
  else {
    const mal1 = Object.entries(r).filter(([k, v]) => k !== 'iaMotivo' && v.plan !== v.hoy).map(([k]) => k);
    if (mal1.length || !r.bueno.plan || r.sinMejora.plan) mal(`plan y Hoy se contradicen en: ${mal1.join(', ') || JSON.stringify(r)}`);
    else bien('plan sin IA, la IA y Hoy: la misma regla para clausular (4 casos y el descarte de la IA)');
  }
  if (errores.length) mal(`plan y Hoy: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 10b: (14 nov) el plan sin IA lo hace el motor (plan.js) y Hoy no lo contradice: sale cuadrado (sin nada descartado ni
// «sin prisa»), cada paso con su porqué, y lo que el motor miró y dejó fuera («Mirados y descartados») no sale arriba
// como urgente
{
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M && window.S.plan, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const P = window.S.plan || {};
    const pasos = (P.ops || []).filter((o) => ['vender', 'clausular', 'pujar', 'comprar', 'blindar'].includes(o.accion));
    const fuera = (P.descartes || []).map((d) => String(d.pid));
    const hoy = document.querySelector('#vista, main, body').innerText || '';
    const nombres = (P.descartes || []).map((d) => d.jugador).filter((n) => new RegExp(`(Vende a|Clausula a|Puja por) ${n}`).test(hoy));
    return { motor: !!P.motor, titular: P.titular || '', tachados: (P.ops || []).filter((o) => o.descartada || o.sugerencia).length, sinMotivo: pasos.filter((o) => !String(o.motivo || '').trim()).length,
      pasos: pasos.length, enPlanYFuera: pasos.filter((o) => fuera.includes(String(o.pid))).length, arriba: nombres };
  });
  if (!r.motor) mal(`el plan sin IA no es el del motor (${r.titular})`);
  else if (r.tachados || r.sinMotivo || r.enPlanYFuera || !r.titular) mal(`el plan del motor: ${JSON.stringify(r)}`);
  else if (r.arriba.length) mal(`Hoy enseña como urgente lo que el plan del motor descartó: ${r.arriba.join(', ')}`);
  else bien(`el plan sin IA sale del motor, cuadrado y con su porqué (${r.pasos} pasos), y Hoy no lo contradice`);
  if (errores.length) mal(`plan del motor: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 11: (24) la pestaña Parón mira el hueco en la plantilla (contando tus pujas) y lo que sacarías vendiendo lo que te dice
// la app: con la plantilla llena sale el aviso, «Puedes ganar» solo cuenta lo que cabe y lo que te llega vendiendo antes
// va marcado
{
  const { ctx, page, errores } = await pagina();
  await ctx.route('**/js/demo.js', async (r) => {
    const cuerpo = (await readFile(join(WEB, 'js', 'demo.js'), 'utf8')).replace('9: base - 7 * DIA, 10: base,', '9: base - 14 * DIA, 10: base + 7 * DIA,');
    r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: cuerpo });
  });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const P = await import('./js/paron.js');
    const S = window.S, M = S.M;
    const a = P.cuentasParon(S);
    const pujas = (S.D.mercado || []).filter((m) => m.miPuja).length;
    const base = a.tengo === M.mias.length + pujas && a.plazas === Math.max(0, P.PLANTILLA_MAX - a.tengo);
    // lo de revender: el tuyo que más vale; sin saldo ni margen de puja, lo que sube pasa a «no te llega»
    const rico = [...M.mias].filter((x) => x.j.pos !== 5).sort((x, y) => y.j.valor - x.j.valor)[0];
    const M2 = Object.create(M); M2.paraRevender = [{ ...rico, rev: { precio: rico.j.valor }, beneficioYa: 0 }]; M2.pujaMax = 0;
    const D2 = { ...S.D, dinero: 0, mercado: [...(S.D.mercado || [])] };
    const b = P.cuentasParon({ ...S, M: M2, D: D2 });
    const vend = b.espNo.filter((e) => e.vendiendo);
    // (27 nov) con la inercia gratis, lo que sacas vendiendo suma también lo que está en lo alto (`altos`), no solo lo de revender
    const okVenta = b.ventas.some((x) => x.pid === rico.pid) && b.venta === b.ventas.reduce((t, x) => t + x.j.valor, 0) && vend.every((e) => e.falta <= b.venta) && b.espNo.filter((e) => !e.vendiendo).every((e) => e.falta > b.venta);
    // la plantilla llena: «Puedes ganar» con lo que cabe (aquí, solo el hueco que hace la venta)
    for (let i = 0; i < P.PLANTILLA_MAX; i++) D2.mercado.push({ id: `f${i}`, pid: `x${i}`, tipo: 'liga', miPuja: 1 });
    const c = P.cuentasParon({ ...S, M: M2, D: D2 });
    const okLlena = c.plazas === 0 && c.caben === c.ventas.length && c.gana === c.esp.slice(0, Math.min(3, c.caben)).reduce((t, e) => t + e.beneficio, 0);
    return { base, okVenta, okLlena, n: [a.tengo, b.espNo.length, vend.length] };
  });
  await page.evaluate(() => { const S = window.S; for (let i = 0; i < 25; i++) S.D.mercado.push({ id: `g${i}`, pid: `y${i}`, tipo: 'liga', miPuja: 1 }); document.querySelector('.nav button[data-ir="directo"]').click(); });
  await page.waitForTimeout(800);
  const aviso = await page.evaluate(() => { const h = document.querySelector('#vista .pnz-hueco'); return h ? h.textContent : (document.querySelector('#vista .pnz-c') ? 'FALTA' : 'sin compras'); });
  const fallan = Object.entries(r).filter(([k, v]) => k !== 'n' && !v).map(([k]) => k);
  if (fallan.length || aviso === 'FALTA') mal(`Parón (24): falla en ${[...fallan, aviso === 'FALTA' ? 'aviso' : ''].filter(Boolean).join(', ')} (${JSON.stringify(r.n)})`);
  else bien(`Parón (24): hueco en la plantilla, lo que sacas vendiendo y el aviso de plantilla llena (${/Plantilla llena/.test(aviso) ? 'sale' : aviso}; tengo, sin llegar y llegan vendiendo: ${r.n.join(', ')})`);
  if (errores.length) mal(`Parón (24): errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 12: (11 nov) todas las fichas y hojas abren sin «No se ha podido abrir»: Tu equipo hoy (el marcador de Hoy; en la
// 0.7.4 se perdió `rango` y fallaba), jugador tuyo, de un rival y libre, rival, club, sustitutos, Ajustes y diagnóstico
for (const [ancho, alto, nombre] of [[390, 844, 'móvil'], [1280, 800, 'ordenador']]) {
  const { ctx, page, errores } = await pagina({ ancho, alto });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const { M } = window.S;
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const abrir = async (attrs) => { const b = document.createElement('button'); Object.assign(b.dataset, attrs); document.body.append(b); b.click(); b.remove(); await espera(500); };
    const mira = () => { const h = document.querySelector('.hoja'); const e = h && h.querySelector('.error-c'); const t = e ? e.textContent.trim().slice(0, 90) : null; const x = document.querySelector('.hoja [data-accion="cerrarHoja"]'); if (x) x.click(); return h ? t : 'no se abre'; };
    const out = {};
    const marcador = document.querySelector('#vista .marcador');
    if (marcador) { marcador.click(); await espera(500); out.tuEquipo = mira(); await espera(200); } else out.tuEquipo = 'sin marcador';
    const casos = { mio: { j: M.mias[0] && M.mias[0].pid }, deRival: { j: M.clausulas[0] && M.clausulas[0].pid }, libre: { j: (M.mercado.find((m) => m.tipo === 'liga') || {}).pid }, rival: { r: M.clausulas[0] && M.clausulas[0].teamId }, club: { club: M.mias[0] && M.mias[0].j.equipoId }, sustitutos: { accion: 'sustituto', pid: M.mias[0] && M.mias[0].pid }, ajustes: { accion: 'ajustes' } };
    for (const [k, a] of Object.entries(casos)) { if (Object.values(a).some((v) => v == null)) { out[k] = 'sin datos'; continue; } await abrir(a); out[k] = mira(); await espera(200); }
    document.querySelector('#bAjustes').click(); await espera(400);
    const d = document.querySelector('.hoja [data-accion="diag"]'); if (d) { d.click(); await espera(500); out.diag = mira(); }
    return out;
  });
  const fallan = Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  if (fallan.length) mal(`${nombre}: fichas con error: ${fallan.join(' · ')}`);
  else bien(`${nombre}: Tu equipo hoy, las fichas, Ajustes y el diagnóstico abren sin error (${Object.keys(r).length})`);
  if (errores.length) mal(`${nombre} fichas: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 13: la versión nueva se pone sola (0.8.4r, 26 nov; antes, desde la 0.7.6, la ventana que no se cierra): en la app (con
// un puente de Android de mentira: paquete.json y app.json por su http) AlDia la baja y la página se recarga sin ventana;
// con algo a medias espera; la ventana de siempre solo si AlDia falla o tras 2 intentos que no cambian la versión
{
  const puente = (cfg) => `(() => {
    const C = ${JSON.stringify(cfg)}; window.__fm = { C, bajadas: [], busquedas: 0 };
    const cargas = (Number(sessionStorage.getItem('cargas')) || 0) + 1;
    sessionStorage.setItem('cargas', String(cargas));
    // (soloUna) tras la primera recarga ya está la nueva: el paquete publicado deja de ser más nuevo
    const paquete = C.soloUna && cargas > 1 ? { ...C.paquete, version: '0.0.1' } : C.paquete;
    const resp = {};
    window.__soltar = null;
    window.FantasyApp = new Proxy({
      avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '5000', canal: () => C.canal, hayQR: () => false, programarAvisos: () => {},
      nativo: () => 'h1', web: () => JSON.stringify({ propia: 'x', activa: null, error: C.error || null }),
      http: (id, m, url) => {
        const b = /paquete\\.json/.test(url) ? paquete : /app\\.json/.test(url) ? C.app : null;
        resp[id] = JSON.stringify(b ? { s: 200, b: JSON.stringify(b) } : { s: 404, b: '' });
        // (retener) el paquete no contesta hasta que la prueba lo suelta: así se pone antes lo que esté a medias
        if (C.retener && /paquete\\.json/.test(url) && cargas === 1) { window.__soltar = () => window.__http(id); return; }
        setTimeout(() => window.__http(id), 30);
      },
      respuesta: (id) => resp[id],
      buscarWeb: () => { window.__fm.busquedas++; setTimeout(() => window.webBuscada && window.webBuscada(C.buscar), 200); return true; },
      actualizar: (u) => window.__fm.bajadas.push(u),
      webViva: () => {},
    }, { get: (o, k) => (k in o ? o[k] : undefined) });
    localStorage.setItem('fm-demo', 'true');
  })();`;
  // (22 nov) el APK de GitHub cerró el 21 nov y, pasada esa fecha, la pantalla del cierre tapaba lo que miran estas
  // comprobaciones (la «Web» de main dejó de publicar): aquí el cierre va apagado, que se mira aparte (17)
  const sinCierre = `localStorage.setItem('fm-limites', JSON.stringify({ t: Date.now(), cfg: { cierreApk: false } })); localStorage.setItem('fm-tema-aviso', String(Date.now())); localStorage.setItem('fm-beta-aviso', String(Date.now()));`;
  // (y sin los avisos del tema del evento y de la beta, que son un tutorial: con uno abierto, la versión nueva espera)
  const cargas = (page) => page.evaluate(() => Number(sessionStorage.getItem('cargas'))).catch(() => 0);
  const botones = (page) => page.$$eval('#forzar button', (bs) => bs.map((b) => b.textContent.trim() + (b.disabled ? '(off)' : ''))).catch(() => []);
  const casos = [
    // se baja, se recarga y ya es la nueva: ni ventana ni más recargas
    ['Google Play, se pone sola', { canal: 'play', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'nueva', soloUna: true }, 'sola'],
    // la recarga no cambia la versión (AlDia no la pone): un segundo intento y luego la ventana, sin bucle
    ['Google Play, la recarga no la pone', { canal: 'play', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'nueva' }, 'dos'],
    ['Google Play, AlDia ya la descartó', { canal: 'play', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'igual' }, 'reintentar'],
    ['Google Play, AlDia sin red', { canal: 'play', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'error: sin red' }, 'reintentar'],
    // (0.7.13j) el APK de GitHub ya no se publica: con la parte Android nueva no ofrece ninguna descarga
    ['APK de GitHub con parte Android nueva', { canal: 'github', paquete: { version: '9.9.9', nativo: 'h2' }, buscar: 'apk' }, 'nada'],
    ['Google Play con parte Android nueva', { canal: 'play', paquete: { version: '9.9.9', nativo: 'h2' }, buscar: 'apk' }, 'nada'],
    ['la publicada no es más nueva', { canal: 'play', paquete: { version: '0.0.1', nativo: 'h1' }, buscar: 'igual' }, 'nada'],
  ];
  for (const [nombre, cfg, espera] of casos) {
    const { ctx, page, errores } = await pagina({ init: puente(cfg) + sinCierre });
    await page.goto(`${BASE}/index.html`);
    let r = '';
    if (espera === 'nada') {
      await page.waitForTimeout(2500);
      if (await page.$('#forzar')) r = 'sale la ventana y no debía';
      else if (await cargas(page) > 1) r = 'se recarga y no debía';
    } else if (espera === 'sola') {
      // sin ventana en ningún momento: se mira cada poco mientras se pone
      let vista = false;
      for (let i = 0; i < 20; i++) { if (await page.$('#forzar').catch(() => null)) vista = true; await page.waitForTimeout(250); }
      await page.waitForFunction(() => window.S && window.S.D, null, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const n = await cargas(page);
      if (vista || await page.$('#forzar')) r = 'sale la ventana';
      else if (n !== 2) r = `${n} cargas (tenía que recargar una vez)`;
    } else if (espera === 'dos') {
      await page.waitForFunction(() => Number(sessionStorage.getItem('cargas')) >= 3 && !!document.getElementById('forzar'), null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const n = await cargas(page), b = await botones(page);
      if (n !== 3) r = `${n} cargas (tenían que ser 2 recargas y parar)`;
      else if (b.join() !== 'Actualizar ahora') r = `tras 2 intentos, la ventana no sale o trae ${b.join() || 'nada'}`;
    } else {
      await page.waitForSelector('#forzar', { timeout: 5000 }).catch(() => {});
      const b = await botones(page);
      if (!b.length) r = 'no sale la ventana de reserva';
      else if (b.join() !== 'Volver a intentarlo') r = `botones tras el fallo ${b.join()}`;
      else {
        const txt = await page.$eval('#forzar p', (p) => p.textContent);
        if (/sin red/.test(cfg.buscar) && !/sin red/.test(txt)) r = `no dice el motivo: ${txt}`;
        if (await cargas(page) > 1) r = 'se ha recargado sin tener la nueva';
      }
    }
    if (r) mal(`app nueva, ${nombre}: ${r}`); else bien(`app nueva, ${nombre}: ${{ nada: 'no hace nada', sola: 'se pone sola, sin ventana', dos: '2 intentos y la ventana, sin bucle', reintentar: 'la ventana con «Volver a intentarlo»' }[espera]}`);
    if (errores.length) mal(`app nueva, ${nombre}: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
    await ctx.close();
  }
  // con una pregunta a la IA en marcha espera (ni ventana ni recarga, tampoco al irse a segundo plano); al acabar, se pone sola
  {
    const { ctx, page, errores } = await pagina({ init: puente({ canal: 'play', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'nueva', soloUna: true, retener: true }) + sinCierre });
    await page.goto(`${BASE}/index.html`);
    await page.waitForFunction(() => window.S && window.S.D && window.S.M && !window.S.cargando && typeof window.__soltar === 'function', null, { timeout: 25000 }).catch(() => {});
    await page.evaluate(() => { window.S.charlando = true; window.__soltar(); });
    await page.waitForTimeout(1500);
    // a segundo plano con la pregunta en marcha
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(800);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    const r1 = await page.evaluate(() => ({ cargas: Number(sessionStorage.getItem('cargas')), forzar: !!document.getElementById('forzar'), busca: window.__fm.busquedas, espera: window.S.sola && window.S.sola.espera }));
    let r = '';
    if (r1.cargas !== 1 || r1.forzar || r1.busca) r = `con la pregunta en marcha: ${r1.cargas} cargas, ventana ${r1.forzar}, ${r1.busca} descargas`;
    else if (r1.espera !== 'pregunta') r = `no dice que espera a la pregunta (${r1.espera})`;
    else {
      await page.evaluate(() => { window.S.charlando = false; });
      await page.waitForFunction(() => Number(sessionStorage.getItem('cargas')) >= 2, null, { timeout: 15000 }).catch(() => {});
      const n = await cargas(page);
      if (n !== 2) r = `al acabar la pregunta no se pone (${n} cargas, espera «${await page.evaluate(() => window.S.sola && window.S.sola.espera).catch(() => '?')}»)`;
      else if (await page.$('#forzar')) r = 'al acabar sale la ventana';
    }
    if (r) mal(`app nueva, con una pregunta en marcha: ${r}`); else bien('app nueva, con una pregunta en marcha: espera (también en segundo plano) y al acabar se pone sola');
    if (errores.length) mal(`app nueva, con una pregunta en marcha: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
    await ctx.close();
  }
  // con una ficha abierta espera y, al irse a segundo plano, se pone; al volver, la misma pestaña y la misma ficha
  {
    const { ctx, page, errores } = await pagina({ init: puente({ canal: 'play', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'nueva', soloUna: true, retener: true }) + sinCierre });
    await page.goto(`${BASE}/index.html`);
    await page.waitForFunction(() => window.S && window.S.D && window.S.M && !window.S.cargando && typeof window.__soltar === 'function', null, { timeout: 25000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('[data-ir="mercado"]')?.click());
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('#vista [data-j]')?.click());
    await page.waitForSelector('.hoja', { timeout: 4000 }).catch(() => {});
    const antes = await page.evaluate(() => ({ vista: window.S.vista, hoja: window.S.tipoHoja && window.S.tipoHoja.join(':') }));
    await page.evaluate(() => window.__soltar());
    await page.waitForTimeout(1500);
    let r = '';
    const n1 = await cargas(page);
    if (!antes.hoja) r = 'no se ha abierto la ficha';
    else if (n1 !== 1) r = 'recarga con la ficha abierta';
    else {
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(() => Number(sessionStorage.getItem('cargas')) >= 2, null, { timeout: 8000 }).catch(() => {});
      await page.waitForFunction(() => window.S && window.S.D && window.S.M && window.S.tipoHoja, null, { timeout: 25000 }).catch(() => {});
      const d = await page.evaluate(() => ({ cargas: Number(sessionStorage.getItem('cargas')), vista: window.S && window.S.vista, hoja: window.S && window.S.tipoHoja && window.S.tipoHoja.join(':'), forzar: !!document.getElementById('forzar') }));
      if (d.cargas !== 2) r = `al irse a segundo plano no se pone (${d.cargas} cargas)`;
      else if (d.forzar) r = 'sale la ventana';
      else if (d.vista !== antes.vista || d.hoja !== antes.hoja) r = `vuelve a ${d.vista} / ${d.hoja} y estaba en ${antes.vista} / ${antes.hoja}`;
    }
    if (r) mal(`app nueva, con una ficha abierta: ${r}`); else bien('app nueva, con una ficha abierta: espera, se pone al irse a segundo plano y vuelve a la misma pestaña y ficha');
    if (errores.length) mal(`app nueva, con una ficha abierta: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
    await ctx.close();
  }
  // en la web (iPhone, ordenador): se pone sola con recargarWeb; si la recarga no la trae (la caché del iPhone), un segundo
  // intento y luego la ventana con lo de cerrar la web del todo
  {
    const { ctx, page, errores } = await pagina({ init: `localStorage.setItem('fm-tema-aviso', String(Date.now())); localStorage.setItem('fm-beta-aviso', String(Date.now())); sessionStorage.setItem('cargas', String((Number(sessionStorage.getItem('cargas')) || 0) + 1));` });
    await page.route('**/paquete.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: '9.9.9', archivos: {} }) }));
    await page.goto(`${BASE}/index.html#mercado`);
    await page.waitForFunction(() => Number(sessionStorage.getItem('cargas')) >= 3 && !!document.getElementById('forzar'), null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const d = await page.evaluate(() => ({ cargas: Number(sessionStorage.getItem('cargas')), t: (document.getElementById('forzar') || {}).textContent || '', hash: location.hash, sola: JSON.stringify(window.S && window.S.sola), reg: localStorage.getItem('fm-nueva-sola') }));
    let r = '';
    if (d.cargas !== 3) r = `${d.cargas} cargas (tenían que ser 2 recargas y parar; ${d.sola}, ${d.reg})`;
    else if (!/cierra la web del todo/.test(d.t)) r = `tras 2 intentos, la ventana no sale o no dice que la cierre: ${d.t.slice(0, 80)}`;
    else if (d.hash !== '#mercado') r = `vuelve a ${d.hash}`;
    if (r) mal(`web nueva: ${r}`); else bien('web nueva: se pone sola, 2 intentos como mucho y la ventana de reserva, en la misma pestaña');
    if (errores.length) mal(`web nueva: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
    await ctx.close();
  }
  // app.json con «nativo» que no casa a propósito: esta web mira «huella» y no saca la banda
  {
    const { ctx, page } = await pagina({ init: puente({ canal: 'github', paquete: { version: '0.0.1', nativo: 'h1' }, app: { version: 99999, nombre: '0.0.1', huella: 'h1', nativo: 'obligar-h1', apk: 'x' }, buscar: 'igual' }) });
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(6000);
    const banda = await page.evaluate(() => !!window.S.nueva);
    if (banda) mal('app.json con «obligar-»: esta web saca la banda de app nueva'); else bien('app.json con «obligar-»: esta web mira «huella» y no saca la banda');
    await ctx.close();
  }
}

// 14: el valor del equipo día a día cuenta los jugadores que tenías cada día (0.7.6a): un fichaje de hace 3 días no
// suma lo que subió antes de ser tuyo, y uno vendido hace 2 sí suma lo que subió mientras lo era
{
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const H = await import('./js/hojas.js'); const S = window.S, M = S.M, DIA = 864e5, now = Date.now();
    const mio = M.mias.find((x) => x.j && (M.tend(x.pid).serie || []).length > 5);
    const ajeno = Object.values(S.D.maestro).find((j) => j.valor > 5e6 && !M.mias.some((x) => x.pid === j.id) && (M.tend(j.id).serie || []).length > 5);
    if (!mio || !ajeno) return { sin: true };
    const sin = H.sumaJugadores({ ...S, M: { ...M, actividad: [] } });
    const con = H.sumaJugadores({ ...S, M: { ...M, actividad: [{ t: now - 3 * DIA, pid: mio.pid, clase: 'compra', esYo: true, contraMi: false }, { t: now - 2 * DIA, pid: ajeno.id, clase: 'venta', esYo: true, contraMi: false }] } });
    const vEn = (pid, t) => { const s = M.tend(pid).serie.slice().sort((a, b) => a[0] - b[0]); let v = s[0][1]; for (const [ts, val] of s) { if (ts <= t + DIA / 2) v = val; else break; } return v; };
    const n = con.length, sube = (pid, i) => vEn(pid, con[i][0]) - vEn(pid, con[i - 1][0]), dif = (i) => (con[i][1] - con[i - 1][1]) - (sin[i][1] - sin[i - 1][1]);
    // hoy y ayer, igual; anteayer, + lo del vendido; el día antes, + lo del vendido − lo del fichado
    const espera = [[n - 1, 0], [n - 2, 0], [n - 3, sube(ajeno.id, n - 3)], [n - 4, sube(ajeno.id, n - 4) - sube(mio.pid, n - 4)]];
    return { mal: espera.filter(([i, e]) => Math.abs(dif(i) - e) > 1).map(([i, e]) => `${i}: ${Math.round(dif(i))} y debía ${Math.round(e)}`), hoy: Math.round(con[n - 1][1] - sin[n - 1][1]) };
  });
  if (r.sin) mal('valor del equipo: la demo no trae jugadores con serie');
  else if (r.mal.length || r.hoy) mal(`valor del equipo día a día: ${r.mal.join(' · ')}${r.hoy ? ` · hoy no cuadra (${r.hoy})` : ''}`);
  else bien('valor del equipo día a día: cuenta los jugadores que tenías cada día');
  if (errores.length) mal(`valor del equipo: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 15: (14 nov) el plan con la IA de la app (el Worker, /plan, interceptado): sin clave de Google, el plan llega por ahí con el
// pedido corto y sin instrucciones de la app; con el cupo gastado se queda el plan de la app con una caja clara (en la web,
// sin anuncio) y no se pide solo otro; con la ruta caída, un error claro. La hoja del anuncio de un plan de más
{
  const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
  const { ctx, page, errores } = await pagina({ init: `localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)});` });
  let modo = 'bien', cuerpo = null, rids = [];
  await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', async (r) => {
    const q = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (!q.url().endsWith('/plan')) return r.abort('blockedbyclient');
    cuerpo = JSON.parse(q.postData() || 'null');
    rids.push(cuerpo && cuerpo.rid);
    if (modo === 'caido') return r.abort('connectionrefused');
    // (15 nov) la conexión se corta la primera vez: la app lo repite sola con el mismo id
    if (modo === 'corte' && rids.length === 1) return r.abort('connectionreset');
    // (15 nov) la app se va a segundo plano y la petición se queda colgada: al volver (fm-vuelta) se repite con el mismo id
    if (modo === 'colgado' && rids.length === 1) return new Promise((ok) => setTimeout(ok, 20000)).then(() => r.abort('timedout')).catch(() => {});
    const cupo = (u) => ({ usados: u, gratis: 2, max: 5, extras: 0, quedan: Math.max(0, 2 - u), masConAnuncio: true });
    if (modo === 'cupo') return r.fulfill({ status: 429, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ e: 'Ya has hecho tus 2 planes con la IA de hoy.', cupo: cupo(2) }) });
    if (modo === 'tarde') return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: `     ${JSON.stringify({ e: 'La IA de los planes no contesta ahora mismo.', estado: 503, servicio: true })}` });
    return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: `   ${JSON.stringify({ plan: { pasos: [{ id: 'p1', frase: 'Este paso lo explica la IA de la app.' }], quita: [], mete: [], situacion: '', noticias: [], rivales: [], titular: 'Titular de prueba de la IA de la app' }, cupo: cupo(1), tok: { entra: 5200, sale: 2500 } })}` });
  });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M && window.S.plan, null, { timeout: 25000 }).catch(() => {});
  const prueba = (m) => page.evaluate(async (m) => {
    const ia = await import('/js/ia.js');
    const S = window.S;
    try { const P = await ia.planDelDia(S.D, S.M, S.c, { demo: false }); return { ok: true, app: !!P.app, titular: P.titular, corto: !!P.corto, frase: ((P.operaciones || []).some((o) => o._k) ? ((P.operaciones || []).find((o) => /IA de la app/.test(o.motivo || '')) || {}).motivo || '' : 'sin pasos hoy'), cupo: ia.cupoPlanes(), auto: ia.planViejoAuto(S.M, false) }; } catch (e) { return { ok: false, e: e.message, cupo: e.cupo || null, servicio: !!e.servicio, cache: ia.cupoPlanes(), auto: ia.planViejoAuto(S.M, false) }; }
  }, m);
  const sinClave = await page.evaluate(async () => { const ia = await import('/js/ia.js'); return !ia.hayClave() && ia.planesApp(false) && ia.puedePlanIA(false) && !ia.planesApp(true); });
  if (!sinClave) mal('IA de la app: sin clave de Google no se puede pedir el plan con la IA de la app (planes.on de limites.json)');
  let r = await prueba('bien');
  if (!r.ok || !r.app || !r.corto || r.titular !== 'Titular de prueba de la IA de la app' || !r.frase || !r.cupo || r.cupo.quedan !== 1) mal(`IA de la app: el plan no llega bien: ${JSON.stringify(r)}`);
  else if (!cuerpo || !/^HOY: /.test(cuerpo.pedido) || 'sistema' in cuerpo || !['broma', 'serio'].includes(cuerpo.tono) || !Array.isArray(cuerpo.bloq) || cuerpo.extra !== false) mal(`IA de la app: lo que se manda al Worker: ${JSON.stringify(cuerpo).slice(0, 200)}`);
  else bien(`IA de la app: el plan llega por el Worker, sin clave y con el pedido corto (${cuerpo.pedido.length} caracteres, alias: ${JSON.stringify(cuerpo.alias)})`);
  modo = 'corte'; rids = [];
  r = await prueba('corte');
  if (!r.ok || !r.app || rids.length !== 2 || !rids[0] || rids[0] !== rids[1]) mal(`IA de la app: con un corte, se repite una vez con el mismo id: ${JSON.stringify(r).slice(0, 160)} · ${JSON.stringify(rids)}`);
  else bien('IA de la app: se corta la conexión y la app lo repite sola una vez, con el mismo id (no cuenta dos veces)');
  modo = 'colgado'; rids = [];
  const vuelta = page.evaluate(() => new Promise((ok) => setTimeout(() => { window.dispatchEvent(new Event('fm-vuelta')); ok(); }, 1500)));
  const t0c = Date.now();
  r = await prueba('colgado');
  await vuelta;
  const segC = Math.round((Date.now() - t0c) / 1000);
  if (!r.ok || !r.app || rids.length !== 2 || rids[0] !== rids[1] || segC > 12) mal(`IA de la app: al volver de segundo plano con la petición colgada: ${JSON.stringify(r).slice(0, 160)} · ${JSON.stringify(rids)} · ${segC} s`);
  else bien(`IA de la app: vuelve de segundo plano con el plan colgado y lo recoge con el mismo id (${segC} s)`);
  const ridSuelto = await page.evaluate(() => localStorage.getItem('fm-plan-rid'));
  if (ridSuelto) mal(`IA de la app: el id del pedido se queda guardado tras llegar el plan: ${ridSuelto}`);
  modo = 'cupo';
  r = await prueba('cupo');
  if (r.ok || !r.cupo || r.cupo.quedan !== 0 || !r.cache || r.auto) mal(`IA de la app: con el cupo gastado: ${JSON.stringify(r)}`);
  else bien('IA de la app: con los 2 de hoy gastados, error de cupo, se guarda y no se pide otro solo');
  const caja = await page.evaluate(async (cu) => {
    window.S.planEstado = { cupo: cu, error: 'Ya has hecho tus 2 planes con la IA de hoy.' };
    window.dispatchEvent(new Event('limites-nuevos'));
    await new Promise((ok) => setTimeout(ok, 300));
    const c = document.querySelector('.plan-cupo');
    return { t: c ? c.innerText.replace(/\s+/g, ' ') : '', boton: !!(c && c.querySelector('button')), error: !!document.querySelector('.plan .error-c'), plan: !!document.querySelector('.plan-titular') };
  }, r.cupo);
  if (!caja.t || caja.boton || caja.error || !caja.plan || !/Mañana tienes otros 2/.test(caja.t)) mal(`IA de la app: la caja sin cupo en la web: ${JSON.stringify(caja)}`);
  else bien(`IA de la app: sin cupo, el plan de la app y la caja, sin anuncio en la web («${caja.t.slice(0, 70)}…»)`);
  modo = 'tarde';
  r = await prueba('tarde');
  if (r.ok || !r.servicio || !/no contesta/.test(r.e)) mal(`IA de la app: el error en el cuerpo (con la respuesta empezada): ${JSON.stringify(r)}`);
  else bien('IA de la app: un error con la respuesta ya empezada se entiende');
  modo = 'caido';
  r = await prueba('caido');
  if (r.ok || !r.servicio || !r.e) mal(`IA de la app: con la ruta caída: ${JSON.stringify(r)}`);
  else bien(`IA de la app: con la ruta caída, error claro («${r.e.slice(0, 60)}…»)`);
  const hoja = await page.evaluate(async () => { const h = await import('/js/hojas.js'); return h.anuncioHTML({ anuncio: {}, D: { demo: false } }, 'plan'); });
  if (!/Otro plan con la IA/.test(hoja) || !/data-para="plan"/.test(hoja) || !/hasta 5/.test(hoja)) mal(`IA de la app: la hoja del anuncio de un plan de más: ${hoja.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160)}`);
  else bien('IA de la app: la hoja del anuncio de un plan de más, como la de las funciones top');
  if (errores.length) mal(`IA de la app: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 15d: (23 nov, Carlos: «cuando me salgo de la aplicación no me sale ninguna notificación») debajo de «Preparando tu plan»,
// en la app de Google Play: con las notificaciones apagadas se dice que así no puede avisar, con un botón que pide el permiso
// (sin encender las alarmas), y al darlo cambia solo. Y «Quién usa la app» (23 nov, «suele tardar bastante en cargar»): sale al
// momento lo de la última vez con «Actualizando…», se cambia por lo nuevo al llegar y, si no llega, lo dice
{
  const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
  const puente = `window.__notif = false; window.__pidePermiso = 0; window.FantasyApp = new Proxy({ avisosPermitidos: () => window.__notif, alarmasExactas: () => true, version: () => '9999', canal: () => 'play', hayQR: () => false, programarAvisos: () => {}, notificar: () => {}, pedirPermisoAvisos: () => { window.__pidePermiso++; } }, { get: (o, k) => (k in o ? o[k] : undefined) }); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)});`;
  const { ctx, page, errores } = await pagina({ init: puente });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 25000 }).catch(() => {});
  const tarjeta = () => page.evaluate(async () => {
    window.S.planEstado = { cargando: true, paso: '' };
    window.dispatchEvent(new Event('limites-nuevos'));
    await new Promise((ok) => setTimeout(ok, 300));
    const p = document.querySelector('#plan-notif');
    return p ? { t: p.innerText.replace(/\s+/g, ' '), boton: !!p.querySelector('[data-accion="permisoPlan"]') } : null;
  });
  let t = await tarjeta();
  if (!t || !t.boton || !/notificaciones apagadas/.test(t.t) || !/se sigue haciendo/.test(t.t)) mal(`notificaciones del plan: con ellas apagadas no se dice ni se ofrece activarlas: ${JSON.stringify(t)}`);
  else bien(`notificaciones del plan: con ellas apagadas lo dice y ofrece activarlas («${t.t.slice(0, 90)}…»)`);
  const tras = await page.evaluate(async () => {
    const avisosAntes = localStorage.getItem('fm-cfg-avisos');
    document.querySelector('#plan-notif [data-accion="permisoPlan"]').click();
    await new Promise((ok) => setTimeout(ok, 100));
    const pidio = window.__pidePermiso;
    window.__notif = true;
    window.permisoAvisos(true);
    await new Promise((ok) => setTimeout(ok, 100));
    const p = document.querySelector('#plan-notif');
    const tos = document.querySelector('.tostada');
    return { pidio, avisos: localStorage.getItem('fm-cfg-avisos') === avisosAntes, t: p ? p.innerText.replace(/\s+/g, ' ') : '', boton: !!(p && p.querySelector('button')), tostada: tos ? tos.textContent : '' };
  });
  if (tras.pidio !== 1 || !tras.avisos || tras.boton || !/te aviso cuando esté/.test(tras.t) || tras.tostada !== 'Notificaciones activadas') mal(`notificaciones del plan: el botón y el cambio al dar el permiso: ${JSON.stringify(tras)}`);
  else bien('notificaciones del plan: el botón pide el permiso (sin tocar las alarmas) y al darlo cambia a «te aviso cuando esté»');
  if (errores.length) mal(`notificaciones del plan: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}
{
  // «Quién usa la app» (en la web: en la app las peticiones van por la parte de Android): lo guardado sale al momento y lo
  // nuevo llega a los 1,5 s
  const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
  const { ctx, page, errores } = await pagina({ init: `localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)});` });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 25000 }).catch(() => {});
  let modoQ = 'bien', pedidasQ = 0;
  // (23 nov, «hoy» 50 y la barra 53) entró ayer a última hora y hoy otra vez: la última entrada se guarda una vez por hora y
  // le queda la de ayer, pero tiene tiempo hoy. Cuenta en «hoy» y en la barra de hoy
  const diaHoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const trasnocha = { uid: 4, nombre: 'Trasnocha', equipo: 'Trasnocha', v: '0.8v', canal: 'play', primera: Date.now() - 5 * 864e5, ultima: Date.now() - 30 * 3600e3, segHoy: 300, segDias: { [diaHoy]: 300 } };
  const cuenta = (uid, nombre, hace) => ({ uid, nombre, equipo: nombre, v: '0.8v', canal: 'play', primera: Date.now() - 5 * 864e5, ultima: Date.now() - hace, segHoy: 60, segDias: {} });
  await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', async (r) => {
    const q = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (!q.url().includes('/hola/todos')) return r.abort('blockedbyclient');
    pedidasQ++;
    await new Promise((ok) => setTimeout(ok, 1500));
    if (modoQ === 'caido') return r.abort('connectionrefused');
    return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ lista: [cuenta(1, 'Nueva1', 1000), { ...cuenta(2, 'Nueva2', 2000), canal: 'web', disp: 'web-pc' }, { ...cuenta(3, 'Nueva3', 3000), canal: 'web', disp: 'web-iphone' }, trasnocha], registro: [], ahora: Date.now(), dias: null, embudo: null, invitar: null }) });
  });
  const abrirQ = () => page.evaluate(async () => {
    const b = document.createElement('button'); b.dataset.accion = 'quienUsa'; document.body.appendChild(b); b.click(); b.remove();
    await new Promise((ok) => setTimeout(ok, 250));
    const sub = () => { const x = document.querySelector('.q-sub'); return x ? x.innerText.replace(/\s+/g, ' ') : ''; };
    const antes = sub();
    await new Promise((ok) => setTimeout(ok, 2200));
    const kpiHoy = [...document.querySelectorAll('.q-kpi > div')].find((d) => /^hoy$/.test(d.querySelector('span')?.innerText || ''));
    const barraHoy = document.querySelector('.vg-v.hoy');
    const ley = document.querySelector('.q-ley');
    return { antes, despues: sub(), guardado: JSON.parse(localStorage.getItem('fm-quien-ult') || 'null'), kpiHoy: kpiHoy ? kpiHoy.querySelector('b').innerText : null, barraHoy: barraHoy ? barraHoy.textContent : null, ley: ley ? ley.innerText.replace(/\s+/g, ' ') : '' };
  });
  await page.evaluate((viejo) => localStorage.setItem('fm-quien-ult', JSON.stringify({ d: viejo })), { lista: [cuenta(9, 'Vieja', 3600e3)], registro: [], ahora: Date.now() - 3600e3, dias: null, embudo: null, invitar: null });
  let q = await abrirQ();
  const nuevas = q.guardado && q.guardado.d && q.guardado.d.lista ? q.guardado.d.lista.length : 0;
  if (!/Actualizando/.test(q.antes) || !/1 cuentas/.test(q.antes) || !/dentro ahora/.test(q.despues) || !/4 cuentas/.test(q.despues) || nuevas !== 4) mal(`Quién usa la app: lo guardado al momento y lo nuevo después: ${JSON.stringify({ antes: q.antes, despues: q.despues, nuevas })}`);
  else bien(`Quién usa la app: sale al momento lo de la última vez («${q.antes}») y se cambia por lo nuevo («${q.despues}»)`);
  if (q.kpiHoy !== '4' || q.barraHoy !== '4') mal(`Quién usa la app: «hoy» ${q.kpiHoy} y la barra de hoy ${q.barraHoy} (los dos tienen que ser 4, con el que entró ayer y hoy otra vez)`);
  else bien('Quién usa la app: «hoy» y la barra de hoy dicen lo mismo (4), con el que entró ayer a última hora y hoy otra vez');
  // (0.8.4; Carlos, 25 nov: «web incluye a los de iOS… me gustaría que se diferenciasen») «Desde dónde», con la web por aparato
  if (!/Google Play 2\b/.test(q.ley) || !/iPhone 1\b/.test(q.ley) || !/Web en ordenador 1\b/.test(q.ley) || /Web 0/.test(q.ley)) mal(`Quién usa la app: «Desde dónde» sin la web por aparato: «${q.ley}»`);
  else bien(`Quién usa la app: «Desde dónde» separa el iPhone y el ordenador («${q.ley}»)`);
  modoQ = 'caido';
  await page.evaluate(() => { const b = document.querySelector('[data-accion="cerrarHoja"]'); if (b) b.click(); });
  q = await abrirQ();
  if (!/No se ha podido actualizar/.test(q.despues) || !/4 cuentas/.test(q.despues)) mal(`Quién usa la app: sin conexión con lo guardado: ${JSON.stringify(q)}`);
  else bien(`Quién usa la app: si no llega lo nuevo, se queda lo guardado y lo dice («${q.despues}»)`);
  if (errores.length) mal(`Quién usa la app: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 15b: (16 nov, 0.7.13l) los planes a su hora y «Rehacer el plan»: por defecto a las 00:25 y las 12:25 (10 min después del
// mercado y 12 h después); un turno pasado sin plan de la IA hace que salga solo, y no si no quedan de hoy; en el plan, «Rehacer
// el plan» en lugar de «Compartir», y sus ajustes con el tono y las dos horas
{
  // (25 nov) con el reloj de la página fijo (el miércoles a las 12:00 de Madrid): la Action de las 00:07 de Madrid fallaba en
  // «el turno pasado sin plan» (de 00:00 a 01:00 de Madrid, el día de la Action, en UTC, y el de Madrid no son el mismo)
  const { ctx, page, errores } = await pagina({ reloj: RELOJ });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M && window.S.plan, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const H = await import('/js/planes-hora.js');
    const ia = await import('/js/ia.js');
    const { LS, diaDe } = await import('/js/util.js');
    const S = window.S, M = { cierreMercado: S.M.cierreMercado };
    const hs = H.horasPlan(M).map((x) => x.txt);
    // (la hora del móvil: en Madrid, 00:25 y 12:25; en la Action, que va en UTC, 23:25 y 11:25)
    const hm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    // (0.7.13n) la de su liga: 10 min después de su mercado; sin mercado conocido, la última que se vio, y si nunca, ninguna
    const espera = M.cierreMercado ? [hm(M.cierreMercado + 10 * 60e3), hm(M.cierreMercado + 10 * 60e3 + 12 * 3600e3)] : [];
    // otra liga con el mercado a las 20:00: sus planes, a las 20:10 y a las 08:10
    const veinte = new Date(); veinte.setHours(20, 0, 0, 0); if (veinte.getTime() < Date.now()) veinte.setDate(veinte.getDate() + 1);
    const otra = H.horasPlan({ cierreMercado: veinte.getTime() }).map((x) => x.txt).join(' y ');
    H.horasPlan(M);
    // un turno de hoy que ya ha pasado: las horas elegidas, una hace 20 minutos
    const d = new Date(Date.now() - 20 * 60e3), hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const mismoDia = diaDe(d.getTime()) === diaDe();
    H.guardarCfgHoras({ h1: hh, h2: '' });
    const pend = H.turnoPendiente(M, { t: Date.now() - 5 * 3600e3 });
    const cubierto = H.turnoPendiente(M, { t: Date.now() - 10 * 60e3 });
    LS.set('planes-cupo', { dia: diaDe(), quedan: 1, gratis: 2, max: 5, usados: 1 });
    const conCupo = ia.planViejoAuto(S.M, false);
    LS.set('planes-cupo', { dia: diaDe(), quedan: 0, gratis: 2, max: 5, usados: 2 });
    const sinCupo = ia.planViejoAuto(S.M, false);
    H.guardarCfgHoras({ h1: '', h2: '' });
    localStorage.removeItem('fm-planes-cupo');
    return { hs, espera, otra, mismoDia, pend: !!pend, cubierto: !!cubierto, conCupo, sinCupo };
  });
  const def = JSON.stringify(r.hs) === JSON.stringify(r.espera);
  if (!def) mal(`planes a su hora: las horas por defecto no son las del mercado: ${JSON.stringify(r.hs)} y debían ser ${JSON.stringify(r.espera)}`);
  else if (r.otra !== '20:10 y 08:10') mal(`planes a su hora: con el mercado de la liga a las 20:00 salen a las ${r.otra}`);
  else if (r.mismoDia && (!r.pend || r.cubierto)) mal(`planes a su hora: el turno pasado sin plan: ${JSON.stringify(r)}`);
  else if (r.mismoDia && (!r.conCupo || r.sinCupo)) mal(`planes a su hora: con y sin planes de hoy: ${JSON.stringify(r)}`);
  else bien(`planes a su hora: los de su mercado (${r.hs.join(' y ')}; con el mercado a las 20:00, ${r.otra}); uno pasado sin plan sale solo y no si no quedan de hoy`);
  const cab = await page.evaluate(() => { const c = document.querySelector('.plan-cab'); return { t: c ? c.innerText : '', rehacer: !!document.querySelector('.plan-cab [data-accion="planYa"]'), aj: !!document.querySelector('.plan-cab [data-accion="planAjustes"]'), comp: !!document.querySelector('.plan-cab [data-accion="tarjeta"]'), quien: (document.querySelector('.plan-quien') || {}).innerText || '' }; });
  // (en la demo sin clave el plan es el de la app: el botón dice «Hacerlo con la IA» o no sale si no hay IA)
  if (cab.comp || /Compartir/.test(cab.t)) mal(`plan: sigue el botón «Compartir»: ${cab.t}`);
  else if (!cab.aj) mal(`plan: faltan los ajustes del plan en la cabecera: ${cab.t}`);
  else bien(`plan: sin «Compartir»; ${cab.rehacer ? `«${cab.t.replace(/\s+/g, ' ').replace('Plan de hoy', '').trim()}» y ` : ''}sus ajustes en la cabecera`);
  await page.evaluate(() => document.querySelector('.plan-cab [data-accion="planAjustes"]').click());
  await page.waitForTimeout(500);
  // (0.7.13n) sin imagen para el grupo ni «Compartir»
  const aj = await page.evaluate(() => ({ h1: !!document.querySelector('select[data-cambia="planH1"]'), h2: !!document.querySelector('select[data-cambia="planH2"]'), tono: !!document.querySelector('select[data-cambia="pullitas"]'), rehacer: !!document.querySelector('[data-accion="planYa"]'), img: !!document.querySelector('[data-accion="tarjeta"]') || /Compartir|Imagen del plan/.test((document.querySelector('#hoja') || document.querySelector('.hoja') || {}).innerText || '') }));
  if (!aj.h1 || !aj.h2 || !aj.tono || aj.img) mal(`plan: los ajustes del plan: ${JSON.stringify(aj)}`);
  else {
    await page.selectOption('select[data-cambia="planH2"]', '20:30');
    await page.waitForTimeout(400);
    const c = await page.evaluate(() => JSON.parse(localStorage.getItem('fm-cfg-planes-hora') || '{}'));
    if (c.h2 !== '20:30') mal(`plan: elegir la hora del segundo plan no se guarda: ${JSON.stringify(c)}`);
    else bien('plan: sus ajustes (tono, las dos horas y rehacer, sin imagen ni «Compartir») y la hora elegida se guarda');
  }
  if (errores.length) mal(`planes a su hora: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 15c: (16 nov, 0.7.13p, aviso de Domy) en el parón, un fichaje que la app ve subiendo hasta la vuelta no se descarta
// aunque la IA lo ponga para el once (es dinero y llega a tiempo); uno que no sube, sí
{
  const { ctx, page, errores } = await pagina({ reloj: RELOJ });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const I = await import('/js/ia.js');
    const S = window.S, M = S.M, D = S.D, n = Date.now();
    const antes = { paron: M.paron, enParon: M.enParon, ini: M.proxima && M.proxima.ini, esp: M.especular };
    M.paron = { ini: n - 3 * 864e5, fin: n + 5 * 864e5 }; M.enParon = true;
    if (M.proxima) M.proxima.ini = n + 5 * 864e5;
    const m = M.mercado.find((x) => x.tipo !== 'manager' && x.j && x.j.valor > 5e6) || M.mercado[0];
    const j = m.j, precio = Math.round(j.valor * 1.08);
    const una = (esp) => { M.especular = esp; const cu = I.cuadrarPlan({ titular: 'x', resumen: 'x', operaciones: [{ accion: 'pujar', objetivo: 'titular', jugador: j.nombre, pid: j.id, importe: precio, motivo: 'para el once' }] }, D, M); const o = cu.ops.find((x) => String(x.pid) === String(j.id)); return o ? !!o.descartada : null; };
    const esp0 = (antes.esp || []).filter((x) => x.pid !== j.id);
    // (sin saldo, para que no entre por estar a su valor)
    const dOrig = D.dinero; D.dinero = 0;
    // (27 nov) que suba hasta la vuelta por encima de la puja que gana en la liga (ahora la de 7-8 de cada 10, más alta)
    const vf = Math.max(j.valor * 1.2, (m.puja || 0) * 1.1);
    const sube = una([...esp0, { j, pid: j.id, precio, valorFuturo: vf, r: 0.025, beneficio: vf - precio }]);
    const quieto = una(esp0);
    D.dinero = dOrig;
    // (0.7.13p) uno a su valor, bueno y sin bajar, que se paga con el saldo: vale para el once aunque no sea chollo; si no
    // te llega con el saldo, no
    const m2 = M.mercado.find((x) => x.tipo !== 'manager' && x.j && x.j.valor > 3e6 && x.j.valor < 25e6 && x.pid !== j.id && x.precio <= x.j.valor * 1.02 && !(antes.esp || []).some((e) => String(e.pid) === String(x.j.id))) || null;
    // (27 nov) que la puja que gana le compense (con un calendario de riesgo alto, `noCompensa`, ya no se puja): aquí se
    // mira lo del parón, no eso
    const nc0 = m2 ? m2.noCompensa : null;
    if (m2) { m2.noCompensa = null; M._cat = null; }
    let aValor = null, sinSaldo = null;
    if (m2) {
      m2.interes = Math.max(m2.interes || 0, 60);
      const imp = Math.round(m2.j.valor * 1.09);
      const d0 = D.dinero, ine0 = M.inercia, tend0 = M.tend;
      M.inercia = (pid) => (String(pid) === String(m2.j.id) ? { fase: 'plano' } : ine0(pid));
      M.tend = (pid) => (String(pid) === String(m2.j.id) ? { ...tend0(pid), p1: 0, p7: 0 } : tend0(pid));
      const prueba = () => { const cu = I.cuadrarPlan({ titular: 'x', resumen: 'x', operaciones: [{ accion: 'pujar', objetivo: 'titular', jugador: m2.j.nombre, pid: m2.j.id, importe: imp, motivo: 'para el once' }] }, D, M); const o = cu.ops.find((x) => String(x.pid) === String(m2.j.id)); return o ? !!o.descartada : null; };
      D.dinero = imp * 2 + (M.misPujas || 0); aValor = prueba();
      D.dinero = Math.round(imp / 2) + (M.misPujas || 0); sinSaldo = prueba();
      D.dinero = d0; M.inercia = ine0; M.tend = tend0; m2.noCompensa = nc0; M._cat = null;
    }
    M.paron = antes.paron; M.enParon = antes.enParon; if (M.proxima) M.proxima.ini = antes.ini; M.especular = antes.esp;
    return { sube, quieto, aValor, sinSaldo };
  });
  if (r.sube !== false || r.quieto !== true) mal(`parón: el fichaje que sube hasta la vuelta (descartado: ${r.sube}) o el que no (descartado: ${r.quieto})`);
  else if (r.aValor !== null && (r.aValor !== false || r.sinSaldo !== true)) mal(`parón: el que sale a su valor con saldo de sobra (descartado: ${r.aValor}) o sin saldo (descartado: ${r.sinSaldo})`);
  else bien(`parón: lo que sube hasta la vuelta y${r.aValor === null ? '' : ' lo que sale a su valor pagado con el saldo'} no se descarta aunque sea para el once; lo demás, sí`);
  if (errores.length) mal(`parón y fichajes que suben: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 16: (14 nov) las funciones top sin anuncio (en Play, sin consentimiento o sin relleno): gratis UNA vez al día por
// dispositivo, todas juntas; la segunda vez del día no se abren y la hoja dice que no hay anuncio; al día siguiente, otra vez
{
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const L = await import('/js/limite.js');
    const { LS } = await import('/js/util.js');
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const cerrar = () => { for (const k of ['top-abierto', 'top-jornada', 'top-rivales']) localStorage.removeItem(`fm-${k}`); };
    const rid = String(window.S.M.rivales[0].e.teamId);
    const vez = async (clave) => {
      window.S.anuncio = { para: 'top', clave, rival: rid };
      window.anuncioVisto('top', false, 'sin anuncio');
      await espera(200);
      return { abierta: L.topAbierto(clave, rid), error: (window.S.anuncio && window.S.anuncio.error) || null };
    };
    cerrar();
    const una = await vez('inercia');
    cerrar();
    const dos = await vez('dineroRivales');
    cerrar();
    LS.set('top-sin-anuncio', { dia: '2000-01-01' });
    const tres = await vez('dineroRivales');
    return { una, dos, tres };
  });
  if (!r.una.abierta || r.una.error) mal(`top sin anuncio: la primera del día no se abre: ${JSON.stringify(r.una)}`);
  else bien('top sin anuncio: la primera vez del día se abre gratis');
  if (r.dos.abierta || !/no hay anuncio/i.test(r.dos.error || '')) mal(`top sin anuncio: la segunda del día: ${JSON.stringify(r.dos)}`);
  else bien(`top sin anuncio: la segunda del día (otra función) no se abre («${r.dos.error}»)`);
  if (!r.tres.abierta || r.tres.error) mal(`top sin anuncio: al día siguiente no vuelve a abrir: ${JSON.stringify(r.tres)}`);
  else bien('top sin anuncio: al día siguiente vuelve a abrirse una vez');
  if (errores.length) mal(`top sin anuncio: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 16b: (0.7.12, Carlos 15 nov) todo con 1 anuncio salvo el dinero de un rival: 2 anuncios seguidos, ese rival 5
// minutos, 2 veces por jornada; quién paga, 1 anuncio y 12 horas (27 nov; antes 5) (todos los rivales); jornada nueva, a cero
{
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const L = await import('/js/limite.js');
    const H = await import('/js/hojas.js');
    const { LS } = await import('/js/util.js');
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    for (const k of ['top-abierto', 'top-jornada', 'top-rivales', 'top-quien', 'top-sin-anuncio']) localStorage.removeItem(`fm-${k}`);
    L.fijarJornada(13);
    const ids = window.S.M.rivales.map((x) => String(x.e.teamId));
    const ver = async (clave, rid) => { window.S.anuncio = { para: 'top', clave, rival: rid }; window.anuncioVisto('top', true, ''); await espera(150); };
    const out = {};
    await ver('dineroRivales', ids[0]);
    out.unoDeDos = { abierto: L.topAbierto('dineroRivales', ids[0]), faltan: L.faltanAnuncios('dineroRivales', ids[0]) };
    await ver('dineroRivales', ids[0]);
    const hasta = L.rivalAbiertoHasta(ids[0]);
    out.dos = { abierto: !L.bloqueada('dineroRivales', ids[0]), min: Math.round((hasta - Date.now()) / 60e3), otro: L.bloqueada('dineroRivales', ids[1]), quien: L.bloqueada('quienPaga'), quedan: L.usosQuedan('dineroRivales'), cierre: L.proximoCierreTop() === hasta };
    // pasados los 5 minutos, cerrado
    const g = LS.get('top-rivales', null); g.abiertos[ids[0]] = Date.now() - 1000; LS.set('top-rivales', g);
    out.pasado = L.bloqueada('dineroRivales', ids[0]);
    await ver('quienPaga', null);
    out.quien = { abierta: !L.bloqueada('quienPaga'), conRival: !L.bloqueada('quienPaga', ids[2]), horas: Math.round((L.abiertaHasta('quienPaga') - Date.now()) / 3600e3), faltan: L.faltanAnuncios('dineroRivales', ids[1]) };
    await ver('dineroRivales', ids[1]); await ver('dineroRivales', ids[1]);
    out.tope = { quedan: L.usosQuedan('dineroRivales'), tercero: L.bloqueada('dineroRivales', ids[2]) };
    out.hojaLlena = H.anuncioHTML({ anuncio: { para: 'top', clave: 'dineroRivales', rival: ids[2] }, M: window.S.M, D: { demo: false } }, 'top').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.hojaQuien = H.anuncioHTML({ anuncio: { para: 'top', clave: 'quienPaga' }, M: window.S.M, D: { demo: false } }, 'top').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.elegir = H.anuncioHTML({ anuncio: { para: 'top', clave: 'dineroRivales' }, M: window.S.M, D: { demo: false } }, 'top');
    L.fijarJornada(14);
    out.nueva = { quedan: L.usosQuedan('dineroRivales') };
    return out;
  });
  if (r.unoDeDos.abierto || r.unoDeDos.faltan !== 1) mal(`dinero por rival: con 1 de 2 ya se abre o no cuenta: ${JSON.stringify(r.unoDeDos)}`);
  else bien('dinero por rival: con el primero de los dos anuncios sigue cerrado y falta 1');
  if (!r.dos.abierto || r.dos.min !== 5 || !r.dos.otro || !r.dos.quien || r.dos.quedan !== 1 || !r.dos.cierre) mal(`dinero por rival: con 2 anuncios: ${JSON.stringify(r.dos)}`);
  else bien('dinero por rival: con 2 anuncios, ese rival 5 minutos (los demás y quién paga, cerrados); queda 1 vez');
  if (!r.pasado) mal('dinero por rival: pasados los 5 minutos sigue abierto');
  else bien('dinero por rival: pasados los 5 minutos se cierra');
  if (!r.quien.abierta || !r.quien.conRival || r.quien.horas !== 12 || r.quien.faltan !== 2) mal(`quién paga: ${JSON.stringify(r.quien)}`);
  else bien('quién paga: 1 anuncio, todos los rivales, 12 horas (y no gasta las veces del dinero)');
  if (r.tope.quedan !== 0 || !r.tope.tercero || !/Ya has visto el dinero de un rival las 2 veces/.test(r.hojaLlena)) mal(`dinero por rival: el tope de 2: ${JSON.stringify(r.tope)} / ${r.hojaLlena.slice(0, 160)}`);
  else bien('dinero por rival: 2 veces por jornada y la tercera ya no');
  if (!/12 horas/.test(r.hojaQuien) || /dos anuncios/.test(r.hojaQuien)) mal(`quién paga: la hoja: ${r.hojaQuien.slice(0, 200)}`);
  else bien('quién paga: la hoja dice un anuncio y 12 horas');
  if ((r.elegir.match(/data-rival="/g) || []).length) mal('dinero por rival: con el tope gastado, la elección deja abrir otro');
  else bien('dinero por rival: sin rival se elige de la lista (con el tope gastado, ninguno se puede abrir)');
  if (r.nueva.quedan !== 2) mal(`dinero por rival: la jornada nueva no vuelve a cero: ${JSON.stringify(r.nueva)}`);
  else bien('dinero por rival: en la jornada siguiente se vuelve a poder 2 veces');
  if (errores.length) mal(`dinero por rival: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 16c: (0.7.12) la recompensa diaria: 100 mil al día y 200 mil en los días de parón (Carlos, 14 nov)
{
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const M = window.S.M, js = M.jornadas, DIA = 864e5;
    let hueco = null;
    for (let i = 1; i < js.length; i++) if (js[i].ini - js[i - 1].fin > 9 * DIA) { hueco = [js[i - 1].fin, js[i].ini]; break; }
    if (!hueco) return { sinHueco: true };
    const enP = hueco[0] + 2 * DIA, fuera = hueco[0] - 3 * DIA;
    return { paron: M.recompensaDia(enP), normal: M.recompensaDia(fuera), tresDiasParon: Math.round(M.recompensas(enP, enP + 3 * DIA)), tresDias: Math.round(M.recompensas(fuera - 3 * DIA, fuera)) };
  });
  if (r.sinHueco || r.paron !== 200000 || r.normal !== 100000 || r.tresDiasParon !== 600000 || r.tresDias !== 300000) mal(`recompensa diaria del parón: ${JSON.stringify(r)}`);
  else bien('recompensa diaria: 100 mil al día y 200 mil en el parón (3 días de parón, 600 mil)');
  if (errores.length) mal(`recompensa del parón: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 16d: (0.7.12) lo que te han dicho los rivales corrige la cuenta: el que te lo dijo hace tiempo, con su diferencia;
// los demás, con la mediana de todos (a medias con 3 apuntes)
{
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const antes = await page.evaluate(async () => {
    const { LS } = await import('/js/util.js');
    const { K } = await import('/js/datos.js');
    const M = window.S.M, ids = M.rivalesTid.filter((t) => { const c = M.dineroCuentaBruta(t); return c && c.v != null; }).slice(0, 4);
    const t = Date.now() - 60 * 864e5, d = {};
    for (const tid of ids.slice(0, 3)) { const c = M.dineroCuentaBruta(tid); d[tid] = { v: Math.round(c.v + 3e6), r: 0, min: Math.round(c.v + 3e6), max: Math.round(c.v + 3e6), t, est: Math.round(c.v) }; }
    LS.set(K('dinero-dicho'), d);
    // (0.8.4o) lo apuntado solo entra en la cuenta con el dinero de ese rival abierto: se abren los cuatro (como con sus anuncios)
    LS.set('top-rivales', { j: null, usos: 0, abiertos: Object.fromEntries(ids.map((x) => [String(x), Date.now() + 5 * 60e3])), uno: null });
    return { ids, bruta: ids.map((tid) => M.dineroCuentaBruta(tid).v) };
  });
  await page.reload();
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  // (en la liga de ejemplo el dinero viene exacto: se mira la cuenta, que es lo que se usa en una liga de verdad)
  const r = await page.evaluate((ids) => { const M = window.S.M; return { corr: M.correccionDinero, propio: M.dineroCuenta(ids[0]), brutaP: M.dineroCuentaBruta(ids[0]), otro: M.dineroCuenta(ids[3]), brutaOtro: M.dineroCuentaBruta(ids[3]) }; }, antes.ids);
  const dif = (a, b) => Math.abs(a - b) < 2e5;
  if (antes.ids.length < 4 || !r.propio || !r.otro || r.corr.n !== 3 || !r.propio.correccion || !r.propio.correccion.propio || !dif(r.propio.v - r.brutaP.v, 3e6) || !r.otro.correccion || !dif(r.otro.v - r.brutaOtro.v, 1.5e6)) mal(`dinero corregido con lo apuntado: ${JSON.stringify({ antes, r })}`);
  else bien(`dinero corregido con lo apuntado: el que lo dijo hace 60 días, +3 M (el suyo); otro rival, +1,5 M (mediana de 3, a medias)`);
  // (0.8.4o) y con su dinero cerrado, lo apuntado no corrige nada (ni lo suyo ni lo de los demás): sería enseñar lo cerrado
  await page.evaluate(async () => { const { LS } = await import('/js/util.js'); LS.del('top-rivales'); });
  await page.reload();
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const rc = await page.evaluate((ids) => { const M = window.S.M; return { corr: M.correccionDinero, propio: M.dineroCuenta(ids[0]), otro: M.dineroCuenta(ids[3]) }; }, antes.ids);
  if (rc.corr.n !== 0 || (rc.propio && rc.propio.correccion) || (rc.otro && rc.otro.correccion)) mal(`dinero cerrado: lo apuntado no corrige nada: ${JSON.stringify(rc.corr)}`);
  else bien('dinero cerrado: lo apuntado no corrige la cuenta de nadie mientras está cerrado');
  if (errores.length) mal(`dinero corregido: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 16e: (0.7.13) lo que apunta la gente en todas las ligas corrige la cuenta de los rivales sin nada apuntado (y su margen),
// por debajo de lo de tu liga; el texto lo dice, y Ajustes trae la casilla para no mandar nada (activada por defecto)
{
  const cal = { n: 60, med: -2e6, p10: -6e6, p25: -4e6, p75: 0, p90: 2e6, porDias: [[0, 30], [30, 60], [60, 100], [100, 9999]].map(([desde, hasta]) => ({ desde, hasta, n: 0, med: 0, p10: 0, p25: 0, p75: 0, p90: 0 })), porSub: [], porParon: [], t: Date.now() };
  const { ctx, page, errores } = await pagina({ init: `localStorage.setItem('fm-dinero-cal', ${JSON.stringify(JSON.stringify({ t: Date.now(), cal }))});` });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const { dineroLargo } = await import('/js/comunes.js');
    const M = window.S.M, tid = M.rivalesTid.find((t) => { const c = M.dineroCuentaBruta(t); return c && c.v != null; });
    const b = M.dineroCuentaBruta(tid), c = M.dineroCuenta(tid);
    return { cal: M.calDinero, b, c, txt: dineroLargo(c) };
  });
  const ok16e = r.cal && r.cal.n === 60 && r.c && r.c.correccion && r.c.correccion.todos === 60 && Math.abs(r.c.v - r.b.v + 2e6) < 1e5 && r.c.margen === 4e6 && /apunta la gente/.test(r.txt);
  if (!ok16e) mal(`dinero con lo de todas las ligas: ${JSON.stringify(r)}`);
  else bien('dinero con lo de todas las ligas: -2 M (la mediana de 60 apuntes) y margen de 4 M (la mitad del p10-p90), y el texto lo dice');
  // la casilla de Ajustes: activada, se apaga y se queda apagada
  const k = await page.evaluate(async () => {
    const s = await import('/js/soporte.js');
    const antes = s.mejorarIA();
    window.S.tipoHoja = null;
    return { antes };
  });
  await page.evaluate(() => document.querySelector('[data-accion="ajustes"]') && document.querySelector('[data-accion="ajustes"]').click());
  await page.waitForTimeout(500);
  const hay = await page.$('[data-accion="mejorarIA"]');
  if (hay) { await page.evaluate(() => document.querySelector('[data-accion="mejorarIA"]').click()); await page.waitForTimeout(300); }
  const despues = await page.evaluate(async () => (await import('/js/soporte.js')).mejorarIA());
  if (!k.antes || !hay || despues) mal(`casilla «Ayudar a mejorar la IA»: ${JSON.stringify({ antes: k.antes, hay: !!hay, despues })}`);
  else bien('casilla «Ayudar a mejorar la IA» en Ajustes: viene activada y se apaga');
  if (errores.length) mal(`dinero de todas las ligas: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 17: (14 nov) el APK de GitHub se despide: la ventana del paso a Google Play solo en esa app (ni en Play ni en la web),
// con «Ahora no» antes del cierre y sin cerrar después; la banda de arriba también
// (22 nov) el aviso de antes del cierre se mira con un cierre a 3 días vista: con la fecha de verdad (21 nov) dejó de pasar el 22
const EN_3_DIAS = new Date(Date.now() + 3 * 864e5).toISOString();
for (const [nombre, canal, cierre, espera] of [['APK de GitHub', 'github', EN_3_DIAS, 'aviso'], ['APK de GitHub ya cerrado', 'github', '2020-01-01T00:00:00+01:00', 'cerrada'], ['Google Play', 'play', '2020-01-01T00:00:00+01:00', 'nada'], ['web', null, '2020-01-01T00:00:00+01:00', 'nada']]) {
  const lim = cierre ? `localStorage.setItem('fm-limites', JSON.stringify({ t: Date.now(), cfg: { cierreApk: ${JSON.stringify(cierre)} } }));` : '';
  const app = canal ? `window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '5701', canal: () => '${canal}', hayQR: () => false, programarAvisos: () => {} }, { get: (o, k) => (k in o ? o[k] : undefined) });` : '';
  const { ctx, page, errores } = await pagina({ init: `${app} localStorage.setItem('fm-demo', 'true'); ${lim}` });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const d = document.getElementById('aviso-play');
    return { hay: !!d, t: d ? d.innerText.replace(/\s+/g, ' ') : '', ahoraNo: !!(d && d.querySelector('[data-accion="cerrarAvisoPlay"]')), play: !!(d && d.querySelector('[data-abrir*="play.google.com"]')), banda: (() => { const b = document.querySelector('#banda .banda-play'); return !!b && /Esta app deja de funcionar (en \d+ días|mañana|hoy)/.test(b.innerText) && !/noviembre/.test(b.innerText) && !!b.querySelector('[data-abrir*="play.google.com"] img[src*="google-play"]'); })() };
  });
  const ok = espera === 'nada' ? !r.hay && !r.banda
    : espera === 'aviso' ? r.hay && r.ahoraNo && r.play && r.banda && /dejará de funcionar el (lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d+ de [a-z]+/.test(r.t) && /gracias/.test(r.t)
      : r.hay && !r.ahoraNo && r.play && /ya no funciona/.test(r.t);
  if (!ok) mal(`paso a Play, ${nombre}: ${JSON.stringify(r).slice(0, 300)}`);
  else bien(`paso a Play, ${nombre}: ${espera === 'nada' ? 'sin aviso' : espera === 'aviso' ? 'la ventana con «Ahora no» y la banda fija (los días que quedan y la insignia de Google Play)' : 'la ventana sin cerrar'}`);
  if (errores.length) mal(`paso a Play, ${nombre}: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 18: (16 nov, 0.7.13w) la app de Google Play por debajo de «playMin»: la banda «Hay una versión nueva de la app» con el
// enlace a la ficha. Solo en Play, solo por debajo, nunca sin «playMin» ni en la liga de ejemplo (la prueba sale de ella a mano)
for (const [nombre, canal, version, playMin, espera] of [['Play por debajo', 'play', '6171', 6181, true], ['Play al día', 'play', '6171', 6171, false], ['Play por encima', 'play', '6181', 6171, false], ['Play sin playMin', 'play', '6171', null, false], ['APK de GitHub', 'github', '5701', 9999, false], ['web', null, null, 9999, false]]) {
  const lim = `localStorage.setItem('fm-limites', JSON.stringify({ t: Date.now(), cfg: ${JSON.stringify(playMin ? { playMin } : {})} }));`;
  const app = canal ? `window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '${version}', canal: () => '${canal}', hayQR: () => false, programarAvisos: () => {} }, { get: (o, k) => (k in o ? o[k] : undefined) });` : '';
  const { ctx, page, errores } = await pagina({ init: `${app} localStorage.setItem('fm-demo', 'true'); ${lim}` });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const enDemo = !!document.querySelector('#banda .banda-actualizar');
    window.S.D.demo = false;
    const otra = [...document.querySelectorAll('.nav button[data-ir]')].find((b) => b.dataset.ir !== window.S.vista);
    if (otra) otra.click();
    await new Promise((ok) => setTimeout(ok, 400));
    const b = document.querySelector('#banda .banda-actualizar');
    return { enDemo, hay: !!b, t: b ? b.innerText.replace(/\s+/g, ' ') : '', play: !!(b && b.querySelector('[data-abrir="https://play.google.com/store/apps/details?id=es.fantasymanager.app"]')) };
  });
  const ok = !r.enDemo && (espera ? r.hay && r.play && /Hay una versión nueva de la app/.test(r.t) && /Actualizar en Google Play/.test(r.t) && !/limites|playMin|compilaci/i.test(r.t) : !r.hay);
  if (!ok) mal(`app de Play atrás, ${nombre}: ${JSON.stringify(r).slice(0, 300)}`);
  else bien(`app de Play atrás, ${nombre}: ${espera ? 'la banda con «Actualizar en Google Play» (y nada en la liga de ejemplo)' : 'sin banda'}`);
  if (errores.length) mal(`app de Play atrás, ${nombre}: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 19: (19 nov, el fallo de Bryan) la app no consigue descargar la actualización con su conexión: con más de un día así,
// una banda pequeña que dice que la abra con wifi. Nada el primer día, nada si el fallo no es de la conexión (firma,
// 404), se quita en cuanto mira bien, se cierra hasta mañana, y nunca en la web, el APK de GitHub ni la liga de ejemplo
for (const [nombre, canal] of [['Play', 'play'], ['web', null], ['APK de GitHub', 'github']]) {
  const app = canal ? `window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '6581', canal: () => '${canal}', hayQR: () => false, programarAvisos: () => {} }, { get: (o, k) => (k in o ? o[k] : undefined) });` : '';
  const { ctx, page, errores } = await pagina({ init: `${app} localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-limites', JSON.stringify({ t: Date.now(), cfg: { cierreApk: false } }));` });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const { VERSION } = await import('./js/version.js');
    const { LS } = await import('./js/util.js');
    const repintar = async () => {
      const otra = [...document.querySelectorAll('.nav button[data-ir]')].find((b) => b.dataset.ir !== window.S.vista);
      if (otra) otra.click();
      await new Promise((ok) => setTimeout(ok, 300));
      const b = [...document.querySelectorAll('#banda .banda')].find((x) => /actualización/.test(x.innerText));
      return b ? b.innerText.replace(/\s+/g, ' ') : '';
    };
    const red = 'error: failed to connect to fantasymanagerapp.com/185.199.109.153 (port 443) from /10.85.35.168 (port 41234) after 15000ms';
    const o = {};
    window.webBuscada(red);
    o.demo = (LS.set('aldia-red', { t: Date.now() - 26 * 3600e3, v: VERSION }), await repintar());
    window.S.D.demo = false;
    LS.set('aldia-red', null); LS.del('aldia-red');
    window.webBuscada(red);
    o.primerDia = await repintar();
    LS.set('aldia-red', { t: Date.now() - 26 * 3600e3, v: VERSION });
    window.webBuscada(red);
    o.masDeUnDia = await repintar();
    o.cruz = !![...document.querySelectorAll('#banda .banda')].find((x) => /actualización/.test(x.innerText) && x.querySelector('[data-accion="cerrarSinDescarga"]'));
    window.webBuscada('error: sin conexión · dominio: no conecta (185.199.109.153) · respaldo: tarda');
    o.losDos = await repintar();
    window.webBuscada('igual');
    o.trasIgual = await repintar();
    LS.set('aldia-red', { t: Date.now() - 26 * 3600e3, v: VERSION });
    window.webBuscada('error: dominio: paquete con firma mala');
    o.firma = await repintar();
    LS.set('aldia-red', { t: Date.now() - 26 * 3600e3, v: VERSION });
    o.deOtraVersion = (LS.set('aldia-red', { t: Date.now() - 26 * 3600e3, v: '0.1' }), await repintar());
    LS.set('aldia-red', { t: Date.now() - 26 * 3600e3, v: VERSION });
    await repintar();
    const x = [...document.querySelectorAll('#banda [data-accion="cerrarSinDescarga"]')][0];
    if (x) x.click();
    o.cerrada = await repintar();
    return o;
  });
  const txt = 'No se ha podido descargar la actualización con esta conexión: abre la app con wifi.';
  const ok = canal === 'play'
    ? !r.demo && !r.primerDia && r.masDeUnDia === txt && r.cruz && r.losDos === txt && !r.trasIgual && !r.firma && !r.deOtraVersion && !r.cerrada
    : !r.demo && !r.primerDia && !r.masDeUnDia && !r.losDos;
  if (!ok) mal(`sin descargar la actualización, ${nombre}: ${JSON.stringify(r).slice(0, 400)}`);
  else bien(`sin descargar la actualización, ${nombre}: ${canal === 'play' ? 'la banda solo con más de un día fallando por la conexión, y se quita al mirar bien o al cerrarla' : 'sin banda'}`);
  if (errores.length) mal(`sin descargar la actualización, ${nombre}: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 20: (19 nov, Carlos: «no conozco a los usuarios y no puedo decirles nada») en Quién usa la app, qué le pasa a cada uno y
// si se arregla solo o con la app, nunca «Que cierre la app…», «Que actualice…» ni nada que haya que decirle
{
  const { ctx, page, errores } = await pagina({ init: `localStorage.setItem('fm-demo', 'true');` });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const { quienUsaHTML } = await import('./js/hojas.js');
    const ahora = Date.now(), u = ahora - 3600e3;
    const x = (n, o) => ({ nombre: n, equipo: n, ultima: u, canal: 'play', app: 99999, v: '0.1', ...o });
    const lista = [
      x('Bryan', { ad: 'failed to connect to fantasymanagerapp.com/185.199.109.153 (port 443) from /10.85.35.168 (port 41234)' }),
      x('Dos', { ad: 'sin conexión · dominio: no conecta (185.199.109.153) · respaldo: tarda' }),
      x('Firma', { ad: 'dominio: paquete con firma mala' }),
      x('Sitio', { ad: 'sin sitio para guardarla' }),
      x('Arranca', { ad: 'descartada la 0.8: no arrancaba' }),
      x('Raro', { ad: 'algo raro' }),
      x('Fuera', { canal: 'github', app: 5701 }),
      x('Vieja', { app: 10, ad: '' }),
      ...['red', 'lento', 'laliga', 'sinLigas', 'vacia', 'cambio', 'otro'].map((t) => x(`Carga ${t}`, { v: '9.9 !', fc: `${t}: x` })),
      x('Carga sin motivo', { v: '9.9 !' }),
    ];
    const div = document.createElement('div');
    div.innerHTML = quienUsaHTML({ quien: { lista, ahora, registro: [], tab: 'cuentas' } });
    const por = [...div.querySelectorAll('.qf-por')].map((e) => e.innerText.replace(/\s+/g, ' '));
    return { n: por.length, por, todo: div.innerText };
  });
  const malos = r.por.filter((t) => /(^|[.:] )Que [a-z]|que (cierre|abra|actualice|pruebe|mande|libere|reinstale|desinstale|lo intente)/.test(t));
  const bryan = r.por.find((t) => /185\.199\.109\.153/.test(t) && !/respaldo/.test(t)) || '';
  const dos = r.por.find((t) => /ni al sitio principal ni al de respaldo/.test(t)) || '';
  const ok = r.n >= 16 && !malos.length && /su conexión no llega/.test(bryan) && /Se arregla solo/.test(bryan) && /Google Play/.test(bryan) && /Se arregla solo/.test(dos);
  if (!ok) mal(`Quién usa la app, qué le pasa: ${JSON.stringify({ n: r.n, malos, bryan, dos }).slice(0, 500)}`);
  else bien(`Quién usa la app, qué le pasa: ${r.n} casos con qué pasa y si se arregla solo, sin nada que decirle al usuario`);
  // (22 nov, Carlos: «hoy» 49 y la barra de hoy 47) la barra de hoy cuenta también al que abrió y se fue sin mandar su tiempo
  const h = await page.evaluate(async () => {
    const { quienUsaHTML } = await import('./js/hojas.js');
    const { diaDe } = await import('./js/util.js');
    const ahora = Date.now(), hoy = diaDe(ahora);
    const lista = [
      { nombre: 'Con tiempo', ultima: ahora - 60e3, primera: ahora - 9 * 86400e3, segHoy: 600, segDias: { [hoy]: 600 } },
      { nombre: 'Alta sin tiempo', ultima: ahora - 30e3, primera: ahora - 30e3, segHoy: 0, segDias: {} },
    ];
    const div = document.createElement('div');
    div.innerHTML = quienUsaHTML({ quien: { lista, ahora, registro: [], tab: 'hoy' } });
    const kpi = [...div.querySelectorAll('.q-kpi > div')].find((e) => e.querySelector('span')?.textContent === 'hoy')?.querySelector('b')?.textContent;
    const barra = div.querySelector('.vg-v.hoy')?.textContent;
    return { kpi, barra };
  });
  if (h.kpi !== '2' || h.barra !== '2') mal(`Quién usa la app: «hoy» y la barra de hoy no cuadran: ${JSON.stringify(h)}`);
  else bien('Quién usa la app: la cifra «hoy» y la barra de hoy dicen lo mismo (2), también con un alta que no mandó su tiempo');
  if (errores.length) mal(`Quién usa la app: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 20b: (22 nov, Carlos: «las 3 últimas no son noticias») ni un directo ni las páginas para ver el partido salen como noticia
{
  const { esDeFutbol } = await import(new URL('../web/js/util.js', import.meta.url));
  const fuera = ['Watch CA Osasuna - Málaga CF Live Stream Online | DAZN ES', 'Osasuna - Málaga, en directo: Budimir y Barja acarician el segundo',
    'Atlético - Getafe | Minuto a minuto', 'Dónde ver el Betis - Sevilla: horario y TV', 'DIRECTO | Real Sociedad - Celta',
    'Deportivo Alavés - RC Deportivo LALIGA EA SPORTS', 'Getafe vs Atlético de Madrid: pronóstico, consejos y cuotas | LaLiga',
    'Getafe CF-Atlético de Madrid: sigue en directo la rueda de prensa de Diego Pablo Simeone previa al partido de LaLiga',
    'Rueda de prensa de Simeone: Getafe vs Atlético de Madrid', 'Rueda de prensa Hansi Flick: FC Barcelona vs Villareal CF',
    'Real Madrid - Celta: rueda de prensa de Mourinho'];
  const dentro = ['Gulácsi evita el gol de Dani Olmo con una parada felina', 'El Barça remonta al Villarreal con la vuelta de Olmo y Koundé y la expulsión de Fermín',
    'El Villarreal ficha a un delantero directo desde el Ajax', 'Budimir, el máximo goleador nacional de LaLiga EA Sports',
    'Alineaciones Real Madrid vs Celta de Vigo hoy: once inicial y banquillo de suplentes',
    'Rueda de prensa de Flick: confirma la baja de Lewandowski', 'Simeone, en rueda de prensa: «Griezmann está bien»'];
  const n = (titulo) => ({ titulo, fuente: 'Marca', equipos: ['1', '2'] });
  const malos = [...fuera.filter((t) => esDeFutbol(n(t))), ...dentro.filter((t) => !esDeFutbol(n(t)))];
  if (malos.length) mal(`noticias: lo que no es noticia: ${malos.join(' / ')}`);
  else bien(`noticias: fuera ${fuera.length} que no son noticia (directos, DAZN, dónde verlo) y se quedan ${dentro.length} de verdad`);
}

// 21:(19 nov, Carlos) una versión con todos: 'web' se presenta sola a los de la web y el iPhone, no en la app de Android;
// su botón con ir.accion abre lo mismo que ese data-accion (la 0.8h: «Invitar a un amigo» abre la hoja de invitar). Con
// «aviso» (20 nov) sale una tarjeta en el centro en vez de la pantalla entera, y se cierra al tocar el botón
{
  const { NOVEDADES } = await import(new URL('../web/js/version.js', import.meta.url));
  const nw = NOVEDADES.find((n) => n.todos && n.aviso) || NOVEDADES.find((n) => n.todos === 'web');
  if (!nw) bien('novedades solo para la web: ninguna versión con todos: \'web\' ahora mismo');
  else {
    const i = NOVEDADES.indexOf(nw), antes = (NOVEDADES[i + 1] || {}).v;
    for (const app of [false, true]) {
      const fa = app ? `window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '9999', canal: () => 'play', hayQR: () => false, programarAvisos: () => {} }, { get: (o, k) => (k in o ? o[k] : undefined) });` : '';
      const { ctx, page, errores } = await pagina({ init: `${fa} localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-version-vista2', JSON.stringify('${antes}'));` });
      await page.goto(`${BASE}/index.html`);
      await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(3500);
      // con «aviso», la tarjeta en el centro (no la pantalla entera); sin él, la presentación
      const r = await page.evaluate(async (corta) => {
        document.querySelectorAll('.tour').forEach((e) => e.remove());
        const abierta = !!document.querySelector(corta ? '.nvt' : '.nv-cap');
        const entera = !!document.querySelector('.nv-cap');
        const boton = document.querySelector(corta ? '[data-nvt="ir"]' : '[data-nv-ir]');
        if (boton) { boton.click(); await new Promise((ok) => setTimeout(ok, 1200)); }
        return { abierta, entera, boton: boton ? boton.innerText : null, hoja: (window.S.tipoHoja || [])[0] || null, vista: `${window.S.vista}:${(window.S.seg || {})[window.S.vista] || ''}`, sigue: !!document.querySelector('.nvt') };
      }, !!nw.aviso);
      const accion = nw.aviso ? nw.aviso.ir : (nw.cosas.find((c) => c.ir && c.ir.accion) || {}).ir;
      if (nw.aviso && (r.entera || r.sigue)) r.abierta = false;
      const sale = nw.todos === true || nw.todos === (app ? 'app' : 'web');
      // (0.8.4s) el botón puede abrir una hoja (accion) o llevar a una pestaña (v, seg: «Ver el parte» → Rivales → Parte)
      const llega = !accion ? true : accion.accion ? !!r.hoja : accion.seg ? r.vista === accion.seg : r.vista.startsWith(`${accion.v}:`);
      const ok = !sale ? !r.abierta : r.abierta && (!accion || (r.boton === (accion.txt || 'Verlo') && llega));
      if (!ok) mal(`novedades de una versión (${nw.v}), ${app ? 'app' : 'web'}: ${JSON.stringify(r)}`);
      else bien(`novedades de una versión (${nw.v}, todos: ${nw.todos}), ${app ? 'app' : 'web'}: ${sale ? `se abre sola y «${r.boton}» abre ${r.hoja || r.vista}` : 'no se abre'}`);
      if (errores.length) mal(`novedades solo para la web: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
      await ctx.close();
    }
  }
}

// 16 (22 nov): las bajas de la jornada (bajas.js). La cruz de Clubes abre la hoja en «Todas», por club; «pueden jugar» de
// Equipo, en «Tu liga» con los tuyos primero; las pestañas cambian sin cerrarla; tocar a uno abre su ficha con «‹ Bajas»
// y se vuelve; bajas/partes.json (interceptado, con los ids de la demo) pone la lesión y la vuelta; sin él (404), sale igual.
// En la demo se fuerzan tres bajas: dos tuyas (lesionado y sancionado) y una duda de un rival.
for (const [conPartes, ancho] of [[true, 390], [false, 390], [true, 1280]]) {
  const nombre = `bajas (${ancho === 390 ? 'móvil' : 'ordenador'}, ${conPartes ? 'con partes' : 'sin partes'})`;
  const { ctx, page, errores } = await pagina({ ancho, alto: ancho === 390 ? 844 : 800 });
  try {
    await page.goto(`${BASE}/index.html`);
    await page.waitForSelector('#vista', { timeout: 25000 });
    const ids = await page.evaluate(() => {
      const D = JSON.parse(localStorage.getItem('fm-datos-demo'));
      const yo = String(D.yo.teamId);
      const mios = (D.plantillas[yo] || []).map((f) => String(f.pid)).filter((pid) => D.maestro[pid] && D.maestro[pid].pos < 5);
      const otro = Object.keys(D.plantillas).find((t) => t !== yo);
      const riv = (D.plantillas[otro] || []).map((f) => String(f.pid)).find((pid) => D.maestro[pid] && D.maestro[pid].pos < 5 && D.maestro[pid].estado === 'ok');
      D.maestro[mios[0]].estado = 'injured'; D.maestro[mios[1]].estado = 'suspended'; D.maestro[riv].estado = 'doubtful';
      D.t = Date.now();
      localStorage.setItem('fm-datos-demo', JSON.stringify(D));
      return { les: mios[0], san: mios[1], riv };
    });
    await page.route('**/bajas/partes.json', (r) => (conPartes
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 1, t: Date.now() - 3600e3, jornada: 10, j: { [ids.les]: { e: 'b', l: 'rotura de prueba en el sóleo', d: 22 }, [ids.san]: { s: 1 }, [ids.riv]: { e: 'd', l: 'golpe de prueba', j: 10 } } }) })
      : r.fulfill({ status: 404, body: 'no' })));
    await page.reload();
    await page.waitForSelector('#vista', { timeout: 25000 });
    await page.evaluate(() => localStorage.removeItem('fm-bajas-partes'));
    await page.click('[data-ir="clubes"] >> visible=true').catch(async () => page.evaluate(() => document.querySelector('[data-ir="clubes"]').click()));
    await page.waitForTimeout(600);
    const cruz = await page.evaluate(() => { const b = document.querySelector('#vista .tit-fila .cz'); if (!b) return null; const r = b.getBoundingClientRect(); return { n: (b.querySelector('.cz-n') || {}).textContent || '', l: b.querySelector('.cz-l').textContent.trim(), visible: r.width > 30 && r.right <= innerWidth + 1 && r.top >= 0 }; });
    if (!cruz || !cruz.visible || !(Number(cruz.n) >= 3) || !/^BajasJ\d+$/i.test(cruz.l.replace(/\s+/g, ''))) mal(`${nombre}: la cruz de Clubes: ${JSON.stringify(cruz)}`);
    else bien(`${nombre}: la cruz junto al título de Clubes, con «${cruz.l}» y ${cruz.n} bajas en tu liga`);
    await page.click('#vista .cz');
    await page.waitForTimeout(conPartes ? 900 : 600);
    const todas = await page.evaluate(() => ({ tipo: window.S.tipoHoja, clubes: document.querySelectorAll('.hoja .bj-club').length, filas: document.querySelectorAll('.hoja .bj .fila').length, on: (document.querySelector('.hoja .bj-tab.on') || {}).textContent || '', titulo: (document.querySelector('.hoja h2') || {}).textContent || '', err: !!document.querySelector('.hoja .error-c') }));
    if (todas.err || !todas.tipo || todas.tipo[0] !== 'bajas' || todas.tipo[1] !== 'todas' || todas.clubes < 1 || todas.filas < 3 || !/Todas/.test(todas.on) || todas.titulo !== 'Bajas') mal(`${nombre}: la hoja desde la cruz: ${JSON.stringify(todas)}`);
    else bien(`${nombre}: la cruz abre la hoja en «Todas», ${todas.filas} bajas en ${todas.clubes} clubes`);
    // (27 nov, Domy) por club y por puntos, y cada club se pliega: en «Todas», abiertos solo los que tienen a alguno de tu
    // liga; plegar uno se recuerda al cambiar de pestaña y volver
    const grupos = await page.evaluate(() => [...document.querySelectorAll('.hoja .bj-g')].map((g) => ({ open: g.open, liga: !!g.querySelector('.bj-club small'), pts: [...g.querySelectorAll('.fila .fila-s')].map((e) => Number((e.textContent.match(/(-?\d+) pts/) || [])[1])) })));
    const ordenOk = grupos.every((g) => g.pts.every((p, i) => Number.isFinite(p) && (i === 0 || g.pts[i - 1] >= p)));
    const plegOk = grupos.length && grupos.every((g) => g.open === g.liga);
    const abierto = await page.evaluate(() => { const g = [...document.querySelectorAll('.hoja .bj-g')].find((x) => x.open); if (!g) return null; g.querySelector('summary').click(); return g.querySelector('summary').dataset.k; });
    await page.waitForTimeout(200);
    await page.evaluate(() => [...document.querySelectorAll('.hoja .bj-tab')].find((b) => /Libres/.test(b.textContent)).click());
    await page.waitForTimeout(300);
    const libresG = await page.evaluate(() => [...document.querySelectorAll('.hoja .bj-g')].map((g) => g.open));
    await page.evaluate(() => [...document.querySelectorAll('.hoja .bj-tab')].find((b) => /Todas/.test(b.textContent)).click());
    await page.waitForTimeout(300);
    const sigue = await page.evaluate((k) => { const s = document.querySelector(`.hoja .bj-club[data-k="${k}"]`); return s ? s.parentElement.open : null; }, abierto);
    if (!ordenOk || !plegOk || !abierto || sigue !== false || !libresG.every(Boolean)) mal(`${nombre}: por club y plegables: ${JSON.stringify({ ordenOk, plegOk, abierto, sigue, libresG, grupos: grupos.slice(0, 4) })}`);
    else bien(`${nombre}: ${grupos.length} clubes, cada uno por puntos; abiertos solo los de tu liga, y plegar uno se recuerda`);
    await page.evaluate(() => [...document.querySelectorAll('.hoja .bj-tab')].find((b) => /Tu liga/.test(b.textContent)).click());
    await page.waitForTimeout(500);
    const liga = await page.evaluate((ids) => {
      const f = (pid) => document.querySelector(`.hoja .bj .fila[data-j="${pid}"]`);
      const d = (pid) => (f(pid) ? [...f(pid).querySelectorAll('.fila-d .v, .fila-d .d')].map((e) => e.textContent.trim()).join(' ') : null);
      const secs = [...document.querySelectorAll('.hoja .bj .sec h2')].map((e) => e.textContent.trim());
      const primera = document.querySelector('.hoja .bj .fila');
      return { tipo: window.S.tipoHoja, secs, primera: primera ? primera.dataset.j : null, sub: primera ? primera.querySelector('.fila-s').textContent : '', les: d(ids.les), lesT: f(ids.les) ? (f(ids.les).querySelector('.bj-les') || {}).textContent || '' : null, san: d(ids.san), riv: f(ids.riv) ? (f(ids.riv).querySelector('.bj-les') || {}).textContent || '' : null, pie: (document.querySelector('.hoja .bj-pie') || {}).textContent || '', rel: document.querySelectorAll('.hoja .bj-rel').length };
    }, ids);
    const okLiga = liga.tipo[1] === 'liga' && liga.secs[0] === 'Tuyas' && liga.secs.includes('De tus rivales') && [ids.les, ids.san].includes(liga.primera) && /Tuyo/.test(liga.sub);
    const okPartes = conPartes ? /~3 sem\. vuelve/.test(liga.les || '') && liga.lesT === 'Rotura de prueba en el sóleo' && /^J\d+ vuelve$/.test(liga.san || '') && liga.riv === 'Golpe de prueba' && /^Partes de /.test(liga.pie)
      : !liga.lesT && !liga.pie && !/vuelve/.test(`${liga.les} ${liga.san}`);
    if (!okLiga || !okPartes) mal(`${nombre}: «Tu liga»: ${JSON.stringify(liga)}`);
    else bien(`${nombre}: «Tu liga» con los tuyos primero (${liga.secs.join(', ')})${conPartes ? `, la vuelta («${liga.les}», «${liga.san}») y la lesión` : ', sin vuelta ni lesión'}; relevos: ${liga.rel}`);
    await page.click(`.hoja .bj .fila[data-j="${ids.les}"]`);
    await page.waitForTimeout(700);
    const ficha = await page.evaluate(() => ({ tipo: window.S.tipoHoja, volver: (document.querySelector('.hoja .volver-h') || {}).textContent || '' }));
    await page.click('.hoja .volver-h').catch(() => {});
    await page.waitForTimeout(500);
    const vuelta = await page.evaluate(() => window.S.tipoHoja);
    if (ficha.tipo[0] !== 'j' || String(ficha.tipo[1]) !== ids.les || !/Bajas/.test(ficha.volver) || !vuelta || vuelta[0] !== 'bajas' || vuelta[1] !== 'liga') mal(`${nombre}: tocar a uno: ${JSON.stringify({ ficha, vuelta })}`);
    else bien(`${nombre}: tocar a uno abre su ficha con «‹ Bajas» y se vuelve a «Tu liga»`);
    await page.evaluate(() => document.querySelector('.hoja [data-accion="cerrarHoja"]').click());
    await page.waitForTimeout(500);
    await page.click('[data-ir="equipo"] >> visible=true').catch(async () => page.evaluate(() => document.querySelector('[data-ir="equipo"]').click()));
    await page.waitForTimeout(700);
    await page.evaluate(() => { const b = document.querySelector('#vista [data-seg="equipo:plantilla"]'); if (b) b.click(); });
    await page.waitForTimeout(600);
    const tile = await page.evaluate(() => { const b = document.querySelector('#vista .eq2-bajas'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : null; });
    if (tile) { await page.click('#vista .eq2-bajas'); await page.waitForTimeout(600); }
    const eq = await page.evaluate(() => ({ tipo: window.S.tipoHoja, primera: (document.querySelector('.hoja .bj .sec h2') || {}).textContent || '' }));
    if (!tile || !/pueden jugar/.test(tile) || !eq.tipo || eq.tipo[0] !== 'bajas' || eq.tipo[1] !== 'liga' || eq.primera !== 'Tuyas') mal(`${nombre}: «pueden jugar» de Equipo: ${JSON.stringify({ tile, eq })}`);
    else bien(`${nombre}: «${tile}» de Equipo abre la misma hoja en «Tu liga»`);
    if (errores.length) mal(`${nombre}: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  } catch (e) { mal(`${nombre}: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}

// 17 (22 nov, Domy): en Directo cuentan los de tu once de la jornada, aunque ya no los tengas. Con el reloj en el domingo de la
// jornada en juego de la demo, se pone un directo con tu once y uno de un rival dentro (como si lo hubieras vendido con la
// jornada empezada): tiene que salir en su partido con sus puntos y, en la ficha del partido, como tuyo.
{
  const domingo = RELOJ + 4 * 864e5 + 6 * 3600e3;
  const { ctx, page, errores } = await pagina({ reloj: domingo });
  try {
    await page.goto(`${BASE}/index.html`);
    await page.waitForSelector('#vista', { timeout: 25000 });
    const r = await page.evaluate(async () => {
      const S = window.S, M = S.M;
      if (!M.enJuego) return { sinJornada: true };
      const mios = M.mias.filter((x) => x.j.pos < 5).map((x) => String(x.j.id));
      const yo = String(M.yo.teamId);
      const ajeno = Object.entries(M.dueno).find(([pid, t]) => String(t) !== yo && S.D.maestro[pid] && S.D.maestro[pid].pos < 5);
      const pid = ajeno[0];
      const once = [...mios.slice(0, 10), pid];
      M.ponerVivo({ t: Date.now(), n: M.enJuego.n, puntos: { [pid]: 7 }, once, equipos: {}, enJuego: [], acabados: [] });
      document.querySelector('[data-ir="directo"]').click();
      await new Promise((ok) => setTimeout(ok, 900));
      const j = S.D.maestro[pid];
      const chips = [...document.querySelectorAll('#vista .pt-chip')].map((c) => c.textContent);
      const partido = [...document.querySelectorAll('#vista [data-accion="verPartido"]')].find((b) => b.textContent.includes(S.D.equipos[j.equipoId].nombre));
      let tuyo = null;
      if (partido) { partido.click(); await new Promise((ok) => setTimeout(ok, 900)); const f = document.querySelector(`.hoja [data-j="${pid}"]`); tuyo = f ? f.textContent.includes('Tuyo') : null; }
      return { nombre: j.nombre, chip: chips.some((c) => c.includes(j.nombre.split(' ').pop())), hayPartido: !!partido, tuyo };
    });
    if (r.sinJornada) bien('directo con el once de la jornada: sin jornada en juego a esa hora en la demo (no se mira)');
    else if (!r.chip || (r.hayPartido && r.tuyo !== true)) mal(`directo con el once de la jornada: ${JSON.stringify(r)}`);
    else bien(`directo con el once de la jornada: el que ya no es tuyo sale en su partido y en la ficha como tuyo`);
    if (errores.length) mal(`directo con el once de la jornada: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  } catch (e) { mal(`directo con el once de la jornada: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}

// 18 (24 nov, Carlos: «que saliera al menos durante las próximas 24 horas la tabla de la jornada con todos tus rivales» y
// «quiero ver esta jornada, la anterior y la anterior, en qué puesto he quedado»). Con el reloj 3 h después de acabar la
// última jornada de la demo, Directo la enseña («acabada», con «Tu liga» primero y todos los equipos); Por jornada, la
// clasificación de la jornada; 30 h después, como siempre
{
  const fines = await (async () => {
    const { ctx, page } = await pagina();
    await page.goto(`${BASE}/index.html`);
    await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
    const f = await page.evaluate(() => (window.S && window.S.M ? (window.S.M.jornadas || []).map((j) => j.fin) : []));
    await ctx.close();
    return f;
  })();
  const fin = fines[fines.length - 1];
  if (!fin) mal('jornada acabada en Directo: la demo no tiene jornadas');
  else {
    for (const [horas, nombre] of [[3, '3 h después'], [30, '30 h después']]) {
      const { ctx, page, errores } = await pagina({ reloj: fin + horas * 3600e3 });
      try {
        await page.goto(`${BASE}/index.html`);
        await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 });
        await page.evaluate(() => document.querySelector('[data-ir="directo"]').click());
        await page.waitForTimeout(900);
        const r = await page.evaluate(() => ({ eti: document.querySelector('.eti')?.innerText || '', tabs: [...document.querySelectorAll('.tabs button')].map((b) => b.innerText.trim()), filas: document.querySelectorAll('.rk-jor .fila').length, sub: document.querySelector('.sec .sub')?.innerText || '', equipos: window.S.D.clasif.length }));
        if (horas === 3) {
          if (!/acabada/i.test(r.eti) || r.tabs[0] !== 'Tu liga' || r.filas !== r.equipos || !/quedaste \d+º con \d+/.test(r.sub)) mal(`jornada acabada en Directo, ${nombre}: ${JSON.stringify(r)}`);
          else bien(`jornada acabada en Directo, ${nombre}: «${r.eti}», «Tu liga» primero con los ${r.filas} equipos («${r.sub}»)`);
          // (24 nov) «Por jornada» está en Rivales, delante de Cláusulas, y ya no en Directo
          const enDirecto = await page.evaluate(() => !!document.querySelector('[data-seg="directo:jornadas"]'));
          if (enDirecto) mal('Por jornada sigue en Directo');
          await page.evaluate(() => document.querySelector('[data-ir="rivales"]').click());
          await page.waitForTimeout(600);
          const orden = await page.evaluate(() => [...document.querySelectorAll('.tabs button')].map((b) => b.innerText.replace(/\d+|TOP/g, '').trim()));
          // (27 nov) la pestaña Cláusulas se quita y el parte va en su sitio, en dorado; «Cláusulas a tiro» ya no está
          const parteOro = await page.evaluate(() => !!document.querySelector('.tabs button.tab-oro[data-seg="rivales:parte"]'));
          const aTiro = await page.evaluate(() => /Cláusulas a tiro/.test(document.body.innerText) || !!document.querySelector('[data-seg="rivales:clausulas"]'));
          if (orden.join('|') !== 'Clasificación|Por jornada|Parte' || !parteOro || aTiro) mal(`Rivales: las pestañas no son Clasificación · Por jornada · Parte (dorada), o queda algo de Cláusulas: ${orden.join(' · ')}${parteOro ? '' : ' (sin la dorada)'}${aTiro ? ' (queda Cláusulas)' : ''}`);
          else bien('Rivales: Clasificación · Por jornada · Parte, en dorado, y nada de la pestaña Cláusulas');
          await page.evaluate(() => document.querySelector('[data-seg="rivales:jornadas"]').click());
          await page.waitForTimeout(600);
          const q = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.rk-jsel button')].map((b) => b.innerText), filas: document.querySelectorAll('.rk-jor .fila').length }));
          if (!q.chips.length || q.filas !== r.equipos) mal(`Por jornada, la clasificación de la jornada: ${JSON.stringify(q)}`);
          else bien(`Por jornada: la clasificación de la jornada (${q.chips.join(', ')}) con los ${q.filas} equipos`);
          // (24 nov, Carlos: «todas las jornadas de la liga, no solo la última, y si le das, el once de ese jugador con los
          // puntos de los jugadores, no su perfil»)
          if (q.chips.length < 2) mal(`Por jornada: solo sale ${q.chips.join(', ')}, no todas las jornadas`);
          await page.evaluate(() => document.querySelector('.rk-jor .fila[data-accion="onceJ"]').click());
          await page.waitForTimeout(900);
          const o = await page.evaluate(() => ({ tipo: window.S.tipoHoja && window.S.tipoHoja[0], cromos: document.querySelectorAll('.hoja .cancha .cromo').length, pts: [...document.querySelectorAll('.hoja .cancha .vivo-p')].filter((e) => /pts/.test(e.innerText)).length, perfil: !!document.querySelector('.hoja [data-r]') }));
          if (o.tipo !== 'oj' || o.cromos < 5 || !o.pts || !o.perfil) mal(`Por jornada: tocar a otro no abre su once con los puntos: ${JSON.stringify(o)}`);
          else bien(`Por jornada: ${q.chips.length} jornadas y tocar a otro abre su once de esa jornada (${o.cromos} jugadores con sus puntos)`);
          await page.evaluate(() => document.querySelector('[data-accion="cerrarHoja"]') && document.querySelector('[data-accion="cerrarHoja"]').click());
        } else if (/acabada/i.test(r.eti) || r.tabs.includes('Tu liga')) mal(`jornada acabada en Directo, ${nombre}: sigue saliendo: ${JSON.stringify(r)}`);
        else bien(`jornada acabada en Directo, ${nombre}: ya no sale («${r.eti}», ${r.tabs.join(' · ')})`);
        if (errores.length) mal(`jornada acabada en Directo: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
      } catch (e) { mal(`jornada acabada en Directo, ${nombre}: ${e.message.split('\n')[0]}`); }
      await ctx.close();
    }
  }
}

// 19 (24 nov, Carlos: «hay un texto abajo del todo que se corta y no se puede aumentar»): en un móvil de 360, con los pasos
// del plan abiertos, ninguna pastilla se corta ni acaba en «…», y un paso dice una frase y deja el resto en «Más detalle»
{
  const { ctx, page, errores } = await pagina({ ancho: 360, alto: 780, reloj: RELOJ });
  try {
    await page.goto(`${BASE}/index.html`);
    await page.waitForFunction(() => window.S && window.S.M && window.S.plan, null, { timeout: 25000 });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('details.paso2')];
      ps.forEach((d) => (d.open = true));
      const pills = [...document.querySelectorAll('.pp-d .claves span, .pp-d .pill')];
      const cortadas = pills.filter((e) => e.scrollWidth > e.clientWidth + 1 || /…$/.test(e.textContent.trim())).map((e) => e.textContent);
      const largas = ps.map((d) => d.querySelector('.pp-mot1')).filter(Boolean).map((p) => p.textContent.trim().split(/\s+/).length).filter((n) => n > 40);
      return { pasos: ps.length, pills: pills.length, cortadas, largas, mas: document.querySelectorAll('.pp-mas').length };
    });
    if (!r.pasos || r.cortadas.length || r.largas.length) mal(`plan en 360: ${JSON.stringify(r)}`);
    else bien(`plan en 360: ${r.pasos} pasos, ${r.pills} pastillas sin cortar, la frase de cada paso corta y ${r.mas} con «Más detalle»`);
    if (errores.length) mal(`plan en 360: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  } catch (e) { mal(`plan en 360: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}

// 20 (25 nov, auditoría de fallos, hallazgos 10-13): el atrás desde el resumen de tu equipo, desde el once de una jornada y
// desde un rival abierto en otra ficha vuelve a donde estabas, con «‹ Volver»; el candado de dentro de la ficha de un rival
// vuelve a ella; y en el iPhone cada candado dice lo que es verdad (invitando solo se abre el dinero de los rivales)
{
  const { ctx, page, errores } = await pagina({ reloj: RELOJ });
  const est = () => page.evaluate(() => ({ tipo: window.S.tipoHoja ? window.S.tipoHoja.join(':') : null, volver: ((document.querySelector('.hoja .volver-h') || {}).textContent || '').trim() }));
  const atras = async () => { await page.evaluate(() => window.atras()); await page.waitForTimeout(450); };
  const cerrarTodo = async () => { for (let i = 0; i < 5 && (await page.evaluate(() => !!window.S.hoja)); i++) await page.evaluate(() => document.querySelector('.hoja .hoja-cab [data-accion="cerrarHoja"]').click()).catch(() => {}), await page.waitForTimeout(350); };
  const tocar = async (sel) => { await page.evaluate((x) => document.querySelector(x).click(), sel); await page.waitForTimeout(600); };
  const ir = async (v) => { await page.evaluate((x) => { location.hash = '#' + x; }, v); await page.waitForTimeout(600); };
  const ida = async (nombre, abrir, dentro, espera) => {
    await cerrarTodo();
    try {
      await abrir();
      const a = await est();
      const hay = await page.evaluate((x) => !!document.querySelector(x), dentro);
      if (!a.tipo || !hay) { mal(`atrás, ${nombre}: no se abre o no hay nada dentro (${JSON.stringify(a)}, ${dentro}: ${hay})`); return; }
      await tocar(dentro);
      const b = await est();
      await atras();
      const c = await est();
      if (b.tipo === a.tipo || !b.volver || !espera.test(b.volver) || c.tipo !== a.tipo) mal(`atrás, ${nombre}: ${JSON.stringify({ a, b, c })}`);
      else bien(`atrás, ${nombre}: ${a.tipo} → ${b.tipo} con «‹ ${b.volver}» y el atrás vuelve a ${c.tipo}`);
    } catch (e) { mal(`atrás, ${nombre}: ${e.message.split('\n')[0]}`); }
  };
  try {
    await page.goto(`${BASE}/index.html`);
    await page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 25000 });
    await ir('hoy');
    await ida('desde el resumen de tu equipo', () => tocar('#app [data-accion="resumen"]'), '.hoja [data-j]:not([data-accion])', /Tu equipo hoy/);
    // el once de un mánager en una jornada (Rivales → Por jornada)
    await ir('rivales');
    await page.evaluate(() => { const b = document.querySelector('#vista [data-seg="rivales:jornadas"]'); if (b) b.click(); });
    await page.waitForTimeout(600);
    await ida('desde el once de una jornada', () => tocar('#app [data-accion="onceJ"]'), '.hoja [data-j]:not([data-accion])', /· J\d+/);
    // un jugador de otro mánager y, desde su ficha, su dueño
    const pid = await page.evaluate(() => { const S = window.S, yo = String(S.D.yo && S.D.yo.teamId); const x = (S.M.clausulas || []).find((c) => c.teamId && String(c.teamId) !== yo); return x ? String(x.pid) : null; });
    await ida('a un rival desde la ficha de un jugador', async () => { await page.evaluate((p) => { const b = document.createElement('button'); b.dataset.j = p; b.id = 'pruebaJ'; document.querySelector('#app').append(b); b.click(); b.remove(); }, pid); await page.waitForTimeout(600); }, '.hoja [data-r]', /\S/);
    // el candado dentro de la ficha de un rival: «Entendido» vuelve a la ficha
    await cerrarTodo();
    await tocar('#app [data-r]');
    const r0 = await est();
    await tocar('.hoja [data-accion="bloqueada"]');
    const b = await est();
    await page.evaluate(() => { const l = [...document.querySelectorAll('.hoja .bloq-hoja [data-accion="cerrarHoja"]')]; l[l.length - 1].click(); });
    await page.waitForTimeout(600);
    const c = await est();
    if (!/^r:/.test(r0.tipo || '') || !/^bloq:/.test(b.tipo || '') || !b.volver || c.tipo !== r0.tipo) mal(`atrás, el candado de la ficha de un rival: ${JSON.stringify({ r0, b, c })}`);
    else bien(`atrás, el candado de la ficha de un rival: «Entendido» vuelve a ${c.tipo}`);
    if (errores.length) mal(`atrás: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  } catch (e) { mal(`atrás: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}
{
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const { ctx, page, errores } = await pagina({ init: `Object.defineProperty(navigator, 'userAgent', { get: () => ${JSON.stringify(UA)} });`, reloj: RELOJ });
  try {
    await page.goto(`${BASE}/index.html`);
    await page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 25000 });
    const vistos = {};
    for (const v of ['mercado', 'rivales', 'equipo', 'hoy']) {
      await page.evaluate((x) => { location.hash = '#' + x; }, v); await page.waitForTimeout(600);
      const claves = await page.evaluate(() => [...new Set([...document.querySelectorAll('#app [data-accion="bloqueada"]')].map((e) => e.dataset.clave))]);
      for (const k of claves) {
        if (vistos[k]) continue;
        await page.evaluate((x) => [...document.querySelectorAll('#app [data-accion="bloqueada"]')].find((e) => e.dataset.clave === x).click(), k);
        await page.waitForTimeout(500);
        vistos[k] = await page.evaluate(() => { const h = document.querySelector('.hoja .bloq-hoja'); return h ? { t: h.innerText.replace(/\s+/g, ' '), play: !!h.querySelector('a[href*="play.google.com"]') } : null; });
        await page.evaluate(() => window.atras()); await page.waitForTimeout(350);
      }
    }
    const malos = Object.entries(vistos).filter(([k, x]) => !x || x.play || /Google Play/.test(x.t) || (k === 'dineroRivales' ? !/se abre invitando a un amigo/.test(x.t) : /invitando/.test(x.t) || !/de momento, no se puede abrir/.test(x.t)));
    if (!vistos.dineroRivales || Object.keys(vistos).length < 1 || malos.length) mal(`iPhone, los candados: ${JSON.stringify(vistos)}`);
    else bien(`iPhone, los candados dicen la verdad: ${Object.keys(vistos).join(', ')} (invitando, solo el dinero; sin Google Play)`);
    if (errores.length) mal(`iPhone, los candados: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  } catch (e) { mal(`iPhone, los candados: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}

await nav.close();
servidor.close();
console.log(fallos ? `\n${fallos} MAL` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
