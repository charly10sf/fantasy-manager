// La API de Claude para el bot, con la misma interfaz que lib/gemini.mjs (`preguntarJson`). Secreto ANTHROPIC_API_KEY, solo del bot y
// solo en Actions: la clave va en la cabecera x-api-key, nunca en la URL ni en los logs. La crea Carlos en platform.claude.com.
// La respuesta en JSON se pide con salida estructurada (output_config.format, json_schema) y el mismo esquema que se le pasa a Gemini.
// (Primera prueba, 6 nov: Sonnet 5.5 no admite tool_choice obligatorio y los modelos 5.5 ya no admiten la temperatura.)
// Las instrucciones fijas (`sistema`) pueden ir en caché: solo compensa si en la misma ejecución salen varias preguntas con el mismo
// sistema (la escritura cuesta 1,25 veces la entrada y la lectura 0,05 en Sonnet 5.5 y 0,1 en Haiku 5.5; la caché dura 5 min y el bot
// corre cada 5 min en una Action nueva, así que entre ejecuciones casi nunca se lee).
const API = 'https://api.anthropic.com/v1/messages';
export const SONNET = 'claude-sonnet-5-5';
export const HAIKU = 'claude-haiku-5-5';
// dólares por millón de tokens (claude/coste-api-claude.md del proyecto, 6 nov 2026; caché de la doc de prompt caching)
export const PRECIOS = {
  [SONNET]: { entrada: 2, salida: 10, cacheLee: 0.10, cacheEscribe: 2.5 },
  [HAIKU]: { entrada: 0.10, salida: 0.50, cacheLee: 0.01, cacheEscribe: 0.125 },
};

/** el esquema de Gemini (type: 'OBJECT', 'STRING'…) al JSON Schema de la API de Claude */
export function esquemaJson(e) {
  if (Array.isArray(e)) return e.map(esquemaJson);
  if (!e || typeof e !== 'object') return e;
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'type' && typeof v === 'string') { out.type = v.toLowerCase(); if (out.type === 'object') out.additionalProperties = false; }
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, esquemaJson(s)]));
    else if (k === 'items') out.items = esquemaJson(v);
    else if (k === 'nullable') continue;
    else out[k] = v;
  }
  return out;
}

/** lo que cuesta una respuesta, en dólares, a partir de su `usage` */
export function coste(modelo, u = {}) {
  const p = PRECIOS[modelo] || PRECIOS[SONNET];
  return ((u.input_tokens || 0) * p.entrada + (u.output_tokens || 0) * p.salida
    + (u.cache_read_input_tokens || 0) * p.cacheLee + (u.cache_creation_input_tokens || 0) * p.cacheEscribe) / 1e6;
}
export const usoDe = (u = {}) => ({ entrada: u.input_tokens || 0, salida: u.output_tokens || 0, cacheLee: u.cache_read_input_tokens || 0, cacheEscribe: u.cache_creation_input_tokens || 0 });

/**
 * Pregunta y devuelve el JSON de la respuesta. { ok, datos, modelo, uso, dolares } o { ok: false, error, uso, dolares }.
 * `sistema`: las instrucciones fijas (guía, ejemplos); `cache`: ponerlas en caché. pedir(url, opciones) es fetch (se cambia en las pruebas).
 */
export async function preguntarJson({ clave, prompt, esquema, sistema = '', cache = false, modelos = null, modelo = SONNET, maxTokens = 4000,
  temperatura = null, pedir = fetch, log = () => {}, tiempo = 40000, hasta = Date.now() + 90000 }) {
  if (!clave) return { ok: false, error: 'sin clave' };
  const lista = modelos || [modelo];
  const uso = { entrada: 0, salida: 0, cacheLee: 0, cacheEscribe: 0 };
  let dolares = 0, ultimo = '', conTemp = temperatura != null;
  const formato = { format: { type: 'json_schema', schema: esquemaJson(esquema) } };
  for (const m of lista) {
    // un 529 (saturado) o un 5xx se reintenta una vez con el mismo modelo
    for (let intento = 0; intento < 2; intento++) {
      if (Date.now() > hasta - 5000) return { ok: false, error: ultimo || 'sin tiempo', uso, dolares };
      let r, cuerpo;
      try {
        r = await pedir(API, {
          method: 'POST', signal: AbortSignal.timeout(Math.min(tiempo, hasta - Date.now())),
          headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: m, max_tokens: maxTokens, ...(conTemp ? { temperature: temperatura } : {}),
            ...(sistema ? { system: [{ type: 'text', text: sistema, ...(cache ? { cache_control: { type: 'ephemeral' } } : {}) }] } : {}),
            output_config: formato,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        cuerpo = await r.text();
      } catch (e) { ultimo = `${m}: ${e.name === 'TimeoutError' ? 'sin respuesta a tiempo' : 'error de red'}`; log(`  (claude) ${ultimo}`); break; }
      if (r.status !== 200) {
        const msg = (() => { try { return JSON.parse(cuerpo).error.message.slice(0, 120); } catch { return ''; } })();
        ultimo = `${m}: HTTP ${r.status} ${msg}`; log(`  (claude) ${ultimo}`);
        if (r.status === 401 || r.status === 403) return { ok: false, error: ultimo, uso, dolares };      // la clave no vale
        // si un modelo no admite la temperatura, se pregunta otra vez sin ella
        if (r.status === 400 && /temperature/i.test(msg) && conTemp) { conTemp = false; intento--; continue; }
        if (r.status === 400 && !/model/i.test(msg)) return { ok: false, error: ultimo, uso, dolares };    // la pregunta está mal
        if ((r.status === 529 || r.status >= 500) && intento === 0) { await new Promise((ok) => setTimeout(ok, 1500)); continue; }
        break;
      }
      let j;
      try { j = JSON.parse(cuerpo); } catch { ultimo = `${m}: respuesta que no es JSON`; log(`  (claude) ${ultimo}`); break; }
      const u = usoDe(j.usage);
      for (const k of Object.keys(uso)) uso[k] += u[k];
      dolares += coste(m, j.usage);
      const texto = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      let datos = null;
      try { datos = JSON.parse(texto); } catch { /* abajo */ }
      if (!datos || typeof datos !== 'object') { ultimo = `${m}: sin respuesta con formato (${j.stop_reason || '?'})`; log(`  (claude) ${ultimo}`); break; }
      return { ok: true, datos, modelo: m, uso, dolares };
    }
  }
  return { ok: false, error: ultimo || 'ningún modelo contestó', uso, dolares };
}
