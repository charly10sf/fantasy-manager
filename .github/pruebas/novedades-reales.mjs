// Prueba (3 nov): novedades con jugadores reales y un estado anterior inventado, para ver las tarjetas con caras y escudos de verdad.
import { mkdirSync, writeFileSync } from 'node:fs';
import { semanaActual, jugadores as pedir, statsSemana, equiposDe } from '../../bot/lib/laliga.mjs';
import { generar } from '../../bot/tipos/novedades.mjs';
import { tarjetasDe } from '../../bot/lib/con-tarjetas.mjs';
import { validar } from '../../bot/lib/validar.mjs';
const config = JSON.parse((await import('node:fs')).readFileSync('bot/config.json', 'utf8'));
const sem = await semanaActual();
const [stats, js] = await Promise.all([statsSemana(sem.weekNumber), pedir()]);
const equipos = equiposDe(stats);
const imp = (j) => j.positionId <= 4 && (Number(j.averagePoints) >= 4 || Number(j.marketValue) >= 10e6);
const les = js.filter((j) => imp(j) && j.playerStatus === 'injured').sort((a, b) => b.marketValue - a.marketValue);
const ok = js.filter((j) => imp(j) && (j.playerStatus || 'ok') === 'ok').sort((a, b) => b.marketValue - a.marketValue);
mkdirSync('tarjetas', { recursive: true });
// caso A: 1 lesionado y 1 que vuelve (un tweet por jugador); caso B: 6 cambios (lista)
for (const [nombre, cambiados, vuelven] of [['A', les.slice(0, 1), ok.slice(0, 1)], ['B', les.slice(1, 5), ok.slice(1, 3)]]) {
  const previos = {};
  for (const j of js) previos[j.id] = j.playerStatus || 'ok';
  for (const j of cambiados) previos[j.id] = 'ok';
  for (const j of vuelven) previos[j.id] = 'injured';
  const out = await generar({ jugadores: js, equipos, jornada: sem.weekNumber, stats, semana: sem, config, previos, ventanas: false, log: console.log });
  for (const t of out) {
    const v = validar(t.texto, { numeros: t.numeros, max: config.tweetMax });
    console.log(`\n--- ${nombre} ${t.clave} · ${v.ok ? 'válido' : v.errores}\n${t.texto}`);
    for (const h of await tarjetasDe(t, { stats, jugadores: js, jornada: sem.weekNumber, config })) {
      console.log(`   tarjeta ${h.nombre}: ${h.ok ? 'válida' : h.errores.join('; ')}`);
      if (h.ok) writeFileSync(`tarjetas/${h.nombre}.png`, h.png);
    }
  }
}
