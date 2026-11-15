// El resumen de cada jornada en la web (jornada/resumen-jornada-N.html) y la página de las jornadas (/jornada/). Con los puntos
// oficiales de LaLiga Fantasy de stats/week/N (los mismos que usa el bot en tipos/resumen.mjs): resultados, MVP de cada partido,
// los mejores y los peores, el once ideal de lo que de verdad puntuó y los equipos que más puntos dieron. Texto con reglas, sin IA.
import { corto } from '../lib/texto.mjs';
import { FORMACIONES } from '../lib/once-ideal.mjs';
import { fechaHora, fecha, diaCorto, hora } from './vista.mjs';
import { e, coma, dinero, cara, escudo, chipPuntos, filaJugador, bloque, lista, tarjetas, POS } from './portal.mjs';
import { proximaCaja } from './mercado.mjs';

const num = (x) => Number(x) || 0;

/** los hechos del resumen de la jornada J, o null si no ha acabado entera */
export function hechosResumen(J, stats, jugadores = [], { ahora = Date.now() } = {}) {
  if (!stats.length || stats.some((m) => m.matchState !== 7)) return null;
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const partidos = [], filas = [];
  for (const m of [...stats].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const P = { t: Date.parse(m.date), local: corto(m.local.mainName), visitante: corto(m.visitor.mainName), escL: m.local.badgeColor, escV: m.visitor.badgeColor,
      gl: m.localScore, gv: m.visitorScore, jugadores: [] };
    for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
      if (p.weekPoints == null) continue;
      const j = porId.get(String(p.id));
      const f = { id: String(p.id), nombre: p.nickname || p.name, pos: Number(p.positionId), equipo: corto(lado.mainName), teamId: String(lado.id),
        caraUrl: (p.images && p.images.transparent && p.images.transparent['256x256']) || (j && j.image) || null, escudoUrl: lado.badgeColor,
        pts: num(p.weekPoints), media: j ? num(j.averagePoints) : 0, valor: j ? num(j.marketValue) : 0 };
      filas.push(f); P.jugadores.push(f);
    }
    P.mvp = [...P.jugadores].sort((a, b) => b.pts - a.pts)[0] || null;
    partidos.push(P);
  }
  if (filas.length < 100) return null;
  const mejores = [...filas].sort((a, b) => b.pts - a.pts || b.media - a.media).slice(0, 10);
  const peores = filas.filter((f) => f.pts < 0).sort((a, b) => a.pts - b.pts).slice(0, 6);
  // el once ideal de lo que se jugó: la formación que más suma con el mejor portero y los mejores de cada línea
  const por = (p) => filas.filter((f) => f.pos === p).sort((a, b) => b.pts - a.pts || b.media - a.media);
  const L = { 1: por(1), 2: por(2), 3: por(3), 4: por(4) };
  let once = null;
  for (const [d, m, f] of FORMACIONES) {
    const xi = [L[1].slice(0, 1), L[2].slice(0, d), L[3].slice(0, m), L[4].slice(0, f)];
    if (xi.some((x, i) => x.length < [1, d, m, f][i])) continue;
    const suma = xi.flat().reduce((s, x) => s + x.pts, 0);
    if (!once || suma > once.suma) once = { formacion: `${d}-${m}-${f}`, lineas: xi, suma };
  }
  const eqs = {};
  for (const f of filas) { const q = eqs[f.teamId] || (eqs[f.teamId] = { nombre: f.equipo, escudoUrl: f.escudoUrl, pts: 0, n: 0 }); q.pts += f.pts; if (f.pts >= 6) q.n++; }
  const equipos = Object.values(eqs).sort((a, b) => b.pts - a.pts);
  const doblan = filas.filter((f) => f.media >= 3 && f.pts >= 2 * f.media && f.pts >= 10).sort((a, b) => b.pts / b.media - a.pts / a.media).slice(0, 6);
  const goles = partidos.reduce((s, p) => s + num(p.gl) + num(p.gv), 0);
  return { jornada: J, generada: ahora, primero: partidos[0].t, ultimo: partidos[partidos.length - 1].t, partidos, mejores, peores, once, equipos, doblan, goles, nJugadores: filas.length,
    media: filas.reduce((s, f) => s + f.pts, 0) / filas.length };
}

export function metasResumen(J) {
  return {
    titulo: `Jornada ${J} de LaLiga Fantasy: mejores, peores y once ideal`,
    h1: `Resumen de la jornada ${J}`,
    corto: `Resumen de la jornada ${J}`,
    descripcion: `Resumen de la jornada ${J} de LaLiga Fantasy: los jugadores que más y menos puntos han sacado, el MVP de cada partido, el once ideal y los resultados.`,
  };
}

const marcador = (p) => `<span class="res">${e(String(p.gl ?? '-'))}-${e(String(p.gv ?? '-'))}</span>`;

/** el once en su campo: cuatro líneas, del delantero al portero */
function campoOnce(once) {
  const lin = [...once.lineas].reverse().map((l) => `<div class="cl">${l.map((x) => `<div class="cj">${cara(x, 'm')}<b>${e(x.nombre)}</b><span>${chipPuntos(x.pts)}<span class="eqn">${e(x.equipo)}</span></span></div>`).join('')}</div>`).join('');
  return `  <div class="campo" role="img" aria-label="${e(`Once ideal ${once.formacion}: ${once.lineas.flat().map((x) => `${x.nombre} ${x.pts}`).join(', ')}`)}">${lin}</div>`;
}

export function contenidoResumen(h, { previa = null, siguiente = null, tarjeta = null, tarjetaAlto = null, rutas = null } = {}) {
  // las filas enlazan a la ficha del jugador si la tiene (fase 2)
  const fila = (x, d) => filaJugador(x, d, { enlace: rutas && rutas.jugador(x.id) ? `../${rutas.jugador(x.id)}` : null });
  const J = h.jornada, o = [];
  const a = h.mejores[0], eq = h.equipos[0];
  o.push(`  <h1>Resumen de la <span>jornada ${J}</span></h1>`);
  const t = [`La jornada ${J} de LaLiga Fantasy se jugó del ${fecha(h.primero)} al ${fecha(h.ultimo)}: ${h.partidos.length} partidos y ${h.goles} goles.`];
  const empatados = h.mejores.filter((x) => x.pts === a.pts);
  t.push(empatados.length > 1 ? `Arriba, empatados a ${a.pts} puntos, ${empatados.map((x) => `${x.nombre} (${x.equipo})`).join(' y ')}.` : `El que más puntos sacó fue ${a.nombre} (${a.equipo}), con ${a.pts}.`);
  if (h.once) t.push(`El once ideal de lo que se jugó, en ${h.once.formacion}, suma ${h.once.suma} puntos.`);
  if (eq) t.push(`El equipo que más puntos dio entre todos sus jugadores fue el ${eq.nombre}, con ${eq.pts}.`);
  o.push(`  <p class="lead">${e(t.join(' '))}</p>`);
  o.push(`  <p class="peq">Puntos oficiales de LaLiga Fantasy, con los de DAZN incluidos, tal como estaban el ${e(fechaHora(h.generada))}.</p>`);
  const enl = [];
  if (previa) enl.push(`<a class="btn sec" href="../${e(previa)}">La previa de la jornada ${J}</a>`);
  if (siguiente) enl.push(`<a class="btn sec" href="../${e(siguiente.ruta)}">Previa de la jornada ${siguiente.jornada}</a>`);
  if (enl.length) o.push(`  <div class="cta-b">${enl.join('')}</div>`);

  o.push(bloque('Los mejores de la jornada', lista(h.mejores.map((x) => fila(x, `<span class="fj-n">${chipPuntos(x.pts)}<small>media ${e(coma(x.media))}</small></span>`)))));
  if (tarjeta) o.push(`  <figure class="tarjeta-bot"><img src="${e(tarjeta)}" alt="${e(`Tarjeta de los mejores de la jornada ${J}: ${h.mejores.slice(0, 6).map((x) => `${x.nombre} ${x.pts}`).join(', ')}`)}" width="1080" height="${tarjetaAlto || 875}" loading="lazy" decoding="async"><figcaption>La tarjeta que publicó <a href="https://x.com/Fantasyman_app" rel="noopener">@Fantasyman_app</a> al acabar la jornada.</figcaption></figure>`);
  if (h.once) o.push(bloque(`Once ideal de la jornada ${J}`, campoOnce(h.once), { linea: e(`El mejor portero y los mejores de cada línea en la formación que más suma (${h.once.formacion}, ${h.once.suma} puntos). Es el once de lo que ya se jugó, no una recomendación.`) }));

  o.push(bloque('Resultados y MVP de cada partido', `  <ul class="lp">${h.partidos.map((p) => `<li><span class="lp-p">${escudo(p.escL, p.local, 22)}<b>${e(p.local)}</b>${marcador(p)}<b>${e(p.visitante)}</b>${escudo(p.escV, p.visitante, 22)}</span>`
    + `<span class="lp-f">${e(diaCorto(p.t))}, ${e(hora(p.t))}</span>${p.mvp ? `<span class="lp-m">${cara(p.mvp, 'p')}<span>MVP: <b>${rutas && rutas.jugador(p.mvp.id) ? `<a href="../${e(rutas.jugador(p.mvp.id))}">${e(p.mvp.nombre)}</a>` : e(p.mvp.nombre)}</b> ${chipPuntos(p.mvp.pts)}</span></span>` : ''}</li>`).join('')}</ul>`,
  { linea: 'El MVP es el jugador de los dos equipos que más puntos de LaLiga Fantasy sacó en ese partido.' }));

  if (h.doblan.length) o.push(bloque('Los que doblaron su media', lista(h.doblan.map((x) => fila(x, `<span class="fj-n">${chipPuntos(x.pts)}<small>media ${e(coma(x.media))}</small></span>`))),
    { linea: 'Con 3 puntos de media o más y al menos 10 en esta jornada: sacaron el doble (o más) de lo que suelen.' }));
  if (h.peores.length) o.push(bloque('Los peores de la jornada', lista(h.peores.map((x) => fila(x, `<span class="fj-n">${chipPuntos(x.pts)}<small>media ${e(coma(x.media))}</small></span>`))),
    { linea: 'Los que acabaron en negativo: una expulsión, un penalti fallado o muchos goles encajados.' }));

  const top = h.equipos.slice(0, 5), cola = h.equipos.slice(-3).reverse();
  const fe = (q) => `<li class="fe">${escudo(q.escudoUrl, q.nombre, 28)}<b>${e(q.nombre)}</b><span>${e(String(q.pts))} pts</span></li>`;
  o.push(bloque('Los equipos que más puntos dieron', `  <div class="dos"><ul class="le">${top.map(fe).join('')}</ul><ul class="le">${cola.map(fe).join('')}</ul></div>\n  <p class="peq">Sumando los puntos de todos sus jugadores en la jornada. Arriba, los cinco que más; abajo, los tres que menos.</p>`));

  o.push(bloque('De dónde salen los datos', `  <p>Los puntos son los oficiales de LaLiga Fantasy de cada jugador en la jornada ${J}, con los de DAZN, de los ${h.nJugadores} jugadores que salen en las estadísticas de los partidos. La media es la de toda la temporada. Si LaLiga corrige algún punto después, la página se rehace al día siguiente.</p>`));
  o.push(bloque('Con Fantasy Manager', `  <p>La app te dice cada día qué hacer con tu equipo: quién de los tuyos sube o baja, a quién vender, cuánto pujar y qué cláusulas te llegan antes de la siguiente jornada.</p>`));
  return o.join('\n');
}

/** /jornada/: la que viene (con su previa), la última jugada (con su resumen) y la lista de las dos cosas */
export function contenidoJornadas({ proxima = null, previas = [], resumenes = [], ultimo = null }) {
  const o = [];
  o.push(`  <h1>Jornadas de <span>LaLiga Fantasy</span></h1>`);
  o.push(`  <p class="lead">Antes de cada jornada, la previa: a qué hora se cierran las cláusulas, quién no juega y quién está a una amarilla. Después, el resumen: los que más puntos sacaron, el once ideal y el MVP de cada partido. Las dos se hacen solas con los datos de LaLiga Fantasy.</p>`);
  if (proxima) {
    const pv = previas.find((p) => p.jornada === proxima.jornada);
    o.push(proximaCaja(proxima, { previa: pv ? pv.ruta : null, resumen: null, todas: false }));
    o.push(bloque(`Partidos de la jornada ${proxima.jornada}`, `  <ul class="lp">${proxima.partidos.map((p) => `<li><span class="lp-p">${escudo(p.escL, p.local, 22)}<b>${e(p.local)}</b>${p.estado === 7 ? `<span class="res">${e(String(p.gl))}-${e(String(p.gv))}</span>` : '<span class="res vs">vs</span>'}<b>${e(p.visitante)}</b>${escudo(p.escV, p.visitante, 22)}</span><span class="lp-f">${e(diaCorto(p.t))}, ${e(hora(p.t))}</span></li>`).join('')}</ul>`));
  }
  if (ultimo) {
    const a = ultimo.mejores.slice(0, 3);
    o.push(bloque(`La última: jornada ${ultimo.jornada}`, lista(a.map((x) => filaJugador(x, `<span class="fj-n">${chipPuntos(x.pts)}</span>`))) + `\n  <p><a class="btn sec" href="../jornada/resumen-jornada-${ultimo.jornada}.html">Ver el resumen de la jornada ${ultimo.jornada}</a></p>`));
  }
  const filasJ = new Map();
  for (const p of previas) filasJ.set(p.jornada, { ...(filasJ.get(p.jornada) || {}), previa: p });
  for (const r of resumenes) filasJ.set(r.jornada, { ...(filasJ.get(r.jornada) || {}), resumen: r });
  const js = [...filasJ.entries()].sort((a, b) => b[0] - a[0]);
  if (js.length) o.push(bloque('Todas las jornadas', `  <ul class="lista-guias">${js.map(([n, x]) => `<li><div class="lg-j"><b>Jornada ${n}</b><span>${[x.previa ? `<a href="../${e(x.previa.ruta)}">Previa</a>` : '', x.resumen ? `<a href="../${e(x.resumen.ruta)}">Resumen</a>` : ''].filter(Boolean).join(' · ')}</span></div></li>`).join('')}</ul>`));
  return o.join('\n');
}
