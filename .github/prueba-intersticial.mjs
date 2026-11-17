// Los intersticiales de la app de Google Play (0.8), sin red: la web (intersticial.js y las pausas de app.js) con un
// Android de mentira que apunta lo que le piden. Comprueba que solo salen en una pausa natural (cambiar de pestaña con la
// barra o cerrar una ficha con la X), con los minutos de gracia, el tiempo entre uno y otro, el tope del día y la espera
// tras un bonificado, y nunca al dueño, a los de su liga, en la demo, con la IA pensando, escribiendo, con la pantalla del
// límite, yendo a Pregunta ni con el «atrás» de Android. Y que ya no se pide el banner.
// Uso: PW_MODULO=… node .github/prueba-intersticial.mjs   (sale con 1 si algo falla)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer(async (q, r) => {
  let ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (ruta.endsWith('/')) ruta += 'index.html';
  try { const b = await readFile(join(WEB, ruta)); r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

// el Android de mentira: lo que pide la web queda en window.__pedidos; el intersticial «se ve» y contesta al momento
const ANDROID = `window.__pedidos = []; window.__vista = true;
window.FantasyApp = new Proxy({
  avisosPermitidos: () => true, alarmasExactas: () => true, version: () => '9999', canal: () => 'play', hayQR: () => false, programarAvisos: () => {},
  hayAnuncios: () => true, aLaVista: () => window.__vista,
  zonaAnuncios: (si, b, inter) => { window.__pedidos.push(['zona', si, b, inter]); },
  aperturaAnuncios: (toca, b) => { window.__pedidos.push(['apertura', toca, b]); },
  intersticial: (b) => { window.__pedidos.push(['intersticial', b]); setTimeout(() => window.intersticialVisto && window.intersticialVisto(true, ''), 50); },
  verAnuncio: (p) => { window.__pedidos.push(['bonificado', p]); },
  preguntaEnMarcha: (rid, tk, vuelta, texto) => { window.__pedidos.push(['enMarcha', rid, vuelta, texto]); },
  preguntaAcabada: (ok, resumen) => { window.__pedidos.push(['acabada', ok, resumen]); },
  trabajandoCon: (si) => { window.__pedidos.push(['trabajando', si]); },
  guardar: (k, v) => { localStorage.setItem('fm-n-' + k, v); }, borrar: (k) => { localStorage.removeItem('fm-n-' + k); }, leer: (k) => localStorage.getItem('fm-n-' + k),
  // las peticiones de la app van por Android (sin CORS): aquí, un fetch normal que la prueba intercepta
  http: (id, metodo, url, cab, cuerpo) => { fetch(url, { method: metodo, headers: JSON.parse(cab || '{}'), body: cuerpo || undefined }).then(async (r) => ({ s: r.status, b: await r.text() }), (e) => ({ s: 0, e: String(e) })).then((r) => { (window.__resp ||= {})[id] = JSON.stringify(r); window.__http(id); }); },
  respuesta: (id) => { const r = (window.__resp || {})[id]; if (window.__resp) delete window.__resp[id]; return r || null; },
}, { get: (o, k) => { if (k === 'banner') window.__pedidos.push(['banner']); return k in o ? o[k] : undefined; } });
localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-beta-aviso', '1');`;

async function abrir({ dueno = false, suLiga = false, enSuLiga = false, demo = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.clock.install({ time: new Date('2026-11-03T10:00:00+01:00') });
  await page.addInitScript(ANDROID);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M && document.querySelector('.nav'), null, { timeout: 30000 });
  await page.evaluate(async ({ dueno, suLiga, enSuLiga, demo }) => {
    const U = await import('./js/util.js'), L = await import('./js/limite.js');
    const g = U.LS.get('limites', null) || { t: Date.now(), cfg: {} };
    g.t = Date.now();
    g.cfg = { ...(g.cfg || {}), sinLimite: ['667015'], todoAbierto: ['667015'], ligas: enSuLiga ? [window.S.D.liga.nombre] : ['Otra liga'], intersticial: { on: true, graciaMin: 3, cadaMin: 5, maxDia: 6, trasBonificadoMin: 3, suLiga, bloque: 'ca-app-pub-3175956326240112/1234567890' }, apertura: { on: true, bloque: 'ca-app-pub-3175956326240112/9876543210' } };
    U.LS.set('limites', g);
    if (!demo) { U.LS.del('demo'); window.S.D.demo = false; }
    const yo = { nombre: 'Unión Clausulera', teamId: window.S.D.yo.teamId, userId: dueno ? '667015' : '123456', ligas: [{ nombre: window.S.D.liga.nombre }] };
    L.fijarYo(yo, demo);
  }, { dueno, suLiga, enSuLiga, demo });
  const pedidos = () => page.evaluate(() => window.__pedidos.filter((p) => p[0] === 'intersticial').length);
  // un cambio de pestaña con la barra de abajo (a una distinta de la de ahora)
  const pestana = async (v) => { await page.click(`.nav button[data-ir="${v}"]`); await page.clock.runFor(800); };
  const uso = (min) => page.clock.runFor(min * 60e3);
  return { page, errores, pedidos, pestana, uso, cerrar: () => ctx.close() };
}

{
  const A = await abrir();
  await A.uso(1);
  await A.pestana('equipo');
  ok(await A.pedidos() === 0, 'en el primer minuto de uso, ninguno (gracia)');
  await A.uso(2.5);
  await A.pestana('rivales');
  ok(await A.pedidos() === 1, 'pasados 3 minutos de uso, al cambiar de pestaña con la barra: uno');
  const b = await A.page.evaluate(() => window.__pedidos.find((p) => p[0] === 'intersticial')[1]);
  ok(b === 'ca-app-pub-3175956326240112/1234567890', 'con el bloque de limites.json');
  await A.uso(1);
  await A.pestana('mercado');
  ok(await A.pedidos() === 1, 'otro cambio al minuto: ninguno (como mucho uno cada 5 minutos de uso)');
  // fuera de la app un rato (no cuenta como uso)
  await A.page.evaluate(() => { window.__vista = false; });
  await A.uso(10);
  await A.page.evaluate(() => { window.__vista = true; window.dispatchEvent(new Event('fm-vuelta')); });
  await A.uso(1);
  await A.pestana('hoy');
  ok(await A.pedidos() === 1, 'el rato fuera de la app no cuenta como uso');
  await A.uso(4.5);
  // con la IA pensando, no
  await A.page.evaluate(() => { window.S.charlando = true; });
  await A.pestana('equipo');
  ok(await A.pedidos() === 1, 'con la IA pensando, ninguno');
  await A.page.evaluate(() => { window.S.charlando = false; });
  // a Pregunta, no
  await A.page.click('#bPregunta');
  await A.page.clock.runFor(800);
  ok(await A.pedidos() === 1, 'yendo a Pregunta, ninguno');
  await A.pestana('hoy');
  ok(await A.pedidos() === 2, 'pasados otros 5 minutos de uso, en la siguiente pausa: el segundo');
  await A.uso(6);
  // el «atrás» de Android cerrando una ficha: no
  await A.page.evaluate(() => { const j = document.querySelector('#vista [data-j]'); if (j) j.click(); });
  await A.page.clock.runFor(800);
  const ficha = await A.page.evaluate(() => !!window.S.hoja);
  await A.page.evaluate(() => window.atras());
  await A.page.clock.runFor(800);
  ok(ficha && await A.pedidos() === 2, 'cerrar una ficha con el «atrás» de Android: ninguno');
  // con una ficha abierta y cerrándola con la X: sí
  await A.page.evaluate(() => { const j = document.querySelector('#vista [data-j]'); if (j) j.click(); });
  await A.page.clock.runFor(800);
  await A.page.evaluate(() => document.querySelector('.hoja [data-accion="cerrarHoja"]:not(.asa)')?.click() || document.querySelector('.hoja [data-accion="cerrarHoja"]')?.click());
  await A.page.clock.runFor(800);
  ok(await A.pedidos() === 3, 'cerrar una ficha con la X: el tercero');
  await A.uso(6);
  // justo después de un bonificado, no
  await A.page.evaluate(() => window.anuncioVisto('plan', true, ''));
  await A.page.clock.runFor(500);
  await A.page.evaluate(() => { if (window.S.hoja) document.querySelector('.hoja [data-accion="cerrarHoja"]')?.click(); });
  await A.pestana('equipo');
  ok(await A.pedidos() === 3, 'justo después de un bonificado: ninguno');
  await A.uso(3.5);
  // escribiendo (un campo con el foco), no
  await A.page.evaluate(() => { const i = document.createElement('input'); i.id = 'pruebaFoco'; document.body.appendChild(i); i.focus(); });
  await A.page.evaluate(() => document.querySelector('.nav button[data-ir="rivales"]').click());
  await A.page.clock.runFor(800);
  ok(await A.pedidos() === 3, 'con el teclado (un campo con el foco): ninguno');
  await A.page.evaluate(() => document.querySelector('#pruebaFoco').remove());
  // la pantalla del límite (sin salida): Android deja de tener permiso para anuncios
  await A.page.evaluate(() => { document.body.classList.add('limitado'); window.dispatchEvent(new Event('limite-cambia')); });
  const z = await A.page.evaluate(() => window.__pedidos.filter((p) => p[0] === 'zona').pop());
  ok(z && z[1] === false, 'con la pantalla del límite, Android ya no puede enseñar anuncios');
  await A.page.evaluate(() => { document.body.classList.remove('limitado'); window.dispatchEvent(new Event('limite-cambia')); });
  await A.pestana('equipo');
  ok(await A.pedidos() === 4, 'pasada la espera del bonificado: el cuarto');
  // el tope del día
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); U.LS.set('inter', { dia: U.diaDe(), n: 6, t: Date.now() - 60 * 60e3 }); });
  await A.uso(6);
  await A.pestana('hoy');
  ok(await A.pedidos() === 4, 'con 6 hoy (el tope): ninguno');
  // otra sesión: tras media hora fuera vuelven los minutos de gracia
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); U.LS.set('inter', { dia: U.diaDe(), n: 1, t: Date.now() - 60 * 60e3 }); window.__vista = false; });
  await A.uso(31);
  await A.page.evaluate(() => { window.__vista = true; window.dispatchEvent(new Event('fm-vuelta')); });
  await A.uso(1);
  await A.pestana('equipo');
  ok(await A.pedidos() === 4, 'al volver tras media hora fuera, otra vez los minutos de gracia');
  await A.uso(2.5);
  await A.pestana('rivales');
  ok(await A.pedidos() === 5, 'y pasados, el siguiente');
  // (17 nov) en una sesión nueva no hace falta esperar «cada» minutos desde el último de la sesión anterior: basta la gracia
  await A.page.evaluate(() => { window.__vista = false; });
  await A.uso(31);
  await A.page.evaluate(() => { window.__vista = true; window.dispatchEvent(new Event('fm-vuelta')); });
  await A.uso(3.5);
  await A.pestana('hoy');
  ok(await A.pedidos() === 6, 'otra sesión: pasada la gracia sale uno, aunque en uso no hayan pasado «cada» minutos desde el anterior');
  await A.uso(2);
  await A.pestana('equipo');
  ok(await A.pedidos() === 6, 'y dentro de esa sesión, el siguiente espera sus «cada» minutos');
  const p = await A.page.evaluate(() => window.__pedidos);
  ok(!p.some((x) => x[0] === 'banner'), 'ya no se pide nunca el banner de abajo');
  ok(p.some((x) => x[0] === 'zona' && x[1] === true && x[2] === 'ca-app-pub-3175956326240112/1234567890' && x[3] === true), 'Android sabe que la liga está cargada, el bloque y que a esta cuenta le tocan (para precargar)');
  ok(!A.errores.length, `sin errores en la página${A.errores.length ? `: ${A.errores.join(' | ')}` : ''}`);
  await A.cerrar();
}
for (const [t, o] of [['al dueño', { dueno: true }], ['a los de su liga', { enSuLiga: true }], ['en la liga de ejemplo', { demo: true }]]) {
  const A = await abrir(o);
  await A.uso(4);
  await A.pestana('equipo');
  await A.uso(6);
  await A.pestana('rivales');
  ok(await A.pedidos() === 0, `${t}: ninguno`);
  const z = await A.page.evaluate(() => window.__pedidos.filter((p) => p[0] === 'zona').pop());
  ok(!z || z[3] === false, `${t}: Android ni siquiera los carga`);
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); U.LS.set('ap-desde', '2026-10-01'); U.LS.del('apertura'); window.dispatchEvent(new Event('limite-cambia')); });
  await A.page.clock.runFor(300);
  const ap = await A.page.evaluate(() => window.__pedidos.filter((p) => p[0] === 'apertura').pop());
  ok(!ap || ap[1] === false, `${t}: tampoco el de apertura`);
  await A.cerrar();
}
{
  // (17 nov) el de apertura: nunca el primer día; desde el segundo, uno al día; visto, ya no toca hasta mañana
  const A = await abrir();
  const ultAp = () => A.page.evaluate(() => window.__pedidos.filter((p) => p[0] === 'apertura').pop());
  const repintar = async () => { await A.page.evaluate(() => window.dispatchEvent(new Event('limite-cambia'))); await A.page.clock.runFor(300); };
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); U.LS.del('ap-desde'); U.LS.del('apertura'); });
  await repintar();
  let ap = await ultAp();
  ok(ap && ap[1] === false, 'el de apertura, el primer día que usa la app: no');
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); U.LS.set('ap-desde', '2026-10-01'); });
  await repintar();
  ap = await ultAp();
  ok(ap && ap[1] === true && ap[2] === 'ca-app-pub-3175956326240112/9876543210', 'desde el segundo día: le toca (con el bloque de limites.json)');
  await A.page.evaluate(() => window.aperturaVista(true, ''));
  await A.page.clock.runFor(300);
  ap = await ultAp();
  ok(ap && ap[1] === false, 'visto hoy: ya no toca hasta mañana');
  const v = await A.page.evaluate(async () => { const U = await import('./js/util.js'); return U.LS.get('apertura', null); });
  ok(v && v.dia === '2026-11-03', 'apunta el día en que salió');
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); U.LS.set('apertura', { dia: '2026-11-02', t: 0 }); const g = U.LS.get('limites', null); g.cfg.apertura.on = false; U.LS.set('limites', g); });
  await repintar();
  ap = await ultAp();
  ok(ap && ap[1] === false, 'con «on»: false en «apertura», ninguno');
  ok(!A.errores.length, `sin errores en la página${A.errores.length ? `: ${A.errores.join(' | ')}` : ''}`);
  await A.cerrar();
}
{
  // el dueño, con «dueno» (su móvil es de prueba en AdMob): para que pueda verlos
  const A = await abrir({ dueno: true });
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); const g = U.LS.get('limites', null); g.cfg.intersticial.dueno = true; U.LS.set('limites', g); });
  await A.uso(4);
  await A.pestana('equipo');
  ok(await A.pedidos() === 1, 'al dueño con «dueno» (para probarlos en su móvil de prueba): sí');
  await A.cerrar();
}
{
  const A = await abrir({ enSuLiga: true, suLiga: true });
  await A.uso(4);
  await A.pestana('equipo');
  ok(await A.pedidos() === 1, 'a los de su liga con «suLiga»: sí');
  await A.cerrar();
}
{
  // (de paso) el chat en la app de Google Play: sin preguntas hoy sale la hoja del anuncio y, visto, se repregunta con
  // las 3 de más; Android sabe que hay una pregunta en marcha y cuándo acaba
  const A = await abrir();
  const pedidos = [];
  await A.page.route('**/fantasy-manager.fantasymanager-web-app.workers.dev/**', async (rt) => {
    const q = rt.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (q.method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors });
    if (!q.url().endsWith('/pregunta')) return rt.fulfill({ status: 404, headers: cors, body: '{}' });
    const b = JSON.parse(q.postData() || '{}');
    pedidos.push(b);
    const j = b.extra ? { texto: 'Con el anuncio: mira a Rival 2.', cupo: { usados: 4, gratis: 3, max: 6, extras: 3, porAnuncio: 3, quedan: 2, masConAnuncio: false } }
      : { e: 'Ya has hecho tus 3 preguntas de hoy.', cupo: { usados: 3, gratis: 3, max: 6, extras: 0, porAnuncio: 3, quedan: 0, masConAnuncio: true } };
    return rt.fulfill({ status: j.e ? 429 : 200, headers: cors, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await A.page.evaluate(async () => {
    const Pu = await import('./js/puente.js'), U = await import('./js/util.js');
    await Pu.guardar('sesion', { token: 'x'.repeat(40), caduca: Date.now() + 3600e3 });
    await Pu.guardar('gemini', null);
    const g = U.LS.get('limites', null); g.cfg.preguntas = { on: true, gratis: 3, porAnuncio: 3, max: 6 }; U.LS.set('limites', g);
  });
  await A.page.click('#bPregunta');
  await A.page.clock.runFor(600);
  await A.page.fill('#pregunta', '¿Qué le ficho al segundo?');
  await A.page.click('[data-accion="enviar"]');
  for (let i = 0; i < 40 && !(await A.page.evaluate(() => window.S.tipoHoja && window.S.tipoHoja[0] === 'anuncio')); i++) { await A.page.waitForTimeout(100); await A.page.clock.runFor(300); }
  const hoja = await A.page.evaluate(() => (document.querySelector('.hoja') || {}).innerText || '');
  ok(/Más preguntas a la IA/i.test(hoja) && /Ver el anuncio/i.test(hoja), 'sin preguntas hoy, en la de Google Play sale la hoja del anuncio');
  await A.page.click('.hoja [data-accion="verAnuncio"]');
  await A.page.clock.runFor(300);
  const pidio = await A.page.evaluate(() => window.__pedidos.some((p) => p[0] === 'bonificado' && p[1] === 'pregunta'));
  await A.page.evaluate(() => window.anuncioVisto('pregunta', true, ''));
  for (let i = 0; i < 40 && (await A.page.evaluate(() => window.S.charlando || !document.querySelector('.msg.ia'))); i++) { await A.page.waitForTimeout(100); await A.page.clock.runFor(300); }
  const visto = await A.page.evaluate(() => [...document.querySelectorAll('.msg.ia')].pop()?.innerText || '');
  ok(pidio && pedidos.length === 2 && pedidos[1].extra === true && pedidos[1].pregunta === pedidos[0].pregunta, 'visto el anuncio, la misma pregunta otra vez con las de más');
  ok(/Con el anuncio: mira a /.test(visto) && !/Rival 2/.test(visto), `la respuesta, con los nombres de verdad («${visto.replace(/\s+/g, ' ').slice(0, 60)}»)`);
  const p = await A.page.evaluate(() => window.__pedidos);
  const em = p.filter((x) => x[0] === 'enMarcha'), ac = p.filter((x) => x[0] === 'acabada');
  ok(em.length === 2 && em.every((x) => /^[a-z0-9]{8,24}$/.test(x[1])) && /^\{.*"rival 2"/.test(em[0][2]) && em[0][3] === '¿Qué le ficho al segundo?', 'Android sabe de cada pregunta en marcha (id, la vuelta de los alias y el texto)');
  ok(ac.length === 2 && ac[0][1] === false && ac[1][1] === true && /^Con el anuncio: mira a /.test(ac[1][2]) && !/Rival 2/.test(ac[1][2]), 'y de cuándo acaba (la primera sin cupo, la segunda con el principio de la respuesta y los nombres)');
  ok(p.some((x) => x[0] === 'trabajando' && x[1] === true) && p.filter((x) => x[0] === 'trabajando').pop()[1] === false, 'la app se marca ocupada mientras piensa y libre al acabar');
  ok(!A.errores.length, `sin errores en la página${A.errores.length ? `: ${A.errores.join(' | ')}` : ''}`);
  await A.cerrar();
}
{
  // apagado en limites.json
  const A = await abrir();
  await A.page.evaluate(async () => { const U = await import('./js/util.js'); const g = U.LS.get('limites', null); g.cfg.intersticial.on = false; U.LS.set('limites', g); });
  await A.uso(4);
  await A.pestana('equipo');
  ok(await A.pedidos() === 0, 'con «on»: false, ninguno');
  await A.cerrar();
}
await nav.close(); srv.close();
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
