// Prueba sin red de la sesión 5 de la revisión total (robustez y gasto del bot) y del arreglo de Barrenetxea (8 nov):
//   C4  sin registro no se publica: ejecutar.mjs no arranca y bot.yml distingue «la rama no existe» (2) de un error (128);
//   C5  sin registro guardado (simulacro) no se redacta con IA, y bot.yml solo pasa la clave de Claude publicando;
//   A11 un tuit sin respuesta de X queda como dudoso y no se repite; un gol o una roja ya tuiteados que ESPN quita, o el mismo gol con
//       otro goleador, avisan a Telegram con el id del tuit y no se publica otro;
//   M15 la salud de cada fuente avisa a la 6.ª ejecución sin contestar (y al volver), «0 eventos en día de partido», y los avisos del
//       bot no gastan el tope de los avisos de fallo;
//   M16 la reserva de gasto se guarda antes de llamar a la IA y el tope no se pasa;
//   Barrenetxea: un partido ya empezado no es el «próximo», no se dice «hoy a las 16:15» de un partido jugado y el validador lo tira.
// Uso: node bot/prueba/robustez-ejemplo.mjs (sale con 1 si algo falla)
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESPN_PUERTO = 8795;
process.env.ESPN_BASE = `http://127.0.0.1:${ESPN_PUERTO}`;
process.env.BOT_FOTMOB = '0';
const { Registro } = await import('../lib/registro.mjs');
const { publicarSinRepetir } = await import('../lib/x.mjs');
const S = await import('../lib/salud.mjs');
const { redactar, revisar, deHoyMal } = await import('../lib/redaccion.mjs');
const { preguntar, cuentaHoy, estimarCoste, sinCupo } = await import('../lib/ia.mjs');
const { proximoPartido, cuando } = await import('../lib/redactar.mjs');
const D = await import('../tipos/directo.mjs');
const { generar: novedades } = await import('../tipos/novedades.mjs');
const { fijarLimite } = await import('../lib/texto.mjs');
const { get } = await import('../lib/http.mjs');

let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };
const tmp = mkdtempSync(join(tmpdir(), 'robustez-'));
const regDe = (datos = { enviados: [] }) => { const r = new Registro({ topes: { directo: 99, novedades: 9 } }, null); r.datos = datos; r.claves = new Set(datos.enviados.map((e) => e.clave)); return r; };

// ---------- C4: sin registro, publicando, no arranca ----------
const correr = (args, env = {}) => spawnSync(process.execPath, [join(RAIZ, 'bot/ejecutar.mjs'), ...args], { encoding: 'utf8', timeout: 30000,
  env: { ...process.env, X_API_KEY: 'a', X_API_SECRET: 'b', X_ACCESS_TOKEN: 'c', X_ACCESS_TOKEN_SECRET: 'd', GITHUB_STEP_SUMMARY: '', ...env } });
let p = correr(['--modo=publicar', `--estado=${join(tmp, 'no-esta.json')}`]);
ok(p.status === 1 && /no arranco para no republicar/.test(p.stdout), `publicando sin registro: sale con ${p.status} sin pedir nada`);
writeFileSync(join(tmp, 'roto.json'), '{"enviados": [');
p = correr(['--modo=publicar', `--estado=${join(tmp, 'roto.json')}`]);
ok(p.status === 1 && /está roto/.test(p.stdout), `publicando con el registro roto: sale con ${p.status}`);
// bot.yml: el paso «Traer el registro» con un git falso que contesta 0, 2 o 128 a ls-remote
const yml = readFileSync(join(RAIZ, '.github/workflows/bot.yml'), 'utf8');
const lineas = yml.split('\n');
const iTraer = lineas.findIndex((l) => /id: traer/.test(l));
const iRun = lineas.findIndex((l, i) => i > iTraer && /^\s+run: \|/.test(l));
const guion = [];
for (let i = iRun + 1; i < lineas.length && !/^ {6}- name:/.test(lineas[i]); i++) guion.push(lineas[i].replace(/^ {10}/, ''));
const bin = join(tmp, 'bin'); mkdirSync(bin);
writeFileSync(join(bin, 'git'), '#!/bin/sh\ncase "$1" in\n  ls-remote) exit "$FALSO_LS" ;;\n  clone) for x in "$@"; do d="$x"; done; mkdir -p "$d"; echo clonado > "$d/.clonado" ;;\n  *) exit 0 ;;\nesac\n');
chmodSync(join(bin, 'git'), 0o755);
for (const [codigo, espera] of [[0, 'clona'], [2, 'nueva'], [128, 'error']]) {
  const dir = mkdtempSync(join(tmp, `traer-${codigo}-`));
  const salida = join(dir, 'salida.txt'); writeFileSync(salida, '');
  const r = spawnSync('bash', ['-e', '-c', guion.join('\n')], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FALSO_LS: String(codigo), GH_TOKEN: 't', GITHUB_REPOSITORY: 'a/b', GITHUB_OUTPUT: salida } });
  const nuevo = /nuevo=1/.test(readFileSync(salida, 'utf8'));
  const res = r.status !== 0 ? 'error' : existsSync(join(dir, 'estado/.clonado')) ? 'clona' : nuevo ? 'nueva' : '?';
  ok(res === espera && (codigo !== 128 || !existsSync(join(dir, 'estado'))), `bot.yml, ls-remote sale con ${codigo}: ${res} (se esperaba ${espera})`);
}
ok(/ANTHROPIC_API_KEY: \$\{\{ vars\.BOT_MODO == 'publicar' && secrets\.ANTHROPIC_API_KEY \|\| '' \}\}/.test(yml), 'bot.yml: la clave de Claude solo publicando (C5)');
ok(/REGISTRO_NUEVO: \$\{\{ inputs\.registro_nuevo && steps\.traer\.outputs\.nuevo == '1'/.test(yml), 'bot.yml: --registro-nuevo solo si se pide y la rama de verdad no existe');

// ---------- C5: sin registro guardado, redactar no gasta IA ----------
process.env.ANTHROPIC_API_KEY = 'falsa';
const cfgIa = { ia: { proveedor: 'claude', topeDolaresDia: 2 }, redactar: { activo: true, tipos: ['noticias'] } };
let preguntas = 0;
const pedirIA = async () => { preguntas++; return { ok: false, error: 'no debería preguntar' }; };
for (let i = 0; i < 3; i++) {
  const t = { tipo: 'noticias', clave: `n|${i}`, texto: 'plantilla', numeros: [], hechos: { tipo: 'noticias', jugadores: [{ nombre: 'Pedri', principal: true }], clubes: {} } };
  await redactar([t], { tipo: 'noticias', registro: regDe(), config: cfgIa, jugadores: [], equipos: {}, log: () => {}, pedir: pedirIA });
  if (t.redaccion !== 'sin-ia') ok(false, `simulacro: ${t.redaccion}`);
}
ok(preguntas === 0, `simulacro, 3 ejecuciones: ${preguntas} preguntas a la IA`);

// ---------- M16: la reserva antes de llamar ----------
{
  const reg = { datos: {}, fichero: 'prueba.json', guardados: 0, guardar() { this.guardados++; } };
  let visto = null;
  const claudeF = async () => { visto = { dolares: cuentaHoy(reg).dolares, guardados: reg.guardados }; return { ok: true, datos: {}, modelo: 'm', uso: {}, dolares: 0.01 }; };
  const est = estimarCoste({ prompt: 'x'.repeat(3500), uso: 'redactar' });
  await preguntar({ uso: 'redactar', registro: reg, config: cfgIa, prompt: 'x'.repeat(3500), esquema: {}, claude: claudeF });
  ok(visto && Math.abs(visto.dolares - est) < 1e-9 && visto.guardados >= 1, `al llamar ya está reservado (${visto && visto.dolares} $) y guardado`);
  ok(Math.abs(cuentaHoy(reg).dolares - 0.01) < 1e-9 && !cuentaHoy(reg).reservado, `al contestar, lo de verdad (${cuentaHoy(reg).dolares} $)`);
  // si se corta a medias, se queda lo reservado
  await preguntar({ uso: 'redactar', registro: reg, config: cfgIa, prompt: 'x'.repeat(3500), esquema: {}, claude: async () => { throw new Error('cortado'); } });
  ok(Math.abs(cuentaHoy(reg).dolares - (0.01 + est)) < 1e-9, 'si la llamada se corta, queda lo reservado');
  // el tope no se pasa: con 1,995 $ y una pregunta de más de 5 milésimas, no se pregunta
  cuentaHoy(reg).dolares = 1.995;
  let llamado = false;
  await preguntar({ uso: 'redactar', registro: reg, config: cfgIa, prompt: 'x'.repeat(35000), esquema: {}, claude: async () => { llamado = true; return { ok: true, datos: {}, dolares: 0.02 }; } });
  ok(!llamado && /tope/.test(sinCupo('redactar', { registro: reg, config: cfgIa, estimado: 0.02 })), 'a 1,995 $ de 2 $, una pregunta de 0,02 $ ya no se hace');
}

// ---------- A11: X no contesta ----------
const colgado = http.createServer(() => {}).listen(0, '127.0.0.1');
await new Promise((r) => colgado.once('listening', r));
{
  const reg = regDe();
  const t = { tipo: 'directo', clave: 'directo|1|Raphinha|gol1', jornada: 12, texto: '⚽ Gol de Raphinha' };
  process.env.X_API_BASE = `http://127.0.0.1:${colgado.address().port}`;
  const r = await publicarSinRepetir(t, { registro: reg, claves: { apiKey: 'a', apiSecret: 'b', token: 'c', tokenSecret: 'd' }, encolar: S.encolarAviso, tiempo: 400 });
  ok(r.dudoso && reg.decidir(t) === 'duplicado' && reg.datos.enviados[0].dudoso, `X colgado: ${r.que}; apuntado como dudoso y no se repite`);
  ok((reg.datos.avisos || []).some((a) => a.clave === 'dudoso|directo|1|Raphinha|gol1' && /No sé si ha salido/.test(a.texto)), 'y aviso a Telegram');
  process.env.X_API_BASE = 'http://127.0.0.1:9';
  const t2 = { ...t, clave: 'directo|1|Raphinha|gol2' };
  const r2 = await publicarSinRepetir(t2, { registro: reg, claves: { apiKey: 'a', apiSecret: 'b', token: 'c', tokenSecret: 'd' }, encolar: S.encolarAviso });
  ok(r2.dudoso && /error de red/.test(r2.que) && reg.decidir(t2) === 'duplicado', `sin red: ${r2.que}`);
  delete process.env.X_API_BASE;
}
colgado.close();

// ---------- A11: lo publicado que ESPN quita o cambia ----------
{
  const huella = (jug, min, clase = 'gol', equipo = '10') => ({ clase, partido: '77', equipo, min, extra: 0, jugador: jug });
  const reg = regDe({ enviados: [
    { clave: 'directo|77|Ayoze|gol1', tipo: 'directo', jornada: 12, id: '111', t: new Date().toISOString(), huella: huella('Ayoze', 23) },
    { clave: 'directo|77|Gayá|roja', tipo: 'directo', jornada: 12, id: '222', t: new Date().toISOString(), huella: huella('Gayá', 60, 'roja', '20') },
    { clave: 'directo|77|Pepelu|gol1', tipo: 'directo', jornada: 12, id: '333', t: new Date().toISOString(), huella: huella('Pepelu', 70, 'gol', '20') },
  ] });
  const dsp = (jugador, min, equipo = '10') => ({ n: 1, clase: 'gol', jugador, equipo, min: `${min}'`, ref: { clock: { displayValue: `${min}'` } } });
  ok(!!D.mismoGolPublicado(reg, { partido: '77', equipo: '10', min: 23, extra: 0, clave: 'directo|77|Pino|gol1' }), 'el mismo gol (partido, equipo y minuto) con otro goleador se reconoce');
  ok(!D.mismoGolPublicado(reg, { partido: '77', equipo: '10', min: 24, extra: 0, clave: 'directo|77|Pino|gol1' }), 'otro minuto es otro gol');
  // ESPN: el del 23' ahora es de Pino; la roja de Gayá ya no está; el de Pepelu sigue
  const ahora = [dsp('Pino', 23), dsp('Pepelu', 70, '20')];
  const actuales = new Set(['directo|77|Pino|gol1', 'directo|77|Pepelu|gol1']);
  let av = D.vigilarPublicados(reg, { partidoId: '77', nombre: 'Villarreal-Valencia', actuales, dsps: ahora });
  ok(av.length === 0, 'la primera vez que falta, solo se apunta (por si ESPN da algo a medias)');
  av = D.vigilarPublicados(reg, { partidoId: '77', nombre: 'Villarreal-Valencia', actuales, dsps: ahora });
  ok(av.length === 2 && av.some((x) => /cambiado el goleador/.test(x) && /Ayoze/.test(x) && /Pino/.test(x) && /status\/111/.test(x)) && av.some((x) => /Roja ya tuiteada/.test(x) && /status\/222/.test(x)), `a la segunda, dos avisos con el id del tuit: ${av.map((x) => x.slice(0, 60)).join(' | ')}`);
  av = D.vigilarPublicados(reg, { partidoId: '77', nombre: 'Villarreal-Valencia', actuales, dsps: ahora });
  ok(av.length === 0, 'cada aviso, una vez');
  // el aviso de generar() y el de vigilar son el mismo (misma clave): sale uno
  S.encolarAviso(reg, 'mismoGol|directo|77|Ayoze|gol1|directo|77|Pino|gol1', 'x');
  ok(reg.datos.avisos.filter((a) => a.clave.startsWith('mismoGol|directo|77|Ayoze')).length === 1, 'el cambio de goleador, un solo aviso');
  // si vuelve a aparecer, se olvida
  const reg2 = regDe({ enviados: [{ clave: 'directo|78|X|roja', tipo: 'directo', jornada: 12, id: '9', t: new Date().toISOString() }] });
  D.vigilarPublicados(reg2, { partidoId: '78', nombre: 'A-B', actuales: new Set() });
  D.vigilarPublicados(reg2, { partidoId: '78', nombre: 'A-B', actuales: new Set(['directo|78|X|roja']) });
  av = D.vigilarPublicados(reg2, { partidoId: '78', nombre: 'A-B', actuales: new Set() });
  ok(av.length === 0, 'una roja que falta una vez y vuelve no avisa');
}
// el directo con ESPN falso: el gol de Ayoze ya publicado sale ahora como de Pino en el mismo minuto, y no se publica otra vez
{
  const espn = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    if (u.pathname === '/scoreboard') return r.end(JSON.stringify(espnHoy));
    return r.end(JSON.stringify({ keyEvents: [], commentary: [] }));
  }).listen(ESPN_PUERTO, '127.0.0.1');
  await new Promise((ok2) => espn.once('listening', ok2));
  const ahora = Date.parse('2026-11-08T19:00:00Z');
  const local = { id: 1, mainName: 'Villarreal', players: [] }, visitor = { id: 2, mainName: 'Valencia', players: [] };
  const stats = [{ id: 77, matchState: 4, date: '2026-11-08T18:00:00Z', local, visitor }];
  var espnHoy = { events: [{ id: 'e1', date: '2026-11-08T18:00:00Z', shortName: 'VIL v VAL', status: { displayClock: "40'", type: { state: 'in' } }, competitions: [{
    competitors: [{ homeAway: 'home', score: '1', team: { id: '10', displayName: 'Villarreal' } }, { homeAway: 'away', score: '0', team: { id: '20', displayName: 'Valencia' } }],
    details: [{ scoringPlay: true, clock: { displayValue: "23'" }, team: { id: '10' }, athletesInvolved: [{ displayName: 'Pino' }] }] }] }] };
  const reg = regDe({ enviados: [{ clave: 'directo|77|Ayoze|gol1', tipo: 'directo', jornada: 12, id: '111', t: new Date(ahora).toISOString(), huella: { clase: 'gol', partido: '77', equipo: '10', min: 23, extra: 0, jugador: 'Ayoze' } }] });
  S.olvidarEjecucion();
  let out = await D.generar({ stats, jornada: 12, fechasEspn: ['20261108'], jugadores: [], desdeDirecto: 0, ahora, registro: reg, config: { fotmob: false } });
  ok(!out.some((t) => /gol1$/.test(t.clave)) && (reg.datos.avisos || []).some((a) => /cambiado el goleador/.test(a.texto)), `ESPN cambia el goleador: ${out.length} tuits de gol y aviso a Telegram`);
  ok(S.deEstaEjecucion().get(S.FUENTE_PARTIDOS)?.ok === 1, 'ESPN da el partido que LaLiga tiene en juego: bien');
  // M15: ESPN contesta, pero sin partidos, con uno en juego en LaLiga
  espnHoy = { events: [] };
  S.olvidarEjecucion();
  out = await D.generar({ stats, jornada: 12, fechasEspn: ['20261108'], jugadores: [], desdeDirecto: 0, ahora, registro: reg, config: { fotmob: false } });
  ok(S.deEstaEjecucion().get(S.FUENTE_PARTIDOS)?.mal === 1, '0 eventos de ESPN con un partido en juego: se apunta como fallo');
  espn.close();
}

// ---------- M15: la salud de las fuentes ----------
{
  S.olvidarEjecucion();
  const reg = regDe();
  let avisos = [];
  for (let i = 0; i < 7; i++) { S.apuntarFuente('ESPN', false, 'HTTP 503'); S.apuntarFuente('prensa', true); avisos.push(...S.cerrarSalud(reg, { config: {} })); }
  ok(avisos.length === 1 && /ESPN no contesta desde hace 6 ejecuciones/.test(avisos[0]) && /HTTP 503/.test(avisos[0]), `ESPN 7 veces sin contestar: un aviso a la 6.ª («${avisos[0] || ''}»)`);
  S.apuntarFuente('ESPN', true);
  avisos = S.cerrarSalud(reg, { config: {} });
  ok(avisos.length === 1 && /vuelve a contestar/.test(avisos[0]) && reg.datos.salud.ESPN.seguidas === 0, 'y otro al volver');
  ok(S.fuenteDe('https://site.api.espn.com/apis/x') === 'ESPN' && S.fuenteDe('https://www.futbolfantasy.com/x') === 'futbolfantasy' && S.fuenteDe('https://api.x.com/2/tweets') === null, 'cada dirección con su fuente');
  S.olvidarEjecucion();
  await get('http://127.0.0.1:9/feed.xml', { reintentos: 0, tiempo: 1000 }).catch(() => null);
  ok(S.deEstaEjecucion().get('prensa')?.mal === 1, 'lib/http.mjs apunta lo que no contesta');
  const texto = readFileSync(join(RAIZ, 'bot/ejecutar.mjs'), 'utf8');
  ok(/if \(!v\.ok\) rechazados\+\+;/.test(texto) && !/if \(!v\.ok\) fallos\+\+;/.test(texto), 'un tuit que no pasa el validador no es un fallo de la ejecución');
}
// los avisos del bot por Telegram, con su tope y sin gastar el de los avisos de fallo
{
  const tg = spawn(process.execPath, [join(RAIZ, 'bot/prueba/telegram-falso.mjs')], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  const dir = mkdtempSync(join(tmp, 'tg-'));
  const hoy = new Date().toISOString();
  writeFileSync(join(dir, 'telegram.json'), JSON.stringify({ enviados: [1, 2, 3].map((i) => ({ clave: `aviso|${i}`, tipo: 'aviso', jornada: 0, t: hoy })) }));
  writeFileSync(join(dir, 'registro.json'), JSON.stringify({ enviados: [], avisos: [{ clave: 'quitado|a', texto: 'Gol <b>quitado</b> & roja', t: hoy }, { clave: 'salud|ESPN|x', texto: 'ESPN caído', t: hoy }] }));
  const env = { ...process.env, TELEGRAM_BOT_TOKEN: 'TOKENFALSO', TELEGRAM_CHAT_ID: '12345', TELEGRAM_API_BASE: 'http://127.0.0.1:8788', BOT_MODO: 'publicar', GITHUB_STEP_SUMMARY: '' };
  const args = [join(RAIZ, 'bot/telegram.mjs'), '--aviso=bot', `--estado=${join(dir, 'telegram.json')}`, `--registro=${join(dir, 'registro.json')}`];
  const a1 = spawnSync(process.execPath, args, { encoding: 'utf8', env, timeout: 20000 });
  const a2 = spawnSync(process.execPath, args, { encoding: 'utf8', env, timeout: 20000 });
  const recibidos = await (await fetch('http://127.0.0.1:8788/__mensajes')).json();
  tg.kill();
  ok(/2 mandados/.test(a1.stdout) && /0 mandados/.test(a2.stdout) && recibidos.length === 2 && recibidos[0].includes('&lt;b&gt;'), `avisos del bot: ${recibidos.length} mandados con 3 avisos de fallo ya hoy, ninguno repetido y escapados`);
}

// ---------- Barrenetxea (8 nov): el partido ya jugado ----------
{
  const real = { id: 16, mainName: 'Real Sociedad', badgeColor: '' }, rayo = { id: 14, mainName: 'Rayo Vallecano', badgeColor: '' }, getafe = { id: 9, mainName: 'Getafe', badgeColor: '' };
  const j12 = [{ id: 120, matchState: 4, date: '2026-11-08T15:15:00Z', local: real, visitor: rayo }];   // 16:15 en Madrid, sin cerrar en LaLiga
  const j13 = [{ id: 130, matchState: 1, date: '2026-11-15T17:30:00Z', local: getafe, visitor: real }];
  const ahora = Date.parse('2026-11-08T17:06:00Z');   // 18:06 en Madrid
  await proximoPartido(16, { stats: j13, jornada: 13 });   // (deja la J13 en la memoria de la ejecución, sin red)
  const pp = await proximoPartido(16, { stats: j12, semana: { weekNumber: 12, nextWeek: 13 }, jornada: 12, ahora });
  ok(pp && pp.jornada === 13 && pp.rival === 'Getafe' && pp.hoy && pp.hoy.rival === 'Rayo', `el próximo de la Real a las 18:06: J${pp && pp.jornada} contra ${pp && pp.rival}, y hoy ya jugó contra ${pp && pp.hoy && pp.hoy.rival}`);
  const antes = await proximoPartido(16, { stats: j12, semana: { weekNumber: 12, nextWeek: 13 }, jornada: 12, ahora: Date.parse('2026-11-08T14:00:00Z') });
  ok(antes && antes.jornada === 12 && !antes.hoy, 'a las 15:00, el de esta tarde sigue siendo el próximo');
  ok(cuando('2026-11-08T15:15:00Z', ahora) === null && /^hoy a las 21:00$/.test((cuando('2026-11-08T20:00:00Z', ahora) || {}).t || ''), 'cuando(): nada de «hoy a las 16:15» a las 18:06; sí «hoy a las 21:00»');
  // la novedad de Barrenetxea a las 18:06, con el próximo de verdad
  fijarLimite(1000);
  const jugadores = [{ id: 5, nickname: 'Barrenetxea', teamId: 16, playerStatus: 'injured', averagePoints: 6.2, marketValue: 30e6, positionId: 3 }];
  const out = await novedades({ jugadores, equipos: { 16: 'Real Sociedad' }, jornada: 12, stats: j12, semana: { weekNumber: 12, nextWeek: 13 }, previos: { 5: 'ok' }, ventanas: false, ahora, log: () => {},
    listaPartes: [], fichaDe: async () => null });
  const t = out[0];
  ok(t && !/16:15|esta tarde|hoy/i.test(t.texto) && /Getafe/.test(t.texto) && t.hechos.partido.jornada === 13 && /ya se ha jugado/.test(t.hechos.partido.yaJugoHoy || '') && !t.hechos.partido.cuando, `la novedad habla del Getafe (J13) y no de las 16:15: ${t ? t.texto.replace(/\n+/g, ' / ') : 'sin tuit'}`);
  fijarLimite(280);
  // el validador tira «hoy», «esta tarde» o «esta noche» de un partido ya empezado
  const hPasado = { partido: { fecha: '2026-11-08T15:15:00Z', rival: 'el Rayo' }, jugadores: [{ nombre: 'Barrenetxea', principal: true }], clubes: {} };
  ok(/ya ha empezado/.test(deHoyMal('Barrenetxea llega con dudas al partido de esta tarde.', hPasado, ahora) || ''), 'el validador tira «esta tarde» de un partido ya empezado');
  ok(revisar('Barrenetxea llega con dudas al partido de hoy.', { hechos: hPasado, ahora }).some((e) => /ya ha empezado/.test(e)), 'y revisar() lo da como error');
  ok(!deHoyMal('Barrenetxea llega con dudas al partido de hoy.', { partido: { fecha: '2026-11-08T20:00:00Z' } }, ahora), 'con el partido aún por jugar, «hoy» vale');
  ok(/ya ha jugado hoy/.test(deHoyMal('Llega con dudas al de esta noche.', { partido: { fecha: '2026-11-15T17:30:00Z', yaJugoHoy: 'contra el Rayo; …' } }, ahora) || ''), 'si su equipo ya jugó hoy, «esta noche» tampoco');
}

console.log(fallos ? `\n${fallos} MAL` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
