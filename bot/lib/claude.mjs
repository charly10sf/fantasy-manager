// La API de Claude para el bot, con la misma interfaz que lib/gemini.mjs (`preguntarJson`). Secreto ANTHROPIC_API_KEY, solo del bot y
// solo en Actions: la clave va en la cabecera x-api-key, nunca en la URL ni en los logs. La crea Carlos en platform.claude.com.
// La respuesta en JSON se pide con salida estructurada (output_config.format, json_schema) y el mismo esquema que se le pasa a Gemini.
// (Primera prueba, 6 nov: Sonnet 5.5 no admite tool_choice obligatorio y los modelos 5.5 ya no admiten la temperatura. Segunda: con el
// razonamiento por defecto, 27 tuits costaron 0,73 $ porque cada uno pensaba unos 2.000 tokens; ahora, sin pensar y con esfuerzo medio.)
// Las instrucciones fijas (`sistema`) pueden ir en caché. `sistema` es un texto o una lista de textos (bloques de `system`, cada uno con
// su marca: redactar manda la guía, igual para todos los tipos, y luego los ejemplos del tipo, así un final lee la guía que dejó un
// directo). Desde el 26 nov la caché dura 1 hora (`ttl`, de `ia.cacheTTL` en config.json): el bot corre cada 5 min en una Action nueva y
// la de 5 min casi nunca llegaba viva a la siguiente. Precios (docs de prompt caching): escribir 5 min, 1,25 veces la entrada; 1 hora,
// el doble; leer, 0,05 en Sonnet 5.5 y 0,1 en Haiku 5.5.
const API = 'https://api.anthropic.com/v1/messages';
export const SONNET = 'claude-sonnet-5-5';
export const HAIKU = 'claude-haiku-5-5';
// (9 nov) Haiku 5.5 no admite `thinking: between_tools`: daba un 400 en cada pregunta para clasificar y se repetía sin él (sin pensar
// igual: unos 100-500 tokens de salida por lote). A estos modelos no se les manda; y si otro modelo dice que no lo admite, se apunta
// aquí para el resto de la ejecución, así solo falla la primera pregunta.
export const SIN_BETWEEN = new Set([HAIKU]);
// dólares por millón de tokens (claude/coste-api-claude.md del proyecto, 6 nov 2026; caché de la doc de prompt caching)
// (`cacheEscribe`, escribir 5 min; `cacheEscribe1h`, escribir 1 hora: 26 nov, la tabla de platform.claude.com)
export const PRECIOS = {
  [SONNET]: { entrada: 2, salida: 10, cacheLee: 0.10, cacheEscribe: 2.5, cacheEscribe1h: 4 },
  [HAIKU]: { entrada: 0.10, salida: 0.50, cacheLee: 0.01, cacheEscribe: 0.125, cacheEscribe1h: 0.20 },
};
/** la marca de caché de un bloque: 1 hora con `ttl: '1h'`; con '5m', la de siempre, sin `ttl` */
export const marcaCache = (ttl = '5m') => (ttl === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' });
/** `sistema` (texto o lista de textos) como bloques de `system`, sin los vacíos; [] si no hay */
export function bloquesSistema(sistema, cache = false, ttl = '5m') {
  return (Array.isArray(sistema) ? sistema : [sistema]).map((t) => String(t || '')).filter(Boolean)
    .map((text) => ({ type: 'text', text, ...(cache ? { cache_control: marcaCache(ttl) } : {}) }));
}

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

/**
 * lo que cuesta una respuesta, en dólares, a partir de su `usage`. Lo escrito en caché, cada parte a su precio: `usage.cache_creation`
 * trae `ephemeral_5m_input_tokens` y `ephemeral_1h_input_tokens`; si no viene, todo lo escrito se cobra a la duración pedida (`ttl`).
 */
export function coste(modelo, u = {}, ttl = '5m') {
  const p = PRECIOS[modelo] || PRECIOS[SONNET];
  const cc = u.cache_creation && typeof u.cache_creation === 'object' ? u.cache_creation : null;
  const escrito = u.cache_creation_input_tokens || 0;
  let e1h = cc ? (cc.ephemeral_1h_input_tokens || 0) : 0, e5m = cc ? (cc.ephemeral_5m_input_tokens || 0) : 0;
  // (lo escrito que no venga desglosado, a la duración pedida: mejor contar de más que de menos para el tope del día)
  const resto = Math.max(0, escrito - e1h - e5m);
  if (ttl === '1h') e1h += resto; else e5m += resto;
  return ((u.input_tokens || 0) * p.entrada + (u.output_tokens || 0) * p.salida
    + (u.cache_read_input_tokens || 0) * p.cacheLee + e5m * p.cacheEscribe + e1h * (p.cacheEscribe1h ?? p.entrada * 2)) / 1e6;
}
export const usoDe = (u = {}) => ({ entrada: u.input_tokens || 0, salida: u.output_tokens || 0, cacheLee: u.cache_read_input_tokens || 0, cacheEscribe: u.cache_creation_input_tokens || 0 });

/**
 * Pregunta y devuelve el JSON de la respuesta. { ok, datos, modelo, uso, dolares } o { ok: false, error, uso, dolares }.
 * `sistema`: las instrucciones fijas (guía, ejemplos), un texto o una lista de textos; `cache`: ponerlas en caché, con la marca en cada
 * bloque; `ttl`: '1h' o '5m' (sin `ttl` en la marca). pedir(url, opciones) es fetch (se cambia en las pruebas).
 */
export async function preguntarJson({ clave, prompt, esquema, sistema = '', cache = false, ttl = '5m', modelos = null, modelo = SONNET, maxTokens = 4000,
  temperatura = null, esfuerzo = null, pensar = true, pedir = fetch, log = () => {}, tiempo = 40000, hasta = Date.now() + 90000 }) {
  if (!clave) return { ok: false, error: 'sin clave' };
  const lista = modelos || [modelo];
  const uso = { entrada: 0, salida: 0, cacheLee: 0, cacheEscribe: 0 };
  let dolares = 0, ultimo = '', conTemp = temperatura != null, conEsfuerzo = !!esfuerzo, conPensar = !pensar;
  const esquemaJ = esquemaJson(esquema);
  const system = bloquesSistema(sistema, cache, ttl);
  for (const m of lista) {
    let conPensarM = conPensar && !SIN_BETWEEN.has(m);
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
            ...(system.length ? { system } : {}),
            output_config: { format: { type: 'json_schema', schema: esquemaJ }, ...(conEsfuerzo ? { effort: esfuerzo } : {}) },
            // sin pensar antes de contestar (between_tools: sin herramientas, no piensa): el razonamiento se cobra como salida
            ...(conPensarM ? { thinking: { type: 'between_tools' } } : {}),
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
        // y lo mismo con el esfuerzo o el modo de pensar, si un modelo no los admite
        if (r.status === 400 && /effort/i.test(msg) && conEsfuerzo) { conEsfuerzo = false; intento--; continue; }
        if (r.status === 400 && /thinking/i.test(msg) && conPensarM) { conPensarM = false; SIN_BETWEEN.add(m); intento--; continue; }
        if (r.status === 400 && !/model/i.test(msg)) return { ok: false, error: ultimo, uso, dolares };    // la pregunta está mal
        if ((r.status === 529 || r.status >= 500) && intento === 0) { await new Promise((ok) => setTimeout(ok, 1500)); continue; }
        break;
      }
      let j;
      try { j = JSON.parse(cuerpo); } catch { ultimo = `${m}: respuesta que no es JSON`; log(`  (claude) ${ultimo}`); break; }
      const u = usoDe(j.usage);
      for (const k of Object.keys(uso)) uso[k] += u[k];
      dolares += coste(m, j.usage, cache ? ttl : '5m');
      const texto = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      let datos = null;
      try { datos = JSON.parse(texto); } catch { /* abajo */ }
      if (!datos || typeof datos !== 'object') { ultimo = `${m}: sin respuesta con formato (${j.stop_reason || '?'})`; log(`  (claude) ${ultimo}`); break; }
      return { ok: true, datos, modelo: m, uso, dolares };
    }
  }
  return { ok: false, error: ultimo || 'ningún modelo contestó', uso, dolares };
}
