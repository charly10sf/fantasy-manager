// (22 nov, Carlos: «en la web me sale un plan distinto al de la app móvil; tienen que ser todos iguales, al igual que las
// preguntas que hagas en un sitio te aparezcan en el otro») Dos navegadores con la misma cuenta (el móvil y la web) y un
// servidor de mentira con la lógica de verdad (worker/src/sinc.js):
//  (a) el plan de la IA que se hace en uno llega al otro, y el otro ya no pide el suyo
//  (b) la conversación de Pregunta: lo que se pregunta en uno sale en el otro; un chat nuevo en uno deja el del otro en
//      «Anteriores»; con una pregunta en marcha no se toca
//  (c) lo que le has contado («no me quedan blindajes») llega al otro y allí también manda en el motor
//  (d) los pasos marcados como hechos
//  (e) gana lo más reciente; lo de otra liga no se mezcla; sin red se sigue igual y se sube al volver
//  (f) las miniaturas de las capturas no viajan
//  (g) los dos cambian a la vez sin ver lo del otro: se junta (lo dicho, las preguntas y lo quitado)
// Uso: node .github/ia/caso-sinc.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sincObjeto } from '../../worker/src/sinc.js';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = http.createServer(async (q, r) => {
  const ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const b = await readFile(join(WEB, ruta.endsWith('/') ? `${ruta}index.html` : ruta)); r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
let mal = 0;
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) mal++; };

// el objeto de la cuenta, en memoria (los dos navegadores son la misma cuenta)
const m = new Map();
const st = { get: async (k) => m.get(k), put: async (k, v) => m.set(k, v), delete: async (k) => m.delete(k), deleteAll: async () => m.clear(), list: async ({ prefix }) => new Map([...m].filter(([k]) => k.startsWith(prefix))) };
let sinRed = false, llamadas = 0;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
async function navegador() {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.pathname !== '/sinc') return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
    if (sinRed) return r.abort('internetdisconnected');
    llamadas++;
    const j = await sincObjeto(st, { op: 'sinc', ...JSON.parse(q.postData() || '{}'), ahora: Date.now() });
    return r.fulfill({ status: j.ok ? 200 : 400, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(`if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)}); }`);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
  // fuera de la liga de ejemplo (la misma cuenta y la misma liga en los dos) y la sincronización, en marcha para esa liga
  await page.evaluate(async () => {
    localStorage.setItem('fm-demo', 'false');
    // (26 nov) la liga de K tiene que ser la de la sincronización (sinc.js no sincroniza si no lo es)
    { const U = await import('./js/util.js'); U.LS.set('cfg', { ...(U.LS.get('cfg', {}) || {}), ligaId: '4455' }); U.LS.set('liga-principal', '4455'); }
    const Sn = await import('./js/sinc.js');
    window.__llegadas = [];
    Sn.iniciarSinc({ liga: '4455', llega: (c) => window.__llegadas.push(...c), charlando: () => !!window.__charlando });
  });
  return { ctx, page, errores };
}
const A = await navegador(), B = await navegador();
const en = (P, f, x) => P.page.evaluate(f, x);
const sinc = (P) => en(P, async () => (await import('./js/sinc.js')).sincronizar({ ya: true }));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// (0.8.4) los cambios seguidos se suben juntos, SUBIR_TRAS después del último (antes, 1,2 s)
const TRAS = (await en(A, async () => (await import('./js/sinc.js')).SUBIR_TRAS)) + 800;
const estado = (P) => en(P, async () => {
  const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
  const p = I.ultimoPlan();
  return { plan: p ? p.titular : null, planT: p ? p.t : 0, chat: I.conversacion().map((x) => `${x.r}:${x.t}`), viejos: I.chatsAnteriores().length, notas: I.notasVigentes().map((n) => n.corr || n.texto), hechos: JSON.stringify(U.LS.get(Dt.K('hechos'), {})) };
});
try {
  /* (a) el plan: el móvil (A) hace el suyo; la web (B) lo recibe y ya no le toca pedir otro */
  await en(A, async () => {
    const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
    const P = { t: Date.now() - 5000, dia: U.diaDe(), titular: 'Plan hecho en el móvil', situacion: 'Todo en orden.', operaciones: [], modelo: 'app', mercado: null };
    U.LS.set(Dt.K('planes'), [P]);
    I.cambioLocal('plan');
  });
  await espera(TRAS);
  let a = await estado(A), b0 = await estado(B);
  ok(llamadas >= 1 && m.has('s|4455|plan'), `(a) el plan del móvil se sube solo al hacerlo (${llamadas} llamada${llamadas === 1 ? '' : 's'})`);
  const lleg = await sinc(B);
  let b = await estado(B);
  ok(!b0.plan && lleg.includes('plan') && b.plan === 'Plan hecho en el móvil' && b.planT === a.planT, `(a) la web lo recibe al entrar: «${b.plan}»`);
  const pide = await en(B, async () => { const I = await import('./js/ia.js'); return { viejo: I.planViejo(window.S.M), avisada: window.__llegadas.includes('plan') }; });
  ok(!pide.viejo && pide.avisada, '(a) con el plan del móvil, a la web ya no le toca pedir el suyo (y la app se entera para pintarlo)');
  // un plan más nuevo hecho en la web vuelve al móvil
  await en(B, async () => {
    const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
    U.LS.set(Dt.K('planes'), [{ t: Date.now(), dia: U.diaDe(), titular: 'Plan rehecho en la web', situacion: '', operaciones: [], modelo: 'app' }, ...I.planes()]);
    I.cambioLocal('plan');
  });
  await espera(TRAS); await sinc(A);
  a = await estado(A);
  ok(a.plan === 'Plan rehecho en la web', `(a) y el que se rehace en la web llega al móvil: «${a.plan}»`);

  /* (b) la conversación */
  await en(A, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); I.borrarConversacion(); const t = Date.now(); U.LS.set(Dt.K('chat'), [{ r: 'yo', t: '¿Vendo a Rodri?', ts: t - 3000 }, { r: 'ia', t: 'Aguántalo.', ts: t - 2000 }]); U.LS.set(Dt.K('chat-t'), t - 2000); I.cambioLocal('chat'); });
  await espera(TRAS); await sinc(B);
  b = await estado(B);
  ok(b.chat.join('|') === 'yo:¿Vendo a Rodri?|ia:Aguántalo.', `(b) lo preguntado en el móvil sale en la web: ${b.chat.join(' | ')}`);
  // la web sigue la conversación; al móvil le llega entera
  await en(B, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); const t = Date.now(); U.LS.set(Dt.K('chat'), [...I.conversacion(), { r: 'yo', t: '¿Y a Baena?', ts: t - 500 }, { r: 'ia', t: 'A ese tampoco.', ts: t }]); U.LS.set(Dt.K('chat-t'), t); I.cambioLocal('chat'); });
  await espera(TRAS); await sinc(A);
  a = await estado(A);
  ok(a.chat.length === 4 && a.viejos === 0, `(b) y lo que se sigue en la web, en el móvil (${a.chat.length} mensajes, sin duplicar ni archivar)`);
  // con una pregunta en marcha en el móvil, lo que llega no toca la conversación
  await en(B, async () => { const I = await import('./js/ia.js'); I.nuevoChat(); });
  await espera(TRAS);
  await en(A, () => { window.__charlando = true; });
  const enMarcha = await sinc(A);
  a = await estado(A);
  ok(!enMarcha.includes('chat') && a.chat.length === 4, '(b) con una pregunta en marcha, la conversación no se toca');
  await en(A, () => { window.__charlando = false; });
  await sinc(A);
  a = await estado(A);
  ok(a.chat.length === 0 && a.viejos === 1, `(b) «Nuevo chat» en la web: en el móvil el de antes pasa a «Anteriores» (${a.viejos}) y se empieza de cero`);

  /* (c) lo que le has contado: llega y manda en el motor del otro */
  await en(A, async () => { const I = await import('./js/ia.js'); I.apuntarDicho('No me quedan blindajes', window.S.D, window.S.M, null); });
  await espera(TRAS); await sinc(B);
  const c = await en(B, async () => {
    const I = await import('./js/ia.js'), Mo = await import('./js/motor.js');
    const M = Mo.analizar(window.S.D, window.S.H, window.S.c, { notas: I.notasVigentes() });
    return { notas: I.notasVigentes().map((n) => n.corr), quedan: M.escudosMios.quedan, dicho: (M.dicho || []).map((n) => n.txt), avisada: window.__llegadas.includes('notas') };
  });
  ok(c.notas.join() === 'blindajes' && c.quedan === 0 && /No te quedan blindajes/.test(c.dicho.join()) && c.avisada, `(c) «no me quedan blindajes» dicho en el móvil llega a la web y allí también manda en el motor (quedan ${c.quedan}; «${c.dicho.join()}»)`);
  // quitarlo en la web lo quita en el móvil
  await en(B, async () => { const I = await import('./js/ia.js'); for (const n of I.notasVigentes()) I.borrarNota(n.id); });
  await espera(TRAS); await sinc(A);
  a = await estado(A);
  ok(a.notas.length === 0, '(c) y quitarlo en la web lo quita en el móvil');

  /* (d) los pasos hechos */
  await en(A, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); U.LS.set(Dt.K('hechos'), { [String(I.ultimoPlan().t)]: { t: Date.now(), n: [1, 3] } }); U.LS.set(Dt.K('hechos-t'), Date.now()); I.cambioLocal('hechos'); });
  await espera(TRAS); await sinc(B);
  b = await estado(B);
  ok(/"n":\[1,3\]/.test(b.hechos), '(d) los pasos marcados como hechos en el móvil salen marcados en la web');

  /* (e) lo más reciente gana; sin red se sigue igual y se sube al volver; otra liga, aparte */
  sinRed = true;
  await en(A, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); const t = Date.now(); U.LS.set(Dt.K('chat'), [{ r: 'yo', t: 'Sin red', ts: t }]); U.LS.set(Dt.K('chat-t'), t); I.cambioLocal('chat'); });
  await espera(TRAS);
  const sinR = await sinc(A);
  a = await estado(A);
  ok(Array.isArray(sinR) && a.chat.join() === 'yo:Sin red' && !A.errores.length, '(e) sin red no pasa nada: se queda lo de aquí');
  sinRed = false;
  await sinc(A); await sinc(B);
  b = await estado(B);
  ok(b.chat.join() === 'yo:Sin red', '(e) y al volver la red se sube y llega al otro');
  const otra = await en(B, async () => { const Sn = await import('./js/sinc.js'); const U = await import('./js/util.js'); U.LS.set('cfg', { ...U.LS.get('cfg', {}), ligaId: '9988' }); Sn.iniciarSinc({ liga: '9988' }); const r = await Sn.sincronizar({ ya: true }); U.LS.set('cfg', { ...U.LS.get('cfg', {}), ligaId: '4455' }); Sn.iniciarSinc({ liga: '4455' }); return r; });
  ok(otra.length === 0 && [...m.keys()].every((k) => k.startsWith('s|4455|')) && m.size >= 4, `(e) a otra liga de la misma cuenta no le llega nada de esta (${m.size} cosas guardadas, todas de su liga)`);

  /* (f) las miniaturas no viajan */
  await en(A, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); const t = Date.now(); U.LS.set(Dt.K('chat'), [{ r: 'yo', t: 'Mira esto', ts: t, fotos: [{ id: 'f1', mini: 'x'.repeat(5000) }] }]); U.LS.set(Dt.K('chat-t'), t); I.cambioLocal('chat'); });
  await espera(TRAS);
  const guardado = JSON.stringify(m.get('s|4455|chat'));
  ok(/"id":"f1"/.test(guardado) && guardado.length < 600, `(f) de una captura sube solo su referencia, no la imagen (${guardado.length} caracteres)`);
  /* (g) (repaso de la 0.8s, 22 nov) los dos cambian algo a la vez, sin haber visto lo del otro (el móvil abierto mientras
     se usa la web): antes ganaba entero el último en subir y lo del otro se perdía. Ahora se junta: lo dicho en los dos,
     las preguntas de los dos y, si en uno se quita algo mientras el otro añade, se quita en los dos y lo añadido se queda */
  await sinc(A); await sinc(B); await sinc(A);
  const viejos0 = [(await estado(A)).viejos, (await estado(B)).viejos];
  sinRed = true;
  const nombreA = await en(A, async () => { const I = await import('./js/ia.js'); const x = window.S.M.mias.filter((y) => y.j.pos > 1 && y.j.pos < 5)[0]; I.apuntarDicho(`A ${x.j.nombre} no lo vendo`, window.S.D, window.S.M, null); return x.j.nombre; });
  await en(B, async () => { const I = await import('./js/ia.js'); I.apuntarDicho('No me quedan blindajes', window.S.D, window.S.M, null); });
  const pregunta = (P, txt) => en(P, async (q) => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); const t = Date.now(); U.LS.set(Dt.K('chat'), [...I.conversacion(), { r: 'yo', t: q, ts: t }, { r: 'ia', t: `Sobre «${q}»: vale.`, ts: t + 1 }]); U.LS.set(Dt.K('chat-t'), t + 1); I.cambioLocal('chat'); }, txt);
  await pregunta(A, 'Pregunta del móvil'); await espera(20); await pregunta(B, 'Pregunta de la web');
  await espera(1500);
  sinRed = false;
  await sinc(A); await sinc(B); await sinc(A);
  a = await estado(A); b = await estado(B);
  const tiene = (x) => x.notas.includes('no-vender') && x.notas.includes('blindajes') && x.chat.includes('yo:Pregunta del móvil') && x.chat.includes('yo:Pregunta de la web');
  ok(tiene(a) && tiene(b) && a.chat.join('|') === b.chat.join('|') && a.viejos === viejos0[0] && b.viejos === viejos0[1], `(g) a la vez en los dos: lo dicho en los dos («${nombreA}» y blindajes) y las dos preguntas, en los dos y en el mismo orden (móvil: ${a.notas.join(', ')} · ${a.chat.join(' | ')} · ${a.viejos} anteriores; web: ${b.notas.join(', ')} · ${b.chat.join(' | ')} · ${b.viejos})`);
  // quitar en uno mientras el otro añade
  sinRed = true;
  await en(A, async () => { const I = await import('./js/ia.js'); for (const n of I.notasVigentes().filter((x) => x.corr === 'no-vender')) I.borrarNota(n.id); });
  await en(B, async () => { const I = await import('./js/ia.js'); const x = window.S.M.mias.filter((y) => y.j.pos > 1 && y.j.pos < 5)[1]; I.apuntarDicho(`Ya he pujado por ${x.j.nombre}`, window.S.D, window.S.M, null); I.apuntarDicho(`A ${x.j.nombre} no lo vendo`, window.S.D, window.S.M, null); });
  await espera(1500);
  sinRed = false;
  await sinc(B); await sinc(A); await sinc(B);
  a = await estado(A); b = await estado(B);
  const n1 = (x) => x.notas.filter((k) => k === 'no-vender').length;
  ok(n1(a) === 1 && n1(b) === 1 && a.notas.includes('blindajes') && b.notas.includes('blindajes') && a.notas.join() === b.notas.join(), `(g) lo quitado en el móvil no vuelve y lo nuevo de la web se queda, en los dos (móvil: ${a.notas.join(', ')}; web: ${b.notas.join(', ')})`);
  /* (h) (0.8.4) menos llamadas: eran 33 por persona y día. Una subida es UNA llamada (antes dos: mirar y subir), varios
     cambios seguidos van en una, y con la IA contestando no se llama hasta que acaba */
  await sinc(A); await sinc(B);
  let antesH = llamadas;
  await en(A, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); U.LS.set(Dt.K('hechos'), { x: { p1: Date.now() } }); U.LS.set(Dt.K('hechos-t'), Date.now()); I.cambioLocal('hechos'); });
  await espera(TRAS);
  ok(llamadas - antesH === 1, `(h) un cambio, una llamada (${llamadas - antesH}; antes, 2)`);
  antesH = llamadas;
  for (let i = 0; i < 3; i++) { await en(A, async (n) => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); U.LS.set(Dt.K('hechos'), { x: { [`p${n}`]: Date.now() } }); U.LS.set(Dt.K('hechos-t'), Date.now()); I.cambioLocal('hechos'); }, i + 2); await espera(400); }
  await espera(TRAS);
  ok(llamadas - antesH === 1, `(h) tres pasos marcados seguidos, una llamada (${llamadas - antesH}; antes, 6)`);
  antesH = llamadas;
  await en(A, async () => { window.__charlando = true; const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); const t = Date.now(); U.LS.set(Dt.K('chat'), [...I.conversacion(), { r: 'yo', t: '¿Y el portero?', ts: t }]); U.LS.set(Dt.K('chat-t'), t); I.cambioLocal('chat'); });
  await espera(TRAS);
  const durante = llamadas - antesH;
  await en(A, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); const t = Date.now(); U.LS.set(Dt.K('chat'), [...I.conversacion(), { r: 'ia', t: 'Ese, titular.', ts: t }]); U.LS.set(Dt.K('chat-t'), t); window.__charlando = false; I.cambioLocal('chat'); });
  await espera(TRAS);
  ok(durante === 0 && llamadas - antesH === 1 && JSON.stringify(m.get('s|4455|chat')).includes('Ese, titular.'), `(h) una pregunta: nada mientras la IA contesta y una llamada al acabar (${durante} y ${llamadas - antesH}; antes, 4)`);
  // con la app en segundo plano, lo pendiente se sube ya
  antesH = llamadas;
  await en(A, async () => { const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'); U.LS.set(Dt.K('hechos'), { x: { p9: Date.now() } }); U.LS.set(Dt.K('hechos-t'), Date.now()); I.cambioLocal('hechos'); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await espera(600);
  ok(llamadas - antesH === 1, `(h) al irse a segundo plano con una subida pendiente, se sube ya (${llamadas - antesH})`);
  await en(A, async () => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  /* (i) (26 nov, aviso «No son mis jugadores» de un usuario con dos ligas) al cambiar de liga, K apunta ya a la nueva pero
     la sincronización seguía con la vieja hasta acabar de cargar: subía lo de la nueva a la vieja y ponía en la nueva el plan,
     la conversación y las notas de la vieja. Con una subida pendiente en la 4455 se cambia a la 9988 (sin parar la
     sincronización, como un cambio que llega a medias, y parándola, como hace cambiarDeLiga) */
  for (const parar of [false, true]) {
    await sinc(A);
    const antesI = llamadas;
    const r = await en(A, async (pararla) => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js'), Sn = await import('./js/sinc.js');
      const t = Date.now();
      U.LS.set(Dt.K('chat'), [...I.conversacion(), { r: 'yo', t: 'De la 4455', ts: t }]); U.LS.set(Dt.K('chat-t'), t); I.cambioLocal('chat');
      if (pararla) Sn.pararSinc();
      U.LS.set('cfg', { ...U.LS.get('cfg', {}), ligaId: '9988' });
      const enOtra = Dt.K('chat');
      const llega = await Sn.sincronizar({ ya: true });
      await new Promise((ok) => setTimeout(ok, Sn.SUBIR_TRAS + 800));
      const r = { enOtra, llega, chatOtra: JSON.stringify(U.LS.get(enOtra, null)), planesOtra: JSON.stringify(U.LS.get(Dt.K('planes'), null)) };
      // de vuelta a la 4455 y en marcha otra vez para ella
      U.LS.set('cfg', { ...U.LS.get('cfg', {}), ligaId: '4455' }); Sn.iniciarSinc({ liga: '4455' });
      return r;
    }, parar);
    const servidor = JSON.stringify(m.get('s|4455|chat') || '');
    ok(r.enOtra === 'chat-l9988' && !r.llega.length && llamadas === antesI && r.chatOtra === 'null' && r.planesOtra === 'null' && [...m.keys()].every((k) => k.startsWith('s|4455|')),
      `(i) ${parar ? 'parando la sincronización' : 'sin pararla'}, al cambiar de liga no se llama ni se pone nada de la otra liga en la nueva (${llamadas - antesI} llamadas, chat de la nueva: ${r.chatOtra.slice(0, 40)}, plan: ${r.planesOtra.slice(0, 40)})`);
    await sinc(A);
    ok(JSON.stringify(m.get('s|4455|chat') || '').includes('De la 4455') || servidor.includes('De la 4455'), '(i) y lo pendiente de la 4455 se sube al volver a ella');
  }
  // la pregunta que se recoge después, solo en su liga
  const pp = await en(A, async () => {
    const I = await import('./js/ia.js'), U = await import('./js/util.js');
    U.LS.set('preg-rid', { rid: 'abcdefgh1234', t: 'hola', ts: Date.now(), dia: U.diaDe(), liga: '4455' });
    const aqui = !!I.preguntaPendiente();
    U.LS.set('cfg', { ...U.LS.get('cfg', {}), ligaId: '9988' });
    const otraL = !!I.preguntaPendiente();
    U.LS.set('cfg', { ...U.LS.get('cfg', {}), ligaId: '4455' }); U.LS.del('preg-rid');
    return { aqui, otraL };
  });
  ok(pp.aqui && !pp.otraL, `(i) la pregunta que se recoge después, solo en la liga en la que se hizo (en la suya: ${pp.aqui}; en la otra: ${pp.otraL})`);
  ok(!A.errores.length && !B.errores.length, `sin errores en las páginas${A.errores.length || B.errores.length ? `: ${[...A.errores, ...B.errores][0]}` : ''}`);
} finally {
  await A.ctx.close(); await B.ctx.close(); await nav.close(); srv.close();
}
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
