// Mejores y peores de la jornada, con los puntos oficiales de LaLiga Fantasy (weekPoints de stats/week/{n}).
import { cierre, quepa } from '../lib/texto.mjs';

export async function generar({ stats, jornada }) {
  const acabados = stats.filter((m) => m.matchState === 7);
  if (!acabados.length) return [];
  const filas = [];
  for (const m of acabados) for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
    if (p.weekPoints == null) continue;
    filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: lado.mainName, pts: Number(p.weekPoints) });
  }
  if (filas.length < 10) return [];
  const prov = acabados.length < stats.length ? ` (provisional: ${acabados.length} de ${stats.length} partidos)` : '';
  const out = [];
  for (const [clave, titulo, emoji, orden] of [['mejores', 'Los mejores', '🏆', (a, b) => b.pts - a.pts], ['peores', 'Los que peor lo han pasado', '📉', (a, b) => a.pts - b.pts]]) {
    const ord = [...filas].sort(orden).slice(0, 6);
    const cab = `${emoji} LaLiga Fantasy J${jornada} · ${titulo}${prov}`;
    const pie = cierre(`${clave}${jornada}`);
    const lineas = ord.map((f, i) => `${i + 1}. ${f.nombre} (${f.equipo}) ${f.pts} pts`);
    const usadas = quepa(cab, lineas, pie);
    if (usadas.length < 3) continue;
    const num = [jornada, acabados.length, stats.length, ...ord.slice(0, usadas.length).flatMap((f, i) => [i + 1, f.pts])];
    out.push({ tipo: 'resumen', clave: `resumen|${jornada}|${clave}|${acabados.length}`, jornada, texto: [cab, ...usadas, pie].join('\n'), numeros: num });
  }
  return out;
}
