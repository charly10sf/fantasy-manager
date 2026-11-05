// Horario del bot (hora de Madrid). Entre semana, de lunes a viernes, el bot arranca a las 7 (Carlos, 5 nov 06:41: «que empiece a las
// 7 entre diario, coincidiendo con la hora de trabajar»): las horas de silencio acaban a esa hora y todo lo que empieza por la mañana
// (las 8 o las 9 de config.json) empieza a las 7. Sábado y domingo, las horas de config.json tal cual. La hora, en `inicioEntreSemana`
// de config.json (sin ella, todo como antes).
const HORA = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' });
const DIA = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Madrid' });

export const horaMadrid = (t = Date.now()) => Number(HORA.format(new Date(t)));
/** de lunes a viernes en Madrid */
export const entreSemana = (t = Date.now()) => !['Sat', 'Sun'].includes(DIA.format(new Date(t)));
const inicio = (config, t) => (entreSemana(t) && Number.isFinite(config.inicioEntreSemana) ? config.inicioEntreSemana : null);

/** un tramo [desde, hasta]: entre semana, si empieza por la mañana (de `inicioEntreSemana` a las 12) más tarde que esa hora, empieza a esa hora */
function adelantar([d, h], ini) {
  return ini != null && d > ini && d < 12 ? [ini, h] : [d, h];
}
/** [desde, hasta] de `config[clave]` (o `defecto`) para ese momento */
export function horas(config, clave, defecto, t = Date.now()) {
  return adelantar(config[clave] || defecto, inicio(config, t));
}
/** lo mismo para una lista de tramos ([[0, 1], [8, 12]] del mercado) */
export function tramos(config, clave, defecto, t = Date.now()) {
  const v = config[clave];
  const lista = Array.isArray((v || [])[0]) ? v : v ? [v, ...defecto.slice(1)] : defecto;
  const ini = inicio(config, t);
  return lista.map((x) => adelantar(x, ini));
}
/** horas de silencio [desde, hasta]: entre semana acaban a `inicioEntreSemana` si acababan más tarde por la mañana */
export function silencio(config, t = Date.now()) {
  const [d, h] = config.horasSilencio || [24, 24];
  const ini = inicio(config, t);
  return ini != null && h > ini && h <= 12 && d < ini ? [d, ini] : [d, h];
}
