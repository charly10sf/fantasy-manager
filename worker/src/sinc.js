/*
 * Lo mismo en todos tus dispositivos (22 nov; Carlos: «en la web me sale un plan distinto al de la app móvil; tienen que
 * ser iguales, y las preguntas que hagas en un sitio tienen que aparecer en el otro»). El plan del día, la conversación
 * con la IA, lo que le has contado y los pasos que has marcado como hechos se guardaban solo en cada dispositivo.
 * Ahora van también con la cuenta de LaLiga, por liga, en un Durable Object por cuenta («sinc|uid»; nunca en el KV):
 *   s|<liga>|<clave> → { t, v }     clave: plan | chat | notas | hechos
 * De cada cosa gana la que se cambió más tarde (t): es una sola persona con varios dispositivos, no hace falta juntar.
 * Solo lo lee su dueño. Lo que lleva más de 45 días sin tocarse se borra al pasar por aquí. Topes por clave abajo.
 */
// (un valor de un Durable Object no puede pasar de 128 KiB: los topes van en caracteres, con margen para las tildes)
export const SINC_MAX = { plan: 90000, chat: 90000, notas: 30000, hechos: 12000, ligas: 6, dias: 45 };
export const SINC_CLAVES = ['plan', 'chat', 'notas', 'hechos'];
const ligaOk = (x) => /^\d{1,20}$/.test(String(x || ''));
const DIA = 86400e3;

/** lo que manda la app, limpio: { clave: { t, v } } (t en ms, nunca en el futuro; v, lo que sea que quepa) */
export function sincLimpio(pon, ahora = Date.now()) {
  const out = {};
  if (!pon || typeof pon !== 'object' || Array.isArray(pon)) return out;
  for (const k of SINC_CLAVES) {
    const x = pon[k];
    if (!x || typeof x !== 'object') continue;
    const t = Math.min(ahora, Math.max(0, Math.round(Number(x.t) || 0)));
    if (!t || x.v === undefined) continue;
    let largo = 0;
    try { largo = JSON.stringify(x.v).length; } catch (e) { continue; }
    if (largo > SINC_MAX[k]) continue;
    out[k] = { t, v: x.v };
  }
  return out;
}

/**
 * lo que hace el objeto de la cuenta: { op: 'sinc' | 'borrar', liga, pon: { clave: { t, v } }, tengo: { clave: t }, ahora }
 * Guarda lo que llega si es más nuevo que lo guardado y devuelve lo guardado que es más nuevo que lo que tiene la app:
 * { ok, trae: { clave: { t, v } } }
 */
export async function sincObjeto(st, b) {
  if (b.op === 'borrar') { await st.deleteAll(); return { ok: true }; }
  if (b.op !== 'sinc') return { ok: false, e: 'No existe' };
  const liga = String(b.liga || '');
  if (!ligaOk(liga)) return { ok: false, e: 'Liga no válida' };
  const ahora = Number(b.ahora) || Date.now();
  const pon = sincLimpio(b.pon, ahora);
  const tengo = b.tengo && typeof b.tengo === 'object' ? b.tengo : {};
  // (una liga nueva para esta cuenta: como mucho SINC_MAX.ligas)
  const guardadas = await st.list({ prefix: 's|' });
  const ligas = new Set([...guardadas.keys()].map((k) => k.split('|')[1]));
  if (Object.keys(pon).length && !ligas.has(liga) && ligas.size >= SINC_MAX.ligas) {
    // se quita la liga que lleva más tiempo sin tocarse
    const ult = {};
    for (const [k, x] of guardadas) { const l = k.split('|')[1]; ult[l] = Math.max(ult[l] || 0, (x && x.t) || 0); }
    const vieja = Object.keys(ult).sort((a, c) => ult[a] - ult[c])[0];
    for (const k of guardadas.keys()) if (k.split('|')[1] === vieja) await st.delete(k);
  }
  const trae = {};
  for (const k of SINC_CLAVES) {
    const clave = `s|${liga}|${k}`;
    let ya = guardadas.get(clave) || null;
    // lo que lleva demasiado sin tocarse, fuera
    if (ya && ahora - (ya.t || 0) > SINC_MAX.dias * DIA) { await st.delete(clave); ya = null; }
    const llega = pon[k];
    if (llega && (!ya || llega.t > ya.t)) { await st.put(clave, llega); ya = llega; }
    const tApp = Math.max(Number(tengo[k]) || 0, (llega && llega.t) || 0);
    if (ya && ya.t > tApp) trae[k] = ya;
  }
  return { ok: true, trae };
}
