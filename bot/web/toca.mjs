// Cuándo se hace la previa de la web (bot/previa-web.mjs): el borrador desde 76 h antes del primer partido y el refresco desde 34 h
// antes, hasta media hora antes del cierre de cláusulas. Sin red: lo usan el bot cada 5 min y la prueba.
const HORA = 36e5;
export const VEDA_H = 24, BORRADOR_H = 76, REFRESCO_H = 34;

/** borrador, refresco o '' (una previa hecha antes de tiempo, como la de la J13 el domingo del parón, se rehace igual a las 76 h) */
export function toca({ primero, generada = null, ahora = Date.now() }) {
  const cierre = primero - VEDA_H * HORA;
  if (ahora >= cierre - 0.5 * HORA) return '';
  if (ahora >= primero - REFRESCO_H * HORA) return generada && generada >= primero - REFRESCO_H * HORA ? '' : 'refresco';
  if (ahora >= primero - BORRADOR_H * HORA) return generada && generada >= primero - BORRADOR_H * HORA ? '' : 'borrador';
  return '';
}

