// Gemini para el bot (noticias de prensa): una clave de Google AI Studio aparte de la de la app (secreto GEMINI_API_KEY), para que
// el bot no gaste el cupo gratis de nadie. La clave va en la cabecera x-goog-api-key, nunca en la URL ni en los logs.
// Los modelos se prueban por orden; uno que da 404, 429 o 5xx se salta y se pasa al siguiente.
const API = 'https://generativelanguage.googleapis.com/v1beta';
// comprobado el 3 nov 2026 con la clave del bot: gemini-flash-latest, gemini-2.5-flash, gemini-3-flash-preview y las lite
export const MODELOS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'];

/**
 * Pregunta y devuelve el JSON de la respuesta (con responseSchema). { ok, datos, modelo } o { ok: false, error }.
 * pedir(url, opciones) es fetch (se cambia en las pruebas).
 */
export async function preguntarJson({ clave, prompt, esquema, modelos = MODELOS, pedir = fetch, log = () => {}, tiempo = 60000 }) {
  if (!clave) return { ok: false, error: 'sin clave' };
  let ultimo = '';
  for (const m of modelos) {
    let r, cuerpo;
    try {
      r = await pedir(`${API}/models/${m}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(tiempo),
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
