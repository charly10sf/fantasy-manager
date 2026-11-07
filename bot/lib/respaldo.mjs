// La plantilla, solo como último recurso (Carlos, 7 nov: «no quiero plantillas predefinidas, suenan muy IA»). Si un tuit con hechos
// no ha pasado la redacción (ni el validador ni el revisor), NO sale en esa ejecución: no se marca en el registro y se vuelve a
// probar en la siguiente. Se cuentan las ejecuciones fallidas por clave (`registro.datos.fallosRedaccion`) y solo salen con la
// plantilla (pulida por Claude, como hasta ahora) cuando:
//   - ya han fallado `ejecuciones` veces seguidas (3 por defecto; por tipo en config.json → redactar.ejecuciones), o
//   - el tuit caduca (`t.caduca`, en ms: los onces antes del saque, la previa antes del partido, el mercado de la noche…), o
//   - no hay Claude (sin clave o con el tope de gasto del día): esperar no arreglaría nada.
// `t.redaccion` lo deja lib/redaccion.mjs: 'ok', 'rechazada', 'ia-no' (la API no contesta), 'sin-ia' (sin Claude o sin cupo),
// 'sin-tiempo' (no se llegó a intentar en esta ejecución). Sin marca (más tuits de los que caben por ejecución) también espera.

const HORA = 36e5;

/** ¿se redacta este tipo? (activo en config.json o forzado, y el tipo en la lista) */
export function aplicaRedaccion(tipo, config = {}, { forzar = false } = {}) {
  const cfg = config.redactar || {};
  return (forzar || process.env.BOT_REDACTAR === '1' || cfg.activo === true) && (cfg.tipos || []).includes(tipo);
}

/** cuántas ejecuciones fallidas aguanta un tipo antes de salir con la plantilla */
export const ejecucionesDe = (tipo, config = {}) => {
  const e = (config.redactar || {}).ejecuciones || {};
  return Number(e[tipo] ?? e.defecto ?? 3);
};

/**
 * ¿sale el tuit (con la plantilla) o espera a la siguiente ejecución? Cuenta el fallo en el registro cuando toca.
 * Devuelve { sale, motivo }. Solo para tuits de tipos que se redactan y que traen `hechos` y que no han sido redactados.
 */
export function decidirRespaldo(t, { registro, config = {}, ahora = Date.now() } = {}) {
  const cfg = config.redactar || {};
  const tabla = registro ? ((registro.datos.fallosRedaccion ||= {})) : {};
  const previo = tabla[t.clave] || { n: 0 };
  // caduca (o está a punto): sale como esté
  const margen = (cfg.margenCaducaMin ?? 5) * 60e3;
  if (t.caduca && ahora >= t.caduca - margen) return { sale: true, motivo: `caduca (${new Date(t.caduca).toISOString().slice(11, 16)} UTC) y no ha pasado la redacción: sale con la plantilla` };
  if (t.redaccion === 'sin-ia') return { sale: true, motivo: 'sin Claude o sin cupo hoy: sale con la plantilla' };
  if (t.redaccion === 'sin-tiempo' || !t.redaccion) return { sale: false, motivo: 'espero: no se ha llegado a redactar en esta ejecución' };
  // 'rechazada' o 'ia-no': cuenta como una ejecución fallida
  const n = previo.n + 1, max = ejecucionesDe(t.tipo, config);
  tabla[t.clave] = { n, t: previo.t || new Date(ahora).toISOString(), ultima: new Date(ahora).toISOString() };
  if (n >= max) return { sale: true, motivo: `la redacción ha fallado en ${n} ejecuciones seguidas: sale con la plantilla` };
  return { sale: false, motivo: `espero: la redacción no ha pasado (ejecución ${n} de ${max}); vuelvo a probar en la siguiente` };
}

/** al publicar un tuit se olvida su cuenta; y las de más de 3 días se tiran */
export function olvidarFallos(registro, clave, ahora = Date.now()) {
  const tabla = registro && registro.datos && registro.datos.fallosRedaccion;
  if (!tabla) return;
  if (clave) delete tabla[clave];
  for (const [k, v] of Object.entries(tabla)) if (ahora - (Date.parse(v.ultima || v.t) || 0) > 72 * HORA) delete tabla[k];
}

/** el orden en que se redactan: primero los que menos fallos llevan (uno atascado no deja sin probar a los demás) */
export function porFallos(tweets, registro) {
  const tabla = (registro && registro.datos && registro.datos.fallosRedaccion) || {};
  return tweets.map((t, i) => [t, i]).sort((a, b) => ((tabla[a[0].clave] || {}).n || 0) - ((tabla[b[0].clave] || {}).n || 0) || a[1] - b[1]).map((x) => x[0]);
}
