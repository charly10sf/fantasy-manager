/* La pestaña Clubes: los 20 de LaLiga por la clasificación y la ficha de cada uno (hoja 'c'): su próximo partido,
   su once probable en el campo, las bajas, sus partidos, su plantilla con lo que vale cada jugador y de quién es en
   tu liga, y sus noticias. Sale todo de lo que la app ya tiene (LaLiga, futbolfantasy, Understat, SofaScore y Google
   Noticias); al abrir un club se piden sus titulares (noticiasClub en externas.js). */
import { esc, eur, icono, cuando, dura, num, POS_PLURAL, norm } from './util.js';
import { filaJugador, nada, rachaHTML, h2hHTML, estadoPill, filaNoticia, nivelCls } from './comunes.js';
import { escudo, duenoDe, onceDeEquipo } from './directo.js';

const MALOS = { injured: 'Lesionados', suspended: 'Sancionados', doubtful: 'Dudas', out_of_league: 'Fuera de LaLiga' };

/** cuántos jugadores de cada club hay en tu liga y cuántos son tuyos: { eqId: { liga, mios } } */
function enTuLiga(S) {
  const { D, M } = S;
  const yo = M.yo ? String(M.yo.teamId) : '';
  const out = {};
  for (const [pid, t] of Object.entries(M.dueno || {})) {
    const j = D.maestro[pid];
    if (!j || !j.equipoId) continue;
    const o = (out[j.equipoId] ||= { liga: 0, mios: 0 });
    o.liga++;
    if (String(t) === yo) o.mios++;
  }
  return out;
}

/** «vs Getafe 18º · sáb 16:15», con el rival en verde, ámbar o rojo según lo difícil que es */
function proxTxt(S, id) {
  const c = S.M.calendarioDe ? S.M.calendarioDe(id, 1)[0] : null;
  if (!c) return '';
  return `${c.casa ? 'vs' : 'en'} <span class="niv ${nivelCls(c.nivel)}">${esc(c.rival)}${c.pos ? ` ${c.pos}º` : ''}</span> · ${esc(cuando(c.fecha))}`;
}

/** los clubes en orden: por la clasificación de LaLiga y, si aún no hay partidos jugados, por el nombre */
function clubesEnOrden(S) {
  const { D, M } = S;
  const ids = Object.keys(D.equipos || {}).filter((id) => (D.equipos[id] || {}).nombre);
  const pos = (id) => { const t = M.equipoLiga(id); return t ? t.pos : 99; };
  return ids.sort((a, b) => pos(a) - pos(b) || String(D.equipos[a].nombre).localeCompare(D.equipos[b].nombre, 'es'));
}

/* ================= LA PESTAÑA ================= */
export function clubes(S) {
  const { D, M } = S;
  const ids = clubesEnOrden(S);
  const liga = enTuLiga(S);
  let h = `<div class="eti">LaLiga${M.enJuego ? ` · jornada ${M.enJuego.n} en juego` : M.proxima ? ` · jornada ${M.proxima.n}` : ''}</div><div class="titulo">Clubes</div>`;
  h += `<p class="entradilla">Los ${ids.length || 20} de LaLiga por la clasificación. Toca uno para ver su once probable, las bajas, sus partidos y su plantilla.</p>`;
  if (!ids.length) return h + nada('Aún no tengo los equipos de LaLiga. Dale a Actualizar.');
  const filas = ids.map((id) => {
    const e = D.equipos[id], t = M.equipoLiga(id), r = M.racha(id, 5), l = liga[id];
    const prox = proxTxt(S, id);
    const tuyos = l && l.mios ? `<b class="rojo">${l.mios} tuyo${l.mios > 1 ? 's' : ''}</b>` : '';
    const sub = [prox, tuyos].filter(Boolean).join(' · ');
    return `<button class="fila club-f${l && l.mios ? ' con-mios' : ''}" data-club="${esc(id)}">
      <span class="posn">${t ? t.pos : '–'}</span>${escudo(D, id, 'club-esc')}
      <div class="fila-c"><div class="fila-n"><span class="nom">${esc(e.nombre)}</span></div>${sub ? `<div class="fila-s">${sub}</div>` : ''}</div>
      <div class="fila-d"><div class="v">${t ? t.pts : '–'}<small> pts</small></div>${r ? `<div class="d">${rachaHTML(r, e.nombre)}</div>` : ''}</div></button>`;
  }).join('');
  return h + `<div class="club-lista">${filas}</div>` + (M.tabla && M.tabla.length ? '<p class="cr-ley club-ley">Las bolitas, sus últimos partidos: <b class="ley-V">V</b> ganó, <b class="ley-E">E</b> empató, <b class="ley-D">D</b> perdió (la de la derecha, la última). El rival en verde, ámbar o rojo según lo difícil que es.</p>' : '');
}

/* ================= LA FICHA DE UN CLUB ================= */
/** de quién es en tu liga, para la línea de debajo del nombre */
function duenoTxt(S, pid) {
  const d = duenoDe(S, pid);
  return d ? (d.yo ? '<b class="rojo">Tuyo</b>' : `de ${esc(d.txt)}`) : 'Libre';
}
const dec1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/** el próximo partido: contra quién, cuándo, cómo llega el rival, las últimas veces y si puede rotar */
function proximoHTML(S, id) {
  const { D, M } = S;
  const p = M.proximoPartido(id);
  if (!p) return '';
  const c = (M.calendarioDe(id, 1) || [])[0] || {};
  const rr = M.racha(p.rivalId, 5), h2 = M.h2h ? M.h2h(id, p.rivalId) : [];
  const rot = M.rotacion ? M.rotacion(id) : null;
  const otras = rot && rot.cerca && rot.cerca.length ? rot.cerca.map((x) => `${x.comp || 'otra competición'} ${x.antes ? `${Math.round(x.dias)} días antes` : `${Math.round(x.dias)} días después`}`) : [];
  const ahora = Date.now();
  const yaJuega = p.fecha && p.fecha <= ahora;
  return `<div class="caja club-prox">
    <div class="cp-t">${yaJuega ? 'Jugando ahora' : 'Próximo partido'}${p.jornada ? ` · jornada ${p.jornada}` : ''}</div>
    <div class="cp-r"><span>${p.casa ? 'En casa, contra' : 'Fuera, contra'}</span>
      <button class="cp-rival" data-club="${esc(p.rivalId)}">${escudo(D, p.rivalId)}<b>${esc(p.rival)}</b></button>${c.pos ? `<span class="niv ${nivelCls(c.nivel)}">${c.pos}º${c.nivel ? ` · ${esc(c.nivel)}` : ''}</span>` : ''}</div>
    <div class="cp-s">${esc(cuando(p.fecha))}${p.fecha > ahora ? ` · en ${dura(p.fecha - ahora)}` : ''}</div>
    ${rr || (h2 && h2.length) ? `<div class="cp-x">${rr ? `<span>Cómo llega ${rachaHTML(rr, p.rival)}</span>` : ''}${h2 && h2.length ? `<span>Últimas veces ${h2hHTML(h2, p.rival)}</span>` : ''}</div>` : ''}
    ${otras.length ? `<p class="cp-rot">${icono('cambio')}Juega ${esc(otras.join(' y '))}: puede rotar.</p>` : ''}
    ${p.id && p.jornada ? `<button class="enlace" data-accion="verPartido" data-id="${esc(p.id)}" data-n="${p.jornada}">Ver el partido ${icono('flecha')}</button>` : ''}
  </div>`;
}

/** los lesionados, sancionados y dudas (de LaLiga y de futbolfantasy) y los que están a una amarilla de la sanción */
function bajasHTML(S, suyos) {
  const { M } = S;
  const grupos = { injured: [], suspended: [], doubtful: [], out_of_league: [] };
  const aper = [];
  for (const j of suyos) {
    let e = MALOS[j.estado] ? j.estado : null;
    const op = M.onceProb ? M.onceProb(j.id) : null;
    if (!e && op && (op.estado === 'injured' || op.estado === 'doubtful')) e = op.estado;
    if (e) { grupos[e].push(j); continue; }
    // en LaLiga, cada 5 amarillas es un partido de sanción: con 4 (o 9, o 14) está apercibido (las de Understat)
    const a = M.avanzado ? M.avanzado(j.id) : null;
    const am = a && a.u ? num(a.u.am) : 0;
    if (am && am % 5 === 4 && j.pos < 5) aper.push({ j, am });
  }
  const fila = (j, extra = '') => filaJugador({ j, tend: M.tend(j.id) }, { sub: duenoTxt(S, j.id), pills: [estadoPill(j) || extra] });
  let h = '';
  for (const [k, l] of Object.entries(grupos)) {
    if (!l.length) continue;
    h += `<div class="grupo"><span>${MALOS[k]}</span><span>${l.length}</span></div>`;
    h += l.sort((a, b) => b.valor - a.valor).map((j) => fila(j, k === 'doubtful' ? '<span class="pill duda">Duda (futbolfantasy)</span>' : '<span class="pill mal">Lesionado (futbolfantasy)</span>')).join('');
  }
  if (aper.length) {
    h += '<div class="grupo"><span>A una amarilla de la sanción</span><span>' + aper.length + '</span></div>';
    h += aper.sort((a, b) => b.j.valor - a.j.valor).map((x) => filaJugador({ j: x.j, tend: M.tend(x.j.id) }, { sub: duenoTxt(S, x.j.id), pills: [`<span class="pill duda">${x.am} amarillas</span>`] })).join('');
  }
  const n = Object.values(grupos).reduce((t, l) => t + l.length, 0);
  return `<div class="sec"><h2>Bajas</h2><span class="sub">${n ? `${n} ${n === 1 ? 'jugador' : 'jugadores'}` : 'ninguna'}</span></div>${h || '<p class="t2 peq club-nada">Sin lesionados, sancionados ni dudas ahora mismo.</p>'}`;
}

/** lo que le viene (5 partidos) y lo último que ha jugado (5), cada uno con su color */
function partidosHTML(S, id) {
  const { D, M } = S;
  const vienen = M.calendarioDe ? M.calendarioDe(id, 5) : [];
  const t = M.equipoLiga(id);
  const ult = t && t.ult ? [...t.ult].slice(-5).reverse() : [];
  if (!vienen.length && !ult.length) return '';
  const filaV = (c) => `<button class="club-p ${nivelCls(c.nivel)}" data-club="${esc(c.rivalId)}">
      <span class="cp-j">J${c.jornada}<small>${esc(cuando(c.fecha, { hora: false }))}</small></span>${escudo(D, c.rivalId)}
      <span class="cp-n"><b>${c.casa ? 'vs' : 'en'} ${esc(c.rival)}</b><small>${c.pos ? `${c.pos}º · ` : ''}${esc(c.nivel || 'sin datos')}</small></span></button>`;
  const filaU = (u) => {
    const nom = (D.equipos[u.rid] || {}).nombre || '¿?';
    return `<button class="club-p" data-club="${esc(u.rid)}">
      <span class="cp-j">J${u.jornada || '?'}</span>${escudo(D, u.rid)}
      <span class="cp-n"><b>${u.casa ? 'vs' : 'en'} ${esc(nom)}</b></span>
      <span class="cp-res r-${esc(u.r)}">${u.gf}-${u.gc}</span></button>`;
  };
  const a = vienen.length ? `<div class="grupo"><span>Le vienen</span><span>${vienen.length}</span></div>${vienen.map(filaV).join('')}` : '';
  const b = ult.length ? `<div class="grupo"><span>Los últimos</span><span>${ult.length}</span></div>${ult.map(filaU).join('')}` : '';
  return `<div class="sec"><h2>Partidos</h2><span class="sub">en verde, rival fácil; en rojo, difícil</span></div><div class="club-ps">${a}${b}</div>`;
}

/** la plantilla por puestos, de más a menos puntos, con un filtro: todos, libres o los de tu liga */
function plantillaHTML(S, suyos) {
  const { M } = S;
  const f = S.filtro.club || 'todos';
  const libres = suyos.filter((j) => !M.dueno[j.id]).length;
  const enMercado = new Set((M.mercado || []).map((m) => m.pid));
  const pasa = (j) => (f === 'libres' ? !M.dueno[j.id] : f === 'liga' ? !!M.dueno[j.id] : true);
  let h = `<div class="sec"><h2>Plantilla</h2><span class="sub">${suyos.length} jugadores · ${libres} libre${libres === 1 ? '' : 's'}</span></div>`;
  h += `<div class="filtros">${[['todos', 'Todos'], ['libres', 'Libres'], ['liga', 'De tu liga']].map(([k, t]) => `<button data-accion="filtroClub" data-f="${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
  let l = '';
  for (const p of [1, 2, 3, 4, 5]) {
    const xs = suyos.filter((j) => j.pos === p && pasa(j)).sort((a, b) => b.puntos - a.puntos || b.valor - a.valor);
    if (!xs.length) continue;
    l += `<div class="grupo"><span>${POS_PLURAL[p]}</span><span>${xs.length}</span></div>`;
    l += xs.map((j) => filaJugador({ j, tend: M.tend(j.id) }, {
      sub: `${duenoTxt(S, j.id)} · ${j.puntos} pts${j.media ? ` · ${dec1(j.media)} de media` : ''}`,
      pills: [estadoPill(j), enMercado.has(j.id) ? '<span class="pill abierta">En el mercado</span>' : ''],
    })).join('');
  }
  return h + (l || nada(f === 'libres' ? 'Todos sus jugadores tienen dueño en tu liga.' : f === 'liga' ? 'Nadie de tu liga tiene jugadores de este club.' : 'No tengo su plantilla.'));
}

/** sus titulares: los que ya tenía la app y los que se piden al abrir la ficha */
function noticiasHTML(S, id, suyos) {
  const pids = new Set(suyos.map((j) => j.id));
  const todas = [...((S.notClub && S.notClub[id] && S.notClub[id].l) || []), ...(S.M.noticias || []).filter((n) => (n.equipos && n.equipos.includes(id)) || (n.pids && n.pids.some((p) => pids.has(p))))];
  const vistos = new Set();
  const l = todas.filter((n) => { const k = norm(n.titulo).slice(0, 80); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 6);
  if (!l.length) return S.cargandoClub === id ? '<div class="sec"><h2>Noticias</h2></div><p class="t2 peq">Buscando sus noticias…</p>' : '';
  return `<div class="sec"><h2>Noticias</h2><span class="sub">últimos días</span></div>${l.map(filaNoticia).join('')}`;
}

export function fichaClub(S, id) {
  const { D, M } = S;
  const e = (D.equipos || {})[id];
  if (!e) return nada('No encuentro este club.');
  const t = M.equipoLiga(id), r = M.racha(id, 5);
  const suyos = Object.values(D.maestro || {}).filter((j) => j.equipoId === id && j.pos >= 1 && j.pos <= 5);
  const l = enTuLiga(S)[id] || { liga: 0, mios: 0 };
  let h = `<div class="club-top">${escudo(D, id, 'club-g')}<div style="min-width:0"><h2>${esc(e.nombre)}</h2>
    <div class="s">${t ? `<span>${t.pos}º en LaLiga</span>` : '<span>LaLiga</span>'}${r ? rachaHTML(r, e.nombre) : ''}</div></div></div>`;
  h += `<div class="rejilla">
    <div class="dato"><div class="et">Puntos</div><div class="v">${t ? t.pts : '–'}<small>${t ? `en ${t.pj} partido${t.pj === 1 ? '' : 's'}` : ''}</small></div></div>
    <div class="dato"><div class="et">Goles</div><div class="v">${t ? `${t.gf}<small>a favor</small> ${t.gc}<small>en contra</small>` : '–'}</div></div>
    <div class="dato"><div class="et">En tu liga</div><div class="v">${l.liga}<small>${l.mios ? `${l.mios} tuyo${l.mios > 1 ? 's' : ''}` : 'jugadores'}</small></div></div>
    <div class="dato"><div class="et">Libres</div><div class="v">${suyos.filter((j) => j.pos < 5 && !M.dueno[j.id]).length}<small>sin dueño</small></div></div>
  </div>`;
  h += proximoHTML(S, id);
  const o = onceDeEquipo(S, id);
  const once = `<div class="sec"><h2>Su once</h2><span class="sub">${o ? `${o.conf ? 'confirmado' : 'probable'} · ${o.forma}` : 'probable'}</span></div>`
    + (o ? `${o.campo}<p class="t2 peq">Arriba de cada uno, de quién es en tu liga; debajo, lo probable que es que salga de titular. Toca a uno para ver su ficha.</p>` : nada('Aún no hay once probable de este club.'));
  // (en el ordenador la ficha va en un panel de 620 px: una sola columna, como en el móvil)
  return h + once + bajasHTML(S, suyos) + partidosHTML(S, id) + plantillaHTML(S, suyos) + noticiasHTML(S, id, suyos);
}

/** el nombre del club, para el botón de volver */
export const nombreClub = (S, id) => ((S.D.equipos || {})[id] || {}).nombre || 'el club';
