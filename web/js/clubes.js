/* La pestaña Clubes: los 20 de LaLiga por la clasificación y la ficha de cada uno (hoja 'c'): su próximo partido,
   su once probable en el campo, las bajas, sus partidos, su plantilla con lo que vale cada jugador y de quién es en
   tu liga, y sus noticias. Sale todo de lo que la app ya tiene (LaLiga, futbolfantasy, Understat, SofaScore y Google
   Noticias); al abrir un club se piden sus titulares (noticiasClub en externas.js). */
import { esc, eur, icono, cuando, dura, num, POS_PLURAL, norm, horaDe, pct, clase } from './util.js';
import { ava, posTag, filaJugador, nada, rachaHTML, h2hHTML, estadoPill, filaNoticia, nivelCls, estiloClub, camisetaClub, enCasaDe, ladoIco, cromo } from './comunes.js';
import { escudo, duenoDe, onceDeEquipo, ptsCls, tagDe, canchaHTML, once11 } from './directo.js';

const MALOS = { injured: 'Lesionados', suspended: 'Sancionados', doubtful: 'Dudas' };
// los que están fuera de LaLiga (cedidos fuera, filiales, vendidos…) no salen en la ficha del club: ni en las bajas ni en la plantilla
// (Carlos, 5 nov: era una lista interminable que no pinta nada en un club de LaLiga)
const enLaLiga = (j) => j.estado !== 'out_of_league';

/** «vs Real Madrid (4º), mañana 16:15», con el rival en verde, ámbar o rojo según lo difícil que es */
function proxTxt(S, id) {
  const c = S.M.calendarioDe ? S.M.calendarioDe(id, 1)[0] : null;
  if (!c) return '';
  return `${c.casa ? 'vs' : enCasaDe(c.rival)} <span class="niv ${nivelCls(c.nivel)}">${esc(c.rival)}</span>${c.pos ? ` (${c.pos}º)` : ''}, ${esc(cuando(c.fecha))}`;
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
/** la competición europea que juega cada club esta temporada (lo pidió Carlos el 30 oct: con los colores de cada club el
    fondo de la tabla confundía). Sale de la temporada anterior (Champions: Madrid, Barça, Atlético, Villarreal y Betis;
    Europa League: Celta y Real Sociedad; Conference: el Getafe, que pasó la previa ante el Partizán): cambia una vez
    al año, en verano. Pasada la fecha, no se pinta nada antes que pintar lo del año pasado */
const EUROPA = { hasta: Date.parse('2027-07-01T00:00:00+02:00'), temporada: '2026-27',
  ucl: ['real madrid', 'barcelona', 'atletico', 'villarreal', 'betis'], uel: ['celta', 'real sociedad'], uecl: ['getafe'] };
const COMP = { ucl: 'Champions', uel: 'Europa League', uecl: 'Conference' };
export function europaDe(nombre) {
  if (Date.now() > EUROPA.hasta) return '';
  const n = ` ${norm(nombre || '')} `;
  for (const k of ['ucl', 'uel', 'uecl']) if (EUROPA[k].some((c) => n.includes(` ${c} `) || n.includes(` ${c}`))) return k;
  return '';
}

/* ================= LA PESTAÑA ================= */
/** ganados, empatados y perdidos, de sus resultados */
const gep = (t) => { const o = { V: 0, E: 0, D: 0 }; for (const u of (t && t.ult) || []) o[u.r]++; return o; };

/** arriba, los clubes en los que tienes a alguien: con sus colores, su camiseta, tus caras y su próximo partido */
function tusClubesHTML(S, ids, mios) {
  const { D, M } = S;
  const xs = ids.filter((id) => (mios[id] || []).length).sort((a, b) => mios[b].length - mios[a].length || (M.equipoLiga(a) || { pos: 99 }).pos - (M.equipoLiga(b) || { pos: 99 }).pos);
  if (!xs.length) return '';
  const tarjeta = (id) => {
    const e = D.equipos[id], t = M.equipoLiga(id), caras = mios[id].sort((a, b) => b.valor - a.valor);
    const p = M.proximoPartido ? M.proximoPartido(id) : null;
    // lo que se mueven hoy tus jugadores de este club (Carlos, 9 nov: retoque pequeño de las tarjetas)
    const ds = caras.map((j) => (M.tend(j.id) || {}).d1).filter((d) => d != null);
    const hoy = ds.length ? ds.reduce((a, d) => a + d, 0) : null;
    const mueve = hoy == null ? '' : `<span class="cc-hoy ${clase(hoy)}" title="Lo que suben o bajan hoy tus jugadores de este club">${hoy ? eur(hoy, { dec: 1, signo: true }) : '='}<small> hoy</small></span>`;
    const k = mueve ? 3 : 4;
    return `<button class="club-card" data-club="${esc(id)}"${estiloClub(id, e.nombre)} aria-label="${esc(`${e.nombre}: ${caras.length} tuyo${caras.length > 1 ? 's' : ''}`)}">
      ${camisetaClub(id, e.nombre, 'cc-cam')}
      <span class="cc-cab">${escudo(D, id)}<span class="cc-n">${esc(e.nombre)}</span></span>
      <span class="cc-pos">${t ? `${t.pos}º · ${t.pts} pts` : 'LaLiga'}</span>
      <span class="cc-caras">${caras.slice(0, k).map((j) => ava(j, 'm')).join('')}${caras.length > k ? `<b>+${caras.length - k}</b>` : ''}${mueve}</span>
      ${p ? `<span class="cc-prox">${p.rivalId ? escudo(D, p.rivalId) : ''}<span>${p.casa ? 'vs' : enCasaDe(p.rival)} ${esc(p.rival)}${p.fecha ? ` · ${esc(cuando(p.fecha))}` : ''}</span></span>` : ''}
    </button>`;
  };
  return `<div class="sec"><h2>Tus clubes</h2><span class="sub">${xs.length} con jugadores tuyos</span></div><div class="carril club-carril">${xs.map(tarjeta).join('')}</div>`;
}

export function clubes(S) {
  const { D, M } = S;
  const ids = clubesEnOrden(S);
  const n = ids.length;
  const hayTabla = ids.some((id) => { const t = M.equipoLiga(id); return t && t.pj > 0; });
  // las caras de los tuyos en cada club
  const mios = {};
  for (const x of M.mias || []) if (x.j && x.j.equipoId) (mios[x.j.equipoId] ||= []).push(x.j);
  let h = `<div class="eti">${M.enJuego ? `Jornada ${M.enJuego.n} en juego` : M.proxima ? `Jornada ${M.proxima.n}` : 'LaLiga'}</div><h1 class="titulo">Clubes</h1>`;
  if (!n) return h + nada('Aún no tengo los equipos de LaLiga. Dale a Actualizar.');
  h += tusClubesHTML(S, ids, mios);
  const filas = ids.map((id) => {
    const e = D.equipos[id], t = M.equipoLiga(id);
    const eu = europaDe(e.nombre);
    const desc = hayTabla && t && n >= 18 && t.pos > n - 3;
    const dg = t ? t.gf - t.gc : null;
    const r = gep(t);
    const caras = (mios[id] || []).sort((a, b) => b.valor - a.valor);
    const carasH = caras.length ? `<span class="cf-caras" title="${esc(caras.map((j) => j.nombre).join(', '))}">${caras.slice(0, 3).map((j) => ava(j, 'm')).join('')}${caras.length > 3 ? `<b>+${caras.length - 3}</b>` : ''}</span>` : '';
    const prox = proxTxt(S, id);
    const cls = `${eu ? ` eu-${eu}` : ''}${desc ? ' z-desc' : ''}`;
    const sub = [eu ? `<b class="cf-comp">${COMP[eu]}</b>` : '', desc ? '<b class="cf-comp">Descenso</b>' : '', prox].filter(Boolean).join(' · ');
    return `<button class="club-f${cls}" data-club="${esc(id)}" aria-label="${esc(`${t ? `${t.pos}º, ` : ''}${e.nombre}${eu ? `, juega la ${COMP[eu]}` : ''}${t ? `, ${t.pts} puntos` : ''}${caras.length ? `, ${caras.length} tuyos` : ''}`)}">
      <span class="cf-kit" aria-hidden="true"></span>
      <span class="cf-pos">${t ? t.pos : '–'}</span>
      <span class="cf-esc">${escudo(D, id)}</span>
      <span class="cf-n"><span class="nom">${esc(e.nombre)}</span>${carasH}</span>
      <span class="cf-forma">${rachaHTML(M.racha(id, 5), e.nombre)}</span>
      <span class="cf-d cf-pj">${t ? t.pj : ''}</span><span class="cf-d cf-gep">${t ? `${r.V}-${r.E}-${r.D}` : ''}</span><span class="cf-d cf-gol">${t ? `${t.gf}:${t.gc}` : ''}</span><span class="cf-d cf-dg">${dg == null ? '' : dg > 0 ? `+${dg}` : dg}</span><span class="cf-d cf-pts">${t ? t.pts : '–'}</span>
      ${sub ? `<span class="cf-s">${sub}</span>` : ''}
    </button>`;
  }).join('');
  const cab = '<div class="cf-cab" aria-hidden="true"><span></span><span></span><span></span><span>Club</span><span class="cf-forma">Últimos 5</span><span class="cf-pj">PJ</span><span class="cf-gep">G-E-P</span><span class="cf-gol">Goles</span><span class="cf-dg">DG</span><span class="cf-pts">Pts</span></div>';
  const hayEu = ids.some((id) => europaDe(D.equipos[id].nombre));
  const ley = hayEu || (hayTabla && n >= 18) ? `<div class="cf-ley">${hayEu ? `<span class="eu-ucl">Champions</span><span class="eu-uel">Europa League</span><span class="eu-uecl">Conference</span>` : ''}${hayTabla && n >= 18 ? '<span class="z-desc">Descenso</span>' : ''}${hayEu ? `<small>El color dice qué competición europea juega cada club esta temporada (${EUROPA.temporada}): esos juegan también entre semana y rotan más.</small>` : ''}</div>` : '';
  return h + `<div class="sec"><h2>Clasificación</h2><span class="sub">${hayTabla ? `tras ${Math.max(...ids.map((id) => (M.equipoLiga(id) || { pj: 0 }).pj))} jornadas` : 'aún sin jugar'}</span></div><div class="club-lista">${cab}${filas}</div>${ley}`;
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

/** los lesionados, sancionados y dudas (de LaLiga y de futbolfantasy) y los que están a una amarilla de la sanción */
function bajasHTML(S, suyos) {
  const { M } = S;
  const grupos = { injured: [], suspended: [], doubtful: [] };
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
  // una sola lista, de más a menos valor: la píldora ya dice qué le pasa a cada uno (Carlos, 9 nov: «más clara y limpia»)
  const ORDEN = { injured: 0, suspended: 1, doubtful: 2 };
  const l = Object.entries(grupos).flatMap(([k, xs]) => xs.map((j) => ({ j, k })))
    .sort((a, b) => ORDEN[a.k] - ORDEN[b.k] || b.j.valor - a.j.valor);
  const pill = (x) => estadoPill(x.j) || (x.k === 'doubtful' ? '<span class="pill duda">Duda</span>' : '<span class="pill mal">Lesionado</span>');
  let h = l.map((x) => filaJugador({ j: x.j, tend: M.tend(x.j.id) }, { sub: duenoTxt(S, x.j.id), pills: [pill(x)] })).join('');
  h += aper.sort((a, b) => b.j.valor - a.j.valor).map((x) => filaJugador({ j: x.j, tend: M.tend(x.j.id) }, { sub: duenoTxt(S, x.j.id), pills: [`<span class="pill duda">${x.am} amarillas: a una de la sanción</span>`] })).join('');
  const n = l.length;
  return `<div class="sec"><h2>Bajas</h2><span class="sub">${n ? `${n} ${n === 1 ? 'jugador' : 'jugadores'}` : 'ninguna'}${aper.length ? `, ${aper.length} apercibido${aper.length === 1 ? '' : 's'}` : ''}</span></div>${h || '<p class="t2 peq club-nada">Sin lesionados, sancionados ni dudas ahora mismo.</p>'}`;
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
      <span class="cp-n"><b>${ladoIco(c.casa)}${esc(c.rival)}</b><small>${c.pos ? `${c.pos}º, ` : ''}${esc(c.nivel === 'media' ? 'nivel medio' : c.nivel || 'sin datos')}</small></span></button>`;
  const filaU = (u) => {
    const nom = (D.equipos[u.rid] || {}).nombre || '¿?';
    return `<button class="club-p" data-club="${esc(u.rid)}">
      <span class="cp-j">J${u.jornada || '?'}</span>${escudo(D, u.rid)}
      <span class="cp-n"><b>${ladoIco(u.casa)}${esc(nom)}</b></span>
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
  const yo = M.yo ? String(M.yo.teamId) : '';
  const mios = suyos.filter((j) => M.dueno[j.id] && String(M.dueno[j.id]) === yo).length;
  const enMercado = new Set((M.mercado || []).map((m) => m.pid));
  const pasa = (j) => (f === 'libres' ? !M.dueno[j.id] : f === 'liga' ? !!M.dueno[j.id] : true);
  let h = `<div class="sec" id="club-plantilla" data-ancla><h2>Plantilla</h2><span class="sub">${suyos.length} jugadores${mios ? `, ${mios} tuyo${mios === 1 ? '' : 's'}` : ''}</span></div>`;
  h += `<div class="filtros">${[['todos', 'Todos', suyos.length], ['libres', 'Libres', libres], ['liga', 'De tu liga', suyos.length - libres]].map(([k, t, c]) => `<button data-accion="filtroClub" data-f="${k}" class="${f === k ? 'activo' : ''}">${t} <span class="apag">${c}</span></button>`).join('')}</div>`;
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

/* ---------- jornada a jornada: el once de cada jornada con sus puntos, los que entraron con sus minutos y quién juega ----------
   (Carlos, 5 nov). Los puntos, los minutos, los goles, las asistencias y las tarjetas, de la ficha de LaLiga de cada jugador del
   club (las estadísticas de la jornada solo dan los puntos). Quién salió de titular y en qué minuto entró cada uno, de ESPN
   (espn.js); si ESPN no lo da para una jornada, el once son los 11 con más minutos (y se avisa debajo). La carga va en app.js
   (cargarJornadasClub): S.clubJor[id] = { t, porJug: { pid: [[n, pts, min, gol, asis, am, roja], …] }, espn: { porN: { n: {
   tit, ent: [[pid, minuto]], sin } } } }.
   Casos previstos: un titular que se lesiona pronto (con ESPN sale bien; sin ESPN, se avisa); uno que llegó o se fue a mitad de
   temporada (con ESPN solo cuenta en las jornadas en que jugó con este club); la ficha de un jugador que no llega (sus puntos, de
   la lista de LaLiga, sin minutos); la jornada que se está jugando (solo las acabadas); un jugador que ya no está en el club o
   en LaLiga (no sale: se dice cuántos faltan). */
const DATO = ['n', 'pts', 'min', 'gol', 'asis', 'am', 'roja'];
/** lo que hizo cada uno del club en una jornada: { pid: { j, n, pts, min, gol, asis, am, roja } } */
function filasDe(S, id, C, n) {
  const out = {};
  for (const [pid, filas] of Object.entries(C.porJug || {})) {
    const j = S.D.maestro[pid];
    if (!j || j.pos < 1 || j.pos > 4) continue;
    const f = (filas || []).find((x) => Number(x[0]) === n);
    if (f) out[pid] = { ...Object.fromEntries(DATO.map((k, i) => [k, f[i] == null ? null : Number(f[i])])), j };
  }
  return out;
}
/** si su ficha no ha llegado: los puntos de la lista de jugadores de LaLiga, sin minutos */
function sinFicha(S, pid, n) {
  const j = S.D.maestro[pid];
  if (!j) return null;
  const w = (j.semanas || []).find((x) => Number(x.n) === n);
  return { j, n, pts: w ? w.pts : null, min: null, gol: 0, asis: 0, am: 0, roja: 0, sinFicha: true };
}
/** las jornadas acabadas del club: { n: { rid, casa, gf, gc, r } } (de los resultados de LaLiga) */
function acabadas(S, id) {
  const out = {};
  for (const p of S.D.resultados || []) {
    if (p.gl == null || p.gv == null) continue;
    const casa = p.localId === id;
    if (!casa && p.visitanteId !== id) continue;
    const gf = casa ? p.gl : p.gv, gc = casa ? p.gv : p.gl;
    out[p.jornada] = { rid: casa ? p.visitanteId : p.localId, casa, gf, gc, r: gf > gc ? 'V' : gf < gc ? 'D' : 'E' };
  }
  return out;
}
/**
 * una jornada del club: { tit: [o], entraron: [o], espn (si los titulares son de ESPN), relleno (cuántos titulares van por
 * minutos), faltan (los que jugaron y no salen) } con o = { j, pts, min, …, entra? }
 */
function jornadaDe(S, id, C, n) {
  const filas = filasDe(S, id, C, n);
  const E = C.espn && C.espn.porN && C.espn.porN[n];
  const fila = (pid) => filas[pid] || sinFicha(S, pid, n);
  if (E && E.tit && E.tit.length >= 7) {
    const tit = E.tit.map(fila).filter(Boolean);
    const entraron = (E.ent || []).map(([pid, m]) => { const o = fila(pid); return o ? { ...o, entra: m } : null; }).filter(Boolean);
    const dentro = new Set([...tit, ...entraron].map((o) => o.j.id));
    // los que ESPN no ha sabido casar: con los minutos de LaLiga, solo si ESPN dice que faltan y el jugador es de los que no se
    // casaron con nadie (si no, el que jugó esa jornada con otro club, antes de fichar, se colaría)
    const nc = new Set(E.nc || []);
    const resto = E.sin ? Object.values(filas).filter((o) => !dentro.has(o.j.id) && nc.has(o.j.id) && o.min > 0).sort((a, b) => b.min - a.min) : [];
    let relleno = 0;
    while (tit.length < 11 && resto.length) {
      const hayPor = tit.some((o) => o.j.pos === 1);
      const i = resto.findIndex((o) => (o.j.pos === 1) === !hayPor || (hayPor && o.j.pos > 1));
      if (i < 0) break;
      tit.push(resto.splice(i, 1)[0]); relleno++;
    }
    for (const o of resto) entraron.push(o);
    entraron.sort((a, b) => (a.entra == null ? 999 : a.entra) - (b.entra == null ? 999 : b.entra) || (b.min || 0) - (a.min || 0));
    return { tit, entraron, espn: true, relleno, faltan: Math.max(0, 11 - tit.length) + Math.max(0, (E.sin || 0) - relleno) };
  }
  const jugaron = Object.values(filas).filter((o) => o.min > 0);
  if (jugaron.length < 7) return null;
  const { tit, resto } = once11(jugaron, (o) => o.min || 0);
  return { tit, entraron: resto.sort((a, b) => b.min - a.min), espn: false, relleno: tit.length, faltan: Math.max(0, 11 - tit.length) };
}
/** las jornadas que se pueden enseñar, de la más vieja a la última */
function jornadasClub(S, id, C) {
  const ac = acabadas(S, id);
  const hayRes = Object.keys(ac).length > 0;
  const ns = new Set();
  for (const filas of Object.values(C.porJug || {})) for (const f of filas || []) if (Number(f[2]) > 0) ns.add(Number(f[0]));
  for (const k of Object.keys((C.espn && C.espn.porN) || {})) ns.add(Number(k));
  // (solo las acabadas: la que se juega aún no tiene todos los minutos)
  return [...ns].filter((n) => (!hayRes || ac[n]) && jornadaDe(S, id, C, n)).sort((a, b) => a - b);
}
/** arriba a la derecha del cromo: gol o tarjeta */
const marcaJ = (o) => (o.gol ? `<span class="cr-est ev gol" title="${o.gol} gol${o.gol > 1 ? 'es' : ''}">${icono('balon')}${o.gol > 1 ? `<b>${o.gol}</b>` : ''}</span>`
  : o.roja || o.am > 1 ? '<span class="cr-est ev" title="Roja"><i class="tarjeta roja"></i></span>' : o.am ? '<span class="cr-est ev" title="Amarilla"><i class="tarjeta amarilla"></i></span>' : '');
const hizoTxt = (o) => [o.gol ? `${o.gol} gol${o.gol > 1 ? 'es' : ''}` : '', o.asis ? `${o.asis} asist.` : '', o.roja || o.am > 1 ? 'roja' : o.am ? 'amarilla' : ''].filter(Boolean).join(' · ');

function jornadaClubHTML(S, id) {
  const { D, M } = S;
  const C = S.clubJor && S.clubJor[id];
  const sec = '<div class="sec" id="club-jornadas"><h2>Jornada a jornada</h2><span class="sub">once, puntos y minutos</span></div>';
  if (D.demo) return sec + nada('En la liga de ejemplo no hay fichas de LaLiga de cada jugador. Con tu liga, aquí sale el once de cada jornada con sus puntos y quién entró desde el banquillo.');
  const jors = C && C.porJug ? jornadasClub(S, id, C) : [];
  if (!jors.length) {
    if (!C || C.cargando) return sec + nada(`Cargando lo que ha jugado cada uno${C && C.prog && C.prog.n ? ` (${C.prog.n} de ${C.prog.de})` : ''}… La primera vez tarda unos segundos.`);
    return sec + nada(C.error ? 'LaLiga no ha dado las fichas de sus jugadores. Se vuelve a probar sola en unos minutos.' : 'Aún no hay jornadas acabadas.');
  }
  const sel = S.jorClub && S.jorClub[id];
  const n = jors.includes(sel) ? sel : jors[jors.length - 1];
  const i = jors.indexOf(n);
  const J = jornadaDe(S, id, C, n);
  const chips = `<div class="jor-chips club-jchips" role="tablist" aria-label="Jornadas">${[...jors].reverse().map((k) => `<button data-accion="jorClub" data-id="${esc(id)}" data-n="${k}" role="tab" aria-selected="${k === n}" class="${k === n ? 'activo' : ''}">J${k}</button>`).join('')}</div>`;
  const u = acabadas(S, id)[n];
  const rival = u ? (D.equipos[u.rid] || {}).nombre || '' : '';
  const todos = [...J.tit, ...J.entraron];
  const total = todos.reduce((s, o) => s + (o.pts || 0), 0);
  const mejor = [...todos].sort((a, b) => (b.pts || 0) - (a.pts || 0))[0];
  const forma = [2, 3, 4].map((p) => J.tit.filter((o) => o.j.pos === p).length).join('-');
  const flecha = (m, ic, txt) => `<button class="jor-fl" ${m ? `data-accion="jorClub" data-id="${esc(id)}" data-n="${m}"` : 'disabled'} aria-label="${txt}">${icono(ic)}</button>`;
  const sub = u ? `${ladoIco(u.casa)}${esc(rival)} <b class="cp-res-t r-${esc(u.r)}">${u.gf}-${u.gc}</b>` : '';
  let h = sec + chips;
  h += `<div class="jor-cab">${flecha(jors[i - 1], 'atras', 'Jornada anterior')}<div class="jor-t"><b>Jornada ${n}</b><span>${sub}</span></div>${flecha(jors[i + 1], 'flecha', 'Jornada siguiente')}
    <div class="jor-pts"><b>${total}</b><small>pts</small><span>entre todos</span></div></div>`;
  const crom = (o) => cromo(M, o.j, { tag: tagDe(S, o.j.id), marca: marcaJ(o), datoFijo: { txt: `${o.pts == null ? '–' : o.pts} pts`, cls: `vivo-p ${ptsCls(o.pts) || 'cero'}` } });
  h += canchaHTML(J.tit, crom, forma);
  if (J.entraron.length) {
    h += `<div class="banquillo"><div class="banq-t">Entraron <span>${J.entraron.length}</span></div>${J.entraron.map((o) => {
      const hizo = hizoTxt(o);
      const cuando = o.entra != null ? `en el ${o.entra}'` : '';
      const mins = o.min != null ? `${o.min} min` : '';
      return `<button class="fila club-ent" data-j="${esc(o.j.id)}">${ava(o.j)}<div class="fila-c"><div class="fila-n">${posTag(o.j)}<span class="nom">${esc(o.j.nombre)}</span></div><div class="fila-s">${[cuando ? `Entró ${cuando}` : '', mins ? `<b>${mins}</b>` : '', esc(hizo)].filter(Boolean).join(' · ')}</div></div>
        <div class="fila-d"><div class="v pf-pts ${ptsCls(o.pts)}">${o.pts == null ? '–' : o.pts}</div></div></button>`;
    }).join('')}</div>`;
  }
  const notas = [];
  if (mejor && mejor.pts > 0) notas.push(`El mejor, ${mejor.j.nombre} con ${mejor.pts} pts.`);
  if (J.faltan) notas.push(`Fal${J.faltan === 1 ? 'ta uno que jugó y no está' : `tan ${J.faltan} que jugaron y no están`} en LaLiga Fantasy (un canterano o alguien que ya se fue).`);
  if (!J.espn) notas.push('Esta jornada no trae quién salió de titular: en el campo van los 11 con más minutos, así que si uno se lesionó al principio puede salir en su sitio el que entró por él.');
  else if (J.relleno) notas.push(`${J.relleno === 1 ? 'Uno de los titulares sale' : `${J.relleno} de los titulares salen`} por sus minutos: no se ha podido saber con seguridad.`);
  if (todos.some((o) => o.sinFicha)) notas.push(C.fallos ? 'A alguno le faltan los minutos: LaLiga no ha dado su ficha ahora; se vuelve a pedir en unas horas.' : 'A alguno LaLiga Fantasy no le da minutos en esta jornada (suele ser un canterano que han dado de alta después).');
  h += `<p class="t2 peq">${esc(notas.join(' '))}</p>`;
  return h + quienJuegaHTML(S, id, C, jors);
}

/** quién juega en el club: cuántas veces ha salido de titular cada uno y qué parte de los minutos ha jugado */
function quienJuegaHTML(S, id, C, jors) {
  const nJ = jors.length;
  const por = {};
  for (const n of jors) {
    const J = jornadaDe(S, id, C, n);
    if (!J) continue;
    const enOnce = new Set(J.tit.map((o) => o.j.id));
    for (const o of [...J.tit, ...J.entraron]) {
      const x = (por[o.j.id] ||= { j: o.j, tit: 0, jug: 0, min: 0 });
      x.jug++; x.min += o.min || 0;
      if (enOnce.has(o.j.id)) x.tit++;
    }
  }
  // (solo los que siguen en el club y en LaLiga)
  const l = Object.values(por).filter((x) => x.j.equipoId === id && enLaLiga(x.j)).sort((a, b) => b.tit - a.tit || b.min - a.min);
  if (!l.length) return '';
  const fijos = l.filter((x) => x.tit / nJ >= 0.8).length;
  const fila = (x) => {
    const pm = Math.round((x.min / (90 * nJ)) * 100);
    const [cls, txt] = x.tit / nJ >= 0.8 ? ['bien', 'Fijo'] : x.tit / nJ >= 0.35 ? ['duda', 'Rota'] : x.tit ? ['mal', 'Suplente'] : ['mal', 'Solo entra'];
    const d = duenoDe(S, x.j.id);
    const de = d ? (d.yo ? ' · <b class="rojo">tuyo</b>' : ` · de ${esc(d.txt)}`) : '';
    return `<button class="fila" data-j="${esc(x.j.id)}">${ava(x.j)}<div class="fila-c"><div class="fila-n">${posTag(x.j)}<span class="nom">${esc(x.j.nombre)}</span></div>
      <div class="fila-s"><b class="qj-${cls}">${txt}</b> · ${x.tit} de ${nJ} de titular${de}</div></div>
      <div class="fila-d"><div class="v">${Math.min(100, pm)} %</div><div class="d apag">${x.min} min</div></div></button>`;
  };
  return `<div class="sec"><h2>Quién juega</h2><span class="sub">${fijos} fijo${fijos === 1 ? '' : 's'} en ${nJ} jornada${nJ === 1 ? '' : 's'}</span></div>${l.map(fila).join('')}
    <p class="t2 peq">Fijo: titular en 8 de cada 10 jornadas o más; rota: entre 4 y 8 de cada 10. A la derecha, qué parte de los minutos de su equipo ha jugado.</p>`;
}

/* ---------- suben y bajan: toda la plantilla, del que más sube al que más baja (Carlos, 9 nov) ----------
   Hoy es lo de la última actualización del mercado (`d1` de M.tend); 7 días, `d7`. Los que no tienen el dato de esos días
   (recién llegados, sin histórico) van abajo, aparte. */
const PERIODOS = [['hoy', 'Hoy'], ['7d', '7 días']];
function subenBajanHTML(S, id, suyos) {
  const { M } = S;
  const per = S.perClub === '7d' ? '7d' : 'hoy';
  const xs = suyos.filter((j) => j.valor > 0).map((j) => {
    const t = M.tend(j.id) || {};
    return { j, t, d: per === '7d' ? t.d7 : t.d1, p: per === '7d' ? t.p7 : t.p1 };
  });
  const con = xs.filter((x) => x.d != null).sort((a, b) => b.d - a.d || b.j.valor - a.j.valor);
  const sin = xs.filter((x) => x.d == null).sort((a, b) => b.j.valor - a.j.valor);
  const suben = con.filter((x) => x.d > 0), igual = con.filter((x) => x.d === 0), bajan = con.filter((x) => x.d < 0);
  const total = con.reduce((a, x) => a + x.d, 0);
  const cuandoTxt = per === '7d' ? 'en 7 días' : 'hoy';
  let h = `<div class="sb-cab"><div class="sb-sel" role="tablist" aria-label="Periodo">${PERIODOS.map(([k, t]) => `<button data-accion="perClub" data-p="${k}" role="tab" aria-selected="${k === per}" class="${k === per ? 'activo' : ''}">${t}</button>`).join('')}</div>
    ${con.length ? `<div class="sb-tot"><b class="${clase(total)}">${total ? eur(total, { dec: 1, signo: true }) : '='}</b><span>entre todos ${cuandoTxt}</span></div>` : ''}</div>`;
  if (!xs.length) return h + nada('No tengo su plantilla.');
  if (!con.length) return h + nada(`Aún no tengo lo que han cambiado de valor ${cuandoTxt}. Dale a Actualizar.`);
  h += `<p class="sb-res"><span class="sube">${suben.length} suben</span> · <span class="baja">${bajan.length} bajan</span>${igual.length ? ` · ${igual.length} igual` : ''}</p>`;
  // la barra va en proporción al que más se mueve del club, para que se vea de un vistazo quién tira y quién se hunde
  const max = Math.max(...con.map((x) => Math.abs(x.d)), 1);
  const fila = (x) => {
    const cls = clase(x.d);
    const der = `<div class="v sb-d ${cls}">${x.d ? eur(x.d, { dec: 1, signo: true }) : '='}</div><div class="d">${x.p != null && x.d ? `<span class="${cls}">${pct(x.p)}</span> · ` : ''}${eur(x.j.valor, { dec: 1 })}</div>`;
    const barra = x.d ? `<span class="sb-barra ${cls}" style="--w:${Math.max(2, Math.round((Math.abs(x.d) / max) * 100))}%"></span>` : '';
    return filaJugador({ j: x.j, tend: x.t }, { sub: `${duenoTxt(S, x.j.id)}${barra}`, pills: [estadoPill(x.j)], derecha: der });
  };
  const grupo = (txt, l) => (l.length ? `<div class="grupo"><span>${txt}</span><span>${l.length}</span></div>${l.map(fila).join('')}` : '');
  h += grupo('Suben', suben) + grupo('Igual', igual) + grupo('Bajan', bajan);
  if (sin.length) h += `<div class="grupo"><span>Sin datos ${cuandoTxt}</span><span>${sin.length}</span></div>${sin.map((x) => filaJugador({ j: x.j, tend: x.t }, { sub: duenoTxt(S, x.j.id), pills: [estadoPill(x.j)], derecha: `<div class="v">${eur(x.j.valor, { dec: 1 })}</div><div class="d apag">sin datos</div>` })).join('')}`;
  return h;
}

/* la ficha va en pestañas (Carlos, 9 nov: «mucho más clara y limpia, menos cosas a la vez»). Siempre se abre en Resumen:
   S.segClub = { id, seg } solo vale para el club que la eligió (app.js lo borra al abrir un club desde fuera) */
const PESTANAS = [['resumen', 'Resumen'], ['suben', 'Suben y bajan'], ['plantilla', 'Plantilla'], ['partidos', 'Partidos']];
export function segDeClub(S, id) {
  const x = S.segClub;
  return x && String(x.id) === String(id) && PESTANAS.some(([k]) => k === x.seg) ? x.seg : 'resumen';
}

export function fichaClub(S, id) {
  const { D, M } = S;
  const e = (D.equipos || {})[id];
  if (!e) return nada('No encuentro este club.');
  const t = M.equipoLiga(id), r = M.racha(id, 5);
  const suyos = Object.values(D.maestro || {}).filter((j) => j.equipoId === id && j.pos >= 1 && j.pos <= 5 && enLaLiga(j));
  const eu = europaDe(e.nombre);
  let h = `<div class="club-hero"${estiloClub(id, e.nombre)}>${camisetaClub(id, e.nombre, 'ch-cam')}${escudo(D, id, 'club-g')}<div class="ch-t"><h2>${esc(e.nombre)}</h2>
    <div class="ch-s">${t ? `<span>${t.pos}º · ${t.pts} pts</span>` : ''}${eu ? `<span class="ch-eu eu-${eu}">${COMP[eu]}</span>` : ''}${r ? rachaHTML(r, e.nombre) : ''}</div></div></div>`;
  const seg = segDeClub(S, id);
  h += `<div class="tabs club-tabs"><div class="tabs-in" role="tablist" aria-label="Partes de la ficha del club">${PESTANAS.map(([k, txt]) => `<button data-accion="segClub" data-id="${esc(id)}" data-s="${k}" role="tab" aria-selected="${k === seg}" class="${k === seg ? 'activo' : ''}">${txt}</button>`).join('')}</div></div>`;
  if (seg === 'suben') return h + subenBajanHTML(S, id, suyos);
  if (seg === 'plantilla') return h + plantillaHTML(S, suyos);
  if (seg === 'partidos') return h + (partidosHTML(S, id) || '') + jornadaClubHTML(S, id);
  const o = onceDeEquipo(S, id);
  const once = `<div class="sec"><h2>Su once</h2><span class="sub">${o ? `${o.conf ? 'confirmado' : 'probable'}, ${o.forma}` : 'probable'}</span></div>`
    + (o ? `${o.campo}<p class="t2 peq">Arriba, de quién es en tu liga. Debajo, lo probable que es que salga de titular.</p>` : nada(S.D.demo ? 'En la liga de ejemplo cada club trae solo sus 7 jugadores de más valor, así que no da para un once. Con tu liga, aquí sale el once probable del club en el campo.' : 'Aún no hay once probable de este club.'));
  // (en el ordenador la ficha va en un panel de 620 px: una sola columna, como en el móvil)
  return h + proximoHTML(S, id) + once + bajasHTML(S, suyos) + noticiasHTML(S, id, suyos);
}

/** el nombre del club, para el botón de volver */
export const nombreClub = (S, id) => ((S.D.equipos || {})[id] || {}).nombre || 'el club';
