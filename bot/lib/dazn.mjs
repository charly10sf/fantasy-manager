// ¿Están ya los puntos DEFINITIVOS de un partido acabado? Final, MVP, resumen y lo que queda del directo no salen hasta entonces.
//
// Historia: el 2 nov (J11) Mario Soriano salió con 9 y eran 13 (faltaba la valoración DAZN). Se puso una espera a que los que más
// puntúan tuvieran la valoración DAZN (`marca_points`) en su ficha. NO BASTA: el 6 nov (J12, Sevilla-Alavés 0-0, partido 113) a las
// 23:01, seis minutos después del pitido, los seis primeros ya tenían valoración y el tweet salió con Sivera 10 (acabó con 15),
// Kike Salas 3 (8), Vlachodimos 0 (10) y T. Martínez -2 (1). Faltaba, entre otras cosas, todo lo de la portería a cero: la ficha de
// Sivera trae hoy `goals_conceded: [0, 4]` y aquella noche no. La valoración DAZN llega en directo; lo que llega tarde es el resto.
//
// Carlos (7 nov, 00:55): a los 10-15 min del pitido Sivera ya tenía sus 15 en la app y otras cuentas ya lo tuiteaban. Así que la espera
// es corta (20 min desde que el bot lo ve acabado y 10 min con los puntos quietos: dos ejecuciones seguidas sin cambios), y lo que
// de verdad protege es que los puntos no se muevan y la portería a cero esté sumada.
// Ahora un partido está listo solo si se cumplen LAS CUATRO:
//   1. han pasado `minTrasFinal` minutos desde que el bot lo vio acabado (matchState 7);
//   2. los puntos de TODOS los jugadores del partido (stats/week) no han cambiado en los últimos `minEstable` minutos (huella guardada
//      en el registro, `puntosPartido`, de una ejecución a otra);
//   3. la mayoría de los que más puntúan tiene ya la valoración DAZN en su ficha (lo de antes);
//   4. si un equipo ha dejado la portería a cero, su portero (si jugó 60 minutos o más) ya tiene los puntos de la portería a cero.
// Si pasan `esperaHoras` desde el final sin cumplirse, sale con lo que haya (mejor tarde que nunca; queda en el log).
import { createHash } from 'node:crypto';

const TOP = 6, MINIMO = 3;

/** puntos de valoración de un jugador en la jornada, o null si la ficha aún no los trae */
export function puntosValoracion(ficha, jornada) {
  const s = statsJornada(ficha, jornada);
  const mp = s && s.marca_points;
  return Array.isArray(mp) && Number.isFinite(Number(mp[1])) ? Number(mp[1]) : null;
}

/** las stats de la jornada de una ficha (player/{id}), o null */
export function statsJornada(ficha, jornada) {
  const s = ((ficha && ficha.playerStats) || []).find((x) => Number(x.weekNumber) === Number(jornada));
  return (s && s.stats) || null;
}

/** huella de los puntos de todos los jugadores de un partido (cambia si cambia un solo punto de uno solo) */
export function huellaPartido(m) {
  const xs = [m.local, m.visitor].flatMap((l) => (l.players || []).map((p) => `${p.id}:${p.weekPoints == null ? '-' : p.weekPoints}`)).sort();
  return createHash('sha1').update(xs.join(',')).digest('hex').slice(0, 12);
}

/**
 * ¿Le falta al portero de un equipo con la portería a cero lo de la portería a cero? true si falta (no está listo).
 * Solo cuenta si jugó 60 minutos o más (si no, LaLiga no se la da).
 */
export function faltaPorteriaCero(st) {
  if (!st) return true;
  const min = Number((st.mins_played || [])[0]) || 0;
  if (min < 60) return false;
  const gc = st.goals_conceded;
  return !(Array.isArray(gc) && Number(gc[1]) > 0);
}

/**
 * Devuelve una función (partido de stats/week) => { listo, motivo, porPlazo }. Guarda el resultado de cada partido listo en la
 * ejecución y la huella de los puntos en el registro (`registro.datos.puntosPartido`) para la siguiente.
 */
export function crearDazn({ ficha, jornada, registro = null, esperaHoras = 6, minTrasFinal = 20, minEstable = 10, ahora = () => Date.now(), log = () => {} }) {
  const listos = new Map();
  const vistos = new Map();
  const datos = registro ? (registro.datos ||= {}) : {};
  const est = (datos.puntosPartido ||= {});
  // limpieza: lo de hace más de 4 días ya no sirve
  for (const [k, v] of Object.entries(est)) if (ahora() - (v.fin || 0) > 4 * 864e5) delete est[k];

  return async (m) => {
    if (listos.has(m.id)) return listos.get(m.id);
    if (vistos.has(m.id)) return vistos.get(m.id);
    const t = ahora();
    const clave = `${jornada}|${m.id}`;
    const h = huellaPartido(m);
    let st = est[clave];
    let cambio = false;
    if (!st) { st = est[clave] = { h, desde: t, fin: t }; cambio = true; }
    else if (st.h !== h) { st.h = h; st.desde = t; cambio = true; }
    if (cambio && registro && registro.fichero) registro.guardar();
    // si el bot lo vio acabado muy tarde (estaba parado, en silencio…), el final se estima a las 2 h del saque
    const saque = Date.parse(m.date) || t;
    // sin registro (las respuestas de Telegram) no hay historia entre ejecuciones: el final, a los 115 min del saque, y sin la prueba
    // de los puntos quietos
    const fin = !registro ? saque + 115 * 60e3 : st.fin - saque > 3.5 * 3600e3 ? saque + 2 * 3600e3 : st.fin;
    const trasFinal = (t - fin) / 60e3, estable = (t - st.desde) / 60e3;
    const porPlazo = t - fin > esperaHoras * 3600e3;

    const faltan = [];
    if (trasFinal < minTrasFinal) faltan.push(`${Math.round(trasFinal)} de ${minTrasFinal} min desde el final`);
    if (registro && estable < minEstable) faltan.push(`puntos sin cambiar ${Math.round(estable)} de ${minEstable} min`);
    // las fichas solo se piden si lo de arriba ya se cumple (son llamadas a LaLiga)
    let con = 0, de = 0;
    if (!faltan.length) {
      const jugadores = [...(m.local.players || []), ...(m.visitor.players || [])].filter((p) => p.weekPoints != null)
        .sort((a, b) => Number(b.weekPoints) - Number(a.weekPoints) || Number(a.id) - Number(b.id)).slice(0, TOP);
      de = jugadores.length;
      for (const p of jugadores) {
        const v = puntosValoracion(await ficha(p.id).catch(() => null), jornada);
        if (v != null && v > 0) con++;
      }
      const hace = de ? Math.min(MINIMO, Math.ceil(de / 2)) : 0;
      if (!(hace > 0 && con >= hace)) faltan.push(`valoración DAZN en ${con} de ${de}`);
      // portería a cero: el portero del que no ha encajado (el de más puntos de los porteros de ese lado que han jugado)
      for (const [lado, encajados] of [[m.local, Number(m.visitorScore)], [m.visitor, Number(m.localScore)]]) {
        if (encajados !== 0) continue;
        const por = (lado.players || []).filter((p) => p.positionId === 1 && p.weekPoints != null)
          .sort((a, b) => Number(b.weekPoints) - Number(a.weekPoints))[0];
        if (!por) continue;
        const s = statsJornada(await ficha(por.id).catch(() => null), jornada);
        if (faltaPorteriaCero(s)) faltan.push(`portería a cero de ${por.nickname || por.name} sin sumar`);
      }
    }
    const listo = !faltan.length || porPlazo;
    const r = { listo, porPlazo: porPlazo && !!faltan.length, motivo: faltan.join(', '), con, de };
    log(`  (puntos) partido ${m.id}: ${listo ? (r.porPlazo ? `paso de esperar (más de ${esperaHoras} h desde el final; faltaba: ${r.motivo})` : 'puntos definitivos · listo') : `espero: ${r.motivo}`}`);
    if (listo) listos.set(m.id, r); else vistos.set(m.id, r);
    return r;
  };
}
