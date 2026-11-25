// El resumen de cada jornada en la web (jornada/resumen-jornada-N.html) y la página de las jornadas (/jornada/). Con los puntos
// oficiales de LaLiga Fantasy de stats/week/N (los mismos que usa el bot en tipos/resumen.mjs): resultados, MVP de cada partido,
// los mejores y los peores, el once ideal de lo que de verdad puntuó y los equipos que más puntos dieron. Texto con reglas, sin IA.
import { corto, el } from '../lib/texto.mjs';
import { FORMACIONES } from '../lib/once-ideal.mjs';
import { fechaHora, fecha, diaCorto, hora } from './vista.mjs';
import { e, coma, cara, escudo, chipPuntos, bloque, celdaJug, tabla, kpis, subnav, pestanas } from './portal.mjs';
import { proximaCaja } from './mercado.mjs';

const num = (x) => Number(x) || 0;

/** los hechos del resumen de la jornada J, o null si no ha acabado entera */
/* (25 nov, B9) un partido aplazado (Rayo-Athletic de la J8, al 9 dic) dejaba la jornada sin resumen para siempre: el resumen
   solo salía con los 10 acabados, y la Action solo mira la jornada de ahora y la de antes. Un partido sin jugar cuya fecha
   es 3 días o más después del último acabado de su jornada cuenta como aplazado: el resumen sale con los demás, lo dice y
   se rehace cuando se juegue (portal-web.mjs, `aplazados` en estado.json). */
const APLAZADO_DIAS = 3;
export function aplazadosDe(stats) {
  const hechos = stats.filter((m) => m.matchState === 7);
  if (!hechos.length) return null;
  const ult = Math.max(...hechos.map((m) => Date.parse(m.date)));
  const sin = stats.filter((m) => m.matchState !== 7);
  if (sin.some((m) => !(Date.parse(m.date) - ult >= APLAZADO_DIAS * 864e5))) return null;
  return sin.map((m) => ({ local: corto(m.local.mainName), visitante: corto(m.visitor.mainName), t: Date.parse(m.date) }));
}
export function hechosResumen(J, stats, jugadores = [], { ahora = Date.now() } = {}) {
  if (!stats.length) return null;
  const aplazados = stats.some((m) => m.matchState !== 7) ? aplazadosDe(stats) : [];
  if (!aplazados) return null;
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const partidos = [], filas = [];
  for (const m of [...stats].filter((x) => x.matchState === 7).sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
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
  return { jornada: J, generada: ahora, primero: partidos[0].t, ultimo: partidos[partidos.length - 1].t, aplazados, partidos, mejores, peores, once, equipos, doblan, goles, nJugadores: filas.length,
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

/** un número fijo por texto (FNV-1a): la forma de decir algo, siempre la misma para la misma jornada */
function huella(t) {
  let x = 2166136261;
  for (const c of String(t)) { x ^= c.codePointAt(0); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
const elige = (semilla, formas) => formas[huella(semilla) % formas.length];
const may = (f) => f.charAt(0).toUpperCase() + f.slice(1);
const dineroR = (x) => { const a = Math.abs(x); return a >= 1e6 ? `${coma(a / 1e6)} M` : `${Math.round(a / 1e3)} mil`; };

/** lo de cada jornada que sirve para comparar con la temporada (de `hechosResumen` de las jornadas ya jugadas) */
export const resumenCorto = (h) => ({ J: h.jornada, goles: h.goles, partidos: h.partidos.length, top: h.mejores[0] ? { nombre: h.mejores[0].nombre, pts: h.mejores[0].pts } : null,
  once: h.once ? h.once.suma : null, media: h.media, eq: h.equipos[0] ? { nombre: h.equipos[0].nombre, pts: h.equipos[0].pts } : null });

/**
 * El análisis del resumen: varios párrafos con lo que se sale de lo normal en esa jornada, comparado con las demás de la temporada
 * (temporada: [resumenCorto]). Cada frase tiene sus formas y solo sale si se cumple su umbral; la apertura cambia según lo que más
 * destaque. Reglas, sin IA.
 */
export function analisisResumen(h, temporada = null) {
  const J = h.jornada, a = h.mejores[0], eq = h.equipos[0], T = (temporada || []).filter((x) => x.J !== J && x.partidos >= 8);
  const gpp = h.goles / h.partidos.length, gT = T.length ? T.reduce((s, x) => s + x.goles / x.partidos, 0) / T.length : null;
  const p1 = [], p2 = [], p3 = [];
  // la apertura: fechas, partidos y goles, con la comparación si la hay
  const maxG = T.length >= 3 && T.every((x) => x.goles < h.goles), minG = T.length >= 3 && T.every((x) => x.goles > h.goles);
  p1.push(maxG ? elige(`${J}|a`, [`Ninguna otra jornada de la temporada ha tenido tantos goles: ${h.goles} en ${h.partidos.length} partidos, del ${fecha(h.primero)} al ${fecha(h.ultimo)}.`, `La jornada ${J} fue la más goleadora hasta ahora, con ${h.goles} goles entre el ${fecha(h.primero)} y el ${fecha(h.ultimo)}.`])
    : minG ? elige(`${J}|a`, [`Jornada seca: ${h.goles} goles en ${h.partidos.length} partidos, la que menos de la temporada.`, `Del ${fecha(h.primero)} al ${fecha(h.ultimo)} solo se marcaron ${h.goles} goles, el registro más bajo del curso.`])
    : gT != null && Math.abs(gpp - gT) >= 0.5 ? `Se jugó del ${fecha(h.primero)} al ${fecha(h.ultimo)} y se marcaron ${h.goles} goles, ${coma(gpp)} por partido, ${gpp > gT ? 'por encima' : 'por debajo'} de los ${coma(gT)} de las demás jornadas.`
    : elige(`${J}|a`, [`La jornada ${J} se jugó del ${fecha(h.primero)} al ${fecha(h.ultimo)}: ${h.partidos.length} partidos y ${h.goles} goles.`, `${h.partidos.length} partidos entre el ${fecha(h.primero)} y el ${fecha(h.ultimo)}, con ${h.goles} goles.`]));
  // la goleada y los empates
  const gol = [...h.partidos].map((p) => ({ p, d: Math.abs(num(p.gl) - num(p.gv)) })).sort((x, y) => y.d - x.d)[0];
  if (gol && gol.d >= 3) p1.push(elige(`${J}|g`, [`El resultado más abultado fue el ${gol.p.local} ${gol.p.gl}-${gol.p.gv} ${gol.p.visitante}.`, `Hubo goleada: ${gol.p.local} ${gol.p.gl}-${gol.p.gv} ${gol.p.visitante}.`]));
  const emp = h.partidos.filter((p) => p.gl === p.gv).length;
  if (emp >= 4) p1.push(`${may(['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'][emp] || String(emp))} de los ${h.partidos.length} partidos acabaron en empate.`);
  else if (emp === 0) p1.push('No hubo ni un empate.');
  // el mejor, con la temporada al lado
  const empatados = h.mejores.filter((x) => x.pts === a.pts);
  const recordAntes = T.filter((x) => x.J < J && x.top).sort((x, y) => y.top.pts - x.top.pts)[0];
  if (empatados.length > 1) p2.push(`Arriba, empatados a ${a.pts} puntos, ${empatados.map((x) => `${x.nombre} (${x.equipo})`).join(' y ')}.`);
  else if (recordAntes && a.pts > recordAntes.top.pts) p2.push(elige(`${J}|m`, [`Los ${a.pts} puntos de ${a.nombre} (${a.equipo}) son lo más alto de la temporada hasta esta jornada: el récord era de ${recordAntes.top.nombre}, ${recordAntes.top.pts} en la jornada ${recordAntes.J}.`, `${a.nombre} firmó la mejor actuación del curso: ${a.pts} puntos, por encima de los ${recordAntes.top.pts} de ${recordAntes.top.nombre} en la jornada ${recordAntes.J}.`]));
  else p2.push(elige(`${J}|m`, [`El que más puntos sacó fue ${a.nombre} (${a.equipo}), con ${a.pts}.`, `${a.nombre} fue el mejor de la jornada: ${a.pts} puntos con ${el(a.equipo)}.`, `Nadie superó los ${a.pts} puntos de ${a.nombre}, del ${a.equipo}.`]));
  // un MVP de un equipo que perdió
  const perd = h.partidos.map((p) => { const m = p.mvp; if (!m) return null; const gana = num(p.gl) > num(p.gv) ? p.local : num(p.gv) > num(p.gl) ? p.visitante : null; return gana && m.equipo !== gana && m.pts >= 8 ? { m, p } : null; }).filter(Boolean)[0];
  if (perd) p2.push(`${perd.m.nombre} fue el MVP del ${perd.p.local}-${perd.p.visitante} con ${perd.m.pts} puntos aunque su equipo perdió.`);
  const d = h.doblan[0];
  if (d && d !== a) p2.push(elige(`${J}|d`, [`La sorpresa, ${d.nombre}: ${d.pts} puntos cuando su media es de ${coma(d.media)}.`, `${d.nombre} sacó ${d.pts}, más del doble de lo que suele (${coma(d.media)} de media).`]));
  // el once y los equipos
  const onces = T.filter((x) => x.once != null).map((x) => x.once);
  if (h.once && onces.length >= 3) {
    const mx = Math.max(...onces), mn = Math.min(...onces);
    p3.push(h.once.suma > mx ? `El once ideal (${h.once.formacion}) suma ${h.once.suma} puntos, el más alto de la temporada.` : h.once.suma < mn ? `El once ideal se quedó en ${h.once.suma} puntos (${h.once.formacion}): ninguna otra jornada ha dado tan poco arriba.`
      : elige(`${J}|o`, [`El once ideal de lo que se jugó, en ${h.once.formacion}, suma ${h.once.suma} puntos.`, `Con los mejores de cada línea en un ${h.once.formacion} salen ${h.once.suma} puntos.`]));
  } else if (h.once) p3.push(`El once ideal de lo que se jugó, en ${h.once.formacion}, suma ${h.once.suma} puntos.`);
  const ult = h.equipos[h.equipos.length - 1];
  if (eq && ult && eq.pts >= 2 * Math.max(1, ult.pts)) p3.push(elige(`${J}|e`, [ult.pts > 0 ? `Entre equipos, ${el(eq.nombre)} dio ${eq.pts} puntos, más del doble que ${el(ult.nombre)} (${ult.pts}).` : `Entre equipos, ${el(eq.nombre)} dio ${eq.pts} puntos y ${el(ult.nombre)} se quedó en ${ult.pts}.`, `${may(el(eq.nombre))} fue el equipo que más puntos repartió (${eq.pts}); ${el(ult.nombre)}, el que menos (${ult.pts}).`]));
  else if (eq) p3.push(`El equipo que más puntos dio entre todos sus jugadores fue ${el(eq.nombre)}, con ${eq.pts}.`);
  if (h.peores.length >= 4) p3.push(`${h.peores.length} jugadores acabaron en negativo; el peor, ${h.peores[0].nombre} con ${h.peores[0].pts}.`);
  return [p1, p2, p3].filter((x) => x.length).map((x) => x.join(' '));
}

/** el bloque de la semana del mercado (idea 7): la tabla de los que más ganaron y perdieron y el mejor negocio */
function bloqueSemana(h, s, enl) {
  const t = (xs, col, f) => tabla([{ t: 'Jugador', c: 'j' }, { t: col, c: 'n' }], xs.map((x) => `${celdaJug(x, { enlace: enl(x) })}<td class="n">${f(x)}</td>`));
  const g = s.ganan[0], p = s.pierden[0], n = s.negocio[0];
  const fr = [`Del ${s.desdeTxt} al ${s.hastaTxt} hubo ${s.cambios === 1 ? 'un cambio' : `${s.cambios} cambios`} de mercado entre la jornada ${h.jornada - 1} y el cierre de cláusulas de la ${h.jornada}.`];
  if (g) fr.push(elige(`${h.jornada}|sg`, [`Quien comprara a ${g.nombre} al empezar la semana ganó ${dineroR(g.gana)} antes del cierre.`, `${g.nombre} fue el que más se revalorizó: ${dineroR(g.gana)} en esos días.`]));
  if (p) fr.push(`En el otro lado, ${p.nombre} perdió ${dineroR(-p.gana)}.`);
  if (n) fr.push(elige(`${h.jornada}|sn`, [`El mejor negocio, sumando lo que subió y sus puntos de la jornada a 100 mil cada uno (lo que paga LaLiga): ${n.nombre}, ${dineroR(n.negocio)}.`, `Contando la subida y los ${n.pts} puntos que hizo (a 100 mil por punto), nadie salió tan rentable como ${n.nombre}: ${dineroR(n.negocio)}.`]));
  return bloque('La semana del mercado', `  <p>${e(fr.join(' '))}</p>\n` + pestanas('sem', [['Ganaron', t(s.ganan, 'Semana', (x) => `<span class="sube">+${e(dineroR(x.gana))}</span>`)],
    ['Perdieron', t(s.pierden, 'Semana', (x) => `<span class="baja">-${e(dineroR(-x.gana))}</span>`)], ['Negocio', t(s.negocio, 'Subida + puntos', (x) => e(dineroR(x.negocio)))]]),
  { id: 'semana', linea: `Valor al primer cambio de mercado tras la jornada ${h.jornada - 1} frente al último antes del cierre. Cómo se mueve el valor, en <a href="../guias/valor-de-mercado.html">valor de mercado</a>.` });
}

/**
 * La semana del mercado de la jornada J (idea 7): del primer cambio de mercado después de acabar la J-1 al último antes del cierre de
 * la J (24 h antes de su primer partido). filas: hm.todas (con la serie `temporada` de cada uno); h: el resumen (puntos de la jornada).
 */
export function semanaMercado(h, filas, finAnterior) {
  if (!finAnterior || !filas || !filas.length) return null;
  const cierre = h.primero - 24 * 36e5;
  const diaDe = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
  // el valor de un día de Madrid (el punto de la serie de ese día)
  const v = (f, dia) => { const x = (f.temporada || []).find((y) => diaDe(y.t) === dia); return x ? x.v : null; };
  const d0 = diaDe(finAnterior + 6 * 36e5), d1 = diaDe(cierre);
  if (d0 >= d1) return null;
  const pts = new Map(h.mejores.concat(h.peores).map((x) => [x.id, x.pts]));
  for (const P of h.partidos) for (const x of P.jugadores) pts.set(x.id, x.pts);
  const xs = filas.filter((f) => f.pos >= 1 && f.pos <= 4).map((f) => { const a = v(f, d0), b = v(f, d1); return a && b && a >= 1e6 ? { ...f, gana: b - a, pts: pts.get(f.id) ?? null } : null; }).filter(Boolean);
  if (xs.length < 50) return null;
  const neg = xs.filter((x) => x.pts != null).map((x) => ({ ...x, negocio: x.gana + x.pts * 1e5 }));
  const dias = Math.round((Date.parse(`${d1}T12:00:00Z`) - Date.parse(`${d0}T12:00:00Z`)) / 864e5) + 1;
  const txt = (d) => { const [, m, dd] = d.split('-').map(Number); return `${dd} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]}`; };
  return { desde: d0, hasta: d1, desdeTxt: txt(d0), hastaTxt: txt(d1), cambios: dias - 1,
    ganan: [...xs].sort((a, b) => b.gana - a.gana).filter((x) => x.gana > 0).slice(0, 5), pierden: [...xs].sort((a, b) => a.gana - b.gana).filter((x) => x.gana < 0).slice(0, 5),
    negocio: neg.sort((a, b) => b.negocio - a.negocio).slice(0, 5).map((x) => ({ id: x.id, nombre: x.nombre, pos: x.pos, equipo: x.equipo, caraUrl: x.caraUrl, escudoUrl: x.escudoUrl, gana: x.gana, pts: x.pts, negocio: x.negocio })) };
}

const marcador = (p) => `<span class="res">${e(String(p.gl ?? '-'))}-${e(String(p.gv ?? '-'))}</span>`;

/** el once en su campo: cuatro líneas, del delantero al portero */
function campoOnce(once) {
  const lin = [...once.lineas].reverse().map((l) => `<div class="cl">${l.map((x) => `<div class="cj">${cara(x, 'm')}<b>${e(x.nombre)}</b><span>${chipPuntos(x.pts)}<span class="eqn">${e(x.equipo)}</span></span></div>`).join('')}</div>`).join('');
  return `  <div class="campo" role="img" aria-label="${e(`Once ideal ${once.formacion}: ${once.lineas.flat().map((x) => `${x.nombre} ${x.pts}`).join(', ')}`)}">${lin}</div>`;
}

export function contenidoResumen(h, { previa = null, siguiente = null, tarjeta = null, tarjetaAlto = null, rutas = null, temporada = null, semana = null, onces = '' } = {}) {
  // los nombres enlazan a la ficha del jugador si la tiene (fase 2)
  const enl = (x) => (rutas && rutas.jugador(x.id) ? `../${rutas.jugador(x.id)}` : null);
  const J = h.jornada, o = [];
  const a = h.mejores[0], eq = h.equipos[0];
  o.push(`  <h1>Resumen de la <span>jornada ${J}</span></h1>`);
  o.push(`  <p class="fresco">Del ${e(fecha(h.primero))} al ${e(fecha(h.ultimo))} · puntos oficiales con los de DAZN, a ${e(fechaHora(h.generada))}</p>`);
  o.push(kpis([
    { v: String(h.partidos.length), l: 'Partidos', s: `${h.goles} goles` },
    { v: String(a.pts), l: 'El mejor', s: e(a.nombre) },
    h.once ? { v: String(h.once.suma), l: 'Once ideal', s: e(h.once.formacion) } : null,
    eq ? { v: String(eq.pts), l: 'Mejor equipo', s: e(eq.nombre) } : null,
  ], 'k4'));
  const ir = [];
  if (previa) ir.push(`<a href="../${e(previa)}">La previa de la jornada ${J}</a>`);
  if (siguiente) ir.push(`<a href="../${e(siguiente.ruta)}">Previa de la jornada ${siguiente.jornada}</a>`);
  if (ir.length) o.push(`  <p class="enl-j">${ir.join(' · ')}</p>`);
  if (h.aplazados && h.aplazados.length) o.push(`  <p class="aviso">${h.aplazados.length === 1 ? 'Falta un partido, aplazado' : `Faltan ${h.aplazados.length} partidos, aplazados`}: ${h.aplazados.map((x) => `${e(x.local)}-${e(x.visitante)} (${e(fecha(x.t))})`).join(' y ')}. Aquí va lo de los ${h.partidos.length} que se han jugado; cuando se juegue, este resumen se pone al día con sus puntos.</p>`);
  o.push(subnav([['mejores', 'Mejores'], h.once && ['once', 'Once ideal'], ['partidos', 'Partidos'], h.doblan.length && ['doblan', 'Doblan su media'], h.peores.length && ['peores', 'Peores'], ['equipos', 'Equipos'], semana && semana.ganan.length && ['semana', 'Mercado'], ['analisis', 'Análisis']]));

  const tPts = (xs, rango = true) => tabla([rango && { t: '#', c: 'n m' }, { t: 'Jugador', c: 'j' }, { t: 'Pts', c: 'n' }, { t: 'Media', c: 'n' }].filter(Boolean),
    xs.map((x, i) => `${rango ? `<td class="n m">${i + 1}</td>` : ''}${celdaJug(x, { enlace: enl(x) })}<td class="n">${chipPuntos(x.pts)}</td><td class="n">${e(coma(x.media))}</td>`));
  o.push(bloque('Los mejores de la jornada', tPts(h.mejores), { id: 'mejores', linea: elige(`${J}|lm`, ['Puntos de la jornada y media de toda la temporada.', 'Al lado de los puntos de la jornada, la media de cada uno en la temporada.', '']) }));
  if (h.once) o.push(bloque(`Once ideal de la jornada ${J}`, campoOnce(h.once), { id: 'once', linea: `Lo que ya se jugó, no una recomendación. <a href="../metodo.html#previas">Cómo se elige</a>.` }));
  if (tarjeta) o.push(`  <figure class="tarjeta-bot"><img src="${e(tarjeta)}" alt="${e(`Tarjeta de los mejores de la jornada ${J}: ${h.mejores.slice(0, 6).map((x) => `${x.nombre} ${x.pts}`).join(', ')}`)}" width="1080" height="${tarjetaAlto || 875}" loading="lazy" decoding="async"><figcaption>La tarjeta que publicó <a href="https://x.com/Fantasyman_app" rel="noopener">@Fantasyman_app</a> al acabar la jornada.</figcaption></figure>`);

  o.push(bloque('Resultados y MVP de cada partido', `  <ul class="lp">${h.partidos.map((p) => `<li><span class="lp-p">${escudo(p.escL, p.local, 22)}<b>${e(p.local)}</b>${marcador(p)}<b>${e(p.visitante)}</b>${escudo(p.escV, p.visitante, 22)}</span>`
    + `<span class="lp-f">${e(diaCorto(p.t))}, ${e(hora(p.t))}</span>${p.mvp ? `<span class="lp-m">${cara(p.mvp, 'p')}<span>MVP: <b>${enl(p.mvp) ? `<a href="${e(enl(p.mvp))}">${e(p.mvp.nombre)}</a>` : e(p.mvp.nombre)}</b> ${chipPuntos(p.mvp.pts)}</span></span>` : ''}</li>`).join('')}</ul>`,
  { id: 'partidos', linea: J % 3 === 0 ? 'El MVP es el jugador de los dos equipos que más puntos de LaLiga Fantasy sacó en ese partido.' : '' }));

  if (h.doblan.length) o.push(bloque('Los que doblaron su media', tPts(h.doblan, false),
    { id: 'doblan', linea: e(`${h.doblan.length === 1 ? 'Uno sacó' : `${h.doblan.length} sacaron`} el doble de su media o más, con 10 puntos o más${h.doblan[0] ? `; el que más se pasó, ${h.doblan[0].nombre}: ${h.doblan[0].pts} con ${coma(h.doblan[0].media)} de media` : ''}.`) }));
  if (h.peores.length) o.push(bloque('Los peores de la jornada', tPts(h.peores, false),
    { id: 'peores', linea: e(`${h.peores.length === 1 ? 'Uno terminó' : `${h.peores.length} terminaron`} restando puntos.`) }));

  const tE = (xs) => tabla([{ t: 'Equipo', c: 'j' }, { t: 'Pts', c: 'n' }], xs.map((q) => `<td class="c-j"><div class="tjug">${escudo(q.escudoUrl, q.nombre, 28)}<span class="tjug-t"><b>${e(q.nombre)}</b><small>${q.n} con 6 puntos o más</small></span></div></td><td class="n">${q.pts}</td>`));
  o.push(bloque('Los equipos que más puntos dieron', pestanas('equipos', [['Los que más', tE(h.equipos.slice(0, 5))], ['Los que menos', tE(h.equipos.slice(-3).reverse())]]),
    { id: 'equipos', linea: '' }));

  // (sesión 4, idea 7) la semana del mercado antes de la jornada: quién ganó y quién perdió más dinero, y el mejor negocio
  if (semana && semana.ganan.length) o.push(bloqueSemana(h, semana, enl));

  // el texto, abajo: los hechos de esta jornada que se salen de lo normal, con la temporada al lado (sesión 4)
  o.push(bloque(`La jornada ${J}, en corto`, [...analisisResumen(h, temporada), ...(onces ? [onces] : [])].map((p) => `  <p>${e(p)}</p>`).join('\n'), { id: 'analisis', linea: `Puntos oficiales de LaLiga Fantasy, con los de DAZN. <a href="../metodo.html#previas">Cómo hacemos el resumen</a>.` }));
  // (sesión 3) «De dónde salen los datos» y «Con Fantasy Manager», iguales en los 12 resúmenes, ya no van: el método está en metodo.html y la
  // llamada a la app es la corta (paginas.py)
  return o.join('\n');
}

/** /jornada/: la que viene (con su previa), la última jugada (con su resumen) y la lista de las dos cosas */
export function contenidoJornadas({ proxima = null, previas = [], resumenes = [], ultimo = null }) {
  const o = [];
  o.push(`  <h1>Jornadas de <span>LaLiga Fantasy</span></h1>`);
  o.push(`  <p class="fresco">La previa antes de cada jornada y el resumen al acabar · se hacen solas con los datos de LaLiga Fantasy</p>`);
  if (proxima) {
    const pv = previas.find((p) => p.jornada === proxima.jornada);
    o.push(proximaCaja(proxima, { previa: pv ? pv.ruta : null, resumen: null, todas: false }));
    o.push(bloque(`Partidos de la jornada ${proxima.jornada}`, `  <ul class="lp">${proxima.partidos.map((p) => `<li><span class="lp-p">${escudo(p.escL, p.local, 22)}<b>${e(p.local)}</b>${p.estado === 7 ? `<span class="res">${e(String(p.gl))}-${e(String(p.gv))}</span>` : `<span class="res hora"><small>${e(diaCorto(p.t))}</small>${e(hora(p.t))}</span>`}<b>${e(p.visitante)}</b>${escudo(p.escV, p.visitante, 22)}</span>${p.estado === 7 ? `<span class="lp-f">${e(diaCorto(p.t))}, ${e(hora(p.t))}</span>` : ''}</li>`).join('')}</ul>`, { id: 'partidos' }));
  }
  if (ultimo) {
    const a = ultimo.mejores.slice(0, 3);
    o.push(bloque(`La última: jornada ${ultimo.jornada}`, tabla([{ t: 'Jugador', c: 'j' }, { t: 'Pts', c: 'n' }], a.map((x) => `${celdaJug(x)}<td class="n">${chipPuntos(x.pts)}</td>`))
      + `\n  <p><a class="btn sec" href="../jornada/resumen-jornada-${ultimo.jornada}.html">Ver el resumen de la jornada ${ultimo.jornada}</a></p>`, { id: 'ultima' }));
  }
  const filasJ = new Map();
  for (const p of previas) filasJ.set(p.jornada, { ...(filasJ.get(p.jornada) || {}), previa: p });
  for (const r of resumenes) filasJ.set(r.jornada, { ...(filasJ.get(r.jornada) || {}), resumen: r });
  const js = [...filasJ.entries()].sort((a, b) => b[0] - a[0]);
  if (js.length) o.push(bloque('Todas las jornadas', tabla([{ t: 'Jornada' }, { t: 'Previa' }, { t: 'Resumen' }],
    js.map(([n, x]) => `<td><b>Jornada ${n}</b></td><td>${x.previa ? `<a href="../${e(x.previa.ruta)}">Previa</a>` : '—'}</td><td>${x.resumen ? `<a href="../${e(x.resumen.ruta)}">Resumen</a>` : '—'}</td>`), { clase: 'td-js' }), { id: 'todas' }));
  o.push(bloque('Previas y resúmenes', `  <p>Antes de cada jornada, la previa: a qué hora se cierran las cláusulas, quién no juega y quién está a una amarilla. Después, el resumen: los que más puntos sacaron, el once ideal y el MVP de cada partido. Las dos se hacen solas con los datos de LaLiga Fantasy.</p>`, { id: 'analisis' }));
  return o.join('\n');
}
