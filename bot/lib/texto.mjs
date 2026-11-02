// Formato de los tweets: peso de X (los emojis cuentan 2), cierres rotados y normalización de nombres.
export function peso(s) {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    n += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037) ? 1 : 2;
  }
  return n;
}
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Todos llevan «Fantasy» (Carlos, 2 nov 15:52) y ninguno lleva enlace: la dirección va en el campo «Sitio web» del perfil.
export const CIERRES = [
  'Fantasy Manager · enlace en la bio',
  '📲 Fantasy Manager (enlace en la bio)',
  'Fantasy Manager: la app, enlace en la bio',
  'Más en Fantasy Manager · enlace en la bio',
  '👉 Fantasy Manager, enlace en la bio',
  'Tu Fantasy con Fantasy Manager · enlace en la bio',
  'Fantasy Manager · todo en el enlace de la bio',
  'Fantasy Manager · app en la bio',
];
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const cierre = (semilla) => CIERRES[hash(semilla) % CIERRES.length];

/** corta una lista de líneas para que el tweet entero quepa en max; devuelve las que caben */
export function quepa(cabecera, lineas, pie, max = 280) {
  const out = [];
  for (const l of lineas) {
    const t = [cabecera, ...out, l, pie].join('\n');
    if (peso(t) > max) break;
    out.push(l);
  }
  return out;
}
