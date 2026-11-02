// Mejores y peores de la jornada, con los puntos oficiales de LaLiga Fantasy (weekPoints de stats/week/{n}).
import { quepa, armar, corto, elegir } from '../lib/texto.mjs';

const MEDALLA = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];

export async function generar({ stats, jornada, completo = true, dazn = null }) {
  const acabados = stats.filter((m) => m.matchState === 7);
  if (!acabados.length) return [];
  // publicando, solo cuando la jornada ha acabado (nada de «provisional»)
  if (!completo && acabados.length < stats.length) return [];
  // con la jornada entera, todos sus partidos tienen que tener ya los puntos DAZN (si no, los de los últimos irían cortos)
  if (dazn && completo) for (const m of acabados) if (!(await dazn(m)).listo) return [];
  const filas = [];
  for (const m of acabados) for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
    if (p.weekPoints == null) continue;
    filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: corto(lado.mainName), club: lado.mainName, pts: Number(p.weekPoints),
      caraUrl: p.images && p.images.transparent && p.images.transparent['256x256'], escudoUrl: lado.badgeColor });
  }
  if (filas.length < 10) return [];
  const faltan = stats.length - acabados.length;
  const prov = faltan ? ' (provisional)' : '';
  const out = [];
  for (const clave of ['mejores', 'peores']) {
    // los 0 pueden ser jugadores que no han jugado: en «peores» solo cuentan los negativos
    const base = clave === 'peores' ? filas.filter((f) => f.pts < 0) : filas;
    const ord = [...base].sort(clave === 'mejores' ? (a, b) => b.pts - a.pts : (a, b) => a.pts - b.pts).slice(0, 6);
    if (ord.length < 3) continue;
    const cab = clave === 'mejores'
      ? elegir([`🏆 LaLiga Fantasy J${jornada} · Estos son los que la han petado${prov}`, `🔥 LaLiga Fantasy J${jornada} · El top de la jornada${prov}`, `🏆 LaLiga Fantasy J${jornada} · Los reyes de la jornada${prov}`], `cab${jornada}`)
      : elegir([`📉 LaLiga Fantasy J${jornada} · Los números rojos de la jornada${prov}`, `😬 LaLiga Fantasy J${jornada} · Los que más sufrieron${prov}`], `cab${jornada}`);
    const pie = null;   // sin cierre: la cabecera ya lleva «LaLiga Fantasy» (Carlos, 2 nov 23:11)
    const lineas = ord.map((f, i) => `${clave === 'peores' ? '🔻' : MEDALLA[i]} ${f.nombre} (${f.equipo}) · ${f.pts} pts`);
    const num = [jornada, acabados.length, stats.length, faltan, ...ord.map((f) => f.pts)];
    // el comentario: si un equipo pone a 3 o más de los que salen, lo decimos
    // (se prueba con todas las filas y se va quitando la última hasta que quepa con el comentario)
    let cuerpo = null, coment = null;
    for (let k = ord.length; k >= 3; k--) {
      const porEquipo = {};
      for (const f of ord.slice(0, k)) porEquipo[f.equipo] = (porEquipo[f.equipo] || 0) + 1;
      const [eq, n] = Object.entries(porEquipo).sort((a, b) => b[1] - a[1])[0];
      if (n < 3) break;
      coment = clave === 'mejores' ? (n === k ? `💥 Todos del ${eq}: así se gana un partido.` : `💥 ${n} de ${k} son del ${eq}: así se gana.`) : (n === k ? `⚠️ Todos del ${eq}: tarde para olvidar.` : `⚠️ ${n} de ${k} son del ${eq}: tarde para olvidar.`);
      const t = quepa(cab, [...lineas.slice(0, k), coment], pie);
      if (t.length === k + 1) { cuerpo = t; if (n < k) num.push(n, k); break; }
    }
    if (!cuerpo) { const t = quepa(cab, lineas, pie); if (t.length < 3) continue; cuerpo = t; }
    // la tarjeta con los 6 (Carlos, 2 nov 23:28: «algún grafismo chulo para los 6 mejores y peores»)
    const tarjeta = { tipo: 'resumen', nombre: `resumen-${jornada}-${clave}`, d: { jornada, clave, filas: ord },
      permitidos: { numeros: [jornada, 1, 2, 3, 4, 5, 6, ...ord.map((f) => f.pts)].map(String), palabras: ord.flatMap((f) => [f.nombre, f.equipo, f.club]) } };
    out.push({ tipo: 'resumen', clave: `resumen|${jornada}|${clave}|${acabados.length}`, jornada, texto: armar(cab, cuerpo, pie), numeros: [...num, 1], tarjeta });
  }
  return out;
}
