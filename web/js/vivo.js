/* La jornada en directo: los puntos de cada jugador mientras se juega y los de cada equipo de tu liga en la jornada.
   Sale de la API de LaLiga Fantasy (la misma que usa su app):
   - /stats/v1/competition/1/stats/week/{n}: los partidos de la jornada con los puntos de cada jugador (weekPoints)
   - /teams/{equipo}/lineup: el once que tienes puesto en LaLiga; /teams/{equipo}/lineup/week/{n}: el de un rival
   - /leagues/{liga}/standing: la clasificación, que trae los puntos de cada equipo en la jornada en juego
     (livePoints); si no los trae, /leagues/{liga}/standing/{n}
   Si las estadísticas no responden, los puntos de cada jugador salen de /players (weekPoints de cada jornada).
   Solo con una jornada en juego; con la app abierta se mira cada 2 minutos. Lo que no cuadre se queda fuera: la
   forma de cada respuesta queda en el registro del diagnóstico. */
import { api } from './api.js';
import { norm, num } from './util.js';

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

/**
 * la jornada n en directo: { t, n, puntos: { pid: pts }, once: [pid] | null, equipos: { teamId: pts }, enJuego,
 * acabados, partidos }
 */
export async function enVivo(D, n, yoTid) {
  let partidos = [];
  try { partidos = lista(await api.statsSemana(n)); } catch (e) { if (e.sesion) throw e; }
  const puntos = {}, porNombre = {};
  let enJuego = 0, acabados = 0;
  for (const m of partidos) {
    const st = Number(m && m.matchState);
    if (st === 7) acabados++;
    else if (st >= 2) enJuego++;
    for (const eq of [m && m.homeTeam, m && m.awayTeam, m && m.local, m && m.visitor]) {
      for (const p of (eq && eq.players) || []) {
        const v = Number(p.weekPoints != null ? p.weekPoints : p.points);
        if (!Number.isFinite(v)) continue;
        if (p.id != null) puntos[String(p.id)] = v;
        const k = norm(p.nickname || p.name || '');
        if (k) porNombre[k] = v;
      }
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
  // tu once de verdad (el que tienes puesto en LaLiga) y los puntos de cada equipo en la jornada
  let once = null;
  if (yoTid) {
    try { const ids = idsOnce(await api.miOnce(yoTid)); if (ids.length >= 5) once = ids; } catch (e) { if (e.sesion) throw e; }
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
  return { t: Date.now(), n, puntos, once, equipos, enJuego, acabados, partidos: partidos.length };
}

/** el once de un rival en la jornada n: [pid] (o null si LaLiga no lo enseña) */
export async function onceRival(tid, n) {
  const ids = idsOnce(await api.onceSemana(tid, n));
  return ids.length >= 5 ? ids : null;
}
