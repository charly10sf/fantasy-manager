// El bot de la cuenta de X. Por defecto NO publica: genera los tweets con datos reales, los valida y dice cuáles publicaría.
// Publica solo con --modo=publicar (en el workflow, la variable de repositorio BOT_MODO) y con las cuatro claves de X.
//   node bot/ejecutar.mjs [--modo=simulacro|publicar|parado] [--tipos=resumen,final,caidas,directo] [--jornada=11]
//        [--estado=estado/registro.json] [--ventanas=1] [--forzar=1] [--comprobar=1]
import { readFileSync, appendFileSync } from 'node:fs';
import { semanaActual, jugadores as pedirJugadores, statsSemana, equiposDe } from './lib/laliga.mjs';
import { validar } from './lib/validar.mjs';
import { Registro } from './lib/registro.mjs';
import { publicar, comprobar, clavesDelEntorno } from './lib/x.mjs';

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

const quienes = (arg('tipos') || (publica ? 'resumen,final,caidas' : 'resumen,final,caidas,directo')).split(',');
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

const ctx = { stats, jugadores, equipos, jornada, config, ahora: Date.now(), soloSeguras: publica, forzar,
  completo: !ventanas || pendientes === 0,
  desdeFinal: ventanas ? Date.now() - config.ventanaFinalHoras * 3600e3 : 0,
  fechasEspn: ['20261030', '20261031', '20261101'] };
const registro = new Registro(config, publica ? (arg('estado') || 'estado/registro.json') : null);
let generados = 0, fallos = 0, publicados = 0, previstos = 0;

for (const q of quienes) {
  const mod = await import(`./tipos/${q}.mjs`);
  let c = ctx;
  if (q === 'caidas') {
    if (objetivoCaidas == null) { console.log(`\n## caidas: espero (quedan ${pendientes} partido(s) de la jornada ${jornada})`); continue; }
    c = { ...ctx, jornada: objetivoCaidas, ultimaJugada: objetivoCaidas - 1 };
  }
  let tweets = [];
  try { tweets = await mod.generar(c); } catch (e) { console.log(`\n## ${q}: ERROR ${e.stack || e}`); fallos++; continue; }
  console.log(`\n## ${q}: ${tweets.length} tweets`);
  for (const t of tweets) {
    generados++;
    const v = validar(t.texto, { numeros: t.numeros, max: config.tweetMax });
    let d = v.ok ? registro.decidir(t) : 'no pasa el validador';
    if (!v.ok) fallos++;
    let estado = d === 'ok' ? (publica ? 'PUBLICAR' : 'PUBLICARÍA') : `omitido: ${d}`;
    if (d === 'ok' && publica) {
      const r = await publicar(t.texto, claves);
      if (r.ok) { registro.marcar(t, r.id); publicados++; estado = `PUBLICADO (id ${r.id})`; }
      else { estado = `ERROR al publicar: HTTP ${r.estado} ${r.cuerpo}`; fallos++; console.log(`\n--- ${t.clave} · ${estado}\n${t.texto}`); md(`**Error al publicar** ${t.clave}: HTTP ${r.estado} ${r.cuerpo}`); break; }
    } else if (d === 'ok') { registro.reservar(t); previstos++; }
    console.log(`\n--- ${t.clave} · peso ${v.peso} · ${v.ok ? 'válido' : 'FALLA: ' + v.errores.join('; ')} · ${estado}${t.casado === false ? ' · jugador sin casar con LaLiga' : ''}`);
    console.log(t.texto);
    md(`<details><summary>${estado} · ${t.clave} · peso ${v.peso}</summary>\n\n\`\`\`\n${t.texto}\n\`\`\`\n</details>`);
  }
}
console.log(`\n# Total: ${generados} generados, ${publica ? publicados + ' publicados' : previstos + ' los publicaría'}, ${fallos} fallos · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
md(`**${generados}** generados · ${publica ? `**${publicados}** publicados` : `**${previstos}** los publicaría`} · ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
