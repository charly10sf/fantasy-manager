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
export const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const cierre = (semilla) => CIERRES[hash(semilla) % CIERRES.length];

/** el tweet con aire: titular, hueco, cuerpo, hueco, cierre */
export const armar = (cab, cuerpo, pie) => [cab, '', ...cuerpo, '', pie].join('\n');

/** corta una lista de líneas (por orden de importancia) para que el tweet entero quepa en max; devuelve las que caben */
export function quepa(cabecera, lineas, pie, max = 280) {
  const out = [];
  for (const l of lineas) {
    if (peso(armar(cabecera, [...out, l], pie)) > max) break;
    out.push(l);
  }
  return out;
}

/** una variante de varias, siempre la misma para la misma semilla (así no suena igual en cada tweet, pero es repetible) */
export const elegir = (variantes, semilla) => variantes[hash(semilla) % variantes.length];
/** 7.25 -> «7,3» */
export const fmt = (x) => (Math.round(Number(x) * 10) / 10).toString().replace('.', ',');
/** los números que salen al escribir fmt(x): 7,3 -> [7, 3] (para el validador) */
export const partes = (x) => { const r = Math.round(Math.abs(Number(x)) * 10) / 10; return [Math.trunc(r), Math.round((r % 1) * 10)]; };

// Nombres de equipo para los tweets (los de la API son largos: «R. Racing Club», «C.A. Osasuna»)
const CORTOS = [['atletico', 'Atlético'], ['athletic', 'Athletic'], ['barcelona', 'Barça'], ['betis', 'Betis'], ['celta', 'Celta'], ['elche', 'Elche'],
  ['espanyol', 'Espanyol'], ['getafe', 'Getafe'], ['levante', 'Levante'], ['malaga', 'Málaga'], ['osasuna', 'Osasuna'], ['rayo', 'Rayo'],
  ['real madrid', 'Real Madrid'], ['sociedad', 'Real Sociedad'], ['sevilla', 'Sevilla'], ['valencia', 'Valencia'], ['villarreal', 'Villarreal'],
  ['alaves', 'Alavés'], ['deportivo', 'Deportivo'], ['racing', 'Racing'], ['oviedo', 'Oviedo'], ['girona', 'Girona'], ['mallorca', 'Mallorca']];
export function corto(nombre) {
  const n = norm(nombre);
  if (n.includes('alaves')) return 'Alavés';           // «Deportivo Alavés» lleva «deportivo»
  for (const [k, v] of CORTOS) if (n.includes(k)) return v;
  return nombre;
}
