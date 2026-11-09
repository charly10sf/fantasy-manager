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
