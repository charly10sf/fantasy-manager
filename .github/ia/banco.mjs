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

/** ¿cumple el caso? `debe` y `nunca` son expresiones regulares (texto, sin mayúsculas ni minúsculas) sobre lo que se ve */
export function juzgar(caso, visto) {
  const fallos = [];
  const re = (s) => (s instanceof RegExp ? s : new RegExp(s, 'ims'));
  if (visto == null) return ['sin respuesta'];
  for (const d of caso.debe || []) if (!re(d).test(visto)) fallos.push(`falta ${re(d)}`);
  for (const n of caso.nunca || []) { const m = visto.match(re(n)); if (m) fallos.push(`sobra «${m[0].slice(0, 80)}»`); }
  return fallos;
}
