// SOLO EN LA RAMA pruebas-mercado: genera el tuit de mercado de hoy con el registro real (copia) y lo redacta con la IA. No publica.
import { semanaActual, jugadores as pj, statsSemana, equiposDe } from '../lib/laliga.mjs';
import { generar } from '../tipos/mercado.mjs';
import { Registro } from '../lib/registro.mjs';
import { redactar } from '../lib/redaccion.mjs';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const sem = await semanaActual(); const jornada = sem.weekNumber;
const [stats, jugadores] = await Promise.all([statsSemana(jornada), pj()]);
const equipos = equiposDe(stats);
const registro = new Registro(config, '/tmp/registro.json');
const xs = await generar({ jugadores, equipos, stats, jornada, config, registro, ventanas: false, log: console.log });
console.log('HECHOS', JSON.stringify(xs[0].hechos, null, 1));
await redactar(xs, { tipo: 'mercado', registro, config, jugadores, equipos, log: console.log, forzar: true });
for (const t of xs) console.log(`\n===== ${t.redaccion || ''}\n${t.texto}\n=====`);
