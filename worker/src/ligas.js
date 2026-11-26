/*
 * Lo que solo se ve juntando todas las ligas que usan la app (26 nov; Carlos: «la demanda de otras ligas y lo que se paga en
 * otras ligas por un jugador se puede hacer todo en uno»). Ideas 4, 5 y 6 de claude/propuesta-funciones-top.md del proyecto.
 * Va en un Durable Object con SQLite, «ligas|todos», aparte de «pujas|todos» (que sigue igual: lo pagado por tramos, sin
 * jugador). Aquí se guardan los datos SIN LIGA, SIN MÁNAGER Y SIN CUENTA (aparte, solo para los frenos y cifradas, las ligas
 * de las que manda cada cuenta: `cta` y `tope`):
 *
 *   pago (h, dia, pid, lg, tl, s, v, r, top, ll)  cada compra a LaLiga de un libre: el jugador (su id es público: sale en la
 *                                          lista de jugadores de LaLiga), el día, lo pagado sobre su valor, su valor, lo que
 *                                          subía y si era de los top (ll: el día que llegó). PAGO_DIAS días
 *   dem  (dia, pid, lg, tl, n, mx, t0, t)  la demanda: cuántas pujas llevaba cada libre del mercado de una liga ese día (n, lo
 *                                          último visto; mx, lo más; t0 y t, primera vez y último cambio). DEM_DIAS días
 *   cla  (h, dia, lg, tl, v, cs, r, pos, tit, ida, bl, hp)  cada cláusula que se abre: valor, cláusula sobre el valor, lo que
 *                                          subía, puesto, % de titular y si se lo llevaron en 24 h (bl: lo blindaron antes;
 *                                          hp: cuántas de esas 24 h se podía pagar, sin el cierre de la jornada). Sin
 *                                          jugador. CLA_DIAS días
 *   cta  (hs, lg, dia, v)                  las ligas de las que ha mandado algo cada cuenta (la cuenta, cifrada), el último
 *                                          día y cuándo se comprobó con LaLiga que es suya: para que una cuenta no pueda
 *                                          hacerse pasar por otras ligas ni por muchas. LIGAS_CUENTA_DIAS
 *   tope (dia, k, n)                       los frenos del día (se borran al día siguiente)
 *   meta (k, v)                            la sal y el último día que se limpió
 *
 * LA HUELLA DE LA LIGA. La app no manda el id de la liga, sino `l`, un SHA-256 recortado de él, y a este objeto no le llega
 * otra cosa (el Worker, para comprobar que la liga es de quien la manda, pregunta a LaLiga las ligas de esa cuenta y compara
 * sus huellas: las ve un momento y no las guarda; ver «ES SUYA» más abajo). Aquí
 * dentro se vuelve a cifrar con una sal que se crea al azar en este objeto la primera vez y NO SALE DE ÉL (ninguna
 * operación la devuelve): `lg` = HMAC(sal, l). Nada de lo que sale de aquí (lo que se enseña, lo que se saca para medir)
 * deja volver a la liga, y sirve para dos cosas: no contar dos veces lo de una liga con varios usuarios y no enseñarle a
 * nadie lo de su propia liga. Las huellas de cada compra y de cada cláusula (`h`) van igual: HMAC de la que hace el móvil.
 * La cuenta solo entra, cifrada igual, en `cta` y en los frenos del día.
 * OJO, HASTA DÓNDE LLEGA: la sal vive en este mismo almacén. Quien tuviera una copia ENTERA de él (solo el dueño de la
 * cuenta de Cloudflare) tendría también la sal y, como los ids de liga y de cuenta son números, podría sacarlos probando
 * (las ligas de los datos y las cuentas de `cta`). Si algún
 * día se quiere tapar también eso, la sal de fuera va en un secreto del Worker como segunda capa (`lg` = HMAC(secreto, lg
 * de ahora)): lo guardado se pasa con esa misma cuenta, sin perder nada.
 *
 * ES SUYA, Y POCAS. Con la huella de una liga ajena (los ids son números: se puede calcular la de cualquiera) alguien podría
 * pisar lo de esa liga o, preguntando «sin ella» y «con ella», sacar lo que se paga allí. Por eso la primera vez que una
 * cuenta manda algo de una liga (y cada VERIFICA_DIAS) este objeto contesta `verificar` sin apuntar nada, el Worker
 * pregunta a LaLiga con la sesión de esa cuenta en qué ligas juega y solo si `l` es la huella de una de ellas repite el
 * envío con `verificada`. Y como crear ligas de verdad es gratis, una cuenta solo puede mandar de LIGAS_POR_CUENTA ligas
 * distintas en LIGAS_CUENTA_DIAS días (menos que PAGADO_MIN: una cuenta sola no fabrica «lo pagado en 3 ligas»), y solo
 * puede leer con una liga de la que ha mandado algo en esos días. Varias cuentas de acuerdo, con ligas de verdad, sí
 * podrían: contra eso, las medianas, lo imposible que no se guarda y que con más ligas pesan menos.
 *
 * EL TIPO DE LIGA (`tl`). LaLiga tiene varias clases de liga (privadas, públicas, patrocinadas…; en la lista de ligas, `access`
 * y `type.id`: vistos el 26 nov de 2026 en la liga de Carlos, «private» y «8») y las Premium. No se sabe si en todas se
 * paga parecido, así que cada fila lleva el tipo de su liga («private|8|n»; la «p» final, Premium) y al leer solo se
 * juntan las ligas DEL MISMO TIPO que la de quien pregunta. No identifica a ninguna liga: es su clase.
 *
 * LEER («ver»). Nunca lo de la liga de quien pregunta (`lg <> la suya`). Lo pagado por un jugador, solo con compras de
 * PAGADO_MIN ligas distintas o más en PAGADO_DIAS días (una por liga, la última: una liga que mande basura pesa como una),
 * en puntos enteros y con la cuenta de ligas por tramos (PAGADO_TRAMOS: «3 o más», «5 o más», «10 o más»; así no se sabe
 * cuántas ligas usan la app ni se puede sacar lo de una liga restando); la demanda, solo un nivel de 1 a 3 (nunca en
 * cuántas ligas ni cuántas hay) y solo si ese día está libre en DEM_MIN_LIGAS ligas o más. Lo que se contesta al escribir
 * no dice nunca si algo estaba ya guardado.
 */
export const PAGO_DIAS = 120, DEM_DIAS = 45, CLA_DIAS = 180;
// lo pagado que se enseña: de cuántos días, con cuántas ligas como poco y en qué tramos se dice en cuántas
export const PAGADO_DIAS = 3, PAGADO_MIN = 3, PAGADO_TRAMOS = [10, 5, 3];
// la demanda que se enseña: en cuántas ligas tiene que estar libre ese día, y dónde se cortan los niveles (entre todos los
// libres de ese día: por encima del 80 %, nivel 3; por encima de la mitad, 2; el resto, 1)
export const DEM_MIN_LIGAS = 5, DEM_CORTES = [0.5, 0.8], DEM_CORTES_CADA = 10 * 60e3;
// frenos: envíos de una cuenta al día, de cuántas ligas distintas puede mandar una cuenta y en cuántos días (tiene que ser
// menos que PAGADO_MIN: una cuenta sola no puede fabricar «3 ligas»), cada cuántos días se vuelve a comprobar con LaLiga que
// la liga es suya, cláusulas de una liga al día y cuánto cabe en cada envío
export const LIGAS_CUENTA_DIA = 24, LIGAS_POR_CUENTA = 2, LIGAS_CUENTA_DIAS = 7, VERIFICA_DIAS = 30, CLA_LIGA_DIA = 40, PAGO_POR_VEZ = 80, DEM_POR_VEZ = 80, CLA_POR_VEZ = 40, VER_IDS = 80;
// lo que devuelve «medida» de una vez (el dueño): días y filas
export const MEDIDA_DIAS = 31, MEDIDA_FILAS = 40000;

const TABLAS = [
  "CREATE TABLE IF NOT EXISTS pago (h TEXT PRIMARY KEY, dia TEXT NOT NULL, pid INTEGER NOT NULL, lg TEXT NOT NULL, tl TEXT NOT NULL DEFAULT '', s REAL NOT NULL, v INTEGER NOT NULL, r REAL, top INTEGER NOT NULL DEFAULT 0, ll TEXT NOT NULL DEFAULT '') WITHOUT ROWID",
  'CREATE INDEX IF NOT EXISTS pago_pd ON pago (pid, dia)',
  'CREATE INDEX IF NOT EXISTS pago_d ON pago (dia)',
  "CREATE TABLE IF NOT EXISTS dem (dia TEXT NOT NULL, pid INTEGER NOT NULL, lg TEXT NOT NULL, tl TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL, mx INTEGER NOT NULL, t0 INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (dia, pid, lg)) WITHOUT ROWID",
  "CREATE TABLE IF NOT EXISTS cla (h TEXT PRIMARY KEY, dia TEXT NOT NULL, lg TEXT NOT NULL DEFAULT '', tl TEXT NOT NULL DEFAULT '', v INTEGER NOT NULL, cs REAL NOT NULL, r REAL, pos INTEGER NOT NULL, tit INTEGER, ida INTEGER NOT NULL, bl INTEGER NOT NULL DEFAULT 0, hp INTEGER) WITHOUT ROWID",
  'CREATE INDEX IF NOT EXISTS cla_d ON cla (dia)',
  "CREATE TABLE IF NOT EXISTS cta (hs TEXT NOT NULL, lg TEXT NOT NULL, dia TEXT NOT NULL, v TEXT NOT NULL DEFAULT '', PRIMARY KEY (hs, lg)) WITHOUT ROWID",
  'CREATE TABLE IF NOT EXISTS tope (dia TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (dia, k)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID',
];
const fila = (cur) => { for (const x of cur) return x; return null; };
const filas = (cur) => [...cur];
const leerMeta = (sql, k) => { const x = fila(sql.exec('SELECT v FROM meta WHERE k = ?', k)); return x ? x.v : null; };
const ponerMeta = (sql, k, v) => sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
function preparar(sql, memo) {
  if (memo.ligasTablas) return;
  for (const t of TABLAS) sql.exec(t);
  memo.ligasTablas = true;
}

const diaOk = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(`${x}T12:00:00Z`));
/** el día de n días antes (o después) de uno dado, en AAAA-MM-DD */
export const otroDia = (dia, n) => { const t = new Date(`${dia}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
/** la huella que hace el móvil (de la liga, de una compra o de una cláusula): 24 cifras en hexadecimal */
export const huellaOk = (x) => typeof x === 'string' && /^[0-9a-f]{24}$/.test(x);
/** el id de un jugador de LaLiga (un entero pequeño; el mayor el 26 nov de 2026 era 3311) o null */
export const pidOk = (x) => { const n = typeof x === 'number' ? x : typeof x === 'string' && /^\d{1,6}$/.test(x) ? Number(x) : NaN; return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null; };
/** el tipo de la liga, como lo manda la app: «acceso|tipo|p o n» (letras, cifras y guiones, cortos); lo que no sea eso, '' */
export const tipoOk = (x) => (typeof x === 'string' && /^[a-z0-9_-]{0,12}\|[a-z0-9_-]{0,12}\|[pn]$/.test(x) ? x : '');
const fin = (x, lo, hi) => { const v = Number(x); return x != null && x !== '' && Number.isFinite(v) && v >= lo && v <= hi ? v : null; };

/* ---------- lo que entra, limpio ---------- */
/** una compra con su jugador: { k, d, p, s, v, r, top } o null. Los números ya vienen limpios de `compraLimpia` (index.js);
    aquí se vuelven a mirar por si acaso */
export function pagoLimpio(x, hoy) {
  if (!x || typeof x !== 'object' || !huellaOk(x.k) || !diaOk(x.d)) return null;
  const p = pidOk(x.p), s = fin(x.s, -0.1, 5), v = fin(x.v, 1e5, 400e6), r = x.r == null ? null : fin(x.r, -0.2, 0.3);
  if (p == null || s == null || v == null || (x.r != null && r == null)) return null;
  // (lo mismo que tira el motor de la app antes de mandarlas: más del doble de su valor solo vale en los baratos, con menos
  // de 3 M de más; así quien mande cifras infladas no puede pasar de ahí)
  if (s > 1 && v * s > 3e6) return null;
  if (hoy && (x.d > otroDia(hoy, 1) || x.d < otroDia(hoy, -61))) return null;
  return { k: x.k, d: x.d, p, s: Math.round(s * 1000) / 1000, v: Math.round(v / 1e4) * 1e4, r: r == null ? null : Math.round(r * 1e4) / 1e4, top: x.top === true };
}
/** los libres del mercado de una liga con sus pujas: [[id del jugador, pujas], …] → lo mismo, limpio y sin repetir */
export function demandaLimpia(m) {
  const out = new Map();
  for (const y of Array.isArray(m) ? m.slice(0, DEM_POR_VEZ * 2) : []) {
    if (!Array.isArray(y)) continue;
    const p = pidOk(y[0]), n = fin(y[1], 0, 500);
    if (p == null || n == null || out.has(p)) continue;
    out.set(p, Math.round(n));
    if (out.size >= DEM_POR_VEZ) break;
  }
  return [...out];
}
/** una cláusula que se abrió: { k, d, v, cs, r, pos, tit, ida, bl, hp } o null (sin jugador: solo cómo era) */
export function aperturaLimpia(x, hoy) {
  if (!x || typeof x !== 'object' || !huellaOk(x.k) || !diaOk(x.d)) return null;
  const v = fin(x.v, 1e5, 400e6), cs = fin(x.cs, -0.05, 30), r = x.r == null ? null : fin(x.r, -0.2, 0.3), pos = fin(x.pos, 1, 4), tit = x.tit == null ? null : fin(x.tit, 0, 1), hp = x.hp == null ? null : fin(x.hp, 0, 24);
  if (v == null || cs == null || pos == null || !Number.isInteger(pos) || (x.r != null && r == null) || (x.tit != null && tit == null) || (x.hp != null && hp == null)) return null;
  if (typeof x.ida !== 'boolean') return null;
  // (se manda cuando ya han pasado sus 24 h: ni de mañana ni de hace más de dos semanas)
  if (hoy && (x.d > hoy || x.d < otroDia(hoy, -15))) return null;
  return { k: x.k, d: x.d, v: Math.round(v / 1e4) * 1e4, cs: Math.round(cs * 1000) / 1000, r: r == null ? null : Math.round(r * 1e4) / 1e4, pos, tit: tit == null ? null : Math.round(tit * 100), ida: x.ida, bl: x.bl === true, hp: hp == null ? null : Math.round(hp) };
}

/* ---------- la sal y las huellas de dentro ---------- */
const enc = new TextEncoder();
const hexDe = (buf, n) => [...new Uint8Array(buf)].slice(0, n).map((b) => b.toString(16).padStart(2, '0')).join('');
async function claveDe(sql, memo) {
  if (memo.ligasClave) return memo.ligasClave;
  // (sin esperas entre leer y poner: no se cuela otra petición en medio; y si ya hay una, se queda la que hay)
  if (!leerMeta(sql, 'sal')) sql.exec('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)', 'sal', hexDe(crypto.getRandomValues(new Uint8Array(32)).buffer, 32));
  const sal = leerMeta(sql, 'sal');
  memo.ligasClave = await crypto.subtle.importKey('raw', enc.encode(sal), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return memo.ligasClave;
}
const hm = async (K, texto, n = 8) => hexDe(await crypto.subtle.sign('HMAC', K, enc.encode(texto)), n);

/* ---------- los frenos, aquí dentro (sin otra petición a otro objeto) ---------- */
/** ¿ha mandado esa cuenta algo de esa liga en los últimos LIGAS_CUENTA_DIAS días, comprobada con LaLiga? (para leer: solo
    con una liga suya) */
function ligaDeLaCuenta(sql, dia, hs, lg) {
  const x = fila(sql.exec('SELECT dia, v FROM cta WHERE hs = ? AND lg = ?', hs, lg));
  return !!x && x.dia > otroDia(dia, -LIGAS_CUENTA_DIAS) && !!x.v && x.v > otroDia(dia, -VERIFICA_DIAS);
}
/**
 * ¿puede esa cuenta mandar de esa liga? 'si' (y lo apunta), 'tope' (ya manda de LIGAS_POR_CUENTA ligas distintas en
 * LIGAS_CUENTA_DIAS días: quien se invente ligas, hasta ahí, menos de las que hacen falta para que algo se enseñe) o
 * 'verificar' (no consta que esa liga sea suya, o hace más de VERIFICA_DIAS que se miró: el Worker lo pregunta a LaLiga y
 * repite con `verificada`). Sin comprobar no se apunta nada.
 */
function entraLiga(sql, dia, hs, lg, verificada) {
  const desde = otroDia(dia, -LIGAS_CUENTA_DIAS);
  const suyas = filas(sql.exec('SELECT lg, dia, v FROM cta WHERE hs = ?', hs)).filter((x) => x.dia > desde);
  const ya = suyas.find((x) => x.lg === lg);
  if (!ya && suyas.length >= LIGAS_POR_CUENTA) return 'tope';
  const comprobada = !!ya && !!ya.v && ya.v > otroDia(dia, -VERIFICA_DIAS);
  if (!comprobada && !verificada) return 'verificar';
  if (!ya || ya.dia !== dia || !comprobada) sql.exec('INSERT INTO cta (hs, lg, dia, v) VALUES (?, ?, ?, ?) ON CONFLICT(hs, lg) DO UPDATE SET dia = excluded.dia, v = excluded.v', hs, lg, dia, comprobada ? ya.v : dia);
  return 'si';
}
/** un envío más de esa cuenta hoy: false si ya ha hecho LIGAS_CUENTA_DIA */
function cabeEnvio(sql, dia, hs) {
  const k = `u|${hs}`, ya = fila(sql.exec('SELECT n FROM tope WHERE dia = ? AND k = ?', dia, k));
  if (ya && ya.n >= LIGAS_CUENTA_DIA) return false;
  sql.exec('INSERT INTO tope (dia, k, n) VALUES (?, ?, 1) ON CONFLICT(dia, k) DO UPDATE SET n = n + 1', dia, k);
  return true;
}
/** cuántas cláusulas más caben hoy de esa liga (CLA_LIGA_DIA: una liga de verdad abre unas pocas al día) */
function cabenClausulas(sql, dia, lg) {
  const ya = fila(sql.exec('SELECT n FROM tope WHERE dia = ? AND k = ?', dia, `a|${lg}`));
  return Math.max(0, CLA_LIGA_DIA - (ya ? ya.n : 0));
}
const apuntarClausulas = (sql, dia, lg, n) => { if (n > 0) sql.exec('INSERT INTO tope (dia, k, n) VALUES (?, ?, ?) ON CONFLICT(dia, k) DO UPDATE SET n = n + excluded.n', dia, `a|${lg}`, n); };
/** lo caducado, fuera: una vez al día */
function limpiar(sql, memo, dia) {
  if (memo.ligasLimpio === dia) return;
  if (leerMeta(sql, 'limpio') !== dia) {
    sql.exec('DELETE FROM pago WHERE dia < ?', otroDia(dia, -PAGO_DIAS));
    sql.exec('DELETE FROM dem WHERE dia < ?', otroDia(dia, -DEM_DIAS));
    sql.exec('DELETE FROM cla WHERE dia < ?', otroDia(dia, -CLA_DIAS));
    sql.exec('DELETE FROM tope WHERE dia < ?', dia);
    sql.exec('DELETE FROM cta WHERE dia <= ?', otroDia(dia, -LIGAS_CUENTA_DIAS - 1));
    ponerMeta(sql, 'limpio', dia);
  }
  memo.ligasLimpio = dia;
}

/* ---------- leer ---------- */
const cuantil = (o, q) => { if (!o.length) return 0; const i = (o.length - 1) * q, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
const marcas = (n) => Array(n).fill('?').join(',');
/** lo pagado por cada jugador en las demás ligas: { [id]: { n, med, max } }, solo con PAGADO_MIN ligas o más. `n` es el
    tramo («3 o más», «5 o más»…), y med y max van en puntos enteros */
function pagadoDe(sql, dia, lg, tl, ids) {
  const out = {};
  if (!ids.length) return out;
  const porJug = new Map();
  // (por día: de cada liga se queda la última compra de ese jugador; así una liga cuenta una vez)
  for (const x of sql.exec(`SELECT pid, lg, s FROM pago WHERE pid IN (${marcas(ids.length)}) AND dia >= ? AND dia <= ? AND lg <> ? AND tl = ? ORDER BY dia, h`, ...ids, otroDia(dia, -PAGADO_DIAS), dia, lg, tl)) {
    if (!porJug.has(x.pid)) porJug.set(x.pid, new Map());
    porJug.get(x.pid).set(x.lg, x.s);
  }
  for (const [pid, m] of porJug) {
    if (m.size < PAGADO_MIN) continue;
    const o = [...m.values()].sort((a, b) => a - b);
    out[pid] = { n: PAGADO_TRAMOS.find((t) => o.length >= t) || PAGADO_MIN, med: Math.round(cuantil(o, 0.5) * 100) / 100, max: Math.round(o[o.length - 1] * 100) / 100 };
  }
  return out;
}
/** dónde se cortan los niveles de demanda de un día (pujas por liga en la que está libre), entre todos los libres de las
    ligas de ese tipo */
function cortesDem(sql, memo, dia, tl, ahora) {
  const g = (memo.ligasCortes ||= {}), k = `${dia}|${tl}`;
  if (g[k] && ahora - g[k].t < DEM_CORTES_CADA) return g[k];
  const o = filas(sql.exec('SELECT COUNT(*) AS c, SUM(n) AS s FROM dem WHERE dia = ? AND tl = ? GROUP BY pid HAVING COUNT(*) >= ?', dia, tl, DEM_MIN_LIGAS)).map((x) => x.s / x.c).sort((a, b) => a - b);
  for (const y of Object.keys(g)) if (y.slice(0, 10) < otroDia(dia, -2)) delete g[y];
  return (g[k] = { t: ahora, n: o.length, q: DEM_CORTES.map((p) => cuantil(o, p)) });
}
/** el nivel de demanda de cada jugador hoy y ayer en las demás ligas: { [id]: [hoy, ayer] } (0: no se sabe; 1 a 3) */
function demandaDe(sql, memo, dia, lg, tl, ids, ahora) {
  const out = {};
  if (!ids.length) return out;
  [dia, otroDia(dia, -1)].forEach((d, i) => {
    const c = cortesDem(sql, memo, d, tl, ahora);
    // (con menos de 10 libres ese día no hay con qué comparar: no se dice nada)
    if (c.n < 10) return;
    for (const x of sql.exec(`SELECT pid, COUNT(*) AS c, SUM(n) AS s FROM dem WHERE dia = ? AND lg <> ? AND tl = ? AND pid IN (${marcas(ids.length)}) GROUP BY pid`, d, lg, tl, ...ids)) {
      if (x.c < DEM_MIN_LIGAS) continue;
      const v = x.s / x.c;
      (out[x.pid] ||= [0, 0])[i] = v > c.q[1] ? 3 : v > c.q[0] ? 2 : 1;
    }
  });
  return out;
}

/**
 * (en el objeto «ligas|todos») b: { op, dia (de Madrid), ahora, … }
 *   pago    { l, t, uid, xs: [{ k, d, p, s, v, r, top }], verificada }     las compras con su jugador (de POST /pujas)
 *   apunte  { l, t, uid, m: [[pid, pujas]], a: [{ k, d, v, cs, r, pos, tit, ida, bl, hp }], verificada }   la demanda y las cláusulas abiertas
 *   ver     { l, t, uid, ids, pagado, demanda }                            lo de las demás ligas de su tipo para esos jugadores
 *   medida  { desde, hasta }                                               (el dueño) lo guardado, para medir
 * `verificada`: el Worker ha comprobado con LaLiga que esa liga es de esa cuenta (solo lo pone él; sin eso, la primera vez se
 * contesta { verificar } y no se apunta nada). Lo que contesta al escribir no dice cuánto era nuevo.
 */
export async function ligasObjeto(st, b, memo = {}) {
  const sql = st.sql;
  if (!b || typeof b !== 'object' || !sql) return { ok: false, e: 'mal' };
  preparar(sql, memo);
  const ahora = Number(b.ahora) || Date.now();
  const dia = diaOk(b.dia) ? b.dia : new Date(ahora).toISOString().slice(0, 10);
  limpiar(sql, memo, dia);
  const K = await claveDe(sql, memo);

  if (b.op === 'medida') {
    const hasta = diaOk(b.hasta) ? b.hasta : dia;
    let desde = diaOk(b.desde) ? b.desde : otroDia(hasta, -MEDIDA_DIAS + 1);
    if (desde < otroDia(hasta, -MEDIDA_DIAS + 1)) desde = otroDia(hasta, -MEDIDA_DIAS + 1);
    // (la huella de la liga no sale ni para el dueño: otra, hecha de ella, que solo sirve para agrupar)
    const alias = new Map();
    const aliasDe = async (lg) => { if (!alias.has(lg)) alias.set(lg, await hm(K, `m|${lg}`, 5)); return alias.get(lg); };
    const pago = [], cla = [];
    for (const x of filas(sql.exec('SELECT dia, pid, lg, tl, s, v, r, top, ll FROM pago WHERE dia >= ? AND dia <= ? ORDER BY dia, h LIMIT ?', desde, hasta, MEDIDA_FILAS))) pago.push([x.dia, x.pid, x.s, x.v, x.r, x.top, await aliasDe(x.lg), x.tl, x.ll]);
    const dem = filas(sql.exec('SELECT dia, pid, tl, COUNT(*) AS c, SUM(CASE WHEN n > 0 THEN 1 ELSE 0 END) AS con, SUM(n) AS s, SUM(mx) AS smx FROM dem WHERE dia >= ? AND dia <= ? GROUP BY dia, pid, tl ORDER BY dia, pid, tl LIMIT ?', desde, hasta, MEDIDA_FILAS)).map((x) => [x.dia, x.pid, x.c, x.con, x.s, x.smx, x.tl]);
    for (const x of filas(sql.exec('SELECT dia, lg, tl, v, cs, r, pos, tit, ida, bl, hp FROM cla WHERE dia >= ? AND dia <= ? ORDER BY dia, h LIMIT ?', desde, hasta, MEDIDA_FILAS))) cla.push([x.dia, x.v, x.cs, x.r, x.pos, x.tit, x.ida, x.bl, x.tl, await aliasDe(x.lg), x.hp]);
    const cuenta = (t) => fila(sql.exec(`SELECT COUNT(*) AS c, MIN(dia) AS d0, MAX(dia) AS d1 FROM ${t}`));
    return { ok: true, desde, hasta, pago, dem, cla, corta: pago.length >= MEDIDA_FILAS || dem.length >= MEDIDA_FILAS || cla.length >= MEDIDA_FILAS,
      hay: { pago: cuenta('pago'), dem: cuenta('dem'), cla: cuenta('cla'), ligasHoy: fila(sql.exec('SELECT COUNT(DISTINCT lg) AS c FROM dem WHERE dia = ?', dia)).c } };
  }

  if (!huellaOk(b.l)) return { ok: false, e: 'liga' };
  const lg = await hm(K, `l|${b.l}`, 8), tl = tipoOk(b.t);
  // (la cuenta, cifrada con la misma sal: solo para `cta` y los frenos del día; no se guarda con nada de lo demás)
  const uid = String(b.uid || '');
  if (!/^\d{1,15}$/.test(uid)) return { ok: false, e: 'cuenta' };
  const hs = await hm(K, `u|${uid}`, 8);

  if (b.op === 'ver') {
    // (solo con una liga de la que esa cuenta ha mandado algo estos días: no se puede preguntar con la huella de cualquiera)
    if (!ligaDeLaCuenta(sql, dia, hs, lg)) return { ok: true, p: {}, d: {}, falta: true };
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).slice(0, VER_IDS * 2).map(pidOk).filter((x) => x != null))].slice(0, VER_IDS);
    return { ok: true, p: b.pagado ? pagadoDe(sql, dia, lg, tl, ids) : {}, d: b.demanda ? demandaDe(sql, memo, dia, lg, tl, ids, ahora) : {} };
  }

  if (b.op !== 'pago' && b.op !== 'apunte') return { ok: false, e: 'mal' };
  const entra = entraLiga(sql, dia, hs, lg, b.verificada === true);
  if (entra === 'tope') return { ok: false, tope: 'ligas' };
  if (entra === 'verificar') return { ok: false, verificar: true };

  if (b.op === 'pago') {
    for (const y of Array.isArray(b.xs) ? b.xs.slice(0, PAGO_POR_VEZ) : []) {
      const x = pagoLimpio(y, dia);
      if (!x) continue;
      // (la primera que llega se queda: otro de la misma liga manda la misma compra con la misma huella)
      sql.exec('INSERT INTO pago (h, dia, pid, lg, tl, s, v, r, top, ll) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(h) DO NOTHING', await hm(K, `c|${x.k}`, 12), x.d, x.p, lg, tl, x.s, x.v, x.r, x.top ? 1 : 0, dia);
    }
    return { ok: true };
  }

  const m = demandaLimpia(b.m);
  let a = (Array.isArray(b.a) ? b.a.slice(0, CLA_POR_VEZ) : []).map((y) => aperturaLimpia(y, dia)).filter(Boolean);
  if (!m.length && !a.length) return { ok: false, e: 'nada' };
  if (!cabeEnvio(sql, dia, hs)) return { ok: false, tope: 'dia' };
  // (solo se escribe la fila si es nueva o han cambiado sus pujas: lo que manda otro de la misma liga un minuto después no gasta)
  for (const [pid, n] of m) {
    sql.exec('INSERT INTO dem (dia, pid, lg, tl, n, mx, t0, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(dia, pid, lg) DO UPDATE SET n = excluded.n, mx = MAX(dem.mx, excluded.n), t = excluded.t WHERE excluded.n <> dem.n', dia, pid, lg, tl, n, n, ahora, ahora);
  }
  // (las cláusulas, con tope por liga y día: una liga que mande basura, hasta ahí)
  a = a.slice(0, cabenClausulas(sql, dia, lg));
  for (const x of a) {
    sql.exec('INSERT INTO cla (h, dia, lg, tl, v, cs, r, pos, tit, ida, bl, hp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(h) DO NOTHING', await hm(K, `a|${x.k}`, 12), x.d, lg, tl, x.v, x.cs, x.r, x.pos, x.tit, x.ida ? 1 : 0, x.bl ? 1 : 0, x.hp);
  }
  // (se cuentan las que llegan, no las que eran nuevas: la app solo las manda una vez)
  apuntarClausulas(sql, dia, lg, a.length);
  return { ok: true };
}
