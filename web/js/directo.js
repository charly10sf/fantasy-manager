/* La pestaña Directo: la jornada mientras se juega. Los partidos con su marcador y por dónde van, los puntos de cada
   jugador (y de quién es en tu liga), tu once de LaLiga con lo que lleva cada uno y cómo va tu liga en la jornada.
   Sin jornada en juego: cuándo empieza la próxima y cómo acabó la última.
   Los datos salen de vivo.js (LaLiga Fantasy) y, si SofaScore deja, las jugadas de cada partido (externas.js). */
import { esc, icono, cuando, rel, dura, MIN, HORA, horaDe, norm } from './util.js';
import { ava, posTag, nada, campoVivo, filaJugador, cromo, caraManager } from './comunes.js';
import { ancho, cols, tabs, puntosUltimaJornada } from './vistas.js';
import { EVENTOS } from './vivo.js';

const est = (x) => { if (x == null || x === '') return null; const v = Number(x); return Number.isFinite(v) ? v : null; };
const enJuego = (p) => p.st != null && p.st >= 2 && p.st < 7;
/** ¿ha empezado? (por el estado que da LaLiga o, si no lo da, por la hora) */
const empezo = (p, ahora = Date.now()) => (p.st != null ? p.st >= 2 : !!(p.fecha && p.fecha <= ahora));
const acabado = (p, ahora = Date.now()) => p.st === 7 || (p.st == null && p.gl != null && p.fecha && ahora - p.fecha > 2 * HORA);
const ptsCls = (v) => (v == null ? '' : v > 0 ? 'sube' : v < 0 ? 'baja' : 'cero');
const eqDe = (D, id) => (D.equipos && D.equipos[id]) || {};
export const escudo = (D, id, cls = '') => { const e = eqDe(D, id); return e.escudo ? `<img class="pt-esc ${cls}" src="${esc(e.escudo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="pt-esc ${cls} sin"></span>`; };
const nombreEq = (D, id) => eqDe(D, id).nombre || '¿?';

/** un partido del calendario (datos.js) con la misma forma que los de vivo.js */
const deCalendario = (p) => ({ id: String(p.id || ''), lid: p.localId, vid: p.visitanteId, st: est(p.estado), gl: p.gl, gv: p.gv, fecha: p.fecha, jug: [] });

/** los partidos de la jornada n: los de la jornada en juego con sus puntos; los demás, del calendario (o de lo pedido al tocarlos) */
export function partidosJornada(S, n) {
  const { M, D } = S;
  const V = M.vivo && M.vivo.n === n && Array.isArray(M.vivo.ps) && M.vivo.ps.length ? M.vivo : S.jornadasV && S.jornadasV[n];
  const cal = (D.partidos || []).filter((p) => p.jornada === n).map(deCalendario);
  if (!V || !Array.isArray(V.ps) || !V.ps.length) return cal;
  const ps = V.ps.map((p) => ({ ...p }));
  for (const c of cal) {
    const p = ps.find((x) => (c.id && x.id === c.id) || (x.lid === c.lid && x.vid === c.vid));
    if (!p) ps.push(c);
    else if (!p.fecha) p.fecha = c.fecha;
  }
  return ps.sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
}

/**
 * por dónde va un partido: { cls: 'vivo'|'fin'|'prox', txt (corto), largo, min }. El minuto es aproximado (LaLiga solo
 * dice la parte): desde la hora de inicio, con 15 minutos de descanso
 */
export function estadoP(p, ahora = Date.now()) {
  if (acabado(p, ahora)) return { cls: 'fin', txt: 'Final', largo: 'Final' };
  if (enJuego(p) || (p.st == null && p.fecha && p.fecha <= ahora && ahora - p.fecha < 2.2 * HORA)) {
    if (p.st === 3) return { cls: 'vivo', txt: 'Desc.', largo: 'Descanso' };
    const pasado = p.fecha ? (ahora - p.fecha) / MIN : null;
    let min = null;
    if (pasado != null && p.st === 2) min = pasado > 47 ? "45+'" : `${Math.max(1, Math.round(pasado))}'`;
    if (pasado != null && p.st === 4) { const m = Math.round(pasado - 17); min = m > 92 ? "90+'" : `${Math.min(90, Math.max(46, m))}'`; }
    const parte = p.st === 2 ? '1ª parte' : p.st === 4 ? '2ª parte' : 'En juego';
    return { cls: 'vivo', txt: min ? `~${min}` : parte, largo: `${parte}${min ? ` · ~${min}` : ''}`, min };
  }
  if (p.fecha) return { cls: 'prox', txt: horaDe(p.fecha), largo: `${cuando(p.fecha)}${p.fecha > ahora ? ` · en ${dura(p.fecha - ahora)}` : ''}`, dia: cuando(p.fecha, { hora: false }) };
  return { cls: 'prox', txt: '', largo: 'Sin fecha' };
}

/** de quién es en tu liga: { yo, tid, txt } o null si no es de nadie */
export function duenoDe(S, pid) {
  const t = S.M.dueno[pid];
  if (!t) return null;
  if (S.M.yo && String(t) === String(S.M.yo.teamId)) return { yo: true, tid: t, txt: 'Tuyo' };
  const e = S.M.equipo[t] || {};
  return { yo: false, tid: t, txt: e.manager || e.nombre || 'un rival' };
}
const corto = (j) => { const a = String(j.nombre || '').split(' '); return a.length > 1 && j.nombre.length > 11 ? a.slice(1).join(' ') : j.nombre; };
const ultima = (s) => { const w = norm(s).split(' ').filter(Boolean); return w[w.length - 1] || ''; };
/** el nombre de SofaScore («V. Junior», «Kylian Mbappé») y el de LaLiga Fantasy, ¿son el mismo? */
function mismoNombre(sofa, j) {
  const a = norm(String(sofa || '').replace(/^\S{1,3}\.\s*/, ''));
  if (!a) return false;
  for (const b of [norm(j.nombre), norm(j.largo || '')].filter(Boolean)) {
    if (a === b) return true;
    const ua = ultima(a), ub = ultima(b);
    if (ua.length > 3 && ua === ub) return true;
    if ((a.length > 4 && b.includes(a)) || (b.length > 4 && a.includes(b))) return true;
  }
  return false;
}
const minTxt = (i) => (i.min == null ? '' : `${i.min}${i.extra ? `+${i.extra}` : ''}'`);
/** lo que ha hecho en el partido: de LaLiga (minutos, goles, asistencias, tarjetas) y, si hay, de SofaScore (con el minuto) */
function hechosDe(x, j, ju) {
  const out = [];
  const sofa = ju && j ? ju.lista.filter((i) => mismoNombre(i.quien, j) || mismoNombre(i.asis, j) || mismoNombre(i.entra, j) || mismoNombre(i.sale, j)) : [];
  if (x && x.min != null) out.push(x.min > 0 ? `${x.min} min` : 'sin jugar');
  if (sofa.length) {
    for (const i of sofa) {
      if (i.tipo === 'gol' || i.tipo === 'penalti') out.push(mismoNombre(i.quien, j) ? `gol${i.tipo === 'penalti' ? ' de penalti' : ''} ${minTxt(i)}` : `asistencia ${minTxt(i)}`);
      else if (i.tipo === 'propia' && mismoNombre(i.quien, j)) out.push(`gol en propia ${minTxt(i)}`);
      else if (i.tipo === 'amarilla' || i.tipo === 'roja') out.push(`${i.tipo} ${minTxt(i)}`);
      else if (i.tipo === 'cambio') out.push(mismoNombre(i.entra, j) ? `entra ${minTxt(i)}` : `sale ${minTxt(i)}`);
    }
  } else if (x) {
    if (x.gol) out.push(`${x.gol} gol${x.gol > 1 ? 'es' : ''}`);
    if (x.asis) out.push(`${x.asis} asist.`);
    if (x.am) out.push(x.am > 1 ? 'dos amarillas' : 'amarilla');
    if (x.roja) out.push('roja');
  }
  return out.join(' · ');
}

/* ---------------- la lista de partidos ---------------- */
function filaPartido(S, p, n, ctx) {
  const { D, M } = S;
  const e = estadoP(p);
  const emp = empezo(p);
  const marca = (g) => (emp && g != null ? `<b class="pt-g">${g}</b>` : '<b class="pt-g apag">–</b>');
  const gana = emp && p.gl != null && p.gv != null ? (p.gl > p.gv ? 'l' : p.gv > p.gl ? 'v' : '') : '';
  // los tuyos en este partido, con lo que llevan (los que no están en tu once de LaLiga, más apagados)
  const once = M.vivo && M.vivo.n === n && M.vivo.once ? new Set(M.vivo.once) : null;
  const puntos = {};
  for (const x of p.jug) if (x.id && x.pts != null) puntos[x.id] = x.pts;
  const mios = (ctx.mios[p.lid] || []).concat(ctx.mios[p.vid] || []);
  const chips = mios.map((j) => {
    const v = emp ? (puntos[j.id] != null ? puntos[j.id] : M.puntosVivo(j.id)) : null;
    return `<span class="pt-chip${once && !once.has(j.id) ? ' banq' : ''}${v != null ? ` ${ptsCls(v)}` : ''}">${esc(corto(j))}${v != null ? `<b>${v}</b>` : ''}</span>`;
  }).join('');
  const rivales = (ctx.deRivales[p.lid] || 0) + (ctx.deRivales[p.vid] || 0);
  // (antes de empezar: los dos onces ya confirmados, para ver el campo en la ficha del partido)
  const confOnce = !emp && [p.lid, p.vid].every((t) => equipoConfirmado(S, t));
  const resto = (confOnce ? `<span class="pt-conf">${icono('ok')}Onces confirmados</span>` : '') + (rivales ? `<span class="pt-mas">${rivales} de rivales</span>` : '');
  return `<button class="pt${e.cls === 'vivo' ? ' en-juego' : ''}" data-accion="verPartido" data-id="${esc(p.id)}" data-n="${n}">
    <span class="pt-est ${e.cls}">${e.cls === 'vivo' ? `<span class="vivo-dot"></span><b>${esc(e.txt)}</b>` : e.cls === 'fin' ? '<b>Final</b>' : `<b>${esc(e.txt)}</b><small>${esc(ctx.dias ? e.dia || '' : '')}</small>`}</span>
    <span class="pt-eqs">
      <span class="pt-eq${gana === 'l' ? ' gana' : ''}">${escudo(D, p.lid)}<span class="pt-nom">${esc(nombreEq(D, p.lid))}</span>${marca(p.gl)}</span>
      <span class="pt-eq${gana === 'v' ? ' gana' : ''}">${escudo(D, p.vid)}<span class="pt-nom">${esc(nombreEq(D, p.vid))}</span>${marca(p.gv)}</span>
      ${chips || resto ? `<span class="pt-mios">${chips}${resto}</span>` : ''}
    </span></button>`;
}
/** ¿tiene ya su once confirmado el equipo para su partido? (la alineación de SofaScore o de futbolfantasy) */
function equipoConfirmado(S, tid) {
  const { D, M } = S;
  if (!M.alineacion) return false;
  let n = 0;
  for (const j of Object.values(D.maestro)) if (j.equipoId === tid && j.pos >= 1 && j.pos <= 4) { const a = M.alineacion(j.id); if (a && a.estado === 'titular') n++; }
  return n >= 10;
}
/** quiénes de tu liga juegan con cada equipo: los tuyos (jugadores) y cuántos de los rivales */
function contexto(S) {
  const { M, D } = S;
  const yo = M.yo ? String(M.yo.teamId) : '';
  const mios = {}, deRivales = {};
  for (const x of M.mias) if (x.j.pos && x.j.pos < 5) (mios[x.j.equipoId] ||= []).push(x.j);
  for (const [pid, t] of Object.entries(M.dueno || {})) {
    if (String(t) === yo) continue;
    const j = D.maestro[pid];
    if (j && j.pos < 5) deRivales[j.equipoId] = (deRivales[j.equipoId] || 0) + 1;
  }
  for (const l of Object.values(mios)) l.sort((a, b) => a.pos - b.pos);
  return { mios, deRivales };
}
function listaPartidos(S, n, ps, { dias = true } = {}) {
  const ctx = { ...contexto(S), dias };
  const vivos = ps.filter((p) => estadoP(p).cls === 'vivo'), prox = ps.filter((p) => estadoP(p).cls === 'prox'), fin = ps.filter((p) => estadoP(p).cls === 'fin').reverse();
  let h = '';
  if (vivos.length) h += `<div class="grupo"><span>Jugándose</span><span>${vivos.length}</span></div>${vivos.map((p) => filaPartido(S, p, n, ctx)).join('')}`;
  if (prox.length) h += `<div class="grupo"><span>${vivos.length || fin.length ? 'Por jugar' : 'Partidos'}</span><span>${prox.length}</span></div>${prox.map((p) => filaPartido(S, p, n, ctx)).join('')}`;
  if (fin.length) h += `<div class="grupo"><span>Acabados</span><span>${fin.length}</span></div>${fin.map((p) => filaPartido(S, p, n, ctx)).join('')}`;
  return h || nada('Aún no hay partidos de esta jornada.');
}

/* ---------------- tu jornada, tu liga y tu once ---------------- */
/** de un once: cuántos ya han jugado, cuántos juegan ahora y cuántos faltan */
function cuentaOnce(S, ids, ps) {
  const out = { ya: 0, ahora: 0, faltan: 0 };
  for (const pid of ids || []) {
    const j = S.D.maestro[pid];
    if (!j) continue;
    const p = ps.find((x) => x.lid === j.equipoId || x.vid === j.equipoId);
    if (!p) continue;
    const e = estadoP(p).cls;
    if (e === 'fin') out.ya++; else if (e === 'vivo') out.ahora++; else out.faltan++;
  }
  return out;
}
/** la clasificación de la jornada: [{ e, tid, pts, aprox, cuenta }] de más a menos */
function tablaJornada(S, n, ps) {
  const { M, D } = S;
  const V = M.vivo;
  const yo = M.yo ? String(M.yo.teamId) : '';
  return D.clasif.map((e) => {
    const tid = String(e.teamId);
    const ids = tid === yo ? V && V.once : S.oncesRival && S.oncesRival[tid] && S.oncesRival[tid].n === n ? S.oncesRival[tid].ids : null;
    let pts = V && V.equipos && V.equipos[tid] != null ? V.equipos[tid] : null, aprox = false;
    // si LaLiga no da los puntos del equipo, la suma de su once
    if (pts == null && ids) { pts = ids.reduce((t, pid) => t + (M.puntosVivo(pid) || 0), 0); aprox = true; }
    return { e, tid, yo: tid === yo, pts, aprox, cuenta: ids ? cuentaOnce(S, ids, ps) : null };
  }).sort((a, b) => (b.pts == null ? -1e9 : b.pts) - (a.pts == null ? -1e9 : a.pts) || a.e.pos - b.e.pos);
}
function resumenHTML(S, n, ps) {
  const { M } = S;
  const V = M.vivo;
  const tabla = tablaJornada(S, n, ps);
  const yo = tabla.find((x) => x.yo);
  const pos = yo && yo.pts != null ? tabla.filter((x) => x.pts != null && x.pts > yo.pts).length + 1 : null;
  const c = V && V.once ? cuentaOnce(S, V.once, ps) : null;
  const lider = tabla[0];
  let dif = '';
  if (yo && yo.pts != null && lider && lider.pts != null) {
    if (lider.yo) { const seg = tabla.find((x) => !x.yo && x.pts != null); dif = seg ? (yo.pts > seg.pts ? `le sacas ${yo.pts - seg.pts} al 2º` : 'empatado con el 2º') : ''; } else dif = `a ${lider.pts - yo.pts} del 1º`;
  }
  return `<div class="dt-res">
    <button class="dt-yo" data-accion="ver" data-sel="#dt-tu-once"><div class="et">Llevas ›</div><div class="v">${yo && yo.pts != null ? `${yo.aprox ? '≈' : ''}${yo.pts}` : '–'}<small>pts</small></div><div class="d">${pos ? `<b>${pos}º</b> de ${tabla.filter((x) => x.pts != null).length} en la jornada` : 'en la jornada'}${dif ? ` · ${dif}` : ''}</div></button>
    ${c ? `<button class="dt-once" data-accion="ver" data-sel="#dt-tu-once"><span><b>${c.ya}</b>ya jugaron</span><span class="${c.ahora ? 'on' : ''}"><b>${c.ahora}</b>jugando</span><span><b>${c.faltan}</b>por jugar</span></button>` : ''}
  </div>`;
}
function ligaHTML(S, n, ps) {
  const tabla = tablaJornada(S, n, ps);
  const sinOnces = tabla.some((x) => !x.yo && !x.cuenta);
  const filas = tabla.map((x, i) => {
    const c = x.cuenta;
    const queda = c ? (c.faltan + c.ahora ? `${x.yo ? 'te quedan' : 'le quedan'} ${c.faltan + c.ahora}${c.ahora ? ` (${c.ahora} jugando)` : ''}` : 'ya han jugado todos') : '';
    return `<button class="fila${x.yo ? ' yo-fila' : ''}" ${x.yo ? 'data-seg="directo:once"' : `data-r="${esc(x.e.teamId)}"`}>
      <span class="posn${x.yo ? ' yo' : ''}">${x.pts != null ? i + 1 : '–'}</span>${caraManager(x.e)}
      <div class="fila-c"><div class="fila-n">${esc(x.e.nombre)}</div>
        <div class="fila-s">${esc(x.e.manager && x.e.manager !== x.e.nombre ? `${x.e.manager} · ` : '')}${x.e.pos}º general${queda ? ` · ${queda}` : ''}</div></div>
      <div class="fila-d"><div class="v">${x.pts != null ? `${x.aprox ? '≈' : ''}${x.pts}` : '–'}</div><div class="d apag">pts J${n}</div></div></button>`;
  }).join('');
  return `<div class="sec"><h2>Tu liga en la jornada</h2></div>${filas}${sinOnces ? `<p class="t2 peq">${S.cargandoOnces ? 'Mirando el once de cada rival…' : 'De los rivales sin once no se sabe cuántos les quedan por jugar.'}</p>` : ''}`;
}
function onceHTML(S, n, ps) {
  const { M } = S;
  const V = M.vivo;
  const ids = V && V.once;
  let h = `<div class="sec" id="dt-tu-once" data-ancla><h2>Tu once</h2><span class="sub">el tuyo en LaLiga</span></div>`;
  const campo = ids ? campoVivo(M, ids) : '';
  if (!campo) return h + nada('LaLiga no enseña tu once ahora mismo. En Equipo tienes el mejor según la app.');
  h += campo;
  const enCampo = ids.map((pid) => M.J(pid)).filter((j) => j && j.pos && j.pos < 5).length;
  if (enCampo < 11) h += `<p class="t2 peq"><b class="rojo">Tienes ${enCampo} en el once de LaLiga: ${11 - enCampo > 1 ? `los ${11 - enCampo} huecos no puntúan` : 'el hueco no puntúa'}.</b></p>`;
  // los del banquillo, con lo que habrían sumado
  const dentro = new Set(ids);
  const banq = M.mias.map((x) => x.j).filter((j) => !dentro.has(j.id) && j.pos < 5);
  const conPts = banq.map((j) => ({ j, v: M.puntosVivo(j.id) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
  if (conPts.length) h += `<p class="t2 peq">En el banquillo (no cuentan): ${conPts.map((x) => `${esc(corto(x.j))} <b class="${x.v > 0 ? 'sube' : x.v < 0 ? 'baja' : ''}">${x.v}</b>`).join(' · ')}</p>`;
  void n; void ps;
  return h;
}

/* ---------------- la pestaña ---------------- */
export function directo(S) {
  const { M } = S;
  const J = M.enJuego;
  if (!J) return sinJornada(S);
  const n = J.n, V = M.vivo;
  const ps = partidosJornada(S, n);
  const vivos = ps.filter((p) => estadoP(p).cls === 'vivo').length, fin = ps.filter((p) => estadoP(p).cls === 'fin').length;
  const seg = S.seg.directo || 'partidos';
  let h = `<div class="eti">Jornada ${n}</div><div class="titulo">Directo</div>`;
  h += `<p class="entradilla dt-ent">${vivos ? `<span class="vivo-dot"></span><b>${vivos}</b> jugándose · ` : ''}${fin} acabado${fin === 1 ? '' : 's'} · ${ps.length - vivos - fin} por jugar
    <button class="enlace dt-act" data-accion="vivoYa">${icono('refrescar')}${S.cargandoVivo ? 'Actualizando…' : V ? `Actualizado ${rel(V.t)}` : 'Actualizar'}</button></p>`;
  h += resumenHTML(S, n, ps);
  if (ancho()) return h + cols(listaPartidos(S, n, ps), ligaHTML(S, n, ps) + onceHTML(S, n, ps));
  h += tabs('directo', seg, [['partidos', 'Partidos', vivos, 'verde'], ['liga', 'Tu liga'], ['once', 'Tu once']]);
  if (seg === 'liga') h += ligaHTML(S, n, ps);
  else if (seg === 'once') h += onceHTML(S, n, ps);
  else h += listaPartidos(S, n, ps);
  return h;
}
function sinJornada(S) {
  const { M } = S;
  const ahora = Date.now();
  const prox = M.proxima;
  const ult = (M.jornadas || []).filter((j) => j.fin < ahora).pop() || null;
  let h = `<div class="eti">${prox ? `Jornada ${prox.n}` : 'LaLiga'}</div><div class="titulo">Directo</div>`;
  h += `<p class="entradilla">${prox ? `La jornada ${prox.n} empieza ${cuando(prox.ini)}, en ${dura(prox.ini - ahora)}. ` : ''}Con los partidos en juego, aquí salen los marcadores, los puntos de cada jugador, tu once y cómo va tu liga, al minuto.</p>`;
  const a = prox ? `<div class="sec"><h2>Jornada ${prox.n}</h2><span class="sub">${M.enParon ? 'tras el parón' : 'la próxima'}</span></div>${listaPartidos(S, prox.n, partidosJornada(S, prox.n))}` : '';
  let b = '';
  if (ult) {
    const u = puntosUltimaJornada(S);
    b = `<div class="sec"><h2>Jornada ${ult.n}</h2><span class="sub">acabada</span></div>`;
    if (u && u.n === ult.n) b += `<div class="dt-res"><button class="dt-yo" data-accion="irJornada" data-n="${ult.n}"><div class="et">Hiciste ›</div><div class="v">${u.pts}<small>pts</small></div><div class="d"><b>${u.puesto}º</b> de tu liga en la jornada: ver tu once</div></button></div>`;
    b += listaPartidos(S, ult.n, partidosJornada(S, ult.n), { dias: false });
  }
  if (!a && !b) return h + nada('No hay jornadas a la vista.');
  return h + (ancho() && a && b ? cols(a, b, 'mitades') : a + b);
}

/* ---------------- la ficha de un partido ---------------- */
function jugadaHTML(S, p, i) {
  const { D } = S;
  const tid = i.casa ? p.lid : p.vid;
  let ic = '', t = '';
  if (i.tipo === 'gol' || i.tipo === 'penalti' || i.tipo === 'propia') {
    ic = `<span class="jg-ic gol">${icono('balon')}</span>`;
    t = `<b>${esc(i.quien || 'Gol')}</b>${i.tipo === 'penalti' ? ' (penalti)' : i.tipo === 'propia' ? ' (en propia)' : ''}${i.asis ? ` <span class="apag">· asiste ${esc(i.asis)}</span>` : ''}${i.gl != null ? ` <span class="jg-r">${i.gl}-${i.gv}</span>` : ''}`;
  } else if (i.tipo === 'amarilla' || i.tipo === 'roja') {
    ic = `<span class="jg-ic"><i class="tarjeta ${i.tipo}"></i></span>`;
    t = `<b>${esc(i.quien || '')}</b>`;
  } else if (i.tipo === 'cambio') {
    ic = `<span class="jg-ic cambio">${icono('cambio')}</span>`;
    t = `Entra <b>${esc(i.entra || '¿?')}</b> <span class="apag">por ${esc(i.sale || '¿?')}</span>`;
  } else if (i.tipo === 'var') {
    ic = `<span class="jg-ic">${icono('alerta')}</span>`;
    t = `VAR: anulado${i.quien ? ` a ${esc(i.quien)}` : ''}`;
  } else return '';
  return `<div class="jg"><span class="jg-min">${minTxt(i)}</span>${escudo(D, tid, 'chico')}${ic}<span class="jg-t">${t}</span></div>`;
}
function filaPt(S, x, ju) {
  const j = S.D.maestro[x.id] || null;
  const nom = j ? j.nombre : x.nom;
  const d = j ? duenoDe(S, j.id) : null;
  const hechos = hechosDe(x, j, ju);
  const sub = [d ? (d.yo ? '<b class="rojo">Tuyo</b>' : `de ${esc(d.txt)}`) : '<span class="apag">sin dueño</span>', esc(hechos)].filter(Boolean).join(' · ');
  const tag = j ? `button class="fila${d && d.yo ? ' yo-fila' : ''}" data-j="${esc(j.id)}"` : 'div class="fila"';
  return `<${tag}>${ava(j || { nombre: nom, pos: x.pos })}<div class="fila-c"><div class="fila-n">${posTag(j || { pos: x.pos })}<span class="nom">${esc(nom)}</span></div><div class="fila-s">${sub}</div></div>
    <div class="fila-d"><div class="v pf-pts ${ptsCls(x.pts)}">${x.pts == null ? '–' : x.pts}</div></div></${j ? 'button' : 'div'}>`;
}
/**
 * un partido con lo que ha hecho cada uno (S.hechos, de la ficha de cada jugador en LaLiga Fantasy): los minutos para
 * saber quién salió de titular y los goles, asistencias y tarjetas para el campo y los eventos
 */
function conHechos(S, n, p) {
  const H = S.hechos && S.hechos[`${n}:${p.id}`];
  if (!H || !H.porJug) return p;
  const c = (h, k) => (h.ev[k] ? h.ev[k][0] : 0);
  return { ...p, hechos: true, jug: p.jug.map((x) => {
    const h = H.porJug[x.id];
    if (!h) return x;
    return { ...x, min: x.min != null ? x.min : h.min, gol: x.gol || c(h, 'gol'), asis: x.asis || c(h, 'asis'), am: x.am || c(h, 'am') + c(h, 'am2'), roja: x.roja || c(h, 'roja') || (c(h, 'am2') ? 1 : 0), ev: h.ev };
  }) };
}
/** los eventos del partido que dan o quitan puntos (sin minuto: LaLiga no lo da), de cada equipo y de quién es cada uno */
function eventosHTML(S, p) {
  const { D } = S;
  const items = [];
  for (const x of p.jug) {
    if (!x.ev) continue;
    EVENTOS.forEach(([, c, uno, varios], orden) => { const v = x.ev[c]; if (v) items.push({ x, c, txt: v[0] > 1 ? `${v[0]} ${varios.toLowerCase()}` : uno, pts: v[1], orden }); });
  }
  if (!items.length) return '';
  items.sort((a, b) => a.orden - b.orden || (b.x.l - a.x.l) || String(a.x.nom).localeCompare(String(b.x.nom)));
  const ic = (c) => (c === 'gol' || c === 'propia' ? `<span class="jg-ic gol">${icono('balon')}</span>`
    : c === 'am' || c === 'am2' || c === 'roja' ? `<span class="jg-ic"><i class="tarjeta ${c === 'am' ? 'amarilla' : 'roja'}"></i></span>`
      : c.startsWith('pen') ? `<span class="jg-ic">${icono('diana')}</span>` : `<span class="jg-ic">${icono('balon')}</span>`);
  const fila = (it) => {
    const j = D.maestro[it.x.id];
    const d = j ? duenoDe(S, j.id) : null;
    const quien = d ? (d.yo ? ' <b class="rojo">· tuyo</b>' : ` <span class="apag">· de ${esc(d.txt)}</span>`) : '';
    const pts = it.pts == null ? '' : `<span class="ev-pts ${it.pts > 0 ? 'sube' : it.pts < 0 ? 'baja' : 'cero'}">${it.pts > 0 ? '+' : ''}${it.pts}</span>`;
    return `<${j ? `button class="jg ev-f" data-j="${esc(j.id)}"` : 'div class="jg ev-f"'}>${escudo(D, it.x.l ? p.lid : p.vid, 'chico')}${ic(it.c)}<span class="jg-t"><b>${esc(j ? j.nombre : it.x.nom)}</b> ${esc(it.txt)}${quien}</span>${pts}</${j ? 'button' : 'div'}>`;
  };
  return `<div class="sec"><h2>Eventos</h2><span class="sub">lo que da o quita puntos</span></div><div class="pf-jug">${items.map(fila).join('')}</div>`;
}
/* ---------------- el partido en el campo ---------------- */
/** la etiqueta de arriba a la izquierda de cada cromo: de quién es en tu liga */
function tagDe(S, pid) {
  const d = duenoDe(S, pid);
  if (!d) return { txt: '' };
  if (d.yo) return { txt: 'TUYO', cls: 'tuyo' };
  return { txt: String(d.txt).split(' ')[0].slice(0, 8).toUpperCase(), cls: 'suyo' };
}
/** arriba a la derecha: si ha marcado o le han sacado tarjeta (de SofaScore si hay jugadas; si no, de LaLiga) */
function marcaDe(x, j, ju) {
  let gol = 0, am = 0, roja = 0;
  if (ju && ju.lista.length) {
    for (const i of ju.lista) {
      if (!mismoNombre(i.quien, j)) continue;
      if (i.tipo === 'gol' || i.tipo === 'penalti') gol++; else if (i.tipo === 'amarilla') am++; else if (i.tipo === 'roja') roja++;
    }
  } else if (x) { gol = x.gol || 0; am = x.am || 0; roja = x.roja || 0; }
  if (gol) return `<span class="cr-est ev gol" title="${gol} gol${gol > 1 ? 'es' : ''}">${icono('balon')}${gol > 1 ? `<b>${gol}</b>` : ''}</span>`;
  if (roja || am > 1) return '<span class="cr-est ev" title="Roja"><i class="tarjeta roja"></i></span>';
  if (am) return '<span class="cr-est ev" title="Amarilla"><i class="tarjeta amarilla"></i></span>';
  return '';
}
/** el campo: de arriba abajo delanteros, medios, defensas y portero */
function canchaHTML(os, crom, etiqueta = '') {
  const lineas = [1, 2, 3, 4].map((pos) => os.filter((o) => o.j.pos === pos));
  const filas = [3, 2, 1, 0].filter((i) => lineas[i].length).map((i) => `<div class="linea-c${lineas[i].length >= 6 ? ' seis' : lineas[i].length >= 5 ? ' cinco' : ''}">${lineas[i].map(crom).join('')}</div>`);
  return `<div class="cancha cancha-vivo pf-c"><i class="l-borde"></i><i class="l-medio"></i><i class="l-circ"></i><i class="l-area arriba"></i><i class="l-area abajo"></i>
    ${etiqueta ? `<span class="cv-forma">${esc(etiqueta)}</span>` : ''}${filas.join('')}</div>`;
}
/** de una lista, el once: el portero con más de lo que sea y los 10 de campo con más; y el resto */
function once11(os, f) {
  const xs = [...os].sort((a, b) => f(b) - f(a));
  const por = xs.find((o) => o.j.pos === 1);
  const campo = xs.filter((o) => o !== por && o.j.pos > 1).slice(0, 10);
  const tit = [por, ...campo].filter(Boolean);
  return { tit, resto: xs.filter((o) => !tit.includes(o)) };
}
/** un equipo en el partido ya empezado: los que han jugado en su campo, con sus puntos y de quién es cada uno */
function equipoJugado(S, p, l, ju) {
  const { D, M } = S;
  const tid = l ? p.lid : p.vid;
  const os = p.jug.filter((x) => x.l === l).map((x) => ({ x, j: D.maestro[x.id] })).filter((o) => o.j && o.j.pos >= 1 && o.j.pos <= 4);
  if (!os.length) return '';
  const tot = p.jug.filter((x) => x.l === l).reduce((t, x) => t + (x.pts || 0), 0);
  const hayMin = os.some((o) => o.x.min != null);
  let tit = os, banq = [], nota = '', banqT = 'Entraron';
  // los minutos de LaLiga salen de la ficha de cada jugador, y en directo solo se piden los que ya puntúan (y el once
  // probable): con pocos conocidos, el campo salía con 5 o 7 en vez de 11 (aviso de Domy, 25 oct). Con menos de 11 con
  // minutos, se completa con el once probable (sin contar al que se sabe que no ha jugado)
  const jugaron = os.filter((o) => o.x.min > 0);
  if (hayMin && jugaron.length > 0) {
    ({ tit, resto: banq } = once11(jugaron, (o) => o.x.min || 0));
    const hayPor = tit.some((o) => o.j.pos === 1), campoN = tit.filter((o) => o.j.pos > 1).length;
    const prob = tit.length < 11 || !hayPor ? onceProbable(S, tid) : null;
    if (prob) {
      const dentro = new Set(tit.map((o) => o.j.id)), porId = new Map(os.map((o) => [o.j.id, o]));
      const extra = [];
      for (const q of prob) {
        const w = porId.get(q.j.id);
        if (dentro.has(q.j.id) || (w && w.x.min === 0)) continue;
        if (q.j.pos === 1) { if (!hayPor) extra.push(w || { x: { id: q.j.id, pts: null }, j: q.j }); } else if (campoN + extra.filter((e) => e.j.pos > 1).length < 10) extra.push(w || { x: { id: q.j.id, pts: null }, j: q.j });
      }
      if (extra.length) {
        tit = [...tit, ...extra];
        banq = banq.filter((o) => !extra.includes(o));
        nota = `LaLiga aún no da los minutos de todos: en el campo, los ${jugaron.length} que ya sabemos que han jugado y, para completar el once, ${extra.length} del once probable.`;
      }
    }
    if (!nota && p.hechos && !ju) nota = 'En el campo, los 11 que más minutos llevan: los que salieron de titular. Debajo, los que han entrado.';
  }
  else {
    // LaLiga no dice los minutos (suele dar la plantilla entera, con 0 puntos los que no han jugado y también los que
    // juegan y aún no suman): el once confirmado de SofaScore; si no lo hay, el once probable, con lo que lleva cada
    // uno; y debajo, los demás que ya puntúan
    const conf = os.filter((o) => { const a = M.alineacion(o.j.id); return a && a.estado === 'titular'; });
    // (con 16 o menos, LaLiga da solo los que han jugado: esos)
    const prob = conf.length >= 10 || os.length <= 16 ? null : onceProbable(S, tid);
    const conPts = (o) => o.x.pts != null && o.x.pts !== 0;
    if (conf.length >= 10) { tit = conf; banq = os.filter((o) => !conf.includes(o) && conPts(o)); } else if (prob) {
      const porId = new Map(os.map((o) => [o.j.id, o]));
      tit = prob.map((o) => porId.get(o.j.id) || { x: { id: o.j.id, pts: null }, j: o.j });
      const dentro = new Set(prob.map((o) => o.j.id));
      banq = os.filter((o) => !dentro.has(o.j.id) && conPts(o));
      banqT = 'Fuera del once probable, ya puntúan';
      nota = 'LaLiga no dice quién ha salido de titular: en el campo, el once probable con lo que lleva cada uno.';
    } else if (os.length > 16) {
      tit = os.filter(conPts);
      nota = 'LaLiga no dice quién juega: salen solo los que ya han sumado o restado puntos.';
    } else if (os.length > 11) nota = `Todos los que han jugado (${os.length}): LaLiga no dice quién salió de titular.`;
  }
  if (!tit.length) return '';
  const crom = (o) => cromo(M, o.j, { tag: tagDe(S, o.j.id), marca: marcaDe(o.x, o.j, ju), datoFijo: { txt: o.x.pts == null ? '–' : `${o.x.pts} pts`, cls: `vivo-p ${ptsCls(o.x.pts) || 'cero'}` } });
  let h = `<div class="pf-cab">${escudo(D, tid)}<b>${esc(nombreEq(D, tid))}</b><span>${tot} pts entre todos</span></div>`;
  h += canchaHTML(tit, crom);
  if (banq.length) h += `<div class="banquillo"><div class="banq-t">${banqT} <span>${banq.length}</span></div><div class="banq-l">${banq.map((o) => cromo(M, o.j, { chico: true, tag: tagDe(S, o.j.id), marca: marcaDe(o.x, o.j, ju), datoFijo: { txt: o.x.pts == null ? '–' : `${o.x.pts} pts`, cls: `vivo-p ${ptsCls(o.x.pts) || 'cero'}` } })).join('')}</div></div>`;
  if (nota) h += `<p class="t2 peq">${nota}</p>`;
  return h;
}
/** el once probable de un equipo: el confirmado o el de futbolfantasy si está entero; si no, la formación gratis que más suma */
function oncePrevio(M, os) {
  const ya = os.filter((o) => { const a = M.alineacion(o.j.id); if (a) return a.estado === 'titular'; const op = M.onceProb(o.j.id); return !!(op && op.titular); });
  if (ya.length === 11 && ya.filter((o) => o.j.pos === 1).length === 1) return ya;
  const porP = (a, b) => b.T.p - a.T.p;
  const por = os.filter((o) => o.j.pos === 1).sort(porP)[0];
  const lin = [2, 3, 4].map((pos) => os.filter((o) => o.j.pos === pos).sort(porP));
  const forms = M.formaciones && M.formaciones.length ? M.formaciones : [[4, 4, 2], [4, 3, 3], [3, 5, 2], [3, 4, 3], [5, 3, 2], [4, 5, 1], [5, 4, 1]];
  let mejor = null;
  for (const f of forms) {
    if (lin.some((l, i) => l.length < f[i])) continue;
    const xs = lin.flatMap((l, i) => l.slice(0, f[i]));
    const suma = xs.reduce((t, o) => t + o.T.p, 0);
    if (!mejor || suma > mejor.suma) mejor = { suma, xs };
  }
  return por && mejor ? [por, ...mejor.xs] : null;
}
/** el once de un equipo (el confirmado o el más probable) en el campo: { cab, campo, forma, conf, deLiga } o null */
/** el once más probable de un equipo: [{ j, T }] (11) o null si no hay datos para sacarlo */
function onceProbable(S, tid) {
  const { D, M } = S;
  const os = Object.values(D.maestro).filter((j) => j.equipoId === tid && j.pos >= 1 && j.pos <= 4).map((j) => ({ j, T: M.titularidad ? M.titularidad(j) : null })).filter((o) => o.T && o.T.p != null);
  if (os.length < 11) return null;
  const tit = oncePrevio(M, os);
  if (!tit || tit.length < 11 || tit.reduce((t, o) => t + o.T.p, 0) < 5) return null;
  return tit;
}
/** los ids del once probable de los dos equipos de un partido (para pedir sus minutos a LaLiga aunque aún no puntúen) */
export function idsProbables(S, p) {
  const ids = [];
  for (const tid of [p.lid, p.vid]) { const o = tid ? onceProbable(S, tid) : null; if (o) for (const x of o) ids.push(String(x.j.id)); }
  return ids;
}
export function onceDeEquipo(S, tid) {
  const { D, M } = S;
  const tit = onceProbable(S, tid);
  if (!tit) return null;
  const conf = tit.every((o) => o.T.confirmada === 'titular');
  // (arriba a la derecha solo lo que importa: la alineación confirmada, una lesión o una duda; «SUP» no, que va en el %)
  const marca = (j) => (M.alineacion(j.id) || ['injured', 'suspended', 'out_of_league', 'doubtful'].includes(j.estado) ? null : '');
  const crom = (o) => { const v = Math.round(o.T.p * 100); return cromo(M, o.j, { tag: tagDe(S, o.j.id), marca: marca(o.j), datoFijo: conf ? { txt: 'Titular', cls: 'prob bien' } : { txt: `${v} %`, cls: `prob ${v >= 75 ? 'bien' : v >= 45 ? 'duda' : 'mal'}` } }); };
  const forma = [2, 3, 4].map((pos) => tit.filter((o) => o.j.pos === pos).length).join('-');
  const deLiga = tit.filter((o) => M.dueno[o.j.id]).length;
  return { cab: `<div class="pf-cab">${escudo(D, tid)}<b>${esc(nombreEq(D, tid))}</b><span>${conf ? 'confirmado' : 'probable'} · ${forma} · ${deLiga} de tu liga</span></div>`, campo: canchaHTML(tit, crom), forma, conf, deLiga };
}

export function fichaPartido(S, clave) {
  const { D, M } = S;
  const [nS, id] = String(clave).split(':');
  const n = Number(nS);
  const p0 = partidosJornada(S, n).find((x) => String(x.id) === String(id));
  if (!p0) return `<div class="hoja-cab"><h2>Jornada ${n || ''}</h2></div>${nada('No encuentro este partido.')}`;
  const p = conHechos(S, n, p0);
  const e = estadoP(p), emp = empezo(p);
  const ju = S.jugadas && S.jugadas[p.id];
  let h = `<div class="hoja-cab"><h2>Jornada ${n}</h2></div>`;
  h += `<div class="pf-mar">
    <button class="pf-eq" data-club="${esc(p.lid)}">${escudo(D, p.lid, 'g')}<span>${esc(nombreEq(D, p.lid))}</span></button>
    <div class="pf-res"><b>${emp && p.gl != null ? `${p.gl}<i>-</i>${p.gv}` : p.fecha ? horaDe(p.fecha) : '–'}</b><span class="pf-e ${e.cls}">${e.cls === 'vivo' ? '<span class="vivo-dot"></span>' : ''}${esc(e.largo)}</span></div>
    <button class="pf-eq" data-club="${esc(p.vid)}">${escudo(D, p.vid, 'g')}<span>${esc(nombreEq(D, p.vid))}</span></button></div>`;
  if (ju && ju.lista.length) h += `<div class="sec"><h2>Jugadas</h2></div><div class="pf-jug">${ju.lista.map((i) => jugadaHTML(S, p, i)).join('')}</div>`;
  else if (emp) h += eventosHTML(S, p);
  if (emp && p.jug.length) {
    h += equipoJugado(S, p, true, ju) + equipoJugado(S, p, false, ju);
    // los que no se pueden poner en el campo (no están en la lista de jugadores de LaLiga Fantasy), en lista
    const sueltos = p.jug.filter((x) => !(D.maestro[x.id] && D.maestro[x.id].pos >= 1 && D.maestro[x.id].pos <= 4) && x.pts != null && x.pos !== 5 && !(D.maestro[x.id] && D.maestro[x.id].pos === 5));
    if (sueltos.length) h += `<div class="sec"><h2>Otros</h2></div>${sueltos.map((x) => filaPt(S, x, ju)).join('')}`;
    h += `<p class="t2 peq">Arriba de cada uno, de quién es en tu liga. Los puntos son los de LaLiga Fantasy${enJuego(p) ? ' y se ponen al día solos cada minuto' : ''}.${ju || !enJuego(p) ? '' : ' El minuto es aproximado: LaLiga solo dice en qué parte va.'} Toca a uno para ver su ficha.</p>`;
    return h;
  }
  if (emp) {
    h += nada(S.cargandoPartido ? 'Cargando los puntos…' : 'LaLiga todavía no da los puntos de este partido. Se mira solo cada minuto.');
    // mientras llegan, el once que ha salido (el confirmado si lo hay; si no, el probable), en vez de quedarse en blanco
    const oL = onceDeEquipo(S, p.lid), oV = onceDeEquipo(S, p.vid);
    const campos = (oL ? oL.cab + oL.campo : '') + (oV ? oV.cab + oV.campo : '');
    const nConf = [oL, oV].filter((o) => o && o.conf).length;
    if (campos) return h + campos + `<p class="t2 peq">Mientras llegan los puntos, ${nConf === 2 ? 'los onces confirmados' : nConf === 1 ? 'un once confirmado y el otro probable' : 'los onces probables'}. Toca a uno para ver su ficha.</p>`;
  }
  // antes de empezar: el once probable de cada uno (o el confirmado), con lo probable que es que salga cada jugador
  if (!emp) {
    const oL = onceDeEquipo(S, p.lid), oV = onceDeEquipo(S, p.vid);
    const campos = (oL ? oL.cab + oL.campo : '') + (oV ? oV.cab + oV.campo : '');
    const nConf = [oL, oV].filter((o) => o && o.conf).length;
    const pie = nConf === 2 ? 'Son los onces confirmados: los 11 que saltan al campo.' : nConf === 1 ? 'Uno de los onces ya está confirmado; el otro es el probable y se pone al día solo cuando sale.' : 'Los onces confirmados salen una hora antes del partido y se ponen solos.';
    if (campos) return h + campos + `<p class="t2 peq">${pie} Arriba de cada uno, de quién es en tu liga${nConf === 2 ? '' : '; debajo, lo probable que es que salga de titular'}. Toca a uno para ver su ficha.</p>`;
  }
  // (sin once probable o sin puntos): quién juega de tu liga
  const delLiga = Object.values(D.maestro).filter((j) => (j.equipoId === p.lid || j.equipoId === p.vid) && j.pos < 5 && M.dueno[j.id]);
  const yo = M.yo ? String(M.yo.teamId) : '';
  delLiga.sort((a, b) => (String(M.dueno[b.id]) === yo) - (String(M.dueno[a.id]) === yo) || a.pos - b.pos || b.valor - a.valor);
  if (delLiga.length) {
    h += `<div class="sec"><h2>De tu liga</h2><span class="sub">${delLiga.length} en este partido</span></div>`;
    h += delLiga.map((j) => { const d = duenoDe(S, j.id); return filaJugador({ j }, { sub: `${esc(j.equipo || '')} · ${d.yo ? '<b class="rojo">Tuyo</b>' : `de ${esc(d.txt)}`}`, derecha: '' }); }).join('');
  } else h += nada('Nadie de tu liga juega en este partido.');
  return h;
}

/* ---------------- en la ficha de un jugador: su jornada ---------------- */
export function jornadaJugadorHTML(S, pid) {
  const { M, D } = S;
  const V = M.vivo;
  const j = D.maestro[pid];
  if (!V || !M.enJuego || !j) return '';
  const p = partidosJornada(S, V.n).find((x) => x.lid === j.equipoId || x.vid === j.equipoId);
  if (!p || !empezo(p)) return '';
  const e = estadoP(p);
  const x = p.jug.find((y) => y.id === String(pid)) || null;
  const det = S.det && S.det[pid];
  const s = det && Array.isArray(det.stats) ? det.stats.find((y) => y.n === V.n) || null : null;
  const pts = M.puntosVivo(pid);
  const ju = S.jugadas && S.jugadas[p.id];
  const hechos = hechosDe(x && x.min != null ? x : s || x, j, ju);
  const marc = `${esc(nombreEq(D, p.lid))} ${p.gl != null ? `${p.gl}-${p.gv}` : 'vs'} ${esc(nombreEq(D, p.vid))}`;
  return `<div class="vivo-c dt-j"><div class="vivo-t">${e.cls === 'vivo' ? '<span class="vivo-dot"></span>' : ''}<b>Jornada ${V.n} · ${esc(e.largo)}</b>${pts != null ? `<span class="vivo-tot ${ptsCls(pts)}">${pts} pts</span>` : ''}</div>
    <p class="vivo-s">${marc}${hechos ? ` · ${esc(hechos)}` : pts == null ? ' · aún sin puntos' : ''}</p>
    <button class="enlace" data-accion="verPartido" data-id="${esc(p.id)}" data-n="${V.n}">Ver el partido ${icono('flecha')}</button></div>`;
}
