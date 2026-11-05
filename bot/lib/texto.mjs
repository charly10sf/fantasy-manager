// Formato de los tweets: peso de X (los emojis cuentan 2), cierres rotados y normalización de nombres.

// El límite de cada tweet (Carlos, 4 nov 22:39: X Premium en @Fantasyman_app, «que los tweets sean más largos y se noten más
// humanos»). Lo fija ejecutar.mjs al arrancar: 280 sin Premium y config.largo.max con él (ver `decidirLargo` en ejecutar.mjs).
// Las plantillas dejan para el final, con la prio más baja, lo que solo cabe en un tweet largo: con 280 salen igual que antes.
let LIMITE = 280;
export const limite = () => LIMITE;
/** ¿se escriben tweets largos (X Premium)? */
export const largo = () => LIMITE > 280;
export function fijarLimite(n) { LIMITE = Math.max(280, Math.round(Number(n)) || 280); return LIMITE; }
export function peso(s) {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    n += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037) ? 1 : 2;
  }
  return n;
}
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// La etiqueta final de bajas, dudas y novedades («❌ Baja para la jornada 12 contra el Sevilla», «💸 Venta obligatoria»). Desde el
// 5 nov sin «Fantasy» detrás (Carlos: «disponible fantasy no tiene sentido; con poner disponible sería suficiente»); lo llevan
// solo «Revisa tu once Fantasy», «Lloros Fantasy» y «Chollo Fantasy».
export const esEtiquetaFinal = (s) => /^(✅|❌|⁉️|👀|💸|🟨|💔) .*(para la (jornada|próxima jornada)|de la jornada \d|Venta obligatoria)/u.test(String(s || ''));

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
// (con la mezcla del final: sin ella, semillas que solo cambian en un dígito, «mvp101» y «mvp107», sacaban la misma forma en todas
// las elecciones de un partido y una jornada salía con tres esqueletos; auditoría del 5 nov)
const mezcla = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0; };
export const hash = (s) => mezcla([...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));
export const cierre = (semilla) => CIERRES[hash(semilla) % CIERRES.length];

/** el tweet con aire: titular, hueco, cuerpo, hueco, cierre */
export const armar = (cab, cuerpo, pie) => [cab, '', ...cuerpo, ...(pie ? ['', pie] : [])].join('\n');

/**
 * Tweet sin el cierre de «Fantasy Manager · enlace en la bio» (Carlos, 2 nov 23:11: solo va en el del final de partido y en los del
 * mercado). Sin #LaLigaFantasy de relleno: la palabra «fantasy» ya no es obligatoria (Carlos, 4 nov 13:00; ya la lleva el
 * nombre de la cuenta). Devuelve { texto, usadas } con las líneas que caben.
 */
export function sinCierre(cab, lineas, max = limite()) {
  const usadas = quepa(cab, lineas, null, max);
  return { usadas, texto: armar(cab, usadas, null) };
}

/** corta una lista de líneas (por orden de importancia) para que el tweet entero quepa en max; devuelve las que caben */
export function quepa(cabecera, lineas, pie, max = limite()) {
  const out = [];
  for (const l of lineas) {
    if (peso(armar(cabecera, [...out, l], pie)) > max) break;
    out.push(l);
  }
  return out;
}

/** una variante de varias, siempre la misma para la misma semilla (así no suena igual en cada tweet, pero es repetible) */
export const elegir = (variantes, semilla) => variantes[hash(semilla) % variantes.length];
/** Para una serie de tweets que salen seguidos (los finales y MVP de una jornada, por orden de partido): el número de forma del
 * k-ésimo. En cada tanda de n seguidos salen las n formas, barajadas con la semilla, y dos seguidos nunca repiten forma (tampoco
 * entre tandas). Así el final del Betis y el del Barça, que salen con minutos de diferencia, no se leen calcados (Carlos, 4 nov). */
export function turno(n, semilla, k) {
  if (n <= 1) return 0;
  if (n === 2) return (hash(semilla) + k) % 2;
  const baraja = (b) => {
    const p = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = hash(`${semilla}:${b}:${i}`) % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    return p;
  };
  const b = Math.floor(k / n), p = baraja(b);
  // la primera de una tanda no puede ser la última de la anterior (cambiar 0 y 1 no toca la última: vale para n ≥ 3)
  if (b > 0 && p[0] === baraja(b - 1)[n - 1]) [p[0], p[1]] = [p[1], p[0]];
  return p[k % n];
}
export const rotar = (variantes, semilla, k) => variantes[turno(variantes.length, semilla, k)];
/** el orden de los partidos de una jornada (por hora y, a la misma hora, por id): k = su posición; -1 si no está */
export const ordenJornada = (stats) => [...stats].sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0) || Number(a.id) - Number(b.id)).map((m) => String(m.id));
/** 7.25 -> «7,3» */
export const fmt = (x) => (Math.round(Number(x) * 10) / 10).toString().replace('.', ',');
/** los números que salen al escribir fmt(x): 7,3 -> [7, 3] (para el validador) */
export const partes = (x) => { const r = Math.round(Math.abs(Number(x)) * 10) / 10; return [Math.trunc(r), Math.round((r % 1) * 10)]; };
/** euros como los escribe la gente: «1,2 M» o «640 K». La unidad, después de redondear: 999.600 es «1 M», no «1000 K» (auditoría del 5 nov).
    numeros, para el validador */
export const dineroTxt = (x) => { const a = Math.abs(Number(x)) || 0, k = Math.round(a / 1e3); return k >= 1000 ? { t: `${fmt(a / 1e6)} M`, numeros: partes(a / 1e6) } : { t: `${k} K`, numeros: [k] }; };

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

// Artículos de los equipos para escribir como se habla: «el Barça», «del Barça», «al Barça»; Osasuna y la Real Sociedad no llevan el mismo.
const SIN_ARTICULO = new Set(['Osasuna']);
export const el = (eq) => (SIN_ARTICULO.has(eq) ? eq : eq === 'Real Sociedad' ? 'la Real Sociedad' : `el ${eq}`);
export const del = (eq) => (SIN_ARTICULO.has(eq) ? `de ${eq}` : eq === 'Real Sociedad' ? 'de la Real Sociedad' : `del ${eq}`);
export const al = (eq) => (SIN_ARTICULO.has(eq) ? `a ${eq}` : eq === 'Real Sociedad' ? 'a la Real Sociedad' : `al ${eq}`);
