// Lo común a los cuatro tuits del parón de selecciones (Carlos, 9 nov 08:58, elegidos a las 09:0x): balance de la temporada
// (tipos/balance.mjs), revalorizaciones (tipos/revalorizaciones.mjs), calendario después del parón (tipos/calendario.mjs) y lo de los
// jugadores de LaLiga con sus selecciones (tipos/selecciones.mjs).
//   - Solo salen con un parón de verdad (más de `paron.dias` entre la última jornada y la siguiente: lib/paron.mjs) y antes de que
//     empiecen las caídas de la jornada de después (`paron.horasAntes` antes de su primer partido).
//   - Repartidos por los días del parón (como la previa escalonada, lib/escalonar.mjs): cada uno a partir de su fracción del hueco
//     (`paronTuits` en config.json) y separados entre sí (`separaciones`); de `horasParon` (9 a 23 h; entre semana, desde las 7).
//   - Uno de cada tipo por parón (`topes`, con la jornada recién jugada).
// Con --ventanas=0 (simulacro) salen aunque no toque, con la última jornada acabada, para verlos.
import { tocaParon } from './paron.mjs';
import { horaMadrid, horas } from './horario.mjs';

// el reparto por defecto (el parón de noviembre de 2026, del lunes 9 a las 11:30 al martes 17 a las 21:00): balance el martes 10 por la
// mañana, revalorizaciones el miércoles 11 por la noche, calendario el viernes 13 por la tarde y selecciones el martes 17 a primera hora
// (con los partidos de selecciones del jueves al lunes ya jugados)
export const FRACCION = { balance: 0.1, revalorizaciones: 0.3, calendario: 0.55, selecciones: 0.9 };

/**
 * ¿Sale ahora el tuit `tipo` del parón? { ok, motivo, jugada, siguiente }. `jugada`: la jornada recién jugada (la del parón o, sin
 * ventanas, la última acabada).
 */
export function ventanaParon(tipo, { paron = null, ventanas = true, forzar = false, config = {}, ahora = Date.now(), registro = null, jornada, stats = [] } = {}) {
  const cp = config.paronTuits || {};
  if (cp.activo === false) return { ok: false, motivo: 'apagado (paronTuits.activo)' };
  const acabada = stats.length && stats.every((m) => Number(m.matchState) === 7);
  const jugada = paron && paron.jugada != null ? paron.jugada : acabada ? jornada : jornada - 1;
  const r = { jugada, siguiente: jugada + 1 };
  if (!ventanas || forzar) return { ok: true, motivo: '', ...r };
  if (registro && registro.claves && registro.claves.has(`${tipo}|${jugada}`)) return { ok: false, motivo: 'ya ha salido en este parón', ...r };
  const t = tocaParon(paron, { fraccion: cp[tipo] ?? FRACCION[tipo] ?? 0.5, ahora, margenHoras: cp.margenHoras ?? 12 });
  if (!t.ok) return { ok: false, motivo: t.motivo, ...r };
  const [d, h] = horas(config, 'horasParon', [9, 23], ahora);
  const hm = horaMadrid(ahora);
  if (!(hm >= d && hm < h)) return { ok: false, motivo: `fuera de horario (son las ${hm} h; de ${d} a ${h})`, ...r };
  return { ok: true, motivo: '', ...r };
}

/** las caras y los escudos de la lista y de las jornadas: { cara(j), escudoDe(teamId), equipos: { teamId: nombre } } */
export function imagenesDe(jugadores = [], ...semanas) {
  const escudos = {}, equipos = {};
  for (const m of semanas.flat().filter(Boolean)) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null) {
    if (lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
    if (lado.mainName) equipos[String(lado.id)] = lado.mainName;
  }
  const cara = (j) => (j && (j.image || (j.images && j.images.transparent && j.images.transparent['256x256']))) || null;
  return { cara, escudoDe: (id) => escudos[String(id)] || null, equipos };
}

/** los puntos de un jugador hasta una jornada (de `weekPoints`) y en cuántas jornadas ha puntuado */
export function puntosHasta(j, hasta) {
  const ws = (j.weekPoints || []).filter((w) => w.weekNumber <= hasta);
  return { pts: ws.reduce((s, w) => s + (Number(w.points) || 0), 0), jugadas: ws.length };
}
