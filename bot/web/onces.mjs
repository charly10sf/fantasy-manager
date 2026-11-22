// Onces probables con datos propios (sesión 3 de AdSense, idea 12): jornada/onces.html, un apartado en la previa y un bloque en cada ficha
// de equipo. NADA de los onces de otras webs: el % de cada jugador es el de `baseTitular` (tipos/caidas.mjs, el mismo que `M.titularidad`
// de la app sin el once de fuera): partidos de 60 minutos o más en las 5 últimas jornadas (60 %) y en la temporada (40 %), de su ficha de
// LaLiga. Fuera los que LaLiga da lesionados o sancionados; con duda, el % por 0,6 (como la app). Los que vuelven de una lesión salen del
// parte médico (lib/partes.mjs). Una hora antes de cada partido, el once confirmado (el oficial, que el bot ya lee para sus tuits)
// sustituye al probable, y tras la jornada se cuenta el acierto. El texto, con reglas y varias formas de decir cada cosa, sin IA.
// Se guarda en .github/portal/onces.json (lo rehace «Portal web» cada noche; con --onces=1, solo los confirmados).
import { fechaHora, diaCorto, hora } from './vista.mjs';
import { e, escudo, bloque, cara, slug as slugDe } from './portal.mjs';
import { parteDe } from '../lib/partes.mjs';
import { el, del } from '../lib/texto.mjs';

const LINEA = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
const LINEA_TXT = { 1: 'Portero', 2: 'Defensas', 3: 'Centrocampistas', 4: 'Delanteros' };
/** los suplentes que se enseñan debajo del campo: como mucho `n`, con un `min` % de titular */
const SUPLENTES = { n: 8, min: 3 };
/** el color del % de titular, el de la app (`tit-b` en web/js/comunes.js): 75 o más, verde; 45 o más, oro; menos, rojo */
const nivelP = (p) => (p >= 75 ? 'bien' : p >= 45 ? 'duda' : 'mal');
const EN_LINEA = { 1: 'en la portería', 2: 'en la defensa', 3: 'en el centro del campo', 4: 'arriba' };
// las formaciones que se prueban (las mismas que el once posible del bot): se queda la que más % suma
export const FORMACIONES = [[4, 3, 3], [4, 4, 2], [4, 5, 1], [3, 5, 2], [3, 4, 3], [5, 3, 2], [5, 4, 1]];
export const DUDA = { min: 0.3, dif: 0.2 };   // una duda: el último que entra y el primero que se queda fuera, los dos con 30 % o más y a 20 puntos o menos
const TOPE = 0.95;                              // nadie pasa del 95 %: un once probable no es seguro

const huella = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const elige = (semilla, formas) => formas[huella(semilla) % formas.length];
const pctTxt = (p) => `${Math.round(p * 100)} %`;
const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const num = (x) => Number(x) || 0;

/** el % de titular de un jugador de las fichas del portal (H.todos): null si no juega (lesionado, sancionado, fuera de LaLiga) */
export function probTitular(x) {
  if (!x || !(x.pos >= 1 && x.pos <= 4)) return null;
  if (['injured', 'suspended', 'out_of_league'].includes(x.estado)) return null;
  let p = x.b ? x.b.p : x.jugados ? 0.1 : 0.02;
  if (x.estado === 'doubtful') p *= 0.6;
  return Math.max(0, Math.min(TOPE, p));
}

/** el mejor once de una lista de candidatos [{ pos, p, … }] ordenados: { formacion: '4-3-3', once, fuera: { pos: [los siguientes] } } */
// `antes`: [d, m, f] del último once del equipo; si cabe con los que hay, manda (un equipo no cambia de dibujo porque un lateral tenga un 50 %)
export function mejorOnce(cands, antes = null) {
  const por = (p) => cands.filter((x) => x.pos === p);
  const [P, D, M, F] = [1, 2, 3, 4].map(por);
  let mejor = null;
  const valida = antes && antes[0] >= 3 && antes[1] >= 2 && antes[2] >= 1 && antes[0] + antes[1] + antes[2] === 10;
  for (const [d, m, f] of valida ? [antes] : FORMACIONES) {
    if (!P.length || D.length < d || M.length < m || F.length < f) continue;
    const once = [P[0], ...D.slice(0, d), ...M.slice(0, m), ...F.slice(0, f)];
    const suma = once.reduce((s, x) => s + x.p, 0);
    if (!mejor || suma > mejor.suma + 1e-9) mejor = { suma, formacion: `${d}-${m}-${f}`, n: { 1: 1, 2: d, 3: m, 4: f } };
  }
  if (!mejor) return valida ? mejorOnce(cands) : null;
  const once = [], banco = {};
  for (const p of [1, 2, 3, 4]) { const xs = por(p); once.push(...xs.slice(0, mejor.n[p])); banco[p] = xs.slice(mejor.n[p]); }
  return { formacion: mejor.formacion, once, banco };
}

/** los titulares de la última jornada jugada de un equipo, si no hay once confirmado guardado: los once con más minutos */
function titularesPorMinutos(xs, J) {
  return xs.map((x) => ({ x, min: num(((x.jornadas || []).find((r) => r.J === J) || {}).min) })).filter((y) => y.min > 0)
    .sort((a, b) => b.min - a.min).slice(0, 11).map((y) => y.x.id);
}

/**
 * Los onces probables de la jornada `J`. H: lo de bot/web/fichas.mjs (hechosFichas). jugadores: la lista de LaLiga (para casar el parte);
 * partes: lib/partes.mjs (lesionados). previo: el onces.json de antes (de esta jornada, los equipos con el once confirmado no se tocan;
 * de la anterior, su once confirmado es contra lo que se cuentan los cambios).
 */
export function hechosOnces(H, { J, jugadores = [], partes = [], previo = null, ahora = Date.now() } = {}) {
  const raw = new Map(jugadores.map((j) => [String(j.id), j]));
  const mismo = previo && previo.J === J ? previo : null;
  const anterior = previo && previo.J === J - 1 ? previo : null;
  const equipos = [];
  for (const q of H.equipos) {
    const px = (q.proximos || [])[0];
    // ya jugado (o aplazado) en esta jornada: se queda como estaba
    if (!px || px.J !== J) { const y0 = mismo && mismo.equipos.find((y) => y.id === q.id); if (y0) equipos.push(y0); continue; }
    const ya = mismo && mismo.equipos.find((y) => y.id === q.id && y.confirmado);
    if (ya) { equipos.push(ya); continue; }
    const xs = q.jugadores.filter((x) => x.pos >= 1 && x.pos <= 4 && x.estado !== 'out_of_league');
    const ultJ = (q.resultados || []).length ? q.resultados[q.resultados.length - 1].J : null;
    const minUlt = (x) => num(((x.jornadas || []).find((r) => r.J === ultJ) || {}).min);
    const cands = xs.map((x) => ({ x, p: probTitular(x) })).filter((y) => y.p != null && y.p > 0)
      .sort((a, b) => b.p - a.p || minUlt(b.x) - minUlt(a.x) || b.x.valor - a.x.valor)
      .map(({ x, p }) => ({ id: x.id, nombre: String(x.nombre).trim(), pos: x.pos, p, duda: x.estado === 'doubtful', valor: x.valor }));
    // el once de la jornada anterior (el confirmado si lo guardamos; si no, los once con más minutos): sus cambios y su dibujo
    const eqAnt = anterior && anterior.equipos.find((y) => y.id === q.id && y.confirmado);
    const antIds = eqAnt ? eqAnt.confirmado.map((y) => String(y.id)) : ultJ ? titularesPorMinutos(xs, ultJ) : [];
    // el dibujo: el más repetido en las tres últimas jornadas (contando los once con más minutos, o el confirmado) entre los de FORMACIONES;
    // con los puestos de LaLiga, un once de minutos da a veces un 6-2-2 o un 3-3-4: esos no cuentan
    const posDe = (id) => { const x = q.jugadores.find((y) => y.id === id); return x ? x.pos : null; };
    const dibujoDe = (ids) => { const c = (p) => ids.filter((id) => posDe(id) === p).length; const d = [c(2), c(3), c(4)]; return ids.length === 11 && c(1) === 1 && FORMACIONES.some((f) => f.join() === d.join()) ? d : null; };
    const ultimas = (q.resultados || []).slice(-3).reverse().map((r) => (eqAnt && r.J === anterior.J ? eqAnt.confirmado.map((y) => String(y.id)) : titularesPorMinutos(xs, r.J)));
    const cuentaD = {};
    ultimas.map(dibujoDe).filter(Boolean).forEach((d, i) => { const k = d.join('-'); cuentaD[k] = (cuentaD[k] || 0) + 3 - i * 0.5; });
    const top = Object.entries(cuentaD).sort((a, b) => b[1] - a[1])[0];
    const dibujo = top ? top[0].split('-').map(Number) : null;
    const m = mejorOnce(cands, dibujo);
    if (!m) continue;
    const enOnce = new Set(m.once.map((x) => x.id));
    // las dudas: en cada línea, el último que entra frente al primero que se queda fuera
    const dudas = [];
    for (const p of [1, 2, 3, 4]) {
      const dentro = m.once.filter((x) => x.pos === p), a = dentro[dentro.length - 1], b = (m.banco[p] || [])[0];
      if (a && b && b.p >= DUDA.min && a.p - b.p <= DUDA.dif) dudas.push({ linea: p, a: { id: a.id, nombre: a.nombre, p: a.p }, b: { id: b.id, nombre: b.nombre, p: b.p }, pa: Math.round((100 * a.p) / (a.p + b.p)) });
    }
    // fuera: los lesionados y sancionados que pesan (titulares la mitad de las veces o más, o 8 M o más), con el parte si hay
    const fuera = q.jugadores.filter((x) => ['injured', 'suspended'].includes(x.estado) && ((x.b && x.b.p >= 0.5) || x.valor >= 8e6)).sort((a, b) => b.valor - a.valor)
      .map((x) => { const pt = raw.has(x.id) ? parteDe(raw.get(x.id), partes) : null; return { id: x.id, nombre: x.nombre, estado: x.estado === 'suspended' ? 'sancionado' : 'lesionado', ...(pt && pt.lesion ? { lesion: pt.lesion } : {}), ...(pt && pt.hasta ? { hasta: pt.hasta } : {}) }; });
    // vuelven: el parte los da disponibles tras 10 días o más fuera y LaLiga ya no los tiene de baja
    const vuelven = [];
    for (const x of xs) {
      if (x.estado === 'injured' || x.estado === 'suspended' || !raw.has(x.id)) continue;
      const pt = parteDe(raw.get(x.id), partes);
      if (!pt || pt.estado !== 'disponible' || num(pt.dias) < 10 || (pt.jornada && pt.jornada !== J)) continue;
      vuelven.push({ id: x.id, nombre: x.nombre, dias: num(pt.dias), lesion: pt.lesion || null, antes: x.b ? Math.round(x.b.b * 100) : null, p: probTitular(x) });
    }
    // los cambios frente a la jornada anterior
    const nuevos = new Set(m.once.map((x) => x.id)), viejos = new Set(antIds);
    const porQue = (id) => { const x = q.jugadores.find((y) => y.id === id); return !x ? 'ya no está' : x.estado === 'injured' ? 'lesionado' : x.estado === 'suspended' ? 'sancionado' : x.estado === 'doubtful' ? 'duda' : null; };
    const cambios = antIds.length >= 10 ? {
      entran: m.once.filter((x) => !viejos.has(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, pos: x.pos })),
      salen: antIds.filter((id) => !nuevos.has(id)).map((id) => { const x = q.jugadores.find((y) => y.id === id); return x ? { id, nombre: x.nombre, pos: x.pos, por: porQue(id) } : null; }).filter(Boolean),
    } : null;
    equipos.push({ id: q.id, nombre: q.nombre, slug: q.slug || slugDe(q.nombre), escudoUrl: q.escudoUrl || null, rival: px.rival, rivalId: px.rivalId, casa: px.casa, t: px.t,
      formacion: m.formacion, once: m.once.map((x) => ({ id: x.id, nombre: x.nombre, pos: x.pos, p: Math.round(x.p * 100), ...(x.duda ? { duda: true } : {}) })),
      // (22 nov, Carlos: «en su lugar pon los suplentes y su porcentaje») los que se quedan fuera del once, por % de titular
      suplentes: cands.filter((x) => !enOnce.has(x.id) && Math.round(x.p * 100) >= SUPLENTES.min).slice(0, SUPLENTES.n).map((x) => ({ id: x.id, nombre: x.nombre, pos: x.pos, p: Math.round(x.p * 100), ...(x.duda ? { duda: true } : {}) })),
      dudas: dudas.map((d) => ({ ...d, a: { ...d.a, p: Math.round(d.a.p * 100) }, b: { ...d.b, p: Math.round(d.b.p * 100) } })),
      fuera: fuera.slice(0, 6), vuelven: vuelven.map((v) => ({ ...v, p: v.p != null ? Math.round(v.p * 100) : null })),
      anterior: antIds.length ? { J: ultJ, fuente: eqAnt ? 'confirmado' : 'minutos' } : null, cambios, confirmado: null });
  }
  equipos.sort((a, b) => a.t - b.t || (a.casa === b.casa ? 0 : a.casa ? -1 : 1));
  const acierto = previo ? aciertoDe(previo) : null;
  return { J, generada: ahora, equipos, ...(anterior && acierto ? { aciertoAnterior: { J: anterior.J, ...acierto } } : mismo && mismo.aciertoAnterior ? { aciertoAnterior: mismo.aciertoAnterior } : {}) };
}

/** el acierto de unos onces con los confirmados que haya: { n, ok, equipos } (null si no hay ninguno confirmado) */
export function aciertoDe(o) {
  const xs = ((o && o.equipos) || []).filter((y) => y.confirmado && y.probable);
  if (!xs.length) return null;
  let n = 0, ok = 0;
  for (const y of xs) { const c = new Set(y.confirmado.map((z) => String(z.id))); n += c.size; ok += y.probable.filter((id) => c.has(String(id))).length; }
  return { n, ok, equipos: xs.length };
}

/**
 * Pone el once confirmado de un equipo: guarda el probable de ese momento (para el acierto) y deja de tocarlo. confirmado: [{ id, nombre, pos }].
 * Devuelve true si ha cambiado algo.
 */
export function confirmar(o, teamId, confirmado) {
  const y = o.equipos.find((q) => q.id === String(teamId));
  if (!y || y.confirmado || !confirmado || confirmado.length !== 11) return false;
  y.probable = y.once.map((x) => x.id);
  const P = { POR: 1, DEF: 2, MED: 3, DEL: 4 };
  y.confirmado = confirmado.map((x) => ({ id: x.id ? String(x.id) : null, nombre: x.nombre, pos: P[x.pos] || Number(x.pos) || 3 }));
  return true;
}

// ------------------------------------------------------------------------------------------------ el texto, con reglas

const nombreDe = (x, ruta) => { const r = ruta && x.id ? ruta(x.id) : null; return r ? `<a href="${e(r)}">${e(x.nombre)}</a>` : e(x.nombre); };

/** lo que se dice de un equipo: las dudas y los cambios frente a la jornada anterior (solo eso), en frases que cambian según el caso */
export function textoEquipo(y, J) {
  const k = `${y.id}|${J}`;
  const f = [];
  if (y.confirmado) {
    const c = new Set(y.confirmado.map((z) => String(z.id)));
    const ok = (y.probable || []).filter((id) => c.has(String(id))).length;
    const fallan = (y.probable || []).filter((id) => !c.has(String(id))).map((id) => (y.once.find((x) => x.id === id) || {}).nombre).filter(Boolean);
    const sorpresa = y.confirmado.filter((z) => z.id && !(y.probable || []).includes(String(z.id))).map((z) => z.nombre);
    if (ok === 11) f.push(elige(`${k}|c11`, ['Once confirmado: es el que dábamos, los once.', 'Salen los once que dábamos como probables.', 'Pleno: el once oficial es el probable.']));
    else f.push(`${elige(`${k}|cok`, ['Once confirmado. Acertamos', 'Ya es oficial: de nuestro probable entran', 'El once oficial deja'])} ${ok} de 11${sorpresa.length ? `: juegan ${lista(sorpresa)}` : ''}${fallan.length ? ` y se quedan fuera ${lista(fallan)}` : ''}.`);
    return f;
  }
  for (const d of y.dudas) {
    const par = `${d.a.nombre} o ${d.b.nombre}`;
    const reparto = `${d.pa}/${100 - d.pa}`;
    f.push(Math.abs(d.pa - 50) <= 3
      ? elige(`${k}|d${d.linea}`, [`${EN_LINEA[d.linea].charAt(0).toUpperCase() + EN_LINEA[d.linea].slice(1)}, ${par}: casi a la par (${reparto}).`, `Está muy igualado ${EN_LINEA[d.linea]} entre ${par} (${reparto}).`])
      : elige(`${k}|d${d.linea}`, [`La duda está ${EN_LINEA[d.linea]}: ${par}, ${reparto}.`, `${EN_LINEA[d.linea].charAt(0).toUpperCase() + EN_LINEA[d.linea].slice(1)} no está claro: ${par} (${reparto}).`, `Entre ${par} ${EN_LINEA[d.linea]} va ${reparto}.`]));
  }
  const conDuda = y.once.filter((x) => x.duda).map((x) => x.nombre);
  if (conDuda.length) f.push(elige(`${k}|dl`, [`${lista(conDuda)} ${conDuda.length > 1 ? 'entran' : 'entra'} aunque LaLiga ${conDuda.length > 1 ? 'los' : 'lo'} da en duda, y por eso ${conDuda.length > 1 ? 'su %' : 'su %'} es más bajo.`, `LaLiga tiene en duda a ${lista(conDuda)}: ${conDuda.length > 1 ? 'están' : 'está'} en el once con menos % del que tendría${conDuda.length > 1 ? 'n' : ''}.`]));
  const c = y.cambios;
  if (c && (c.entran.length || c.salen.length)) {
    const ant = y.anterior ? `la jornada ${y.anterior.J}` : 'la jornada anterior';
    const conMotivo = c.salen.filter((x) => x.por && x.por !== 'duda');
    const sinMotivo = c.salen.filter((x) => !x.por || x.por === 'duda');
    if (conMotivo.length) {
      const grupos = ['lesionado', 'sancionado', 'ya no está'].map((p) => [p, conMotivo.filter((x) => x.por === p).map((x) => x.nombre)]).filter(([, xs]) => xs.length);
      const motivos = grupos.map(([p, xs]) => `${lista(xs)} (${p === 'ya no está' ? 'ya no está en el equipo' : xs.length > 1 ? `${p}s` : p})`);
      const pl = conMotivo.length > 1;
      f.push(elige(`${k}|cm`, [`Respecto a ${ant} ${pl ? 'se caen' : 'se cae'} ${lista(motivos)}.`, `De ${ant} no ${pl ? 'repiten' : 'repite'} ${lista(motivos)}.`, `Frente a ${ant}, ${pl ? 'faltan' : 'falta'} ${lista(motivos)}.`]));
    }
    if (c.entran.length) {
      const ent = lista(c.entran.map((x) => x.nombre));
      f.push(c.entran.length === 1
        ? elige(`${k}|ce`, conMotivo.length ? [`Entraría ${ent}.`, `Su sitio lo ocuparía ${ent}.`, `${ent} sería el cambio.`] : [`Entraría ${ent}.`, `${ent} sería el cambio.`, `El cambio, ${ent}.`])
        : elige(`${k}|ce`, [`Entrarían ${ent}.`, `Los que entran: ${ent}.`, `Con ${ent} dentro.`]));
    }
    if (sinMotivo.length) f.push(elige(`${k}|cs`, [`${lista(sinMotivo.map((x) => x.nombre))} ${sinMotivo.length > 1 ? 'jugaron' : 'jugó'} en ${ant}, pero por minutos ${sinMotivo.length > 1 ? 'se quedan' : 'se queda'} fuera del probable.`, `Por lo que ha jugado en las últimas jornadas, ${lista(sinMotivo.map((x) => x.nombre))} ${sinMotivo.length > 1 ? 'pierden' : 'pierde'} el sitio que ${sinMotivo.length > 1 ? 'tuvieron' : 'tuvo'} en ${ant}.`]));
  } else if (c && !y.dudas.length && !conDuda.length) {
    const ant = y.anterior ? `la jornada ${y.anterior.J}` : 'la jornada anterior';
    f.push(elige(`${k}|igual`, [`Repetiría el once de ${ant}.`, `Sin dudas ni cambios: el mismo once que en ${ant}.`, `Nada que cambie: los once de ${ant}.`]));
  }
  for (const v of y.vuelven) f.push(elige(`${k}|v${v.id}`, [`${v.nombre} vuelve tras ${v.dias} días fuera${v.lesion ? ` (${v.lesion.toLowerCase()})` : ''}${v.antes != null ? `; antes era titular en el ${v.antes} % de los partidos, pero las cinco últimas pesan más y su % aún es bajo` : ''}.`,
    `Recupera a ${v.nombre}, que llevaba ${v.dias} días sin poder jugar${v.lesion ? ` por ${v.lesion.toLowerCase()}` : ''}: en las cuentas todavía no entra fijo.`]));
  return f.map((x) => x.replace(/\.\.$/, '.').replace(/\s{2,}/g, ' ').replace(/ ([,.:)])/g, '$1'));
}

/**
 * El once en su campo (rework de la web; Carlos, 21 nov: «que salga en alineación, no en una lista con letras»): los delanteros
 * arriba y el portero abajo, cada uno con su nombre (enlazado a su ficha) y su % de titular; el que LaLiga da en duda, marcado.
 * Con `jug(id)` va la cara de cada uno y el % debajo (Carlos, 22 nov: «la cara de los jugadores siempre encima del porcentaje»):
 * en la ficha de un equipo y, desde entonces, también en jornada/onces.html (las fotos son `loading="lazy"`: con JS solo se piden
 * las que se ven). De quien no hay cara (o sin `jug`), un círculo con el % dentro.
 */
function campoOnce(xs, { ruta = null, conP = true, jug = null, formacion = '' } = {}) {
  const uno = (x) => {
    const p = conP && x.p != null ? x.p : null;
    const j = jug ? jug(x.id) : null;
    const arriba = j && j.caraUrl ? cara({ nombre: x.nombre, ...j, escudoUrl: null, pos: x.pos }, 'm') : `<i class="oj-c${p != null ? ` ${nivelP(p)}` : ''}">${p != null ? `${p}<small> %</small>` : e(String(x.nombre || '?').trim().charAt(0).toUpperCase())}</i>`;
    const abajo = [j && j.caraUrl && p != null ? `<span class="tp ${nivelP(p)}">${p} %</span>` : '', x.duda ? '<span class="oj-d">duda</span>' : ''].join('');
    return `<div class="cj oj${x.duda ? ' oj-duda' : ''}">${arriba}<b>${nombreDe(x, ruta)}</b>${abajo ? `<span>${abajo}</span>` : ''}</div>`;
  };
  const lineas = [4, 3, 2, 1].map((p) => xs.filter((x) => x.pos === p)).filter((l) => l.length);
  const leer = [1, 2, 3, 4].map((p) => { const ys = xs.filter((x) => x.pos === p); return ys.length ? `${LINEA_TXT[p].toLowerCase()}: ${ys.map((x) => x.nombre).join(', ')}` : ''; }).filter(Boolean).join('; ');
  return `  <div class="campo campo-o" role="group" aria-label="${e(`Once${formacion ? ` ${formacion}` : ''}, ${leer}`)}">${formacion ? `<span class="campo-f">${e(formacion)}</span>` : ''}${lineas.map((l) => `<div class="cl">${l.map(uno).join('')}</div>`).join('')}</div>`;
}

/**
 * Debajo del campo, los suplentes con su % de titular (Carlos, 22 nov), del más probable al menos y con el color de la app. Con
 * `jug(id)`, con su cara encima; sin él, solo el nombre y el %. Con el once confirmado no salen: el % era el de antes de saberse.
 */
function banquillo(xs, { ruta = null, jug = null } = {}) {
  if (!xs || !xs.length) return '';
  const uno = (x) => {
    const j = jug ? jug(x.id) : null;
    return `<div class="bj">${j && j.caraUrl ? cara({ nombre: x.nombre, ...j, escudoUrl: null, pos: x.pos }, 'p') : ''}<b>${nombreDe(x, ruta)}</b><span class="tp ${nivelP(x.p)}">${x.p} %</span></div>`;
  };
  return `\n  <div class="banq${jug ? ' banq-c' : ''}" role="group" aria-label="Suplentes"><p class="banq-t">Suplentes</p><div class="banq-l">${xs.map(uno).join('')}</div></div>`;
}

/** el once de un equipo en HTML: el campo, el texto y quién no está */
function bloqueEquipo(y, J, { ruta = null, rutaEquipo = null, nivel = 'h3', jug = null } = {}) {
  const o = [];
  const tit = `${escudo(y.escudoUrl, y.nombre, 28)} ${rutaEquipo && rutaEquipo(y.id) ? `<a href="${e(rutaEquipo(y.id))}">${e(y.nombre)}</a>` : e(y.nombre)}`;
  o.push(`  <${nivel} id="${e(y.slug)}">${tit}</${nivel}>`);
  const conf = y.confirmado;
  o.push(`  <p class="peq">${conf ? 'Once confirmado' : `Probable, ${e(y.formacion)}`} · ${y.casa ? 'en casa contra' : 'fuera, contra'} ${e(el(y.rival))}</p>`);
  o.push(conf ? campoOnce(conf.map((z) => ({ ...z, p: null })), { ruta, conP: false, jug }) : campoOnce(y.once, { ruta, jug, formacion: y.formacion }) + banquillo(y.suplentes, { ruta, jug }));
  const t = textoEquipo(y, J);
  if (t.length) o.push(`  <p>${e(t.join(' '))}</p>`);
  if (!conf && y.fuera.length) o.push(`  <p class="peq">No juegan: ${y.fuera.map((x) => `${nombreDe(x, ruta)} (${e(x.estado)}${x.lesion ? `, ${e(x.lesion.toLowerCase())}` : ''})`).join(', ')}.</p>`);
  return o.join('\n');
}

/** jornada/onces.html */
export function contenidoOnces(o, { rutas = null, previa = null, aciertos = {}, jugadores = null } = {}) {
  // las caras: de la lista de jugadores de LaLiga (la misma `image` que usan las fichas)
  const caras = jugadores ? new Map(jugadores.map((j) => [String(j.id), j.image || null])) : null;
  const jug = caras ? (id) => (caras.get(String(id)) ? { caraUrl: caras.get(String(id)) } : null) : null;
  const J = o.J;
  const ruta = rutas ? (id) => (rutas.jugador(id) ? `../${rutas.jugador(id)}` : null) : null;
  const rutaEquipo = rutas ? (id) => (rutas.equipo(id) ? `../${rutas.equipo(id)}` : null) : null;
  const out = [];
  out.push(`  <h1>Onces probables de la jornada ${J} de <span>LaLiga Fantasy</span></h1>`);
  const nConf = o.equipos.filter((y) => y.confirmado).length;
  out.push(`  <p class="fresco">Datos del ${e(fechaHora(o.generada))} · se rehacen cada noche y, una hora antes de cada partido, el once confirmado sustituye al probable${nConf ? ` · ${nConf} de ${o.equipos.length} ya confirmados` : ''}</p>`);
  // la entrada: cuántas dudas, dónde, y el acierto de la jornada anterior
  const dudas = o.equipos.flatMap((y) => (y.confirmado ? [] : y.dudas.map((d) => ({ ...d, eq: y.nombre }))));
  const conMasDudas = o.equipos.filter((y) => !y.confirmado && y.dudas.length >= 2).map((y) => y.nombre);
  const ent = [];
  ent.push(`Para cada equipo, los once con más papeletas y el porcentaje de cada uno, sacado de los minutos que ha jugado: pesan más las cinco últimas jornadas que el resto de la temporada. Los que LaLiga da lesionados o sancionados no entran.`);
  const top = conMasDudas.slice(0, 3);
  if (dudas.length) ent.push(elige(`o${J}|n`, [`Esta semana hay ${dudas.length} ${dudas.length === 1 ? 'puesto en duda' : 'puestos en duda'}${top.length ? `, y ${top.length === 1 ? `${el(top[0])} es el que más tiene` : `${lista(top.map(el))} tienen dos o más`}` : ''}.`, `Quedan ${dudas.length} ${dudas.length === 1 ? 'duda' : 'dudas'} por resolver${top.length ? `, ${top.length === 1 ? `casi todas ${del(top[0])}` : `sobre todo en ${lista(top.map(el))}`}` : ''}.`]));
  const ac = o.aciertoAnterior || (aciertos[J - 1] ? { J: J - 1, ...aciertos[J - 1] } : null);
  if (ac && ac.n) ent.push(`En la jornada ${ac.J} acertamos ${ac.ok} de ${ac.n} titulares (${Math.round((100 * ac.ok) / ac.n)} %)${ac.equipos < 20 ? `, contando los ${ac.equipos} equipos de los que tenemos el once oficial` : ''}.`);
  out.push(`  <p class="lead">${e(ent.join(' '))}</p>`);
  // índice de equipos
  out.push(`  <nav class="subnav" aria-label="Equipos">${o.equipos.map((y) => `<a href="#${e(y.slug)}">${e(y.nombre)}</a>`).join('')}</nav>`);
  // por partido, en el orden en que se juegan
  const vistos = new Set();
  for (const y of o.equipos) {
    if (vistos.has(y.id)) continue;
    const z = o.equipos.find((w) => w.id === y.rivalId);
    const [L, V] = y.casa || !z ? [y, z] : [z, y];
    vistos.add(y.id); if (z) vistos.add(z.id);
    const cuerpo = [L, V].filter(Boolean).map((q) => bloqueEquipo(q, J, { ruta, rutaEquipo, jug })).join('\n');
    out.push(bloque(`${L.nombre}-${V ? V.nombre : L.rival}`, `  <p class="peq">${e(diaCorto(y.t))}, ${e(hora(y.t))}</p>\n${cuerpo}`, { id: `p-${L.slug}` }));
  }
  out.push(`\n  <p class="peq">El porcentaje y cómo elegimos la formación, en <a href="../metodo.html#onces">el método</a>. ${previa ? `Cláusulas, chollos y bajas de esta jornada, en <a href="../${e(previa)}">la previa</a>; ` : ''}las bajas de todos, con su parte, en <a href="../bajas/">las bajas de la jornada</a>.</p>`);
  return out.join('\n');
}

export const metasOnces = (J) => ({ ruta: 'jornada/onces.html', seccion: 'jornada', grupo: 'onces',
  titulo: `Onces probables de la jornada ${J} de LaLiga Fantasy`, h1: `Onces probables de la jornada ${J}`, corto: 'Onces probables',
  descripcion: `Los onces probables de los 20 equipos para la jornada ${J} de LaLiga Fantasy, con el % de cada jugador, las dudas y quién vuelve. Una hora antes de cada partido, el once confirmado.` });

/**
 * El bloque de la ficha de un equipo (bot/web/fichas.mjs): el once en su campo con las caras y, debajo, los suplentes con su %.
 * Sin texto (Carlos, 22 nov: «me sobra TODO ese texto de abajo. En su lugar pon los suplentes y su porcentaje»): las dudas, los
 * cambios y quién vuelve se siguen contando en jornada/onces.html.
 */
export function bloqueFicha(y, J, { ruta = null, jug = null } = {}) {
  if (!y) return '';
  const cuerpo = y.confirmado ? campoOnce(y.confirmado, { ruta, conP: false, jug }) : campoOnce(y.once, { ruta, jug, formacion: y.formacion }) + banquillo(y.suplentes, { ruta, jug });
  return bloque(y.confirmado ? `El once confirmado de la jornada ${J}` : `El once probable para la jornada ${J}`, cuerpo, { id: 'once' });
}

/** lo que va en la previa: el enlace y las dudas que más pesan (por valor) */
export function apartadoPrevia(o, J) {
  const out = [`\n  <h2 id="onces">Onces probables</h2>`];
  if (!o || o.J !== J || !o.equipos.length) {
    out.push(`  <p>Los once de cada equipo con el % de cada jugador están en <a href="../jornada/onces.html">los onces probables de la jornada</a>, que se rehacen cada noche.</p>`);
    return out.join('\n');
  }
  const dudas = o.equipos.flatMap((y) => y.dudas.map((d) => ({ ...d, eq: y.nombre }))).slice(0, 40)
    .sort((a, b) => Math.abs(a.pa - 50) - Math.abs(b.pa - 50)).slice(0, 4);
  const fijos = o.equipos.filter((y) => !y.dudas.length && !(y.cambios && (y.cambios.entran.length))).map((y) => y.nombre);
  const fr = [];
  fr.push(`Los onces de los 20 equipos, con el % de cada jugador, están en <a href="../jornada/onces.html">los onces probables de la jornada ${J}</a>: se rehacen cada noche y, una hora antes de cada partido, pasan al once confirmado.`);
  if (dudas.length) fr.push(e(`Las dudas más igualadas ahora mismo: ${lista(dudas.map((d) => `${d.a.nombre} o ${d.b.nombre} ${del(d.eq)} (${d.pa}/${100 - d.pa})`))}.`));
  if (fijos.length >= 3) fr.push(e(`Sin dudas ni cambios respecto a la jornada anterior: ${lista(fijos.slice(0, 6))}${fijos.length > 6 ? ` y ${fijos.length - 6} más` : ''}.`));
  out.push(`  <p>${fr.join(' ')}</p>`);
  return out.join('\n');
}

/** el acierto en el resumen de la jornada: una frase (o '') */
export function lineaResumen(a, J) {
  if (!a || !a.n) return '';
  return `Los onces probables de la jornada ${J}: de ${a.n} titulares, acertamos ${a.ok} (${Math.round((100 * a.ok) / a.n)} %)${a.equipos < 20 ? `, en los ${a.equipos} equipos con el once oficial guardado` : ''}.`;
}
