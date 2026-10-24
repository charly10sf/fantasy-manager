/* Equipo → Jornadas: el once que pusiste en cada jornada, de la 1 a la que se juega (o la próxima), con lo que sumó
   cada uno, como en la app oficial. Los onces salen de LaLiga (/teams/{id}/lineup/week/{n}; el de la próxima, de
   /teams/{id}/lineup) y los puntos de cada jugador, de sus puntos por jornada (weekPoints); los de la jornada en
   juego, de vivo.js. app.js los pide (cargarJornadaMia) y los guarda: los de las jornadas acabadas ya no cambian. */
import { esc, cuando, horaDe } from './util.js';
import { cromo, nada } from './comunes.js';

/** las jornadas que se pueden ver: las que ya han empezado y, si no hay ninguna en juego, la próxima */
export function jornadasVisibles(M) {
  const ahora = Date.now();
  const l = (M.jornadas || []).filter((j) => j.ini && j.ini <= ahora);
  if (!M.enJuego && M.proxima) l.push(M.proxima);
  return l.sort((a, b) => a.n - b.n);
}
/** la que se enseña: la elegida o, si no, la que se juega, la última empezada o la próxima */
export function jornadaElegida(S) {
  const l = jornadasVisibles(S.M);
  if (S.jornadaSel && l.some((j) => j.n === S.jornadaSel)) return S.jornadaSel;
  if (S.M.enJuego) return S.M.enJuego.n;
  const emp = l.filter((j) => j.ini <= Date.now());
  return emp.length ? emp[emp.length - 1].n : l.length ? l[l.length - 1].n : null;
}
/** en qué está una jornada: 'vivo', 'acabada' o 'proxima' */
export function estadoJornada(M, n) {
  if (M.enJuego && M.enJuego.n === n) return 'vivo';
  const j = (M.jornadas || []).find((x) => x.n === n);
  return j && j.ini > Date.now() ? 'proxima' : 'acabada';
}

const ptsDe = (j, n) => { const w = (j.semanas || []).find((x) => x.n === n); return w ? w.pts : null; };
const clsPts = (v) => (v == null ? 'cero' : v > 0 ? 'sube' : v < 0 ? 'baja' : 'cero');

export function jornadasHTML(S) {
  const { M, D } = S;
  const lista = jornadasVisibles(M);
  if (!lista.length) return nada('Aún no ha empezado ninguna jornada.');
  const n = jornadaElegida(S);
  const est = estadoJornada(M, n);
  const J = lista.find((j) => j.n === n);
  let h = `<div class="jor-chips" role="tablist" aria-label="Jornadas">${[...lista].reverse().map((j) => {
    const e = estadoJornada(M, j.n);
    return `<button data-accion="verJornada" data-n="${j.n}" role="tab" aria-selected="${j.n === n}" class="${j.n === n ? 'activo' : ''}">${e === 'vivo' ? '<i class="vivo-dot"></i>' : ''}J${j.n}${e === 'proxima' ? '<small>próx.</small>' : ''}</button>`;
  }).join('')}</div>`;

  const g = S.misJ && S.misJ[n];
  const tid = M.yo ? String(M.yo.teamId) : '';
  const js = g && g.ids ? g.ids.map((pid) => D.maestro[pid] || M.J(pid)).filter((j) => j && j.pos) : [];
  const campo = js.filter((j) => j.pos < 5);
  // lo que sumó: la suma de los suyos; si LaLiga da los de cada equipo en esa jornada y cuadran, esos (y el puesto)
  const puntosDe = (j) => (est === 'vivo' ? (M.puntosVivo ? M.puntosVivo(j.id) : null) : est === 'acabada' ? ptsDe(j, n) : null);
  const suma = campo.reduce((t, j) => t + (puntosDe(j) || 0), 0);
  let total = null, puesto = null, deN = null;
  if (est === 'vivo' && M.vivo && M.vivo.equipos && M.vivo.equipos[tid] != null) {
    total = M.vivo.equipos[tid];
    const vals = Object.values(M.vivo.equipos);
    puesto = vals.filter((v) => v > total).length + 1; deN = vals.length;
  } else if (est === 'acabada' && S.ptsJ && S.ptsJ[n] && S.ptsJ[n][tid] != null && (!campo.length || Math.abs(S.ptsJ[n][tid] - suma) <= 30)) {
    total = S.ptsJ[n][tid];
    const vals = Object.values(S.ptsJ[n]);
    puesto = vals.filter((v) => v > total).length + 1; deN = vals.length;
  } else if (campo.length && est !== 'proxima') total = suma;

  const forma = g && g.forma && [1, 2, 3].every((i) => campo.filter((j) => j.pos === i + 1).length <= g.forma[i - 1]) ? g.forma : [2, 3, 4].map((p) => campo.filter((j) => j.pos === p).length);
  const sub = est === 'vivo' ? '<span class="vivo-dot"></span>en juego' : est === 'proxima' ? `empieza ${esc(cuando(J.ini))}` : 'acabada';
  h += `<div class="jor-cab"><div><b>Jornada ${n}</b><span>${sub}${campo.length ? ` · ${forma.join('-')}` : ''}</span></div>
    ${total != null ? `<div class="jor-pts"><b>${total}</b><small>pts</small>${puesto ? `<span>${puesto}º de ${deN} en la jornada</span>` : ''}</div>` : ''}</div>`;

  if (!g || (S.cargandoJ && S.cargandoJ[n] && !g.ids)) return h + `<p class="t2 peq">Mirando en LaLiga tu once de la jornada ${n}…</p>`;
  if (!g.ids) return h + nada(g.error ? `No se ha podido leer tu once de la jornada ${n}: ${esc(g.error)}` : `LaLiga no tiene tu once de la jornada ${n}: puede que aún no estuvieras en la liga o que no llegaras a poner equipo.`);

  // cada uno con su rival de esa jornada arriba y, debajo, lo que sumó (o la hora de su partido, si aún no ha jugado)
  const partidoDe = (j) => (D.partidos || []).find((p) => p.jornada === n && (p.localId === j.equipoId || p.visitanteId === j.equipoId));
  const crom = (j) => {
    const p = partidoDe(j);
    const casa = p && p.localId === j.equipoId;
    const rid = p ? (casa ? p.visitanteId : p.localId) : null;
    const tag = { txt: rid ? `${casa ? '' : '@'}${((D.equipos || {})[rid] || {}).corto || ''}` : '' };
    const v = puntosDe(j);
    const empezo = p && p.fecha && p.fecha <= Date.now();
    const dato = est === 'proxima' || (est === 'vivo' && v == null && !empezo)
      ? { txt: p && p.fecha ? cuando(p.fecha).replace(/^hoy /, '').replace(/^mañana /, 'mañ. ').replace(/^(\S+) \d+, /, '$1 ') : '–', cls: 'hora' }
      : { txt: v == null ? '–' : `${v} pts`, cls: `vivo-p ${clsPts(v)}` };
    return cromo(M, j, { tag, marca: est === 'proxima' ? null : '', datoFijo: dato });
  };
  const hueco = '<span class="cromo vacio-c sin-poner"><span class="cr-hueco">–</span><span class="cr-nom">Sin poner</span></span>';
  const lineas = [1, 2, 3, 4].map((p) => campo.filter((j) => j.pos === p));
  const filas = [3, 2, 1, 0].map((i) => {
    const k = i === 0 ? 1 : forma[i - 1] || 0;
    const xs = lineas[i].slice(0, Math.max(k, lineas[i].length));
    const celdas = xs.map(crom);
    while (celdas.length < k) celdas.push(hueco);
    return celdas.length ? `<div class="linea-c${celdas.length >= 5 ? ' cinco' : ''}">${celdas.join('')}</div>` : '';
  });
  const ent = js.find((j) => j.pos === 5);
  h += `<div class="cancha"><i class="l-borde"></i><i class="l-medio"></i><i class="l-circ"></i><i class="l-area arriba"></i><i class="l-area abajo"></i>
    ${filas.join('')}${ent ? `<div class="cr-ent">${cromo(M, ent, { chico: true, ent: true, tag: { txt: '' }, marca: '', datoFijo: { txt: 'ENT', cls: '' } })}</div>` : ''}</div>`;
  const faltan = 11 - campo.length;
  const notas = [];
  if (faltan > 0) notas.push(`<b class="rojo">${est === 'acabada' ? `Jugaste con ${campo.length}` : `Tienes ${campo.length} en el once`}: ${faltan > 1 ? `los ${faltan} huecos no puntúan` : 'el hueco no puntúa'}.</b>`);
  if (est === 'acabada' && total != null && !puesto) notas.push('La suma de lo que hizo cada uno; LaLiga no da los puntos de cada equipo en esa jornada.');
  if (est === 'proxima') notas.push('El once que tienes puesto ahora en LaLiga. Debajo de cada uno, cuándo juega.');
  if (est === 'vivo') notas.push(`Se pone al día solo mientras se juega${M.vivo && M.vivo.t ? ` (lo último, a las ${horaDe(M.vivo.t)})` : ''}.`);
  if (notas.length) h += `<p class="t2 peq">${notas.join('<br>')}</p>`;
  return h;
}
