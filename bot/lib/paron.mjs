// Parón de selecciones: las caídas de la jornada de después no salen hasta que falte poco (Domy y Carlos, 9 nov 07:17: el lunes del
// parón salió «Bajas y dudas para la jornada 13» con la jornada a 11 días). Con el parón, LaLiga pasa enseguida a la semana
// siguiente y el bot la veía «sin empezar», como cualquier otra semana; las bajas cambian durante el parón (lesiones con la
// selección, recuperados), así que se espera a que acabe.

const fecha = (m) => Date.parse(m && m.date);

/** el primer partido de una jornada (ms) o null */
export function inicio(stats) {
  const ts = (Array.isArray(stats) ? stats : []).map(fecha).filter(Number.isFinite);
  return ts.length ? Math.min(...ts) : null;
}
/** el último partido de una jornada (su hora de inicio, ms) o null */
export function ultimo(stats) {
  const ts = (Array.isArray(stats) ? stats : []).map(fecha).filter(Number.isFinite);
  return ts.length ? Math.max(...ts) : null;
}

/**
 * ¿Hay que esperar con lo de la jornada que viene? Solo si entre el último partido de la anterior y el primero de esta hay más de
 * `dias` (una semana normal, como mucho 7: con parón, 12 o 13) y faltan más de `horasAntes` para el primero.
 * { espera, desde (ms: a partir de cuándo sale), hueco (días entre jornadas) }
 */
export function esperaParon({ siguiente, anterior, ahora = Date.now(), dias = 9, horasAntes = 72 } = {}) {
  const ini = inicio(siguiente), fin = ultimo(anterior);
  if (ini == null || fin == null || ini <= fin) return { espera: false, desde: null, hueco: null };
  const hueco = (ini - fin) / 864e5;
  const desde = ini - horasAntes * 36e5;
  return { espera: hueco > dias && ahora < desde, desde, hueco };
}

// Los tuits propios del parón (Carlos, 9 nov 08:58: balance de la temporada, revalorizaciones, calendario de después del parón y
// selecciones): solo durante el parón y repartidos por sus días, no todos el lunes. Cada uno sale a partir de una fracción del hueco
// que va desde que acaba la última jornada (más `margenHoras`) hasta que empiezan las caídas de la siguiente (`horasAntes` antes de
// su primer partido): el parón de noviembre de 2026 va del lunes 9 a las 11:30 al martes 17 a las 21:00.

/**
 * El parón en el que estamos, o null si entre las dos jornadas no hay más de `dias`. jugada: la jornada que acaba de jugarse.
 * { jugada, siguiente, fin (ms: ha acabado su último partido), ini (ms: primer partido de la siguiente), hasta (ms: empiezan las
 *   caídas), hueco (días), activo }
 */
export function paronActual({ anterior, siguiente, jugada = null, ahora = Date.now(), dias = 9, horasAntes = 72 } = {}) {
  const ini = inicio(siguiente), u = ultimo(anterior);
  if (ini == null || u == null || ini <= u) return null;
  const hueco = (ini - u) / 864e5;
  if (hueco <= dias) return null;
  const fin = u + 2.5 * 36e5;
  return { jugada, siguiente: jugada != null ? jugada + 1 : null, fin, ini, hasta: ini - horasAntes * 36e5, hueco, activo: ahora >= fin && ahora < ini };
}

const FECHA = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** ¿le toca ya a este tuit del parón? fraccion: de 0 (al acabar la jornada) a 1 (cuando empiezan las caídas). { ok, motivo, desde } */
export function tocaParon(p, { fraccion = 0, ahora = Date.now(), margenHoras = 12 } = {}) {
  if (!p) return { ok: false, motivo: 'no hay parón entre esta jornada y la siguiente' };
  if (!p.activo) return { ok: false, motivo: ahora < p.fin ? 'la jornada aún no ha acabado' : 'el parón ya ha terminado' };
  const a = p.fin + margenHoras * 36e5, desde = a + Math.max(0, p.hasta - a) * Math.min(1, Math.max(0, fraccion));
  if (ahora < desde) return { ok: false, motivo: `le toca desde el ${FECHA.format(new Date(desde))}`, desde };
  if (ahora >= p.hasta) return { ok: false, motivo: 'ya empiezan las caídas de la jornada siguiente', desde };
  return { ok: true, motivo: '', desde };
}
