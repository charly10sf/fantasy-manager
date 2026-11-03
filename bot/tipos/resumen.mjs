// Mejores y peores de la jornada, con los puntos oficiales de LaLiga Fantasy (weekPoints de stats/week/{n}). Los 6 van en la tarjeta;
// el texto cuenta solo lo llamativo (guía de estilo del 3 nov): el primero, los dos siguientes y quién se sale de su media o qué
// equipo domina la lista.
import { corto, elegir, fmt, partes, del } from '../lib/texto.mjs';
import { tweet } from '../lib/redactar.mjs';

export async function generar({ stats, jornada, jugadores = [], completo = true, dazn = null }) {
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const acabados = stats.filter((m) => m.matchState === 7);
  if (!acabados.length) return [];
  // publicando, solo cuando la jornada ha acabado (nada de «provisional»)
  if (!completo && acabados.length < stats.length) return [];
  // con la jornada entera, todos sus partidos tienen que tener ya los puntos DAZN (si no, los de los últimos irían cortos)
  if (dazn && completo) for (const m of acabados) if (!(await dazn(m)).listo) return [];
  const filas = [];
  for (const m of acabados) for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
    if (p.weekPoints == null) continue;
    filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: corto(lado.mainName), club: lado.mainName, pts: Number(p.weekPoints), media: porId.has(String(p.id)) ? Number(porId.get(String(p.id)).averagePoints) || 0 : 0,
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
    const bueno = clave === 'mejores';
    const cab = bueno
      ? elegir([`🏆 Los mejores de la jornada ${jornada} en LaLiga Fantasy${prov}`, `🏆 El top de la jornada ${jornada} de LaLiga Fantasy${prov}`], `cab${jornada}`)
      : elegir([`📉 Los peores de la jornada ${jornada} en LaLiga Fantasy${prov}`, `📉 Los números rojos de la jornada ${jornada} de LaLiga Fantasy${prov}`], `cab${jornada}`);
    const num = [jornada, acabados.length, stats.length, faltan, ord.length];
    const ideas = [];
    const [a, b2] = ord;
    if (b2 && b2.pts === a.pts) ideas.push({ t: bueno ? `🥇 ${a.nombre} y ${b2.nombre}, ${a.pts} puntos cada uno` : `🔻 ${a.nombre} y ${b2.nombre} se quedan en ${a.pts}`, prio: 9 });
    else ideas.push({ t: bueno ? elegir([`🥇 ${a.nombre} se va a ${a.pts} puntos`, `🥇 Nadie saca más que ${a.nombre}: ${a.pts} puntos`], `top${jornada}`) : `🔻 ${a.nombre} se queda en ${a.pts}`, prio: 9 });
    num.push(a.pts);
    const det = ord.slice(b2 && b2.pts === a.pts ? 2 : 1, (b2 && b2.pts === a.pts ? 2 : 1) + 2);
    if (det.length === 2) { ideas.push({ t: `${bueno ? '🥈' : '🔻'} Detrás, ${det[0].nombre} (${det[0].equipo}) con ${det[0].pts} y ${det[1].nombre} (${det[1].equipo}) con ${det[1].pts}`, prio: 6 }); num.push(det[0].pts, det[1].pts); }
    // quien se sale de su media (solo en los mejores: el doble o más, con media de 3 o más)
    const sale = bueno ? ord.find((f) => f.media >= 3 && f.pts >= 2 * f.media) : null;
    if (sale) { ideas.push({ t: `📈 ${sale.nombre} suele sacar ${fmt(sale.media)} de media y esta vez ${sale.pts}`, prio: 5 }); num.push(...partes(sale.media), sale.pts); }
    // el equipo que pone a 3 o más en la lista
    const porEquipo = {};
    for (const f of ord) porEquipo[f.equipo] = (porEquipo[f.equipo] || 0) + 1;
    const [eq, n] = Object.entries(porEquipo).sort((x, y) => y[1] - x[1])[0];
    if (n >= 3) { ideas.push({ t: bueno ? `💥 ${n} de los ${ord.length} mejores son ${del(eq)}` : `⚠️ ${n} de los ${ord.length} peores son ${del(eq)}`, prio: 7 }); num.push(n); }
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) continue;
    // la tarjeta con los 6 (Carlos, 2 nov 23:28: «algún grafismo chulo para los 6 mejores y peores»)
    const tarjeta = { tipo: 'resumen', nombre: `resumen-${jornada}-${clave}`, d: { jornada, clave, filas: ord },
      permitidos: { numeros: [jornada, 1, 2, 3, 4, 5, 6, ...ord.map((f) => f.pts)].map(String), palabras: ord.flatMap((f) => [f.nombre, f.equipo, f.club]) } };
    out.push({ tipo: 'resumen', clave: `resumen|${jornada}|${clave}|${acabados.length}`, jornada, texto, numeros: num, tarjeta });
  }
  return out;
}
