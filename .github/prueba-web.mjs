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
      rivAlguno: !!r || !l.some((a) => /^cl15-|^reabre15-/.test(a.id)),
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
  if (a0.n !== 5 || a0.abiertas || a0.botonEnSummary) mal(`Ajustes: secciones mal (${JSON.stringify(a0)})`);
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
// sin arreglos y sin lo de otra plataforma; en la web, nada de lo que es solo de la app
for (const [nombre, init] of [['web', ''], ['app', "window.FantasyApp = new Proxy({ avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '1', canal: () => 'github', hayQR: () => false, programarAvisos: () => {} }, { get: (o, k) => (k in o ? o[k] : undefined) }); localStorage.setItem('fm-demo', 'true');"]]) {
  const { ctx, page, errores } = await pagina({ init });
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
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
    return { nuevo: /Nuevo en la/.test(sub), t, soloImp: t.every((x) => imp.some((c) => c.t === x)), arreglos: !(li.length && li.every((x) => arr.some((c) => c.t === x))), alarmas: t.includes('Tus alarmas, cuándo quieras'), ajustes: t.includes('Ajustes, por secciones') };
  });
  if (r.sinFila) mal(`Novedades (${nombre}): no sale la fila en Ajustes`);
  else if (!r.nuevo || !r.soloImp || r.arreglos || !r.ajustes || r.alarmas !== (nombre === 'app') || r.t.length > 8) mal(`Novedades (${nombre}): ${JSON.stringify(r)}`);
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
  const { ctx, page, errores } = await pagina();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.M, null, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const Mo = await import('./js/motor.js');
    const { D, c } = window.S;
    const M = Object.create(window.S.M);
    const x = M.clausulas.find((y) => !['injured', 'suspended', 'out_of_league'].includes(y.j.estado));
    if (!x) return { sin: true };
    M.clausulas = [x]; x.abierta = true; x.meLlega = true; x.ratio = 2; D.dinero = Math.max(D.dinero, x.clausula * 2 + 1e6);
    M.mias = M.mias.filter((y) => y.j.pos !== x.j.pos);
    Object.assign(M, { sobrecoste: () => ({ indice: -100 }), tolerancia: () => 100, conSalida: () => true, compraCal: () => ({ ok: true }) });
    const caso = (interes, mejora) => {
      x.interes = interes; M.mejora = () => mejora;
      return { plan: (Mo.planAuto(D, M, c).operaciones || []).some((o) => o.accion === 'clausular' && o.pid === x.pid), hoy: Mo.esClausulable(M, x) };
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
    res.iaMotivo = /no es una cláusula que la app recomiende/.test(op.aviso || '');
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

// 11: (24) la pestaña Parón mira el hueco en la plantilla (contando tus pujas) y lo que sacarías vendiendo lo que te dice
// la app: con la plantilla llena sale el aviso, «Puedes ganar» solo cuenta lo que cabe y lo que te llega vendiendo antes
// va marcado
{
  const { ctx, page, errores } = await pagina();
  await ctx.route('**/js/demo.js', async (r) => {
    const cuerpo = (await readFile(join(WEB, 'js', 'demo.js'), 'utf8')).replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,');
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
    ['parte Android nueva', { canal: 'github', paquete: { version: '9.9.9', nativo: 'h2' }, buscar: 'apk' }, 'apk'],
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
            if (espera === 'descargar' && b1.join() !== 'Descargar la app,Volver a intentarlo') r = `botones tras «igual» ${b1.join()}`;
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

await nav.close();
servidor.close();
console.log(fallos ? `\n${fallos} MAL` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
