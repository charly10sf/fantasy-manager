// Gemini para el bot (noticias de prensa): una clave de Google AI Studio aparte de la de la app (secreto GEMINI_API_KEY), para que
// el bot no gaste el cupo gratis de nadie. La clave va en la cabecera x-goog-api-key, nunca en la URL ni en los logs.
// Los modelos se prueban por orden; uno que da 404, 429 o 5xx se salta y se pasa al siguiente.
const API = 'https://generativelanguage.googleapis.com/v1beta';
// Los modelos salen de la lista de la clave (el 3 nov 2026, gemini-2.5-flash ya daba 404 a las claves nuevas: «use gemini-3.8…»).
// Si la lista no llega, estos:
export const MODELOS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
const ver = (n) => Number((n.match(/^gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
/**
 * Ordena los modelos de la clave (sin pro, tts, imagen ni audio): el flash más nuevo, la lite más nueva, el siguiente flash, la
 * siguiente lite, flash-latest, flash-lite-latest y el resto. Alternar es porque los flash nuevos dan 503 a menudo (3 nov: los cuatro
 * a la vez) y las lite contestan.
 */
export function ordenar(nombres) {
  const xs = [...new Set(nombres)].filter((n) => /^gemini-/.test(n) && /flash/.test(n) && !/tts|image|audio|live|embedding|thinking|exp/.test(n));
  const num = (lite) => xs.filter((n) => ver(n) && !/preview|latest/.test(n) && /lite/.test(n) === lite).sort((a, b) => ver(b) - ver(a) || a.length - b.length);
  const f = num(false), l = num(true);
  const out = [f[0], l[0], f[1], l[1], 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter((n) => n && (xs.includes(n)));
  return [...out, ...xs.filter((n) => !out.includes(n)).sort((a, b) => ver(b) - ver(a))];
}
let lista = null;
/** los modelos que admite la clave, una vez por ejecución (no gasta cupo) */
export async function modelosDe(clave, { pedir = fetch } = {}) {
  if (!lista) lista = pedir(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': clave }, signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { const xs = ordenar(((j && j.models) || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))); return xs.length ? xs : MODELOS; })
    .catch(() => MODELOS);
  return lista;
}

/**
 * Pregunta y devuelve el JSON de la respuesta (con responseSchema). { ok, datos, modelo } o { ok: false, error }.
 * pedir(url, opciones) es fetch (se cambia en las pruebas).
 */
export async function preguntarJson({ clave, prompt, esquema, modelos = null, pedir = fetch, log = () => {}, tiempo = 40000, hasta = Date.now() + 120000 }) {
  if (!clave) return { ok: false, error: 'sin clave' };
  let ultimo = '';
  for (const m of (modelos || await modelosDe(clave, { pedir })).slice(0, 7)) {
    if (Date.now() > hasta - 5000) { ultimo = ultimo || 'sin tiempo'; break; }
    let r, cuerpo;
    try {
      r = await pedir(`${API}/models/${m}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(Math.min(tiempo, hasta - Date.now())),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: esquema } }),
      });
      cuerpo = await r.text();
    } catch (e) { ultimo = `${m}: ${e.name === 'TimeoutError' ? 'sin respuesta a tiempo' : 'error de red'}`; log(`  (gemini) ${ultimo}`); continue; }
    if (r.status !== 200) {
      const msg = (() => { try { return JSON.parse(cuerpo).error.message.slice(0, 120); } catch { return ''; } })();
      ultimo = `${m}: HTTP ${r.status} ${msg}`; log(`  (gemini) ${ultimo}`);
      if (r.status === 400 && !/model|not found|not supported/i.test(msg)) return { ok: false, error: ultimo };   // la pregunta está mal: no sirve otro modelo
      if (r.status === 401 || r.status === 403) return { ok: false, error: ultimo };                             // la clave no vale
      continue;
    }
    try {
      const j = JSON.parse(cuerpo);
      const texto = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      return { ok: true, datos: JSON.parse(texto), modelo: m };
    } catch { ultimo = `${m}: respuesta que no es JSON`; log(`  (gemini) ${ultimo}`); }
  }
  return { ok: false, error: ultimo || 'ningún modelo contestó' };
}
