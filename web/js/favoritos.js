/* Los favoritos: cualquier jugador que quieras seguir, como la estrella de LaLiga Fantasy (lo pidió Carlos el 25 oct).
   Se marcan con la estrella de su ficha y se ven en Mercado → Favoritos. Se guardan en este dispositivo, cada liga los
   suyos (con su clave, como el plan o las notas), del más nuevo al más viejo. */
import { LS } from './util.js';
import { K } from './datos.js';

const MAX = 60;
// (leído una vez por liga: esFav se llama en cada fila de las listas)
let cache = { k: null, l: [], set: new Set() };
const leer = () => {
  const k = K('favoritos');
  if (cache.k !== k) { const l = LS.get(k, []); const ids = Array.isArray(l) ? l.map(String) : []; cache = { k, l: ids, set: new Set(ids) }; }
  return cache;
};
/** los ids de tus favoritos, el último que marcaste primero */
export const favoritos = () => [...leer().l];
export const esFav = (pid) => leer().set.has(String(pid));
/** lo marca o lo quita; devuelve si ha quedado como favorito */
export function cambiarFav(pid) {
  const id = String(pid);
  const l = favoritos();
  const ya = l.includes(id);
  const nueva = ya ? l.filter((x) => x !== id) : [id, ...l].slice(0, MAX);
  LS.set(K('favoritos'), nueva);
  cache = { k: K('favoritos'), l: nueva, set: new Set(nueva) };
  return !ya;
}
