// Simulacro del bot de la cuenta de X: genera los tweets con datos reales, los valida y dice qué publicaría. NO publica nada
// y no usa ninguna clave. Uso: node bot/ejecutar.mjs [--tipos=resumen,final,caidas,directo] [--jornada=11]
import { readFileSync } from 'node:fs';
import { semanaActual, jugadores as pedirJugadores, statsSemana, equiposDe } from './lib/laliga.mjs';
import { validar } from './lib/validar.mjs';
import { Registro } from './lib/registro.mjs';
import { peso } from './lib/texto.mjs';

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const quienes = (arg('tipos') || 'resumen,final,caidas,directo').split(',');
const t0 = Date.now();

const sem = await semanaActual();
const jornada = Number(arg('jornada')) || sem.weekNumber;
console.log(`# Simulacro · semana ${sem.weekNumber} (isLive=${sem.isLive}) · siguiente ${sem.nextWeek}`);
const [stats, jugadores] = await Promise.all([statsSemana(jornada), pedirJugadores()]);
const equipos = equiposDe(stats);
console.log(`# ${stats.length} partidos (${stats.filter((m) => m.matchState === 7).length} acabados), ${jugadores.length} jugadores, ${Object.keys(equipos).length} equipos`);
{
  const todos = stats.flatMap((m) => [...m.local.players, ...m.visitor.players]);
  const nulos = todos.filter((p) => p.weekPoints == null).length, ceros = todos.filter((p) => p.weekPoints === 0).length, neg = todos.filter((p) => p.weekPoints < 0).length;
  console.log(`# weekPoints en la jornada ${jornada}: ${todos.length} jugadores, null=${nulos}, 0=${ceros}, negativos=${neg}`);
  console.log(`# equipos: ${Object.values(equipos).join(' | ')}`);
}

const ctx = { stats, jugadores, equipos, jornada, config, ultimaJugada: sem.weekNumber, forzar: arg('forzar') === '1',
  fechasEspn: ['20261030', '20261031', '20261101'] };
const registro = new Registro(config.topes);
let generados = 0, fallos = 0, publicables = 0;

for (const q of quienes) {
  const mod = await import(`./tipos/${q}.mjs`);
  const c = q === 'caidas' ? { ...ctx, jornada: sem.nextWeek } : ctx;
  let tweets = [];
  try { tweets = await mod.generar(c); } catch (e) { console.log(`\n## ${q}: ERROR ${e.stack || e}`); fallos++; continue; }
  console.log(`\n## ${q}: ${tweets.length} tweets`);
  for (const t of tweets) {
    generados++;
    const v = validar(t.texto, { numeros: t.numeros, max: config.tweetMax });
    const d = v.ok ? registro.decidir(t) : 'no pasa el validador';
    if (!v.ok) fallos++;
    if (d === 'ok') publicables++;
    console.log(`\n--- ${t.clave} · peso ${v.peso} · ${v.ok ? 'válido' : 'FALLA: ' + v.errores.join('; ')} · ${d === 'ok' ? 'PUBLICARÍA' : 'omitido: ' + d}${t.casado === false ? ' · jugador sin casar con LaLiga' : ''}`);
    console.log(t.texto);
  }
}
console.log(`\n# Total: ${generados} generados, ${publicables} los publicaría (con topes), ${fallos} fallos · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fallos ? 1 : 0);
