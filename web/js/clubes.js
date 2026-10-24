/* La pestaña Clubes: los 20 de LaLiga por la clasificación y la ficha de cada uno (hoja 'c'): su próximo partido,
   su once probable en el campo, las bajas, sus partidos, su plantilla con lo que vale cada jugador y de quién es en
   tu liga, y sus noticias. Sale todo de lo que la app ya tiene (LaLiga, futbolfantasy, Understat, SofaScore y Google
   Noticias); al abrir un club se piden sus titulares (noticiasClub en externas.js). */
import { esc, eur, icono, cuando, dura, num, POS_PLURAL, norm, horaDe } from './util.js';
import { ava, filaJugador, nada, rachaHTML, h2hHTML, estadoPill, filaNoticia, nivelCls, estiloClub } from './comunes.js';
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

/** «vs Real Madrid (4º), mañana 16:15», con el rival en verde, ámbar o rojo según lo difícil que es */
function proxTxt(S, id) {
  const c = S.M.calendarioDe ? S.M.calendarioDe(id, 1)[0] : null;
  if (!c) return '';
  return `${c.casa ? 'vs' : 'en'} <span class="niv ${nivelCls(c.nivel)}">${esc(c.rival)}</span>${c.pos ? ` (${c.pos}º)` : ''}, ${esc(cuando(c.fecha))}`;
}

/**
 * los clubes de esta temporada de LaLiga, en orden de la clasificación (o por el nombre, si aún no se ha jugado).
 * LaLiga da en su lista equipos de otras temporadas y de Segunda: valen los que salen en el calendario y, si no lo
 * hay, los que tienen jugadores en el juego
 */
function clubesEnOrden(S) {
  const { D, M } = S;
  const todos = Object.keys(D.equipos || {}).filter((id) => (D.equipos[id] || {}).nombre);
  const enCal = new Set();
  for (const p of D.partidos || []) { enCal.add(String(p.localId)); enCal.add(String(p.visitanteId)); }
  const conJug = {};
  for (const j of Object.values(D.maestro || {})) if (j.equipoId) conJug[j.equipoId] = (conJug[j.equipoId] || 0) + 1;
  let ids = todos.filter((id) => enCal.has(String(id)));
  if (ids.length < 10) ids = todos.filter((id) => (conJug[id] || 0) >= 11);
  if (ids.length < 10) ids = todos;
  const pos = (id) => { const t = M.equipoLiga(id); return t ? t.pos : 99; };
  return ids.sort((a, b) => pos(a) - pos(b) || String(D.equipos[a].nombre).localeCompare(D.equipos[b].nombre, 'es'));
}
/** los puestos que dan algo: Champions (1-4), Europa League (5), Conference (6) y descenso (los 3 últimos) */
const zonaDe = (pos, n) => (pos <= 4 ? 'ucl' : pos === 5 ? 'uel' : pos === 6 ? 'uecl' : pos > n - 3 ? 'desc' : '');

/* ================= LA PESTAÑA ================= */
export function clubes(S) {
  const { D, M } = S;
  const ids = clubesEnOrden(S);
  const n = ids.length;
  const hayTabla = ids.some((id) => { const t = M.equipoLiga(id); return t && t.pj > 0; });
  // las caras de los tuyos en cada club
  const mios = {};
  for (const x of M.mias || []) if (x.j && x.j.equipoId) (mios[x.j.equipoId] ||= []).push(x.j);
  let h = `<div class="eti">${M.enJuego ? `Jornada ${M.enJuego.n} en juego` : M.proxima ? `Jornada ${M.proxima.n}` : 'LaLiga'}</div><div class="titulo">Clubes</div>`;
  if (!n) return h + nada('Aún no tengo los equipos de LaLiga. Dale a Actualizar.');
  const filas = ids.map((id) => {
    const e = D.equipos[id], t = M.equipoLiga(id);
    const z = hayTabla && t && n >= 18 ? zonaDe(t.pos, n) : '';
    const dg = t ? t.gf - t.gc : null;
    const caras = (mios[id] || []).sort((a, b) => b.valor - a.valor);
    const carasH = caras.length ? `<span class="cf-caras" title="${esc(caras.map((j) => j.nombre).join(', '))}">${caras.slice(0, 3).map((j) => ava(j, 'm')).join('')}${caras.length > 3 ? `<b>+${caras.length - 3}</b>` : ''}</span>` : '';
    const prox = proxTxt(S, id);
    return `<button class="club-f${z ? ` z-${z}` : ''}" data-club="${esc(id)}" aria-label="${esc(`${t ? `${t.pos}º, ` : ''}${e.nombre}${t ? `, ${t.pts} puntos` : ''}${caras.length ? `, ${caras.length} tuyos` : ''}`)}">
      <span class="cf-pos">${t ? t.pos : '–'}</span>
      <span class="cf-esc">${escudo(D, id)}</span>
      <span class="cf-n"><span class="nom">${esc(e.nombre)}</span>${carasH}</span>
      <span class="cf-d">${t ? t.pj : ''}</span><span class="cf-d">${dg == null ? '' : dg > 0 ? `+${dg}` : dg}</span><span class="cf-d cf-pts">${t ? t.pts : '–'}</span>
      ${prox ? `<span class="cf-s">${prox}</span>` : ''}
    </button>`;
  }).join('');
  const cab = '<div class="cf-cab" aria-hidden="true"><span></span><span></span><span>Club</span><span>PJ</span><span>DG</span><span>Pts</span></div>';
  const ley = hayTabla && n >= 18 ? '<div class="cf-ley"><span class="z-ucl">Champions</span><span class="z-uel">Europa League</span><span class="z-uecl">Conference</span><span class="z-desc">Descenso</span></div>' : '';
  return h + `<div class="club-lista">${cab}${filas}</div>${ley}`;
}

/* ================= LA FICHA DE UN CLUB ================= */
/** de quién es en tu liga, para la línea de debajo del nombre */
function duenoTxt(S, pid) {
  const d = duenoDe(S, pid);
  return d ? (d.yo ? '<b class="rojo">Tuyo</b>' : `de ${esc(d.txt)}`) : 'Libre';
}
const dec1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/** el próximo partido, con los dos escudos: cuándo, cómo llega cada uno, las últimas veces y si puede rotar */
function proximoHTML(S, id) {
  const { D, M } = S;
  const p = M.proximoPartido(id);
  if (!p) return '';
  const c = (M.calendarioDe(id, 1) || [])[0] || {};
  const h2 = M.h2h ? M.h2h(id, p.rivalId) : [];
  const rot = M.rotacion ? M.rotacion(id) : null;
  const otras = rot && rot.cerca && rot.cerca.length ? rot.cerca.map((x) => `${x.comp || 'otra competición'} ${Math.round(x.dias)} días ${x.antes ? 'antes' : 'después'}`) : [];
  const ahora = Date.now();
  const yaJuega = p.fecha && p.fecha <= ahora;
  const loc = p.casa ? id : p.rivalId, vis = p.casa ? p.rivalId : id;
  const nom = (x) => (D.equipos[x] || {}).nombre || (x === p.rivalId ? p.rival : '');
  // el propio club no se toca (ya estás en su ficha); el rival, sí
  const lado = (x) => {
    const dentro = `${escudo(D, x, 'g')}<span class="fx-nom">${esc(nom(x))}</span>${rachaHTML(M.racha(x, 5), nom(x))}`;
    return x === id ? `<div class="fx-eq">${dentro}</div>` : `<button class="fx-eq" data-club="${esc(x)}">${dentro}</button>`;
  };
  return `<div class="club-fx">
    <div class="fx-t">${p.jornada ? `Jornada ${p.jornada}` : 'Próximo partido'}${c.nivel ? `<span class="niv ${nivelCls(c.nivel)}">rival ${esc(c.nivel === 'media' ? 'de nivel medio' : c.nivel)}</span>` : ''}</div>
    <div class="fx-m">${lado(loc)}
      <div class="fx-c">${yaJuega ? '<b class="vivo">En juego</b>' : `<b>${p.fecha ? horaDe(p.fecha) : '–'}</b><small>${esc(cuando(p.fecha, { hora: false }))}${p.fecha > ahora ? `, en ${dura(p.fecha - ahora)}` : ''}</small>`}</div>
      ${lado(vis)}</div>
    ${h2 && h2.length ? `<div class="fx-h">Las últimas veces contra el ${esc(p.rival)} ${h2hHTML(h2, p.rival)}</div>` : ''}
    ${otras.length ? `<p class="cp-rot">${icono('cambio')}Juega ${esc(otras.join(' y '))}: puede rotar.</p>` : ''}
    ${p.id && p.jornada ? `<button class="enlace fx-ir" data-accion="verPartido" data-id="${esc(p.id)}" data-n="${p.jornada}">Ver el partido ${icono('flecha')}</button>` : ''}
  </div>`;
}

/** los que más puntúan, con su cara: de quién son, sus puntos y lo que valen */
function figurasHTML(S, suyos) {
  const fig = suyos.filter((j) => j.pos < 5 && j.puntos > 0).sort((a, b) => b.puntos - a.puntos).slice(0, 8);
  if (fig.length < 3) return '';
  return `<div class="sec"><h2>Los que más puntúan</h2></div><div class="carril">${fig.map((j) => `<button class="tj club-tj" data-j="${esc(j.id)}">${ava(j)}
      <div class="n">${esc(j.nombre)}</div><div class="s">${duenoTxt(S, j.id)}</div>
      <div class="gr">${j.puntos}<small> pts</small></div><div class="tj-v">${eur(j.valor)}</div></button>`).join('')}</div>`;
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
    h += l.sort((a, b) => b.valor - a.valor).map((j) => fila(j, k === 'doubtful' ? '<span class="pill duda">Duda</span>' : '<span class="pill mal">Lesionado</span>')).join('');
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
      <span class="cp-n"><b>${c.casa ? 'vs' : 'en'} ${esc(c.rival)}</b><small>${c.pos ? `${c.pos}º, ` : ''}${esc(c.nivel === 'media' ? 'nivel medio' : c.nivel || 'sin datos')}</small></span></button>`;
  const filaU = (u) => {
    const nom = (D.equipos[u.rid] || {}).nombre || '¿?';
    return `<button class="club-p" data-club="${esc(u.rid)}">
      <span class="cp-j">J${u.jornada || '?'}</span>${escudo(D, u.rid)}
      <span class="cp-n"><b>${u.casa ? 'vs' : 'en'} ${esc(nom)}</b></span>
      <span class="cp-res r-${esc(u.r)}">${u.gf}-${u.gc}</span></button>`;
  };
  const a = vienen.length ? `<div class="grupo"><span>Le vienen</span><span>${vienen.length}</span></div>${vienen.map(filaV).join('')}` : '';
  const b = ult.length ? `<div class="grupo"><span>Los últimos</span><span>${ult.length}</span></div>${ult.map(filaU).join('')}` : '';
  return `<div class="sec"><h2>Partidos</h2></div><div class="club-ps">${a}${b}</div>`;
}

/** la plantilla por puestos, de más a menos puntos, con un filtro: todos, libres o los de tu liga */
function plantillaHTML(S, suyos) {
  const { M } = S;
  const f = S.filtro.club || 'todos';
  const libres = suyos.filter((j) => !M.dueno[j.id]).length;
  const enMercado = new Set((M.mercado || []).map((m) => m.pid));
  const pasa = (j) => (f === 'libres' ? !M.dueno[j.id] : f === 'liga' ? !!M.dueno[j.id] : true);
  let h = `<div class="sec"><h2>Plantilla</h2><span class="sub">${suyos.length} jugadores, ${libres} libre${libres === 1 ? '' : 's'}</span></div>`;
  h += `<div class="filtros">${[['todos', 'Todos'], ['libres', 'Libres'], ['liga', 'De tu liga']].map(([k, t]) => `<button data-accion="filtroClub" data-f="${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
  let l = '';
  for (const p of [1, 2, 3, 4, 5]) {
    const xs = suyos.filter((j) => j.pos === p && pasa(j)).sort((a, b) => b.puntos - a.puntos || b.valor - a.valor);
    if (!xs.length) continue;
    l += `<div class="grupo"><span>${POS_PLURAL[p]}</span><span>${xs.length}</span></div>`;
    l += xs.map((j) => filaJugador({ j, tend: M.tend(j.id) }, {
      sub: `${duenoTxt(S, j.id)}, ${j.puntos} pts${j.media ? ` (${dec1(j.media)} de media)` : ''}`,
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
  const libres = suyos.filter((j) => j.pos < 5 && !M.dueno[j.id]).length;
  let h = `<div class="club-hero"${estiloClub(id, e.nombre)}>${escudo(D, id, 'club-g')}<div class="ch-t"><h2>${esc(e.nombre)}</h2>
    <div class="ch-s">${t ? `<span>${t.pos}º en LaLiga</span>` : ''}${r ? rachaHTML(r, e.nombre) : ''}</div></div></div>`;
  h += `<div class="club-num">
    <div><b>${t ? t.pts : '–'}</b><span>${t ? `puntos en ${t.pj}` : 'puntos'}</span></div>
    <div><b>${t ? `${t.gf}-${t.gc}` : '–'}</b><span>goles</span></div>
    <div><b>${l.liga}</b><span>${l.mios ? `en tu liga, ${l.mios} tuyo${l.mios > 1 ? 's' : ''}` : 'en tu liga'}</span></div>
    <div><b>${libres}</b><span>libre${libres === 1 ? '' : 's'}</span></div>
  </div>`;
  h += proximoHTML(S, id);
  const o = onceDeEquipo(S, id);
  const once = `<div class="sec"><h2>Su once</h2><span class="sub">${o ? `${o.conf ? 'confirmado' : 'probable'}, ${o.forma}` : 'probable'}</span></div>`
    + (o ? `${o.campo}<p class="t2 peq">Arriba, de quién es en tu liga. Debajo, lo probable que es que salga de titular.</p>` : nada('Aún no hay once probable de este club.'));
  // (en el ordenador la ficha va en un panel de 620 px: una sola columna, como en el móvil)
  return h + figurasHTML(S, suyos) + once + bajasHTML(S, suyos) + partidosHTML(S, id) + plantillaHTML(S, suyos) + noticiasHTML(S, id, suyos);
}

/** el nombre del club, para el botón de volver */
export const nombreClub = (S, id) => ((S.D.equipos || {})[id] || {}).nombre || 'el club';
