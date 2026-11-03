// Prueba con datos reales del once probable en el bot (en una rama de pruebas, desde Actions): por equipo, cuántos titulares
// lee y casa, y para cada partido de la jornada que viene el posible once con y sin el once probable. Además, caídas en modo
// publicar (solo dudas con segunda fuente).  node bot/prueba/once-real.mjs
import { readFileSync } from 'node:fs';
import { semanaActual, jugadores as pedirJugadores, statsSemana, equiposDe } from '../lib/laliga.mjs';
import { onceProbable } from '../lib/ff.mjs';
import { probabilidades, elegirOnce } from '../lib/onces.mjs';
import { generar as caidas } from '../tipos/caidas.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const sem = await semanaActual();
const prox = sem.nextWeek || sem.weekNumber + 1;
const [stats, jugadores] = await Promise.all([statsSemana(prox), pedirJugadores()]);
const equipos = equiposDe(await statsSemana(sem.weekNumber));
let fallos = 0;
console.log(`# Jornada ${prox}: ${stats.length} partidos`);
for (const m of stats) for (const lado of [m.local, m.visitor]) {
  const o = await onceProbable(lado.mainName, jugadores.filter((j) => String(j.teamId) === String(lado.id)), { log: console.log });
  if (!o) { fallos++; console.log(`FALLA ${lado.mainName}: sin once probable`); continue; }
  const t = Object.values(o).filter((x) => x.titular), sinP = t.filter((x) => x.prob == null).length;
  const nom = (id) => (jugadores.find((j) => String(j.id) === String(id)) || {}).nickname;
  console.log(`${lado.mainName}: ${Object.keys(o).length} casados, ${t.length} titulares (${sinP} sin %): ${Object.entries(o).filter(([, x]) => x.titular).map(([id, x]) => `${nom(id)} ${x.prob ?? '?'}${x.estado !== 'ok' ? ' ' + x.estado : ''}`).join(', ')}`);
}
const fmt = (once) => once.once.map((x) => `${x.nombre} ${Math.round(x.p * 100)}`).join(', ');
for (const m of stats.slice(0, 10)) {
  for (const lado of [m.local, m.visitor]) {
    const sin = elegirOnce(await probabilidades(lado.id, jugadores, prox - 1, { conOnce: false }));
    const con = elegirOnce(await probabilidades(lado.id, jugadores, prox - 1, { equipo: lado.mainName }));
    console.log(`\n## ${lado.mainName}\n  sin: ${sin && sin.formacion} · ${sin && fmt(sin)}\n  con: ${con && con.formacion} · ${con && fmt(con)}`);
    if (con && con.once.some((x) => x.p < 0.45)) console.log(`  ojo: en el once con menos del 45 %: ${con.once.filter((x) => x.p < 0.45).map((x) => x.nombre).join(', ')}`);
  }
}
const c = await caidas({ jugadores, equipos, jornada: prox, ultimaJugada: prox - 1, config, stats, semana: sem, soloSeguras: true, registro: null, log: console.log });
console.log(`\n# Caídas publicando: ${c.length} tweets`);
for (const t of c) console.log(`--- ${t.clave}\n${t.texto}`);
console.log(`\n# ${fallos} fallos`);
