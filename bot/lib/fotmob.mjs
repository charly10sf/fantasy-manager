// FotMob como fuente EXTRA del directo (Carlos, 7 nov, 22:43): ESPN sigue siendo la base y el tuit NUNCA espera a FotMob. FotMob da,
// de cada gol, de dónde se tiró (coordenadas), el xG, la situación (falta, córner, contragolpe, penalti…) y, del partido, si hay un VAR
// pendiente. Es una API sin contrato (no oficial, sin clave): puede cortar las IP de GitHub Actions, cambiar sin aviso o pedir un token,
// y todo lo de aquí está hecho para que, si falla, el directo salga igual con ESPN (cada función devuelve null y lo apunta, nunca lanza).
// Rutas (probadas el 7 nov): /matches?date=AAAAMMDD (partidos del día de todas las ligas) y /matchDetails?matchId=… (detalle de uno).
// El campo mide 105 x 68 y el disparo ataca hacia x = 105: la distancia a la portería es la hipotenusa de (105 - x, 34 - y).
import { json } from './http.mjs';
import { norm } from './texto.mjs';
import { comparten } from './relato.mjs';

export const FOTMOB = process.env.FOTMOB_BASE || 'https://www.fotmob.com/api/data';
export const LIGAS = { liga: 87, champions: 42, copa: 138 };
export const distanciaM = (x, y) => Math.hypot(105 - Number(x), 34 - Number(y));

/** los partidos de LaLiga (u otra liga: `ligas`) de un detalle de /matches: [{ id, home:{id,name,score}, away, status }] */
export function leerPartidos(d, ligas = [LIGAS.liga]) {
  const out = [];
  for (const l of (d && d.leagues) || []) {
    const lid = Number(l.primaryId ?? l.id);
    if (!ligas.includes(lid) && !ligas.includes(Number(l.id))) continue;
    for (const m of l.matches || []) out.push({ ...m, ligaId: lid });
  }
  return out;
}

/** el partido de FotMob de un partido de ESPN, por los dos nombres de equipo (y la hora de saque, si hay: ±3 h) */
export function casarPartido(partidos, casa, fuera, { fecha = null } = {}) {
  const ok = (partidos || []).filter((p) => p.home && p.away && comparten(p.home.name, casa) && comparten(p.away.name, fuera));
  if (ok.length > 1 && fecha) {
    const t = Date.parse(fecha);
    const cerca = ok.filter((p) => Math.abs(Date.parse((p.status || {}).utcTime) - t) < 3 * 36e5);
    if (cerca.length) return cerca[0];
  }
  return ok[0] || null;
}

/**
 * El detalle de un partido de FotMob en lo que le importa al directo.
 * { id, enJuego, acabado, reloj ('88:37'), varPendiente, goles: [{ jugador, jugadorId, min, extra, esLocal, marcador: [l, v], propia, penalti,
 *   situacion, tiro, x, y, distancia, xg, dentroArea, asistente }], anulados: [{ jugador, min, extra, esLocal, motivo }] }
 * Un gol anulado por el VAR desaparece de `goles` (en los 114 partidos acabados de LaLiga ninguno quedó) y sale en `anulados`.
 */
export function leerDetalle(d) {
  const ev = ((((d || {}).content || {}).matchFacts || {}).events || {}).events || [];
  const shots = ((((d || {}).content || {}).shotmap) || {}).shots || [];
  const goles = [], anulados = [];
  let varPendiente = !!(d && d.hasPendingVAR);
  for (const e of ev) {
    if (e.type === 'Goal') {
      const pid = e.playerId ?? (e.player && e.player.id);
      const s = e.shotmapEvent || shots.find((x) => x.eventType === 'Goal' && String(x.playerId) === String(pid) && x.min === e.time) || null;
      const propia = !!(e.ownGoal || (s && s.isOwnGoal));
      goles.push({ jugador: e.fullName || e.nameStr || (e.player && e.player.name) || '', jugadorId: pid != null ? String(pid) : null, min: Number(e.time) || 0, extra: Number(e.overloadTime) || 0,
        esLocal: !!e.isHome, marcador: Array.isArray(e.newScore) ? e.newScore.map(Number) : null, propia,
        penalti: !!(s && s.situation === 'Penalty') || /penalty/i.test(String(e.goalDescription || '')), situacion: s ? s.situation : null, tiro: s ? s.shotType : null,
        x: s ? Number(s.x) : null, y: s ? Number(s.y) : null, distancia: s && !propia && s.x != null && s.y != null ? distanciaM(s.x, s.y) : null,
        xg: s ? Number(s.expectedGoals) : null, dentroArea: s ? !!s.isFromInsideBox : null,
        asistente: String(e.assistStr || '').replace(/^assist by /i, '').trim() || null });
    } else if (e.type === 'VAR') {
      const v = e.VAR || {};
      if (v.pendingDecision) varPendiente = true;
      const dec = v.decision || {};
      if ((dec.key || []).some((k) => /goal_cancelled/.test(k))) anulados.push({ jugador: e.nameStr || (e.player && e.player.name) || '', min: Number(e.time) || 0, extra: Number(e.overloadTime) || 0, esLocal: !!e.isHome, motivo: (dec.value || [])[1] || null });
    }
  }
  // de dónde es cada jugador de las alineaciones (lib/nacionalidad.mjs)
  const lu = (((d || {}).content || {}).lineup) || {};
  const paises = [];
  for (const lado of [lu.homeTeam, lu.awayTeam]) for (const p of [...((lado && lado.starters) || []), ...((lado && lado.subs) || [])]) {
    if (p && p.id != null && p.name && p.countryCode) paises.push({ id: String(p.id), nombre: p.name, codigo: p.countryCode });
  }
  const st = (d && d.header && d.header.status) || {};
  return { id: String((d && d.general && d.general.matchId) || ''), enJuego: !!st.ongoing || (!!st.started && !st.finished), acabado: !!st.finished,
    reloj: (st.liveTime && st.liveTime.long) || null, varPendiente, goles, anulados, paises };
}

const total = (g) => g.min + (g.extra || 0);
export const mismoNombre = (a, b) => {
  const A = norm(a).split(' ').filter((t) => t.length >= 3), B = norm(b).split(' ').filter((t) => t.length >= 3);
  return A.length > 0 && B.length > 0 && (A[A.length - 1] === B[B.length - 1] || A.some((t) => B.includes(t)));
};
/**
 * El gol de FotMob que es el de una jugada de ESPN: mismo lado, a menos de 2 minutos, y que cuadre el marcador de después del gol o el
 * nombre del goleador. Con dos candidatos igual de buenos, no hay (mejor sin FotMob que con el gol equivocado). `usados`: los que ya
 * casó otra jugada.
 */
export function casarGol(golesFm, { esCasa, jugador, min, extra = 0, marcador = null }, usados = new Set()) {
  const t = min + extra;
  const cand = (golesFm || []).filter((g) => !g.propia && g.esLocal === esCasa && !usados.has(g) && Math.abs(total(g) - t) <= 2)
    .map((g) => {
      const marc = !!(marcador && g.marcador && g.marcador[0] === marcador[0] && g.marcador[1] === marcador[1]);
      const nom = mismoNombre(g.jugador, jugador);
      return { g, puntos: (marc ? 2 : 0) + (nom ? 2 : 0) + (total(g) === t ? 1 : 0), ok: marc || nom };
    }).filter((x) => x.ok).sort((a, b) => b.puntos - a.puntos);
  if (!cand.length) return null;
  if (cand[1] && cand[1].puntos === cand[0].puntos) return null;
  return cand[0].g;
}

/**
 * El cliente de FotMob de una ejecución (con caché de lo ya pedido). `pedir(url)` devuelve el JSON (por defecto, con 6 s de tope y sin
 * reintentos: FotMob no puede retrasar un tuit). Cada petición se apunta en `salud` ({ ok, fallos, ultimoFallo }); si falla, devuelve null.
 */
export function crearFotmob({ base = FOTMOB, pedir = null, log = () => {}, ahora = () => Date.now(), tiempo = 6000 } = {}) {
  const get = pedir || ((url) => json(url, { tiempo, reintentos: 0 }));
  const salud = { ok: 0, fallos: 0, ultimoFallo: null, mediaMs: 0 };
  const cache = new Map();
  const pide = (ruta) => {
    if (!cache.has(ruta)) {
      const t0 = Date.now();
      cache.set(ruta, Promise.resolve().then(() => Promise.race([get(`${base}${ruta}`), new Promise((_, no) => setTimeout(() => no(new Error(`sin respuesta en ${tiempo} ms`)), tiempo + 500).unref())])).then((d) => { salud.ok++; salud.mediaMs += (Date.now() - t0 - salud.mediaMs) / salud.ok; return d; })
        .catch((e) => { salud.fallos++; salud.ultimoFallo = { t: new Date(ahora()).toISOString(), motivo: String((e && e.message) || e).slice(0, 120) }; log(`  (fotmob) ${ruta.replace(/\?.*/, '')}: ${salud.ultimoFallo.motivo}`); return null; }));
    }
    return cache.get(ruta);
  };
  return {
    salud,
    /** los partidos de un día (AAAAMMDD, hora de Madrid) de las ligas pedidas; [] si FotMob no contesta */
    async partidosDelDia(fecha, ligas = [LIGAS.liga]) { return leerPartidos(await pide(`/matches?date=${fecha}&timezone=Europe%2FMadrid&ccode3=ESP`), ligas); },
    /** el detalle (leído) de un partido; null si FotMob no contesta. Siempre fresco en la primera petición de la ejecución */
    async detalle(id) { const d = await pide(`/matchDetails?matchId=${id}`); return d ? leerDetalle(d) : null; },
    /** el calendario de una liga: [{ id, home, away, status }] */
    async calendario(ligaId) { const d = await pide(`/leagues?id=${ligaId}`); return d && d.fixtures && d.fixtures.allMatches ? d.fixtures.allMatches : null; },
  };
}
