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
    const okVenta = b.venta === rico.j.valor && vend.every((e) => e.falta <= b.venta) && b.espNo.filter((e) => !e.vendiendo).every((e) => e.falta > b.venta);
    // la plantilla llena: «Puedes ganar» con lo que cabe (aquí, solo el hueco que hace la venta)
    for (let i = 0; i < P.PLANTILLA_MAX; i++) D2.mercado.push({ id: `f${i}`, pid: `x${i}`, tipo: 'liga', miPuja: 1 });
    const c = P.cuentasParon({ ...S, M: M2, D: D2 });
    const okLlena = c.plazas === 0 && c.caben === 1 && c.gana === (c.esp[0] ? c.esp[0].beneficio : 0);
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

// 13: en la app, con versión nueva publicada no se juega (0.7.6): la ventana que no se cierra y lo que hace con cada
// respuesta de AlDia, con un puente de Android de mentira (paquete.json y app.json por su http)
{
  const puente = (cfg) => `(() => {
    const C = ${JSON.stringify(cfg)}; window.__fm = { C, bajadas: [], busquedas: 0 };
    sessionStorage.setItem('cargas', String((Number(sessionStorage.getItem('cargas')) || 0) + 1));
    const resp = {};
    window.FantasyApp = new Proxy({
      avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '5000', canal: () => C.canal, hayQR: () => false, programarAvisos: () => {},
      nativo: () => 'h1', web: () => JSON.stringify({ propia: 'x', activa: null, error: C.error || null }),
      http: (id, m, url) => { const b = /paquete\\.json/.test(url) ? C.paquete : /app\\.json/.test(url) ? C.app : null; resp[id] = JSON.stringify(b ? { s: 200, b: JSON.stringify(b) } : { s: 404, b: '' }); setTimeout(() => window.__http(id), 30); },
      respuesta: (id) => resp[id],
      buscarWeb: () => { window.__fm.busquedas++; setTimeout(() => window.webBuscada && window.webBuscada(C.buscar), 200); },
      actualizar: (u) => window.__fm.bajadas.push(u),
      webViva: () => {},
    }, { get: (o, k) => (k in o ? o[k] : undefined) });
    localStorage.setItem('fm-demo', 'true');
  })();`;
  const casos = [
    ['misma parte Android, AlDia la baja', { canal: 'github', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'nueva' }, 'recarga'],
    ['AlDia ya la descartó', { canal: 'github', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'igual' }, 'descargar'],
    // (0.7.13j) el APK de GitHub ya no se publica: con la parte Android nueva no ofrece ninguna descarga
    ['APK de GitHub con parte Android nueva', { canal: 'github', paquete: { version: '9.9.9', nativo: 'h2' }, buscar: 'apk' }, 'nada'],
    ['Google Play con parte Android nueva', { canal: 'play', paquete: { version: '9.9.9', nativo: 'h2' }, buscar: 'apk' }, 'nada'],
    ['Google Play, AlDia sin red', { canal: 'play', paquete: { version: '9.9.9', nativo: 'h1' }, buscar: 'error: sin red' }, 'reintentar'],
    ['la publicada no es más nueva', { canal: 'github', paquete: { version: '0.0.1', nativo: 'h1' }, buscar: 'igual' }, 'nada'],
  ];
  for (const [nombre, cfg, espera] of casos) {
    const { ctx, page, errores } = await pagina({ init: puente(cfg) });
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(2500);
    const hay = await page.$('#forzar');
    let r = '';
    if (espera === 'nada') r = hay ? 'sale la ventana y no debía' : '';
    else if (!hay) r = 'no sale la ventana';
    else {
      const botones = async () => page.$$eval('#forzar button', (bs) => bs.map((b) => b.textContent.trim() + (b.disabled ? '(off)' : '')));
      const b0 = await botones();
      if (espera === 'apk') {
        if (b0.join() !== 'Descargar la app') r = `botones ${b0.join()}`;
        else { await page.click('#forzar [data-accion="bajarApp"]'); const u = await page.evaluate(() => window.__fm.bajadas[0]); if (!/fantasy-manager\.apk$/.test(u || '')) r = `baja ${u}`; }
      } else {
        if (b0.join() !== 'Actualizar ahora') r = `botones al salir ${b0.join()}`;
        else {
          await page.click('#forzar [data-accion="ponerAppNueva"]');
          await page.waitForTimeout(900);
          const cargas = await page.evaluate(() => Number(sessionStorage.getItem('cargas'))).catch(() => 0);
          if (espera === 'recarga') { if (cargas < 2) r = 'no recarga con la nueva'; }
          else {
            const b1 = await botones();
            if (espera === 'descargar' && b1.join() !== 'Ir a Google Play,Volver a intentarlo') r = `botones tras «igual» ${b1.join()}`;
            if (espera === 'descargar' && await page.$('#forzar [data-accion="bajarApp"]')) r = 'aún ofrece descargar la app de fuera de Google Play';
            if (espera === 'reintentar' && b1.join() !== 'Volver a intentarlo') r = `botones tras el error ${b1.join()}`;
            const txt = await page.$eval('#forzar p', (p) => p.textContent);
            if (espera === 'reintentar' && !/sin red/.test(txt)) r = `no dice el motivo: ${txt}`;
          }
        }
      }
    }
    if (r) mal(`app nueva, ${nombre}: ${r}`); else bien(`app nueva, ${nombre}: ${espera === 'nada' ? 'no obliga' : espera}`);
    if (errores.length) mal(`app nueva, ${nombre}: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
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

// 15b: (16 nov, 0.7.13l) los planes a su hora y «Rehacer el plan»: por defecto a las 00:25 y las 12:25 (10 min después del
// mercado y 12 h después); un turno pasado sin plan de la IA hace que salga solo, y no si no quedan de hoy; en el plan, «Rehacer
// el plan» en lugar de «Compartir», y sus ajustes con el tono y las dos horas
{
  const { ctx, page, errores } = await pagina();
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
    const sube = una([...esp0, { j, pid: j.id, precio, valorFuturo: j.valor * 1.2, r: 0.025, beneficio: j.valor * 0.12 }]);
    const quieto = una(esp0);
    D.dinero = dOrig;
    // (0.7.13p) uno a su valor, bueno y sin bajar, que se paga con el saldo: vale para el once aunque no sea chollo; si no
    // te llega con el saldo, no
    const m2 = M.mercado.find((x) => x.tipo !== 'manager' && x.j && x.j.valor > 3e6 && x.j.valor < 25e6 && x.pid !== j.id && x.precio <= x.j.valor * 1.02 && !(antes.esp || []).some((e) => String(e.pid) === String(x.j.id))) || null;
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
      D.dinero = d0; M.inercia = ine0; M.tend = tend0;
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
// minutos, 2 veces por jornada; quién paga, 1 anuncio y 5 horas (todos los rivales); jornada nueva, a cero
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
  if (!r.quien.abierta || !r.quien.conRival || r.quien.horas !== 5 || r.quien.faltan !== 2) mal(`quién paga: ${JSON.stringify(r.quien)}`);
  else bien('quién paga: 1 anuncio, todos los rivales, 5 horas (y no gasta las veces del dinero)');
  if (r.tope.quedan !== 0 || !r.tope.tercero || !/Ya has visto el dinero de un rival las 2 veces/.test(r.hojaLlena)) mal(`dinero por rival: el tope de 2: ${JSON.stringify(r.tope)} / ${r.hojaLlena.slice(0, 160)}`);
  else bien('dinero por rival: 2 veces por jornada y la tercera ya no');
  if (!/5 horas/.test(r.hojaQuien) || /dos anuncios/.test(r.hojaQuien)) mal(`quién paga: la hoja: ${r.hojaQuien.slice(0, 200)}`);
  else bien('quién paga: la hoja dice un anuncio y 5 horas');
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
for (const [nombre, canal, cierre, espera] of [['APK de GitHub', 'github', null, 'aviso'], ['APK de GitHub ya cerrado', 'github', '2020-01-01T00:00:00+01:00', 'cerrada'], ['Google Play', 'play', '2020-01-01T00:00:00+01:00', 'nada'], ['web', null, '2020-01-01T00:00:00+01:00', 'nada']]) {
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
    : espera === 'aviso' ? r.hay && r.ahoraNo && r.play && r.banda && /dejará de funcionar el sábado 21 de noviembre/.test(r.t) && /gracias/.test(r.t)
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
  if (errores.length) mal(`Quién usa la app: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
  await ctx.close();
}

// 21: (19 nov, Carlos) una versión con todos: 'web' se presenta sola a los de la web y el iPhone, no en la app de Android;
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
        return { abierta, entera, boton: boton ? boton.innerText : null, hoja: (window.S.tipoHoja || [])[0] || null, sigue: !!document.querySelector('.nvt') };
      }, !!nw.aviso);
      const accion = nw.aviso ? nw.aviso.ir : (nw.cosas.find((c) => c.ir && c.ir.accion) || {}).ir;
      if (nw.aviso && (r.entera || r.sigue)) r.abierta = false;
      const sale = nw.todos === true || nw.todos === (app ? 'app' : 'web');
      const ok = !sale ? !r.abierta : r.abierta && (!accion || (r.boton === (accion.txt || 'Verlo') && r.hoja));
      if (!ok) mal(`novedades de una versión (${nw.v}), ${app ? 'app' : 'web'}: ${JSON.stringify(r)}`);
      else bien(`novedades de una versión (${nw.v}, todos: ${nw.todos}), ${app ? 'app' : 'web'}: ${sale ? `se abre sola y «${r.boton}» abre ${r.hoja}` : 'no se abre'}`);
      if (errores.length) mal(`novedades solo para la web: errores de la página: ${errores.slice(0, 3).join(' / ')}`);
      await ctx.close();
    }
  }
}

await nav.close();
servidor.close();
console.log(fallos ? `\n${fallos} MAL` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
