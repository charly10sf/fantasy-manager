// Mejores y peores de la jornada, con los puntos oficiales de LaLiga Fantasy (weekPoints de stats/week/{n}). Los 6 van en la tarjeta;
// el texto cuenta solo lo llamativo (guía de estilo del 3 nov): el primero, los dos siguientes y quién se sale de su media o qué
// equipo domina la lista.
import { corto, elegir, fmt, partes, del, largo, dineroTxt } from '../lib/texto.mjs';
import { tweet, aparte } from '../lib/redactar.mjs';
import { enLetra, mayus } from '../lib/agrupar.mjs';
import { clubes as clubesH, jugador as jugadorH, frenteMedia } from '../lib/hechos.mjs';

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
    filas.push({ id: p.id, pos: p.positionId, nombre: p.nickname || p.name, equipo: corto(lado.mainName), club: lado.mainName, pts: Number(p.weekPoints), media: porId.has(String(p.id)) ? Number(porId.get(String(p.id)).averagePoints) || 0 : 0,
      valor: porId.has(String(p.id)) ? Number(porId.get(String(p.id)).marketValue) || 0 : 0,
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
    // el primero (o los empatados con él) y los dos siguientes; con el equipo, porque arriba no hay partido
    const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0]);
    const conEq = (xs) => { const eqs = new Set(xs.map((f) => f.equipo)); return eqs.size === 1 ? `${lista(xs.map((f) => f.nombre))} (${xs[0].equipo})` : lista(xs.map((f) => `${f.nombre} (${f.equipo})`)); };
    const a = ord[0];
    const arriba = ord.filter((f) => f.pts === a.pts);
    if (arriba.length > 1) ideas.push({ t: bueno ? `🥇 ${arriba.length === 2 ? '' : `${mayus(enLetra(arriba.length))} empatados: `}${conEq(arriba)}, ${a.pts} puntos cada uno` : `🔻 ${arriba.length === 2 ? '' : `${mayus(enLetra(arriba.length))} se quedan en ${a.pts}: `}${conEq(arriba)}${arriba.length === 2 ? `, ${a.pts} cada uno` : ''}`, prio: 9 });
    else ideas.push({ t: bueno ? elegir([`🥇 ${conEq([a])} se va a ${a.pts} puntos`, `🥇 Nadie saca más que ${conEq([a])}: ${a.pts} puntos`], `top${jornada}`) : `🔻 ${conEq([a])} se queda en ${a.pts}`, prio: 9 });
    num.push(a.pts, arriba.length);
    const det = ord.slice(arriba.length, arriba.length + 2);
    if (arriba.length < 4 && det.length === 2) { ideas.push({ t: `${bueno ? '🥈 Detrás' : '🔻 Después'}, ${det[0].nombre} (${det[0].equipo}) con ${det[0].pts} y ${det[1].nombre} (${det[1].equipo}) con ${det[1].pts}`, prio: 6 }); num.push(det[0].pts, det[1].pts); }
    // quien se sale de su media (solo en los mejores: el doble o más, con media de 3 o más)
    const sale = bueno ? ord.find((f) => f.media >= 3 && f.pts >= 2 * f.media) : null;
    if (sale) { ideas.push({ t: `📈 ${sale.nombre} suele sacar ${fmt(sale.media)} de media y esta vez ${sale.pts}`, prio: 5 }); num.push(...partes(sale.media), sale.pts); }
    // el equipo que pone a 3 o más en la lista
    const porEquipo = {};
    for (const f of ord) porEquipo[f.equipo] = (porEquipo[f.equipo] || 0) + 1;
    const [eq, n] = Object.entries(porEquipo).sort((x, y) => y[1] - x[1])[0];
    if (n >= 3) { // (en letra: una frase que empieza por cifra se lee mal; auditoría del 5 nov)
      const cuantos = n === ord.length ? `Los ${enLetra(n)}` : `${mayus(enLetra(n))} de los ${enLetra(ord.length)}`; ideas.push({ t: bueno ? `💥 ${cuantos} mejores son ${del(eq)}` : `⚠️ ${cuantos} peores son ${del(eq)}`, prio: 7 }); num.push(n); }
    // con tweets largos (X Premium): el resto de los seis, todos los que doblan su media y, en los mejores, el más barato
    if (largo()) {
      const ya = new Set([...arriba, ...(arriba.length < 4 && det.length === 2 ? det : [])].map((f) => String(f.id)));
      const resto = ord.filter((f) => !ya.has(String(f.id)));
      if (resto.length) {
        const ns = lista(resto.map((f) => `${f.nombre} con ${f.pts}`));
        ideas.push({ t: aparte(bueno ? `${ns} ${resto.length > 1 ? 'completan' : 'completa'} los seis` : `También en rojo, ${ns}`), prio: 3 }); num.push(...resto.map((f) => f.pts));
      }
      const salen = bueno ? ord.filter((f) => f.media >= 3 && f.pts >= 2 * f.media && f !== sale).slice(0, 3) : [];
      if (salen.length) {
        const varios = salen.length > 1;
        // (con la misma media, «3 cada uno», no «3, 3 y 3»; con medias distintas, cada una con su nombre: «4,1, 5,2 y 6» no se lee)
        const iguales = salen.every((f) => fmt(f.media) === fmt(salen[0].media));
        const quienes = iguales ? `${lista(salen.map((f) => f.nombre))}, que ${varios ? 'van' : 'va'} a ${fmt(salen[0].media)}${varios ? ' cada uno' : ''}`
          : salen.map((f) => `${f.nombre}, que va a ${fmt(f.media)}`).reduce((t, x, i, xs) => (i === 0 ? x : i === xs.length - 1 ? `${t}, y ${x}` : `${t}, ${x}`), '');
        ideas.push({ t: `📈 También ${varios ? 'doblan' : 'dobla'} su media ${quienes}`, prio: 2 });
        num.push(...salen.flatMap((f) => partes(f.media)));
      }
      const barato = bueno ? [...ord].filter((f) => f.valor > 0).sort((x, y) => x.valor - y.valor)[0] : null;
      if (barato && barato.valor <= 15e6) {
        // en M con un decimal; por debajo del millón, en K enteros (como el mercado: «640 K»)
        const dv = dineroTxt(barato.valor);
        ideas.push({ t: aparte(`💸 El más barato de los seis es ${barato.nombre}: vale ${dv.t} en el mercado`), prio: 2 }); num.push(...dv.numeros);
      }
    }
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) continue;
    // la tarjeta con los 6 (Carlos, 2 nov 23:28: «algún grafismo chulo para los 6 mejores y peores»)
    const tarjeta = { tipo: 'resumen', nombre: `resumen-${jornada}-${clave}`, d: { jornada, clave, filas: ord },
      permitidos: { numeros: [jornada, 1, 2, 3, 4, 5, 6, ...ord.map((f) => f.pts)].map(String), palabras: ord.flatMap((f) => [f.nombre, f.equipo, f.club]) } };
    // los hechos para la IA que redacta (lib/redaccion.mjs): la clasificación de los seis (los puntos son los oficiales de la jornada)
    const hechos = { tipo: 'resumen', subtipo: clave, jornada, noticia: bueno ? `los seis que más puntos han sacado en la jornada ${jornada} de LaLiga Fantasy` : `los seis que menos puntos han sacado (negativos) en la jornada ${jornada} de LaLiga Fantasy`,
      aviso: 'la imagen adjunta lista los seis con su cara y su equipo: el texto cuenta lo llamativo, no los enumera todos',
      ...(faltan ? { provisional: `faltan ${faltan} partidos de la jornada` } : {}), ...(arriba.length > 1 ? { empatadosEnLoAlto: arriba.length } : {}),
      ...(n >= 3 ? { clubQueMasPone: `${eq} (${n} de los ${ord.length})` } : {}),
      clasificacion: ord.map((f, i) => ({ puesto: i + 1, nombre: f.nombre, club: f.equipo, puntos: f.pts })),
      jugadores: ord.map((f) => jugadorH({ nickname: f.nombre, equipo: f.equipo, averagePoints: f.media }, { principal: arriba.includes(f),
        extra: { puntosDeLaJornada: f.pts, ...(bueno && f.media >= 3 ? { frenteASuMedia: frenteMedia(f.pts, f.media) } : {}) } })),
      clubes: clubesH(...ord.map((f) => f.equipo)), etiqueta: '' };
    out.push({ tipo: 'resumen', clave: `resumen|${jornada}|${clave}|${acabados.length}`, jornada, texto, hechos, numeros: num, tarjeta });
  }
  return out;
}
