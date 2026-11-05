// El bot de la cuenta de X. Por defecto NO publica: genera los tweets con datos reales, los valida y dice cuáles publicaría.
// Publica solo con --modo=publicar (en el workflow, la variable de repositorio BOT_MODO) y con las cuatro claves de X.
//   node bot/ejecutar.mjs [--modo=simulacro|publicar|parado] [--tipos=directo,resumen,final,mvp,caidas,mercado,liga,previa,novedades,noticias,sancionados,lloros] [--jornada=11] [--fechas-espn=20261101,…]
//        [--estado=estado/registro.json] [--ventanas=1] [--forzar=1] [--comprobar=1]
//        [--tarjetas=1] (solo en simulacro: dibuja las tarjetas aunque estén apagadas) [--salida-tarjetas=tarjetas]
// Tarjetas con imagen: config.json → tarjetas.final y tarjetas.jugador (apagadas por defecto). Detalle en lib/con-tarjetas.mjs.
import { horaMadrid as horaHoy, horas, silencio } from './lib/horario.mjs';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { semanaActual, jugadores as pedirJugadores, statsSemana, equiposDe, ficha as pedirFicha } from './lib/laliga.mjs';
import { crearDazn } from './lib/dazn.mjs';
import { validar } from './lib/validar.mjs';
import { pulir } from './lib/pulir.mjs';
import { Registro } from './lib/registro.mjs';
import { publicar, subirImagen, comprobar, clavesDelEntorno } from './lib/x.mjs';
import { fijarLimite, limite, largo } from './lib/texto.mjs';
import { decidirLargo, rechazoPorLargo } from './lib/largo.mjs';
import { apuntarDecision, tocaPendiente } from './lib/aire.mjs';
import { crearInfo } from './lib/info-jugador.mjs';

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

// (liga antes que previa: una decisión sobre la jornada la ve la previa en la misma ejecución, no 5 min después)
const quienes = (arg('tipos') || 'directo,resumen,final,mvp,caidas,mercado,liga,previa,novedades,noticias,sancionados,lloros').split(',');
// las tarjetas: encendidas en config.json, o forzadas con --tarjetas=1 en simulacro (para verlas sin tocar lo que se publica)
const forzarTarjetas = !publica && arg('tarjetas') === '1';
const conTarjetas = forzarTarjetas || !!(config.tarjetas && (config.tarjetas.final || config.tarjetas.jugador));
const dirTarjetas = arg('salida-tarjetas') || 'tarjetas';
const sem = await semanaActual();
const jornada = Number(arg('jornada')) || sem.weekNumber;
const [stats, jugadores] = await Promise.all([statsSemana(jornada), pedirJugadores()]);
const equipos = equiposDe(stats);
const pendientes = stats.filter((m) => m.matchState !== 7).length;
console.log(`# Semana ${sem.weekNumber} (isLive=${sem.isLive}) · siguiente ${sem.nextWeek} · ${stats.length} partidos, ${stats.length - pendientes} acabados · ${jugadores.length} jugadores`);

// Caídas: se escriben cuando acaba la jornada (la siguiente) o antes de que empiece la actual; nunca con partidos a medias.
let objetivoCaidas = null;
if (pendientes === 0) objetivoCaidas = sem.nextWeek;
else if (stats.every((m) => m.matchState === 1)) objetivoCaidas = jornada;
if (objetivoCaidas == null && forzar) objetivoCaidas = sem.nextWeek;

// los puntos DAZN llegan después del final: final, MVP y resumen esperan a que estén (lib/dazn.mjs)
const dazn = crearDazn({ ficha: pedirFicha, jornada, esperaHoras: config.daznEsperaHoras ?? 6, log: (s) => console.log(s) });
// solo mercado (lo lanza el Worker cada minuto de 00:13 a 00:30): espera dentro de la misma ejecución a que llegue el valor de hoy,
// como mucho 7 min (el trabajo tiene un tope de 10); si no llega, sigue la siguiente ejecución
const esperarHasta = ventanas && quienes.length === 1 && quienes[0] === 'mercado' ? Date.now() + 7 * 60e3 : 0;
const ctx = { esperarHasta, stats, jugadores, equipos, jornada, config, dazn, ventanas, semana: sem, probarAcabados: arg('previa-acabados') === '1', ahora: Date.now(), soloSeguras: publica, forzar, forzarTarjetas,
  completo: !ventanas || pendientes === 0,
  desdeFinal: ventanas ? Date.now() - config.ventanaFinalHoras * 3600e3 : 0,
  // directo: con ventanas, el marcador de ESPN de hoy (y de ayer de madrugada) y solo partidos empezados hace menos de 3 h;
  // sin ventanas, los días que se pasen con --fechas-espn (para probar con partidos ya jugados)
  desdeDirecto: ventanas ? Date.now() - 3 * 3600e3 : 0,
  fechasEspn: arg('fechas-espn') ? arg('fechas-espn').split(',') : diasEspn() };
const registro = new Registro(config, publica ? (arg('estado') || 'estado/registro.json') : null);
ctx.registro = registro;
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
let generados = 0, fallos = 0, publicados = 0, previstos = 0;

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
    if (objetivoCaidas == null) { console.log(`\n## caidas: espero (quedan ${pendientes} partido(s) de la jornada ${jornada})`); continue; }
    if (!enHorarioCaidas) { console.log(`\n## caidas: fuera de horario (son las ${horaMadrid} h en Madrid; publico de ${hDesde} a ${hHasta} h)`); continue; }
    c = { ...ctx, jornada: objetivoCaidas, ultimaJugada: objetivoCaidas - 1 };
  }
  let tweets = [];
  try { tweets = await mod.generar(c); } catch (e) { console.log(`\n## ${q}: ERROR ${e.stack || e}`); fallos++; continue; }
  console.log(`\n## ${q}: ${tweets.length} tweets`);
  // Gemini pule el texto de los que van a salir en esta ejecución (lib/pulir.mjs); lo que no pasa la revisión sale con la plantilla
  const aPulir = tweets.filter((t) => validar(t.texto, { numeros: t.numeros, max: limite() }).ok && registro.decidir(t) === 'ok')
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
    if (!v.ok) fallos++;
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
      t.texto = t.sinTarjeta.texto; t.numeros = t.sinTarjeta.numeros; delete t.plantilla; delete t.pulido;
      v = validar(t.texto, { numeros: t.numeros, max: limite() });
      if (!v.ok) { d = 'no pasa el validador'; estado = `omitido: ${d}`; fallos++; }
      else if (!publica) estado += ' (sin tarjeta: con el texto de siempre)';
    }
    if (d === 'ok' && publica) {
      const r = await publicar(t.texto, claves, { mediaIds });
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
      if (r.ok) { registro.marcar(t, r.id); publicados++; estado = `PUBLICADO (id ${r.id})${mediaIds.length ? ` con ${mediaIds.length} imagen(es)` : ''}`; }
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
    } else if (d === 'ok') { registro.reservar(t); previstos++; }
    console.log(`\n--- ${t.clave} · peso ${v.peso} · ${v.ok ? 'válido' : 'FALLA: ' + v.errores.join('; ')} · ${estado}${t.casado === false ? ' · jugador sin casar con LaLiga' : ''}`);
    console.log(t.texto);
    if (t.plantilla) console.log(`   (pulido por ${t.pulido}; la plantilla decía:)\n${t.plantilla.replace(/^/gm, '   | ')}`);
    md(`<details><summary>${estado} · ${t.clave} · peso ${v.peso}${t.pulido ? ' · pulido' : ''}</summary>\n\n\`\`\`\n${t.texto}\n\`\`\`${t.plantilla ? `\n\nPlantilla:\n\`\`\`\n${t.plantilla}\n\`\`\`` : ''}\n</details>`);
  }
}
console.log(`\n# Total: ${generados} generados, ${publica ? publicados + ' publicados' : previstos + ' los publicaría'}, ${fallos} fallos · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
md(`**${generados}** generados · ${publica ? `**${publicados}** publicados` : `**${previstos}** los publicaría`} · ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
