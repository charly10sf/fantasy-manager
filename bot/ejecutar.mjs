// El bot de la cuenta de X. Por defecto NO publica: genera los tweets con datos reales, los valida y dice cuáles publicaría.
// Publica solo con --modo=publicar (en el workflow, la variable de repositorio BOT_MODO) y con las cuatro claves de X.
//   node bot/ejecutar.mjs [--modo=simulacro|publicar|parado] [--tipos=directo,resumen,final,mvp,caidas,mercado,liga,previa,onceideal,novedades,noticias,sancionados,lloros,balance,revalorizaciones,calendario,selecciones,selecciones-dia] [--jornada=11] [--fechas-espn=20261101,…]
//        [--estado=estado/registro.json] [--ventanas=1] [--forzar=1] [--comprobar=1]
//        [--tarjetas=1] (solo en simulacro: dibuja las tarjetas aunque estén apagadas) [--salida-tarjetas=tarjetas]
//        [--fechas-selecciones=AAAAMMDD,…] (tipos/selecciones.mjs y selecciones-dia.mjs: los días de partidos de selecciones que miran,
//        para probar; en el diario, el último es «ayer»)
//        [--registro-nuevo=1] (publicando, empezar sin registro: solo si de verdad no existe la rama bot-estado; revisión total, C4)
// Tarjetas con imagen: config.json → tarjetas.final y tarjetas.jugador (apagadas por defecto). Detalle en lib/con-tarjetas.mjs.
import { horaMadrid as horaHoy, horas, silencio } from './lib/horario.mjs';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { semanaActual, jugadores as pedirJugadores, statsSemana, equiposDe, ficha as pedirFicha } from './lib/laliga.mjs';
import { crearDazn } from './lib/dazn.mjs';
import { validar } from './lib/validar.mjs';
import { pulir } from './lib/pulir.mjs';
import { redactar, apuntarReciente } from './lib/redaccion.mjs';
import { aplicaRedaccion, decidirRespaldo, olvidarFallos, porFallos } from './lib/respaldo.mjs';
import { crearCronicas } from './lib/cronicas.mjs';
import { Registro } from './lib/registro.mjs';
import { publicarSinRepetir, subirImagen, comprobar, clavesDelEntorno } from './lib/x.mjs';
import { fijarLimite, limite, largo, variarEquipos } from './lib/texto.mjs';
import { decidirLargo, rechazoPorLargo } from './lib/largo.mjs';
import { apuntarDecision, tocaPendiente } from './lib/aire.mjs';
import { esperaParon, paronActual } from './lib/paron.mjs';
import { crearInfo } from './lib/info-jugador.mjs';
import { fijarDatos } from './lib/datos-jugador.mjs';
import { cerrarSalud, encolarAviso, hora as horaAviso, FUENTE_PARTIDOS } from './lib/salud.mjs';

/** AAAAMMDD de hoy en Madrid (y de ayer, entre las 0 y las 3) */
function diasEspn() {
  const dia = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date()));
  return h < 3 ? [dia(Date.now() - 864e5), dia(Date.now())] : [dia(Date.now())];
}
const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const modo = (arg('modo') || process.env.BOT_MODO || 'simulacro').trim();
const ventanas = arg('ventanas') !== '0' && (arg('ventanas') === '1' || modo !== 'simulacro');
const forzar = arg('forzar') === '1';
const resumenMd = process.env.GITHUB_STEP_SUMMARY;
const md = (s) => { if (resumenMd) appendFileSync(resumenMd, s + '\n'); };
const t0 = Date.now();
console.log(`# Bot de X · modo ${modo}${ventanas ? ' · con ventanas de tiempo' : ''}${forzar ? ' · forzado' : ''}`);
md(`### Bot de X · modo **${modo}**`);

if (modo === 'parado') { console.log('# Parado (BOT_MODO=parado): no hago nada.'); md('Parado.'); process.exit(0); }
if (!['simulacro', 'publicar'].includes(modo)) { console.log(`# Modo desconocido «${modo}»: uso simulacro.`); }
const publica = modo === 'publicar';
const { claves, faltan } = clavesDelEntorno();

if (arg('comprobar') === '1') {
  if (faltan.length) { console.log(`# Faltan los secretos: ${faltan.join(', ')}`); md(`Faltan los secretos: ${faltan.join(', ')}`); process.exit(1); }
  const r = await comprobar(claves);
  console.log(`# Comprobación de claves: HTTP ${r.estado}${r.ok ? ` · cuenta @${r.usuario}` : ` · ${r.cuerpo}`}`);
  md(r.ok ? `Claves correctas: cuenta **@${r.usuario}**.` : `Las claves NO valen: HTTP ${r.estado} ${r.cuerpo}`);
  process.exit(r.ok ? 0 : 1);
}
if (publica && faltan.length) { console.log(`# Modo publicar sin los secretos ${faltan.join(', ')}: no publico nada.`); md(`Modo publicar sin los secretos ${faltan.join(', ')}.`); process.exit(1); }
const registro = new Registro(config, publica ? (arg('estado') || 'estado/registro.json') : null);
// publicando sin registro (no se ha podido traer, o está roto) el bot volvería a sacar goles, onces y noticias ya publicados, con los
// topes y el gasto a 0 (revisión total, C4): no arranca, salvo con --registro-nuevo=1 (la rama bot-estado de verdad no existe)
if (publica && (!registro.existe || registro.roto) && arg('registro-nuevo') !== '1') {
  const por = registro.roto ? `está roto (${registro.fichero})` : `no está (${registro.fichero})`;
  console.log(`# Modo publicar y el registro ${por}: no arranco para no republicar. Si de verdad empieza de cero, --registro-nuevo=1.`);
  md(`**No arranco**: el registro ${por}. Publicar sin él repetiría lo ya publicado. Si la rama bot-estado de verdad no existe, lanza el bot con «registro nuevo».`);
  process.exit(1);
}
if (publica && !registro.existe) console.log('# Registro nuevo (--registro-nuevo=1): empiezo de cero');

// (liga antes que previa: una decisión sobre la jornada la ve la previa en la misma ejecución, no 5 min después)
const quienes = (arg('tipos') || 'directo,resumen,final,mvp,caidas,mercado,liga,previa,onceideal,novedades,noticias,sancionados,lloros,balance,revalorizaciones,calendario,selecciones,selecciones-dia').split(',');
// las tarjetas: encendidas en config.json, o forzadas con --tarjetas=1 en simulacro (para verlas sin tocar lo que se publica)
const forzarTarjetas = !publica && arg('tarjetas') === '1';
const conTarjetas = forzarTarjetas || !!(config.tarjetas && (config.tarjetas.final || config.tarjetas.jugador));
const dirTarjetas = arg('salida-tarjetas') || 'tarjetas';
const sem = await semanaActual();
const jornada = Number(arg('jornada')) || sem.weekNumber;
const [stats, jugadores] = await Promise.all([statsSemana(jornada), pedirJugadores()]);
const equipos = equiposDe(stats);
const pendientes = stats.filter((m) => m.matchState !== 7).length;
// el parón de selecciones en el que estamos (lib/paron.mjs): los tuits del parón (balance, revalorizaciones, calendario y selecciones)
// solo salen entonces. La jornada recién jugada es esta si ya ha acabado o la anterior si esta aún no ha empezado (con el parón,
// LaLiga pasa enseguida a la semana siguiente)
let paron = null;
{
  const cp = config.paron || {};
  const empezada = stats.some((m) => m.matchState !== 1);
  const [jugada, ant, sig] = pendientes === 0 ? [jornada, stats, await statsSemana(jornada + 1).catch(() => [])]
    : !empezada ? [jornada - 1, await statsSemana(jornada - 1).catch(() => []), stats] : [null, null, null];
  if (jugada) paron = paronActual({ anterior: ant, siguiente: sig, jugada, dias: cp.dias ?? 9, horasAntes: cp.horasAntes ?? 72 });
  if (paron) Object.assign(paron, { statsAnterior: ant, statsSiguiente: sig });
  if (paron) console.log(`# Parón: ${paron.hueco.toFixed(1)} días entre la J${paron.jugada} y la J${paron.siguiente}${paron.activo ? ' (estamos en él)' : ''}`);
}
console.log(`# Semana ${sem.weekNumber} (isLive=${sem.isLive}) · siguiente ${sem.nextWeek} · ${stats.length} partidos, ${stats.length - pendientes} acabados · ${jugadores.length} jugadores`);

// Caídas: se escriben cuando acaba la jornada (la siguiente) o antes de que empiece la actual; nunca con partidos a medias.
let objetivoCaidas = null;
if (pendientes === 0) objetivoCaidas = sem.nextWeek;
else if (stats.every((m) => m.matchState === 1)) objetivoCaidas = jornada;
if (objetivoCaidas == null && forzar) objetivoCaidas = sem.nextWeek;
// tras un parón de selecciones, las caídas de la jornada que viene esperan a que falten `paron.horasAntes` (lib/paron.mjs; Domy y
// Carlos, 9 nov: el lunes del parón salió «Bajas y dudas para la jornada 13»). Con el parón LaLiga ya da la semana siguiente.
let paronCaidas = null;
if (objetivoCaidas != null && ventanas && !forzar) {
  const cp = config.paron || {};
  const [siguiente, anterior] = objetivoCaidas === jornada
    ? [stats, await statsSemana(jornada - 1).catch(() => [])]
    : [await statsSemana(objetivoCaidas).catch(() => []), stats];
  const p = esperaParon({ siguiente, anterior, dias: cp.dias ?? 9, horasAntes: cp.horasAntes ?? 72 });
  if (p.espera) { paronCaidas = p; objetivoCaidas = null; }
}

// la prensa de cada partido para los tuits redactados (lib/cronicas.mjs)
const cronicas = crearCronicas({ config, log: (s) => console.log(s) });
// solo mercado (lo lanza el Worker cada minuto de 00:13 a 00:30): espera dentro de la misma ejecución a que llegue el valor de hoy,
// como mucho 7 min (el trabajo tiene un tope de 10); si no llega, sigue la siguiente ejecución
const esperarHasta = ventanas && quienes.length === 1 && quienes[0] === 'mercado' ? Date.now() + 7 * 60e3 : 0;
const ctx = { esperarHasta, stats, jugadores, equipos, jornada, config, dazn: null, ventanas, semana: sem, probarAcabados: arg('previa-acabados') === '1', ahora: Date.now(), soloSeguras: publica, forzar, forzarTarjetas,
  completo: !ventanas || pendientes === 0,
  desdeFinal: ventanas ? Date.now() - config.ventanaFinalHoras * 3600e3 : 0,
  // directo: con ventanas, el marcador de ESPN de hoy (y de ayer de madrugada) y solo partidos empezados hace menos de 3 h;
  // sin ventanas, los días que se pasen con --fechas-espn (para probar con partidos ya jugados)
  desdeDirecto: ventanas ? Date.now() - 3 * 3600e3 : 0,
  fechasEspn: arg('fechas-espn') ? arg('fechas-espn').split(',') : diasEspn(),
  // los días de partidos de selecciones que mira tipos/selecciones.mjs (sin esto, los del parón hasta hoy): para probar con otro parón
  fechasSelecciones: arg('fechas-selecciones') ? arg('fechas-selecciones').split(',') : null };

// en simulacro, --estado=<copia> carga un registro para leerlo (los estados de antes, los pendientes, lo publicado) sin guardarlo nunca:
// así la prueba de la redacción (rama pruebas-redaccion) ve las mismas novedades que vio el bot de verdad
if (!publica && arg('estado')) {
  try { registro.datos = JSON.parse(readFileSync(arg('estado'), 'utf8')); registro.claves = new Set((registro.datos.enviados || []).map((e) => e.clave)); console.log(`# Registro de solo lectura: ${arg('estado')}`); }
  catch (e) { console.log(`# No pude leer el registro ${arg('estado')}: ${e.message}`); }
}
ctx.registro = registro;
ctx.paron = paron;
// los datos de cada jugador para los tuits (racha, mejor jornada, valor, goles…; lib/datos-jugador.mjs): hasta la última jornada
// acabada (con una a medias, la anterior), y los últimos tuits del registro para no repetir el tipo de dato (Carlos, 9 nov)
fijarDatos({ jugadores, equipos, hasta: pendientes === 0 ? jornada : jornada - 1, registro });
// los puntos de un partido acabado no son definitivos hasta un buen rato después: final, MVP, resumen y el directo de un partido
// acabado esperan (lib/dazn.mjs: tiempo desde el final, puntos sin cambiar entre ejecuciones, DAZN y portería a cero)
const pf = config.puntosFinales || {};
ctx.dazn = crearDazn({ ficha: pedirFicha, jornada, registro, esperaHoras: pf.esperaHoras ?? config.daznEsperaHoras ?? 6,
  minTrasFinal: pf.minTrasFinal ?? 20, minEstable: pf.minEstable ?? 10, log: (s) => console.log(s) });
// el % de titularidad y el rival para los tweets de un jugador (noticias y novedades; lib/info-jugador.mjs): se pide solo si hace falta
ctx.info = config.infoJugador === false ? null : crearInfo({ jugadores, equipos, semana: sem, log: (s) => console.log(s) });
// tweets largos con X Premium (lib/largo.mjs): el límite se fija antes de escribir nada
const dl = decidirLargo({ config, registro });
fijarLimite(dl.largo ? dl.max : config.tweetMax);
console.log(dl.largo ? `# Tweets largos (X Premium): hasta ${limite()}` : `# Tweets de ${limite()}: ${dl.motivo}`);
md(dl.largo ? `Tweets largos (X Premium), hasta ${limite()}.` : `Tweets de ${limite()}: ${dl.motivo}.`);
// Las caídas se publican de día (en Madrid): al acabar el último partido de la noche no salen de madrugada, sino a las 9
// (entre semana, desde las 7: lib/horario.mjs)
const horaMadrid = horaHoy();
const [hDesde, hHasta] = horas(config, 'horasCaidas', [0, 24]);
const enHorarioCaidas = !ventanas || forzar || (horaMadrid >= hDesde && horaMadrid < hHasta);
let abortar = false, subidaRota = false;   // si X rechaza una subida de imagen, no se intenta más en esta ejecución
// (rechazados: los que no pasan el validador; no son un fallo de la ejecución ni gastan los avisos de fallo de Telegram: M15)
let generados = 0, fallos = 0, publicados = 0, previstos = 0, rechazados = 0;

for (const q of quienes) {
  if (abortar) break;
  const mod = await import(`./tipos/${q}.mjs`);
  let c = ctx;
  // horas de silencio (Carlos, 3 nov 09:49: «publique a horas más activas, no a las 5 am»): de 1 a 8 h de Madrid no sale nada salvo
  // el directo (no hay partidos a esas horas) y el mercado (su propia ventana). Lo que toque se queda para las 8 (final y MVP aguantan
  // con ventanaFinalHoras = 13: un partido de las 21 h llega a las 10)
  // (entre semana, el silencio acaba a las 7: lib/horario.mjs)
  const [sD, sH] = silencio(config);
  if (ventanas && !forzar && !['directo', 'mercado'].includes(q) && horaMadrid >= sD && horaMadrid < sH) { console.log(`\n## ${q}: horas de silencio (son las ${horaMadrid} h en Madrid; vuelve a las ${sH} h)`); continue; }
  if (q === 'caidas') {
    if (paronCaidas) { console.log(`\n## caidas: parón (${Math.round(paronCaidas.hueco)} días entre jornadas): espero hasta el ${new Date(paronCaidas.desde).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`); continue; }
    if (objetivoCaidas == null) { console.log(`\n## caidas: espero (quedan ${pendientes} partido(s) de la jornada ${jornada})`); continue; }
    if (!enHorarioCaidas) { console.log(`\n## caidas: fuera de horario (son las ${horaMadrid} h en Madrid; publico de ${hDesde} a ${hHasta} h)`); continue; }
    c = { ...ctx, jornada: objetivoCaidas, ultimaJugada: objetivoCaidas - 1 };
  }
  let tweets = [];
  try { tweets = await mod.generar(c); } catch (e) { console.log(`\n## ${q}: ERROR ${e.stack || e}`); fallos++; continue; }
  console.log(`\n## ${q}: ${tweets.length} tweets`);
  // los equipos con otro nombre cada vez y con su emoji (Carlos, 6 nov 09:19: «el Madrid, los blancos…, menos robótico»); lo que ya
  // no cabe con ellos sale como estaba (lib/texto.mjs, variarEquipos). Los tweets del directo, tal cual: llevan prisa.
  if (q !== 'directo' && config.apodos !== false) for (const t of tweets) if (t && t.texto) t.texto = variarEquipos(t.texto, { semilla: String(t.clave || q) });
  // la IA redacta desde los hechos los que van a salir en esta ejecución (lib/redaccion.mjs; solo con Claude y `redactar.activo` o
  // BOT_REDACTAR=1); lo que no pasa su validador sale con la plantilla
  const vanASalir = (t) => validar(t.texto, { numeros: t.numeros, max: limite() }).ok && registro.decidir(t) === 'ok';
  const redacta = aplicaRedaccion(q, config, { forzar: arg('redactar') === '1' });
  const aRedactar = porFallos(tweets.filter((t) => t && t.hechos && vanASalir(t)), registro).slice(0, Math.max(0, (config.maxPorEjecucion ?? 4) - registro.enEstaEjecucion));
  if (aRedactar.length) {
    try { await redactar(aRedactar, { tipo: q, registro, config, jugadores, equipos, log: (s) => console.log(s), cronicasDe: cronicas.de, forzar: arg('redactar') === '1' }); }
    catch (e) { console.log(`  (redactar) ERROR ${e.message || e}: salen con la plantilla`); }
  }
  // la plantilla, solo como último recurso (lib/respaldo.mjs): un tuit de un tipo que se redacta y que no ha pasado la redacción no
  // sale en esta ejecución (no se marca en el registro) y se vuelve a probar en la siguiente; solo sale con la plantilla pulida tras
  // varias ejecuciones fallidas, si caduca o si no hay Claude
  const espera = new Map();
  if (redacta) {
    for (const t of tweets) {
      if (!t || !t.hechos || t.redactado || !vanASalir(t)) continue;
      const r = decidirRespaldo(t, { registro, config });
      console.log(`  (respaldo) ${t.clave}: ${r.motivo}`);
      if (!r.sale) espera.set(t, r.motivo);
    }
    if (registro.fichero) registro.guardar();
  }
  // Claude pule el texto de los que van a salir con la plantilla en esta ejecución (lib/pulir.mjs); lo que no pasa la revisión sale tal cual
  const aPulir = tweets.filter((t) => !espera.has(t) && !t.redactado && validar(t.texto, { numeros: t.numeros, max: limite() }).ok && registro.decidir(t) === 'ok')
    .slice(0, Math.max(0, (config.maxPorEjecucion ?? 4) - registro.enEstaEjecucion));
  if (aPulir.length) {
    try { await pulir(aPulir, { tipo: q, registro, config, jugadores, equipos, log: (s) => console.log(s), forzar: arg('pulir') === '1' }); }
    catch (e) { console.log(`  (pulir) ERROR ${e.message || e}: salen con la plantilla`); }
  }
  for (const t of tweets) {
    if (abortar) break;
    generados++;
    let v = validar(t.texto, { numeros: t.numeros, max: limite() });
    let d = v.ok ? registro.decidir(t) : 'no pasa el validador';
    if (!v.ok) rechazados++;
    if (d === 'ok' && espera.has(t)) d = espera.get(t);
    // tarjetas con imagen (solo si están encendidas): se dibujan y validan; las que no pasan no salen
    let pngs = [];
    if (d === 'ok' && conTarjetas && (t.partido != null || t.tarjeta)) {
      let hechas = [];
      try { hechas = await (await import('./lib/con-tarjetas.mjs')).tarjetasDe(t, { ...c, forzar: forzarTarjetas }); }
      catch (e) { console.log(`   tarjeta de ${t.clave}: ERROR ${e.message || e}`); md(`Tarjeta de ${t.clave}: error ${e.message || e}`); }
      for (const h of hechas) {
        console.log(`   tarjeta ${h.nombre}: ${h.ok ? `válida · ${h.png.length} bytes` : `NO pasa el validador: ${h.errores.join('; ')}`}`);
        if (h.ok) { mkdirSync(dirTarjetas, { recursive: true }); writeFileSync(`${dirTarjetas}/${h.nombre}.png`, h.png); pngs.push(h.png); }
        else md(`Tarjeta **${h.nombre}** no pasa el validador: ${h.errores.join('; ')}`);
      }
    }
    if (d === 'ok' && t.soloConImagen && !pngs.length) d = 'sin tarjeta válida (este tipo solo sale con imagen)';
    let estado = d === 'ok' ? (publica ? 'PUBLICAR' : 'PUBLICARÍA') : `omitido: ${d}`;
    if (d === 'ok' && !publica && pngs.length) estado += ` con ${pngs.length} imagen(es)`;
    // subir las imágenes a X; si falla, el tweet sale sin imagen (o no sale, si solo tiene sentido con ella)
    const mediaIds = [];
    if (d === 'ok' && publica && pngs.length && !subidaRota) {
      for (const png of pngs) {
        let s = null;
        try { s = await subirImagen(png, claves); } catch (e) { s = { ok: false, estado: 0, cuerpo: String(e.message || e) }; }
        if (s.ok) { mediaIds.push(s.id); continue; }
        console.log(`   subida de imagen: HTTP ${s.estado} ${s.cuerpo} (no lo intento más en esta ejecución)`); md(`Subida de imagen de ${t.clave}: HTTP ${s.estado} ${s.cuerpo}. No se intenta más en esta ejecución.`);
        mediaIds.length = 0; subidaRota = true; break;
      }
    }
    if (d === 'ok' && publica && pngs.length && !mediaIds.length && t.soloConImagen) { d = 'no se pudo subir la imagen'; estado = `omitido: ${d}`; }
    // sin imagen (la tarjeta no pasa el validador, están apagadas o no se ha subido), el tweet que dejaba la lista para la tarjeta sale
    // con el texto de siempre (`sinTarjeta`: los apercibidos, con todos los nombres en el texto)
    if (d === 'ok' && t.sinTarjeta && !(publica ? mediaIds.length : pngs.length)) {
      t.texto = t.sinTarjeta.texto; t.numeros = t.sinTarjeta.numeros; delete t.plantilla; delete t.pulido; delete t.redactado;
      v = validar(t.texto, { numeros: t.numeros, max: limite() });
      if (!v.ok) { d = 'no pasa el validador'; estado = `omitido: ${d}`; rechazados++; }
      else if (!publica) estado += ' (sin tarjeta: con el texto de siempre)';
    }
    if (d === 'ok' && publica) {
      // con el tiempo agotado o sin red no se sabe si X lo ha creado: se apunta como dudoso y no se repite (si se reintentara y sí
      // había salido, la IA lo redacta distinto y el «duplicate» de X no lo para; revisión total, A11). Se avisa a Telegram.
      const r = await publicarSinRepetir(t, { registro, claves, mediaIds, encolar: encolarAviso });
      if (r.dudoso) {
        estado = `DUDOSO: ${r.que}; lo apunto para no repetirlo y aviso`;
        fallos++; abortar = true; console.log(`\n--- ${t.clave} · ${estado}\n${t.texto}`); md(`**Tuit dudoso** ${t.clave}: ${r.que}. Apuntado para no repetirlo; aviso a Telegram. Paro esta ejecución.`);
        break;
      }
      // una suspensión o un aplazamiento confirmado: la fecha que tenía cada partido, para que la previa espere a la nueva (lib/aire.mjs)
      if (t.tipo === 'liga' && /\|confirmado\|/.test(t.clave) && (r.ok || (r.estado === 403 && /duplicate/i.test(r.cuerpo)))) {
        // la jornada de la decisión: la que dice la noticia (Gemini sabe cuál es esta y la siguiente). Si no la dice: la jornada entera,
        // esta si aún no ha empezado y si no la siguiente («la próxima jornada» el domingo de la J12 es la J13); un partido o un club,
        // esta mientras le quede un partido por jugar a los que toque, y si no la siguiente
        const entera = t.clave.split('|')[2] === 'j';
        const jA = Number(t.jornadaAire) || ((entera ? stats.every((x) => Number(x.matchState) === 1) : tocaPendiente(t.clave, stats)) ? jornada : jornada + 1);
        const n = apuntarDecision(registro, t.clave, jA === jornada ? stats : await statsSemana(jA).catch(() => []), jA);
        md(`Decisión ${t.clave}: apuntados ${n} partidos de la jornada ${jA}${n ? '' : ' (ninguno: la previa no esperará por esto)'}.`);
      }
      if (r.ok) { registro.marcar(t, r.id); olvidarFallos(registro, t.clave); apuntarReciente(registro, t.tipo, t.texto); registro.guardar(); publicados++; estado = `PUBLICADO (id ${r.id})${mediaIds.length ? ` con ${mediaIds.length} imagen(es)` : ''}`; }
      else if (r.estado === 403 && /duplicate/i.test(r.cuerpo)) { registro.marcar(t, null); estado = 'X dice que ya estaba publicado: lo apunto y sigo'; }
      else if (largo() && v.peso > 280 && rechazoPorLargo(r)) {
        // X no deja tweets largos (¿se ha acabado el Premium?): se apunta, se vuelve a 280 y este sale corto en la próxima ejecución
        registro.datos.largoRechazado = { t: new Date().toISOString(), estado: r.estado, cuerpo: String(r.cuerpo).slice(0, 200) };
        if (registro.fichero) registro.guardar();
        fijarLimite(config.tweetMax);
        estado = `X no deja tweets largos (HTTP ${r.estado} ${r.cuerpo}): vuelvo a ${limite()} y este sale en la próxima ejecución`;
        fallos++; abortar = true; console.log(`\n--- ${t.clave} · ${estado}\n${t.texto}`);
        md(`**X no deja tweets largos** (${t.clave}, HTTP ${r.estado} ${r.cuerpo}). ¿Se ha acabado el Premium? Vuelvo a ${limite()} y lo vuelvo a probar en ${config.largo?.reintentarHoras ?? 24} h. Paro esta ejecución.`);
        break;
      }
      else { estado = `ERROR al publicar: HTTP ${r.estado} ${r.cuerpo}`; fallos++; abortar = true; console.log(`\n--- ${t.clave} · ${estado}\n${t.texto}`); md(`**Error al publicar** ${t.clave}: HTTP ${r.estado} ${r.cuerpo}. Paro esta ejecución; no se vuelve a intentar hasta la siguiente.`); break; }
    } else if (d === 'ok') { registro.reservar(t); apuntarReciente(registro, t.tipo, t.texto); previstos++; }
    console.log(`\n--- ${t.clave} · peso ${v.peso} · ${v.ok ? 'válido' : 'FALLA: ' + v.errores.join('; ')} · ${estado}${t.casado === false ? ' · jugador sin casar con LaLiga' : ''}`);
    console.log(t.texto);
    if (arg('hechos') === '1' && t.hechos) console.log(`   (hechos) ${JSON.stringify(t.hechos)}`);
    if (t.plantilla) console.log(`   (${t.redactado ? `redactado por ${t.redactado}${t.prensa ? ` con prensa de ${t.prensa.join(', ')}` : ''}` : `pulido por ${t.pulido}`}${t.revisado ? `, revisado por ${t.revisado}` : ``}; la plantilla decía:)\n${t.plantilla.replace(/^/gm, '   | ')}`);
    md(`<details><summary>${estado} · ${t.clave} · peso ${v.peso}${t.redactado ? ' · redactado' : t.pulido ? ' · pulido' : ''}</summary>\n\n\`\`\`\n${t.texto}\n\`\`\`${t.plantilla ? `\n\nPlantilla:\n\`\`\`\n${t.plantilla}\n\`\`\`` : ''}\n</details>`);
  }
}
// la salud de cada fuente (lib/salud.mjs, M15): al registro, y los avisos a la cola de Telegram
{
  const textos = { [FUENTE_PARTIDOS]: (s) => `0 eventos de ESPN en día de partido desde hace ${s.seguidas} ejecuciones (desde las ${horaAviso(Date.parse(s.desde))}): LaLiga tiene partidos en juego` };
  const avisos = publica ? cerrarSalud(registro, { config, textos }) : (cerrarSalud(null), []);
  for (const a of avisos) { console.log(`# Aviso de salud: ${a}`); md(`Aviso de salud: ${a}`); }
  for (const [f, s] of Object.entries((registro.datos && registro.datos.salud) || {})) if (s.seguidas) console.log(`  (salud) ${f}: sin contestar ${s.seguidas} ejecuciones seguidas (${s.error || '?'})`);
}
// lo que lleva gastado hoy la IA (lib/ia.mjs): llamadas, tokens y dólares, en el log y en el registro
{ const ia = registro.datos && registro.datos.ia; if (ia && ia.dia) console.log(`  (ia) gasto de hoy: ${ia.llamadas.clasificar} para clasificar y ${ia.llamadas.redactar} para redactar (${ia.fallos} fallos), ${ia.entrada} tokens de entrada, ${ia.salida} de salida, ${ia.cacheLee} leídos de caché y ${ia.cacheEscribe} escritos, ${ia.dolares.toFixed(4)} $`); }
if (registro.fichero) registro.guardar();
console.log(`\n# Total: ${generados} generados, ${publica ? publicados + ' publicados' : previstos + ' los publicaría'}, ${rechazados} no pasan el validador, ${fallos} fallos · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
md(`**${generados}** generados · ${publica ? `**${publicados}** publicados` : `**${previstos}** los publicaría`} · ${rechazados} no pasan el validador · ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
