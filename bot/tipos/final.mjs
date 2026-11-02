// Resumen al acabar cada partido: marcador, los que más y menos han puntuado y, si hay, una racha.
import { cierre, quepa, corto } from '../lib/texto.mjs';
import { rachaDe } from '../lib/laliga.mjs';

export async function generar({ stats, jornada, jugadores }) {
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  for (const m of stats.filter((x) => x.matchState === 7)) {
    const filas = [];
    for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
      if (p.weekPoints == null) continue;
      filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: corto(lado.mainName), pts: Number(p.weekPoints) });
    }
    if (filas.length < 10) continue;
    const ord = [...filas].sort((a, b) => b.pts - a.pts);
    const top = ord.slice(0, 3), peor = ord[ord.length - 1].pts < 0 ? ord[ord.length - 1] : null;
    const cab = `🏁 LaLiga Fantasy J${jornada} · ${corto(m.local.mainName)} ${m.localScore}-${m.visitorScore} ${corto(m.visitor.mainName)}`;
    const pie = cierre(`final${m.id}`);
    const lineas = [`Más puntos: ${top.map((f) => `${f.nombre} ${f.pts}`).join(', ')}`];
    const num = [jornada, m.localScore, m.visitorScore, ...top.map((f) => f.pts)];
    if (peor) { lineas.push(`Menos: ${peor.nombre} (${peor.equipo}) ${peor.pts}`); num.push(peor.pts); }
    // racha del mejor: tres jornadas seguidas de 8 o más (dato, no opinión)
    const j = porId.get(String(top[0].id));
    const r = j ? rachaDe(j, 3) : [];
    if (r.length === 3 && r.every(([, p]) => p >= 8)) {
      lineas.push(`${top[0].nombre} encadena 3 jornadas con 8 o más: ${r.map(([, p]) => p).join(', ')}`);
      num.push(3, 8, ...r.map(([, p]) => p));
    }
    const usadas = quepa(cab, lineas, pie);
    if (usadas.length < 2) continue;
    out.push({ tipo: 'final', clave: `final|${m.id}`, jornada, texto: [cab, ...usadas, pie].join('\n'), numeros: num });
  }
  return out;
}
