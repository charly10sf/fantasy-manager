/*
 * Los avisos de fallo, como una conversación (0.8.4, fase 3; Carlos, 25 nov: «no pongas audios, pero que sea una
 * conversación»). Cada aviso es un hilo: el primer mensaje de quien lo manda y, debajo, los que vayan escribiendo él y
 * Fantasy Manager, en orden, cada uno con sus capturas. Antes solo cabía una respuesta y la segunda pisaba la primera.
 *
 * Todo en un Durable Object con SQLite, «fallos|todos» (antes en el KV: f:<cuenta>:<id> y fc:<id>:<n>, y cada mensaje o
 * captura era una escritura de las 1.000 gratis al día):
 *   hilo (id, uid, t, ult, de, n, vu, vd, quien, equipo, liga, app, diag, kv, cer)
 *        cer: (26 nov) cuándo lo dio por terminado el dueño o quien ayuda; si quien lo mandó vuelve a escribir (ult > cer),
 *        vuelve a estar pendiente. Quien lo mandó no lo ve
 *        de: quién escribió el último ('u' quien lo mandó, 'd' Fantasy Manager); ult: cuándo; n: cuántos mensajes;
 *        vu / vd: hasta cuándo lo ha visto quien lo mandó / Fantasy Manager; kv: copiado del KV (sus capturas pueden
 *        estar aún allí)
 *   msg  (hilo, n, de, t, texto, caps, por, aut, autn)
 *        aut / autn: (0.8.4c) la cuenta y el nombre de quien contestó desde la app (el dueño o quien ayuda); vacíos en los
 *        de quien lo mandó, en los de la Action y en los de antes. Solo lo ven el dueño y quien ayuda, nunca quien lo mandó
 *   cap  (hilo, m, i, img)          una captura por fila (una fila no pasa de 2 MB; cada una, 350 KB como mucho)
 *   cupo (uid, dia, hilos, msgs, caps)
 *   meta (k, v)                     la limpieza del día, los bytes de capturas y la mudanza desde el KV
 * Pendiente (para el dueño) = el último mensaje es de quien lo mandó y no se ha dado por terminado después (PEND). Se borra a los 180 días del último mensaje.
 * Lo que ve una web de antes (que solo sabe de una respuesta): `respuesta` es el último mensaje de Fantasy Manager.
 */
export const VIVE_FALLO = 180 * 86400e3;
export const MAX_TEXTO = 4000, MAX_RESPUESTA = 2000, MAX_DIAG = 40000, AL_DIA = 5;
export const MAX_CAPTURAS = 3, MAX_CAPTURA = 350000;
// por hilo, por cuenta y día (además de AL_DIA avisos nuevos) y entre todos: el plan gratis da 5 GB para todo
export const HILO_MSGS = 60, HILO_CAPS = 15, MSGS_DIA = 30, CAPS_DIA = 15, CAPS_BYTES = 2e9;
const corta = (x, n) => String(x == null ? '' : x).slice(0, n);
const uidOk = (x) => /^\d{1,15}$/.test(String(x || ''));
export const idOk = (x) => /^[a-z0-9]{6,40}$/.test(String(x || ''));
export const esCaptura = (x) => typeof x === 'string' && x.length <= MAX_CAPTURA && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]/.test(x.slice(0, 40));
// (las de antes del 4 nov iban firmadas «Claude · Fantasy Manager»: en la app solo sale Fantasy Manager)
const firma = (x) => { const p = corta(x, 40).trim(); return !p || /claude/i.test(p) ? 'Fantasy Manager' : p; };

const TABLAS = [
  "CREATE TABLE IF NOT EXISTS hilo (id TEXT PRIMARY KEY, uid TEXT NOT NULL, t INTEGER NOT NULL, ult INTEGER NOT NULL, de TEXT NOT NULL, n INTEGER NOT NULL, vu INTEGER NOT NULL DEFAULT 0, vd INTEGER NOT NULL DEFAULT 0, quien TEXT NOT NULL DEFAULT '', equipo TEXT NOT NULL DEFAULT '', liga TEXT NOT NULL DEFAULT '', app TEXT NOT NULL DEFAULT '', diag TEXT NOT NULL DEFAULT '', kv INTEGER NOT NULL DEFAULT 0, cer INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID",
  'CREATE INDEX IF NOT EXISTS hilo_uid ON hilo (uid)',
  "CREATE TABLE IF NOT EXISTS msg (hilo TEXT NOT NULL, n INTEGER NOT NULL, de TEXT NOT NULL, t INTEGER NOT NULL, texto TEXT NOT NULL, caps INTEGER NOT NULL DEFAULT 0, por TEXT NOT NULL DEFAULT '', aut TEXT NOT NULL DEFAULT '', autn TEXT NOT NULL DEFAULT '', PRIMARY KEY (hilo, n)) WITHOUT ROWID",
  'CREATE TABLE IF NOT EXISTS cap (hilo TEXT NOT NULL, m INTEGER NOT NULL, i INTEGER NOT NULL, img TEXT NOT NULL, PRIMARY KEY (hilo, m, i)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS cupo (uid TEXT NOT NULL, dia TEXT NOT NULL, hilos INTEGER NOT NULL DEFAULT 0, msgs INTEGER NOT NULL DEFAULT 0, caps INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (uid, dia)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID',
];
// (0.8.4c) las columnas que se añaden a una tabla que ya existía: se mira cuáles tiene y se añaden las que faltan (si no se
// puede mirar, se intenta y, si ya estaban, el ALTER falla y no pasa nada)
const COLUMNAS = [['msg', 'aut', "ALTER TABLE msg ADD COLUMN aut TEXT NOT NULL DEFAULT ''"], ['msg', 'autn', "ALTER TABLE msg ADD COLUMN autn TEXT NOT NULL DEFAULT ''"],
  ['hilo', 'cer', 'ALTER TABLE hilo ADD COLUMN cer INTEGER NOT NULL DEFAULT 0']];
function ponerColumnas(sql) {
  const hay = {};
  for (const t of new Set(COLUMNAS.map((c) => c[0]))) {
    try { hay[t] = new Set([...sql.exec(`PRAGMA table_info(${t})`)].map((c) => c.name)); } catch (e) { hay[t] = null; }
  }
  for (const [t, col, q] of COLUMNAS) if (!hay[t] || !hay[t].has(col)) { try { sql.exec(q); } catch (e) { /* ya estaba */ } }
}
// los que esperan respuesta: el último es de quien lo mandó y no se ha dado por terminado después
const PEND = "de = 'u' AND cer < ult";
const terminado = (h) => h.de === 'u' && Number(h.cer) >= h.ult;
const fila = (cur) => { for (const x of cur) return x; return null; };
const escribir = (sql, q, ...a) => { const c = sql.exec(q, ...a); c.toArray(); return c.rowsWritten || 0; };
const leerMeta = (sql, k) => { const x = fila(sql.exec('SELECT v FROM meta WHERE k = ?', k)); return x ? x.v : null; };
const ponerMeta = (sql, k, v) => escribir(sql, 'INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
const bytes = (sql) => Number(leerMeta(sql, 'bytes')) || 0;

function borrarHilos(sql, donde, ...a) {
  let n = 0;
  for (const h of [...sql.exec(`SELECT id FROM hilo WHERE ${donde}`, ...a)]) {
    escribir(sql, 'DELETE FROM cap WHERE hilo = ?', h.id); escribir(sql, 'DELETE FROM msg WHERE hilo = ?', h.id);
    n += escribir(sql, 'DELETE FROM hilo WHERE id = ?', h.id) ? 1 : 0;
  }
  return n;
}
/** una vez al día: fuera lo de más de 180 días y los cupos viejos, y se vuelven a contar los bytes de las capturas */
function limpiar(sql, memo, dia, ahora) {
  if (memo.fallosLimpio === dia) return;
  if (leerMeta(sql, 'limpio') !== dia) {
    borrarHilos(sql, 'ult < ?', ahora - VIVE_FALLO);
    escribir(sql, 'DELETE FROM cupo WHERE dia < ?', dia);
    const b = fila(sql.exec('SELECT coalesce(sum(length(img)), 0) AS b FROM cap'));
    ponerMeta(sql, 'bytes', (b && b.b) || 0);
    ponerMeta(sql, 'limpio', dia);
  }
  memo.fallosLimpio = dia;
}
const cupoDe = (sql, uid, dia) => fila(sql.exec('SELECT hilos, msgs, caps FROM cupo WHERE uid = ? AND dia = ?', uid, dia)) || { hilos: 0, msgs: 0, caps: 0 };
const sumarCupo = (sql, uid, dia, h, m, c) => escribir(sql, 'INSERT INTO cupo (uid, dia, hilos, msgs, caps) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid, dia) DO UPDATE SET hilos = hilos + excluded.hilos, msgs = msgs + excluded.msgs, caps = caps + excluded.caps', uid, dia, h, m, c);
/** las capturas válidas que caben (por mensaje, por hilo, por cuenta y día, y entre todos) */
function capturasQueCaben(sql, caps, { yaHilo = 0, cupo = null, dueno = false }) {
  let l = (Array.isArray(caps) ? caps : []).filter(esCaptura).slice(0, MAX_CAPTURAS);
  l = l.slice(0, Math.max(0, HILO_CAPS - yaHilo));
  if (!dueno && cupo) l = l.slice(0, Math.max(0, CAPS_DIA - cupo.caps));
  let b = bytes(sql);
  const out = [];
  for (const c of l) { if (b + c.length > CAPS_BYTES) break; b += c.length; out.push(c); }
  return out;
}
function ponerCaps(sql, id, m, caps) {
  caps.forEach((img, i) => escribir(sql, 'INSERT OR REPLACE INTO cap (hilo, m, i, img) VALUES (?, ?, ?, ?)', id, m, i, img));
  if (caps.length) ponerMeta(sql, 'bytes', bytes(sql) + caps.reduce((t, c) => t + c.length, 0));
}

/* ---------- lo que se enseña ---------- */
/**
 * los mensajes de un hilo. Con `equipo` (lo ven el dueño o quien ayuda, o la Action) cada uno de Fantasy Manager lleva `aut`:
 * 'yo' si lo escribió quien mira (`yo`, su cuenta), el nombre de quien lo escribió si fue otro desde la app, o nada (los de la
 * Action y los de antes de la 0.8.4c). A quien lo mandó nunca le llega
 */
const mensajes = (sql, id, { equipo = false, yo = '' } = {}) => [...sql.exec('SELECT n, de, t, texto, caps, por, aut, autn FROM msg WHERE hilo = ? ORDER BY n', id)].map((m) => ({
  n: m.n, de: m.de, t: m.t, texto: m.texto, caps: m.caps,
  ...(m.de === 'd' ? { por: m.por || 'Fantasy Manager' } : {}),
  ...(equipo && m.de === 'd' && m.aut ? { aut: yo && m.aut === String(yo) ? 'yo' : m.autn || 'Fantasy Manager' } : {}),
}));
/**
 * un hilo como lo leen la app de ahora (msgs, de, ult, vu, vd) y las de antes (texto, capturas, respuesta, respondida,
 * vista y por: el primer mensaje y el último de Fantasy Manager). Sin uid; con diag solo si `diag`; quién contestó cada uno
 * (`aut`), solo con `equipo` (el dueño, quien ayuda y la Action)
 */
function hiloApp(sql, h, { diag = false, equipo = false, yo = '' } = {}) {
  const msgs = mensajes(sql, h.id, { equipo, yo });
  const m0 = msgs[0] || { texto: '', caps: 0 };
  const ultD = [...msgs].reverse().find((m) => m.de === 'd') || null;
  return {
    id: h.id, t: h.t, quien: h.quien, equipo: h.equipo, liga: h.liga, app: h.app,
    texto: m0.texto, capturas: m0.caps, respuesta: ultD ? ultD.texto : null, respondida: ultD ? ultD.t : null, vista: !ultD || h.vu >= ultD.t,
    ...(ultD ? { por: ultD.por } : {}),
    msgs, de: h.de, ult: h.ult, n: h.n, vu: h.vu, vd: h.vd,
    ...(equipo && terminado(h) ? { cer: h.cer } : {}),
    ...(diag ? { diag: h.diag } : {}),
  };
}
/** el resumen de la bandeja del dueño: lo de antes (t, quien, equipo, txt, r, v, c) y lo de ahora (n, de, ult, vd, ultTxt) */
function resumen(sql, h) {
  const m0 = fila(sql.exec('SELECT texto, caps FROM msg WHERE hilo = ? AND n = 0', h.id)) || { texto: '', caps: 0 };
  const ult = fila(sql.exec('SELECT texto FROM msg WHERE hilo = ? ORDER BY n DESC LIMIT 1', h.id)) || { texto: '' };
  return {
    id: h.id, t: h.t, quien: h.quien, equipo: h.equipo, txt: corta(m0.texto.replace(/\s+/g, ' '), 90),
    // (uno dado por terminado cuenta como contestado también para las webs de antes del dueño: r)
    r: h.de === 'd' ? h.ult : terminado(h) ? h.cer : 0, v: h.de === 'd' && h.vu >= h.ult ? 1 : 0, c: m0.caps,
    n: h.n, de: h.de, ult: h.ult, vd: h.vd, ultTxt: corta(ult.texto.replace(/\s+/g, ' '), 90),
    ...(terminado(h) ? { cer: h.cer } : {}),
  };
}

/* ---------- escribir ---------- */
function nuevo(sql, b, ahora, dia) {
  const uid = String(b.uid);
  const texto = corta(b.texto, MAX_TEXTO).trim();
  if (!texto) return { ok: false, estado: 400, e: 'Cuenta qué ha pasado' };
  const cu = cupoDe(sql, uid, dia);
  if (cu.hilos >= AL_DIA) return { ok: false, estado: 429, e: `Como mucho ${AL_DIA} avisos al día` };
  if (!idOk(b.id) || fila(sql.exec('SELECT 1 AS x FROM hilo WHERE id = ?', b.id))) return { ok: false, estado: 400, e: 'Id no válido' };
  const caps = capturasQueCaben(sql, b.capturas, { cupo: cu });
  escribir(sql, 'INSERT INTO hilo (id, uid, t, ult, de, n, vu, vd, quien, equipo, liga, app, diag) VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?, ?, ?, ?)',
    b.id, uid, ahora, ahora, 'u', ahora, corta(b.quien, 40), corta(b.equipo, 60), corta(b.liga, 60), corta(b.app, 120), corta(b.diag, MAX_DIAG));
  escribir(sql, 'INSERT INTO msg (hilo, n, de, t, texto, caps, por) VALUES (?, 0, ?, ?, ?, ?, ?)', b.id, 'u', ahora, texto, caps.length, '');
  ponerCaps(sql, b.id, 0, caps);
  sumarCupo(sql, uid, dia, 1, 1, caps.length);
  return { ok: true, id: b.id, capturas: caps.length };
}
/** un mensaje más en el hilo: de quien lo mandó (b.uid, solo en el suyo) o de Fantasy Manager (b.dueno; desde la app, con
    b.aut y b.autn: la cuenta y el nombre de quien contesta, el dueño o quien ayuda) */
function escribirMsg(sql, b, ahora, dia) {
  const h = fila(sql.exec('SELECT * FROM hilo WHERE id = ?', String(b.id || '')));
  if (!h || (!b.dueno && h.uid !== String(b.uid))) return { ok: false, estado: 404, e: 'No existe' };
  const texto = corta(b.texto, b.dueno ? MAX_RESPUESTA : MAX_TEXTO).trim();
  const hayCaps = Array.isArray(b.capturas) && b.capturas.length;
  if (!texto && !hayCaps) return { ok: false, estado: 400, e: b.dueno ? 'Escribe la respuesta' : 'Escribe algo' };
  if (h.n >= HILO_MSGS) return { ok: false, estado: 429, e: 'Esta conversación ya es muy larga: manda un aviso nuevo' };
  const cu = b.dueno ? null : cupoDe(sql, h.uid, dia);
  if (cu && cu.msgs >= MSGS_DIA) return { ok: false, estado: 429, e: `Como mucho ${MSGS_DIA} mensajes al día` };
  const yaHilo = (fila(sql.exec('SELECT coalesce(sum(caps), 0) AS c FROM msg WHERE hilo = ?', h.id)) || { c: 0 }).c;
  const caps = capturasQueCaben(sql, b.capturas, { yaHilo, cupo: cu, dueno: !!b.dueno });
  if (!texto && !caps.length) return { ok: false, estado: 429, e: 'Esa captura ya no cabe' };
  const de = b.dueno ? 'd' : 'u', n = h.n;
  const aut = b.dueno && uidOk(b.aut) ? String(b.aut) : '';
  escribir(sql, 'INSERT INTO msg (hilo, n, de, t, texto, caps, por, aut, autn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', h.id, n, de, ahora, texto, caps.length, b.dueno ? firma(b.por) : '', aut, aut ? corta(b.autn, 40).trim() : '');
  ponerCaps(sql, h.id, n, caps);
  // (quien escribe ha visto todo lo de antes)
  escribir(sql, `UPDATE hilo SET ult = ?, de = ?, n = n + 1, ${b.dueno ? 'vd' : 'vu'} = ? WHERE id = ?`, ahora, de, ahora, h.id);
  if (cu) sumarCupo(sql, h.uid, dia, 0, 1, caps.length);
  return { ok: true, n, capturas: caps.length };
}

/* ---------- la mudanza desde el KV ---------- */
/** un aviso del KV (el JSON de f:<cuenta>:<id>) como hilo: su texto y, si tenía, la respuesta como segundo mensaje */
function copiarAviso(sql, f, ahora) {
  if (!f || !idOk(f.id) || !uidOk(f.uid)) return 0;
  const resp = String(f.respuesta || '').trim(), tr = Number(f.respondida) || 0, t = Number(f.t) || ahora;
  const con = !!(resp && tr);
  const n = escribir(sql, 'INSERT OR IGNORE INTO hilo (id, uid, t, ult, de, n, vu, vd, quien, equipo, liga, app, diag, kv) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    f.id, String(f.uid), t, con ? tr : t, con ? 'd' : 'u', con ? 2 : 1, con && f.vista ? tr : t, con ? tr : 0,
    corta(f.quien, 40), corta(f.equipo, 60), corta(f.liga, 60), corta(f.app, 120), corta(f.diag, MAX_DIAG));
  if (!n) return 0;
  escribir(sql, 'INSERT OR IGNORE INTO msg (hilo, n, de, t, texto, caps, por) VALUES (?, 0, ?, ?, ?, ?, ?)', f.id, 'u', t, corta(f.texto, MAX_TEXTO), Math.min(MAX_CAPTURAS, Number(f.capturas) || 0), '');
  if (con) escribir(sql, 'INSERT OR IGNORE INTO msg (hilo, n, de, t, texto, caps, por) VALUES (?, 1, ?, ?, ?, 0, ?)', f.id, 'd', tr, corta(resp, MAX_RESPUESTA), firma(f.por));
  return 1;
}
/** las capturas de los hilos copiados del KV que aún no están aquí: [[id, i]] */
function capsQueFaltan(sql, max) {
  const out = [];
  for (const h of sql.exec('SELECT m.hilo AS id, m.caps AS c FROM msg m JOIN hilo h ON h.id = m.hilo WHERE h.kv = 1 AND m.n = 0 AND m.caps > 0')) {
    for (let i = 0; i < h.c && out.length < max; i++) if (!fila(sql.exec('SELECT 1 AS x FROM cap WHERE hilo = ? AND m = 0 AND i = ?', h.id, i))) out.push([h.id, i]);
    if (out.length >= max) break;
  }
  return out;
}

/* ---------- lo que hace el objeto ---------- */
/**
 * b: { op, ahora, dia, ... }
 *   nuevo     { uid, id, texto, diag, quien, equipo, liga, app, capturas }      el primer mensaje → { ok, id }
 *   escribir  { uid, id, texto, capturas } o { dueno: true, id, texto, capturas, por, aut, autn }   uno más → { ok, n }
 *   mios      { uid }                     sus hilos (30), del último movimiento al más viejo → { lista }
 *   todos     {}                          el resumen de los 200 últimos → { lista, pendientes }
 *   uno       { id, uid, ver: 'dueño' | 'ayuda', marcar }   un hilo entero (diag, solo el dueño; con marcar, el dueño o quien
 *                                     ayuda lo da por visto; con ver, uid es quien mira: sus respuestas salen con aut 'yo')
 *   visto     { uid, id }                 quien lo mandó lo ha visto
 *   captura   { id, m, i, uid | todos }   { img } (o { falta, kv } si es de un aviso copiado que aún está en el KV)
 *   pendientes {}                         { n }: cuántos esperan respuesta
 *   terminar  { id }                      (el dueño o quien ayuda) lo da por terminado: deja de esperar respuesta hasta que
 *                                     quien lo mandó vuelva a escribir → { ok, cer }
 *   borrar    { uid }                     todo lo de esa cuenta → { ok, n }
 *   accion    { max }                     para la Action «Fallos»: los hilos enteros, con diag, sin uid
 *   contestar { respuestas: [{ id | buscar, respuesta, por }] }   (la Action) añade un mensaje de Fantasy Manager → { n }
 *   mudanza / faltan { ids } / copiar { avisos: [json] } / faltanCaps { max } / copiarCaps { caps: [[id, i, img]] } /
 *   copiado / kvLimpio                    la mudanza desde el KV (mudanzaFallos en index.js)
 */
export function fallosObjeto(st, b, memo = {}) {
  const sql = st && st.sql;
  if (!sql) return { ok: false, estado: 503, e: 'Sin SQL' };
  if (!memo.fallosTablas) {
    for (const t of TABLAS) sql.exec(t);
    ponerColumnas(sql);
    memo.fallosTablas = true;
  }
  const ahora = Number(b.ahora) || Date.now();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dia || '')) ? b.dia : new Date(ahora).toISOString().slice(0, 10);
  limpiar(sql, memo, dia, ahora);
  const uid = String(b.uid || '');
  const hiloDe = (id) => fila(sql.exec('SELECT * FROM hilo WHERE id = ?', String(id || '')));
  switch (b.op) {
    case 'nuevo': return uidOk(uid) ? nuevo(sql, b, ahora, dia) : { ok: false, estado: 400, e: 'Cuenta no válida' };
    case 'escribir': return b.dueno || uidOk(uid) ? escribirMsg(sql, b, ahora, dia) : { ok: false, estado: 400, e: 'Cuenta no válida' };
    case 'mios': {
      if (!uidOk(uid)) return { lista: [] };
      // (pend: el dueño, cuántos esperan respuesta, en la misma llamada)
      const lista = [...sql.exec('SELECT * FROM hilo WHERE uid = ? ORDER BY ult DESC LIMIT 30', uid)].map((h) => hiloApp(sql, h));
      return { lista, ...(b.pend ? { pendientes: (fila(sql.exec(`SELECT count(*) AS n FROM hilo WHERE ${PEND}`)) || { n: 0 }).n } : {}) };
    }
    case 'todos': return { lista: [...sql.exec('SELECT * FROM hilo ORDER BY ult DESC LIMIT 200')].map((h) => resumen(sql, h)), pendientes: (fila(sql.exec(`SELECT count(*) AS n FROM hilo WHERE ${PEND}`)) || { n: 0 }).n };
    case 'pendientes': return { n: (fila(sql.exec(`SELECT count(*) AS n FROM hilo WHERE ${PEND}`)) || { n: 0 }).n };
    case 'uno': {
      const h = hiloDe(b.id);
      if (!h || (!b.ver && h.uid !== uid)) return { ok: false, estado: 404, e: 'No existe' };
      // (lo da por visto solo al abrirlo de verdad, `marcar`: la app pide antes los pendientes para que se abran al momento)
      // (0.8.4c: también quien ayuda, que ahora contesta)
      if (b.ver && b.marcar && h.vd < h.ult) { escribir(sql, 'UPDATE hilo SET vd = ? WHERE id = ?', ahora, h.id); h.vd = ahora; }
      return { ok: true, ...hiloApp(sql, h, { diag: b.ver === 'dueño', equipo: !!b.ver, yo: b.ver ? uid : '' }) };
    }
    case 'terminar': {
      // (26 nov, Carlos: «un botón para dar un chat por finalizado para que no me salga que tengo algo por leer»)
      const h = hiloDe(b.id);
      if (!h) return { ok: false, estado: 404, e: 'No existe' };
      if (h.de !== 'u') return { ok: true, cer: 0 };
      const cer = Math.max(ahora, h.ult);
      escribir(sql, 'UPDATE hilo SET cer = ?, vd = max(vd, ?) WHERE id = ?', cer, h.ult, h.id);
      return { ok: true, cer };
    }
    case 'visto': {
      const h = hiloDe(b.id);
      if (!h || h.uid !== uid) return { ok: false, estado: 404, e: 'No existe' };
      if (h.vu < h.ult) escribir(sql, 'UPDATE hilo SET vu = ? WHERE id = ?', ahora, h.id);
      return { ok: true };
    }
    case 'captura': {
      const h = hiloDe(b.id), m = Number(b.m) || 0, i = Number(b.i);
      if (!h || (!b.todos && h.uid !== uid) || !Number.isInteger(i) || i < 0) return { ok: false, estado: 404, e: 'No existe' };
      const x = fila(sql.exec('SELECT img FROM cap WHERE hilo = ? AND m = ? AND i = ?', h.id, m, i));
      if (x) return { ok: true, img: x.img };
      const msg = fila(sql.exec('SELECT caps FROM msg WHERE hilo = ? AND n = ?', h.id, m));
      if (h.kv && m === 0 && msg && i < msg.caps) return { ok: false, falta: true, kv: true };
      return { ok: false, estado: 404, e: 'Esa captura ya no está' };
    }
    case 'borrar': return uidOk(uid) ? { ok: true, n: borrarHilos(sql, 'uid = ?', uid) } : { ok: false, estado: 400, e: 'Cuenta no válida' };
    case 'accion': {
      const max = Math.max(1, Math.min(300, Number(b.max) || 150));
      return { lista: [...sql.exec('SELECT * FROM hilo ORDER BY ult DESC LIMIT ?', max)].map((h) => hiloApp(sql, h, { diag: true, equipo: true })) };
    }
    case 'contestar': {
      // cada respuesta va a un hilo por su id o, si no se tiene, a los que esperan respuesta y llevan ese trozo en lo que
      // escribió quien lo mandó (sin tildes ni mayúsculas)
      const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
      let n = 0;
      for (const r of Array.isArray(b.respuestas) ? b.respuestas.slice(0, 50) : []) {
        if (!r || !String(r.respuesta || '').trim()) continue;
        let ids = [];
        if (r.id) ids = hiloDe(r.id) ? [String(r.id)] : [];
        else if (r.buscar) {
          const q = norm(r.buscar);
          ids = [...sql.exec(`SELECT id FROM hilo WHERE ${PEND}`)].map((h) => h.id).filter((id) => [...sql.exec("SELECT texto FROM msg WHERE hilo = ? AND de = 'u'", id)].some((m) => norm(m.texto).includes(q)));
        }
        for (const id of ids) if (escribirMsg(sql, { dueno: true, id, texto: r.respuesta, por: r.por }, ahora, dia).ok) n++;
      }
      return { ok: true, n };
    }
    case 'mudanza': return { copiado: Number(leerMeta(sql, 'copiado')) || 0, fase: leerMeta(sql, 'fase') || 'hilos', limpio: Number(leerMeta(sql, 'kvLimpio')) || 0 };
    case 'faltan': {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(idOk);
      return { faltan: ids.filter((id) => !fila(sql.exec('SELECT 1 AS x FROM hilo WHERE id = ?', id))) };
    }
    case 'copiar': {
      let n = 0;
      for (const x of Array.isArray(b.avisos) ? b.avisos : []) { try { n += copiarAviso(sql, typeof x === 'string' ? JSON.parse(x) : x, ahora); } catch (e) { /* ese no */ } }
      if (b.siguiente) ponerMeta(sql, 'fase', b.siguiente);
      return { ok: true, n };
    }
    case 'faltanCaps': return { caps: capsQueFaltan(sql, Math.max(1, Math.min(20, Number(b.max) || 6))) };
    case 'copiarCaps': {
      let n = 0;
      for (const c of Array.isArray(b.caps) ? b.caps : []) {
        if (!Array.isArray(c) || !idOk(c[0])) continue;
        // (la que ya no está en el KV: el aviso se queda con las que había antes de ella, para no pedirla siempre)
        if (!esCaptura(c[2])) { escribir(sql, 'UPDATE msg SET caps = min(caps, ?) WHERE hilo = ? AND n = 0', Number(c[1]) || 0, c[0]); continue; }
        n += escribir(sql, 'INSERT OR IGNORE INTO cap (hilo, m, i, img) VALUES (?, 0, ?, ?)', c[0], Number(c[1]) || 0, c[2]) ? 1 : 0;
      }
      return { ok: true, n };
    }
    case 'copiado': ponerMeta(sql, 'copiado', ahora); return { ok: true };
    case 'kvLimpio': ponerMeta(sql, 'kvLimpio', ahora); return { ok: true };
    default: return { ok: false, estado: 404, e: 'No existe' };
  }
}
