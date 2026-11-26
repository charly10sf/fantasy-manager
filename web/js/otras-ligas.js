/* Lo que solo se ve juntando todas las ligas que usan la app (26 nov; Carlos: «la demanda de otras ligas y lo que se paga en
   otras ligas por un jugador»). Aquí, lo que hace el móvil, sin nada de la app dentro (todo le llega por argumentos, para
   poder probarlo suelto: .github/ia/caso-otras-ligas.mjs); el servidor, en worker/src/ligas.js.

   LO QUE SE MANDA (solo con «Ayudar a mejorar la IA», sin liga, sin mánager y sin nombres):
   - la demanda: los libres del mercado de tu liga con las pujas que lleva cada uno (el número que da LaLiga), como mucho
     cada media hora y solo si ha cambiado algo;
   - las cláusulas que se abren: cómo era el jugador al abrirse (valor, cláusula, lo que subía, puesto, % de titular) y si
     se lo llevaron en las 24 h siguientes. Se apunta lo último visto ANTES de abrirse y se manda cuando han pasado las 24 h
     y la actividad de la liga las cubre; si no se vio antes, o cambió de dueño de otra forma, no se manda nada.
   El id del jugador en lo pagado y en la demanda es el de LaLiga, que es público. De la liga solo salen una huella y su
   clase (privada o pública, su tipo y si es Premium), para no mezclar ligas de clases distintas.

   LO QUE SE LEE (apagado mientras «otrasLigas» de limites.json no lo encienda): lo pagado por un libre en las demás ligas en
   3 días y su nivel de demanda. Nunca lo de tu propia liga. */
import { num, eur, pct, MIN, HORA, DIA } from './util.js';

/* ---------- el tipo de liga ---------- */
/** la clase de la liga para el servidor: «acceso|tipo|p o n» (privada o pública, su clase en LaLiga y si es Premium), para
    que solo se junten ligas de la misma clase. No dice qué liga es. '' si no se sabe (una liga guardada de antes del 26 nov,
    o una que LaLiga da sin esos campos): entonces ni se manda ni se pide nada de esa liga */
export function tipoLiga(liga) {
  const l = liga || {}, limpio = (x) => String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12);
  const a = limpio(l.acceso), t = limpio(l.tipo);
  return a || t ? `${a}|${t}|${l.premium ? 'p' : 'n'}` : '';
}

/* ---------- la demanda ---------- */
export const ENVIO_CADA = 30 * MIN, ENVIOS_DIA = 12, ESPERA_FALLO = HORA, DEM_MAX = 80, FOTO_FRESCA = 30 * MIN;
/** los libres de la liga con la subasta abierta y sus pujas: [[id del jugador, pujas], …], ordenados por id.
    `mercado` es el del motor (`M.mercado`: sin los que ya tienen dueño ni entrenadores) */
export function demandaDe(mercado, ahora) {
  const out = [];
  for (const m of Array.isArray(mercado) ? mercado : []) {
    if (!m || m.tipo !== 'liga' || m.pid == null || (m.cierra && m.cierra <= ahora)) continue;
    // (solo jugadores que la app conoce, con su valor: los de la lista de LaLiga; los entrenadores, que en las ligas
    // Premium también salen al mercado, no)
    if (!m.j || !(m.j.valor > 0) || m.j.pos === 5) continue;
    const p = Number(m.pid);
    if (!Number.isInteger(p) || p < 1 || p > 999999) continue;
    out.push([p, Math.max(0, Math.min(500, Math.round(num(m.pujas))))]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, DEM_MAX);
}
/** para saber si ha cambiado algo desde lo último mandado */
export const firmaDemanda = (m) => m.map(([p, n]) => `${p}:${n}`).join(',');
/** ¿toca mandar? `ya`: { t, f, dia, n, mal } de lo último mandado; `hoy`: el día de hoy. Como mucho cada ENVIO_CADA y
    ENVIOS_DIA al día; si la última falló, se espera ESPERA_FALLO */
export function tocaMandar(ya, firma, nAperturas, ahora, hoy) {
  const y = ya || {};
  if (y.mal && ahora - y.mal < ESPERA_FALLO) return false;
  if (ahora - num(y.t) < ENVIO_CADA) return false;
  if ((y.dia === hoy ? num(y.n) : 0) >= ENVIOS_DIA) return false;
  // (lo mismo de ayer se manda una vez hoy: un libre que sigue en el mercado cuenta también para el día nuevo)
  return (!!firma && (firma !== y.f || y.dia !== hoy)) || nAperturas > 0;
}

/* ---------- las cláusulas que se abren ---------- */
// cuánto antes de abrirse se empieza a apuntar, las horas que se mira si se lo llevan y cuánto se espera a poder mandarla
export const AP_ANTES = 36 * HORA, AP_VENTANA = 24 * HORA, AP_CADUCA = 6 * DIA, AP_MAX = 300;
const TRASPASO = new Set(['compra', 'venta', 'clausula']);
/** las fichas de todos los equipos de la liga (las de los rivales y las tuyas) como las quiere `apuntarAperturas`, del motor */
export function fichasDe(M) {
  return [...((M && M.clausulas) || []), ...((M && M.mias) || [])].filter((x) => x && x.j).map((x) => {
    const ti = M.titularidad ? M.titularidad(x.j) : null;
    return { pid: x.pid, tid: x.teamId, base: x.protLiga, abre: x.protegidoHasta, veda: x.veda ? x.veda.cierra : null, abierta: !!x.abierta, escudo: !!x.escudo, cl: x.clausula, v: x.j.valor, r: M.subidaEn ? M.subidaEn(x.pid) : null, pos: x.j.pos, tit: ti && Number.isFinite(ti.p) ? ti.p : null };
  });
}
/**
 * Apunta las cláusulas que están a punto de abrirse. `fichas`: [{ pid, tid, base, abre, veda, abierta, escudo, cl, v, r, pos, tit }]
 * (base: hasta cuándo la protege LaLiga por el fichaje, que no cambia; abre: cuándo se puede pagar de verdad, con el cierre
 * de la jornada; veda: desde cuándo están cerradas las cláusulas por la jornada, si lo están). Devuelve { reg, cambia }; el
 * registro de entrada no se toca.
 * Solo cuenta la PRIMERA vez que se abre: una que LaLiga dejó de proteger hace días y que ahora solo espera a que empiece la
 * jornada (todas las abiertas se cierran 24 h antes) ya estaba abierta, y no es lo que se quiere contar.
 */
export function apuntarAperturas(reg0, fichas, ahora) {
  const reg = { ...(reg0 && typeof reg0 === 'object' ? reg0 : {}) };
  let cambia = false;
  for (const f of Array.isArray(fichas) ? fichas : []) {
    if (!f || f.abierta || f.escudo || !(f.base > 0) || !(f.abre > ahora) || f.abre - ahora > AP_ANTES) continue;
    if (!(f.cl > 0) || !(f.v > 0) || !(f.pos >= 1 && f.pos <= 4) || f.pid == null) continue;
    if (f.base <= ahora && !(f.veda > 0 && f.base >= f.veda)) continue;
    const k = `${f.pid}|${f.base}`;
    reg[k] = { pid: f.pid, tid: f.tid == null ? null : f.tid, base: f.base, abre: f.abre, cl: f.cl, v: f.v, r: f.r == null ? null : f.r, pos: f.pos, tit: f.tit == null ? null : f.tit, t: ahora };
    cambia = true;
  }
  // lo que ya no se va a poder mandar, fuera
  for (const [k, e] of Object.entries(reg)) if (!e || !e.abre || ahora > e.abre + AP_VENTANA + AP_CADUCA) { delete reg[k]; cambia = true; }
  const ks = Object.keys(reg);
  if (ks.length > AP_MAX) { for (const k of ks.sort((a, b) => reg[b].abre - reg[a].abre).slice(AP_MAX)) delete reg[k]; cambia = true; }
  return { reg, cambia };
}
const cerca = (a, b) => Math.abs(a - b) <= Math.max(1000, b * 0.002);
/**
 * Las apuntadas cuyas 24 h ya han pasado. `lista`: la actividad de la liga (la guardada, que lleva la de hoy); `desde`: desde
 * cuándo llega esa actividad; `fotoT`: de cuándo es la liga que se está viendo (no la hora de ahora: con la liga guardada de
 * hace días no se sabe qué pasó después); `valorEn(pid, t)`: lo que valía ese día (si el valor pasa de la cláusula, LaLiga
 * la sube sola hasta el valor: un clausulazo de esos días se paga por ese valor, no por la cláusula apuntada).
 * Devuelve { listas: [{ c, abre, v, cs, r, pos, tit, ida, bl }], quitar: [claves] }: `listas`, para mandar (c es la clave del
 * registro); `quitar`, las que no cuentan (cambió de dueño de otra forma).
 */
export function resolverAperturas(reg, lista, desde, fotoT, valorEn = null) {
  const listas = [], quitar = [];
  for (const [k, e] of Object.entries(reg || {})) {
    if (!e || !e.abre) continue;
    const fin = e.abre + AP_VENTANA;
    if (!(fotoT >= fin + 10 * MIN)) continue;
    // (la actividad tiene que llegar hasta antes de la última vez que se vio: si no, no se sabe qué pasó en medio)
    if (!(desde > 0) || desde > e.t) continue;
    const movs = (lista || []).filter((a) => a && a.t && String(a.pid) === String(e.pid) && a.t > e.t && a.t <= fin).sort((a, b) => a.t - b.t);
    const porClausula = (a) => { const imp = Math.abs(num(a.importe)), v = valorEn ? num(valorEn(e.pid, a.t)) : 0; return cerca(imp, e.cl) || (v > e.cl && cerca(imp, v)); };
    const cz = movs.find((a) => a.t >= e.abre - MIN && (a.clase === 'clausula' || (a.clase === 'compra' && (a.otroId || a.otro) && porClausula(a))));
    // otro traspaso suyo (lo vendió, se lo compraron con una oferta, lo fichó otro antes de abrirse…): no cuenta
    const otro = movs.some((a) => TRASPASO.has(a.clase) && (!cz || a.t < cz.t - 2 * MIN));
    if (otro) { quitar.push(k); continue; }
    const bl = movs.some((a) => a.clase === 'blindaje' && a.t >= e.abre - MIN && (!cz || a.t < cz.t));
    listas.push({ c: k, abre: e.abre, v: e.v, cs: e.cl / e.v - 1, r: e.r, pos: e.pos, tit: e.tit, ida: !!cz, bl });
  }
  return { listas, quitar };
}

/* ---------- leer lo de las demás ligas ---------- */
export const VER_CADA = 3 * HORA, VER_FALLO = 30 * MIN, VER_MAX = 80;
/** los ids de los libres de ahora, para pedir lo suyo */
export const idsDe = (mercado, ahora) => demandaDe(mercado, ahora).map((x) => x[0]).slice(0, VER_MAX);
/** ¿toca pedirlo? `ya`: { k, t, mal } de lo último leído. Cuando cambian los libres (el mercado de tu liga) o cada VER_CADA */
export function tocaVer(ya, clave, ahora) {
  const y = ya || {};
  if (!clave) return false;
  if (y.mal && ahora - y.mal < VER_FALLO) return false;
  return y.k !== clave || ahora - num(y.t) > VER_CADA;
}

/* ---------- lo que se enseña en la ficha de un libre ---------- */
/**
 * «Lo pagado en otras ligas»: { l (la línea a la vista), d: [párrafos] } o null si no hay datos de 3 ligas.
 * x: { n, med, max } del servidor (n: en cuántas ligas, recortado a 20; med y max: lo pagado sobre el valor que tenía el día
 * de cada compra); valor: lo que vale hoy.
 */
export function pagadoTxt(x, valor) {
  if (!x || !(x.n >= 3) || !Number.isFinite(x.med) || !Number.isFinite(x.max) || !(valor > 0)) return null;
  const a = (s) => eur(Math.round((valor * (1 + s)) / 1e4) * 1e4);
  const veces = x.n >= 20 ? '20 ligas o más' : `${x.n} ligas`;
  const igual = Math.abs(x.max - x.med) < 0.0005;
  return {
    l: `En 3 días: ${pct(x.med * 100)} de mediana${igual ? '' : ` · lo más, ${pct(x.max * 100)}`}`,
    d: [
      `Se lo han llevado en ${veces} que usan la app en los 3 últimos días. La mitad pagó un ${pct(x.med * 100)} sobre su valor o menos${igual ? '' : `, y quien más, un ${pct(x.max * 100)}`}.`,
      `Con lo que vale hoy serían ${a(x.med)}${igual ? '' : ` y ${a(x.max)}`}.`,
      '<span class="t2">Cada liga paga distinto: es un dato más, y la puja de la app no cambia por él.</span>',
    ],
  };
}
const NIVEL = { 1: 'baja', 2: 'media', 3: 'alta' };
const NIVEL_D = { 1: 'de los que menos pujas llevan', 2: 'de los que llevan pujas, sin destacar', 3: 'de los que más pujas llevan' };
/** «Demanda en otras ligas»: { l, d: [párrafos] } o null. x: [hoy, ayer], cada uno de 0 (no se sabe) a 3 */
export function demandaTxt(x) {
  const hoy = Array.isArray(x) ? NIVEL[x[0]] : null, ayer = Array.isArray(x) ? NIVEL[x[1]] : null;
  if (!hoy) return null;
  return {
    l: `Hoy, ${hoy}${ayer ? ` · ayer, ${ayer}` : ''}`,
    d: [
      `Entre los libres de hoy en las demás ligas que usan la app, es ${NIVEL_D[x[0]]}${ayer ? ` (ayer, ${NIVEL_D[x[1]]})` : ''}.`,
      '<span class="t2">Es lo que se puja por él fuera de tu liga, no cuánto. En tu liga puede ser distinto.</span>',
    ],
  };
}
