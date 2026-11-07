// Prueba del directo con DATOS REALES (ESPN, FotMob y la API de LaLiga Fantasy), sin publicar nada:
//   node bot/prueba/directo-real.mjs [--fechas=20261107] [--partido=112] [--hechos=1] [--sin-fotmob=1] [--estado=registro.json]
// Genera los tuits de directo (plantilla y hechos para la IA) de los partidos de esos días y enseña el log de FotMob, golazos y contadores.
import { readFileSync } from 'node:fs';
import { semanaActual, statsSemana, jugadores as pedirJugadores } from '../lib/laliga.mjs';
import { Registro } from '../lib/registro.mjs';
import { generar } from '../tipos/directo.mjs';
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
if (arg('sin-fotmob') === '1') config.fotmob = false;
const sem = await semanaActual();
const jornada = Number(arg('jornada')) || sem.weekNumber;
const [stats, jugadores] = await Promise.all([statsSemana(jornada), pedirJugadores()]);
const registro = new Registro(config, null);
if (arg('estado')) { registro.datos = JSON.parse(readFileSync(arg('estado'), 'utf8')); registro.claves = new Set((registro.datos.enviados || []).map((e) => e.clave)); }
const fechasEspn = (arg('fechas') || '20261107').split(',');
const tweets = await generar({ stats, jornada, fechasEspn, jugadores, desdeDirecto: 0, ahora: Date.now(), dazn: null, config, registro });
const solo = arg('partido');
for (const t of tweets.filter((x) => !solo || String(x.partido) === solo)) {
  console.log(`\n--- ${t.clave} · ${t.minutoTxt}\n${t.texto}`);
  if (arg('hechos') === '1') console.log(JSON.stringify(t.hechos, null, 1));
}
console.log(`\n# ${tweets.length} tuits de directo`);
if (arg('registro-salida')) (await import('node:fs')).writeFileSync(arg('registro-salida'), JSON.stringify(registro.datos));
