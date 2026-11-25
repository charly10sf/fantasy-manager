/*
 * Quién usa la app, en un Durable Object con SQLite (0.8.4, fase 1; Carlos, 25 nov: «vamos con la B»).
 *
 * Hasta la 0.8.3 iba en el KV VINCULOS en tres familias de claves, y era lo que llenaba sus topes gratis (1.000 escrituras,
 * 1.000 listados y 100.000 lecturas al día; claude/capacidad-cloudflare-24nov.md del proyecto):
 *   u:<cuenta>:<día>  el tiempo de uso (9 días)
 *   p:<cuenta>        la ficha de /hola: nombre, equipo, liga, versión, canal, foto, primera y última vez (90 días)
 *   r:<cuenta>        el registro: días, canales y eventos por semanas (400 días)
 * Ahora va todo en un solo objeto, «quien|todos», con una tabla para cada una (las filas de los objetos tienen 100.000
 * escrituras y 5 millones de lecturas al día gratis). Se guarda exactamente lo mismo, con los mismos plazos y las mismas
 * reglas de cuándo se escribe la ficha y el registro (una por hora, los cambios del día, dos al día como mucho): solo
 * cambia dónde. El tiempo de uso sí se apunta en cada llamada (antes, cada 4 min y lo de en medio en la memoria del
 * Worker, que se perdía si la siguiente caía en otro): ahora es exacto.
 *
 *   ficha (uid, ultima, foto, d)     d: lo que era la metadata de p:<uid>, en JSON
 *   reg   (uid, ultima, d)           d: lo que era la metadata de r:<uid>
 *   uso   (uid, dia, seg, t)         t: la última vez que se sumó
 *   meta  (k, v)                     la mudanza desde el KV y el último día que se limpió lo caducado
 *
 * Lo que caduca (los mismos plazos que en el KV, contados desde la última escritura) se borra una vez al día y, por si
 * acaso, las lecturas no lo ven.
 *
 * La mudanza desde el KV: el cron del Worker (cada 5 min, `mudanzaQuien` en index.js) lo copia en tres tandas (fichas,
 * registros, tiempos) con INSERT OR IGNORE; mientras no ha acabado, una cuenta que llega y no está aquí se trae antes del
 * KV (`traerDeKV`), para que lo nuevo se sume a lo de antes y no se pierda la primera vez ni el historial de nadie. Dos
 * días después de copiado, el cron borra del KV las fichas y los registros, de poco en poco (u: se borra solo a los 9
 * días).
 */
export const VIVE_HOLA = 90 * 86400, VIVE_REGISTRO = 400 * 86400, VIVE_USO = 9 * 86400;
// cambios de versión, equipo o foto que se apuntan al momento, por cuenta y día (el resto espera a la escritura de cada hora)
export const CAMBIOS_DIA = 3;
// lo que se suma de una vez al tiempo de uso, en segundos (los que no tienen límite mandan lo de 5 minutos, o lo que quedó)
export const MAX_USO = 600;
// (iOS 3, 25 nov) «ios»: la app de iOS
const CANALES = new Set(['github', 'play', 'ios', 'web']);
// (25 nov, Carlos: «web incluye a los de iOS… si hubiera forma de diferenciarlos de la web de un ordenador») en la web, en qué
// aparato va: lo mismo que cuenta el embudo (canalPaso de web/js/semaforo.js, por el navegador). Desde la 0.8.4
export const DISPOSITIVOS = new Set(['web-iphone', 'web-android', 'web-pc']);
const uidOk = (x) => /^\d{1,15}$/.test(String(x || ''));
const diaOk = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
const corta = (x, n) => String(x == null ? '' : x).slice(0, n);

/** los n días hasta hoy (hoy el primero), en AAAA-MM-DD, contados desde el día de Madrid (sin líos con el cambio de hora) */
export function diasAtras(hoy, n) {
  const t = new Date(`${hoy}T12:00:00Z`), out = [];
  for (let i = 0; i < n; i++) { out.push(t.toISOString().slice(0, 10)); t.setUTCDate(t.getUTCDate() - 1); }
  return out;
}

/* lo que hace cada cuenta (web/js/eventos.js): cuántas veces por día; aquí se suma por semanas (la clave es el lunes)
   y en total. Solo números: ni qué jugador ni qué liga. */
const EVENTOS = new Set(['p', 'q', 'b', 't', 'l', 'e', 'v', 'c', 'n', 'i', 'a', 'A', 'f', 'F']);
export function limpiarEventos(ev) {
  const out = {};
  if (!ev || typeof ev !== 'object') return out;
  for (const [d, cs] of Object.entries(ev).slice(0, 15)) {
    if (!diaOk(d) || !cs || typeof cs !== 'object') continue;
    for (const [k, n] of Object.entries(cs)) {
      const v = Math.round(Number(n));
      if (EVENTOS.has(k) && v > 0 && v <= 500) (out[d] || (out[d] = {}))[k] = v;
    }
  }
  return out;
}
const lunesDe = (d) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
function sumarEventos(r, ev) {
  const sem = { ...((r && r.ev) || {}) }, tot = { ...((r && r.tot) || {}) };
  for (const [d, cs] of Object.entries(ev)) {
    const l = lunesDe(d), x = { ...(sem[l] || {}) };
    for (const [k, n] of Object.entries(cs)) { x[k] = (x[k] || 0) + n; tot[k] = (tot[k] || 0) + n; }
    sem[l] = x;
  }
  // las 6 semanas últimas (eran los metadatos del KV, que no pasan de 1 KB: se queda igual, se guarda lo mismo)
  const quedan = Object.keys(sem).sort().slice(-6);
  return { ev: Object.fromEntries(quedan.map((l) => [l, sem[l]])), tot };
}

/* ---------- las tablas ---------- */
const TABLAS = [
  "CREATE TABLE IF NOT EXISTS ficha (uid TEXT PRIMARY KEY, ultima INTEGER NOT NULL, foto TEXT NOT NULL DEFAULT '', d TEXT NOT NULL) WITHOUT ROWID",
  'CREATE TABLE IF NOT EXISTS reg (uid TEXT PRIMARY KEY, ultima INTEGER NOT NULL, d TEXT NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS uso (uid TEXT NOT NULL, dia TEXT NOT NULL, seg INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (uid, dia)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID',
];
const fila = (cur) => { for (const x of cur) return x; return null; };
const filas = (cur) => [...cur];
function preparar(sql, memo) {
  if (memo.quienTablas) return;
  for (const t of TABLAS) sql.exec(t);
  memo.quienTablas = true;
}
const leerMeta = (sql, k) => { const x = fila(sql.exec('SELECT v FROM meta WHERE k = ?', k)); return x ? x.v : null; };
const ponerMeta = (sql, k, v) => sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
const cortes = (ahora) => ({ ficha: ahora - VIVE_HOLA * 1000, reg: ahora - VIVE_REGISTRO * 1000, uso: ahora - VIVE_USO * 1000 });

/** lo caducado, fuera: una vez al día (lo mira la memoria del objeto y, si se ha reiniciado, la tabla meta) */
function limpiarCaducado(sql, memo, dia, ahora) {
  if (memo.quienLimpio === dia) return;
  if (leerMeta(sql, 'limpio') !== dia) {
    const k = cortes(ahora);
    sql.exec('DELETE FROM ficha WHERE ultima < ?', k.ficha);
    sql.exec('DELETE FROM reg WHERE ultima < ?', k.reg);
    sql.exec('DELETE FROM uso WHERE t < ?', k.uso);
    ponerMeta(sql, 'limpio', dia);
  }
  memo.quienLimpio = dia;
}

/* ---------- la mudanza desde el KV ---------- */
function copiado(sql, memo) {
  if (memo.quienCopiado) return true;
  const v = leerMeta(sql, 'copiado');
  if (v) memo.quienCopiado = true;
  return !!v;
}
/** una escritura: devuelve cuántas filas ha tocado (el cursor se recorre entero antes de mirarlo) */
const escribir = (sql, q, ...a) => { const c = sql.exec(q, ...a); c.toArray(); return c.rowsWritten || 0; };
// pisar: true sustituye la que haya (la escritura normal); false solo la pone si no hay ninguna (la copia desde el KV)
const ponerFicha = (sql, uid, m, ahora, pisar = false) => escribir(sql, `INSERT INTO ficha (uid, ultima, foto, d) VALUES (?, ?, ?, ?) ON CONFLICT(uid) DO ${pisar ? 'UPDATE SET ultima = excluded.ultima, foto = excluded.foto, d = excluded.d' : 'NOTHING'}`, String(uid), Number(m.ultima) || ahora, corta(m.foto, 400), JSON.stringify({ ...m, uid: String(uid) }));
const ponerReg = (sql, uid, m, ahora, pisar = false) => escribir(sql, `INSERT INTO reg (uid, ultima, d) VALUES (?, ?, ?) ON CONFLICT(uid) DO ${pisar ? 'UPDATE SET ultima = excluded.ultima, d = excluded.d' : 'NOTHING'}`, String(uid), Number(m.ultima) || ahora, JSON.stringify({ ...m, uid: String(uid) }));
/** (mientras no ha acabado la copia) lo de una cuenta que aún está en el KV, antes de escribir encima */
async function traerDeKV(sql, env, memo, uid, { ficha = false, reg = false, dia = null, ahora }) {
  if (!env || !env.VINCULOS || copiado(sql, memo)) return;
  const kv = env.VINCULOS;
  const [p, r, u] = await Promise.all([
    ficha ? kv.getWithMetadata(`p:${uid}`).catch(() => null) : null,
    reg ? kv.getWithMetadata(`r:${uid}`).catch(() => null) : null,
    dia ? kv.getWithMetadata(`u:${uid}:${dia}`).catch(() => null) : null,
  ]);
  // (después del await: otra petición puede haberlo traído ya; con IGNORE no se pisa nada)
  if (p && p.metadata && typeof p.metadata === 'object') ponerFicha(sql, uid, p.metadata, ahora);
  if (r && r.metadata && typeof r.metadata === 'object') ponerReg(sql, uid, r.metadata, ahora);
  const s = u ? Math.min(86400, Math.max(0, Math.round(Number(u.value) || 0))) : 0;
  if (s) sql.exec('INSERT OR IGNORE INTO uso (uid, dia, seg, t) VALUES (?, ?, ?, ?)', String(uid), dia, s, Number(u.metadata && u.metadata.t) || ahora);
}
/** una tanda de la copia: fase p (fichas: [[uid, metadata]]), r (registros) o u (tiempos: [[uid, dia, seg, t]]) */
function copiar(sql, b, ahora) {
  let n = 0;
  const l = Array.isArray(b.filas) ? b.filas : [];
  for (const x of l) {
    if (!Array.isArray(x) || !uidOk(x[0])) continue;
    if (b.fase === 'p' && x[1] && typeof x[1] === 'object') n += ponerFicha(sql, x[0], x[1], ahora) ? 1 : 0;
    else if (b.fase === 'r' && x[1] && typeof x[1] === 'object') n += ponerReg(sql, x[0], x[1], ahora) ? 1 : 0;
    else if (b.fase === 'u' && diaOk(x[1])) {
      const s = Math.min(86400, Math.max(0, Math.round(Number(x[2]) || 0)));
      if (s) n += escribir(sql, 'INSERT OR IGNORE INTO uso (uid, dia, seg, t) VALUES (?, ?, ?, ?)', String(x[0]), x[1], s, Number(x[3]) || ahora) ? 1 : 0;
    }
  }
  if (b.siguiente === 'hecho') ponerMeta(sql, 'copiado', ahora);
  else if (['p', 'r', 'u'].includes(b.siguiente)) ponerMeta(sql, 'fase', b.siguiente);
  return { ok: true, n };
}

/* ---------- /hola: la ficha y el registro, en la misma llamada ---------- */
/**
 * el registro de cada cuenta que ha entrado alguna vez, para contar usuarios: no lleva nombre ni equipo, solo { uid,
 * primera, ultima, dia, canales, dias, ev, tot }. Se escribe como mucho una vez al día por cuenta (o si entra desde un
 * sitio nuevo, o con eventos a las 12 h). Devuelve true si ha sumado los eventos que traía (si no, la app los vuelve a
 * mandar en el siguiente saludo)
 */
function registrar(sql, uid, canal, primera, ahora, dia, evIn) {
  const x = fila(sql.exec('SELECT d FROM reg WHERE uid = ? AND ultima >= ?', uid, cortes(ahora).reg));
  const r = x ? JSON.parse(x.d) : null;
  const cs = new Set(String((r && r.canales) || '').split(',').filter(Boolean));
  const nuevoCanal = CANALES.has(canal) && !cs.has(canal);
  const ev = limpiarEventos(evIn);
  const hayEv = Object.keys(ev).length > 0;
  // una vez al día, o con eventos si hace 12 horas o más de la última (como mucho dos escrituras al día por cuenta)
  if (r && r.dia === dia && !nuevoCanal && !(hayEv && ahora - (r.ultima || 0) >= 12 * 3600e3)) return false;
  if (CANALES.has(canal)) cs.add(canal);
  const ficha = { uid, primera: Math.min((r && r.primera) || primera, primera), ultima: ahora, dia, canales: [...cs].join(','), dias: ((r && r.dias) || 0) + (r && r.dia === dia ? 0 : 1) };
  const s = sumarEventos(r, ev);
  if (Object.keys(s.tot).length) { ficha.ev = s.ev; ficha.tot = s.tot; }
  while (JSON.stringify(ficha).length > 1000 && ficha.ev && Object.keys(ficha.ev).length > 1) delete ficha.ev[Object.keys(ficha.ev).sort()[0]];
  ponerReg(sql, uid, ficha, ahora, true);
  return hayEv;
}
/** b: { uid, nombre, foto, x: lo que manda la app (equipo, liga, v, canal, app, ad, fc, bv), ev, ahora, dia } */
function hola(sql, b, ahora, dia) {
  const uid = String(b.uid), x = (b.x && typeof b.x === 'object') ? b.x : {};
  const fx = fila(sql.exec('SELECT d FROM ficha WHERE uid = ? AND ultima >= ?', uid, cortes(ahora).ficha));
  const m = fx ? JSON.parse(fx.d) : null;
  const nuevo = {
    uid, nombre: corta(b.nombre, 40), equipo: corta(x.equipo, 40), liga: corta(x.liga, 20) || (m && m.liga) || '', v: corta(x.v, 12),
    canal: corta(x.canal, 8), app: Math.max(0, Math.round(Number(x.app) || 0)),
    primera: (m && m.primera) || ahora, ultima: ahora, n: ((m && m.n) || 0) + 1,
    foto: corta(b.foto, 400),
    // por qué no se le pone la web nueva (el último fallo de AlDia en su móvil, desde la 0.7.6)
    ...(x.ad ? { ad: corta(x.ad, 90) } : {}),
    // por qué no le carga la liga (16 nov): el tipo de error y el principio del mensaje, solo con la versión acabada en « !»
    ...(x.fc && / !$/.test(String(x.v || '')) ? { fc: corta(x.fc, 60) } : {}),
    // la pantalla de bienvenida ya vista (Carlos, 9 nov 10:20: una vez por cuenta, también en otro dispositivo): cuándo
    ...(((m && m.bv) || x.bv) ? { bv: (m && m.bv) || ahora } : {}),
    // (0.8.4) en la web, en qué aparato: iPhone, Android u ordenador
    ...(String(x.canal) === 'web' && DISPOSITIVOS.has(String(x.disp)) ? { disp: String(x.disp) } : {}),
  };
  // (como en el KV: cada cuenta, como mucho una escritura por hora, salvo que cambie la versión, el equipo, la foto, lo de
  // AlDia, el aparato o desde dónde (iOS 3: la app de iOS), y esos cambios como mucho CAMBIOS_DIA al día; la bienvenida vista y la liga que llega tarde, siempre)
  const cambia = !!m && (m.v !== nuevo.v || m.equipo !== nuevo.equipo || (m.foto || '') !== nuevo.foto || (m.ad || '') !== (nuevo.ad || '') || (m.fc || '') !== (nuevo.fc || '') || (m.disp || '') !== (nuevo.disp || '') || (m.canal || '') !== nuevo.canal);
  const bvNueva = !!nuevo.bv && !(m && m.bv);
  const ligaNueva = !!nuevo.liga && !!m && !m.liga;
  const cambiosHoy = m && m.dc === dia ? Number(m.nc) || 0 : 0;
  const cabeCambio = cambia && cambiosHoy < CAMBIOS_DIA;
  if (cambiosHoy || cabeCambio) { nuevo.dc = dia; nuevo.nc = cambiosHoy + (cabeCambio ? 1 : 0); }
  if (!m || cabeCambio || bvNueva || ligaNueva || ahora - (m.ultima || 0) > 60 * 60e3) ponerFicha(sql, uid, nuevo, ahora, true);
  let ev = false;
  try { ev = registrar(sql, uid, nuevo.canal, (m && m.primera) || ahora, ahora, dia, b.ev); } catch (e) { ev = false; }
  return { ok: true, ev, ...(nuevo.bv ? { bv: nuevo.bv } : {}) };
}

/* ---------- /hola/todos: la pantalla «Quién usa la app» ---------- */
/**
 * Devuelve el JSON ya escrito (texto: el Worker solo le pega el embudo y las invitaciones, sin volver a leerlo):
 * { lista: [ficha + segHoy + segDias], registro: [...], ahora, dias }. La lista, de la última vez más reciente a la más
 * vieja; el tiempo de cada uno, de los 7 días hasta hoy. El registro: todas las cuentas que han entrado alguna vez (la de
 * reg y, quien no la tenga, con lo de su ficha), con la última vez de la ficha si es más nueva.
 * Las fichas no se leen como objetos: el JSON guardado se pega tal cual (con 1.000 cuentas, menos CPU).
 */
function todos(sql, ahora, dia) {
  const k = cortes(ahora), dias = diasAtras(dia, 7);
  // (todo en SQLite, que es C: el tiempo de cada uno por días y la ficha con él pegado salen ya como texto JSON. Con 1.000
  // cuentas activas toda la semana, de 8,7 ms de CPU a lo que mide worker/prueba/mide-quien.mjs)
  const lista = [];
  for (const f of sql.exec(
    `WITH u AS (SELECT uid, json_group_object(dia, min(seg, 86400)) AS o, max(CASE WHEN dia = ? THEN min(seg, 86400) ELSE 0 END) AS hoy
                  FROM uso WHERE dia >= ? AND dia <= ? AND t >= ? GROUP BY uid)
     SELECT substr(f.d, 1, length(f.d) - 1) || ',"segHoy":' || coalesce(u.hoy, 0) || ',"segDias":' || coalesce(u.o, '{}') || '}' AS x
       FROM ficha f LEFT JOIN u ON u.uid = f.uid WHERE f.ultima >= ? ORDER BY f.ultima DESC`, dia, dias[6], dia, k.uso, k.ficha)) lista.push(f.x);
  const registro = [];
  for (const r of sql.exec(
    // (la última vez dentro de d es la de la columna, escrita a la vez: se cambia el número como texto, sin leer el JSON)
    `SELECT CASE WHEN f.ultima > r.ultima THEN replace(r.d, '"ultima":' || r.ultima || ',', '"ultima":' || f.ultima || ',') ELSE r.d END AS d
       FROM reg r LEFT JOIN ficha f ON f.uid = r.uid AND f.ultima >= ? WHERE r.ultima >= ?`, k.ficha, k.reg)) registro.push(r.d);
  for (const r of sql.exec(
    `SELECT json_object('uid', f.uid, 'primera', json_extract(f.d, '$.primera'), 'ultima', f.ultima, 'canales', coalesce(json_extract(f.d, '$.canal'), ''), 'dias', 0) AS d
       FROM ficha f WHERE f.ultima >= ? AND NOT EXISTS (SELECT 1 FROM reg r WHERE r.uid = f.uid AND r.ultima >= ?)`, k.ficha, k.reg)) registro.push(r.d);
  return `{"lista":[${lista.join(',')}],"registro":[${registro.join(',')}],"ahora":${ahora},"dias":${JSON.stringify(dias)}}`;
}

/* ---------- lo que hace el objeto ---------- */
/**
 * b: { op, ahora, dia, ... }
 *   uso      { uid, mas }        suma `mas` segundos a hoy y devuelve { dia, seg } (lo de hoy)
 *   hola     { uid, nombre, foto, x, ev }   ficha y registro → { ok, ev, bv? }
 *   caras    { ids }             { caras: { uid: foto } } de las que tienen foto
 *   primera  { uid }             { t }: la primera vez que se vio la cuenta (0 si nunca)
 *   todos    {}                  el JSON de «Quién usa la app» (texto)
 *   borrar   { uid }             todo lo de esa cuenta → { ok, n }
 *   mudanza  {}                  { copiado, fase, limpio, desde }: cómo va la copia desde el KV
 *   copiar   { fase, filas, siguiente }   una tanda de la copia
 *   kvLimpio {}                  ya no queda nada en el KV
 */
export async function quienObjeto(st, env, b, memo = {}) {
  const sql = st && st.sql;
  if (!sql) return { ok: false, e: 'Sin SQL' };
  preparar(sql, memo);
  const ahora = Number(b.ahora) || Date.now();
  const dia = diaOk(b.dia) ? b.dia : new Date(ahora).toISOString().slice(0, 10);
  limpiarCaducado(sql, memo, dia, ahora);
  const uid = String(b.uid || '');
  switch (b.op) {
    case 'uso': {
      if (!uidOk(uid)) return { ok: false, e: 'Cuenta no válida' };
      const mas = Math.max(0, Math.min(MAX_USO, Math.round(Number(b.mas) || 0)));
      const ya = fila(sql.exec('SELECT seg FROM uso WHERE uid = ? AND dia = ?', uid, dia));
      if (!ya && !copiado(sql, memo)) await traerDeKV(sql, env, memo, uid, { dia, ahora });
      // (un día tiene 86 400 segundos: más de eso es que alguien manda de más)
      if (mas) sql.exec('INSERT INTO uso (uid, dia, seg, t) VALUES (?, ?, ?, ?) ON CONFLICT(uid, dia) DO UPDATE SET seg = min(86400, seg + excluded.seg), t = excluded.t', uid, dia, mas, ahora);
      const x = fila(sql.exec('SELECT seg FROM uso WHERE uid = ? AND dia = ?', uid, dia));
      return { ok: true, dia, seg: x ? x.seg : 0 };
    }
    case 'hola': {
      if (!uidOk(uid)) return { ok: false, e: 'Cuenta no válida' };
      if (!copiado(sql, memo)) {
        const f = fila(sql.exec('SELECT 1 AS x FROM ficha WHERE uid = ?', uid)), r = fila(sql.exec('SELECT 1 AS x FROM reg WHERE uid = ?', uid));
        if (!f || !r) await traerDeKV(sql, env, memo, uid, { ficha: !f, reg: !r, ahora });
      }
      return hola(sql, b, ahora, dia);
    }
    case 'caras': {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(uidOk).slice(0, 40);
      const caras = {};
      if (ids.length) for (const x of sql.exec(`SELECT uid, foto FROM ficha WHERE uid IN (${ids.map(() => '?').join(',')}) AND ultima >= ? AND foto != ''`, ...ids, cortes(ahora).ficha)) caras[x.uid] = x.foto;
      return { caras };
    }
    case 'primera': {
      if (!uidOk(uid)) return { t: 0 };
      const k = cortes(ahora);
      const leer = () => [
        fila(sql.exec("SELECT json_extract(d, '$.primera') AS p FROM ficha WHERE uid = ? AND ultima >= ?", uid, k.ficha)),
        fila(sql.exec("SELECT json_extract(d, '$.primera') AS p FROM reg WHERE uid = ? AND ultima >= ?", uid, k.reg)),
      ];
      let [f, r] = leer();
      if ((!f || !r) && !copiado(sql, memo)) { await traerDeKV(sql, env, memo, uid, { ficha: !f, reg: !r, ahora }); [f, r] = leer(); }
      let t = 0;
      for (const x of [r, f]) { const p = Number(x && x.p) || 0; if (p && (!t || p < t)) t = p; }
      return { t };
    }
    case 'todos': return todos(sql, ahora, dia);
    case 'borrar': {
      if (!uidOk(uid)) return { ok: false, e: 'Cuenta no válida' };
      let n = 0;
      for (const t of ['ficha', 'reg', 'uso']) n += escribir(sql, `DELETE FROM ${t} WHERE uid = ?`, uid);
      return { ok: true, n };
    }
    case 'mudanza': return { copiado: Number(leerMeta(sql, 'copiado')) || 0, fase: leerMeta(sql, 'fase') || 'p', limpio: Number(leerMeta(sql, 'kvLimpio')) || 0 };
    case 'copiar': return copiar(sql, b, ahora);
    case 'kvLimpio': ponerMeta(sql, 'kvLimpio', ahora); return { ok: true };
    default: return { ok: false, e: 'No existe' };
  }
}
