// Un Durable Object de mentira para las pruebas sin red (0.8.4): el almacén de siempre (get, put, list, delete…) en
// memoria y, además, `sql` con un SQLite de verdad (node:sqlite, el mismo motor que usa Cloudflare en los objetos), con
// `exec` que devuelve un cursor como el suyo (se recorre, toArray, one, rowsWritten). Lo usan datos.mjs y mide-quien.mjs.
// Cuenta las filas escritas y leídas (lo que Cloudflare cobra en los objetos) en `filas`.
const avisoReal = process.emitWarning;
process.emitWarning = (w, ...a) => { if (String(w).includes('SQLite')) return; return avisoReal.call(process, w, ...a); };
const { DatabaseSync } = await import('node:sqlite');
process.emitWarning = avisoReal;

export function almacen() {
  const m = new Map();
  const db = new DatabaseSync(':memory:');
  const filas = { escritas: 0, leidas: 0 };
  const cambios = db.prepare('SELECT total_changes() AS c');
  let alarma = null;
  const sql = {
    exec(q, ...a) {
      const st = db.prepare(q);
      const antes = cambios.get().c;
      const rows = st.all(...a.map((x) => (typeof x === 'boolean' ? Number(x) : x)));
      const escritas = cambios.get().c - antes;
      filas.escritas += escritas; filas.leidas += rows.length;
      let i = 0;
      return {
        rowsWritten: escritas, rowsRead: rows.length,
        [Symbol.iterator]() { return { next: () => (i < rows.length ? { value: rows[i++], done: false } : { value: undefined, done: true }) }; },
        toArray() { const r = rows.slice(i); i = rows.length; return r; },
        one() { if (rows.length !== 1) throw new Error(`Expected exactly one result from SQL query, but got ${rows.length}.`); return rows[0]; },
      };
    },
  };
  const storage = {
    sql,
    async get(k) { if (Array.isArray(k)) return new Map(k.filter((x) => m.has(x)).map((x) => [x, m.get(x)])); return m.get(k); },
    async put(k, v) { if (k && typeof k === 'object') for (const [a, b] of Object.entries(k)) m.set(a, b); else m.set(k, v); },
    async delete(k) { if (Array.isArray(k)) { let n = 0; for (const x of k) n += m.delete(x) ? 1 : 0; return n; } return m.delete(k); },
    async list({ prefix = '', start, end, reverse = false, limit } = {}) {
      let ks = [...m.keys()].filter((k) => k.startsWith(prefix) && (start == null || k >= start) && (end == null || k < end)).sort();
      if (reverse) ks.reverse();
      if (limit) ks = ks.slice(0, limit);
      return new Map(ks.map((k) => [k, m.get(k)]));
    },
    async deleteAll() { m.clear(); for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) db.exec(`DROP TABLE "${name}"`); },
    async setAlarm(t) { alarma = t; }, async getAlarm() { return alarma; }, async deleteAlarm() { alarma = null; },
  };
  return { storage, m, db, filas };
}

/** env.QR de mentira: un objeto Emparejar por nombre, cada uno con su almacén (también con SQL) */
export function objetos(Emparejar, env = {}) {
  const hay = new Map();
  const QR = {
    idFromName: (n) => n,
    get: (id) => {
      if (!hay.has(id)) { const a = almacen(); hay.set(id, { ...a, o: new Emparejar({ storage: a.storage }, QR.env || env) }); }
      const x = hay.get(id);
      return { fetch: (u, op) => x.o.fetch(new Request(u, op)) };
    },
    hay,
    env: null,
  };
  return QR;
}
