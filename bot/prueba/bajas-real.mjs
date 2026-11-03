// Prueba con datos reales (solo en la rama pruebas-tweets-humanos): caídas tal cual y novedades con cambios de estado simulados
// sobre jugadores reales, más las tarjetas. Imprime los textos y deja los PNG en salida-tarjetas/.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { semanaActual, jugadores as pedirJugadores, statsSemana, equiposDe } from '../lib/laliga.mjs';
import { generar as novedades } from '../tipos/novedades.mjs';
import { generar as caidas } from '../tipos/caidas.mjs';
import { validar } from '../lib/validar.mjs';
import { Registro } from '../lib/registro.mjs';
import { tarjetasDe } from '../lib/con-tarjetas.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const sem = await semanaActual();
const jornada = sem.weekNumber;
const [stats, jugadores] = await Promise.all([statsSemana(jornada), pedirJugadores()]);
const equipos = equiposDe(stats);
const objetivo = stats.every((m) => m.matchState === 7) ? sem.nextWeek : stats.every((m) => m.matchState === 1) ? jornada : sem.nextWeek;
const ctx = { stats, jugadores, equipos, jornada, config, semana: sem, ventanas: false, forzar: true, ahora: Date.now(), soloSeguras: true, log: () => {} };
let fallos = 0, n = 0;
mkdirSync('salida-tarjetas', { recursive: true });
async function ver(titulo, ts) {
  console.log(`\n=== ${titulo}: ${ts.length} tweets`);
  for (const t of ts) {
    const v = validar(t.texto, { numeros: t.numeros, max: config.tweetMax });
    if (!v.ok) fallos++;
    console.log(`--- ${t.clave} · peso ${v.peso} · ${v.ok ? 'válido' : 'FALLA ' + v.errores.join('; ')}\n${t.texto}`);
    try {
      for (const h of await tarjetasDe(t, { ...ctx, forzar: true })) {
        console.log(`   tarjeta ${h.nombre}: ${h.ok ? `válida · ${h.png.length} bytes` : 'NO pasa: ' + h.errores.join('; ')}`);
        if (h.ok) writeFileSync(`salida-tarjetas/${String(++n).padStart(2, '0')}-${h.nombre}.png`, h.png); else fallos++;
      }
    } catch (e) { console.log(`   tarjeta: ERROR ${e.message}`); fallos++; }
  }
}
const IMP = (j) => j.positionId >= 1 && j.positionId <= 4 && (Number(j.averagePoints) >= 4 || Number(j.marketValue) >= 10e6);
const imp = jugadores.filter(IMP).sort((a, b) => Number(b.averagePoints) - Number(a.averagePoints));
const lesionados = imp.filter((j) => j.playerStatus === 'injured');
const sanc = imp.filter((j) => j.playerStatus === 'suspended');
const sanos = imp.filter((j) => (j.playerStatus || 'ok') === 'ok');
const base = Object.fromEntries(jugadores.map((j) => [j.id, j.playerStatus || 'ok']));
const caso = async (titulo, cambios) => {
  const previos = { ...base, ...cambios };
  const reg = new Registro(config);
  const out = await novedades({ ...ctx, registro: reg, previos });
  await ver(titulo, out);
  return { reg, out };
};
// a) tres vuelven (sanos de 3 clubes distintos que «estaban» lesionados) y uno se lesiona
const tresClubes = []; for (const j of sanos) if (!tresClubes.some((x) => x.teamId === j.teamId)) { tresClubes.push(j); if (tresClubes.length === 3) break; }
const a = await caso('novedades: tres vuelven y uno se lesiona', { ...Object.fromEntries(tresClubes.map((j) => [j.id, 'injured'])), [lesionados[0].id]: 'ok' });
// b) uno solo
await caso('novedades: uno solo se lesiona', { [lesionados[1].id]: 'ok' });
// c) cuatro bajas nuevas de varios clubes (lesionados y un sancionado)
await caso('novedades: cuatro bajas', { ...Object.fromEntries(lesionados.slice(0, 3).map((j) => [j.id, 'ok'])), ...(sanc[0] ? { [sanc[0].id]: 'ok' } : {}) });
// d) dos del mismo club vuelven
const porClub = new Map(); for (const j of sanos) { const k = j.teamId; porClub.set(k, [...(porClub.get(k) || []), j]); }
const dos = [...porClub.values()].find((xs) => xs.length >= 2).slice(0, 2);
await caso('novedades: dos del mismo club vuelven', Object.fromEntries(dos.map((j) => [j.id, 'injured'])));
// e) caídas sin nada publicado y f) después de publicar el tweet de a): sin repetir al lesionado y esperando 75 min
const cctx = { ...ctx, jornada: objetivo, ultimaJugada: objetivo - 1 };
const c0 = await caidas({ ...cctx, registro: new Registro(config) });
await ver(`caídas de la jornada ${objetivo} (sin nada publicado)`, c0);
for (const t of a.out) a.reg.reservar(t);
const c1 = await caidas({ ...cctx, registro: a.reg });
await ver(`caídas después de a) (sin ${lesionados[0].nickname})`, c1);
if (c1.some((t) => t.texto.includes(lesionados[0].nickname))) { fallos++; console.log('FALLA: repite al de novedades'); }
for (const t of c1) console.log(`   decidir ${t.clave}: ${a.reg.decidir(t)}`);
console.log(`\n# ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
