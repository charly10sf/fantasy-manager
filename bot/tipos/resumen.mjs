// Mejores y peores de la jornada, con los puntos oficiales de LaLiga Fantasy (weekPoints de stats/week/{n}).
import { cierre, quepa, armar, corto, elegir } from '../lib/texto.mjs';

const MEDALLA = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];

export async function generar({ stats, jornada }) {
  const acabados = stats.filter((m) => m.matchState === 7);
  if (!acabados.length) return [];
  const filas = [];
  for (const m of acabados) for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
    if (p.weekPoints == null) continue;
    filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: corto(lado.mainName), pts: Number(p.weekPoints) });
  }
  if (filas.length < 10) return [];
  const prov = acabados.length < stats.length ? ` (¡aún faltan ${stats.length - acabados.length}!)` : '';
  const out = [];
  for (const clave of ['mejores', 'peores']) {
    // los 0 pueden ser jugadores que no han jugado: en «peores» solo cuentan los negativos
    const base = clave === 'peores' ? filas.filter((f) => f.pts < 0) : filas;
    const ord = [...base].sort(clave === 'mejores' ? (a, b) => b.pts - a.pts : (a, b) => a.pts - b.pts).slice(0, 6);
    if (ord.length < 3) continue;
    const cab = clave === 'mejores'
      ? elegir([`🏆 LaLiga Fantasy J${jornada} · Estos son los que la han petado${prov}`, `🔥 LaLiga Fantasy J${jornada} · El top de la jornada${prov}`, `🏆 LaLiga Fantasy J${jornada} · Los reyes de la jornada${prov}`], `cab${jornada}`)
      : elegir([`📉 LaLiga Fantasy J${jornada} · Los números rojos de la jornada${prov}`, `😬 LaLiga Fantasy J${jornada} · Los que más sufrieron${prov}`], `cab${jornada}`);
    const pie = cierre(`${clave}${jornada}`);
    const lineas = ord.map((f, i) => `${MEDALLA[i]} ${f.nombre} (${f.equipo}) · ${f.pts} pts`);
    const num = [jornada, acabados.length, stats.length, stats.length - acabados.length, ...ord.map((f) => f.pts)];
    // el comentario: si un equipo pone a 3 o más de los 6, lo decimos
    const porEquipo = {};
    for (const f of ord) porEquipo[f.equipo] = (porEquipo[f.equipo] || 0) + 1;
    const [eq, n] = Object.entries(porEquipo).sort((a, b) => b[1] - a[1])[0];
    const coment = n >= 3
      ? (clave === 'mejores' ? `💥 ${n} de los ${ord.length} son del ${eq}: así se gana un partido.` : `⚠️ ${n} de los ${ord.length} son del ${eq}: tarde para olvidar.`)
      : null;
    if (coment) num.push(n, ord.length);
    // primero las filas que caben; el comentario va al final si hay sitio
    const usadas = quepa(cab, coment ? [...lineas, coment] : lineas, pie);
    const conComent = coment && usadas.includes(coment);
    const filasUsadas = usadas.filter((l) => l !== coment);
    if (filasUsadas.length < 3) continue;
    // si el comentario no cabe con todas las filas, se prefiere el comentario a la última fila
    let cuerpo = filasUsadas;
    if (coment && !conComent) {
      const sinUltima = quepa(cab, [...lineas.slice(0, filasUsadas.length - 1), coment], pie);
      if (sinUltima.includes(coment) && sinUltima.length - 1 >= 3) cuerpo = sinUltima;
    }
    out.push({ tipo: 'resumen', clave: `resumen|${jornada}|${clave}|${acabados.length}`, jornada, texto: armar(cab, cuerpo, pie), numeros: num });
  }
  return out;
}
