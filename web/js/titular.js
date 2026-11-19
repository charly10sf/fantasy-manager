// La titularidad por los minutos en LaLiga: la usan la app (M.titularidad de motor.js) y el bot (tipos/caidas.mjs, `baseTitular`),
// así el % de la web y el de la app salen de la misma cuenta. Sin nada del navegador: se importa también desde Node.
/**
 * (19 nov) Lo que tiene un jugador de ser titular solo por sus minutos en LaLiga. mins: los minutos de cada convocatoria
 * de la temporada, de la primera a la última (las jornadas en que no fue convocado no cuentan); vrel: lo que vale frente
 * al que más vale de su puesto en su equipo (0-1). Regresión logística ajustada con las jornadas 4-12 de la 26/27
 * (titular = 50 minutos o más; con 45, medio caso). null si no hay ninguna convocatoria.
 */
export function pTitularMinutos(mins, vrel) {
  const m = (mins || []).filter((x) => x != null).map((x) => Math.min(Math.max(Number(x) || 0, 0), 90) / 90);
  if (!m.length) return null;
  const u3 = m.slice(-3);
  const m3 = u3.reduce((s, x) => s + x, 0) / u3.length;
  const ms = m.reduce((s, x) => s + x, 0) / m.length;
  const v = Math.min(Math.max(Number(vrel) || 0, 0), 1);
  const z = -1.784 + 1.985 * m3 + 0.691 * ms + 1.783 * v - 0.888 * (ms === 0 ? 1 : 0) - 0.251 * (m3 === 0 ? 1 : 0);
  return 1 / (1 + Math.exp(-z));
}
