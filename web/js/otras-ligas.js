/* Lo que solo se ve juntando todas las ligas que usan la app (26 nov; Carlos: «la demanda de otras ligas y lo que se paga en
   otras ligas por un jugador»). Aquí, lo que hace el móvil, sin nada de la app dentro (todo le llega por argumentos, para
   poder probarlo suelto: .github/ia/caso-otras-ligas.mjs); el servidor, en worker/src/ligas.js.

   LO QUE SE MANDA (solo con «Ayudar a mejorar la IA», sin liga, sin mánager y sin nombres):
   - la demanda: los libres del mercado de tu liga con las pujas que lleva cada uno (el número que da LaLiga), como mucho
     cada media hora y solo si ha cambiado algo;
   - las cláusulas que se abren: cómo era el jugador al abrirse (valor, cláusula, lo que subía, puesto, % de titular) y si
     se lo llevaron en las 24 h siguientes. Se apunta lo último visto ANTES de abrirse y se manda cuando han pasado las 24 h
     y la actividad guardada de la liga cubre ese rato SIN HUECOS; si no se vio antes, si cambió de dueño de otra forma o si
     no cuadra con quién lo tiene ahora, no se manda nada.
   El id del jugador en lo pagado y en la demanda es el de LaLiga, que es público. De la liga solo salen una huella y su
   clase (privada o pública, su tipo y si es Premium), para no mezclar ligas de clases distintas.

   LO QUE SE LEE (apagado mientras «otrasLigas» de limites.json no lo encienda): lo pagado por un libre en las demás ligas en
   3 días y su nivel de demanda. Nunca lo de tu propia liga. */
import { num, pct, MIN, HORA, DIA } from './util.js';

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
export const ENVIO_CADA = 30 * MIN, ENVIOS_DIA = 20, ESPERA_FALLO = HORA, DEM_MAX = 80, FOTO_FRESCA = 30 * MIN;
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
// con cuántas horas de poder pagarse cuenta una cláusula como «estuvo abierta» (la medida solo mira las de ese mínimo)
export const AP_HORAS_MIN = 20;
const TRASPASO = new Set(['compra', 'venta', 'clausula']);
/** de las 24 h desde que se abre, cuántas se puede pagar de verdad: las que no caen en el cierre de una jornada (`vedas`:
    [{ ini, fin }] del motor). Una que se abre 6 h antes de un cierre solo tiene 6 */
export function horasPagables(abre, vedas) {
  let ms = AP_VENTANA;
  for (const v of Array.isArray(vedas) ? vedas : []) if (v && v.fin > abre && v.ini < abre + AP_VENTANA) ms -= Math.min(v.fin, abre + AP_VENTANA) - Math.max(v.ini, abre);
  return Math.max(0, Math.min(24, Math.round(ms / HORA)));
}
/** las fichas de todos los equipos de la liga (las de los rivales y las tuyas) como las quiere `apuntarAperturas`, del motor */
export function fichasDe(M) {
  return [...((M && M.clausulas) || []), ...((M && M.mias) || [])].filter((x) => x && x.j).map((x) => {
    const ti = M.titularidad ? M.titularidad(x.j) : null;
    return { pid: x.pid, tid: x.teamId, base: x.protLiga, abre: x.protegidoHasta, veda: x.veda ? x.veda.cierra : null, abierta: !!x.abierta, escudo: !!x.escudo, cl: x.clausula, v: x.j.valor, r: M.subidaEn ? M.subidaEn(x.pid) : null, pos: x.j.pos, tit: ti && Number.isFinite(ti.p) ? ti.p : null,
      hp: x.protegidoHasta > 0 ? horasPagables(x.protegidoHasta, M.vedas) : null };
  });
}
/** de quién es ahora cada jugador con dueño: { [pid]: id del equipo } */
export const duenosDe = (fichas) => Object.fromEntries((fichas || []).filter((f) => f && f.pid != null && f.tid != null).map((f) => [f.pid, f.tid]));
/**
 * Apunta las cláusulas que están a punto de abrirse. `fichas`: [{ pid, tid, base, abre, veda, abierta, escudo, cl, v, r, pos, tit, hp }]
 * (base: hasta cuándo la protege LaLiga por el fichaje, que no cambia; abre: cuándo se puede pagar de verdad, con el cierre
 * de la jornada; veda: desde cuándo están cerradas las cláusulas por la jornada, si lo están). `ahora`: la hora de ahora;
 * `fotoT`: de cuándo es la liga que se ve (es la hora que se apunta como «visto»: con la liga guardada de hace un rato, lo
 * que pasó después no se ha visto). Devuelve { reg, cambia }; el registro de entrada no se toca.
 * Solo cuenta la PRIMERA vez que se abre: una que LaLiga dejó de proteger hace días y que ahora solo espera a que empiece la
 * jornada (todas las abiertas se cierran 24 h antes) ya estaba abierta, y no es lo que se quiere contar. Con un blindaje
 * puesto no se apunta nada (lo apuntado de antes se queda como estaba y se mandará como «blindada»).
 */
export function apuntarAperturas(reg0, fichas, ahora, fotoT = ahora) {
  const reg = { ...(reg0 && typeof reg0 === 'object' ? reg0 : {}) };
  let cambia = false;
  const visto = Math.min(ahora, fotoT > 0 ? fotoT : ahora);
  for (const f of Array.isArray(fichas) ? fichas : []) {
    if (!f || f.abierta || f.escudo || !(f.base > 0) || !(f.abre > ahora) || f.abre - ahora > AP_ANTES) continue;
    if (!(f.cl > 0) || !(f.v > 0) || !(f.pos >= 1 && f.pos <= 4) || f.pid == null) continue;
    if (f.base <= ahora && !(f.veda > 0 && f.base >= f.veda)) continue;
    // (la liga que se ve tiene que ser de antes de abrirse: si no, lo apuntado no sería de «antes»)
    if (!(visto < f.abre)) continue;
    const k = `${f.pid}|${f.base}`;
    reg[k] = { pid: f.pid, tid: f.tid == null ? null : f.tid, base: f.base, abre: f.abre, cl: f.cl, v: f.v, r: f.r == null ? null : f.r, pos: f.pos, tit: f.tit == null ? null : f.tit, hp: f.hp == null ? null : f.hp, t: visto };
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
 * Las apuntadas cuyas 24 h ya han pasado. `lista`: la actividad de la liga (la guardada, que lleva la de hoy);
 * `cubre`: { seguido, hasta }: desde cuándo y hasta cuándo esa actividad está guardada SIN HUECOS (datos.js lo apunta al
 * leerla: si un día no enlaza con lo guardado, o la lectura falla, deja de estarlo); `fotoT`: de cuándo es la liga que se
 * está viendo (no la hora de ahora: con la liga guardada de hace días no se sabe qué pasó después); `valorEn(pid, t)`: lo
 * que valía ese día (si el valor pasa de la cláusula, LaLiga la sube sola hasta el valor: un clausulazo de esos días se
 * paga por ese valor, no por la cláusula apuntada); `duenos`: { [pid]: equipo } de ahora, para comprobar que cuadra.
 * Devuelve { listas: [{ c, abre, v, cs, r, pos, tit, ida, bl, hp }], quitar: [claves] }: `listas`, para mandar (c es la clave
 * del registro); `quitar`, las que no cuentan (cambió de dueño de otra forma, o no cuadra).
 */
export function resolverAperturas(reg, lista, cubre, fotoT, valorEn = null, duenos = null) {
  const listas = [], quitar = [];
  const seguido = cubre && cubre.seguido > 0 ? cubre.seguido : 0, hasta = cubre && cubre.hasta > 0 ? cubre.hasta : 0;
  for (const [k, e] of Object.entries(reg || {})) {
    if (!e || !e.abre) continue;
    const fin = e.abre + AP_VENTANA;
    if (!(fotoT >= fin + 10 * MIN)) continue;
    // (la actividad tiene que estar entera desde antes de la última vez que se vio hasta pasadas las 24 h: con un hueco en
    // medio, un clausulazo que cayera en él saldría como «no se lo llevaron»)
    if (!seguido || seguido > e.t || !(hasta >= fin)) continue;
    const suyos = (lista || []).filter((a) => a && a.t && String(a.pid) === String(e.pid) && a.t > e.t).sort((a, b) => a.t - b.t);
    const movs = suyos.filter((a) => a.t <= fin);
    const porClausula = (a) => { const imp = Math.abs(num(a.importe)), v = valorEn ? num(valorEn(e.pid, a.t)) : 0; return cerca(imp, e.cl) || (v > e.cl && cerca(imp, v)); };
    // un clausulazo cuenta desde la última vez que se vio (si el calendario va unos minutos corrido, el del primer minuto
    // cae antes de la hora calculada); el que LaLiga cuenta como compra entre mánagers, solo desde media hora antes
    const cz = movs.find((a) => a.clase === 'clausula' || (a.clase === 'compra' && a.t >= e.abre - 30 * MIN && (a.otroId || a.otro) && porClausula(a)));
    // otro traspaso suyo (lo vendió, se lo compraron con una oferta, lo fichó otro antes de abrirse…): no cuenta
    const otro = movs.some((a) => TRASPASO.has(a.clase) && (!cz || a.t < cz.t - 2 * MIN));
    if (otro) { quitar.push(k); continue; }
    // y tiene que cuadrar con quién lo tiene ahora: si no se lo llevaron y ya no es de quien era, tiene que haber un
    // traspaso suyo después de las 24 h que lo explique; si no lo hay, falta algo y no se manda
    if (!cz && duenos && e.tid != null && String(duenos[e.pid]) !== String(e.tid) && !suyos.some((a) => a.t > fin && TRASPASO.has(a.clase))) { quitar.push(k); continue; }
    // blindada: un blindaje desde la última vez que se vio (también el puesto antes de la hora de abrirse) y antes de que
    // se la llevaran. Las horas que se pudo pagar se cuentan hasta ese blindaje; si aun así fueron AP_HORAS_MIN o más (la
    // blindó casi al final), estuvo abierta de verdad y no cuenta como blindada
    const esc = movs.find((a) => a.clase === 'blindaje' && (!cz || a.t < cz.t));
    let hp = e.hp == null ? null : e.hp, bl = false;
    if (esc) { hp = e.hp == null ? null : Math.max(0, Math.min(e.hp, Math.floor((esc.t - e.abre) / HORA))); bl = hp == null || hp < AP_HORAS_MIN; }
    listas.push({ c: k, abre: e.abre, v: e.v, cs: e.cl / e.v - 1, r: e.r, pos: e.pos, tit: e.tit, ida: !!cz, bl, hp });
  }
  return { listas, quitar };
}

/* ---------- leer lo de las demás ligas ---------- */
export const VER_CADA = 3 * HORA, VER_FALLO = 30 * MIN, VER_MAX = 80;
/** los ids de los libres de ahora, para pedir lo suyo */
export const idsDe = (mercado, ahora) => demandaDe(mercado, ahora).map((x) => x[0]).slice(0, VER_MAX);
/** ¿toca pedirlo? `ya`: { k, t, dia, mal } de lo último leído; `hoy`: el día de hoy. Cuando cambian los libres (el mercado
    de tu liga), cada VER_CADA o al cambiar de día (lo de «hoy» y «ayer» ya es otro) */
export function tocaVer(ya, clave, ahora, hoy = '') {
  const y = ya || {};
  if (!clave) return false;
  if (y.mal && ahora - y.mal < VER_FALLO) return false;
  return y.k !== clave || ahora - num(y.t) > VER_CADA || (!!hoy && y.dia !== hoy);
}

/* ---------- lo que se enseña en la ficha de un libre ---------- */
/* (Carlos, 26 nov, 18:53: «hay en general mucho texto. Quiero textos más reducidos y mejor integrados y fáciles de entender,
   tampoco 60 pestañas para cada texto») UNA línea y sin nada que desplegar. Y a las 19:31 («lo dejaría gratis, y mejor
   integrado con la pestaña de arriba y abajo»): sin tarjeta propia y sin candado, dentro de la tarjeta del libre
   (`otrasLinea`): «En otras ligas: +11 % sobre su valor (hasta +19 %) · demanda alta». */
// (el espacio de antes del % no se parte: que la cifra no se quede en una línea y el % en otra)
const pc = (s) => pct(Math.round(s * 100), 0).replace(/ %/g, ' %');
/**
 * Lo pagado en las demás ligas, en una frase, o null si no hay datos de 3 ligas.
 * x: { n, med, max } del servidor (n: en cuántas ligas, por tramos; med y max: lo pagado sobre el valor que tenía el día de
 * cada compra, en puntos enteros). Por debajo de su valor no se dice nada: «a su valor» (la subasta de un libre empieza ahí).
 */
export function pagadoTxt(x) {
  if (!x || !(x.n >= 3) || !Number.isFinite(x.med) || !Number.isFinite(x.max)) return null;
  const med = Math.max(0, Math.round(x.med * 100) / 100), max = Math.max(med, Math.round(x.max * 100) / 100);
  return `Se paga ${med > 0 ? `${pc(med)} sobre su valor` : 'a su valor'}${max - med < 0.005 ? '' : ` (hasta ${pc(max)})`}`;
}
const NIVEL = { 1: 'baja', 2: 'media', 3: 'alta' };
/** la demanda en las demás ligas, en una frase, o null. x: [hoy, ayer], cada uno de 0 (no se sabe) a 3. Con el de hoy sin
    saberse todavía (a primera hora), el de ayer */
export function demandaTxt(x) {
  const hoy = Array.isArray(x) ? NIVEL[x[0]] : null, ayer = Array.isArray(x) ? NIVEL[x[1]] : null;
  if (!hoy && !ayer) return null;
  return hoy ? `Demanda ${hoy}${ayer && ayer !== hoy ? ` (ayer, ${ayer})` : ''}` : `Demanda ${ayer} ayer`;
}
/** lo pagado y la demanda juntos, o null si no hay nada que decir */
export const otrasTxt = (pagado, demanda) => [pagado, demanda].filter(Boolean).join(' · ') || null;
/**
 * (Carlos, 26 nov, 19:31: «no lo veo una función tan premium, lo dejaría gratis, y mejor integrado con la pestaña de arriba
 * y abajo») ya no es una tarjeta aparte ni lleva candado: es la SEGUNDA LÍNEA de «Libre en el mercado de la liga», debajo
 * de «Desde X · la app pujaría Y»: «En otras ligas: +11 % sobre su valor (hasta +19 %) · demanda alta». O null
 */
export function otrasLinea(pagado, demanda) {
  const l = otrasTxt(pagado ? pagado.replace(/^Se paga /, '') : null, demanda ? demanda[0].toLowerCase() + demanda.slice(1) : null);
  return l ? `En otras ligas: ${l}` : null;
}
