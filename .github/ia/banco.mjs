// El banco de pruebas de la IA (plan del día y chat). Sirve web/, abre la liga de ejemplo con Chromium a una hora fija
// (así el prompt y las cuentas salen iguales cada vez) y pone un Google de mentira delante: lo que la app le manda a la
// IA se captura tal cual y lo que «contesta» la IA lo decide la prueba (una respuesta escrita a mano o una de verdad,
// guardada). Todo pasa por el código real de la app: planDelDia + cuadrarPlan y charlar con su revisión.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
export const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'web');
export const MODELO_FALSO = 'gemini-3.5-flash';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

/* Los escenarios: la liga de ejemplo en distintos momentos. La jornada 10 de la demo empieza siempre «el próximo sábado
   a las 14:00», así que con la hora fija (martes 3 nov 2026) cae el sábado 7. */
export const ESCENAS = {
  // martes por la mañana, jornada el sábado: lo normal entre semana
  martes: { hora: '2026-11-03T10:00:00+01:00' },
  // viernes por la tarde: cláusulas cerradas (las 24 h de antes del primer partido)
  veda: { hora: '2026-11-06T16:00:00+01:00' },
  // sábado por la tarde: la jornada en juego, el once cerrado
  enjuego: { hora: '2026-11-07T16:00:00+01:00' },
  // parón de selecciones con la vuelta a más de 3 días
  paron: { hora: '2026-11-03T10:00:00+01:00', demo: (s) => s.replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,') },
  // en negativo entre semana (ha tirado de deuda)
  negativo: { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = -4200000;' },
  // con dinero de sobra (60 M): vender no hace falta ni contando las pujas que ya tiene puestas
  holgado: { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = 60000000;' },

  /* --- las del motor del plan (casos «motor», sin IA). En esos casos el motor se rehace siempre como en la app (con las
     fichas, los onces probables y lo que diga `extra`), para que el once salga igual en todas las escenas --- */
  // martes, sin la puja de 36,3 M que la liga de ejemplo trae puesta: el saldo es lo que hay
  'm-limpio': { hora: '2026-11-03T10:00:00+01:00', prep: 'for (const m of S.D.mercado) m.miPuja = null;' },
  'm-negativo': { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = -4200000;' },
  'm-holgado': { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = 60000000;' },
  // viernes, con las cláusulas cerradas y sin pujas puestas
  'm-cierre': { hora: '2026-11-06T16:00:00+01:00', prep: 'for (const m of S.D.mercado) m.miPuja = null;' },
  // en negativo y con las cláusulas ya cerradas: no queda ningún cambio de mercado que valga antes de la jornada
  'm-cierre-negativo': { hora: '2026-11-06T16:00:00+01:00', prep: 'S.D.dinero = -4200000;' },
  // la plantilla llena (25) y sin pujas puestas
  'm-25': { hora: '2026-11-03T10:00:00+01:00', prep: `for (const m of S.D.mercado) m.miPuja = null;
    const con = new Set(Object.values(S.D.plantillas).flat().map((f) => f.pid)), enM = new Set(S.D.mercado.map((m) => m.pid));
    const libres = Object.values(S.D.maestro).filter((j) => !con.has(j.id) && !enM.has(j.id) && j.pos !== 5).sort((a, b) => a.valor - b.valor).slice(0, 10);
    for (const j of libres) S.D.plantillas[S.D.yo.teamId].push({ pid: j.id, ptId: 'pt' + j.id, clausula: Math.round(j.valor * 1.6), protegidoHasta: Date.now() + 10 * 864e5, compra: j.valor });` },
  // sin porteros (un hueco en el once) y con dinero para taparlo
  'm-hueco': { hora: '2026-11-03T10:00:00+01:00', prep: `S.D.dinero = 80000000;
    S.D.plantillas[S.D.yo.teamId] = S.D.plantillas[S.D.yo.teamId].filter((f) => S.D.maestro[f.pid].pos !== 1);` },
  // un titular mío (Ionut Radu) con la cláusula abierta y casi a su valor: le llega a varios rivales
  'm-clausula-mia': { hora: '2026-11-03T10:00:00+01:00', prep: `const f = S.D.plantillas[S.D.yo.teamId].find((x) => S.D.maestro[x.pid].nombre === 'Ionut Radu');
    f.clausula = Math.round(S.D.maestro[f.pid].valor * 1.03); f.protegidoHasta = null;` },
  // jueves, con uno comprado para revender (Jon Martin): toca ponerlo a la venta para el último cambio de mercado
  'm-reventa': { hora: '2026-11-05T12:00:00+01:00', prep: '', extra: `const j = Object.values(S.D.maestro).find((x) => x.nombre === 'Jon Martin'); return { reventa: { [j.id]: { t: Date.now() - 2 * 864e5, precio: Math.round(j.valor * 0.95) } } };` },
};

let nav = null, srv = null, BASE = null, demoDe = null;
async function arrancar() {
  if (nav) return;
  srv = http.createServer(async (q, r) => {
    let ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (ruta.endsWith('/')) ruta += 'index.html';
    try {
      let b = await readFile(join(WEB, ruta));
      if (ruta.endsWith('demo.js') && demoDe) b = Buffer.from(demoDe(b.toString('utf8')));
      r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' });
      r.end(b);
    } catch (e) { r.writeHead(404); r.end('no'); }
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  BASE = `http://127.0.0.1:${srv.address().port}`;
  nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
}
export async function cerrar() { if (nav) await nav.close(); if (srv) srv.close(); nav = null; srv = null; }

const sse = (j) => `data: ${JSON.stringify(j)}\n\n`;
const respuestaGoogle = (texto) => ({ candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } });

/**
 * una página con la liga de ejemplo en ese escenario. `contesta(cuerpo, url)` devuelve el texto que «dice» la IA (o el
 * JSON entero de Google); lo que la app le manda queda en `pedidos`.
 */
export async function pagina(escena, contesta = () => 'vale') {
  await arrancar();
  const E = ESCENAS[escena] || ESCENAS.martes;
  demoDe = E.demo || null;
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  const pedidos = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route('**/*', async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (u.hostname !== 'generativelanguage.googleapis.com') return r.abort('blockedbyclient');
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (/\/models(\?|$)/.test(u.pathname + u.search) && q.method() === 'GET') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ models: [{ name: `models/${MODELO_FALSO}`, supportedGenerationMethods: ['generateContent'] }] }) });
    let cuerpo = null;
    try { cuerpo = JSON.parse(q.postData() || 'null'); } catch (e) { cuerpo = null; }
    pedidos.push({ url: u.pathname, cuerpo });
    let c = await contesta(cuerpo, u.pathname);
    if (typeof c === 'string') c = respuestaGoogle(c);
    if (/streamGenerateContent/.test(u.pathname)) return r.fulfill({ status: 200, headers: cors, contentType: 'text/event-stream', body: sse(c) });
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(c) });
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.clock.install({ time: new Date(E.hora) });
  await page.addInitScript("localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-tema-aviso', '1');");
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
  // una clave de mentira (la llamada no sale de la máquina) y, si el escenario toca los datos, el motor otra vez
  await page.evaluate(async (prep) => {
    const P = await import('./js/puente.js');
    await P.guardar('gemini', 'AIzaPRUEBA-banco-de-la-IA-0000000000000');
    if (prep) {
      const S = window.S;
      // eslint-disable-next-line no-new-func
      new Function('S', prep)(S);
      const Mo = await import('./js/motor.js');
      S.M = Mo.analizar(S.D, S.H, S.c, {});
    }
  }, E.prep || null);
  return { page, pedidos, errores, cerrar: () => ctx.close() };
}

const conCuerda = (page, promesa) => promesa;

/** pregunta en el chat como lo hace la app; devuelve lo que acaba viendo el mánager y lo que se apuntó */
export async function chat(escena, pregunta, contesta, { hist = [], notas = [] } = {}) {
  const P = await pagina(escena, contesta);
  try {
    const r = await conCuerda(P.page, P.page.evaluate(async ({ pregunta, hist, notas }) => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
      const { D, M } = window.S;
      if (hist.length) U.LS.set(Dt.K('chat'), hist.map((m, i) => ({ r: i % 2 ? 'ia' : 'yo', t: m, ts: Date.now() - (hist.length - i) * 60000 })));
      if (notas.length) { U.LS.set(Dt.K('notas'), notas.map((n, i) => ({ id: `n${i}`, t: Date.now() - 3600e3, tipo: 'otro', ...n, pid: n.jugador ? I.pidDe(n.jugador, D) : null }))); U.LS.set(Dt.K('notas-t'), Date.now()); }
      try {
        const x = await I.charlar(pregunta, D, M, Dt.cfg(), null, null, []);
        return { texto: x.texto, apuntadas: x.apuntadas || [], vista: [x.texto, ...(x.apuntadas || []).map((n) => `NOTA: ${n.tipo || ''} · ${n.texto}${n.importe ? ` · ${U.eur(n.importe)}` : ''}`)].join('\n') };
      } catch (e) { return { error: e.message }; }
    }, { pregunta, hist, notas }));
    return { ...r, pedidos: P.pedidos, errores: P.errores };
  } finally { await P.cerrar(); }
}

/** pide el plan como lo hace la app y lo pasa por cuadrarPlan; devuelve la «vista»: lo que acaba viendo el mánager */
export async function plan(escena, contesta) {
  const P = await pagina(escena, contesta);
  try {
    const r = await conCuerda(P.page, P.page.evaluate(async () => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
      const { D, M } = window.S;
      let Pl;
      try { Pl = await I.planDelDia(D, M, Dt.cfg(), {}); } catch (e) { return { error: e.message }; }
      const r = I.cuadrarPlan(Pl, D, M);
      const L = [`TITULAR: ${r.titular || Pl.titular || ''}`, `SITUACION: ${r.situacion || Pl.situacion || ''}`];
      const linea = (o) => `${o.etiqueta || o.accion} ${(o.j && o.j.nombre) || o.jugador || ''}${o.importe ? ` ${U.eur(o.importe)}` : ''}${o.cuando ? ` (${o.cuando})` : ''}${o.aviso ? ` | ${o.aviso}` : ''}`;
      for (const o of r.ops || []) L.push(`${o.descartada ? 'DESCARTADA' : o.sugerencia ? 'SUGERENCIA' : o.ya ? 'HECHA' : 'OP'}: ${linea(o)}`);
      const al = r.alineacion || null;
      if (al) L.push(`ONCE: ${al.formacion || ''} · ${(al.titulares || []).map((t) => (t && t.nombre) || t).join(', ')}`);
      if (r.avisoSaldo) L.push(`SALDO: ${r.avisoSaldo}`);
      const ops = (r.ops || []).filter((o) => !['alinear', 'esperar'].includes(o.accion));
      return { vista: L.join('\n'), n: ops.length, descartadas: ops.filter((o) => o.descartada).length, crudo: Pl };
    }));
    return { ...r, pedidos: P.pedidos, errores: P.errores };
  } finally { await P.cerrar(); }
}

/**
 * EL ÁRBITRO: las reglas de LaLiga de claude/revision-ia.md (1-15) aplicadas a un plan ya cuadrado, con una cuenta aparte
 * que no usa nada del motor del plan. Devuelve las líneas REGLAS, JORNADA, HUECOS, ONCE_PTS, ONCE_BAJA y VENDE_POR_CAJA.
 * No usa nada de fuera (se manda a la página como texto): lo que necesita le llega por los argumentos.
 */
export function arbitro(R, D, M, eur) {
  const L = [];
  const nom = (o) => (o.j && o.j.nombre) || o.jugador || '';
  const mal = [];
  const vivos = (R.ops || []).filter((o) => !o.descartada && !o.sugerencia && !o.ya);
  const ciclos = (M.ventanaEsp && M.ventanaEsp.ciclos) || 0;
  const rev = (o) => String(o.objetivo || '').startsWith('revend');
  const acepta = (o) => o.accion === 'vender' && o.etiqueta === 'Aceptar oferta';
  let caja = +D.dinero, pujado = +M.misPujas || 0, n = M.mias.length, escudos = 0, vuelve = 0, ventas = 0;
  const salen = new Set(), entran = [];
  for (const o of vivos) {
    const hoy = o.hoy !== false, imp = +o.importe || 0, q = nom(o);
    if (['vender', 'clausular', 'pujar', 'comprar', 'blindar'].includes(o.accion) && !String(o.motivo || '').trim()) mal.push(`sin motivo: ${o.accion} ${q}`);
    if (o.accion === 'vender') {
      if (!M.mias.some((x) => x.pid === o.pid)) mal.push(`${q} no es mío`);
      salen.add(o.pid);
      if (acepta(o)) { if (hoy) { caja += imp; n--; } } else if (ciclos >= 1) ventas += imp * 0.9;
    } else if (o.accion === 'clausular') {
      const cl = M.clausulas.find((x) => x.pid === o.pid);
      if (!cl) { mal.push(`${q} no tiene cláusula que pagar`); continue; }
      if (hoy && M.vedaAhora) mal.push(`r7: clausular a ${q} con las cláusulas cerradas`);
      if (hoy && !cl.abierta) mal.push(`r2: la cláusula de ${q} no está abierta`);
      if (imp > caja + 1) mal.push(`r5: la cláusula de ${q} (${eur(imp)}) no cabe en el saldo (${eur(caja)})`);
      caja -= imp; n++; entran.push(o.j);
      if (rev(o)) { if (ciclos < 1) mal.push(`r3: no da tiempo a revender a ${q}`); vuelve += imp * 0.92; if (!o.vender_el) mal.push(`${q}: para revender y sin día de venta`); }
      else if (M.mereceClausula && !M.mereceClausula(cl) && !String(o.objetivo || '').startsWith('revend')) mal.push(`hoy: la cláusula de ${q} no pasa la regla de Hoy y las alarmas`);
    } else if (o.accion === 'pujar' || o.accion === 'comprar') {
      if (M.dueno[o.pid] && o.accion === 'pujar') mal.push(`${q} tiene dueño: no se puja`);
      if (hoy) { pujado += imp; n++; entran.push(o.j); }
      if (rev(o)) { if (ciclos < 2) mal.push(`r3: no da tiempo a revender a ${q}`); vuelve += imp * 0.92; if (!o.vender_el) mal.push(`${q}: para revender y sin día de venta`); }
    } else if (o.accion === 'blindar') {
      const x = M.mias.find((y) => y.pid === o.pid);
      if (!x) { mal.push(`${q} no es mío`); continue; }
      if (imp) { if (imp > caja + 1) mal.push(`r5: subir la cláusula de ${q} no cabe en el saldo`); caja -= imp; }
      else { escudos++; if (hoy && !x.abierta) mal.push(`r9: blindaje a ${q} con la cláusula cerrada`); }
    } else if (o.accion === 'alinear' && M.enJuego) mal.push('r8: alinear con la jornada en juego');
  }
  if (M.escudosMios && escudos > M.escudosMios.quedan) mal.push(`r9: ${escudos} blindajes y quedan ${M.escudosMios.quedan}`);
  // (si ya estaba pasado antes del plan, lo que no puede es dejarlo peor)
  if (caja - pujado < -M.deuda - 1 && caja - pujado < +D.dinero - (+M.misPujas || 0) - 1) mal.push(`r4: ${eur(caja - pujado)} pasa el tope de deuda (${eur(-M.deuda)})`);
  if (n > 25) mal.push(`r12: la plantilla se iría a ${n}`);
  // lo pujado se cobra en el cambio de mercado: si el próximo llega con la jornada ya empezada, para esta no cuenta
  const pujasAntes = !M.cierreMercado || !M.proxima || M.cierreMercado < M.proxima.ini;
  const jornada = pujasAntes ? caja - pujado + vuelve + ventas : caja + ventas;
  if (jornada < 0) mal.push(`r10: empezaría la jornada en ${eur(jornada)}`);
  if (M.enJuego && R.alineacion) mal.push('r8: once con la jornada en juego');
  L.push(`REGLAS: ${mal.length ? `MAL ${mal.join(' · ')}` : 'ok'}`);
  L.push(`JORNADA: ${eur(jornada)}`);
  const antes = M.mejorOnce(M.mias.map((x) => x.j));
  const despues = M.mejorOnce([...M.mias.filter((x) => !salen.has(x.pid)).map((x) => x.j), ...entran.filter(Boolean)]);
  const d1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  L.push(`HUECOS: ${antes.huecos || 0} → ${despues.huecos || 0}`);
  L.push(`ONCE_PTS: ${d1(antes.total)} → ${d1(despues.total)}`);
  if ((despues.huecos || 0) > (antes.huecos || 0) || despues.total < antes.total - 1.5) L.push(`ONCE_BAJA: ${d1(antes.total - despues.total)}${(despues.huecos || 0) > (antes.huecos || 0) ? ' y con huecos' : ''}`);
  // vender sin más motivo que el dinero: ni está de baja, ni ha girado, frena o baja, ni es de revender, ni le pagan más
  // de lo que subiría aguantándolo hasta la jornada (Fornals, 13 nov)
  const pagaCaja = vivos.some((o) => ['clausular', 'blindar'].includes(o.accion) && +o.importe > +D.dinero);
  const diasJ = M.proxima ? Math.min(14, Math.max(1, Math.ceil((M.proxima.ini - Date.now()) / 864e5) - 1)) : 3;
  for (const o of vivos.filter((x) => x.accion === 'vender')) {
    const x = M.mias.find((y) => y.pid === o.pid);
    if (!x) continue;
    const ine = M.inercia(o.pid), v = (M.misVentas || []).find((y) => y.pid === o.pid), t = M.tend(o.pid) || {};
    const p7 = t.p7e !== undefined ? t.p7e : t.p7;
    const sube = !!ine && ['sube', 'acelera'].includes(ine.fase) && ine.ult >= x.j.valor * 0.005;
    const prima = acepta(o) && v && v.mejor ? v.mejor.importe - x.j.valor : 0;
    const motivo = M.vendeBaja(x) || x.j.pos === 5 || (ine && ['giro', 'baja', 'frena', 'parado'].includes(ine.fase)) || (M.paraRevender || []).some((y) => y.pid === o.pid)
      || (t.p1 != null && t.p1 < -0.5) || (p7 != null && p7 < -2)
      || (acepta(o) && v && v.mejor && v.mejor.sobre >= 0.02 && (!sube || prima >= ine.proy(diasJ)));
    const haceFalta = jornada - (acepta(o) ? +o.importe : ciclos >= 1 ? +o.importe * 0.9 : 0) < 0 || (acepta(o) && pagaCaja);
    if (!motivo && !haceFalta) L.push(`VENDE_POR_CAJA: ${nom(o)} (${ine ? ine.fase : 'sin datos'}${v && v.mejor ? `, oferta ${Math.round(v.mejor.sobre * 1000) / 10} %` : ''})`);
  }
  return L;
}

/**
 * El plan del motor (sin IA) en ese escenario, ya cuadrado por la app, y lo que dice de él el ÁRBITRO: una cuenta aparte,
 * escrita solo con las reglas de LaLiga de claude/revision-ia.md (1-15), que no usa nada del motor del plan. Lo que se ve:
 *   TITULAR / SITUACION / OP … [objetivo] (cuándo) · vender el … / ONCE / SALDO, como en el plan de la IA, y además
 *   REGLAS: ok | REGLAS: MAL r5 …      las reglas que el plan se salta (dinero, deuda, 25, blindajes, cierre, jornada)
 *   JORNADA: lo que tendría al empezar la jornada haciendo el plan (lo de revender al 92 % y lo puesto en venta al 90 %)
 *   HUECOS: a → b   y   ONCE_PTS: a → b   el once antes y después del plan
 *   ONCE_BAJA: cuánto pierde el once (si pierde más de 1,5 puntos o gana huecos)
 *   VENDE_POR_CAJA: una venta sin más motivo que el dinero, y sin que el dinero haga falta
 * `MOTOR=viejo` mide el plan sin IA de antes (planAuto), para comparar.
 */
export async function motor(escena) {
  const P = await pagina(escena);
  try {
    await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
    const r = await P.page.evaluate(async ({ viejo, extra }) => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Mo = await import('./js/motor.js');
      const S = window.S, arbitro = window.__arbitro;
      // el motor, como lo monta la app: con las fichas, los onces probables y las noticias (llegan un momento después de abrir)
      for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
      const f = S.fuentes || {};
      // eslint-disable-next-line no-new-func
      S.M = Mo.analizar(S.D, S.H, S.c, { det: S.det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, ...(extra ? new Function('S', extra)(S) : {}) });
      const { D, M, c } = S;
      let R;
      try {
        if (viejo) R = Mo.rematarAuto(I.cuadrarPlan(Mo.planAuto(D, M, c), D, M));
        else { const Pm = await import('./js/plan.js'); R = Pm.planDeHoy(D, M, c); }
      } catch (e) { return { error: `${e.message}\n${String(e.stack || '').split('\n').slice(1, 4).join('\n')}` }; }
      const eur = U.eur, nom = (o) => (o.j && o.j.nombre) || o.jugador || '';
      const L = [`TITULAR: ${R.titular || ''}`, `SITUACION: ${R.situacion || ''}`];
      const linea = (o) => `${o.etiqueta || o.accion} ${nom(o)}${o.importe ? ` ${eur(o.importe)}` : ''}${o.objetivo ? ` [${o.objetivo}]` : ''}${o.cuando ? ` (${o.cuando})` : ''}${o.vender_el ? ` · vender el ${o.vender_el}` : ''}${o.aviso ? ` | ${o.aviso}` : ''}`;
      for (const o of R.ops || []) L.push(`${o.descartada ? 'DESCARTADA' : o.sugerencia ? 'SUGERENCIA' : o.ya ? 'HECHA' : 'OP'}: ${linea(o)}`);
      const al = R.alineacion || null;
      if (al) L.push(`ONCE: ${al.formacion || ''} · ${(al.titulares || []).map((t) => (t && t.nombre) || t).join(', ')}`);
      if (R.avisoSaldo) L.push(`SALDO: ${R.avisoSaldo}`);
      if (R.avisoOnce) L.push(`AVISO_ONCE: ${R.avisoOnce}`);
      if (R.cuentas && R.cuentas.punto) L.push(`MOTOR: 1 punto en una jornada ≈ ${eur(R.cuentas.punto.v)} (${R.cuentas.punto.de}) · ${R.cuentas.candidatos} candidatos, ${R.cuentas.probados} en la búsqueda${R.vueltas ? `, ${R.vueltas} vuelta${R.vueltas > 1 ? 's' : ''} por descartes` : ''}${R.cuentas.backtest ? ` · reventas pasadas: ${R.cuentas.backtest.bien} de ${R.cuentas.backtest.n} bien, ${eur(R.cuentas.backtest.media, { signo: true })} de media a ${R.cuentas.backtest.dias} días` : ''}`);

      L.push(...arbitro(R, D, M, eur));
      const ops = (R.ops || []).filter((o) => !['alinear', 'esperar'].includes(o.accion));
      return { vista: L.join('\n'), n: ops.length, descartadas: ops.filter((o) => o.descartada).length };
    }, { viejo: process.env.MOTOR === 'viejo', extra: (ESCENAS[escena] || {}).extra || null });
    return { ...r, errores: P.errores };
  } finally { await P.cerrar(); }
}

/** ¿cumple el caso? `debe` y `nunca` son expresiones regulares (texto, sin mayúsculas ni minúsculas) sobre lo que se ve */
export function juzgar(caso, visto) {
  const fallos = [];
  const re = (s) => (s instanceof RegExp ? s : new RegExp(s, 'ims'));
  if (visto == null) return ['sin respuesta'];
  for (const d of caso.debe || []) if (!re(d).test(visto)) fallos.push(`falta ${re(d)}`);
  for (const n of caso.nunca || []) { const m = visto.match(re(n)); if (m) fallos.push(`sobra «${m[0].slice(0, 80)}»`); }
  return fallos;
}
