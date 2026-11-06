// El once confirmado tal como lo da ESPN: su dibujo («4-2-3-1») y el `formationPlace` de cada titular, que es el número de puesto de
// Opta (1 el portero, 2 el lateral derecho, 9 el delantero centro…). Con esta tabla, cada número cae en su línea, así que la tarjeta
// pinta el 4-2-3-1 con su mediapunta y no un «4-2-4» contado con las posiciones de LaLiga (que mete a los extremos como delanteros).
// La tabla, de mplsoccer (MIT; soccer/formations.py, los `opta=` de cada sistema): por línea, de la defensa a la delantera, y dentro
// de cada línea de izquierda a derecha según se mira la tarjeta (el lateral izquierdo, a la izquierda).
// 6 nov: pedido por Carlos tras el tweet del Sevilla-Alavés («ha puesto al Sevilla con dos porteros»).
export const OPTA = {
  '4-4-2': [[3, 6, 5, 2], [11, 8, 4, 7], [9, 10]],
  '4-1-2-1-2': [[3, 6, 5, 2], [4], [11, 7], [8], [9, 10]],
  '4-3-3': [[3, 6, 5, 2], [8, 4, 7], [11, 9, 10]],
  '4-5-1': [[3, 6, 5, 2], [11, 8, 10, 4, 7], [9]],
  '4-4-1-1': [[3, 6, 5, 2], [11, 8, 4, 7], [10], [9]],
  '4-1-4-1': [[3, 6, 5, 2], [4], [11, 10, 8, 7], [9]],
  '4-2-3-1': [[3, 6, 5, 2], [4, 8], [11, 10, 7], [9]],
  '4-3-2-1': [[3, 6, 5, 2], [7, 4, 8], [11, 10], [9]],
  '5-3-2': [[3, 4, 5, 6, 2], [11, 8, 7], [9, 10]],
  '5-4-1': [[3, 4, 5, 6, 2], [11, 10, 8, 7], [9]],
  '3-5-2': [[4, 5, 6], [3, 8, 11, 7, 2], [9, 10]],
  '3-4-3': [[4, 5, 6], [3, 8, 7, 2], [11, 9, 10]],
  '3-1-3-1-2': [[4, 5, 6], [7], [3, 8, 2], [10], [11, 9]],
  '4-2-2-2': [[3, 6, 5, 2], [8, 4], [11, 7], [9, 10]],
  '3-5-1-1': [[4, 6, 5], [3, 8, 11, 7, 2], [10], [9]],
  '3-4-2-1': [[4, 5, 6], [3, 8, 7, 2], [11, 10], [9]],
  '3-4-1-2': [[4, 5, 6], [3, 8, 7, 2], [9], [11, 10]],
  '3-1-4-2': [[6, 4, 5], [8], [3, 11, 7, 2], [10, 9]],
  '3-1-2-1-3': [[4, 5, 6], [8], [3, 2], [10], [11, 7, 9]],
  '4-1-3-2': [[3, 6, 5, 2], [4], [11, 8, 7], [10, 9]],
  '4-2-4': [[3, 6, 5, 2], [8, 4], [11, 10, 9, 7]],
  '4-3-1-2': [[3, 6, 5, 2], [11, 4, 7], [8], [10, 9]],
  '3-2-4-1': [[4, 5, 6], [3, 2], [11, 8, 7, 10], [9]],
  '3-3-3-1': [[4, 5, 6], [3, 8, 2], [11, 7, 10], [9]],
};

/** «4-2-3-1», «4231» o «4-2-3-1 » → «4-2-3-1» (o '' si no es un dibujo de 10 jugadores de campo) */
export function dibujo(f) {
  const ds = String(f || '').replace(/[^0-9]/g, '').split('').map(Number);
  return ds.length >= 2 && ds.every((x) => x > 0) && ds.reduce((a, b) => a + b, 0) === 10 ? ds.join('-') : '';
}

/**
 * Las líneas del once de ESPN: { formacion: '4-2-3-1', filas: [[i, …], …] } con los índices de `titulares` (los 11 de ESPN, en su orden),
 * del portero a la delantera; o null si el dibujo no está en la tabla o los `formationPlace` no son del 1 al 11 sin repetir.
 */
export function lineasEspn(titulares, formacion) {
  const f = dibujo(formacion), t = OPTA[f];
  if (!t || !titulares || titulares.length !== 11) return null;
  const lugar = new Map();
  titulares.forEach((x, i) => lugar.set(Number(x && x.formationPlace), i));
  for (let k = 1; k <= 11; k++) if (!lugar.has(k)) return null;
  return { formacion: f, filas: [[lugar.get(1)], ...t.map((fila) => fila.map((k) => lugar.get(k)))] };
}
