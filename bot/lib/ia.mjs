// Quién contesta las preguntas del bot: Claude (lib/claude.mjs) o Gemini (lib/gemini.mjs), con la misma interfaz `preguntarJson`.
// Dos usos: `clasificar` (leer noticias de jugadores y de la competición: Haiku 5.5) y `redactar` (escribir el tuit desde los
// hechos: Sonnet 5.5). Claude solo se usa con `ia.proveedor` = "claude" en config.json (o la variable BOT_IA=claude) y el secreto
// ANTHROPIC_API_KEY; si no, o si Claude falla al clasificar, Gemini como siempre. Al redactar, Gemini solo hace de relevo con
// `ia.geminiRedacta` a true: si no, cuando Claude no contesta el tuit sale con la plantilla (y pulir, si está encendido).
// El gasto de cada día va al registro (`ia`: llamadas, tokens y dólares; `iaDias`: los 30 últimos días) y tiene tope propio
// (`ia.topeDolaresDia`, `ia.porDia`): pasado el tope, clasificar vuelve a Gemini y redactar deja la plantilla.
import { preguntarJson as geminiJson } from './gemini.mjs';
import { preguntarJson as claudeJson, SONNET, HAIKU } from './claude.mjs';
import { diaMadrid } from './registro.mjs';

export const MODELOS = { clasificar: HAIKU, redactar: SONNET };

export const proveedor = (config = {}) => String(process.env.BOT_IA || (config.ia && config.ia.proveedor) || 'gemini').toLowerCase();
export const conClaude = (config = {}) => proveedor(config) === 'claude' && !!process.env.ANTHROPIC_API_KEY;

/** la cuenta de hoy en el registro (la de ayer pasa a `iaDias`) */
export function cuentaHoy(registro, ahora = Date.now()) {
  const d = (registro && registro.datos) || (registro ? (registro.datos = {}) : {});
  const hoy = diaMadrid(ahora);
  if (!d.ia || d.ia.dia !== hoy) {
    if (d.ia && d.ia.dia) d.iaDias = [...(d.iaDias || []).filter((x) => x.dia !== d.ia.dia), d.ia].slice(-30);
    d.ia = { dia: hoy, llamadas: { clasificar: 0, redactar: 0 }, fallos: 0, entrada: 0, salida: 0, cacheLee: 0, cacheEscribe: 0, dolares: 0 };
  }
  return d.ia;
}

/** ¿queda cupo hoy para este uso? '' si sí; si no, el motivo */
export function sinCupo(uso, { registro, config = {}, ahora = Date.now() } = {}) {
  const cfg = config.ia || {};
  const c = cuentaHoy(registro, ahora);
  const tope = cfg.topeDolaresDia ?? 0.7;
  if (c.dolares >= tope) return `tope de ${tope} $ hoy (${c.dolares.toFixed(3)} $ gastados)`;
  const n = (cfg.porDia || {})[uso] ?? (uso === 'redactar' ? 60 : 150);
  if ((c.llamadas[uso] || 0) >= n) return `tope de ${n} preguntas de ${uso} hoy`;
  return '';
}

function apuntar(c, uso, r) {
  c.llamadas[uso] = (c.llamadas[uso] || 0) + 1;
  if (!r.ok) c.fallos++;
  for (const k of ['entrada', 'salida', 'cacheLee', 'cacheEscribe']) c[k] += (r.uso && r.uso[k]) || 0;
  c.dolares = Math.round((c.dolares + (r.dolares || 0)) * 1e6) / 1e6;
}

/**
 * Pregunta con Claude o con Gemini según la configuración. Mismos argumentos que preguntarJson de gemini.mjs, más `uso`,
 * `sistema` y `cache`. Devuelve lo mismo, con `proveedor` ('claude' o 'gemini').
 */
export async function preguntar({ uso = 'clasificar', registro = null, config = {}, prompt, esquema, sistema = '', cache = false, log = () => {},
  tiempo, hasta, ahora = Date.now(), claude = claudeJson, gemini = geminiJson, pedir }) {
  if (conClaude(config)) {
    const motivo = sinCupo(uso, { registro, config, ahora });
    if (motivo) log(`  (ia) ${motivo}`);
    else {
      const modelo = ((config.ia || {}).modelos || {})[uso] || MODELOS[uso];
      const r = await claude({ clave: process.env.ANTHROPIC_API_KEY, prompt, esquema, sistema, cache, modelo, log, ...(tiempo ? { tiempo } : {}), ...(hasta ? { hasta } : {}),
        ...(uso === 'clasificar' ? { temperatura: 0.2, maxTokens: 4000 } : {}), ...(pedir ? { pedir } : {}) });
      apuntar(cuentaHoy(registro, ahora), uso, r);
      if (r.ok) return { ...r, proveedor: 'claude' };
      log(`  (ia) Claude no contesta (${r.error})`);
    }
  }
  // redactar con Gemini solo si se pide (`ia.geminiRedacta`): si no, la plantilla
  if (uso === 'redactar' && !(config.ia || {}).geminiRedacta) return { ok: false, error: conClaude(config) ? 'Claude no contesta o sin cupo' : 'sin Claude', proveedor: 'claude' };
  const clave = process.env.GEMINI_API_KEY;
  const r = await gemini({ clave, prompt: sistema ? `${sistema}\n\n${prompt}` : prompt, esquema, log, ...(tiempo ? { tiempo } : {}), ...(hasta ? { hasta } : {}), ...(pedir ? { pedir } : {}) });
  return { ...r, proveedor: 'gemini' };
}

/** una función con la firma de preguntarJson de gemini.mjs ({ clave, prompt, esquema, log, hasta }) para noticias y liga */
export const clasificador = ({ registro = null, config = {} } = {}) => (op) => preguntar({ ...op, uso: 'clasificar', registro, config });
/** la clave que hace falta para clasificar: la de Claude si va con Claude, si no la de Gemini */
export const claveClasificar = (config = {}) => (conClaude(config) ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY);
