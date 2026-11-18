// El plan con la IA de la app cuando la conexión falla a medias (17 nov), sin red: la liga de ejemplo con los planes por la
// IA de la app (en la demo van con la clave; aquí se cambia `planesApp` al servir ia.js) y un servidor falso en lugar del
// de la app. `pedirWorker` va siempre al servidor publicado (no mira localStorage «fm-worker»), así que se le contesta en
// la propia página. En cada caso se pide el plan con el botón, como el usuario, y se mira lo que queda en pantalla:
//   - el plan de la app sigue ahí (el del motor, con sus pasos y nada tachado) y no se queda «Preparando» sin fin;
//   - el aviso dice lo que ha pasado de verdad (no «servidor de avisos», ni números ni cosas de dentro) y qué hacer;
//   - lo que se arregla solo (un corte y vuelve) acaba en el plan de la IA, recogido con el mismo id.
// Uso: PW_MODULO=… node .github/ia/caso-conexion.mjs   (sale con 1 si algo falla)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pagina, cerrar, WEB } from './banco.mjs';

const SERVIDOR = 'https://fantasy-manager.fantasymanager-web-app.workers.dev';
let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const IA = (await readFile(join(WEB, 'js', 'ia.js'), 'utf8')).replace('export const planesApp = (demo) => !demo && planesCfg().on;', 'export const planesApp = (demo) => planesCfg().on;');
if (!/export const planesApp = \(demo\) => planesCfg\(\)\.on;/.test(IA)) { console.log('MAL  no se ha podido cambiar planesApp en ia.js'); process.exit(1); }
const SESION = JSON.stringify({ token: 'x', renovar: 'y', caduca: Date.now() + 864e5 * 30, desde: Date.now() });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const JSONC = (status, j) => ({ status, headers: cors, contentType: 'application/json', body: typeof j === 'string' ? j : JSON.stringify(j) });

/**
 * Pide el plan con el servidor falso `servir(n, cuerpo)` (n: la vez que se le llama; devuelve lo que se manda con
 * route.fulfill, 'cortar', 'colgar' o una promesa de eso) y devuelve lo que se ve. `adelantar`: ms que se adelanta el
 * reloj de la página cada vez que llega un pedido que se cuelga. `clave`: con tu clave de Google además.
 */
const PLAN_JS = await readFile(join(WEB, 'js', 'plan.js'), 'utf8');
async function caso({ servir, adelantar = 0, clave = false, google = null, espera = 25000, romperMotor = false, escena = 'martes', pendAntes = 0 }) {
  const P = await pagina(escena, google || undefined);
  const rids = [];
  try {
    const { page } = P;
    await page.route('**/js/ia.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: IA }));
    // (el motor del plan roto: planDeHoy cae al plan de antes, sin motor)
    if (romperMotor) await page.route('**/js/plan.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: PLAN_JS.replace('R = rematarMotor(planVueltas(D, M, c).R, M);', "throw new Error('motor roto (prueba)');") }));
    let n = 0, reloj = null;
    await page.route(`${SERVIDOR}/**`, async (r) => {
      const q = r.request();
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      if (!/\/plan$/.test(new URL(q.url()).pathname)) return r.fulfill(JSONC(200, {}));
      let cuerpo = null;
      try { cuerpo = JSON.parse(q.postData() || 'null'); } catch (e) { cuerpo = null; }
      rids.push(cuerpo && cuerpo.rid);
      const x = await servir(n++, cuerpo);
      if (x === 'cortar') return r.abort('connectionreset');
      // (colgado: el reloj de la página corre `adelantar` ms cada 400 ms de verdad, hasta que la página se cierra)
      if (x === 'colgar') { if (adelantar && !reloj) reloj = setInterval(() => page.clock.fastForward(adelantar).catch(() => clearInterval(reloj)), 400); return; }
      return r.fulfill(x);
    });
    await page.evaluate(async ({ sesion, clave }) => {
      localStorage.setItem('fm-n-sesion', sesion);
      const P2 = await import('./js/puente.js');
      if (!clave) await P2.guardar('gemini', null);
    }, { sesion: SESION, clave });
    await page.reload();
    await page.waitForFunction(() => window.S && window.S.D && window.S.M && window.S.plan, null, { timeout: 30000 });
    await page.waitForSelector('.plan-rehacer', { timeout: 10000 });
    const antes = await page.evaluate(() => ({ auto: !!window.S.plan.auto, motor: !!window.S.plan.motor, pasos: (window.S.plan.ops || []).filter((o) => !o.descartada && !o.sugerencia).length }));
    // (19 nov) un pedido de antes en marcha (la app se cerró mientras la IA contestaba), hecho hace `pendAntes` ms
    if (pendAntes) await page.evaluate(async (antes) => { const U = await import('./js/util.js'); U.LS.set('plan-rid', { rid: 'pedidoviejo01', t: Date.now() - antes, dia: U.diaDe() }); }, pendAntes);
    const desde = await page.evaluate(() => Date.now());
    await page.click('.plan-rehacer');
    const t0 = Date.now();
    while (Date.now() - t0 < espera) {
      await page.waitForTimeout(400);
      const sigue = await page.evaluate(() => !!(window.S.planEstado && window.S.planEstado.cargando));
      if (!sigue) break;
    }
    if (reloj) clearInterval(reloj);
    const tarda = (await page.evaluate(() => Date.now())) - desde;
    return { tarda, ...(await page.evaluate(() => {
      const S = window.S, caja = document.querySelector('#vista .plan .error-c');
      return {
        cargando: !!(S.planEstado && S.planEstado.cargando), preparando: !!document.querySelector('#vista .cargando-ia'),
        error: caja ? caja.textContent.replace(/\s+/g, ' ').trim() : '', estado: S.planEstado || {},
        plan: S.plan ? { auto: !!S.plan.auto, motor: !!S.plan.motor, ia: !S.plan.auto, titular: S.plan.titular, pasos: (S.plan.ops || []).filter((o) => !o.descartada && !o.sugerencia).length, tachados: (S.plan.ops || []).filter((o) => o._k && (o.descartada || o.sugerencia)).length } : null,
        banda: (document.querySelector('#vista .plan .banda') || {}).textContent || '',
      };
    })), antes, rids, veces: n, errores: P.errores };
  } finally { await P.cerrar(); }
}

// el plan que contestaría la IA (vale para cualquier plan: sin pasos, solo textos)
const PLAN_OK = { plan: { titular: 'Hoy toca mover poco', situacion: 'Vas bien.', pasos: [], quita: [], mete: [], noticias: [], rivales: [] }, cupo: { usados: 1, gratis: 2, max: 5, quedan: 1 }, tok: { entra: 1, sale: 1 } };
const DENTRO = /servidor de avisos|worker|\b50\d\b|\b200\b|json|haiku|claude|gemini|modelo|rid\b/i;
const sigueLaApp = (r, que) => {
  ok(r.plan && r.plan.motor && r.plan.auto && r.plan.pasos === r.antes.pasos && !r.plan.tachados, `${que}: sigue el plan de la app, con sus ${r.antes.pasos} pasos y nada tachado`);
  ok(!r.cargando && !r.preparando, `${que}: no se queda «Preparando»`);
  ok(!DENTRO.test(r.error), `${que}: el aviso no lleva cosas de dentro («${r.error.slice(0, 160)}»)`);
  ok(!/plan de la app.*plan automático|plan automático.*plan de la app/i.test(r.error), `${que}: el aviso no dice dos veces que tienes el plan de la app`);
  if (r.errores.length) ok(false, `${que}: errores de la página: ${r.errores.slice(0, 2).join(' | ')}`);
};

// 1. el servidor contesta 503: la IA de la app no está
{
  const r = await caso({ servir: () => JSONC(503, { e: 'La IA de los planes no contesta ahora mismo. Tienes el plan de la app; vuelve a probar en un rato (este no cuenta).', estado: 503, servicio: true }) });
  sigueLaApp(r, '503');
  ok(/no está disponible ahora mismo|no contesta ahora mismo/.test(r.error) && /vuelve a probar/.test(r.error), `503: dice que la IA no está y que vuelvas a probar («${r.error.slice(0, 160)}»)`);
}
// 2. el tope del día de la IA de la app: no es «en un rato», es mañana
{
  const r = await caso({ servir: () => JSONC(503, { e: 'La IA de los planes ha llegado hoy a su tope. Tienes el plan de la app; mañana vuelve.', servicio: true, tope: true }) });
  sigueLaApp(r, 'tope del día');
  ok(/mañana/.test(r.error) && !/en un rato/.test(r.error), `tope del día: dice que hasta mañana («${r.error.slice(0, 160)}»)`);
}
// 3. una página de error que no es nuestra (la red de Cloudflare): HTML con 502
{
  const r = await caso({ servir: () => ({ status: 502, headers: cors, contentType: 'text/html', body: '<html><body>Bad gateway</body></html>' }) });
  sigueLaApp(r, '502 en HTML');
  ok(/no está disponible ahora mismo/.test(r.error), `502 en HTML: dice que la IA no está («${r.error.slice(0, 120)}»)`);
}
// 4. la respuesta llega vacía o cortada a media (solo los espacios de mientras piensa, o medio JSON)
for (const [que, body] of [['vacía', ''], ['solo los espacios', '      '], ['cortada a medias', '     {"plan":{"titular":"Hoy to']]) {
  const r = await caso({ servir: () => ({ status: 200, headers: cors, contentType: 'application/json', body }) });
  sigueLaApp(r, `respuesta ${que}`);
  ok(/se ha cortado por el camino/.test(r.error) && /vuelve a probar/.test(r.error), `respuesta ${que}: dice que se ha cortado y que vuelvas a probar («${r.error.slice(0, 160)}»)`);
  ok(r.veces >= 2 && new Set(r.rids).size === 1, `respuesta ${que}: se repite (${r.veces} veces) con el mismo id`);
}
// 5. la IA contesta sin el formato del plan (lo dice el servidor) y con un plan vacío
{
  const r = await caso({ servir: () => JSONC(200, '   ' + JSON.stringify({ e: 'La IA ha contestado sin el formato del plan. Tienes el plan de la app; vuelve a probar cuando quieras (este no cuenta).', estado: 502 })) });
  sigueLaApp(r, 'sin formato');
  ok(/sin el formato del plan/.test(r.error), `sin formato: lo dice («${r.error.slice(0, 120)}»)`);
  const r2 = await caso({ servir: () => JSONC(200, { plan: {}, cupo: { quedan: 1 } }) });
  sigueLaApp(r2, 'plan vacío');
  ok(/sin el formato del plan/.test(r2.error), `plan vacío: lo dice («${r2.error.slice(0, 120)}»)`);
}
// 6. sin conexión todo el rato (se corta cada vez): se reintenta y lo dice
{
  const r = await caso({ servir: () => 'cortar' });
  sigueLaApp(r, 'sin conexión');
  ok(/Sin conexión/.test(r.error) && r.veces >= 2 && r.veces <= 4, `sin conexión: lo intenta ${r.veces} veces y lo dice («${r.error.slice(0, 120)}»)`);
  ok(new Set(r.rids).size === 1 && !!r.rids[0], 'sin conexión: los reintentos van con el mismo id (si el servidor lo hizo, lo recoge sin gastar otro)');
}
// 7. se corta una vez y vuelve: sale el plan de la IA, con el mismo id
{
  const r = await caso({ servir: (n) => (n === 0 ? 'cortar' : JSONC(200, PLAN_OK)) });
  ok(r.plan && r.plan.ia && !r.error && !r.cargando, `un corte y vuelve: sale el plan de la IA (${r.plan && r.plan.titular})`);
  ok(r.rids.length === 2 && r.rids[0] === r.rids[1], 'un corte y vuelve: el segundo pedido lleva el mismo id');
}
// 8. el servidor no contesta nunca: como mucho 3 minutos en total (el reloj de la página se adelanta)
{
  // (19 nov, (72)) pedido antes del cierre de cláusulas y recogido ya con ellas cerradas: no se aplica, queda el de la app
  const r = await caso({ escena: 'veda-recien', pendAntes: 15 * 60e3, servir: () => JSONC(200, PLAN_OK) });
  sigueLaApp(r, 'recogido de antes del cierre');
  ok(/antes de que se cerraran las cláusulas/.test(r.error) && /pide otro/.test(r.error), `recogido de antes del cierre: lo dice («${r.error.slice(0, 160)}»)`);
  ok(r.rids[0] === 'pedidoviejo01' && r.veces === 1, 'recogido de antes del cierre: se recoge con el id de entonces (no gasta otro)');
  const r2 = await caso({ escena: 'veda-recien', pendAntes: 5 * 60e3, servir: () => JSONC(200, PLAN_OK) });
  ok(r2.plan && r2.plan.ia && !r2.error, `pedido ya con el cierre y recogido: se aplica (${r2.plan && r2.plan.titular})`);
}
{
  const r = await caso({ servir: () => 'colgar', adelantar: 10000, espera: 60000 });
  sigueLaApp(r, 'no contesta');
  ok(r.tarda <= 195000, `no contesta: se rinde a los ${Math.round(r.tarda / 1000)} s (como mucho 3 min)`);
  ok(/ha tardado demasiado/.test(r.error), `no contesta: dice que ha tardado demasiado («${r.error.slice(0, 120)}»)`);
  ok(r.veces >= 2 && r.veces <= 4, `no contesta: ${r.veces} pedidos antes de rendirse`);
}
// 9. 503 y con tu clave de Google: el plan sale con ella
{
  const r = await caso({ clave: true, servir: () => JSONC(503, { e: 'La IA de los planes no contesta ahora mismo.', servicio: true }), google: () => '```json\n{"pasos": [], "quita": [], "mete": [], "titular": "Hoy, con tu clave", "situacion": "Todo en orden."}\n```' });
  ok(r.plan && r.plan.ia && !r.error, `503 con tu clave: sale el plan con ella (${r.plan && r.plan.titular})`);
}
// 10. el motor del plan roto (con tu clave y con la IA de la app): la IA no tiene qué ordenar, se dice y queda el automático
// (antes, con tu clave, la IA escribía el plan entero: planLargo, quitado el 17 nov)
for (const clave of [false, true]) {
  const que = `motor roto${clave ? ' y con tu clave' : ''}`;
  const r = await caso({ clave, romperMotor: true, servir: () => JSONC(200, PLAN_OK), google: () => '{"operaciones": [], "titular": "x"}' });
  ok(r.plan && r.plan.auto && !r.plan.motor && !r.cargando, `${que}: sigue el plan automático (${r.plan && r.plan.pasos} pasos)`);
  ok(/no ha podido montar su plan/.test(r.error) && (r.error.match(/plan automático/g) || []).length === 1, `${que}: lo dice una vez («${r.error.slice(0, 170)}»)`);
  ok(r.veces === 0, `${que}: no se le pide nada a la IA de la app (${r.veces})`);
}
await cerrar();
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
