/*
 * Los apodos de los rivales en todos tus dispositivos (19 nov; Carlos: los puso en el móvil y en el PC no salían).
 * Por cuenta de LaLiga y liga, en un Durable Object por cuenta («apodos|uid»; nunca en el KV, que va justo de escrituras):
 *   l|<liga> → { <tid>: { v: 'el Tito, Titón', t } }   (v vacío: borrado, para que el borrado también llegue a los demás)
 * Se juntan rival a rival: gana lo que se cambió más tarde (t). Topes: 40 rivales por liga, 4 apodos de 60 caracteres por
 * rival y 10 ligas por cuenta. Solo los ve su dueño: nadie más lee este objeto.
 */
export const APODOS_MAX = { rivales: 40, apodos: 4, largo: 60, ligas: 10 };
const tidOk = (x) => /^\d{1,15}$/.test(String(x || ''));
export const ligaOk = (x) => /^\d{1,20}$/.test(String(x || ''));

/** «el Tito, Titón» limpio: como listaApodos de web/js/apodos.js (de 3 a 60 caracteres, con alguna letra, 4 como mucho) */
export function limpiarApodo(s) {
  return [...new Set(String(s || '').split(/[,;\n]/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 3 && x.length <= APODOS_MAX.largo && /\p{L}/u.test(x)))].slice(0, APODOS_MAX.apodos).join(', ');
}
/** lo que manda la app, limpio: { tid: { v, t } } (t en ms, nunca en el futuro) */
export function apodosLimpios(a, ahora = Date.now()) {
  const out = {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) return out;
  for (const [tid, x] of Object.entries(a).slice(0, APODOS_MAX.rivales * 2)) {
    if (!tidOk(tid) || !x || typeof x !== 'object') continue;
    const t = Math.min(ahora, Math.max(0, Math.round(Number(x.t) || 0)));
    out[tid] = { v: limpiarApodo(x.v), t };
  }
  return out;
}
/** junta lo del servidor con lo que llega: rival a rival, gana el más reciente (a igualdad, lo del servidor) */
export function juntarApodos(serv, llega) {
  const out = { ...(serv || {}) };
  for (const [tid, x] of Object.entries(llega || {})) {
    const s = out[tid];
    if (!s || x.t > s.t) out[tid] = x;
  }
  // los borrados más viejos fuera, si se pasa del tope
  const ks = Object.keys(out);
  if (ks.length > APODOS_MAX.rivales) ks.sort((a, b) => (out[a].v ? 1 : 0) - (out[b].v ? 1 : 0) || out[a].t - out[b].t).slice(0, ks.length - APODOS_MAX.rivales).forEach((k) => delete out[k]);
  return out;
}
/** lo que hace el objeto de la cuenta: { op: 'leer' | 'juntar' | 'borrar', liga, a } */
export async function apodosObjeto(st, b) {
  if (b.op === 'borrar') { await st.deleteAll(); return { ok: true }; }
  const liga = String(b.liga || '');
  if (!ligaOk(liga)) return { ok: false, e: 'Liga no válida' };
  const k = `l|${liga}`, ya = (await st.get(k)) || {};
  if (b.op === 'leer') return { ok: true, a: ya };
  if (b.op !== 'juntar') return { ok: false, e: 'No existe' };
  const llega = apodosLimpios(b.a, Number(b.ahora) || Date.now());
  const junto = juntarApodos(ya, llega);
  if (JSON.stringify(junto) !== JSON.stringify(ya)) {
    if (!(await st.get(k))) {
      const ligas = [...(await st.list({ prefix: 'l|' })).keys()];
      if (ligas.length >= APODOS_MAX.ligas) return { ok: false, e: 'Demasiadas ligas con apodos' };
    }
    await st.put(k, junto);
  }
  return { ok: true, a: junto };
}
