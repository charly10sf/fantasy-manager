// Avisos por Telegram para Carlos: el texto de respuesta para el tuit de resultado de cada club (las respuestas las pone él a mano,
// el bot de X nunca responde) y un aviso si falla una ejecución del workflow. Sin los secretos TELEGRAM_BOT_TOKEN y
// TELEGRAM_CHAT_ID no hace nada.
//   node bot/telegram.mjs [--simulacro=1] [--ventanas=1] [--jornada=11] [--estado=estado/telegram.json] [--datos=fichero.json]
//   node bot/telegram.mjs --aviso=fallo [--estado=estado/telegram.json]
// --simulacro=1 enseña los mensajes sin mandarlos ni apuntarlos. --datos= (solo para pruebas) usa { semana, stats } de un fichero
// en vez de la API de LaLiga. BOT_MODO=parado también lo para.
import { readFileSync, appendFileSync } from 'node:fs';
import { semanaActual, statsSemana, ficha as pedirFicha } from './lib/laliga.mjs';
import { crearDazn } from './lib/dazn.mjs';
import { validar } from './lib/validar.mjs';
import { Registro, diaMadrid } from './lib/registro.mjs';
import { telegramDelEntorno, enviar, esc } from './lib/telegram.mjs';
import { generar, mensaje } from './tipos/respuestas.mjs';

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const tg = config.telegram || {};
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const simulacro = arg('simulacro') === '1';
const fichero = simulacro ? null : (arg('estado') || 'estado/telegram.json');
const resumenMd = process.env.GITHUB_STEP_SUMMARY;
const md = (s) => { if (resumenMd) appendFileSync(resumenMd, s + '\n'); };
const t0 = Date.now();

if ((process.env.BOT_MODO || '').trim() === 'parado') { console.log('# Telegram parado (BOT_MODO=parado): no hago nada.'); process.exit(0); }
const { token, chatId, faltan } = telegramDelEntorno();
if (faltan.length && !simulacro) { console.log(`# Telegram: faltan los secretos ${faltan.join(', ')}: no hago nada.`); process.exit(0); }

// Config propia del registro de Telegram: sus topes no se mezclan con los de X
const registro = new Registro({ topes: tg.topes || { respuestas: 10 }, topeDiario: tg.topeDiario ?? 20, maxPorEjecucion: tg.maxPorEjecucion ?? 5 }, fichero);

// ---- Aviso de fallo ----
if (arg('aviso') === 'fallo') {
  const id = process.env.GITHUB_RUN_ID;
  const url = id ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${id}` : null;
  const hoy = registro.hoy();
  const yaHoy = registro.datos.enviados.filter((e) => e.tipo === 'aviso' && diaMadrid(e.t) === hoy).length;
  const tope = tg.avisosDia ?? 3;
  if (yaHoy >= tope) { console.log(`# Aviso de fallo: ya van ${yaHoy} hoy (tope ${tope}), no mando otro.`); process.exit(0); }
  const texto = `⚠️ Ha fallado una ejecución del bot de LaLiga Fantasy (Bot X).${url ? `\n${esc(url)}` : ''}`;
  if (simulacro) { console.log(`# Aviso de fallo (simulacro, no se manda):\n${texto}`); process.exit(0); }
  const r = await enviar(texto, { token, chatId });
  if (!r.ok) { console.log(`# Aviso de fallo: Telegram respondió HTTP ${r.estado} ${r.cuerpo}`); process.exit(0); }
  registro.marcar({ clave: `aviso|${id || Date.now()}`, tipo: 'aviso', jornada: 0 }, r.id);
  console.log(`# Aviso de fallo mandado (mensaje ${r.id})`);
  process.exit(0);
}

// ---- Respuestas para los clubes ----
const ventanas = arg('ventanas') === '1';
console.log(`# Telegram · respuestas para los clubes${simulacro ? ' · simulacro' : ''}${ventanas ? ' · con ventanas de tiempo' : ''}`);
md(`### Telegram · respuestas para los clubes${simulacro ? ' (simulacro)' : ''}`);

let jornada, stats;
if (arg('datos')) {
  const d = JSON.parse(readFileSync(arg('datos'), 'utf8'));
  jornada = Number(arg('jornada')) || d.semana; stats = d.stats;
} else {
  const sem = await semanaActual();
  jornada = Number(arg('jornada')) || sem.weekNumber;
  stats = await statsSemana(jornada);
}
const desdeFinal = ventanas ? Date.now() - (config.ventanaFinalHoras ?? 10) * 3600e3 : 0;
// los puntos DAZN llegan después del final: un partido sin ellos no se trata como acabado todavía (lib/dazn.mjs)
if (!arg('datos')) {
  const pf = config.puntosFinales || {};
  const dazn = crearDazn({ ficha: pedirFicha, jornada, esperaHoras: pf.esperaHoras ?? config.daznEsperaHoras ?? 6, minTrasFinal: pf.minTrasFinal ?? 20, log: (s) => console.log(s) });
  stats = await Promise.all(stats.map(async (m) => (m.matchState === 7 && Date.parse(m.date) >= desdeFinal && !(await dazn(m)).listo ? { ...m, matchState: 6 } : m)));
}
const items = generar({ stats, jornada, config, desdeFinal, log: (s) => console.log(s) });
console.log(`# Jornada ${jornada} · ${stats.length} partidos, ${stats.filter((m) => m.matchState === 7).length} acabados · ${items.length} con respuestas listas`);

let mandados = 0, previstos = 0, fallos = 0;
for (const it of items) {
  // cada respuesta pasa por el validador de siempre; las que no valen no salen
  const buenas = [];
  for (const r of it.respuestas) {
    const v = validar(r.texto, { numeros: [...r.numeros, jornada], max: config.tweetMax });
    if (v.ok) buenas.push(r); else { fallos++; console.log(`--- ${it.clave} · ${r.club} · NO PASA EL VALIDADOR: ${v.errores.join('; ')}\n${r.texto}`); }
  }
  if (!buenas.length) continue;
  const d = registro.decidir(it);
  if (d !== 'ok') { console.log(`--- ${it.clave} · omitido: ${d}`); continue; }
  const texto = mensaje({ ...it, respuestas: buenas });
  if (simulacro) {
    registro.reservar(it); previstos++;
    console.log(`--- ${it.clave} · LO MANDARÍA\n${texto}`);
    md(`<details><summary>Lo mandaría · ${it.clave}</summary>\n\n\`\`\`\n${texto}\n\`\`\`\n</details>`);
    continue;
  }
  const r = await enviar(texto, { token, chatId });
  if (!r.ok) {
    fallos++;
    console.log(`--- ${it.clave} · ERROR al mandar: HTTP ${r.estado} ${r.cuerpo}`);
    md(`**Error al mandar** ${it.clave}: HTTP ${r.estado} ${r.cuerpo}. Paro esta ejecución; no se apunta, así que se reintenta en la siguiente.`);
    break;
  }
  registro.marcar(it, r.id); mandados++;
  console.log(`--- ${it.clave} · MANDADO (mensaje ${r.id})\n${texto}`);
  md(`<details><summary>Mandado · ${it.clave}</summary>\n\n\`\`\`\n${texto}\n\`\`\`\n</details>`);
}
console.log(`\n# Total: ${simulacro ? previstos + ' los mandaría' : mandados + ' mandados'}, ${fallos} fallos · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
md(`**${simulacro ? previstos + '** los mandaría' : mandados + '** mandados'} · ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
