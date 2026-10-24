/* La pestaña Directo: la jornada mientras se juega. Los partidos con su marcador y por dónde van, los puntos de cada
   jugador (y de quién es en tu liga), tu once de LaLiga con lo que lleva cada uno y cómo va tu liga en la jornada.
   Sin jornada en juego: cuándo empieza la próxima y cómo acabó la última.
   Los datos salen de vivo.js (LaLiga Fantasy) y, si SofaScore deja, las jugadas de cada partido (externas.js). */
import { esc, icono, cuando, rel, dura, MIN, HORA, horaDe, norm } from './util.js';
import { ava, posTag, nada, campoVivo, filaJugador } from './comunes.js';
import { ancho, cols, tabs, puntosUltimaJornada } from './vistas.js';

const est = (x) => { if (x == null || x === '') return null; const v = Number(x); return Number.isFinite(v) ? v : null; };
const enJuego = (p) => p.st != null && p.st >= 2 && p.st < 7;
/** ¿ha empezado? (por el estado que da LaLiga o, si no lo da, por la hora) */
const empezo = (p, ahora = Date.now()) => (p.st != null ? p.st >= 2 : !!(p.fecha && p.fecha <= ahora));
const acabado = (p, ahora = Date.now()) => p.st === 7 || (p.st == null && p.gl != null && p.fecha && ahora - p.fecha > 2 * HORA);
const ptsCls = (v) => (v == null ? '' : v > 0 ? 'sube' : v < 0 ? 'baja' : 'cero');
const eqDe = (D, id) => (D.equipos && D.equipos[id]) || {};
const escudo = (D, id, cls = '') => { const e = eqDe(D, id); return e.escudo ? `<img class="pt-esc ${cls}" src="${esc(e.escudo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="pt-esc ${cls} sin"></span>`; };
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
function duenoDe(S, pid) {
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
  const resto = rivales ? `<span class="pt-mas">${rivales} de rivales</span>` : '';
  return `<button class="pt${e.cls === 'vivo' ? ' en-juego' : ''}" data-accion="verPartido" data-id="${esc(p.id)}" data-n="${n}">
    <span class="pt-est ${e.cls}">${e.cls === 'vivo' ? `<span class="vivo-dot"></span><b>${esc(e.txt)}</b>` : e.cls === 'fin' ? '<b>Final</b>' : `<b>${esc(e.txt)}</b><small>${esc(ctx.dias ? e.dia || '' : '')}</small>`}</span>
    <span class="pt-eqs">
      <span class="pt-eq${gana === 'l' ? ' gana' : ''}">${escudo(D, p.lid)}<span class="pt-nom">${esc(nombreEq(D, p.lid))}</span>${marca(p.gl)}</span>
      <span class="pt-eq${gana === 'v' ? ' gana' : ''}">${escudo(D, p.vid)}<span class="pt-nom">${esc(nombreEq(D, p.vid))}</span>${marca(p.gv)}</span>
      ${chips || resto ? `<span class="pt-mios">${chips}${resto}</span>` : ''}
    </span></button>`;
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
    <div class="dt-yo"><div class="et">Llevas</div><div class="v">${yo && yo.pts != null ? `${yo.aprox ? '≈' : ''}${yo.pts}` : '–'}<small>pts</small></div><div class="d">${pos ? `<b>${pos}º</b> de ${tabla.filter((x) => x.pts != null).length} en la jornada` : 'en la jornada'}${dif ? ` · ${dif}` : ''}</div></div>
    ${c ? `<div class="dt-once"><span><b>${c.ya}</b>ya jugaron</span><span class="${c.ahora ? 'on' : ''}"><b>${c.ahora}</b>jugando</span><span><b>${c.faltan}</b>por jugar</span></div>` : ''}
  </div>`;
}
function ligaHTML(S, n, ps) {
  const tabla = tablaJornada(S, n, ps);
  const sinOnces = tabla.some((x) => !x.yo && !x.cuenta);
  const filas = tabla.map((x, i) => {
    const c = x.cuenta;
    const queda = c ? (c.faltan + c.ahora ? `${x.yo ? 'te quedan' : 'le quedan'} ${c.faltan + c.ahora}${c.ahora ? ` (${c.ahora} jugando)` : ''}` : 'ya han jugado todos') : '';
    return `<button class="fila${x.yo ? ' yo-fila' : ''}" ${x.yo ? 'data-seg="directo:once"' : `data-r="${esc(x.e.teamId)}"`}>
      <span class="posn${x.yo ? ' yo' : ''}">${x.pts != null ? i + 1 : '–'}</span>
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
  let h = `<div class="sec"><h2>Tu once</h2><span class="sub">el tuyo en LaLiga</span></div>`;
  const campo = ids ? campoVivo(M, ids) : '';
  if (!campo) return h + nada('LaLiga no enseña tu once ahora mismo. En Equipo tienes el mejor según la app.');
  h += campo;
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
    if (u && u.n === ult.n) b += `<div class="dt-res"><div class="dt-yo"><div class="et">Hiciste</div><div class="v">${u.pts}<small>pts</small></div><div class="d"><b>${u.puesto}º</b> de tu liga en la jornada</div></div></div>`;
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
export function fichaPartido(S, clave) {
  const { D, M } = S;
  const [nS, id] = String(clave).split(':');
  const n = Number(nS);
  const p = partidosJornada(S, n).find((x) => String(x.id) === String(id));
  if (!p) return `<div class="hoja-cab"><h2>Jornada ${n || ''}</h2></div>${nada('No encuentro este partido.')}`;
  const e = estadoP(p), emp = empezo(p);
  const ju = S.jugadas && S.jugadas[p.id];
  let h = `<div class="hoja-cab"><h2>Jornada ${n}</h2></div>`;
  h += `<div class="pf-mar">
    <div class="pf-eq">${escudo(D, p.lid, 'g')}<span>${esc(nombreEq(D, p.lid))}</span></div>
    <div class="pf-res"><b>${emp && p.gl != null ? `${p.gl}<i>-</i>${p.gv}` : p.fecha ? horaDe(p.fecha) : '–'}</b><span class="pf-e ${e.cls}">${e.cls === 'vivo' ? '<span class="vivo-dot"></span>' : ''}${esc(e.largo)}</span></div>
    <div class="pf-eq">${escudo(D, p.vid, 'g')}<span>${esc(nombreEq(D, p.vid))}</span></div></div>`;
  if (ju && ju.lista.length) h += `<div class="sec"><h2>Jugadas</h2><span class="sub">SofaScore</span></div><div class="pf-jug">${ju.lista.map((i) => jugadaHTML(S, p, i)).join('')}</div>`;
  if (emp && p.jug.length) {
    for (const [l, tid] of [[true, p.lid], [false, p.vid]]) {
      const xs = p.jug.filter((x) => x.l === l).sort((a, b) => (b.pts == null ? -99 : b.pts) - (a.pts == null ? -99 : a.pts));
      if (!xs.length) continue;
      const tot = xs.reduce((t, x) => t + (x.pts || 0), 0);
      h += `<div class="sec"><h2>${esc(nombreEq(D, tid))}</h2><span class="sub">${tot} pts entre todos</span></div>${xs.map((x) => filaPt(S, x, ju)).join('')}`;
    }
    h += `<p class="t2 peq">Los puntos son los de LaLiga Fantasy${enJuego(p) ? ' y se ponen al día solos cada minuto' : ''}.${ju ? '' : ' El minuto es aproximado: LaLiga solo dice en qué parte va.'}</p>`;
    return h;
  }
  if (emp) h += nada(S.cargandoPartido ? 'Cargando los puntos…' : 'LaLiga todavía no da los puntos de este partido. Se mira solo cada minuto.');
  // antes de empezar (o sin puntos): quién juega de tu liga, con lo probable que es que salga
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
