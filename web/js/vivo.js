/* La jornada en directo: los partidos, los puntos de cada jugador mientras se juega y los de cada equipo de tu liga.
   Sale de la API de LaLiga Fantasy (la misma que usa su app):
   - /stats/v1/competition/1/stats/week/{n}: los partidos de la jornada (estado, marcador) con los puntos de cada
     jugador (weekPoints); /calendar?weekNumber={n}: el estado y el marcador de cada partido, por si las estadísticas
     no lo traen
   - /teams/{equipo}/lineup: el once que tienes puesto en LaLiga; /teams/{equipo}/lineup/week/{n}: el de un rival
   - /leagues/{liga}/standing: la clasificación, que trae los puntos de cada equipo en la jornada en juego
     (livePoints); si no los trae, /leagues/{liga}/standing/{n}
   Si las estadísticas no responden, los puntos de cada jugador salen de /players (weekPoints de cada jornada).
   Solo con una jornada en juego; con la app abierta se mira cada 2 minutos (cada minuto en la pestaña Directo). Lo que
   no cuadre se queda fuera: la forma de cada respuesta queda en el registro del diagnóstico. */
import { api } from './api.js';
import { norm, num, ms } from './util.js';
import * as N from './normalizar.js';

/** la lista de una respuesta, venga como venga ({ data: [...] }, [...], { data: { data: [...] } }) */
function lista(r) {
  const d = r && r.data !== undefined ? r.data : r;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && typeof d === 'object') { const v = Object.values(d).find(Array.isArray); if (v) return v; }
  return [];
}

/** los jugadores de una alineación de LaLiga (los once y el entrenador): [pid] */
export function idsOnce(r) {
  const d = r && r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : r;
  const f = d && (d.formation || d.lineup || d.players);
  const out = [];
  const meter = (x) => {
    const pm = (x && (x.playerMaster || x.player)) || x;
    const id = pm && (pm.id != null ? pm.id : pm.playerId);
    if (id != null && !out.includes(String(id))) out.push(String(id));
  };
  if (Array.isArray(f)) f.forEach(meter);
  else if (f && typeof f === 'object') {
    for (const l of Object.values(f)) {
      if (Array.isArray(l)) l.forEach(meter);
      else if (l && typeof l === 'object' && (l.playerMaster || l.id != null)) meter(l);
    }
  }
  return out;
}

/** la formación de una alineación de LaLiga ([defensas, medios, delanteros], que sumen 10) o null */
export function formaOnce(r) {
  const d = r && r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : r;
  const f = d && d.formation && Array.isArray(d.formation.tacticalFormation) ? d.formation.tacticalFormation.map(Number) : null;
  return f && f.length === 3 && f.every((x) => Number.isInteger(x) && x >= 1 && x <= 6) && f[0] + f[1] + f[2] === 10 ? f : null;
}

const txt = (x) => (x == null || x === '' ? '' : String(x));
const n0 = (v) => (v === '' || v == null || Number.isNaN(+v) ? null : +v);
/** un dato de la estadística de un jugador: [valor, puntos] o el valor solo */
const st = (x, k) => { const v = x && x.stats && x.stats[k]; if (v == null) return null; return Array.isArray(v) ? Number(v[0]) || 0 : Number(v) || 0; };

/**
 * los partidos de la jornada n tal y como los dan las estadísticas de LaLiga, casados con el calendario:
 * [{ id, lid, vid, st, gl, gv, fecha, jug: [{ id, nom, l, pts, pos, min?, gol?, asis?, am?, roja? }] }]
 * (st es el estado de LaLiga: 7 acabado, 2 primera parte, 4 segunda; l, si juega en casa)
 */
export function partidosDe(crudo, D, n) {
  const cal = ((D && D.partidos) || []).filter((p) => Number(p.jornada) === Number(n));
  const out = [];
  for (const m of crudo || []) {
    if (!m || typeof m !== 'object') continue;
    const L = m.homeTeam || m.local || null, Vi = m.awayTeam || m.visitor || null;
    let lid = txt(m.localId != null ? m.localId : L && typeof L === 'object' ? (L.id != null ? L.id : L.teamId) : null);
    let vid = txt(m.visitorId != null ? m.visitorId : Vi && typeof Vi === 'object' ? (Vi.id != null ? Vi.id : Vi.teamId) : null);
    const c = cal.find((p) => m.id != null && String(p.id) === String(m.id)) || cal.find((p) => p.localId === lid && p.visitanteId === vid) || null;
    if (c) { lid = c.localId; vid = c.visitanteId; }
    const jug = [];
    for (const [l, eq] of [[true, L], [false, Vi]]) {
      for (const p of (eq && Array.isArray(eq.players) ? eq.players : [])) {
        if (!p || typeof p !== 'object') continue;
        const pm = p.playerMaster && typeof p.playerMaster === 'object' ? p.playerMaster : p;
        const id = pm.id != null ? pm.id : p.playerId;
        const v = Number(p.weekPoints != null ? p.weekPoints : p.points != null ? p.points : pm.weekPoints);
        const x = { id: txt(id), nom: String(pm.nickname || pm.name || p.nickname || p.name || ''), l, pts: Number.isFinite(v) ? v : null, pos: Number(pm.positionId || p.positionId) || 0 };
        // si trae lo que ha hecho (minutos, goles…), también
        const s = p.stats ? p : Array.isArray(p.playerStats) ? p.playerStats.find((y) => Number(y.weekNumber) === Number(n)) || null : null;
        if (s && s.stats) { x.min = st(s, 'mins_played'); x.gol = st(s, 'goals'); x.asis = st(s, 'goal_assist'); x.am = st(s, 'yellow_card'); x.roja = st(s, 'red_card'); }
        if (x.id || x.nom) jug.push(x);
      }
    }
    const gl = n0(m.localScore != null ? m.localScore : m.homeScore), gv = n0(m.visitorScore != null ? m.visitorScore : m.awayScore);
    const est = n0(m.matchState != null ? m.matchState : m.status);
    out.push({ id: txt(m.id != null ? m.id : c && c.id), lid, vid, st: est, gl, gv, fecha: (c && c.fecha) || ms(m.matchDate || m.date) || null, jug });
  }
  return out;
}
/** junta lo del calendario (estado y marcador de cada partido) con lo de las estadísticas */
function conCalendario(ps, cal) {
  for (const c of cal) {
    const p = ps.find((x) => (c.id && x.id === String(c.id)) || (x.lid === c.localId && x.vid === c.visitanteId));
    const est = n0(c.estado);
    if (p) {
      if (p.st == null || (est != null && est > p.st)) p.st = est;
      if (p.gl == null && c.gl != null) { p.gl = c.gl; p.gv = c.gv; }
      if (!p.fecha) p.fecha = c.fecha;
    } else ps.push({ id: txt(c.id), lid: c.localId, vid: c.visitanteId, st: est, gl: c.gl, gv: c.gv, fecha: c.fecha, jug: [] });
  }
  return ps.sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
}
/** los partidos de una jornada con los puntos de cada uno (para una jornada que no es la que se juega: al tocar un partido) */
export async function jornadaStats(D, n) {
  let crudo = [];
  try { crudo = lista(await api.statsSemana(n)); } catch (e) { if (e.sesion) throw e; }
  let cal = [];
  try { cal = N.partidos(await api.calendario(n), D.equipos || {}, n); } catch (e) { if (e.sesion) throw e; cal = ((D && D.partidos) || []).filter((p) => Number(p.jornada) === Number(n)); }
  return { t: Date.now(), n, ps: conCalendario(partidosDe(crudo, D, n), cal) };
}

/**
 * la jornada n en directo: { t, n, puntos: { pid: pts }, once: [pid] | null, equipos: { teamId: pts }, enJuego,
 * acabados, ps: los partidos (partidosDe) }
 */
export async function enVivo(D, n, yoTid) {
  const { ps } = await jornadaStats(D, n);
  const puntos = {}, porNombre = {};
  let enJuego = 0, acabados = 0;
  for (const m of ps) {
    if (m.st === 7) acabados++;
    else if (m.st >= 2) enJuego++;
    for (const p of m.jug) {
      if (p.pts == null) continue;
      if (p.id) puntos[p.id] = p.pts;
      const k = norm(p.nom);
      if (k) porNombre[k] = p.pts;
    }
  }
  // sin estadísticas: los puntos de la jornada de la lista de jugadores (weekPoints)
  if (!Object.keys(puntos).length) {
    try {
      for (const p of lista(await api.jugadores())) {
        const w = Array.isArray(p.weekPoints) ? p.weekPoints.find((x) => Number(x.weekNumber) === Number(n)) : null;
        if (w && w.points != null && p.id != null) puntos[String(p.id)] = Number(w.points);
      }
    } catch (e) { if (e.sesion) throw e; }
  }
  // por si el id de la estadística no es el del jugador: por el nombre
  for (const j of Object.values(D.maestro || {})) {
    if (puntos[j.id] != null) continue;
    const v = porNombre[norm(j.nombre)] != null ? porNombre[norm(j.nombre)] : porNombre[norm(j.largo)];
    if (v != null) puntos[j.id] = v;
  }
  // tu once de la jornada: el que puntúa en ella (/lineup/week/{n}); el de ahora (/lineup) puede ser ya otro, si has
  // cambiado algo después de que empezara. Si LaLiga no da el de la jornada, el de ahora
  let once = null, forma = null;
  if (yoTid) {
    for (const pedirlo of [() => api.onceSemana(yoTid, n), () => api.miOnce(yoTid)]) {
      try { const r = await pedirlo(); const ids = idsOnce(r); if (ids.length >= 5) { once = ids; forma = formaOnce(r); break; } } catch (e) { if (e.sesion) throw e; }
    }
  }
  const equipos = {};
  if (D.liga && D.liga.id) {
    // la clasificación trae los de la jornada en juego (livePoints)
    try {
      for (const it of lista(await api.clasificacion(D.liga.id))) {
        const t = (it && it.team) || {};
        const tid = it.teamId != null ? it.teamId : t.id;
        if (tid != null && it.livePoints != null) equipos[String(tid)] = num(it.livePoints);
      }
    } catch (e) { if (e.sesion) throw e; }
  }
  if (D.liga && D.liga.id && !Object.keys(equipos).length) {
    try {
      for (const it of lista(await api.clasifSemana(D.liga.id, n))) {
        const t = (it && it.team) || {};
        const tid = it.teamId != null ? it.teamId : t.id != null ? t.id : it.id;
        const v = it.points != null ? it.points : it.weekPoints != null ? it.weekPoints : t.weekPoints;
        if (tid != null && v != null) equipos[String(tid)] = num(v);
      }
    } catch (e) { if (e.sesion) throw e; }
  }
  return { t: Date.now(), n, puntos, once, forma, equipos, enJuego, acabados, ps };
}

/** el once de un rival en la jornada n: [pid] (o null si LaLiga no lo enseña) */
export async function onceRival(tid, n) {
  const ids = idsOnce(await api.onceSemana(tid, n));
  return ids.length >= 5 ? ids : null;
}
