/* La IA: Gemini (Google AI Studio) con tu clave gratuita, llamada directamente desde el móvil a Google.
   Hace el plan del día (las operaciones en orden: qué vender, qué comprar, a quién clausular, cuánto pujar)
   con todo lo de tu liga, los titulares de prensa y los onces probables que ya trae la app; la búsqueda en
   Google es un ajuste (en el chat, solo cuando hace falta; en el plan, apagada por defecto: tarda el doble).
   Prueba todos los modelos gratuitos que tenga tu clave antes de rendirse, y si se acaba la búsqueda en
   Google, sigue sin ella. Cada intento queda apuntado para el diagnóstico. */
import { leer, guardar, http, enApp, despues } from './puente.js';
import { LS, eur, pct, cuando, dura, POS, DIA, MIN, HORA, diaDe, norm, num, esWebFantasy, sinWebs, fechaCorta } from './util.js';
import { K } from './datos.js';
import { favoritos } from './favoritos.js';
import { catalogo, catalogoTxt, comoConseguir, buscarOp, porQueNo, cajaConOfertas, esMalo, paronLejos, cholloParon, PARON_VUELTA, noMerece } from './operaciones.js';
import { recsDe, aprendeTxt } from './aprende.js';
import { guardarFoto, leerFoto, guardarMini } from './fotos.js';
import { bloqueada, topConAnuncio, planesCfg } from './limite.js';
import { pedirWorker } from './soporte.js';
import { rematarAuto } from './motor.js';
import { planDeHoy, planMotor, titularMotor } from './plan.js';
import { CHISTES, SOBRE_BLOQUEO, bloqueoTxt, avisoAlias, sistemaCorto as sistemaCortoDe } from './plan-sistema.js';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
// los de siempre, por si la lista de modelos de tu clave no llega
const BASE = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const diaGoogle = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
/** cuándo vuelve el cupo gratis: a medianoche en California (en España, las 9:00, o las 8:00 cuando un país ha
    cambiado la hora y el otro no) */
function vuelveCupo() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const pasado = ((+p.hour % 24) * 3600 + +p.minute * 60 + +p.second) * 1000;
  return cuando(Date.now() + 864e5 - pasado);
}

export const clave = () => leer('gemini') || '';
export const guardarClave = (k) => { guardar('gemini', (k || '').trim() || null); LS.del('ia-agotados'); LS.del('ia-modelos'); LS.del('ia-sin-web'); LS.del('ia-bueno'); LS.del('ia-mal-web'); LS.del('ia-pausa'); };
export const hayClave = () => !!clave();
// web: la búsqueda en Google en el chat (solo cuando hace falta); webPlan: también al hacer el plan (hasta 8 búsquedas:
// de 40 a 80 s en vez de 20 a 30, y es lo que más falla; apagada por defecto desde la 0.7c, las noticias y los onces ya van)
// La del chat, apagada por defecto desde la 0.7zc (revisión total, A3: las condiciones de la búsqueda de Google piden
// enseñar sus sugerencias tal cual y la app no lo hace). Quien la tenía guardada de antes pasa a apagada una vez (webV);
// si la vuelve a encender en Ajustes, se respeta.
export const cfgIA = () => {
  const g = LS.get('cfg-ia', {}) || {};
  return { modelo: '', web: false, webPlan: false, auto: true, ...g, ...(g.webV ? {} : { web: false }) };
};
export const guardarCfgIA = (c) => LS.set('cfg-ia', { ...cfgIA(), ...c, webV: 1 });

/** nombre bonito: gemini-3.8-flash-lite → Gemini 3.8 Flash-Lite */
export function nombreModelo(m) {
  if (!m) return '';
  return String(m).replace(/^models\//, '').split('-').map((p, i) => (i === 0 ? p[0].toUpperCase() + p.slice(1) : /^\d/.test(p) ? p : p[0].toUpperCase() + p.slice(1)))
    .join(' ').replace(/ Lite\b/, '-Lite').replace(/ It$/, '').replace(/ Preview.*$/, ' (preview)');
}
export const NOMBRES = new Proxy({}, { get: (_, m) => nombreModelo(m) });

/* ---------------- los modelos de tu clave ---------------- */
const fuera = () => { const a = LS.get('ia-agotados', {}), d = diaGoogle(); return Object.fromEntries(Object.entries(a).filter(([, v]) => v.d === d)); };
const sacar = (m, motivo) => { const a = fuera(); a[m] = { d: diaGoogle(), motivo }; LS.set('ia-agotados', a); };
const sinWebHoy = () => LS.get('ia-sin-web', null) === diaGoogle();

const esGemma = (m) => /^gemma/i.test(m);
const NO_VALE = /(embedding|aqa|imagen|tts|image|live|audio|robotics|computer|learnlm|veo|nano-banana|vision|exp-\d|thinking-exp|transcribe|customtools|argon)/i;
function orden(m) {
  const v = parseFloat((m.match(/-(\d+(?:\.\d+)?)/) || [])[1] || '0');
  const tipo = /flash-lite/.test(m) ? 1 : /flash/.test(m) ? 0 : /pro/.test(m) ? 2 : esGemma(m) ? 3 : 4;
  const tam = esGemma(m) ? parseFloat((m.match(/(\d+)b/) || [])[1] || '0') : 0;
  return tipo * 1000 - v * 10 - tam / 10 + (/preview|latest/.test(m) ? 2 : 0);
}
/* flash y flash-lite alternados (3.8 flash, 3.5 lite, 3.7 flash, 3.1 lite…) y detrás pro y gemma: cuando Google se satura,
   se saturan los flash a la vez y el que contesta es un lite (visto el 3 nov: cuatro flash con 503 seguidos, 5 min sin plan) */
const familia = (m) => (/flash-lite/.test(m) ? 'l' : /flash/.test(m) ? 'f' : 'o');
function alternar(lista) {
  const f = lista.filter((m) => familia(m) === 'f'), l = lista.filter((m) => familia(m) === 'l');
  const r = [];
  for (let i = 0; i < Math.max(f.length, l.length); i++) { if (f[i]) r.push(f[i]); if (l[i]) r.push(l[i]); }
  return [...r, ...lista.filter((m) => familia(m) === 'o')];
}

/** la lista de modelos que admite tu clave (no gasta cupo); se guarda un día */
export async function modelosDisponibles(k = clave(), forzar = false) {
  const guardado = LS.get('ia-modelos', null);
  if (!forzar && guardado && guardado.d === diaGoogle() && guardado.lista && guardado.lista.length) return guardado.lista;
  const r = await peticion('GET', `${GEMINI}/models?pageSize=1000`, null, (k || '').trim(), { limite: 25000 });
  const j = r.j || {};
  const lista = (j.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^(gemini|gemma)-/.test(n) && !NO_VALE.test(n))
    .sort((a, b) => orden(a) - orden(b));
  LS.set('ia-modelos', { d: diaGoogle(), lista });
  return lista;
}
export const probarClave = (k) => modelosDisponibles(k, true);

/* los modelos que acaban de fallar por algo pasajero (el límite por minuto, un permiso) se saltan un rato: así la
   siguiente pregunta no vuelve a esperar por ellos */
const pausas = () => { const p = LS.get('ia-pausa', {}), a = Date.now(); return Object.fromEntries(Object.entries(p).filter(([, t]) => t > a)); };
const pausar = (m, seg) => { const p = pausas(); p[m] = Date.now() + seg * 1000; LS.set('ia-pausa', p); };
/* el modelo que contestó bien la última vez va el primero durante un día (los nuevos suelen estar saturados y cada intento
   con ellos cuesta de 20 s a minutos; con 3 horas se volvía a tropezar con ellos varias veces al día); si falla, el siguiente
   que conteste bien ocupa su sitio. Pasado el día se vuelve a probar el orden de siempre */
const BUENO_H = 24 * 3600 * 1000;
/* el relevo: a los 40 s sin respuesta (lo normal son 15-30 s) se pregunta también a otro modelo; si el plan va con la
   búsqueda puesta a propósito se le dan 50 s, que con ella lo normal es tardar más y si no, el relevo sin búsqueda le
   ganaría casi siempre (en el chat, 40 s aunque tenga la búsqueda: una respuesta rápida vale más que una buscada).
   (revisión total, M5) Uno solo a la vez: antes, a los 25 s, y cada 20 s otro más en paralelo (hasta 3), cada uno con el
   prompt entero (33-37 mil tokens del cupo gratis). Ahora, si el relevo falla, deja paso a otro, pero nunca dos a la vez */
const RELEVO_MS = 40000, RELEVO_WEB_MS = 50000, SILENCIO_MS = 30000;
/* el tiempo máximo de cada intento: sin búsqueda, 60 s (si en 60 s no ha contestado, no va a contestar: es Google haciendo
   cola, y un 503 puede tardar 150 s en llegar); con búsqueda, 90 s; un pro, 120 s. Todo junto, 3 minutos */
const TOPE_MS = 60000, TOPE_WEB_MS = 90000, TOPE_PRO_MS = 120000, TOTAL_MS = 180000;
/* un modelo que con la búsqueda contesta con una llamada rota (MALFORMED_FUNCTION_CALL) va una hora sin ella */
const malConWeb = (m) => (LS.get('ia-mal-web', {})[m] || 0) > Date.now();
const marcarMalConWeb = (m) => { const a = LS.get('ia-mal-web', {}); a[m] = Date.now() + 3600 * 1000; LS.set('ia-mal-web', a); };
const recordarBueno = (m) => { const b = LS.get('ia-bueno', null); LS.set('ia-bueno', { m, desde: b && b.m === m && Date.now() - b.desde < BUENO_H ? b.desde : Date.now() }); };
/** ha llegado al tope escribiendo blancos (un carácter por token): respuesta en bucle */
const enBucle = (r) => !!(r && r.fin === 'MAX_TOKENS' && r.tok && r.tok.r > 3000 && r.texto.length < r.tok.r * 2);
async function cadena() {
  let lista;
  try { lista = await modelosDisponibles(); } catch (e) { if (e.estado === 400 || e.estado === 401 || e.estado === 403) throw e; lista = BASE; }
  if (!lista.length) lista = BASE;
  const elegido = cfgIA().modelo;
  const todos = [...new Set([...(elegido ? [elegido] : []), ...alternar(lista)])];
  const f = fuera();
  const vivos = todos.filter((m) => !f[m]);
  const pz = pausas();
  const sinPausa = vivos.filter((m) => !pz[m]);
  const orden2 = sinPausa.length ? sinPausa : vivos;
  const b = LS.get('ia-bueno', null);
  if (b && !elegido && Date.now() - b.desde < BUENO_H && orden2.includes(b.m)) return [b.m, ...orden2.filter((m) => m !== b.m)];
  return orden2;
}

/* ---------------- errores de Google ---------------- */
class ErrorIA extends Error {
  constructor(m, estado, info = {}) { super(m); this.estado = estado; Object.assign(this, info); }
}
function errorDe(estado, j) {
  const e0 = (j && j.error) || {}, m = e0.message || '', det = JSON.stringify(e0.details || '');
  const todo = m + ' ' + det;
  const info = { google: m.slice(0, 260) };
  const ri = (e0.details || []).find((d) => /RetryInfo/.test(d['@type'] || ''));
  if (ri && ri.retryDelay) info.espera = parseFloat(ri.retryDelay);
  if (/API key not valid|API_KEY_INVALID/i.test(todo)) return new ErrorIA('Google dice que la clave no es válida. Cópiala otra vez entera desde aistudio.google.com/apikey.', estado, { ...info, clave: true });
  if (estado === 401 || (estado === 403 && /PERMISSION_DENIED|SERVICE_DISABLED|has not been used/i.test(todo))) return new ErrorIA('Google no deja usar la IA con esta clave. Crea otra en aistudio.google.com/apikey (mejor en un proyecto nuevo).', estado, { ...info, clave: estado === 401 || /SERVICE_DISABLED|has not been used|API_KEY_SERVICE_BLOCKED/i.test(todo) });
  if (estado === 404) return new ErrorIA('Ese modelo no existe para tu clave', 404, info);
  if (estado === 429) {
    const busqueda = /search|grounding/i.test(todo);
    const minuto = /per.?minute|PerMinute|retry in \d+(\.\d+)?s/i.test(todo) && !/per.?day|PerDay/i.test(todo);
    const cero = /limit:\s*0\b/.test(todo);
    return new ErrorIA(busqueda ? 'Se ha acabado la búsqueda en Google gratis de hoy' : cero ? 'Este modelo no tiene cupo gratis' : minuto ? 'Demasiadas preguntas seguidas' : 'Cupo gratis del día gastado', 429, { ...info, busqueda, minuto, cero });
  }
  if (estado >= 500) return new ErrorIA('Google está saturado ahora mismo', estado, info);
  // lo demás, con un mensaje nuestro: el de Google va solo al diagnóstico (info.google), que puede llevar el modelo
  return new ErrorIA(`La IA de Google ha dado un error${estado ? ` (${estado})` : ''}. Prueba otra vez en un rato.`, estado, info);
}

/* el registro de intentos, para Ajustes → Diagnóstico */
export const intentosIA = [];
const apuntar = (x) => { intentosIA.unshift({ t: Date.now(), ...x }); if (intentosIA.length > 60) intentosIA.length = 60; };

/** (sesión 8, M9) el motivo de un corte, en castellano: el navegador lo da en inglés («Failed to fetch», «Load failed»…) */
const motivoRed = (m) => (/failed to fetch|networkerror|load failed|network request failed|internet_disconnected|err_network|name_not_resolved/i.test(String(m || '')) ? 'no hay conexión'
  : /time ?out|timed out/i.test(String(m || '')) ? 'tiempo agotado' : String(m || 'sin respuesta'));
const SIN_RED = 'No hay conexión con Google';
/**
 * Una petición a Google. En la app va por la parte nativa (el WebView corta los POST a Google con «Failed to fetch»);
 * en el navegador, con fetch. Devuelve { j } con el JSON o { r } con la respuesta en streaming (solo navegador).
 */
async function peticion(metodo, url, cuerpo, k = clave(), { stream = false, signal, limite = 150000 } = {}) {
  const sinTiempo = (m) => new ErrorIA(`${SIN_RED} (${motivoRed(m)})`, 0, { red: true, tiempo: true });
  if (enApp) {
    const pet = http(metodo, url, { cabeceras: { 'content-type': 'application/json', 'x-goog-api-key': k }, cuerpo: cuerpo == null ? null : JSON.stringify(cuerpo), tiempo: limite });
    // el tiempo de la parte nativa es por lectura, no total: un 503 de Google llegó a tardar 150 s con un límite de 90.
    // Aquí se corta de verdad (la respuesta, si llega después, se tira); y si lo paras, se deja de esperar al momento
    let quitarReloj = () => {};
    const carrera = [pet, new Promise((res) => { quitarReloj = despues(limite + 2000, () => res({ s: 0, e: 'tiempo agotado' })); })];
    if (signal) carrera.push(new Promise((_, mal) => {
      const parar = () => mal(new DOMException('Parado', 'AbortError'));
      if (signal.aborted) parar(); else signal.addEventListener('abort', parar, { once: true });
    }));
    let r;
    try { r = await Promise.race(carrera); } finally { quitarReloj(); }
    if (r.s === 0) {
      // (solo el tiempo máximo que cuenta la app; un «connect timed out» de la conexión es cobertura, no un modelo lento)
      if (r.e === 'tiempo agotado') throw sinTiempo('tiempo agotado');
      throw new ErrorIA(`${SIN_RED} (${motivoRed(r.e)})`, 0, { red: true, dns: !!r.dns });
    }
    let j = null;
    try { j = JSON.parse(r.b || 'null'); } catch (e) { j = null; }
    if (r.s >= 400) throw errorDe(r.s, j);
    if (!j) throw new ErrorIA(`Respuesta rara de Google (${r.s})`, r.s);
    return { j };
  }
  // en el navegador, el mismo tiempo máximo: si Google no contesta, se corta (y es distinto de que lo pares tú)
  const ctl = new AbortController();
  let vencido = false, sigue = false;
  const quitarReloj = despues(limite, () => { vencido = true; ctl.abort(); });
  const parar = () => ctl.abort();
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', parar, { once: true }); }
  try {
    let r;
    try {
      r = await fetch(url, { method: metodo, signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': k }, body: cuerpo == null ? undefined : JSON.stringify(cuerpo) });
    } catch (e) {
      if (e.name === 'AbortError') { if (vencido) throw sinTiempo('tiempo agotado'); throw e; }
      throw new ErrorIA(`${SIN_RED} (${motivoRed(e.message)})`, 0, { red: true });
    }
    if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { /* nada */ } throw errorDe(r.status, j); }
    // en directo, el cuerpo se sigue leyendo después (lo lee llamar): parar la pregunta lo sigue cortando y el tiempo
    // máximo sigue contando hasta que llega el primer trozo (llamar lo quita entonces y vigila los silencios)
    if (stream) {
      sigue = true;
      return { r, cortar: () => ctl.abort(), vencido: () => vencido, quitarTotal: quitarReloj, fin: () => { quitarReloj(); if (signal) signal.removeEventListener('abort', parar); } };
    }
    try { return { j: await r.json() }; } catch (e) { if (e.name === 'AbortError' && vencido) throw sinTiempo('tiempo agotado'); throw e; }
  } finally {
    if (!sigue) { quitarReloj(); if (signal) signal.removeEventListener('abort', parar); }
  }
}

async function llamar(modelo, cuerpo, { stream = false, alTexto = null, signal, limite } = {}) {
  // en la app no hay streaming: llega la respuesta entera de una vez
  const enVivo = stream && !enApp;
  const url = `${GEMINI}/models/${modelo}:${enVivo ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  const resp = await peticion('POST', url, cuerpo, clave(), { stream: enVivo, signal, limite });
  let texto = '', fuentes = [], fin = null, bloqueo = null, tok = null;
  const procesar = (j) => {
    if (j.promptFeedback && j.promptFeedback.blockReason) bloqueo = j.promptFeedback.blockReason;
    // lo que ha gastado: lo que le mandas, lo que escribe y lo que piensa (para el diagnóstico)
    const u = j.usageMetadata;
    if (u) tok = { p: u.promptTokenCount || 0, r: u.candidatesTokenCount || 0, th: u.thoughtsTokenCount || 0 };
    const c = (j.candidates || [])[0] || {};
    for (const p of (c.content && c.content.parts) || []) if (p.text && !p.thought) { texto += p.text; if (alTexto) alTexto(sinWebs(texto)); }
    const g = c.groundingMetadata;
    if (g && g.groundingChunks) fuentes.push(...g.groundingChunks.map((x) => x.web).filter((w) => w && w.uri).map((w) => ({ t: w.title || w.uri, u: w.uri })));
    if (c.finishReason) fin = c.finishReason;
  };
  if (!enVivo) procesar(resp.j);
  else {
    const lector = resp.r.body.getReader(), dec = new TextDecoder();
    let buf = '', silencio = false, quitarS = () => {};
    // con el texto llegando, lo que corta es un silencio de 30 s (un modelo que escribe un trozo y se cuelga)
    const rearmar = () => { quitarS(); quitarS = despues(SILENCIO_MS, () => { silencio = true; resp.cortar(); }); };
    try {
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resp.quitarTotal(); rearmar();
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const linea = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!linea.startsWith('data:')) continue;
          try { procesar(JSON.parse(linea.slice(5))); } catch (e) { /* trozo incompleto */ }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError' && (silencio || resp.vencido())) throw new ErrorIA(`${SIN_RED} (tiempo agotado)`, 0, { red: true, tiempo: true });
      if (e.name === 'AbortError') throw e;
      throw new ErrorIA(`Se ha cortado la respuesta de Google (${e.message})`, 0, { red: true });
    } finally { quitarS(); resp.fin(); }
    if (buf.trim().startsWith('data:')) { try { procesar(JSON.parse(buf.trim().slice(5))); } catch (e) { /* nada */ } }
    // cerrado sin «fin»: se ha cortado a medias; lo que ha llegado no vale como respuesta
    if (!fin && texto.trim()) throw new ErrorIA('Se ha cortado la respuesta de Google a medias', 0, { red: true });
  }
  if (!texto.trim()) throw new ErrorIA(bloqueo ? `Google ha bloqueado la pregunta (${bloqueo})` : `El modelo ha contestado vacío${fin ? ` (${fin}${tok && tok.th ? `, ${tok.th} tokens pensando` : ''})` : ''}`, 0, { vacio: true, fin });
  const vistas = new Set();
  fuentes = fuentes.filter((f) => !esWebFantasy(f.t) && !esWebFantasy(f.u) && !vistas.has(f.u) && vistas.add(f.u));
  return { texto: sinWebs(texto), fuentes, fin, tok };
}

const espera = (s, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) { rej(new DOMException('Parado', 'AbortError')); return; }
  const quitar = despues(s * 1000, res);
  if (signal) signal.addEventListener('abort', () => { quitar(); rej(new DOMException('Parado', 'AbortError')); }, { once: true });
});

/**
 * Pregunta con todos los modelos que haga falta. Por cada modelo: con búsqueda en Google; si la búsqueda se ha
 * acabado, sin ella; si es el cupo por minuto, espera lo que diga Google y repite; si es el del día, al siguiente.
 * alPaso(texto) cuenta lo que va pasando (para enseñarlo mientras piensa).
 */
async function preguntar(q, op = {}) {
  // con alias (op.seudo): lo que sale hacia Google va tapado y lo que vuelve, destapado
  const sd = op.seudo && op.seudo.n ? op.seudo : null;
  if (!sd) return preguntarYa(q, op);
  const tapC = (cs) => cs && cs.map((c) => ({ ...c, parts: (c.parts || []).map((p) => (p.text ? { ...p, text: sd.tapar(p.text) } : p)) }));
  const q2 = {
    sistema: sd.tapar(q.sistema) + sd.aviso,
    sistemaSinWeb: q.sistemaSinWeb ? sd.tapar(q.sistemaSinWeb) + sd.aviso : q.sistemaSinWeb,
    contents: tapC(q.contents), contentsSinWeb: tapC(q.contentsSinWeb),
  };
  const r = await preguntarYa(q2, { ...op, alTexto: op.alTexto ? (t) => op.alTexto(sd.destapar(t)) : op.alTexto });
  return { ...r, texto: sd.destapar(r.texto, { json: !!op.seudoJSON }), fuentes: r.fuentes, alias: sd.n };
}

/* (revisión total, M5) lo que vale para cada familia: la 3.x va sin temperatura (Google recomienda dejarla en 1,0 y avisa de
   bucles y respuestas peores por debajo) y piensa con thinkingLevel; la 2.5 no conoce thinkingLevel y va con su presupuesto
   (thinkingBudget); las 2.0 y Gemma no piensan. La temperatura que se pide solo se pone a las de antes de la 3 */
export function configDe(modelo, pensar, nivel = 'low', temperatura = 0.6) {
  const m = String(modelo || '');
  const tres = /^gemini-[3-9]/.test(m);
  const c = {};
  if (!tres && temperatura != null) c.temperature = temperatura;
  if (pensar && tres) c.thinkingConfig = { thinkingLevel: nivel };
  else if (pensar && /^gemini-2\.5/.test(m)) c.thinkingConfig = { thinkingBudget: nivel === 'low' ? 1024 : 4096 };
  return c;
}
async function preguntarYa({ sistema, sistemaSinWeb, contents, contentsSinWeb }, op = {}) {
  // (el tope de tiempo cuenta desde aquí, con lo que tarde en saber qué modelos tiene tu clave)
  const inicio = Date.now(), total = op.total || TOTAL_MS;
  const resta = () => total - (Date.now() - inicio);
  const segundos = () => Math.round((Date.now() - inicio) / 1000);
  // lo que va pasando, con los segundos que lleva (a partir de 3 s, y el contador sigue solo cada segundo: que se vea
  // que está vivo mientras piensa, que en la app no llega texto hasta el final)
  let pasoTxt = '', quitarTic = () => {};
  const conSeg = (t) => (t && segundos() >= 3 ? `${t} ${segundos()} s` : t);
  const alPaso = (t) => { pasoTxt = t; if (op.alPaso) op.alPaso(conSeg(t)); };
  const tic = () => { quitarTic = despues(1000, () => { if (pasoTxt && op.alPaso && !viendoTexto) op.alPaso(conSeg(pasoTxt)); tic(); }); };
  let modelos = await cadena();
  // con fotos solo valen los Gemini (los Gemma no ven imágenes)
  const conFotos = (contents || []).some((c) => (c.parts || []).some((p) => p.inlineData));
  if (conFotos && modelos.length) {
    modelos = modelos.filter((m) => !esGemma(m));
    if (!modelos.length) throw new ErrorIA(`Hoy ya se ha gastado el cupo gratis de la IA para mirar fotos. Pregúntalo sin la foto o vuelve ${vuelveCupo()}.`, 429, { todos: true });
  }
  if (!modelos.length) {
    const f = fuera();
    throw new ErrorIA(`La IA ya ha gastado el cupo gratis de hoy de tu clave. Vuelve ${vuelveCupo()}.`, 429, { todos: true });
  }
  // la búsqueda: lo que diga quien pregunta (el plan, con su ajuste) o, si no dice nada, el ajuste del chat
  const quiereWeb = op.web != null ? !!op.web : cfgIA().web;
  const resumen = [];
  let ultimo = null;
  let cortes = 0, webSospecha = null, tiempos = 0, saturados = 0;
  // Google a veces se queda sin contestar (con la búsqueda y un modelo saturado, minutos): cada intento tiene su tiempo máximo
  // y todo junto no pasa de unos 4 minutos; el modelo que no contesta se salta y los siguientes van sin búsqueda.
  // Sin búsqueda, ni el sistema ni la pregunta le mandan buscar (si se lo mandan, a veces llama a una herramienta que no
  // tiene y contesta vacío)
  const cuerpoDe = (modelo, web, pensar, nivel) => {
    const cont = !web && contentsSinWeb ? contentsSinWeb : contents;
    const sis = !web && sistemaSinWeb ? sistemaSinWeb : sistema;
    return esGemma(modelo)
      ? { contents: [{ role: 'user', parts: [{ text: `${sis}\n\n---\n\n${cont.map((c) => `${c.role === 'model' ? 'ASISTENTE' : 'MANAGER'}: ${c.parts.map((p) => p.text).filter(Boolean).join('\n')}`).join('\n\n')}` }] }], generationConfig: { maxOutputTokens: 8192, temperature: op.temperatura ?? 0.6 } }
      : { systemInstruction: { parts: [{ text: sis }] }, contents: cont, ...(web ? { tools: [{ google_search: {} }] } : {}), generationConfig: { maxOutputTokens: op.maxTokens || 16000, ...configDe(modelo, pensar, nivel, op.temperatura), ...(op.esquema && !web && !sinEsquema.has(modelo) ? { responseMimeType: 'application/json', responseSchema: op.esquema } : {}) } };
  };
  // (revisión total, M5) un modelo que rechaza el esquema JSON: sin él el resto de la pregunta
  const sinEsquema = new Set();
  // cada petición con su propio «parar», que también salta si paras la pregunta: así la que pierde la carrera se corta
  const ramal = () => {
    const ctl = new AbortController();
    if (op.signal) { if (op.signal.aborted) ctl.abort(); else op.signal.addEventListener('abort', () => ctl.abort(), { once: true }); }
    return ctl;
  };
  /* El relevo: si un modelo lleva 40 s sin contestar (50 con la búsqueda), se pregunta también al siguiente modelo sano, sin
     búsqueda, y vale la primera respuesta que llegue. Nunca hay más de un relevo en marcha: si falla, deja paso a otro (dos
     como mucho). Una vez por pregunta. Así un modelo colgado o un 503 que tarda minutos en llegar no dejan sin plan. */
  let relevo = null, viendoTexto = false, cerrado = false;
  const saltar = new Set();
  const siguienteSano = (actual) => { const pz = pausas(); return modelos.slice(modelos.indexOf(actual) + 1).find((m) => !esGemma(m) && !pz[m] && !saltar.has(m)) || null; };
  const conRelevo = (modelo, pr, ctlA, conWeb) => new Promise((res, rej) => {
    let fin = false, quitar = () => {}, ctlR = null;
    // acabe como acabe, lo que quede en marcha del relevo se corta (el que ha ganado ya ha contestado)
    const ganar = (x) => { if (fin) return; fin = true; quitar(); if (x.deRelevo) ctlA.abort(); if (ctlR) ctlR.abort(); res(x); };
    const perder = (e) => { if (fin) return; fin = true; quitar(); if (ctlR) ctlR.abort(); rej(e); };
    if (!relevo) {
      quitar = despues(conWeb ? RELEVO_WEB_MS : RELEVO_MS, () => {
        if (fin || relevo || viendoTexto || resta() < 30000) return;
        ctlR = ramal();
        relevo = { p: new Promise((listo) => {
          let desde = modelo, lanzados = 0, vivos = 0, acabado = false, quitarEscalon = () => {};
          const acabar = (x) => { if (acabado) return; acabado = true; quitarEscalon(); listo(x); };
          const lanzar = () => {
            if (acabado) return;
            const otro = !fin && lanzados < 2 && !vivos && resta() >= 25000 ? siguienteSano(desde) : null;
            if (!otro) { if (!vivos) acabar({ e: null }); return; }
            desde = otro; lanzados++; vivos++;
            alPaso(lanzados > 1 ? 'La IA tarda: pruebo con otra versión más…' : 'La IA tarda: pruebo también con otra versión…');
            const t1 = Date.now(), pensarO = !/gemini-(1|2\.0)/.test(otro);
            llamar(otro, cuerpoDe(otro, false, pensarO, 'low'), { signal: ctlR.signal, limite: Math.max(20000, Math.min(TOPE_MS, resta() - 5000)) }).then((r) => {
              vivos--;
              apuntar({ modelo: otro, web: false, ok: true, ms: Date.now() - t1, fin: r.fin, tok: r.tok, car: r.texto.length, nivel: pensarO ? 'low' : null, relevo: true });
              acabar({ r, modelo: otro });
            }, (e) => {
              vivos--;
              if (e.name === 'AbortError') { if (!vivos) acabar({ e }); return; }
              apuntar({ modelo: otro, web: false, s: e.estado, e: e.message, google: e.google, ms: Date.now() - t1, nivel: pensarO ? 'low' : null, relevo: true });
              saltar.add(otro);
              if (e.estado === 429 && !e.minuto) sacar(otro, e.message);
              else if (e.estado >= 500 || e.tiempo) pausar(otro, e.tiempo ? 600 : 300);
              // el que falla deja paso al siguiente al momento
              lanzar();
            });
          };
          lanzar();
        }) };
        relevo.p.then((x) => { if (x.r && !viendoTexto) ganar({ ...x.r, deRelevo: x.modelo }); });
      });
    }
    pr.then(ganar, (e) => {
      // la has parado tú: nada de esperar al relevo
      if (e && e.name === 'AbortError') { perder(e); return; }
      // el que se esperaba falla con el relevo en marcha: se espera al relevo
      if (relevo && !fin) relevo.p.then((x) => (x.r ? ganar({ ...x.r, deRelevo: x.modelo, principal: e }) : perder(x.e && x.e.name === 'AbortError' ? x.e : e)));
      else perder(e);
    });
  });
  // si con búsqueda da «cupo gastado» y sin ella el mismo modelo sí contesta, lo gastado es la búsqueda: fuera hoy
  // (solo si contesta: un 503 o un vacío sin búsqueda no dicen nada de la búsqueda)
  const confirmarSinWeb = (modelo) => { if (webSospecha === modelo) LS.set('ia-sin-web', diaGoogle()); webSospecha = null; };
  tic();
  try {
    for (const modelo of modelos) {
      if (saltar.has(modelo)) continue;
      let web = quiereWeb && !sinWebHoy() && !esGemma(modelo) && !tiempos && !malConWeb(modelo);
      let pensar = !esGemma(modelo) && !/gemini-(1|2\.0)/.test(modelo);
      // pensar a medias: contesta en la mitad de tiempo y el plan sale igual de bien; los pro, lo justo
      let nivel = op.nivel || (/pro/.test(modelo) ? 'low' : 'medium');
      let esperado = false;
      for (let intento = 0; intento < 5; intento++) {
        if (op.signal && op.signal.aborted) throw new DOMException('Parado', 'AbortError');
        const restante = resta();
        if (ultimo && restante < 25000) throw new ErrorIA(`Google tarda demasiado en contestar ahora mismo (llevo ${Math.round((Date.now() - inicio) / 1000)} s probando). Vuelve a probar en unos minutos.`, 0, { tarda: true, todos: true });
        const limite = Math.max(25000, Math.min(/pro/.test(modelo) ? TOPE_PRO_MS : web ? TOPE_WEB_MS : TOPE_MS, restante));
        const cuerpo = cuerpoDe(modelo, web, pensar, nivel);
        // lo que escribió un intento que se ha cortado no se queda en pantalla
        if (viendoTexto && op.alTexto) op.alTexto('');
        viendoTexto = false;
        alPaso(`La IA está pensando${web ? ' y buscando en Google' : ''}…`);
        const t0 = Date.now();
        const ctlA = ramal();
        try {
          const r = await conRelevo(modelo, llamar(modelo, cuerpo, { ...op, signal: ctlA.signal, limite, alTexto: op.alTexto ? (t) => { if (cerrado) return; viendoTexto = true; op.alTexto(t); } : null }), ctlA, web && !!op.web);
          if (r.deRelevo) {
            // ha contestado antes el relevo: el lento se salta un rato y el que ha contestado va el primero la próxima vez
            if (r.principal) apuntar({ modelo, web, s: r.principal.estado, e: r.principal.message, google: r.principal.google, ms: Date.now() - t0, nivel: pensar ? nivel : null });
            else apuntar({ modelo, web, s: 'relevo', e: `sin contestar en ${Math.round((Date.now() - t0) / 1000)} s: ha contestado antes ${r.deRelevo}`, ms: Date.now() - t0, nivel: pensar ? nivel : null });
            pausar(modelo, 600);
            if (enBucle(r)) pausar(r.deRelevo, 3600); else recordarBueno(r.deRelevo);
            return { ...r, modelo: r.deRelevo, web: false, intentos: resumen };
          }
          // (0.7.8b) en bucle: ha llegado al tope escribiendo blancos o un carácter por token (13 nov, gemini-3.6-flash:
          // 32.010 caracteres en 31.984 tokens). No cuenta como bueno y descansa una hora: la segunda vuelta va con otro
          const bucle = enBucle(r);
          apuntar({ modelo, web, ok: true, ms: Date.now() - t0, fin: bucle ? 'MAX_TOKENS en bucle' : r.fin, tok: r.tok, car: r.texto.length, nivel: pensar ? nivel : null });
          if (!web) confirmarSinWeb(modelo); else webSospecha = null;
          if (bucle) pausar(modelo, 3600);
          else recordarBueno(modelo);
          return { ...r, modelo, web, intentos: resumen };
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          ultimo = e;
          apuntar({ modelo, web, s: e.estado, e: e.message, google: e.google, ms: Date.now() - t0, nivel: pensar ? nivel : null });
          if (e.clave) throw e;
          if (webSospecha === modelo && !web) webSospecha = null;
          // si se ha agotado el tiempo esperando la respuesta, repetir lo mismo vuelve a tardar igual: se le pide
          // que piense menos (y, si ya era poco, sin búsqueda)
          if (e.tiempo) {
            tiempos++;
            const seg = Math.round(limite / 1000);
            if (pensar && nivel !== 'low') { nivel = 'low'; intento--; alPaso(`La IA tarda más de ${seg} s: se lo pido pensando menos…`); continue; }
            // repetirle lo mismo sin búsqueda volvía a tardar otro minuto largo: se salta un rato (las siguientes preguntas
            // no esperan por él) y se prueba con otro, ya sin búsqueda (`tiempos`)
            pausar(modelo, 600);
            resumen.push(`${nombreModelo(modelo)}: no contesta (más de ${seg} s)`);
            alPaso('La IA no contesta: pruebo con otra versión…');
            break;
          }
          // se ha cortado la conexión (cambio de red, cobertura, Android cortando a la app): se espera y se repite
          // con el mismo modelo, sin gastar sus intentos, hasta 4 veces en total (si queda tiempo)
          if (e.red && cortes < 4 && resta() > [3, 6, 10, 15][cortes] * 1000 + 25000) {
            cortes++; intento--;
            alPaso(`Se ha cortado la conexión con Google. Vuelvo a probar (${cortes}/4)…`);
            await espera([3, 6, 10, 15][cortes - 1], op.signal);
            continue;
          }
          if (e.estado === 400 && op.esquema && !sinEsquema.has(modelo) && /schema|mime|json/i.test(e.google || e.message)) { sinEsquema.add(modelo); intento--; continue; }
          if (e.estado === 400 && pensar && nivel !== 'low' && /thinking|thought|level/i.test(e.google || e.message)) { nivel = 'low'; continue; }
          if (e.estado === 400 && pensar && /thinking|thought|level/i.test(e.google || e.message)) { pensar = false; continue; }
          if (e.estado === 400 && web && /search|tool|grounding/i.test(e.google || e.message)) { web = false; continue; }
          if (e.estado === 400 && /system|developer instruction/i.test(e.google || '')) { sacar(modelo, 'no admite instrucciones'); break; }
          // «limit: 0»: este modelo no tiene cupo gratis con tu clave, ni hoy ni mañana: fuera sin esperar
          if (e.estado === 429 && e.cero) { sacar(modelo, e.message); resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
          if (e.estado === 429 && e.busqueda && web) { LS.set('ia-sin-web', diaGoogle()); web = false; continue; }
          if (e.estado === 429 && web && !e.minuto) { web = false; webSospecha = modelo; continue; } // por si el cupo que falta es el de la búsqueda y Google no lo dice
          if (e.estado === 429 && e.minuto && !esperado && (e.espera || 20) <= 45 && resta() > (e.espera || 20) * 1000 + 30000) { esperado = true; alPaso(`Esperando ${Math.ceil(e.espera || 20)} s a que Google deje volver a preguntar…`); await espera(e.espera || 20, op.signal); continue; }
          // el límite por minuto pasa en un rato: se prueba con el siguiente modelo, pero este no se da por gastado hoy
          if (e.estado === 429 && e.minuto) { pausar(modelo, 90); resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
          if (e.estado === 429 || e.estado === 404) { sacar(modelo, e.message); resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
          // un 400 o un 403 suele ser de la pregunta (una foto rota, demasiado larga) y no del modelo: siguiente, sin
          // darlo por gastado hoy (antes una foto rota dejaba sin IA hasta el día siguiente)
          if (e.estado === 403 || e.estado === 400) { if (e.estado === 403) pausar(modelo, 30 * 60); resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
          // vacío porque se le ha ido todo pensando: otra vez, pensando menos
          if (e.vacio && e.fin === 'MAX_TOKENS' && pensar && nivel !== 'low') { nivel = 'low'; alPaso('Se ha quedado sin sitio pensando: lo pido pensando menos…'); continue; }
          // una llamada a la herramienta de búsqueda mal hecha (MALFORMED_FUNCTION_CALL): repetirlo igual falla igual (y tarda minutos);
          // sin búsqueda, o si ya iba sin ella, el siguiente modelo
          if (e.vacio && /MALFORMED|TOOL|FUNCTION/i.test(e.fin || '')) {
            if (web) { marcarMalConWeb(modelo); web = false; intento--; alPaso('La búsqueda en Google ha fallado: lo pido sin ella…'); continue; }
            resumen.push(`${nombreModelo(modelo)}: respuesta rota (${e.fin})`);
            alPaso('La IA ha contestado mal: pruebo con otra versión…');
            break;
          }
          if (e.vacio && intento < 1) continue;
          if (e.vacio) { resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
          // saturado («high demand»): repetirle la pregunta al mismo modelo da otro 503 (el 3 nov, hasta 150 s cada uno);
          // se salta 5 min y va el siguiente, que con `alternar` es de la otra familia (un flash-lite si este era flash)
          if (e.estado === 503 || /high demand|overloaded|UNAVAILABLE/i.test(e.google || '')) {
            saturados++;
            pausar(modelo, 300);
            resumen.push(`${nombreModelo(modelo)}: saturado`);
            const otro = modelos.slice(modelos.indexOf(modelo) + 1).find((m) => !saltar.has(m) && !pausas()[m]);
            if (otro) alPaso('La IA está saturada: pruebo con otra versión…');
            break;
          }
          if ((e.estado >= 500 || e.estado === 0 || e.estado == null) && intento < 2 && resta() > 2500 * (intento + 1) + 25000) { await espera(2.5 * (intento + 1), op.signal); continue; }
          if (e.red) {
            resumen.push(`sin conexión con Google (${e.message})`);
            throw new ErrorIA(`Se ha cortado la conexión con Google ${cortes + 1} veces seguidas (${e.message.replace(/^No hay conexión con Google \((.*)\)$/, '$1')}). Mira que tengas internet (prueba con datos si estás con wifi) y vuelve a probar.`, 0, { red: true });
          }
          if (e.estado >= 500) pausar(modelo, 300);
          resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`);
          break;
        }
      }
    }
  } finally {
    // lo que llegue después de contestar (la petición que ha perdido la carrera) ya no se pinta
    cerrado = true;
    quitarTic();
  }
  if (saturados && saturados >= resumen.length - 1) throw new ErrorIA('La IA de Google está saturada ahora mismo. No es tu clave ni tu conexión; suele pasar en unos minutos. Vuelve a probar en un rato.', 503, { todos: true, saturado: true });
  throw new ErrorIA('La IA no ha podido contestar ahora; prueba en un rato.', ultimo ? ultimo.estado : 0, { todos: true, detalle: `${resumen.slice(0, 4).join(' · ')}${resumen.length > 4 ? ` y ${resumen.length - 4} más` : ''}${ultimo && ultimo.google ? ` · Google: «${ultimo.google.slice(0, 140)}»` : ''}` });
}

/* ---------------- todo lo que la IA sabe de tu liga ---------------- */
const m1 = (v) => (v == null ? '?' : eur(v));
/** el dinero de un rival: exacto o estimado con su margen */
/* (revisión total, M4) con una función top cerrada la IA no recibe sus cifras, solo una categoría: así no las puede soltar
   aunque se le pregunte (antes iban enteras con un «úsalo pero no lo cuentes»). Dinero de un rival, sobre el valor de su
   equipo; quién paga una cláusula tuya, «le sobra / justo / no le llega» sin nombres; la inercia, sin días ni proyección */
const dineroCat = (d, valor) => {
  if (!d || d.v == null) return 'dinero: no se sabe';
  const v = +d.v, base = +valor || 0;
  const c = v < 0 ? 'en negativo' : !base ? (v > 0 ? 'tiene algo' : 'a cero') : v < base * 0.05 ? 'poco' : v < base * 0.2 ? 'algo' : 'mucho';
  return `dinero: ${c} (función top cerrada: sin cifra)`;
};
const dineroDe = (d, valor) => (bloqueada('dineroRivales') ? dineroCat(d, valor) : dineroTxt(d));
const dineroTxt = (d) => (!d || d.v == null ? `dinero: no se sabe${d && d.motivo ? ` (${d.motivo})` : ''}` : d.exacto ? `dinero ${eur(d.v)} (exacto)` : d.dicho ? `dinero ≈ ${eur(d.v)} ± ${eur(d.margen)} (me dijo lo que tenía ${cuando(d.dicho.t)}, más lo que ha movido desde entonces)` : `dinero ≈ ${eur(d.v)} ± ${eur(d.margen)} (estimado con todos sus movimientos y sus subidas de cláusula)`);
/** quién puede pagar una cláusula tuya */
const paganTxt = (p) => {
  if (p && bloqueada('quienPaga')) {
    if (p.seguro.length) return 'a algún rival le sobra el dinero para pagarla';
    if (p.quiza.length) return 'a algún rival le llega justo';
    return p.hayDatos ? 'no le llega a ningún rival' : (p.sinSaber.length ? 'no se sabe el dinero de algunos rivales' : null);
  }
  if (!p || (!p.seguro.length && !p.quiza.length && !p.hayDatos)) return p && p.sinSaber.length ? `no se sabe el dinero de ${p.sinSaber.length} rivales` : null;
  if (!p.seguro.length && !p.quiza.length) return `no le llega a ningún rival${p.sinSaber.length ? ` de los que se sabe el dinero (de ${p.sinSaber.map((x) => x.nombre).join(', ')} no)` : ''}`;
  return `le llega a: ${[...p.seguro.map((x) => `${x.nombre} (le sobra)`), ...p.quiza.map((x) => `${x.nombre} (justo)`)].join(', ')}${p.sinSaber.length ? `; de ${p.sinSaber.map((x) => x.nombre).join(', ')} no se sabe` : ''}`;
};
/** el blindaje justo, si compensa */
const blindajeTxt = (b) => {
  if (!b || b.yaVale) return null;
  const por = b.porTecho ? `en esta liga nadie suele pagar más de un ${pct(b.techoPct * 100, 0)} sobre el valor por una cláusula, así que con ${eur(b.objetivo)} estaría a salvo` : `con ${eur(b.objetivo)} no le llegaría a nadie de los que se sabe el dinero`;
  const t = b.caro ? `subirle la cláusula a ${eur(b.objetivo)} costaría ${eur(b.coste)} (${por}): NO compensa, es más de una cuarta parte de lo que vale` : `subida justa de cláusula: subirla a ${eur(b.objetivo)} cuesta ${eur(b.coste)} (${por})`;
  const u = b.parcial ? `; lo que sí compensa: subirla a ${eur(b.parcial.objetivo)} (${eur(b.parcial.coste)}) y solo le llegaría a ${bloqueada('quienPaga') ? `${b.parcial.quedan.length} rival${b.parcial.quedan.length === 1 ? '' : 'es'}` : b.parcial.quedan.join(', ')}` : '';
  return t + u;
};
const forma = (M, pid) => { const f = M.forma && M.forma(pid); return f && f.jugados != null ? `jugó ${f.jugados} de las últimas ${f.de} (${f.min} min)` : null; };
const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const d2 = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
/** sus últimas jornadas con el rival de cada una: «J9 11 vs Getafe (c, 2-0) · J8 0 en Betis (no jugó)» */
function historialTxt(M, j, n = 5) {
  const h = M.historial ? M.historial(j, n) : [];
  if (!h.length) return null;
  return `últimas: ${h.map((x) => `J${x.n} ${x.pts}${x.rival ? ` ${x.casa ? 'vs' : 'en'} ${x.rival}${x.posRival ? ` ${x.posRival}º` : ''}${x.gf != null ? ` ${x.gf}-${x.gc}` : ''}` : ''}${x.min === 0 ? ' (no jugó)' : x.min != null && x.min < 45 ? ` (${x.min}')` : ''}`).join(' · ')}`;
}
/** cuánto rinde en casa y fuera, y contra los de arriba y los de abajo */
function rendimientoTxt(M, j) {
  const r = M.rendimiento ? M.rendimiento(j) : null;
  if (!r) return null;
  const t = (x, nom) => (x ? `${nom} ${d1(x.m)} (${x.n})` : null);
  const l = [t(r.casa, 'en casa'), t(r.fuera, 'fuera'), t(r.arriba, 'vs top-6'), t(r.abajo, 'vs últimos 6')].filter(Boolean);
  return l.length ? `rinde (pts de media): ${l.join(', ')}` : null;
}
/** la previa de su próximo partido */
function previaTxt(M, j) {
  const v = M.previa ? M.previa(j) : null;
  if (!v) return null;
  const rs = (r) => (r ? `${r.txt}` : '?');
  const sitio = v.rivalSitio ? `${v.casa ? 'fuera' : 'en casa'} el rival lleva ${v.rivalSitio.v}V ${v.rivalSitio.e}E ${v.rivalSitio.d}D (${v.rivalSitio.gf}-${v.rivalSitio.gc})` : null;
  const porPos = j.pos <= 2 && v.cero != null ? `portería a cero ~${Math.round(v.cero * 100)} %` : v.golesFavor != null ? `goles esperados de su equipo ${d1(v.golesFavor)}` : null;
  const xg = v.xg ? ` · xG por partido: su equipo genera ${d1(v.xg.tu.xg)} y concede ${d1(v.xg.tu.xga)}${v.xg.tu.xg5 != null ? ` (últimos 5: ${d1(v.xg.tu.xg5)}/${d1(v.xg.tu.xga5)})` : ''}; el rival genera ${d1(v.xg.ri.xg)} y concede ${d1(v.xg.ri.xga)}${v.xg.ri.xg5 != null ? ` (últimos 5: ${d1(v.xg.ri.xg5)}/${d1(v.xg.ri.xga5)})` : ''}` : '';
  if (v.p && v.p.fecha && v.p.fecha <= Date.now()) return `SE ESTÁ JUGANDO AHORA (o acaba de acabar): ${v.casa ? 'en casa vs' : 'fuera en'} ${v.rival}${M.puntosVivo && M.puntosVivo(j.id) != null ? `, lleva ${M.puntosVivo(j.id)} pts` : ''}`;
  return `PREVIA: ${v.casa ? 'en casa vs' : 'fuera en'} ${v.rival}${v.posRival ? ` (${v.posRival}º, ${v.nivel || '?'})` : ''} ${cuando(v.p.fecha)} · su equipo llega ${rs(v.rachaTu)}, el rival ${rs(v.rachaRi)}${v.rivalMarca != null ? ` · el rival marca ${d1(v.rivalMarca)} y encaja ${d1(v.rivalEncaja)} por partido` : ''}${xg}${sitio ? ` · ${sitio}` : ''}${porPos ? ` · ${porPos}` : ''}`;
}
/** hacia dónde va su valor ahora: lo de cada día de la última semana y si se frena o ha girado */
function inerciaTxt(M, j) {
  const x = M.inercia ? M.inercia(j.id) : null;
  const pz = M.partidazo ? M.partidazo(j.id) : null;
  const QUE = pz ? ['', 'un buen partido', 'un partido muy bueno', 'un partidazo'][pz.nivel] : '';
  const EFECTO = pz ? ['', 'puede suavizar la bajada', 'lo normal es que la bajada se frene', 'lo normal es que suba los próximos días'][pz.nivel] : '';
  const ojo = !pz ? '' : x && ['giro', 'baja', 'parado', 'frena'].includes(x.fase) ? `; OJO: ACABA DE HACER ${QUE} (${pz.pts} PTS, J${pz.n}): ${EFECTO}; tenlo en cuenta antes de decir que siga bajando, que lo venda o que no lo fiches o clausules por la bajada` : `; ACABA DE HACER ${QUE} (${pz.pts} PTS, J${pz.n}): lo normal es que siga subiendo`;
  if (!x || x.fase === 'plano') return pz ? `ACABA DE HACER ${QUE} (${pz.pts} PTS, J${pz.n}): ${EFECTO.replace('la bajada', 'su valor')}` : null;
  return inerciaLinea(M, j, x) + ojo;
}
function inerciaLinea(M, j, x) {
  const F = { giro: 'HA GIRADO A LA BAJA', baja: 'BAJANDO', parado: 'ESTANCADO TRAS SUBIR', frena: 'FRENANDO', acelera: 'acelerando', sube: 'subiendo', rebote: `REBOTE PEQUEÑO TRAS CAER UN ${x.rebote ? Math.round(x.rebote.caida * 100) : '?'} % EN UN MES (cerca de su mínimo; pararse aquí NO es girar ni motivo para vender)` }[x.fase] || x.fase;
  const sinDias = bloqueada('inercia');
  return `INERCIA ${F}: cada día ${x.R.map((r) => eur(r, { signo: true })).join(' → ')}${x.fase === 'frena' && !sinDias ? ` (deja de subir en ~${Math.max(1, Math.round(x.giroEn))} d)` : ''}${['giro', 'baja', 'parado', 'frena'].includes(x.fase) && !sinDias ? `; hasta la jornada ${eur(x.proyJ, { signo: true })}` : ''}${x.vuelve ? `; VUELVE: llegó a valer ${eur(x.vuelve.max)}, juega otra vez y lleva ${x.vuelve.racha} días subiendo: mientras siga subiendo NO es momento de venderlo ni de descartarlo por la inercia` : ''}`;
}

/** los puntos esperados por partes, la titularidad juntando fuentes y el riesgo de rotación (en corto) */
function esperadosTxt(M, j) {
  const P = M.ppDetalle ? M.ppDetalle(j) : null;
  if (!P || j.pos === 5) return null;
  const N = { min: 'min', gol: 'gol', asis: 'asis', cero: 'cero', encaja: 'encaja', paradas: 'paradas', tarjetas: 'tarj', resto: 'resto' };
  const d = P.d, T = P.T;
  const partes = d ? ` = ${Object.entries(d.partes).filter(([, v]) => Math.abs(v) >= 0.05).map(([k, v]) => `${N[k] || k} ${v < 0 ? '−' : ''}${d1(Math.abs(v))}`).join(' · ')}${Math.abs(P.base - d.total) >= 0.8 ? ` (fórmula de siempre ${d1(P.base)})` : ''}` : '';
  const tit = T ? `; titular ~${Math.round(T.p * 100)} % (${T.fuentes.map((f) => `${f.f} ${Math.round(f.p * 100)}`).join(', ')}${T.pRot ? `, −${Math.round(T.pRot * 100)} rotación` : ''})` : '';
  const rot = T && T.rot && T.rot.cerca.length ? ` | ROTACIÓN: ${T.rot.cerca.map((x) => `${x.comp}${x.rival ? ` ${x.casa ? 'vs' : 'en'} ${x.rival}` : ''} ${d1(x.dias)} días ${x.antes ? 'antes' : 'después'}`).join('; ')}` : '';
  const ses = P.sesgo && Math.abs(P.sesgo - 1) >= 0.05 ? `; ×${d2(P.sesgo)} por el sesgo de su puesto` : '';
  return `PUNTOS ESPERADOS ${d1(P.final)}${partes}${tit}${ses}${rot}`;
}
/** su rendimiento de verdad fuera del Fantasy: Understat (xG, xA, tiros, pases clave) y SofaScore (notas, defensa) */
function avanzadoTxt(M, j) {
  const a = M.avanzado ? M.avanzado(j.id) : null;
  if (!a) return null;
  const p90 = (v, min) => { if (!(min > 0)) return '?'; const x = (v * 90) / min; return String(Math.round(x * (x < 1 ? 100 : 10)) / (x < 1 ? 100 : 10)).replace('.', ','); };
  const l = [];
  if (a.u && a.u.min > 0) {
    const u = a.u;
    l.push(`Estadística avanzada: ${u.g} goles con ${d1(u.xg)} xG y ${u.a} asist. con ${d1(u.xa)} xA en ${u.min} min (${p90(u.xg, u.min)} xG y ${p90(u.xa, u.min)} xA por 90; ${p90(u.tiros, u.min)} tiros y ${p90(u.pc, u.min)} pases clave por 90)`);
  }
  if (a.s) {
    const s = a.s;
    const x = [];
    if (s.nota) x.push(`nota media ${String(s.nota).replace('.', ',')}`);
    if (s.notas && s.notas.length) x.push(`últimas notas ${s.notas.map((n) => String(n).replace('.', ',')).join(' ')}`);
    if (s.min > 0) {
      if (j.pos === 1) { if (s.paradas) x.push(`${p90(s.paradas, s.min)} paradas por 90`); if (s.ceros != null && s.pj) x.push(`${s.ceros} porterías a cero en ${s.pj}`); }
      else {
        const d = [['entradas', s.entradas], ['intercepciones', s.intercep], ['recuperaciones', s.recup], ['regates', s.regates]].filter(([, v]) => v);
        if (d.length) x.push(`${d.map(([k, v]) => `${p90(v, s.min)} ${k}`).join(', ')} por 90`);
      }
      if (s.tit != null && s.pj) x.push(`titular en ${s.tit} de ${s.pj}`);
    }
    if (x.length) l.push(`Notas y defensa: ${x.join(', ')}`);
  }
  return l.length ? l.join(' · ') : null;
}
// el estado de LaLiga, en castellano y con lo que supone (la IA leía «doubtful» y no lo tenía en cuenta: Nico Williams
// con molestias, 8 nov)
const ESTADO_TXT = {
  doubtful: 'EN DUDA (molestias o un golpe: puede no jugar el próximo partido; si se confirma la lesión, suele bajar de valor, y más con un parón por delante)',
  injured: 'LESIONADO (no juega hasta que se recupere; baja de valor mientras tanto)',
  suspended: 'SANCIONADO',
  out_of_league: 'FUERA DE LA LIGA (ya no está en LaLiga)',
};
const lineaJ = (M, j, x = {}) => [
  POS[j.pos] || '?', j.nombre, j.equipo || '?', `valor ${eur(j.valor)}`,
  (() => { const ine = M.inercia ? M.inercia(j.id) : null; if (ine && ine.fase !== 'plano') return null; return x.tend && x.tend.d1 != null ? `hoy ${eur(x.tend.d1, { signo: true })}` : null; })(),
  x.tend && x.tend.p7 != null ? `7d ${pct(x.tend.p7)}` : null,
  // (la de 7 días lleva dentro los días de bajada: con el que acaba de empezar a subir, lo que sube estos días)
  x.tend && x.tend.rRec != null && x.tend.p7 != null && x.tend.p7 < 2 ? `lleva ${x.tend.racha} días subiendo (${pct(x.tend.rRec / 0.9 * 100)}/día)` : null,
  inerciaTxt(M, j),
  j.pos === 5 ? 'ENTRENADOR: no se alinea ni puntúa en la versión gratis' : null,
  j.media ? `media ${String(j.media).replace('.', ',')}` : null, `${j.puntos} pts`,
  j.pos < 5 ? forma(M, j.id) : null,
  j.pos < 5 ? historialTxt(M, j, PLAN_CORTO ? 3 : 5) : null,
  j.pos < 5 && !PLAN_CORTO ? rendimientoTxt(M, j) : null,
  j.pos < 5 && !PLAN_CORTO ? avanzadoTxt(M, j) : null,
  onceTxt(M, j),
  j.pos < 5 ? previaTxt(M, j) : null,
  j.pos < 5 ? esperadosTxt(M, j) : null,
  j.pos < 5 ? rivalTxt(M, j) : null,
  j.estado && j.estado !== 'ok' ? `ESTADO: ${ESTADO_TXT[j.estado] || j.estado}${j.estado === 'suspended' && M.sancion ? (M.sancion(j).larga ? ' (sanción de más de un partido: su equipo ya ha jugado sin él y sigue sancionado)' : ' (sanción de un partido: se pierde la próxima jornada y vuelve a la siguiente; por eso solo no se vende)') : ''}` : null,
].filter(Boolean).join(' | ');
/** uno de los míos en el chat, en corto (los que nombra en su mensaje van enteros aparte): la línea entera eran 2.000
 * caracteres por jugador y, con 15, más de la mitad de lo que leía la IA en cada pregunta (revisión de la IA, 14 nov) */
const lineaBreve = (M, j) => {
  const t = M.tend ? M.tend(j.id) || {} : {}, T = M.titularidad && j.pos < 5 ? M.titularidad(j) : null;
  return [
    POS[j.pos] || '?', j.nombre, j.equipo || '?', `valor ${eur(j.valor)}`,
    t.d1 != null ? `hoy ${eur(t.d1, { signo: true })}` : null, t.p7 != null ? `7d ${pct(t.p7)}` : null,
    inerciaTxt(M, j),
    j.pos === 5 ? 'ENTRENADOR: no se alinea ni puntúa' : null,
    j.media ? `media ${String(j.media).replace('.', ',')}` : null,
    onceTxt(M, j) || (T && T.p != null ? `titular ~${Math.round(T.p * 100)} %` : null),
    j.pos < 5 && M.ppEsperado ? `próximo: ${partidoTxt(M, j)}, ~${d1(M.ppEsperado(j))} pts esperados` : null,
    j.estado && j.estado !== 'ok' ? `ESTADO: ${ESTADO_TXT[j.estado] || j.estado}` : null,
  ].filter(Boolean).join(' | ');
};
function onceTxt(M, j) {
  if (!j || j.pos === 5) return null;
  const al = M.alineacion ? M.alineacion(j.id) : null;
  if (al) return `ALINEACIÓN CONFIRMADA: ${al.estado === 'titular' ? 'TITULAR' : al.estado === 'suplente' ? 'SUPLENTE' : al.estado === 'nosale' ? 'NO SALE DE TITULAR (puede estar en el banquillo o no ir convocado)' : al.estado === 'baja' ? 'BAJA' : 'NO CONVOCADO'}`;
  if (!M.hayOnces) return null;
  const o = M.onceProb(j.id);
  if (!o) return 'once probable: no sale';
  if (o.titular) return `once probable: TITULAR${o.prob != null ? ` ${o.prob} %` : ''}`;
  return 'once probable: suplente';
}
const mejoraTxt = (M, j) => { const g = M.mejora ? M.mejora(j) : 0; return g >= 0.3 ? `entraría en mi once (+${String(Math.round(g * 10) / 10).replace('.', ',')} pts/jornada)` : 'NO entraría en mi once'; };
// uno de los míos: si es titular y lo que pierde mi once sin él («NO entraría en mi once» salía con los míos)
const onceMioTxt = (M, j) => {
  const tit = M.once && M.once.lineas && M.once.lineas.flat().some((x) => x.id === j.id);
  const pp = M.perdida ? M.perdida(j.id) : 0;
  return `${tit ? 'TITULAR en mi once' : 'suplente en mi once'}${pp >= 0.3 ? `; sin él, mi once pierde ${String(Math.round(pp * 10) / 10).replace('.', ',')} pts/jornada` : ''}`;
};
let CORTO = false;
// (revisión total, M3) el plan «corto» (la segunda vuelta, cuando el primero llega cortado o roto) de verdad corto: cada
// jugador sin lo que rinde por rivales ni las estadísticas avanzadas, 3 jornadas y la mitad de candidatos en el catálogo
let PLAN_CORTO = false;
/**
 * el calendario de riesgo: sus próximos 5 partidos (o los de sus 14 días con la cláusula protegida), con el
 * veredicto; partido a partido si es duro, favorable o de riesgo alto (y no vamos en corto)
 */
const rivalTxt = (M, j) => {
  const c = M.calendarioRiesgo ? M.calendarioRiesgo(j) : null;
  if (!c) return null;
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const cab = `CALENDARIO ${c.tipo.toUpperCase()} (riesgo deportivo ${c.riesgo}${c.riesgo === 'alto' && c.maxSobre != null ? `: solo de parche, sin pagar más de un ${pct(c.maxSobre * 100, 0, false)} sobre su valor` : ''}): ${c.texto}`;
  if (CORTO || (c.tipo === 'normal' && c.riesgo !== 'alto')) return cab;
  const ps = c.partidos.map((p) => `J${p.jornada} ${p.casa ? 'vs' : 'en'} ${p.rival}${p.pos ? ` ${p.pos}º` : ''} ${p.nivel || 'sin datos'} ~${d1(p.pts)}${p.pTit != null ? ` tit ${Math.round(p.pTit * 100)}%` : ''}${p.rot ? ` (${p.rot.join('+')} cerca)` : ''}${p.h2h && p.h2h.length ? ` últimos contra él ${p.h2h.map((e) => `${e.r}${e.gf}-${e.gc}`).join(' ')}` : ''}`);
  return `${cab} → ${ps.join('; ')}`;
};

/* ---------------- lo que le cuentas a la IA ---------------- */
// Cosas que no salen en la API (un amigo te ofrece un jugador, lo que piensas hacer, a quién no quieres vender):
// las apunta la IA desde el chat y cuentan en el plan, en el chat y en segundo plano hasta que caducan.
export const notas = () => LS.get(K('notas'), []);
const guardarNotas = (l) => { LS.set(K('notas'), l.slice(-40)); LS.set(K('notas-t'), Date.now()); };
export const notasVigentes = () => notas().filter((n) => !n.caduca || n.caduca > Date.now());
export const borrarNota = (id) => guardarNotas(notas().filter((n) => n.id !== id));
export const notasDe = (pid) => notasVigentes().filter((n) => n.pid === pid);

/** el jugador con ese nombre (exacto, o el único que lo contiene) */
export function pidDe(nombre, D) {
  const k = norm(nombre);
  if (!k) return null;
  const todos = Object.values(D.maestro || {});
  const exacto = todos.find((j) => norm(j.nombre) === k);
  if (exacto) return exacto.id;
  const parecidos = todos.filter((j) => norm(j.nombre).includes(k) || (k.length >= 5 && k.includes(norm(j.nombre)) && norm(j.nombre).length >= 4));
  return parecidos.length === 1 ? parecidos[0].id : null;
}

/** los jugadores que salen en un texto (por su nombre entero o por un apellido que solo tiene uno) */
export function jugadoresEn(texto, D) {
  const t = ` ${norm(texto)} `;
  const out = [];
  const porApellido = {};
  for (const j of Object.values(D.maestro || {})) {
    const n = norm(j.nombre);
    // (el apellido se cuenta también para el que sale entero: con «Nico Williams» en el texto, Iñaki Williams se colaba
    // como el único «Williams»; 7 nov)
    const ult = n.split(' ').pop();
    if (ult.length >= 5) (porApellido[ult] ||= []).push(j);
    if (n.length >= 4 && t.includes(` ${n} `)) out.push(j);
  }
  for (const [ap, js] of Object.entries(porApellido)) if (js.length === 1 && t.includes(` ${ap} `) && !out.includes(js[0])) out.push(js[0]);
  return out.slice(0, 6);
}

/** «mañana 20:00 (8 nov)»: con «hoy», «mañana» o «ayer», también la fecha (en un chat largo la IA pasaba de «mañana» a «hoy») */
function cuandoF(t, op) {
  const c = cuando(t, op);
  return /^(hoy|mañana|ayer)/.test(c) ? `${c} (${fechaCorta(t)})` : c;
}

/**
 * la cláusula de uno de los míos, entera: cuánto, si está a su valor (y por qué), cuándo se abre y qué se puede hacer
 * con el blindaje (el escudo de LaLiga: solo con la cláusula ya abierta). Antes, en «JUGADORES QUE NOMBRA», uno mío
 * salía sin cláusula (M.clausulas solo lleva las de los rivales) y la IA no sabía que la de Nico se abría al día
 * siguiente (Carlos, 7 nov); y se inventaba la hora del escudo («mañana antes de las 20:00», luego «hoy»).
 */
function clausulaMiaTxt(M, x) {
  if (!x || !x.clausula) return 'cláusula: no la sé';
  const ES = M.escudosMios || { quedan: 0 }, H = M.ESCUDO_H || 24;
  const aSuValor = x.j && x.j.valor && Math.abs(x.clausula - x.j.valor) < Math.max(1e4, x.j.valor * 0.002);
  const cuanto = `cláusula ${eur(x.clausula)}${aSuValor ? ' (IGUAL A SU VALOR: cuando el valor pasa la cláusula, LaLiga la sube sola hasta el valor, así que mientras suba irá pegada a su valor; cuando se abra costará lo que valga en ese momento)' : x.ratio != null ? ` (${pct((x.ratio - 1) * 100, 0)} sobre su valor)` : ''}`;
  let estado, escudo;
  if (x.abierta) {
    estado = 'ABIERTA YA: cualquiera con saldo me lo puede quitar';
    escudo = x.escudo ? `ya blindado hasta ${cuandoF(x.escudo)}` : ES.quedan ? `se puede blindar ya (gratis, viendo un anuncio): queda protegida ${H} h, hasta ${cuandoF(Date.now() + H * HORA)}` : 'no me quedan blindajes esta jornada';
  } else {
    const abre = x.protegidoHasta;
    estado = x.veda ? `cerrada por el cierre de cláusulas: se abre cuando empiece la jornada ${x.veda.n}, ${cuandoF(abre)}` : `${x.escudo ? 'BLINDADA' : 'protegida'} hasta ${cuandoF(abre)}: hasta esa hora nadie me lo puede clausular; desde esa hora, sí`;
    escudo = x.escudo ? 'ya lleva el blindaje puesto' : ES.quedan ? `el blindaje NO se puede poner antes de ${cuandoF(abre)} (solo vale con la cláusula ya abierta); puesto a esa hora, la protege ${H} h más, hasta ${cuandoF(abre + H * HORA)}. OJO: en ese mismo minuto un rival con saldo ya puede pagar la cláusula, así que el blindaje solo le salva si lo pongo antes de que nadie la pague; a salvo desde antes, solo subiendo la cláusula` : 'no me quedan blindajes esta jornada';
  }
  return `${cuanto} · ${estado} · blindaje: ${escudo}`;
}

/** todo lo que se sabe de un jugador: lo de siempre más de quién es, su cláusula o si está en el mercado */
function lineaCompleta(D, M, j) {
  const t = M.tend(j.id);
  const tid = M.dueno[j.id];
  const e = tid && M.equipo[tid];
  const fa = tid && M.fichadoPor && M.fichadoPor(j.id);
  const de = !tid ? 'libre (no es de nadie de la liga)' : tid === D.yo.teamId ? 'ES MÍO' : `es de ${(e && (e.manager || e.nombre)) || 'un rival'}${fa ? `, que lo ${fa.clase === 'clausula' ? 'clausuló' : 'fichó'} ${cuando(fa.t)}${fa.importe ? ` por ${eur(fa.importe)}` : ''}` : ''}`;
  const cl = M.clausulas.find((x) => x.pid === j.id);
  const serie = t.serie || [];
  const hace = (d) => { const x = [...serie].reverse().find(([ts]) => ts <= Date.now() - d * DIA); return x ? x[1] : null; };
  const v7 = hace(7), v30 = hace(30);
  const como = comoConseguir(D, M, j.id, catDe(D, M));
  const mia = tid && tid === D.yo.teamId ? (M.mias || []).find((x) => x.pid === j.id) : null;
  return `${lineaJ(M, j, { tend: t })} | ${de}${mia ? ` | ${clausulaMiaTxt(M, mia)}` : ''}${cl ? ` | cláusula ${eur(cl.clausula)} ${cl.abierta ? 'ABIERTA' : cl.veda ? `CERRADA hasta que empiece la jornada ${cl.veda.n}: se puede clausular ${cuandoF(cl.protegidoHasta)}, no antes` : cl.escudo ? `BLINDADA por su dueño hasta ${cuandoF(cl.protegidoHasta)} (hasta entonces no se puede clausular)` : `se abre ${cuandoF(cl.protegidoHasta)} (hasta esa hora no se puede clausular; su dueño puede blindarla en cuanto se abra)`}` : ''} | CÓMO CONSEGUIRLO: ${como}${prensaTxt(M, j.id)}${v7 ? ` | hace 7 días valía ${eur(v7)}` : ''}${v30 ? `, hace 30 días ${eur(v30)}` : ''} | ${mia ? onceMioTxt(M, j) : mejoraTxt(M, j)}`;
}

/** el catálogo de operaciones posibles, uno por análisis */
// (se rehace si le has contado algo nuevo en el chat desde que se hizo: un trato nuevo es una operación T- más)
const catDe = (D, M) => {
  const t = LS.get(K('notas-t'), 0);
  if (!M._cat || M._catT !== t) { M._cat = catalogo(D, M, notasVigentes()); M._catT = t; }
  return M._cat;
};
/** los titulares de los últimos días que nombran a un jugador */
function prensaTxt(M, pid, n = 2) {
  const l = (M.noticiasDe ? M.noticiasDe(pid) : []).slice(0, n);
  if (l.length) return ` | PRENSA: ${l.map((x) => `«${x.titulo}» (${x.fuente && !esWebFantasy(x.fuente) ? x.fuente : 'prensa'}${x.t ? `, ${cuando(x.t)}` : ''})`).join('; ')}`;
  // sin titulares porque Google Noticias no ha contestado no es «nada en 3 días»
  // (sin nada, nada: lo de «sin PRENSA» se explica una vez en el contexto; salía 30 veces)
  return '';
}
const nombreTid = (M, tid) => { const e = M.equipo[tid]; return (e && (e.manager || e.nombre)) || '?'; };

/* para comparar sin mayúsculas ni tildes sin mover las posiciones: cada carácter (en NFC) pasa a uno solo, en minúscula y
   sin tilde («Á» → «a», «Ñ» → «n»), así lo que se encuentra en la copia doblada está en el mismo sitio en el texto */
const DOBLADO = new Map();
const doblar1 = (c) => {
  const k = c.charCodeAt(0);
  if (k < 128) return k >= 65 && k <= 90 ? String.fromCharCode(k + 32) : c;
  let f = DOBLADO.get(c);
  if (f == null) { f = ((c.normalize('NFD')[0] || c).toLowerCase()[0]) || c; DOBLADO.set(c, f); }
  return f;
};
const doblar = (t) => { let o = ''; for (let i = 0; i < t.length; i++) o += doblar1(t[i]); return o; };

/**
 * Alias para los de tu liga: lo que va a Google lleva «Rival 3» (el mánager) y «Equipo 3» (su equipo) en vez de sus
 * nombres, que son datos de otras personas; destapar() los vuelve a poner en lo que contesta. Tu nombre y el de tu
 * equipo sí van, y no se tocan. N es su puesto en la clasificación (si dos comparten puesto, su orden). Los mánagers que
 * salen en la actividad de la liga y ya no están en la clasificación (se fueron) van como «Exrival N».
 * - Se tapa sin mirar tildes («Alex» por «Álex») ni mayúsculas («marcos», «RUBÉN»). Un nombre de 3 letras solo si
 *   empieza por mayúscula: «leo» o «ana» en minúscula son palabras normales.
 * - Los nombres de jugadores, clubes y los tuyos que contienen el de un mánager («Hugo Duro» con un mánager «Hugo»)
 *   se dejan tal cual, también en minúsculas («hugo duro»).
 * - Un rival se queda sin tapar si su nombre es exactamente el de un jugador, un club o el tuyo, si no lleva letras o
 *   tiene menos de 3, o si es una palabra de las instrucciones de la IA («Mercado»): no se sabría cuál es cuál.
 * - Lo que escribes tú pasa por aquí (el chat, las notas); las fotos que adjuntas, no: van tal cual.
 */
export function seudonimos(D) {
  const yo = D && D.yo && D.yo.teamId;
  const mio = ((D && D.clasif) || []).find((e) => e && e.teamId === yo);
  const otros = new Set();
  for (const j of Object.values((D && D.maestro) || {})) if (j) for (const t of [j.nombre, j.nombreCompleto, j.equipo]) if (typeof t === 'string' && t.trim()) otros.add(t.trim());
  for (const e of Object.values((D && D.equipos) || {})) if (e) for (const t of [e.nombre, e.corto]) if (typeof t === 'string' && t.trim()) otros.add(t.trim());
  for (const t of [D && D.yo && D.yo.nombre, mio && mio.manager, mio && mio.nombre]) if (typeof t === 'string' && t.trim()) otros.add(t.trim());
  const igual = new Set([...otros].map(norm));
  const base = ` ${norm(SISTEMA)} `;
  const vale = (x) => typeof x === 'string' && x.trim().length >= 3 && /\p{L}/u.test(x) && !igual.has(norm(x)) && !base.includes(` ${norm(x)} `);
  const rivales = ((D && D.clasif) || []).filter((e) => e && e.teamId !== yo).sort((a, b) => (a.pos || 99) - (b.pos || 99));
  const puestos = rivales.map((e) => e.pos);
  const porPuesto = puestos.every((x) => Number.isInteger(x) && x > 0) && new Set(puestos).size === puestos.length;
  // nombre doblado → alias (el primero que llega se queda: dos rivales que se escriben igual no se pueden separar)
  const alias = new Map(), vuelta = {};
  const poner = (nombre, a) => {
    const k = doblar(nombre.trim().normalize('NFC'));
    if (alias.has(k)) return;
    alias.set(k, a);
    vuelta[a.toLowerCase()] = nombre.trim();
  };
  rivales.forEach((e, i) => {
    const n = porPuesto ? e.pos : i + 1;
    if (vale(e.manager)) poner(e.manager, `Rival ${n}`);
    if (e.nombre && e.nombre !== e.manager && vale(e.nombre)) poner(e.nombre, `Equipo ${n}`);
  });
  // los que se fueron de la liga: salen en la actividad (de lo más nuevo a lo más viejo) y no en la clasificación
  const ids = new Set(), nombres = new Set();
  for (const e of (D && D.clasif) || []) { if (!e) continue; for (const x of [e.userId, e.managerId]) if (x) ids.add(String(x)); for (const x of [e.manager, e.nombre]) if (norm(x)) nombres.add(norm(x)); }
  if (D && D.yo) { if (D.yo.userId) ids.add(String(D.yo.userId)); if (norm(D.yo.nombre)) nombres.add(norm(D.yo.nombre)); }
  const actv = [...((D && D.actividad) || [])].sort((a, b) => (b.t || 0) - (a.t || 0));
  let ex = 0;
  for (const a of actv) for (const [nom, id] of [[a.quien, a.quienId], [a.otro, a.otroId]]) {
    if (typeof nom !== 'string' || !nom.trim() || (id && ids.has(String(id))) || nombres.has(norm(nom)) || !vale(nom)) continue;
    nombres.add(norm(nom));
    poner(nom, `Exrival ${++ex}`);
  }
  // los más largos primero («Los Pepes FC» antes que «Pepe»)
  const claves = [...alias.keys()].sort((a, b) => b.length - a.length);
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const palabra = (lista) => new RegExp(`(?<![\\p{L}\\p{N}])(${lista.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  const reR = claves.length ? palabra(claves) : null;
  // jugadores, clubes y lo tuyo que llevan dentro el nombre de un rival: se dejan tal cual
  const aparte = reR ? [...new Set([...otros].map((t) => doblar(t.normalize('NFC'))))].filter((t) => { reR.lastIndex = 0; return reR.test(t) && !alias.has(t); }) : [];
  // todo en una: lo de aparte y los rivales, de más largo a más corto; en cada sitio gana el que empieza antes y, ahí, el más largo
  const todo = reR ? palabra([...new Set([...aparte, ...claves])].sort((a, b) => b.length - a.length)) : null;
  const deVuelta = /(?<![\p{L}\p{N}])([Rr][Ii][Vv][Aa][Ll]|[Ee][Xx][Rr][Ii][Vv][Aa][Ll]|Equipo) (\d{1,3})(?![\p{L}\p{N}]|[.,]\d)/gu;
  return {
    n: alias.size,
    aviso: avisoAlias(porPuesto, ex),
    // (para el Worker, que arma el aviso él: /plan)
    porPuesto, ex: ex > 0,
    tapar: (t0) => {
      if (!todo || typeof t0 !== 'string') return t0;
      const t = t0.normalize('NFC'), d = doblar(t);
      let o = '', ult = 0;
      todo.lastIndex = 0;
      for (const m of d.matchAll(todo)) {
        const a = alias.get(m[0]);
        if (!a) continue; // un jugador o un club con el nombre dentro: tal cual
        const orig = t.slice(m.index, m.index + m[0].length);
        if (m[0].length < 4 && orig[0] === orig[0].toLowerCase()) continue; // «leo», «ana»: palabras, no nombres
        o += t.slice(ult, m.index) + a;
        ult = m.index + m[0].length;
      }
      return ult ? o + t.slice(ult) : t0;
    },
    // json: lo que vuelve es un JSON (el plan): el nombre va escapado para que no lo rompa una comilla
    destapar: (t, { json = false } = {}) => (alias.size && typeof t === 'string' ? t.replace(deVuelta, (m, q, d) => { const v = vuelta[`${q.toLowerCase()} ${d}`]; return v == null ? m : json ? JSON.stringify(v).slice(1, -1) : v; }) : t),
  };
}
const rachaTxt = (M, id) => { const r = M.racha && M.racha(id); return r ? `${r.txt} (${r.gf}-${r.gc}, ${r.pts} de ${r.de * 3} pts)` : null; };

/** lo que el manager le ha contado, para meterlo en el contexto */
function notasTxt(D, M) {
  const ns = notasVigentes();
  if (!ns.length) return '';
  const L = ['\nLO QUE ME HAS CONTADO TÚ (no sale en los datos de LaLiga; cuenta para todas las recomendaciones, sobre todo los tratos y ofertas con otros managers):'];
  const fuera = new Set((M.vendidos || []).map((v) => v.pid));
  for (const n of ns) {
    L.push(`- [${n.id}] ${cuando(n.t)}: ${n.texto}${n.caduca ? ` (vale hasta ${cuando(n.caduca, { hora: false })})` : ''}${n.pid && fuera.has(n.pid) ? ' [YA NO ES SUYO: esta nota está superada]' : ''}`);
    const j = n.pid && M.J(n.pid);
    if (j) L.push(`  datos de ${j.nombre}: ${lineaCompleta(D, M, j)}`);
  }
  return L.join('\n');
}

export function contexto(D, M, c, { corto = false, chat = false } = {}) {
  CORTO = corto || chat;
  PLAN_CORTO = corto && !chat;
  try { return contextoDe(D, M, c, { corto: corto || chat, chat }); } finally { CORTO = false; PLAN_CORTO = false; }
}
function contextoDe(D, M, c, { corto = false, chat = false } = {}) {
  const L = [];
  const ahora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  L.push(`AHORA: ${ahora} (hora de España)`);
  L.push(`LIGA: ${D.liga.nombre}, ${D.clasif.length} equipos. Se puede quedar en negativo hasta el ${c.deuda} % del valor del equipo (${eur(M.deuda)}), pero solo pujando o comprando en el mercado: las cláusulas se pagan con saldo.`);
  // (aviso de Domy, 31 oct) LaLiga cierra el once con el primer partido de la jornada: con ella en juego, todo lo que se
  // haga es para la siguiente (o para el parón, si va antes)
  if (M.enJuego) {
    const sig = M.proxima, paronAntes = M.paron && sig && M.paron.ini < sig.ini && M.paron.fin > Date.now();
    L.push(`JORNADA ${M.enJuego.n} EN JUEGO hasta ${cuando(M.enJuego.fin)}. Mi once de esta jornada YA ESTÁ CERRADO: LaLiga lo bloquea con el primer partido (${cuando(M.enJuego.ini)}) y no deja cambiar a nadie, ni a los que aún no han jugado, hasta la jornada siguiente. Para la jornada ${M.enJuego.n} ya no se puede hacer nada: ni alinear, ni fichar o clausular para que puntúe en ella. Lo que haga ahora es para ${sig ? `la jornada ${sig.n} (primer partido ${cuando(sig.ini)})` : 'la jornada siguiente'}${paronAntes ? ` y antes llega el parón de selecciones (del ${cuando(M.paron.ini, { hora: false })} al ${cuando(M.paron.fin, { hora: false })}): ten en cuenta lo que pasa con los valores y las selecciones en esos días` : ''}.`);
  }
  // (Carlos, 9 nov, 05:28) el lunes después de la jornada 12, con el parón ya empezado, la IA soltó «este fin de semana sin
  // partidos»: solo le llegaba «ESTAMOS EN EL PARÓN: no hay partidos» y nada de la jornada que se acababa de jugar
  const ultJ = M.enJuego ? null : [...(M.jornadas || [])].reverse().find((j) => j.fin && j.fin <= Date.now());
  if (ultJ && Date.now() - ultJ.fin < 6 * DIA) L.push(`ÚLTIMA JORNADA JUGADA: la ${ultJ.n}, del ${cuandoF(ultJ.ini)} al ${cuandoF(ultJ.fin)}; acabó hace ${dura(Date.now() - ultJ.fin)}. Esos días SÍ hubo partidos de LaLiga y sus puntos ya cuentan: no digas que no hubo partidos ni que fue un fin de semana sin fútbol.`);
  if (M.proxima) L.push(`PRÓXIMA JORNADA: ${M.proxima.n}, primer partido ${cuando(M.proxima.ini)} (en ${dura(M.proxima.ini - Date.now())}).`);
  if (M.vedaAhora) L.push(`CLÁUSULAS CERRADAS: desde ${cuando(M.vedaAhora.ini)} (24 h antes del primer partido de la jornada ${M.vedaAhora.n}) LaLiga no deja clausular a nadie, ni a mí me pueden clausular, hasta que empiece la jornada (${cuando(M.vedaAhora.fin)}). Un clausulazo, a esa hora y no antes; blindar tampoco hace falta hasta entonces. Un jugador clausulado a esa hora NO llega a la alineación de esa jornada (el once se cierra con el primer partido): no lo pongas en el once ni cuentes con sus puntos hasta la siguiente.`);
  else if (M.proxima) L.push(`LAS CLÁUSULAS SE CIERRAN ${cuando(M.proxima.ini - M.VEDA_H * 3600e3)} (24 h antes del primer partido) y se reabren cuando empieza la jornada (${cuando(M.proxima.ini)}): un clausulazo, antes del cierre o a partir de esa hora. Si es a partir de esa hora, el jugador NO llega a la alineación de esa jornada (el once se cierra con el primer partido): cuenta para la siguiente.`);
  // el parón, con lo que supone: la IA lo tenía en una línea y seguía hablando de uno que «sube como la espuma»
  // (Carlos, 7 nov: «teniendo en cuenta el parón» y ni lo nombró)
  if (M.paron) {
    const cerca = M.enParon || M.paron.ini - Date.now() < 7 * DIA;
    const vuelta = M.proxima && M.proxima.ini > M.paron.ini ? M.proxima : null;
    L.push(`PARÓN DE SELECCIONES: del ${cuandoF(M.paron.ini, { hora: false })} al ${cuandoF(M.paron.fin, { hora: false })}${M.enParon ? ` (ESTAMOS EN ÉL${ultJ && ultJ.fin >= M.paron.ini - 2 * DIA ? `: empezó justo después de la jornada ${ultJ.n}, que se jugó hasta ${cuandoF(ultJ.fin)}; los días sin LaLiga son los que vienen, no los que han pasado` : ''})` : ` (empieza en ${dura(M.paron.ini - Date.now())})`}.${cerca ? ` Lo que supone: ${M.enParon ? 'no hay' : 'durante el parón no habrá'} partidos de LaLiga, así que nadie suma puntos${vuelta ? ` hasta la jornada ${vuelta.n} (${cuandoF(vuelta.ini)})` : ''}; las rachas de valor se frenan y las subidas se moderan (lo que subió uno la semana pasada no tiene por qué seguir: no lo vendas como que «sube como la espuma» por su 7d), y los que van con su selección pueden volver tocados o cansados. Si te pregunta por el parón o te dice «teniendo en cuenta el parón», nómbralo con estas fechas y di cómo cambia lo que le aconsejas.` : ''}`);
    // (19, aviso de Domy, 9 nov) en el parón el plan va de dinero, no de fichar para el once de la vuelta
    if (paronLejos(M) && vuelta) L.push(`PRIORIDAD EN EL PARÓN (manda sobre lo demás hasta ${cuandoF(vuelta.ini - PARON_VUELTA)}): como nadie puntúa hasta la jornada ${vuelta.n}, lo que hagas ahora se mide en DINERO, no en puntos. En este orden: 1) ESPECULAR y REVALORIZAR: comprar lo que sube (sobre todo los VUELVE y lo que la app marca para revender) y venderlo antes de la jornada ${vuelta.n}, con su día de venta; el margen de deuda vale para pujar, siempre que al vender vuelvas a positivo antes de la jornada. 2) VENDER EN LO ALTO lo tuyo que frena o ha girado, aunque juegue (lo tuyo que SUBE no se vende para especular con otro: ya es tu especulación, y aguantarlo hasta la vuelta es lo que da dinero), salvo que sea imprescindible para el once de la vuelta y reponerlo cueste más de lo que se pierde: hay días de sobra para recomprar o fichar a otro antes de la jornada. 3) PROTEGER lo tuyo (blindaje gratis primero) si un rival puede quitártelo: que te lo quiten a su valor sigue siendo perderlo. 4) CLAUSULAR o fichar PARA EL ONCE de la jornada ${vuelta.n} SOLO si es un CHOLLO CLARO (te lo marco en su cláusula: a un 5 % de su valor y sin bajar) o en los dos o tres días antes de la vuelta; si no, son días sin puntuar con el dinero parado y con el valor pudiendo bajar: va en «descartes» con ese motivo o, si se abre más tarde, como mucho en «proximos_dias». Una cláusula cara solo vale como operación para REVENDER, con su beneficio y su día de venta. En «situacion» y en el titular, dile que en el parón el objetivo es sacar dinero; en «paron», cuánto puede ganar hasta la vuelta y cuándo volver a pensar en el once.`);
  }
  if (M.cierreMercado) {
    // lo que se gana en la subasta es tuyo al cambiar el mercado y se puede alinear hasta el primer partido de la jornada:
    // con el mercado a las 20:00 y el primer partido a las 21:00 hay una hora (la IA decía que lo que se fichara hoy no
    // llegaba a la jornada; Carlos, 30 oct). Después, el once está cerrado hasta la siguiente (aviso de Domy, 31 oct)
    const cm = M.cierreMercado, ini = M.enJuego ? null : M.proxima && M.proxima.ini;
    const llega = M.enJuego
      ? ` Lo que te lleves en esta subasta es tuyo a esa hora, pero para la jornada ${M.enJuego.n} ya no cuenta (el once está cerrado): es para la jornada ${M.proxima ? M.proxima.n : 'siguiente'}.`
      : ini && cm < ini
        ? ` Hasta entonces se puede pujar. Lo que te lleves en esta subasta es tuyo a esa hora y llega a tiempo para la jornada ${M.proxima.n}: lo puedes alinear antes del primer partido (${cuando(ini)}, ${dura(ini - cm)} después del cambio).`
        : ini ? ` Lo que te lleves en esta subasta llega cuando la jornada ${M.proxima.n} ya ha empezado (${cuando(ini)}): no entra en el once de esa jornada (se cierra con el primer partido), cuenta para la siguiente.` : '';
    L.push(`EL MERCADO CAMBIA: ${cuando(cm)} (en ${dura(cm - Date.now())}).${llega}`);
  }
  const yo = M.yo || {};
  L.push(`MI EQUIPO: ${yo.nombre || '?'} · ${yo.pos || '?'}º de ${D.clasif.length} · ${yo.puntos || 0} pts · valor ${eur(D.valorEquipo)} · SALDO ${m1(D.dinero)} (lo máximo para una cláusula) · EN EL MERCADO PUEDO GASTAR COMO MUCHO ${eur(M.pujaMax)}${M.misPujas ? ` (ya tengo ${eur(M.misPujas)} comprometidos en pujas)` : ''}.`);
  {
    // la caja de cada paso, hecha: la IA no tiene que sumarla (revisión del 25 oct: daba por imposibles cláusulas que
    // llegaban aceptando una oferta, y no contaba las pujas hechas al ver si se empieza la jornada en positivo)
    const cajaA = cajaConOfertas(D, M);
    L.push(`CAJA PARA CLÁUSULAS: ${eur(num(D.dinero))} ahora${cajaA > num(D.dinero) ? `; ${eur(cajaA)} si antes acepto las ofertas que ya tengo` : ''}. Lo que ponga a la venta hoy no entra hasta que acepte una oferta${M.cierreMercado ? ` (llegan en el cambio de mercado, ${cuando(M.cierreMercado)})` : ''}.${M.misPujas ? ` SALDO SI GANO MIS PUJAS DE AHORA: ${eur(num(D.dinero) - M.misPujas)} (cuenta así para empezar la jornada en positivo).` : ''}`);
  }
  if (M.once) {
    const tit = new Set(M.once.lineas.flat().map((j) => j.id));
    L.push(`\nJUEGA CON LA VERSIÓN GRATUITA. Formaciones que puede usar: ${M.formaciones.map((f) => f.join('-')).join(', ')} (ninguna otra).`);
    L.push(`MI PLANTILLA POR PUESTOS (sanos/total): ${M.puestos.map((p) => `${POS[p.pos]} ${p.sanos}/${p.total}${p.faltan ? ` (FALTAN ${p.faltan})` : ''}${p.conviene ? ` (conviene tener ${p.conviene} más, no es obligatorio)` : ''}${p.sobran ? ` (sobran ${p.sobran})` : ''}`).join(' · ')}.`);
    // con la jornada en juego, el «próximo partido» de cada uno mezcla esta jornada y la siguiente: solo quién es titular
    if (M.enJuego) L.push(`MI MEJOR ONCE (solo de referencia, para saber quién es titular y quién no; la alineación de la jornada ${M.proxima ? M.proxima.n : 'siguiente'} se decide cuando acabe esta): ${M.once.nombre}${M.once.huecos ? ` CON ${M.once.huecos} HUECOS` : ''}: ${M.once.lineas.map((l) => l.map((j) => j.nombre).join(', ')).filter(Boolean).join(' | ')}.`);
    else L.push(`MI MEJOR ONCE AHORA: ${M.once.nombre}${M.once.huecos ? ` CON ${M.once.huecos} HUECOS` : ''}, unos ${String(Math.round(M.once.total * 10) / 10).replace('.', ',')} pts esperados (cada uno con su próximo rival y lo que se espera de él): ${M.once.lineas.map((l) => l.map((j) => `${j.nombre} (${partidoTxt(M, j)}, ~${d1(M.ppEsperado(j))})`).join(', ')).filter(Boolean).join(' | ')}${M.once.entrenador ? ` · entrenador ${M.once.entrenador.nombre}` : ''}.`);
    // el once que tiene puesto ahora en LaLiga (app.js lo guarda al mirarlo): si es el que le propones, no hay que alinear
    const g = !M.enJuego ? LS.get(K('mi-once'), null) : null;
    if (g && Date.now() - g.t < 2 * DIA && (g.ids || []).length >= 10) {
      const n = g.ids.map((id) => D.maestro[id] && D.maestro[id].nombre).filter(Boolean);
      L.push(`MI ONCE PUESTO AHORA EN LALIGA: ${n.join(', ')}. Si el once que me propones es este, NO pongas la operación de alinear (ya está hecho); si cambia, di solo quién entra y quién sale.`);
    }
    M._tit = tit;
  }
  const nt = notasTxt(D, M);
  if (nt) L.push(nt);
  L.push(chat ? '\nMIS JUGADORES (en corto: posición | nombre | equipo | valor | cambio | inercia | media | once probable | próximo partido y puntos esperados; los que nombra en su mensaje van enteros más abajo) + titular o suplente en mi once, cláusula, protección, riesgo, lo que pagué y lo que haría la app si lo vendo:'
    : '\nMIS JUGADORES (posición | nombre | equipo | valor | cambio | media | puntos | últimas jornadas con su rival | lo que rinde | once probable | previa del próximo partido | los dos siguientes) + titular o suplente en mi once, cláusula, protección, riesgo, lo que pagué y lo que haría la app si lo vendo:');
  const sinEl = (x) => {
    if (!x.j || x.j.pos === 5) return '';
    const pu = (M.puestos || []).find((p) => p.pos === x.j.pos);
    const min = x.j.pos === 1 ? 1 : Math.min(...(M.formaciones || [[3, 4, 3]]).map((f) => f[x.j.pos - 2]));
    if (pu && !['injured', 'suspended', 'out_of_league'].includes(x.j.estado) && pu.sanos - 1 < min) return ' | IMPRESCINDIBLE: sin él no puedo alinear una formación gratis';
    const pp = M.perdida ? M.perdida(x.pid) : 0;
    return pp >= 0.3 ? ` | si lo vendo, mi once pierde ${d1(pp)} pts/jornada` : ' | venderlo no quita nada a mi once';
  };
  for (const x of M.mias) L.push(`- ${chat ? lineaBreve(M, x.j) : lineaJ(M, x.j, x)} | ${M._tit && M._tit.has(x.pid) ? 'TITULAR' : 'suplente'}${sinEl(x)}${M.enVenta && M.enVenta.has(x.pid) ? ' | EN VENTA' : ''} | cláusula ${eur(x.clausula)}${x.ratio != null ? ` (${x.ratio <= 1.03 ? 'A SU VALOR: la presa más fácil' : `${pct((x.ratio - 1) * 100, 0)} sobre su valor`})` : ''} ${x.abierta ? 'ABIERTA (me lo pueden quitar ya)' : x.veda ? `a salvo por el cierre de cláusulas hasta que empiece la jornada ${x.veda.n} (${cuandoF(x.protegidoHasta)})` : `${x.escudo ? 'BLINDADO' : 'protegido'} hasta ${cuandoF(x.protegidoHasta)}, se abre a esa hora${M.escudosMios && M.escudosMios.quedan && !x.escudo ? ' (el blindaje, no antes de esa hora)' : ''}`}${(M.paraEscudo || []).includes(x.pid) ? ' | CONVIENE BLINDARLO HOY (gratis)' : ''} | ${x.ventaInercia ? `VENDER POR INERCIA (${x.ventaInercia.urgencia === 'ya' ? 'ya: ha girado' : 'antes de que gire'}) | ` : ''}${M.esperarVenta && M.esperarVenta(x).tipo ? `NO VENDER AÚN: ${M.esperarVenta(x).texto} | ` : ''}riesgo de cláusula ${x.riesgo}${x.pagan && (x.abierta || x.abreEn < 2 * DIA) && paganTxt(x.pagan) ? ` (${paganTxt(x.pagan)})` : ''}${blindajeTxt(x.blindaje) ? ` | ${blindajeTxt(x.blindaje)}` : ''}${x.compra ? ` | pagué ${eur(x.compra)} (${eur(x.ganado, { signo: true })})` : x.inicial ? ` | venía en mi equipo inicial: valía ${eur(x.inicial)} al empezar la liga (${eur(x.ganadoIni, { signo: true })})` : ' | no se sabe lo que pagué'}${ventaAppTxt(D, M, x.pid) ? ` | ${ventaAppTxt(D, M, x.pid)}` : ''}`);
  if (M.enJuego && M.vivo && M.vivo.n === M.enJuego.n && Array.isArray(M.vivo.once) && M.vivo.once.length) {
    const ahoraT = Date.now();
    const est = (pid) => {
      const j = M.J(pid);
      if (!j) return null;
      const pp = M.proximoPartido(j.equipoId), pts = M.puntosVivo ? M.puntosVivo(pid) : null;
      const jugado = pts != null || (pp && pp.jornada === M.enJuego.n && pp.fecha <= ahoraT);
      return `${j.nombre} (${jugado ? `ya jugando o jugado${pts != null ? `, ${pts} pts` : ''}` : pp && pp.jornada === M.enJuego.n ? `juega ${cuando(pp.fecha)}` : 'sin partido'})`;
    };
    L.push(`MI ONCE EN LALIGA PARA LA JORNADA ${M.enJuego.n} (EN JUEGO): ${M.vivo.once.map(est).filter(Boolean).join(', ')}. Ya no se puede cambiar (LaLiga cierra el once con el primer partido): no me propongas alineación ni el paso de alinear.`);
  }
  if (M.escudosMios) L.push(`BLINDAJES (el escudo de LaLiga, gratis viendo un anuncio): me quedan ${M.escudosMios.quedan} de 2 hasta que acabe la jornada ${(M.enJuego || M.proxima || {}).n || 'siguiente'}; cada uno protege la cláusula ${M.escudosMios.horas} h desde que se pone y SOLO se puede poner a un jugador con la cláusula ya abierta: a uno con la cláusula protegida o cerrada no se le puede poner hasta la hora en que se abre (te la paso con cada uno). No hay otra protección gratis ni otra forma de alargarla: no te inventes horas ni plazos distintos de los que te paso.`);
  if (M.vendidos && M.vendidos.length) {
    L.push('\nYA NO SON MÍOS (vendidos o clausulados estos días; NO cuentes con ellos para nada: ni para vender, ni para el once, ni para el dinero):');
    for (const v of M.vendidos) L.push(`- ${v.j.nombre}: ${v.como} ${cuando(v.t)}${v.importe ? ` por ${eur(v.importe)}` : ''}`);
  }
  if (M.misVentas && M.misVentas.length) {
    L.push('\nMIS JUGADORES EN VENTA Y SUS OFERTAS:');
    for (const v of M.misVentas) {
      const lg = v.liga ? ` [OFERTA DE LALIGA ${v.liga.posicion === 'baja' ? 'DE LAS MÁS BAJAS' : v.liga.posicion === 'alta' ? 'DE LAS ALTAS' : 'NORMAL'}: en esta liga suele dar entre ${pct(v.liga.p25 * 100)} y ${pct(v.liga.p75 * 100)}; mañana hará otra y lo normal sería ≈ ${eur(v.liga.esperado)} (${eur(v.liga.gana, { signo: true })} frente a la de hoy)${v.liga.prisa ? `; HAY PRISA: ${v.liga.prisa === 'negativo' ? 'si no vendes antes de la jornada empiezas en negativo' : 'está de baja'}` : '; no hay prisa'}]` : '';
      L.push(`- ${v.j.nombre} (vale ${eur(v.j.valor)}${v.compra ? `, pagué ${eur(v.compra)}` : ''}) puesto a ${eur(v.precio)}: ${v.ofertas.length ? v.ofertas.map((o) => `${o.de} ofrece ${eur(o.importe)} (${pct(o.sobre * 100)} sobre su valor${o.caduca ? `, caduca ${cuando(o.caduca)}` : ''})`).join('; ') : 'sin ofertas todavía'}${lg}${v.ligaEst ? `; la de LaLiga rondará ${eur(v.ligaEst.v)}` : ''}${v.mejor ? ` → la app aconseja ${v.consejo.toUpperCase()}: ${v.porque}` : ''}`);
    }
  }
  if (M.ventanaEsp) {
    const v = M.ventanaEsp;
    if (v.ciclos < 1) L.push(`\nNO ESPECULES AHORA: ${M.enJuego ? `la jornada ${M.enJuego.n} está en juego y antes de la siguiente no da tiempo` : 'antes de la jornada no queda ningún cambio de mercado que cuente para revender (el del mismo día en que empieza la jornada no da tiempo a vender)'}. Lo que compre ahora no lo puede vender a tiempo: nada de comprar «para revender». Esto es solo para revender: para FICHAR y alinear, lo que se gane en la subasta sí llega (mira EL MERCADO CAMBIA).`);
    else L.push(`\nESPECULAR: hasta la jornada quedan ${v.ciclos} cambio${v.ciclos === 1 ? '' : 's'} de mercado que cuentan (${v.cambios.map((t) => cuando(t)).join(', ')}); el del mismo día que empieza la jornada NO cuenta. Lo de revender se pone a la venta ${cuando(v.ponerVenta)} para aceptar la oferta del cambio de ${cuando(v.ultimoMercado)}. Una compra en el mercado llega en el siguiente cambio y luego hay que ponerla a la venta: necesita 2 cambios; una cláusula, 1. Margen: puede bajar hasta −${eur(M.deuda)} entre medias.${M.enJuego ? ` La jornada ${M.enJuego.n} está en juego, pero se puede comprar YA para revender antes de la ${M.proxima ? M.proxima.n : 'siguiente'}: el valor sigue cambiando cada día (y con lo que haga en su partido si aún juega esta jornada); lo que no vale es vender en los cambios de mientras se juega.` : ''}`);
    if (M.paraRevender && M.paraRevender.length) L.push(`COMPRADOS PARA REVENDER: ${M.paraRevender.map((x) => `${x.j.nombre} (comprado a ${eur(x.rev.precio)}, vale ${eur(x.j.valor)}, ${eur(x.beneficioYa, { signo: true })})`).join('; ')}.`);
    if (M.especular && M.especular.length) {
      L.push('CANDIDATOS PARA REVENDER SEGÚN LA TENDENCIA (precio de compra | subida diaria | valor esperado el día de vender | beneficio):');
      for (const e of M.especular.slice(0, 10)) L.push(`- ${e.j.nombre} (${POS[e.j.pos]}, ${e.j.equipo}) | ${e.origen === 'mercado' ? `mercado, pujar ${eur(e.puja)}` : `cláusula ${eur(e.precio)} a ${e.rival.manager || e.rival.nombre}`} | ${pct(e.r * 100)}/día | ${eur(e.valorFuturo)} | ${eur(e.beneficio, { signo: true })}${e.vuelve ? ` | VUELVE: llegó a valer ${eur(e.vuelve.max)} esta temporada, juega otra vez y lleva ${e.vuelve.racha} días subiendo` : ''}`);
    }
  }
  L.push(`\nRIVALES (pos | equipo | manager | puntos | valor | lo que han subido de valor sus jugadores en 7d (sin contar fichajes ni ventas) | movimientos 7d | gastado 7d | cláusulas que han hecho en 14d | peligro | su dinero | lo que suele pagar en el mercado | mis cláusulas que le llegan)${M.dineroExacto ? '' : `. Su dinero, si no es exacto, sale de todos vuestros movimientos desde el principio de la liga (empezasteis con lo mismo); el margen es la recompensa diaria, que no sale en los movimientos`}:`);
  for (const r of M.rivales) L.push(`- ${r.e.pos}º | ${r.e.nombre} | ${r.e.manager} | ${r.e.puntos} pts | ${eur(r.e.valor)} | ${r.dValor != null ? eur(r.dValor, { signo: true }) : '?'} | ${r.movs} | ${eur(r.gastado)} | ${r.clausulazos}${r.contraMi ? ` (${r.contraMi} a mí)` : ''} | ${r.nivel} | ${dineroDe(r.dinero, r.e.valor)} | ${r.paga ? `paga de mediana ${pct(r.paga.med * 100)} sobre el valor (${r.paga.n} compras, como mucho ${pct(r.paga.max * 100)})` : 'sin compras al mercado'} | ${bloqueada('quienPaga') ? 'no lo sabes (función top cerrada)' : r.leLlegan.length ? `${r.leLlegan.filter((x) => x.abierta).length} abiertas y ${r.leLlegan.filter((x) => !x.abierta).length} que se abren pronto (la más cara, ${(() => { const x = [...r.leLlegan].sort((a, b) => b.clausula - a.clausula)[0]; return `${x.j.nombre} ${eur(x.clausula)}`; })()})` : 'ninguna'}`);
  // cómo juega cada uno, con todo el historial (función top «perfilRival»: si está cerrada, la usa sin contarla)
  if (M.perfil) {
    const yoT = D.yo && D.yo.teamId;
    const pf = M.rivales.map((r) => {
      const P = M.perfil(r.e.teamId);
      if (!P || !P.n) return null;
      const t = [`${P.cz.n} clausulazo${P.cz.n === 1 ? '' : 's'}${P.cz.n && P.cz.med != null ? ` (de mediana ${pct(P.cz.med * 100)} sobre el valor)` : ''}${yoT && P.cz.victimas[yoT] ? `, ${P.cz.victimas[yoT]} a mí` : ''}`];
      if (P.ventas.dias != null && P.ventas.nDias >= 2) t.push(`vende a los ~${Math.max(1, Math.round(P.ventas.dias))} días de fichar`);
      if (P.escudos + P.subidas) t.push(`se ha protegido ${P.escudos + P.subidas} veces`);
      if (P.franja && P.franja.pct >= 0.4) t.push(`clausula, vende y protege sobre todo de ${P.franja.ini} a ${P.franja.fin} h`);
      // los que no hacen nada que destaque, fuera (es ruido)
      if (!P.cz.n && t.length === 1) return null;
      return `- ${r.e.manager || r.e.nombre}: ${t.join('; ')}`;
    }).filter(Boolean);
    if (pf.length) L.push(`\nCÓMO JUEGA CADA RIVAL (todo lo que ha hecho en la liga${M.histMov && M.histMov.completa ? '' : ', con lo que se ha podido leer'}):`, ...pf);
  }
  if (M.clausulazos && M.clausulazos.n >= 3) L.push(`\nLOS CLAUSULAZOS DE ESTA LIGA (${M.clausulazos.n}): se han pagado de mediana un ${pct(M.clausulazos.med * 100)} sobre el valor del jugador; el 90 % no pasa de ${pct(M.clausulazos.p90 * 100)}. Una cláusula tuya muy por encima de eso no corre peligro.`);
  if (M.ofertaLiga && !M.ofertaLiga.poco) L.push(`\nLO QUE OFRECE LALIGA por lo que se pone a la venta en esta liga (${M.ofertaLiga.n} ventas): de mediana ${pct(M.ofertaLiga.med * 100)} sobre el valor (la mitad entre ${pct(M.ofertaLiga.p25 * 100)} y ${pct(M.ofertaLiga.p75 * 100)}). Las ofertas de otros managers por los jugadores de un rival no se ven (solo cuántas hay).`);
  // que te lo clausulen no es una venta: con la cláusula a su valor te lo quitan barato (y reponerlo cuesta más)
  {
    const vLiga = M.ofertaLiga && !M.ofertaLiga.poco ? M.ofertaLiga.med : null, pLiga = M.pujasLiga && !M.pujasLiga.poco ? M.pujasLiga.med : null;
    L.push(`\nQUE TE LO CLAUSULEN: es perderlo por su cláusula. Solo te sale bien si la cláusula pasa claramente de lo que sacarías vendiéndolo${vLiga != null ? ` (LaLiga da de mediana ${pct(vLiga * 100)} sobre el valor en esta liga)` : ''} y no te quita puntos ni lo que iba a subir; para reponerlo pagas más de lo que vale${pLiga != null ? ` (aquí se puja de mediana ${pct(pLiga * 100)})` : ''}. Una cláusula a su valor, o casi, es la presa más fácil: es justo lo que buscan los que clausulan.`);
  }
  const PL = M.pujasLiga;
  const tramoTxt = (x) => (x.desde === 0 ? `menos de ${eur(x.hasta, { dec: 0 })}` : x.hasta === Infinity ? `más de ${eur(x.desde, { dec: 0 })}` : `de ${eur(x.desde, { dec: 0 })} a ${eur(x.hasta, { dec: 0 })}`);
  if (PL && !PL.poco) {
    L.push(`\nLO QUE SE PAGA EN ESTA LIGA POR LOS LIBRES DEL MERCADO (${PL.n} compras de las últimas 6 semanas, sobre el valor que tenían ese día): mediana ${pct(PL.med * 100)}, la mitad entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)}, el 10 % más alto ${pct(PL.p90 * 100)} o más. Eso mezcla jugadores de todos los valores, y cuanto más barato, más se paga en porcentaje: NO lo uses para un jugador concreto${PL.tramos && PL.tramos.length ? `. Por tramos de valor: ${PL.tramos.map((x) => `${tramoTxt(x)}, mediana ${pct(x.med * 100)}, 3 de cada 4 hasta ${pct(x.p75 * 100)} y el 90 % hasta ${pct(x.p90 * 100)} (${x.n} compras)`).join('; ')}` : ''}. Con cada puja (P-) te paso lo que se paga aquí por los de su valor, en porcentaje y en euros: esa es la referencia. Últimas: ${PL.ult.slice(0, 6).map((x) => `${(D.maestro[x.pid] || {}).nombre || '?'} ${eur(x.imp)} (${pct(x.s * 100)}, ${x.tid ? nombreTid(M, x.tid) : '?'})`).join('; ')}.`);
  }
  // lo que se puede hacer hoy, cada cosa con los datos de su jugador (forma, once, rivales, prensa)
  const cat = catDe(D, M);
  L.push('');
  // en el chat, los candidatos sin su ficha entera (los que nombra van completos aparte): la pregunta llega antes
  L.push(M.noticiasFallo && !M.noticiasFallo.viejas ? 'PRENSA: hoy no se han podido leer los titulares; que un jugador no lleve PRENSA no quiere decir que no haya noticias.'
    : 'PRENSA: con cada jugador van los titulares de los últimos 3 días que lo nombran («PRENSA: …»); si no lleva, no ha salido nada de él.');
  // los candidatos que no pueden jugar (lesionados, sancionados, fuera) o casi seguro suplentes van sin su ficha entera:
  // no se van a recomendar y la ficha solo hace bulto
  const sinFicha = (o) => esMalo(o.j) || (M.titularidad && o.j.pos < 5 && (() => { const T = M.titularidad(o.j); return T && T.p != null && T.p < 0.2; })());
  L.push(catalogoTxt(D, M, cat, { corto, chat, ver: veredictos(D, M), datos: chat ? null : (o) => (['A', 'V', 'B'].includes(o.ref[0]) ? null : sinFicha(o) ? `${o.j.nombre}: ${esMalo(o.j) ? `ESTADO ${o.j.estado}` : 'casi seguro suplente'}; no lo recomiendes` : `${lineaJ(M, o.j, { tend: M.tend(o.pid) })} | interés ${o.interes != null ? o.interes : '?'}/100 | ${mejoraTxt(M, o.j)}${prensaTxt(M, o.pid)}`) }));
  // los que sigue con la estrella (Mercado → Favoritos): que la IA sepa qué le interesa, con cómo se consiguen hoy
  {
    const fav = favoritos().map((pid) => M.J(pid)).filter((j) => j && M.dueno[j.id] !== D.yo.teamId).slice(0, chat ? 6 : 10);
    if (fav.length) L.push(`\nJUGADORES QUE SIGO (los marqué como favoritos; si alguno se puede conseguir hoy y encaja, tenlo en cuenta, pero no lo fiches solo por estar aquí):\n${fav.map((j) => `- ${j.nombre} (${POS[j.pos] || '?'}, ${j.equipo || '?'}, vale ${eur(j.valor)}): ${comoConseguir(D, M, j.id, cat)}`).join('\n')}`);
  }
  if (!corto) {
    L.push('\nLOS QUE MÁS SUBEN HOY (libres o míos; los de los rivales solo se consiguen por su cláusula, que ya va arriba):');
    for (const x of M.suben.filter((y) => !y.dueno || y.dueno === D.yo.teamId).slice(0, 12)) L.push(`- ${x.j.nombre} (${x.j.equipo}, ${eur(x.j.valor)}) ${x.t.d1 != null ? eur(x.t.d1, { signo: true }) : ''} · ${x.dueno ? (x.dueno === D.yo.teamId ? 'MÍO' : `de ${(M.equipo[x.dueno] || {}).nombre}`) : 'libre'}`);
    L.push('LOS QUE MÁS BAJAN HOY (libres o míos):');
    for (const x of M.bajan.filter((y) => !y.dueno || y.dueno === D.yo.teamId).slice(0, 10)) L.push(`- ${x.j.nombre} (${x.j.equipo}, ${eur(x.j.valor)}) ${x.t.d1 != null ? eur(x.t.d1, { signo: true }) : ''} · ${x.dueno ? (x.dueno === D.yo.teamId ? 'MÍO' : `de ${(M.equipo[x.dueno] || {}).nombre}`) : 'libre'}`);
    if (M.jornadas.length) {
      L.push('\nCALENDARIO (próximas jornadas):');
      for (const j of M.jornadas.filter((x) => x.fin > Date.now()).slice(0, 2)) L.push(`- Jornada ${j.n}: ${j.partidos.map((p) => `${p.local}-${p.visitante} ${cuando(p.fecha)}`).join('; ')}`);
    }
  }
  if (M.tabla && M.tabla.length) {
    L.push('\nCLASIFICACIÓN DE LALIGA Y CÓMO LE VA A CADA EQUIPO (últimos 5: V victoria, E empate, D derrota):');
    for (const t of M.tabla) L.push(`- ${t.pos}º ${t.nombre}: ${t.pts} pts en ${t.pj} PJ (${t.gf}-${t.gc}) · últimos ${rachaTxt(M, t.id) || '?'}`);
  }
  if (M.ultimaJornada) L.push(`ÚLTIMA JORNADA (${M.ultimaJornada.n}): ${M.ultimaJornada.partidos.map((p) => `${(D.equipos[p.localId] || {}).nombre || p.localId} ${p.gl}-${p.gv} ${(D.equipos[p.visitanteId] || {}).nombre || p.visitanteId}`).join(' · ')}`);
  if (M.noticias && M.noticias.length) {
    const tit = (n) => `${n.t ? `${cuando(n.t)}: ` : ''}«${n.titulo}»${n.fuente && !esWebFantasy(n.fuente) ? ` (${n.fuente})` : ''}`;
    // por equipo: los de mis jugadores y los de los candidatos
    const eqs = [...new Set([...M.mias.map((x) => x.j && x.j.equipoId), ...cat.lista.filter((o) => ['P', 'M', 'T', 'C'].includes(o.ref[0])).slice(0, 25).map((o) => o.j.equipoId)].filter(Boolean))];
    const porEq = eqs.map((id) => ({ id, ns: M.noticias.filter((n) => (n.equipos || []).includes(id)).slice(0, corto ? 2 : 3) })).filter((x) => x.ns.length);
    if (porEq.length) {
      L.push('\nNOTICIAS DE CADA EQUIPO (últimos días: lesiones, convocatorias, ruedas de prensa, alineaciones):');
      for (const x of porEq) L.push(`- ${(D.equipos[x.id] || {}).nombre || x.id}: ${x.ns.map(tit).join(' · ')}`);
    }
    const usadas = new Set(porEq.flatMap((x) => x.ns));
    const resto = M.noticias.filter((n) => !usadas.has(n)).sort((a, b) => (b.t || 0) - (a.t || 0));
    L.push(`\nOTROS TITULARES (fantasy y LaLiga en general):`);
    for (const n of resto.slice(0, corto ? 10 : 22)) L.push(`- ${tit(n)}`);
  } else if (M.noticiasFallo) {
    L.push('\nNOTICIAS: hoy no se han podido leer los titulares (Google Noticias no contesta). Que no te pase noticias de un jugador NO quiere decir que no las haya: no digas que no hay lesiones ni bajas; si tienes la búsqueda de Google, úsala para lo que importe.');
  }
  const ap = aprendeTxt(M);
  if (ap) L.push(ap);
  const act = M.actividad.filter((a) => a.t && Date.now() - a.t < 7 * DIA && a.clase !== 'premio').slice(0, chat ? 12 : corto ? 20 : 45);
  if (act.length) {
    L.push('\nMOVIMIENTOS DE LA LIGA (7 días):');
    for (const a of act) L.push(`- ${cuando(a.t)}: ${a.esYo ? 'YO' : a.quien || '?'} ${({ compra: 'fichó', clausula: 'clausuló', venta: 'vendió', blindaje: 'blindó', entra: 'entró' })[a.clase] || 'movió'} ${a.nombreJ || ''}${a.clase === 'blindaje' ? ' (escudo gratis)' : a.importe ? ` por ${eur(a.importe)}` : ''}${a.otro && a.otro !== a.quien ? ` a ${a.contraMi ? 'MÍ' : a.otro}` : ''}`);
  }
  return L.join('\n');
}

/* (revisión de la IA, 14 nov) El sistema, rehecho: de 24.500 caracteres a menos de 10.000. Las reglas de LaLiga van una sola
   vez, numeradas y comprobadas con Carlos (13 nov: oferta directa a cualquier jugador de un rival, 14 días de cláusula
   cerrada tras cualquier fichaje, la oferta de LaLiga llega en el siguiente cambio de mercado, el tope de deuda suma todas
   las pujas). Lo que antes eran párrafos de «cómo calcular» (cuándo vender, cuánto es pagar de más, la salida de un
   clausulazo, el calendario) ahora lo decide la app antes de preguntar (veredictos) y aquí solo se explica cómo elegir.
   Se quitan las contradicciones: «no se puede comprar a un rival que no vende» frente a «se cierra con una oferta desde
   su ficha», y «lo que pide» para el precio que un rival pone en el mercado. */
const SISTEMA = `Eres el director deportivo de un manager de LaLiga Fantasy (el juego oficial de LaLiga) en una liga privada. Tu trabajo es decirle qué hacer cada día para ganar la liga y hacer crecer el valor de su equipo. Hablas en español de España como un director deportivo de verdad: cercano pero serio, claro, con criterio y con cifras. {{CHISTES}} Si te pregunta qué IA o qué modelo eres, di que eres el director deportivo de Fantasy Manager, sin decir el nombre ni la versión del modelo ni de quién es. No le atribuyas al manager ganas, miedos ni decisiones que no te ha dicho: si necesitas saberlo, pregúntaselo.

REGLAS DE LALIGA FANTASY (comprobadas; si algo de lo que vayas a decir choca con una de estas, está mal):
1. CLÁUSULAS. Cada jugador tiene una. Con la protección acabada, cualquiera la paga y se lo lleva al instante. Una cláusula SOLO se paga con el SALDO que hay en ese momento: nunca con deuda ni con el dinero de lo que está en venta sin aceptar. Tras CUALQUIER fichaje (mercado, clausulazo o compra a otro manager) la cláusula del jugador queda cerrada 14 días. Si el valor pasa la cláusula, LaLiga la sube sola hasta el valor. El dueño puede subirla pagando (pagar X la sube 2X).
2. CIERRE. En las 24 h antes del primer partido de cada jornada nadie puede clausular a nadie; se reabren justo a la hora de ese primer partido (te paso cada cláusula ya con la hora en que de verdad se puede pagar).
3. EL ONCE se cierra con el primer partido de la jornada y no se puede tocar hasta la siguiente, ni a los que aún no han jugado. Lo que se ficha o se clausula después no puntúa en esa jornada.
4. BLINDAJE (el escudo): 2 por jornada, gratis viendo un anuncio, 24 h (48 h en ligas Premium), y SOLO se puede poner con la cláusula ya abierta. «Blindar» y «blindaje» son solo eso; pagar para que la cláusula suba es «subir la cláusula» (en el plan, su acción es también "blindar", con su importe).
5. MERCADO DE LIBRES: jugadores que no son de nadie; se puja a ciegas desde su precio y se los lleva la puja más alta cuando cambia el mercado (cada día).
6. DEUDA: puede quedarse en negativo hasta el % del valor del equipo que te digo, pero SOLO pujando o comprando en el mercado, y cuenta la SUMA de todas las pujas que tenga puestas. Si empieza una jornada en negativo, no puntúa: eso es lo único obligatorio.
7. VENDER: pone al jugador en el mercado; la oferta de LaLiga NO llega al momento, llega en el siguiente cambio de mercado, y en cada cambio hace una nueva. El dinero entra al aceptar una oferta, no antes.
8. JUGADORES DE OTROS MANAGERS, tres caminos distintos: (a) su CLÁUSULA, cuando esté abierta: es el único seguro. (b) Lo tiene EN VENTA: el precio lo pone él a su gusto (muchas veces absurdo, solo para ver qué le ofrece LaLiga) y es el MÍNIMO: por debajo no se puede ofertar; él recibe además la oferta de LaLiga y se queda con la mejor. Ese precio no es un trato ni algo que «le pida» al manager. (c) NO lo tiene en venta: se le puede hacer una oferta igualmente desde la ficha del jugador, pero decide su dueño y lo normal es que no acepte por menos de lo que le daría LaLiga. Solo es un TRATO si el manager te cuenta que el otro le ha ofrecido el jugador A ÉL por una cifra.
9. Un CAMBIO entre managers son dos compras, cada una a su precio (su valor, si no acuerdan otro): nadie regala ni pierde la diferencia, y cada jugador estrena 14 días de cláusula cerrada.
10. PLANTILLA: 25 jugadores como mucho. Juega con la versión gratis: solo las formaciones que te digo y SIN ENTRENADOR (no se alinea ni puntúa: nunca recomiendes fichar uno; si tiene alguno, es dinero parado).

LA APP DECIDE, TÚ ELIGES Y EXPLICAS. La app ya ha hecho las cuentas y ha comprobado cada operación con las reglas de arriba y con los datos de su liga:
- En «OPERACIONES POSIBLES HOY» solo está lo que se puede hacer y la app daría por bueno; cada una lleva «→ LA APP: …» con para qué vale y sus avisos. Lo de «LO QUE LA APP YA HA DESCARTADO HOY» no se recomienda (si te preguntan por uno, explica el motivo que te paso). Un jugador de un rival que no está ahí no entra en el plan.
- Con sus jugadores, cada uno lleva lo que haría la app si lo vende. «LA APP: NO LO VENDERÍA HOY» manda: no le digas que lo venda, salvo que el dinero haga falta de verdad para otra operación de hoy o que él te dé un dato nuevo, y entonces dilo.
- Las cifras se COPIAN de los datos: valor, cláusula, saldo, lo que pagó, la puja de la app, la subida justa, la oferta mínima, fechas y horas. No las redondees a otra cosa ni las cambies de un mensaje a otro. Si haces una cuenta, que sea una suma o una resta sencilla, escrita con sus cifras («6,43 M + 66,17 M = 72,60 M»), y repásala.
- Lo que no esté en los datos, no lo sabes: dilo así en vez de inventarlo (un precio «pactado», lo que LaLiga le ofrece hoy a un rival, una lesión que no sale).
Tu parte es elegir entre lo que vale, ordenarlo para que el dinero cuadre y explicarlo: por qué ahora, qué riesgo tiene y qué haría falta para cambiar de idea. Mejor no hacer nada que hacer algo dudoso.

CÓMO DECIDIR entre lo que vale:
- DOS TIPOS DE FICHAJE, y di cuál es: para su ONCE (entra de titular y da puntos) o para REVENDER (sube y se vende con beneficio antes de la jornada; da igual que no lo vaya a alinear o que ya tenga a otro en su puesto). Para revender tiene que seguir subiendo hasta el día de venderlo y tiene que dar tiempo (te paso los cambios de mercado que quedan). Los marcados VUELVE (se hundieron por lesión o por no jugar, juegan otra vez y suben varios días seguidos) son la especulación más clara.
- ¿JUEGA Y PUNTÚA? Once probable, minutos, lesión, sanción y prensa. Si lleva ALINEACIÓN CONFIRMADA, eso manda. Elige por los PUNTOS ESPERADOS de su próximo partido (ya cuentan el rival, casa o fuera y la portería a cero), no por su media ni por su nombre: un portero o un defensa contra un equipo que marca mucho puntúa poco; un delantero contra una defensa que no encaja, también. Su CALENDARIO (próximos partidos) cuenta para fichar, no para vender.
- ¿QUÉ CUESTA? Lo que se paga por encima del valor se pierde: importan los EUROS, no solo el porcentaje (un +25 % son 750 mil en uno de 3 M y 10 M en uno de 40 M). Te paso el índice de sobrecoste y hasta dónde es aguantable; dilo en euros. La puja sale de lo que se paga en esta liga por los de su valor (te lo paso): como poco, la de la app.
- INERCIA DEL VALOR: mira hacia dónde va AHORA (lo que cambia cada día), no el total de la semana. Si sube cada vez menos, está frenando y va a girar; si ha girado, lo normal es que siga bajando varios días. Un buen partido reciente (te lo marco) puede frenar la bajada o darle la vuelta.
- VENDER: solo si hace falta el dinero (empezaría la jornada en negativo o paga una operación de hoy que compense), si está de baja o se hunde, si ha girado y no es imprescindible, o si la oferta es buena. Ser suplente, un calendario duro o «hacer caja» no son motivo. Di siempre cuánto gana o pierde frente a lo que pagó y a cuánto está su cláusula. Si la oferta de LaLiga de hoy es de las bajas y no hay prisa, que espere a la del siguiente cambio de mercado.
- RIESGO DE CLÁUSULA (que le quiten a uno suyo): te lo paso calculado con el dinero de cada rival y lo que se paga en esta liga; no lo rebajes sin un dato nuevo y no lo mezcles con lo difícil que sea su calendario. Si le clausulan, cobra la cláusula, pero con la cláusula en su valor o cerca es REGALARLO (pierde sus puntos y lo que suba, y reponerlo cuesta más): nunca digas que le viene bien ni que «hace caja». Para protegerlo: primero el blindaje gratis si está abierta y le quedan; si no, la «subida justa» que te paso (no una cifra tuya), y solo si el jugador lo merece. Si no compensa, dilo: es un riesgo que asume.
- EL DINERO: para clausular, solo el saldo de ahora (o el que tendría aceptando antes las ofertas que ya tiene); para pujar, el saldo más el margen de deuda menos lo ya pujado. Entre semana puede tirar de deuda para especular si antes de la jornada vuelve a positivo vendiendo: dile qué día vender cada cosa.
- LOS RIVALES: mira qué hacen y quién puede ir a por sus jugadores (el que clausula a menudo y le llega es el peligro de verdad). Un rival sin dinero no puja fuerte ni clausula.
- EL PARÓN: nadie puntúa hasta la vuelta y lo que manda es el dinero (mira PRIORIDAD EN EL PARÓN si te la paso).
- LO QUE TE CUENTA EL MANAGER (tratos, ofertas por privado, lo que ha hecho o no quiere vender) cuenta tanto como los datos. Un trato se cierra con una oferta por ese importe desde la ficha del jugador: valóralo por su valor, lo que sube al día, si entra en su once y si le llega el dinero.
- APRENDE: en «CÓMO VAN TUS ACIERTOS» te digo cuánto fallan los puntos esperados y cómo salieron tus recomendaciones; si algo salió mal, no lo repitas.

DATOS Y FUENTES: usa lo que te paso (cifras en millones, «12,4 M», fechas y horas exactas) y no inventes jugadores ni cifras. No digas de qué web sale nada ni nombres webs de fantasy o de onces (ni con un «según»): di «la prensa» o «los onces probables». Si tienes la búsqueda de Google, úsala solo para lo que pueda cambiar una decisión (lesiones, sanciones, convocatorias, onces de última hora, rotaciones); si no has encontrado noticias, dilo. Confianza «alta» solo si todo cuadra y hay un dato que lo respalda.
{{PULLITAS}}`;
/** las pullitas, al gusto (Ajustes > Pullitas de la IA): normal es como siempre ha sido */
const PULLITAS = {
  normal: 'PULLITAS: si sale alguna noticia extradeportiva con gracia (que le han entrado a robar en casa, una fiesta, un tatuaje nuevo, un lío en redes, un cambio de look), cuéntala con una pullita corta y con chispa, como lo haría un colega del grupo. También puedes soltarle alguna a los rivales por lo que hacen (el que acumula millones y no ficha, el que paga de más por todo, el que se deja las cláusulas abiertas). Con gracia y sin crueldad: nada de reírte de lesiones graves, enfermedades, muertes, violencia contra personas ni de la familia. Lo extradeportivo NUNCA es motivo para comprar ni vender: la pullita va aparte y el motivo de la operación tiene que ser deportivo o de valor (minutos, forma, rival, inercia, precio). En «noticias», lo extradeportivo va con efecto «neutro». Una o dos pullitas por plan o por respuesta como mucho, que no se coman la información.',
  saco: 'PULLITAS: si sale alguna noticia extradeportiva con gracia (que le han entrado a robar en casa, una fiesta, un tatuaje nuevo, un lío en redes, un cambio de look), cuéntala con una pullita corta y con chispa, como lo haría un colega del grupo. También puedes soltarle alguna a los rivales por lo que hacen (el que acumula millones y no ficha, el que paga de más por todo, el que se deja las cláusulas abiertas). Con gracia y sin crueldad: nada de reírte de lesiones graves, enfermedades, muertes, violencia contra personas ni de la familia. Lo extradeportivo NUNCA es motivo para comprar ni vender: la pullita va aparte y el motivo de la operación tiene que ser deportivo o de valor (minutos, forma, rival, inercia, precio). En «noticias», lo extradeportivo va con efecto «neutro». Una o dos pullitas por plan o por respuesta como mucho, que no se coman la información.'.replace('Una o dos pullitas por plan o por respuesta como mucho, que no se coman la información.', 'Aquí le gustan a saco: con más mala leche de colega y sin cortarte con los rivales (siempre con los mismos límites de arriba), dos o tres por plan o por respuesta, que no se coman la información.'),
  suave: 'PULLITAS: si sale alguna noticia extradeportiva con gracia (una fiesta, un tatuaje nuevo, un cambio de look), puedes contarla en una línea con un toque de humor amable. No te metas con los rivales por su nombre. Lo extradeportivo NUNCA es motivo para comprar ni vender. En «noticias», lo extradeportivo va con efecto «neutro». Una como mucho por plan o por respuesta.',
  no: 'SIN PULLITAS: no hagas bromas ni te metas con nadie. Si sale una noticia extradeportiva que afecte al jugador, cuéntala en una línea, seria. Lo extradeportivo NUNCA es motivo para comprar ni vender. En «noticias», lo extradeportivo va con efecto «neutro».',
};
/** las instrucciones de la IA con las pullitas elegidas */
function reglasBloqueo() {
  return bloqueoTxt(Object.keys(SOBRE_BLOQUEO).filter((k) => bloqueada(k)), topConAnuncio());
}
const sistemaIA = () => {
  const p = cfgIA().pullitas || 'normal';
  return SISTEMA.replace('{{CHISTES}}', CHISTES[p === 'normal' || p === 'saco' ? 'broma' : 'serio']).replace('{{PULLITAS}}', PULLITAS[p] || PULLITAS.normal) + reglasBloqueo();
};

/* ---------------- el plan del día ---------------- */
export const planes = () => LS.get(K('planes'), []);
export const ultimoPlan = () => planes()[0] || null;

/** lo que te recomendó los últimos días y lo que hiciste desde entonces, para que siga el hilo */
/* (revisión total, M3) lo que le llega a la IA de un plan suyo es lo que dejó la app, no lo que escribió: lo descartado
   va como descartado (con el porqué, corto), lo de sin prisa como sugerencia y lo ya hecho como hecho. Antes recibía como
   «te recomendé» una cláusula que la app había quitado por saldo */
const motivoCorto = (t) => {
  const s = String(t || ''), m = s.match(/La app (?:lo )?descarta[^:.]*[:.]?\s*(.*)$/i);
  return (m ? m[1] : s).replace(/^[.:\s]+/, '').split(/\.\s/)[0].slice(0, 160);
};
export function opsCuadradas(ops) {
  return (ops || []).map((o) => ({
    accion: o.etiqueta === 'Aceptar oferta' ? 'aceptar' : o.etiqueta === 'Subir cláusula' ? 'subir cláusula' : o.accion,
    jugador: (o.j && o.j.nombre) || o.jugador || '',
    importe: o.importe || null,
    estado: o.ya ? 'hecho' : o.descartada ? 'descartada' : o.sugerencia ? 'sugerencia' : 'ok',
    porque: o.descartada ? motivoCorto(o.aviso) : null,
  }));
}
export function opsTxt(l) {
  return (l || []).map((o) => `${o.accion} ${o.jugador}${o.importe ? ` ${eur(o.importe)}` : ''}${o.estado === 'descartada' ? ` (LA APP LO DESCARTÓ${o.porque ? `: ${o.porque}` : ''}; no lo recomendaste al final)` : o.estado === 'sugerencia' ? ' (sugerencia sin prisa)' : o.estado === 'hecho' ? ' (ya hecho)' : ''}`).join('; ');
}
function memoria(M) {
  const P = planes().slice(0, 3);
  if (!P.length) return '';
  const L = ['\nLO QUE TE RECOMENDÉ LOS ÚLTIMOS DÍAS (como lo dejó la app, que comprueba cada paso):'];
  for (const p of P) L.push(`- ${cuando(p.t)}: ${p.titular || ''} → ${p.cuadradas ? opsTxt(p.cuadradas) || 'nada' : `${(p.operaciones || []).map((o) => `${o.accion} ${o.jugador || ''}${o.importe ? ` ${eur(o.importe)}` : ''}`).join('; ')} (de antes: sin comprobar por la app)`}`);
  const desde = P[P.length - 1].t;
  const mias = M.actividad.filter((a) => a.esYo && a.t > desde);
  L.push(mias.length ? `LO QUE HAS HECHO DESDE ENTONCES: ${mias.map((a) => `${a.clase} ${a.nombreJ}${a.importe ? ` ${eur(a.importe)}` : ''}`).join('; ')}` : 'DESDE ENTONCES NO HAS HECHO NINGÚN MOVIMIENTO.');
  return L.join('\n');
}

// Sin búsqueda en Google (apagada, cupo gastado o un modelo que no contesta con ella) no se le manda buscar: si se le manda, a veces
// intenta llamar a una herramienta que no tiene y contesta vacío (MALFORMED_FUNCTION_CALL, 26 oct, 100 s para nada)
const BUSCAR_PLAN = `Busca en Google solo lo que pueda cambiar una decisión (como mucho 8 búsquedas): los jugadores que vayas a meter en operaciones o en la alineación con la titularidad por debajo del 70 % o con ESTADO, y las lesiones o convocatorias de última hora de sus equipos; contrástalo con los titulares que te paso. Después sigue «CÓMO DECIDIR» con cada candidato.`;
const SIN_BUSCAR_PLAN = 'Decide con los datos, los titulares de prensa y los onces probables que te paso, sin buscar en Google (si algo no lo sabes, dilo sin inventarlo). Sigue «CÓMO DECIDIR» con cada candidato.';
/* (revisión total, M5 y A6) el formato del plan como esquema JSON de Gemini: la respuesta llega como JSON y `accion` solo
   puede ser una de las que la app sabe hacer. Sin la búsqueda (con ella Google no deja pedir JSON en todas las versiones);
   si un modelo lo rechaza, esa pregunta sigue sin esquema y `sacarJSON` lo lee como siempre */
export const ACCIONES_PLAN = ['aceptar_oferta', 'vender', 'pujar', 'comprar', 'clausular', 'blindar', 'alinear', 'esperar'];
const T = (type, extra = {}) => ({ type, ...extra });
const TXT = T('STRING'), NUM = T('NUMBER', { nullable: true }), TXTN = T('STRING', { nullable: true });
export const ESQUEMA_PLAN = T('OBJECT', {
  properties: {
    cuentas: T('OBJECT', { properties: { caja_hoy: NUM, caja_con_ofertas: NUM, pujas_hechas: NUM, huecos_once: NUM } }),
    situacion: TXT,
    descartes: T('ARRAY', { items: T('OBJECT', { properties: { jugador: TXT, ref: TXTN, motivo: TXT }, required: ['jugador', 'motivo'] }) }),
    operaciones: T('ARRAY', { items: T('OBJECT', {
      properties: {
        ref: TXTN, motivo: TXT, claves: T('ARRAY', { items: TXT }), accion: T('STRING', { enum: ACCIONES_PLAN }), jugador: TXT, donde: TXTN,
        importe: NUM, puja_max: NUM, cuando: TXTN, dia: TXTN, saldo_tras: NUM, objetivo: T('STRING', { enum: ['titular', 'revender', 'caja', 'proteger'], nullable: true }),
        vender_el: TXTN, beneficio_esperado: NUM, confianza: T('STRING', { enum: ['alta', 'media', 'baja'], nullable: true }),
      },
      required: ['accion', 'jugador', 'motivo'],
      propertyOrdering: ['ref', 'motivo', 'claves', 'accion', 'jugador', 'donde', 'importe', 'puja_max', 'cuando', 'dia', 'saldo_tras', 'objetivo', 'vender_el', 'beneficio_esperado', 'confianza'],
    }) }),
    alineacion: T('OBJECT', { nullable: true, properties: { formacion: TXT, titulares: T('ARRAY', { items: TXT }), dudas: T('ARRAY', { items: TXT }) } }),
    proximos_dias: T('ARRAY', { items: T('OBJECT', { properties: { dia: TXT, texto: TXT } }) }),
    vigilar: T('ARRAY', { items: T('OBJECT', { properties: { jugador: TXT, texto: TXT } }) }),
    noticias: T('ARRAY', { items: T('OBJECT', { properties: { jugador: TXT, texto: TXT, efecto: T('STRING', { enum: ['sube', 'baja', 'neutro'] }) } }) }),
    rivales: T('ARRAY', { items: T('OBJECT', { properties: { manager: TXT, texto: TXT } }) }),
    paron: TXTN,
    titular: TXT,
  },
  required: ['operaciones', 'titular'],
  propertyOrdering: ['cuentas', 'situacion', 'descartes', 'operaciones', 'alineacion', 'proximos_dias', 'vigilar', 'noticias', 'rivales', 'paron', 'titular'],
});
export async function planLargo(D, M, c, { signal, alPaso } = {}) {
  const ctx = contexto(D, M, c);
  const seudo = seudonimos(D);
  const pedido = `${ctx}${memoria(M)}

Hazme el PLAN DE HOY. ${BUSCAR_PLAN}
Luego dime las operaciones a hacer, EN ORDEN, para que el dinero cuadre: primero qué ofertas acepto de lo que ya tengo en venta y qué pongo a la venta (para tener saldo), luego lo que compro o clausulo, después blindar y por último la alineación. Elige SOLO entre las de «OPERACIONES POSIBLES HOY» (la app ya ha quitado lo que no haría) y respeta lo que dice «LA APP» de cada una y de cada jugador mío. Para cada puja, la puja máxima: como poco la de la app. Nunca me dejes en negativo al empezar la jornada: si hace falta vender, dímelo. Si ahora estoy en negativo pero quedan 2 o más cambios de mercado antes de la jornada, no me hagas vender hoy perdiendo dinero: dime qué vender y qué día. Si hoy lo mejor es no hacer nada, dilo y por qué.${paronLejos(M) ? ' ESTAMOS EN EL PARÓN: sigue la PRIORIDAD EN EL PARÓN (dinero antes que el once de la vuelta); casi todas las compras y cláusulas de hoy tienen que ser con objetivo «revender», y una para el once («titular») solo si va marcada como CHOLLO CLARO (en su cláusula o en su puja).' : ''}
Contesta SOLO con un bloque \`\`\`json (sin texto fuera) con este formato, en este orden (primero las cuentas y lo que descartas, después las operaciones y al final el titular, que resume lo decidido):
{
 "cuentas": {"caja_hoy": número (mi saldo), "caja_con_ofertas": número (si acepto las ofertas que tengo), "pujas_hechas": número, "huecos_once": número},
 "situacion": "2 o 3 frases: cómo está mi equipo y qué buscamos hoy, con cifras",
 "descartes": [{"jugador": "nombre", "ref": "su ref o null", "motivo": "por qué NO (lesión, no juega, caro, rival difícil, no entra en el once, no se puede…)"}],
 "operaciones": [{"ref": "la ref de OPERACIONES POSIBLES HOY (P-…, T-…, C-…, A-…, V-…, B-…); null solo para alinear o esperar", "motivo": "por qué, con cifras y la noticia que lo justifica (1 o 2 frases)", "claves": ["3 a 5 datos cortos que lo respaldan: «Titular 90 %», «8-6-10 pts», «vs Getafe (19º)», «+1,2 %/día», «+3 % sobre su valor», «sin noticias»"], "accion": "aceptar_oferta|vender|pujar|comprar|clausular|blindar|alinear|esperar", "jugador": "nombre exacto de los datos", "donde": "a la liga | en el mercado | cláusula a <manager> | ...", "importe": número en euros o null, "puja_max": número o null, "cuando": "ahora | hoy antes de las 18:00 | mañana 14:05 cuando se abra", "dia": "hoy | AAAA-MM-DD (el día en que se hace)", "saldo_tras": número (mi saldo después de esta operación, contando las anteriores), "objetivo": "titular|revender|caja|proteger", "vender_el": "solo si es para revender: el día en que ponerlo a la venta", "beneficio_esperado": número en euros o null, "confianza": "alta|media|baja"}],
 "alineacion": {"formacion": "una de las formaciones gratuitas", "titulares": ["portero, defensas, medios y delanteros: nombres exactos"], "dudas": ["jugador: por qué"]} o null si la jornada está en juego (el once ya está cerrado),
 "proximos_dias": [{"dia": "mañana | lun 26 | antes de la jornada", "texto": "qué hacer ese día y a qué hora"}],
 "vigilar": [{"jugador": "nombre", "texto": "por qué hay que seguirlo"}],
 "noticias": [{"jugador": "nombre", "texto": "qué ha pasado y cómo afecta", "efecto": "sube|baja|neutro"}],
 "rivales": [{"manager": "nombre", "texto": "qué está haciendo y si va a por mis jugadores"}],
 "paron": "qué hacer con el parón si está cerca, o null",
 "titular": "8 a 16 palabras con lo más importante de hoy"
}
Entre 1 y 8 operaciones (o ninguna si hoy no conviene nada). En descartes, de 3 a 6 candidatos que has mirado y no convienen. Entre 2 y 5 días en proximos_dias.
"pujar" es SOLO para jugadores libres (ref P-). "comprar", solo para un trato que te he contado (ref T-), con el precio en "importe" y sin puja_max. "clausular", SOLO con su ref C-. Lo que se abre dentro de varios días no va en operaciones: como mucho, una línea en proximos_dias. El titular y la situación solo pueden nombrar operaciones que estén en tu lista.`;
  // pensando poco: con «medium» tardaba un par de minutos y el plan salía igual (la app comprueba cada paso)
  const sinBuscar = (t) => [{ role: 'user', parts: [{ text: t.replace(BUSCAR_PLAN, SIN_BUSCAR_PLAN) }] }];
  // todo el plan, con la segunda vuelta si el primero llega roto, no pasa de 4 minutos
  // la búsqueda en Google solo si está puesta para el plan (Ajustes; apagada por defecto: 20-30 s en vez de 40-80)
  const t0Plan = Date.now(), TOPE_PLAN = 240000, web = !!cfgIA().webPlan;
  /* (0.7.8b) 16.000 de tope y no 32.000: un plan bueno escribe 3-5 mil tokens (con lo que piensa, menos de 10.000), y el que
     se queda en bucle (espacios sin fin) gastaba 116 s en llegar al tope de 32.000; con 16.000, la mitad, y da tiempo a la
     segunda vuelta */
  const TOKENS_PLAN = 16000;
  // un plan cortado se aprovecha hasta la última operación entera (la que iba a medias, fuera)
  const util = (j) => {
    if (!j || !Array.isArray(j.operaciones)) return null;
    if (j._cortado) {
      j.operaciones = j.operaciones.filter((o) => o && o.accion && o.motivo);
      if (!j.titular) j.titular = j.situacion ? String(j.situacion).split(/(?<=\.)\s/)[0].slice(0, 120) : 'Plan de hoy (ha llegado cortado)';
      // cortado antes de acabar las operaciones y sin ninguna entera: mejor pedirlo otra vez
      if (!j.operaciones.length && !j.alineacion && !j.proximos_dias) return null;
    }
    return j;
  };
  let r = await preguntar({ sistema: sistemaIA(), contents: [{ role: 'user', parts: [{ text: pedido }] }], contentsSinWeb: sinBuscar(pedido) }, { signal, alPaso, nivel: 'low', maxTokens: TOKENS_PLAN, web, seudo, seudoJSON: true, esquema: ESQUEMA_PLAN });
  let json = util(sacarJSON(r.texto));
  // si se ha quedado sin sitio para escribir (pensando de más) o el JSON ha salido roto: otra vez, con los datos en
  // corto y pensando poco
  // lo que ha llegado mal, al diagnóstico (para saber por qué falla)
  const malPlan = (x) => apuntar({ modelo: x.modelo, web: x.web, s: 'plan', e: `el plan no se puede leer (${x.fin || 'sin motivo'}, ${x.texto.length} caracteres${x.tok ? `, ${x.tok.th} pensando` : ''})`, ms: 0 });
  if (!json || !Array.isArray(json.operaciones)) {
    malPlan(r);
    const queda = TOPE_PLAN - (Date.now() - t0Plan);
    if (queda < 60000) throw new ErrorIA(`La IA ha contestado sin el formato del plan y ya no da tiempo a pedirlo otra vez (${Math.round((Date.now() - t0Plan) / 1000)} s). Vuelve a probar.`, 0);
    if (alPaso) alPaso(r.fin === 'MAX_TOKENS' ? 'El plan se ha cortado: lo pido otra vez más corto…' : 'El plan ha llegado mal: lo pido otra vez…');
    const corto = pedido.replace(ctx, contexto(D, M, c, { corto: true }));
    r = await preguntar({ sistema: sistemaIA(), contents: [{ role: 'user', parts: [{ text: corto }] }], contentsSinWeb: sinBuscar(corto) }, { signal, alPaso, nivel: 'low', maxTokens: TOKENS_PLAN, total: Math.min(TOTAL_MS, queda), web: false, seudo, seudoJSON: true, esquema: ESQUEMA_PLAN });
    json = util(sacarJSON(r.texto));
    if (!json || !Array.isArray(json.operaciones)) malPlan(r);
  }
  if (!json || !Array.isArray(json.operaciones)) throw new ErrorIA(`La IA ha contestado sin el formato del plan${r.fin && r.fin !== 'STOP' ? ` (${r.fin === 'MAX_TOKENS' ? 'se ha cortado por largo' : r.fin})` : ''}. Vuelve a probar.`, 0);
  const P = { ...json, fuentes: r.fuentes.slice(0, 14), modelo: r.modelo, web: r.web, t: Date.now(), dia: diaDe(), mercado: M.cierreMercado || null, foto: { dinero: D.dinero, mias: M.mias.map((x) => x.pid), clausulas: Object.fromEntries(M.mias.map((x) => [x.pid, x.clausula || 0])) } };
  // lo que recomienda, con el valor de cada jugador hoy, para ver dentro de unos días cómo salió
  try { const cu = cuadrarPlan(P, D, M); P.recs = recsDe(cu.ops, M); P.cuadradas = opsCuadradas(cu.ops); } catch (e) { P.recs = []; }
  const lista = planes();
  lista.unshift(P);
  LS.set(K('planes'), lista.slice(0, 10));
  return P;
}

/* ---------------- el plan corto: el motor propone y la IA ordena, recorta y explica (14 nov) ----------------
   Antes la IA escribía la lista de operaciones (y la app tachaba lo que no cuadraba). Ahora el plan lo hace el motor
   (plan.js): a la IA le llegan sus pasos, cada uno con su id y sus datos, tres o cuatro alternativas que también valen y
   lo mínimo de contexto (noticias, lo que el mánager le ha contado, los rivales). Devuelve poco: el orden, qué quita y
   por qué, qué alternativa mete, una o dos frases por paso, el titular, la situación, las noticias y los rivales. La app
   aplica los cambios con el propio motor (que rehace las cuentas) y lo pasa otra vez por cuadrarPlan: si lo que pide la
   IA no cuadra, se queda el plan del motor con sus frases. Si la IA no contesta, el plan del motor ya está en pantalla. */
/** lo que elige la app para las instrucciones del plan corto (el Worker las arma igual con esto: plan-sistema.js) */
const opSistemaCorto = () => {
  const p = cfgIA().pullitas || 'normal';
  // (sin PULLITAS: con el plan corto el modelo ligero se inventaba fiestas y bailes para tener de qué hacer la broma)
  return { tono: p === 'normal' || p === 'saco' ? 'broma' : 'serio', bloq: Object.keys(SOBRE_BLOQUEO).filter((k) => bloqueada(k)), anuncio: topConAnuncio() };
};
const sistemaCorto = () => sistemaCortoDe(opSistemaCorto());
export const ESQUEMA_CORTO = T('OBJECT', {
  properties: {
    pasos: T('ARRAY', { items: T('OBJECT', { properties: { id: TXT, frase: TXT }, required: ['id', 'frase'] }) }),
    quita: T('ARRAY', { items: T('OBJECT', { properties: { id: TXT, motivo: TXT }, required: ['id', 'motivo'] }) }),
    mete: T('ARRAY', { items: T('OBJECT', { properties: { id: TXT, frase: TXT }, required: ['id', 'frase'] }) }),
    situacion: TXT,
    noticias: T('ARRAY', { items: T('OBJECT', { properties: { jugador: TXT, texto: TXT, efecto: T('STRING', { enum: ['sube', 'baja', 'neutro'] }) } }) }),
    rivales: T('ARRAY', { items: T('OBJECT', { properties: { manager: TXT, texto: TXT } }) }),
    titular: TXT,
  },
  required: ['pasos', 'titular'],
  propertyOrdering: ['pasos', 'quita', 'mete', 'situacion', 'noticias', 'rivales', 'titular'],
});
const OBJ_TXT = { titular: 'el once', revender: 'revender', caja: 'empezar la jornada en positivo', proteger: 'proteger' };
const idLimpio = (x) => String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, '');
/** los ids de los pasos del plan del motor (p1, p2…) y de las alternativas (a1, a2…): { lista: [{ id, o, alt }], porId } */
export function idsCorto(R) {
  const lista = [];
  let n = 0, a = 0;
  for (const o of R.ops || []) if (o._k && !o.descartada) lista.push({ id: `p${++n}`, k: o._k, o, alt: false });
  for (const o of R.alternativas || []) if (o._k) lista.push({ id: `a${++a}`, k: o._k, o, alt: true });
  return { lista, porId: new Map(lista.map((x) => [x.id, x])) };
}
/** lo que se le manda a la IA para el plan corto (sin el sistema) */
export function pedidoCorto(D, M, c, R) {
  const { lista } = idsCorto(R);
  const L = [];
  const acc = (o) => (o.retira ? 'RETIRAR LA PUJA' : o.etiqueta === 'Aceptar oferta' || /acepta/i.test(o.donde || '') ? 'ACEPTAR LA OFERTA' : o.accion === 'vender' ? 'PONER A LA VENTA' : o.accion === 'blindar' ? (o.importe ? 'SUBIR LA CLÁUSULA' : 'BLINDAR GRATIS') : String(o.accion || '').toUpperCase());
  const paso = ({ id, o }) => {
    const j = o.pid ? D.maestro[o.pid] || o.j : null, d = o.datos || {};
    L.push(`[${id}] ${acc(o)}${o.jugador ? ` · ${o.jugador}` : ''}${o.importe ? ` · ${eur(o.puja_max || o.importe)}` : ''}${o.cuando ? ` · ${o.cuando}` : ''}${o.objetivo && OBJ_TXT[o.objetivo] ? ` · para ${OBJ_TXT[o.objetivo]}` : ''}${o.vender_el ? ` · se vende el ${o.vender_el}` : ''}${o.hace_falta ? ' · HACE FALTA (no se quita)' : ''}`);
    L.push(`   por qué: ${d.porque || cortar(o.motivo, 200)}${d.cuanto ? ` | cuánto: ${d.cuanto}` : ''}${d.siNo ? ` | si no se hace: ${d.siNo}` : ''}${o.aviso ? ` | la app avisa: ${cortar(o.aviso, 170)}` : ''}`);
    if (j) L.push(`   ${lineaBreve(M, j)}${prensaTxt(M, j.id, 2)}`);
  };
  L.push(`HOY: ${cuando(Date.now())}. ${R.situacion || ''}`);
  if (R.cuentas && R.cuentas.jornada != null) L.push(`CUENTAS DE LA APP: haciendo el plan, al empezar la jornada tendría unos ${eur(R.cuentas.jornada)} (lo de revender contado al 92 % y lo puesto en venta al 90 %, por si bajan).`);
  L.push('\nEL PLAN DE LA APP (cada paso con su id; importes, pujas y días no se tocan):');
  const pasos = lista.filter((x) => !x.alt), alts = lista.filter((x) => x.alt);
  if (pasos.length) pasos.forEach(paso); else L.push('(hoy la app no ve ninguna operación clara: lo mejor es no hacer nada)');
  const fijos = (R.ops || []).filter((o) => !o._k && !o.descartada && ['alinear', 'esperar'].includes(o.accion));
  if (fijos.length) L.push(`Además, la app añade por su cuenta (no los toques): ${fijos.map((o) => (o.accion === 'alinear' ? `la alineación (${cortar(o.motivo, 160)})` : `${o.jugador ? `esperar con ${o.jugador}` : 'esperar'} (${cortar(o.motivo, 130)})`)).join('; ')}.`);
  if (alts.length) { L.push('\nALTERNATIVAS QUE TAMBIÉN VALEN Y LA APP DEJÓ FUERA (se pueden meter tal cual, con su id):'); alts.forEach(paso); }
  if (Array.isArray(R.descartes) && R.descartes.length) L.push(`\nMIRADO Y DESCARTADO POR LA APP (no se puede meter): ${R.descartes.map((d) => `${d.jugador}: ${cortar(d.motivo, 150)}`).join(' · ')}`);
  // las noticias de los míos que no van arriba
  const ya = new Set(lista.map((x) => x.o.pid).filter(Boolean));
  const prensa = M.mias.filter((x) => !ya.has(x.pid)).map((x) => ({ x, t: prensaTxt(M, x.pid, 2) })).filter((y) => y.t).slice(0, 12);
  if (prensa.length) { L.push('\nPRENSA DE MIS OTROS JUGADORES:'); for (const y of prensa) L.push(`- ${y.x.j.nombre}${y.x.j.estado && y.x.j.estado !== 'ok' ? ` (${ESTADO_TXT[y.x.j.estado] || y.x.j.estado})` : ''}${y.t.replace(' | PRENSA:', ':')}`); }
  const tocados = M.mias.filter((x) => x.j.estado && x.j.estado !== 'ok');
  if (tocados.length) L.push(`\nMIS JUGADORES CON ESTADO: ${tocados.map((x) => `${x.j.nombre} (${ESTADO_TXT[x.j.estado] || x.j.estado})`).join(', ')}.`);
  const nt = notasTxt(D, M);
  if (nt) L.push(nt);
  // los rivales, en corto: la clasificación y lo que han movido en 3 días
  if (M.rivales && M.rivales.length) L.push(`\nCLASIFICACIÓN DE MI LIGA: ${M.yo ? `yo ${M.yo.pos}º con ${M.yo.puntos} pts; ` : ''}${M.rivales.slice(0, 12).map((r) => `${r.e.pos}º ${r.e.manager || r.e.nombre} ${r.e.puntos}`).join(', ')}.`);
  const act = M.actividad.filter((a) => a.t && Date.now() - a.t < 3 * DIA && a.clase !== 'premio' && !a.esYo).slice(0, 12);
  if (act.length) L.push(`MOVIMIENTOS DE MIS RIVALES (3 días): ${act.map((a) => `${a.quien || '?'} ${({ compra: 'fichó', clausula: 'clausuló', venta: 'vendió', blindaje: 'blindó' })[a.clase] || 'movió'} a ${a.nombreJ || '?'}${a.clase !== 'blindaje' && a.importe ? ` por ${eur(a.importe)}` : ''}${a.contraMi ? ' (a MÍ)' : ''}`).join('; ')}.`);
  L.push(`
Ordena, recorta y explica el plan. Contesta SOLO con un bloque \`\`\`json (sin texto fuera) con este formato:
{
 "pasos": [{"id": "p1", "frase": "una o dos frases: por qué, con las cifras de arriba y la noticia si la hay"}],
 "quita": [{"id": "p3", "motivo": "la noticia o lo que me contaste que lo desaconseja"}],
 "mete": [{"id": "a1", "frase": "por qué entra, en una o dos frases"}],
 "situacion": "2 frases: cómo está mi equipo y qué buscamos hoy, con cifras",
 "noticias": [{"jugador": "nombre", "texto": "qué ha pasado y cómo afecta", "efecto": "sube|baja|neutro"}],
 "rivales": [{"manager": "nombre", "texto": "qué está haciendo y si va a por mis jugadores"}],
 "titular": "8 a 16 palabras con lo más importante de hoy"
}
"pasos" lleva, EN EL ORDEN en que los harías, los pasos del plan que se quedan (todos los que no quites). "quita" y "mete", vacíos si no hay un motivo claro. Como mucho 4 noticias y 3 rivales.`);
  return L.join('\n');
}
/** las cifras en euros de un texto, cada una con lo que se le perdona por cómo está escrita («28 M» puede ser 27,84 M) */
const cifrasDe = (t) => [...String(t || '').matchAll(/(\d+(?:[.,]\d+)?)\s?(M|mil(?:lones)?)\b/gi)].map((m) => {
  const u = /^mil$/i.test(m[2]) ? 1e3 : 1e6, dec = (m[1].split(/[.,]/)[1] || '').length;
  return { v: aEuros(m[1], u === 1e3 ? 'mil' : 'M'), tol: (u / Math.pow(10, dec)) * 0.51 };
});
/** ¿está esa cifra entre las que la IA tenía delante? Vale tal cual, o como suma o resta de dos de ellas (lo que gana o
 * pierde frente a lo que pagó, lo que queda tras pagar…) */
function cifraSabida(x, base) {
  const vale = (y) => Math.abs(x.v - y) <= Math.max(x.tol, Math.abs(y) * 0.006, 6000);
  if (base.some(vale)) return true;
  for (let i = 0; i < base.length; i++) for (let k = i + 1; k < base.length; k++) if (vale(Math.abs(base[i] - base[k])) || vale(base[i] + base[k])) return true;
  return false;
}
/**
 * Aplica al plan del motor lo que contesta la IA. Lo que quita o mete se rehace con el propio motor (planMotor con la
 * combinación fijada: las mismas cuentas) y se cuadra; si no cuadra, se prueba sin quitar lo que hace falta, sin meter y,
 * al final, sin tocar nada. Las frases de la IA que traen una cifra que no está en los datos del paso no se usan.
 * Devuelve el plan sin cuadrar (como el de la IA de siempre) y `cambios`: lo que se aplicó y lo que no.
 */
export function aplicarCorto(json, R, D, M, c) {
  const { lista, porId } = idsCorto(R);
  const de = (x) => porId.get(idLimpio(x && x.id)) || null;
  const esPost = (k) => /^[BS]-/.test(k);
  const base = lista.filter((x) => !x.alt).map((x) => x.k);
  const quita0 = [...new Set((Array.isArray(json.quita) ? json.quita : []).map(de).filter((x) => x && !x.alt).map((x) => x.k))];
  const mete0 = [...new Set((Array.isArray(json.mete) ? json.mete : []).map(de).filter((x) => x && x.alt).map((x) => x.k))];
  const orden = (Array.isArray(json.pasos) ? json.pasos : []).map(de).filter(Boolean).map((x) => x.k);
  const frases = new Map();
  for (const x of [...(Array.isArray(json.pasos) ? json.pasos : []), ...(Array.isArray(json.mete) ? json.mete : [])]) { const y = de(x); if (y && x.frase) frases.set(y.k, String(x.frase)); }
  const motivos = new Map((Array.isArray(json.quita) ? json.quita : []).map((x) => [de(x) && de(x).k, String((x && x.motivo) || '')]));
  const tachado = (P) => { const cu = cuadrarPlan({ ...P, modelo: 'x', t: Date.now() }, D, M); return (cu.ops || []).some((o) => o._k && (o.descartada || o.sugerencia)); };
  // Quitar o meter algo es cosa de las noticias (los números ya los ha mirado el motor): solo si de ese jugador hay
  // prensa, un estado (lesión, sanción, duda), algo que el mánager ha contado o un partidazo reciente. Si no, no se aplica
  // (el modelo ligero quitaba pasos «porque sobra margen»; medido el 14 nov)
  const conNoticia = (k) => {
    const o = (lista.find((y) => y.k === k) || {}).o, pid = o && o.pid, j = pid && D.maestro[pid];
    if (!j) return false;
    return !!((M.noticiasDe && M.noticiasDe(pid).length) || (j.estado && j.estado !== 'ok') || notasDe(pid).length || ((M.partidazo && M.partidazo(pid)) || {}).nivel >= 2);
  };
  const intento = (q, m) => {
    let P = null;
    try { P = planMotor(D, M, c, { fijar: new Set([...base.filter((k) => !esPost(k) && !q.includes(k)), ...m]), vetados: new Set(q.filter(esPost)), prefer: orden }); } catch (e) { P = null; }
    // nunca peor para la jornada (si el del motor llegaba en positivo, este también) ni con algo que la app tacharía
    if (!P || (R.cuentas && R.cuentas.jornada >= 0 && P.cuentas.jornada < 0) || tachado(P)) return null;
    return { P, quita: q, mete: m };
  };
  // de uno en uno: cada cosa que quita o mete se queda solo si el plan sigue cuadrando con ella (así una que no cabe
  // no se lleva por delante a las demás, y lo que hace falta para empezar la jornada en positivo no se va)
  let r = intento([], []);
  if (!r) return null;
  for (const k of quita0) { if (!conNoticia(k)) continue; const x = intento([...r.quita, k], r.mete); if (x) r = x; }
  // (una alternativa entra si cubre algo que se ha quitado o si la noticia es suya)
  for (const k of mete0) { if (!r.quita.length && !conNoticia(k)) continue; const x = intento(r.quita, [...r.mete, k]); if (x) r = x; }
  const P = r.P;
  // las frases: la de la IA si no trae cifras que no estén en los datos del paso; si no, la de la app
  let sinFrase = 0;
  const frasesNo = [];
  const cuBase = cuadrarPlan({ ...P, modelo: 'x', t: Date.now() }, D, M);
  const nombreK = (k) => { const x = lista.find((y) => y.k === k); return x ? x.o.jugador : ''; };
  for (const o of P.operaciones) {
    const d = o.datos || {};
    if (d.cuanto || d.cuando) o.claves = [d.cuanto, d.cuando && `Cuándo: ${d.cuando}`, d.siNo && `Si no: ${d.siNo}`].filter(Boolean).map((t) => (t.length > 70 ? `${t.slice(0, 68)}…` : t));
    const f = o._k && frases.get(o._k);
    if (!f) continue;
    const j = o.pid && D.maestro[o.pid];
    // lo que la IA tenía delante de ese paso: sus datos, el aviso de la app al cuadrarlo, la ficha del jugador y las cuentas
    const cuad = (cuBase.ops || []).find((x) => x._k === o._k) || (R.ops || []).find((x) => x._k === o._k) || {};
    const dato = `${o.motivo} ${JSON.stringify(d)} ${o.aviso || ''} ${cuad.aviso || ''} ${j ? lineaBreve(M, j) : ''} ${eur(o.importe || 0)} ${eur(o.puja_max || 0)} ${j ? eur(j.valor) : ''} ${P.situacion || ''} ${R.situacion || ''} ${R.cuentas ? eur(R.cuentas.jornada) : ''} ${P.cuentas ? eur(P.cuentas.jornada) : ''}`;
    const sabidas = cifrasDe(dato).map((x) => x.v).slice(0, 60);
    const rara = cifrasDe(f).find((x) => !cifraSabida(x, sabidas));
    if (rara) { sinFrase++; frasesNo.push({ jugador: o.jugador, cifra: eur(rara.v), frase: f.slice(0, 260) }); continue; }
    o.motivoApp = o.motivo;
    o.motivo = String(sinWebsChat(sinModelos(f)).trim()).split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
  }
  const limpio = (t) => sinWebsChat(sinModelos(String(t || ''))).trim();
  // (dos frases y 240 caracteres como mucho: el modelo ligero a veces repite la misma frase en bucle)
  const breve = (t) => { const x = String(t || '').split(/(?<=[.!?])\s+/).slice(0, 2).join(' '); return x.length > 240 ? `${x.slice(0, x.lastIndexOf(' ', 238))}…` : x; };
  const quitados = r.quita.map((k) => ({ pid: ((lista.find((y) => y.k === k) || {}).o || {}).pid || null, jugador: nombreK(k), motivo: `La IA lo quita del plan: ${limpio(motivos.get(k)) || 'sin motivo'}` })).filter((d) => d.jugador);
  const cu = cuBase;
  const prox = rematarAuto({ ...cu, auto: true }).proximos_dias || [];
  // el titular y la situación no pueden nombrar a quien no está en el plan (lo que se ha quitado o no se ha podido meter)
  const fueraN = [...quita0.filter((k) => r.quita.includes(k)), ...mete0.filter((k) => !r.mete.includes(k))].map(nombreK).filter(Boolean).map(norm);
  const nombra = (t) => { const n = norm(t); return fueraN.some((x) => x && n.includes(x)); };
  const tit = limpio(json.titular), sit = limpio(json.situacion);
  return {
    ...P, auto: false, corto: true,
    titular: tit && !nombra(tit) ? tit : titularMotor({ ...cu, modo: P.modo }),
    // (Domy, 9 nov) en el parón el plan va de dinero: si la IA no lo dice, se añade
    situacion: sit && !nombra(sit) ? `${sit}${P.modo === 'paron' && !/par[oó]n/i.test(`${sit} ${tit}`) ? ' Estamos en el parón: nadie puntúa hasta la vuelta, así que hoy manda el dinero.' : ''}` : P.situacion,
    descartes: [...quitados, ...(P.descartes || []).filter((d) => !quitados.some((q) => q.pid && q.pid === d.pid))],
    // las noticias, solo de quien tiene prensa, estado o una nota (lo demás es relleno o invento), y en corto: dos frases
    noticias: (Array.isArray(json.noticias) ? json.noticias : []).map((n) => ({ ...n, pid: n && n.jugador ? pidDe(n.jugador, D) : null })).filter((n) => { const j = n.pid && D.maestro[n.pid]; return !!j && !!((M.noticiasDe && M.noticiasDe(n.pid).length) || (j.estado && j.estado !== 'ok') || notasDe(n.pid).length); })
      .slice(0, 4).map((n) => ({ jugador: n.jugador, efecto: n.efecto, texto: breve(limpio(n.texto)) })).filter((n) => n.texto),
    rivales: (Array.isArray(json.rivales) ? json.rivales : []).slice(0, 3).map((n) => ({ ...n, texto: breve(limpio(n && n.texto)) })).filter((n) => n.manager && n.texto),
    proximos_dias: prox,
    cambios: { quita: r.quita.map(nombreK), mete: r.mete.map(nombreK), noAplicado: [...quita0.filter((k) => !r.quita.includes(k)).map((k) => `quitar ${nombreK(k)}${conNoticia(k) ? '' : ' (sin noticia que lo respalde)'}`), ...mete0.filter((k) => !r.mete.includes(k)).map((k) => `meter ${nombreK(k)}`)], sinFrase, frasesNo },
  };
}
/* ---------------- el plan con la IA de Carlos (el Worker, /plan) ---------------- */
// (14 nov, Carlos) los planes del día los paga él con Claude: 2 al día por cuenta y, en la app de Google Play, uno más
// por cada anuncio bonificado, hasta 5. Lo cuenta el Worker; aquí se guarda lo último que ha dicho, para los textos.
// Las preguntas del chat siguen con la clave de cada uno.
/** ¿el plan va por la IA de la app? (limites.json «planes.on» y con tu cuenta de LaLiga: en la liga de ejemplo, no) */
export const planesApp = (demo) => !demo && planesCfg().on;
/** ¿se puede pedir un plan con IA? (la de la app o tu clave) */
export const puedePlanIA = (demo) => planesApp(demo) || hayClave();
/** lo último que ha dicho el Worker del cupo de hoy ({ usados, gratis, max, extras, quedan, masConAnuncio }) o null */
export function cupoPlanes() {
  const g = LS.get('planes-cupo', null);
  return g && g.dia === diaDe() ? g : null;
}
const guardarCupo = (c) => { if (c && typeof c === 'object') LS.set('planes-cupo', { ...c, dia: diaDe() }); };
/** al Worker: el pedido ya con alias; devuelve { texto (el plan en JSON, destapado), modelo, tok } o lanza un ErrorIA */
async function planPorApp(pedido, seudo, { signal, alPaso, extra = false } = {}) {
  const sd = seudo && seudo.n ? seudo : null;
  const t0 = Date.now();
  if (alPaso) alPaso('La IA está leyendo tu plan y las noticias…');
  let j;
  try {
    j = await pedirWorker('POST', '/plan', { pedido: sd ? sd.tapar(pedido) : pedido, ...opSistemaCorto(), alias: sd ? { puesto: !!sd.porPuesto, ex: !!sd.ex } : null, extra: !!extra }, { tiempo: 120000, signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const d = e.datos || {};
    if (d.cupo) guardarCupo(d.cupo);
    apuntar({ modelo: 'app', s: 'plan', e: `la IA de la app: ${e.estado || 0} ${e.message}`, ms: Date.now() - t0 });
    // sin cupo hoy: no es un fallo (lo dice el Worker); lo demás es que el servicio no está (y vale tu clave, si la tienes)
    if (e.estado === 429 && d.cupo) throw new ErrorIA(e.message, 429, { cupo: d.cupo });
    if (e.sesion || e.estado === 401) throw new ErrorIA(e.message || 'No se ha podido comprobar tu cuenta de LaLiga ahora mismo.', 401, { servicio: true });
    throw new ErrorIA(e.estado === 0 ? e.message : 'La IA de los planes no está disponible ahora mismo. Tienes el plan de la app; vuelve a probar en un rato.', e.estado || 0, { servicio: true });
  }
  // (la respuesta ya empezada trae el error en el cuerpo: el Worker manda espacios mientras la IA piensa)
  if (j && j.e) {
    apuntar({ modelo: 'app', s: 'plan', e: `la IA de la app: ${j.estado || 200} ${j.e}`, ms: Date.now() - t0 });
    throw new ErrorIA(j.e, j.estado || 0, { servicio: !!j.servicio });
  }
  if (j.cupo) guardarCupo(j.cupo);
  apuntar({ modelo: 'app', s: 'plan', ok: true, ms: Date.now() - t0, tok: j.tok || null });
  const texto = JSON.stringify(j.plan || {});
  return { texto: sd ? sd.destapar(texto, { json: true }) : texto, modelo: 'app', tok: j.tok ? { entra: j.tok.entra, sale: j.tok.sale } : null, cupo: j.cupo || null };
}
/**
 * El plan del día con el contrato corto. Devuelve null si el motor no ha podido hacer su plan (entonces, el largo).
 * porApp: con la IA de la app (el Worker); si no, con tu clave de Google. extra: viene de un anuncio bonificado.
 */
async function planCorto(D, M, c, { signal, alPaso, porApp = false, extra = false } = {}) {
  const R = planDeHoy(D, M, c);
  if (!R || !R.motor) return null;
  const pedido = pedidoCorto(D, M, c, R);
  const seudo = seudonimos(D);
  // (corto de verdad: 1.500 tokens de respuesta sobran; el resto del tope es lo que piense. Y un minuto como mucho)
  const r = porApp ? await planPorApp(pedido, seudo, { signal, alPaso, extra })
    : await preguntar({ sistema: sistemaCorto(), contents: [{ role: 'user', parts: [{ text: pedido }] }] }, { signal, alPaso, nivel: 'low', maxTokens: 5000, total: 75000, web: false, seudo, seudoJSON: true, esquema: ESQUEMA_CORTO });
  const json = sacarJSON(r.texto);
  if (!json || (!Array.isArray(json.pasos) && !json.titular)) {
    apuntar({ modelo: r.modelo, web: r.web, s: 'plan', e: `el plan corto no se puede leer (${r.fin || 'sin motivo'}, ${r.texto.length} caracteres${r.tok && r.tok.th ? `, ${r.tok.th} pensando` : ''})`, ms: 0 });
    throw new ErrorIA(`La IA ha contestado sin el formato del plan${r.fin && r.fin !== 'STOP' ? ` (${r.fin === 'MAX_TOKENS' ? 'se ha cortado por largo' : r.fin})` : ''}. Tienes el plan de la app; vuelve a probar cuando quieras.`, 0);
  }
  const A = aplicarCorto(json, R, D, M, c);
  if (!A) throw new ErrorIA('La IA ha contestado, pero lo que pide no cuadra con las cuentas de hoy. Tienes el plan de la app; vuelve a probar cuando quieras.', 0);
  return { ...A, fuentes: [], modelo: r.modelo, web: false, t: Date.now(), dia: diaDe(), mercado: M.cierreMercado || null, tok: r.tok || null, ...(porApp ? { app: true } : {}), foto: { dinero: D.dinero, mias: M.mias.map((x) => x.pid), clausulas: Object.fromEntries(M.mias.map((x) => [x.pid, x.clausula || 0])) } };
}
/**
 * El plan del día con la IA. Con el motor (plan.js), el corto: la IA ordena, recorta y explica el plan de la app. El
 * largo de siempre (la IA escribe las operaciones) queda para cuando el motor no puede o si se pide (cfg-ia.planLargo).
 * Con «planes.on» en limites.json va por la IA de la app (op.demo: en la liga de ejemplo, no); si ese servicio no está
 * (sin clave en el Worker, apagado, su tope del día, caído), con tu clave de Google si la tienes. Sin cupo, no: los de más
 * van con anuncio (Carlos, 14 nov).
 */
export async function planDelDia(D, M, c, op = {}) {
  if (cfgIA().planLargo && hayClave()) return planLargo(D, M, c, op);
  let P = null;
  if (planesApp(op.demo)) {
    try { P = await planCorto(D, M, c, { ...op, porApp: true }); } catch (e) {
      if (!(e.servicio && hayClave())) throw e;
      P = await planCorto(D, M, c, op);
    }
    if (!P && !hayClave()) throw new ErrorIA('Hoy la app no ha podido montar su plan con las cuentas, así que la IA no tiene qué ordenar. Tienes el plan automático.', 0);
  } else P = await planCorto(D, M, c, op);
  if (!P) return planLargo(D, M, c, op);
  try { const cu = cuadrarPlan(P, D, M); P.recs = recsDe(cu.ops, M); P.cuadradas = opsCuadradas(cu.ops); } catch (e) { P.recs = []; }
  const lista = planes();
  lista.unshift(P);
  LS.set(K('planes'), lista.slice(0, 10));
  return P;
}


/** ¿hace falta un plan nuevo? (no hay de hoy, es de antes de que cambiara el mercado o tiene más de 10 horas) */
export function planViejo(M) {
  const p = ultimoPlan();
  if (!p) return true;
  if (p.dia !== diaDe()) return true;
  if (LS.get(K('notas-t'), 0) > p.t) return true;
  if (M && M.cierreMercado && p.mercado && Math.abs(M.cierreMercado - p.mercado) > 3600e3) return true;
  // hecho antes de que empezara la jornada: con ella en juego cambia todo (se reabren las cláusulas, el once ya está puesto)
  if (M && M.enJuego && p.t < M.enJuego.ini) return true;
  return Date.now() - p.t > 10 * 3600e3;
}

/** ¿se hace sola un plan nuevo con la IA? Con la de la app (2 al día) solo el primero del día y tras el cambio de mercado,
    y nunca si el Worker ya ha dicho que hoy no quedan: los demás los pide cada uno con «Otro plan». Con tu clave, planViejo */
export function planViejoAuto(M, demo) {
  if (!planesApp(demo)) return planViejo(M);
  if (!planViejo(M)) return false;
  const cu = cupoPlanes();
  if (cu && cu.quedan <= 0) return false;
  const p = ultimoPlan();
  if (!p || p.dia !== diaDe()) return true;
  return !!(M && M.cierreMercado && p.mercado && Math.abs(M.cierreMercado - p.mercado) > 3600e3);
}

/** su próximo partido en corto: «vs Getafe 18º» en casa, «en Real Madrid 3º» fuera */
function partidoTxt(M, j) {
  const p = M.proximoPartido ? M.proximoPartido(j.equipoId) : null;
  if (!p) return 'sin partido';
  const r = M.equipoLiga ? M.equipoLiga(p.rivalId) : null;
  return `${p.casa ? 'vs' : 'en'} ${p.rival}${r && r.pos ? ` ${r.pos}º` : ''}`;
}
/**
 * el once de la IA, mejorado con los números de la app: cambia (hasta 3 veces) un titular por uno del banquillo que
 * pueda jugar si la app espera de él 1,5 pts más y al menos un 40 % más (los puntos esperados ya cuentan el rival, si
 * juega en casa o fuera y la portería a cero). Entre puestos distintos solo si la formación sigue siendo de las gratis;
 * el portero, solo por otro portero. No toca a los que ya han empezado a jugar ni mete a los que la IA ha descartado
 */
export function mejorarAlin(js, pool, M, no = new Set()) {
  const ahora = Date.now();
  const pp = (j) => (M.ppEsperado ? M.ppEsperado(j) : 0) || 0;
  const prox = (j) => (M.proximoPartido ? M.proximoPartido(j.equipoId) : null);
  const forms = new Set((M.formaciones || []).map((f) => f.join('-')));
  const formaDe = (l) => [2, 3, 4].map((p) => l.filter((j) => j.pos === p).length).join('-');
  let once = js.slice();
  const cambios = [];
  for (let n = 0; n < 3; n++) {
    const dentro = new Set(once.map((j) => j.id));
    const banco = pool.filter((j) => {
      if (!j || !(j.pos >= 1 && j.pos <= 4) || dentro.has(j.id) || esMalo(j) || no.has(norm(j.nombre))) return false;
      const p = prox(j);
      return !!p && p.fecha > ahora;
    });
    let mejor = null;
    for (const sale of once) {
      const p = prox(sale);
      if (p && p.fecha <= ahora) continue;
      const ps = pp(sale);
      for (const entra of banco) {
        if ((sale.pos === 1) !== (entra.pos === 1)) continue;
        const pe = pp(entra), gana = pe - ps;
        if (gana < 1.5 || pe < ps * 1.4) continue;
        const nuevo = once.map((j) => (j === sale ? entra : j));
        if (sale.pos !== entra.pos && !forms.has(formaDe(nuevo))) continue;
        if (!mejor || gana > mejor.gana) mejor = { sale, entra, gana, ps, pe, nuevo };
      }
    }
    if (!mejor) break;
    once = mejor.nuevo;
    cambios.push({ sale: mejor.sale, entra: mejor.entra, gana: mejor.gana, ps: mejor.ps, pe: mejor.pe });
  }
  return { once, cambios };
}

/** las operaciones del plan con sus jugadores y el saldo después de cada una, con los números de la app */
/* (revisión de la IA, 14 nov) `chat`: lo mismo para lo que la IA recomienda en el chat (su bloque «recomiendo»). Ahí lo que un
   rival tiene a la venta sí se mira (con su precio mínimo y lo que le da LaLiga) y el once va aparte (revisarChat) */
export function cuadrarPlan(P, D, M, { chat = false } = {}) {
  if (!P) return null;
  const buscar = (n) => {
    const k = norm(n);
    if (!k) return null;
    const todos = Object.values(D.maestro);
    return todos.find((j) => norm(j.nombre) === k) || todos.find((j) => norm(j.largo) === k)
      || (k.length >= 3 ? todos.find((j) => { const n = norm(j.nombre); return n.length >= 3 && (n.includes(k) || k.includes(n)); }) : null) || null;
  };
  // lo que ya tienes pujado se cobra al cambiar el mercado si lo ganas: para el saldo con el que empiezas la jornada, ya
  // está gastado (antes no se restaba y el plan podía dejarte en negativo sin avisar; revisión del 25 oct)
  let saldo = D.dinero == null ? null : +D.dinero - (+M.misPujas || 0);
  // lo que hay en caja de verdad: una cláusula solo se paga con saldo (sin deuda), y lo que pones en venta no entra
  // hasta que aceptas una oferta; aceptar una oferta, sí (las pujas no se cobran hasta el cambio de mercado)
  let caja = D.dinero == null ? null : +D.dinero;
  // lo que se puede pujar o comprar en el mercado: el saldo más el margen de deuda, menos lo ya pujado (M.pujaMax);
  // poner a la venta no suma nada hasta que aceptas una oferta (revisión del 25 oct)
  let margen = M.pujaMax != null ? +M.pujaMax : null;
  // cada paso se comprueba contra lo que de verdad se puede hacer hoy
  const cat = catDe(D, M);
  const OPERA = ['vender', 'clausular', 'pujar', 'comprar', 'ofertar', 'blindar'];
  // un plan de antes de que empezara la jornada: lo de poner el once ya ha pasado (LaLiga lo cierra con el primer
  // partido y no deja cambiar a nadie hasta la siguiente), así que ese paso y su once se quitan. Con la jornada en
  // juego, tampoco un plan de ahora lleva alinear ni once (aviso de Domy, 31 oct): es para la siguiente
  const empezo = !!(M.enJuego && (P.t || 0) < M.enJuego.ini);
  const sinOnce = empezo || !!M.enJuego;
  // lo que un rival tiene a la venta no va en el plan (aviso de Domy, 29 oct: casi siempre lo pone solo para ver la oferta
  // de LaLiga y no lo quiere vender); se ve en Mercado → Fichar, «En venta de tus rivales». Un trato que contaste, sí
  const yoT = D.yo && D.yo.teamId;
  const ventaRival = (o) => {
    const r = String((o && o.ref) || '').trim().toUpperCase();
    if (r.startsWith('M-')) return true;
    if (r.startsWith('T-') || !/comprar|ofertar/i.test(String((o && o.accion) || ''))) return false;
    const j = (o.pid && D.maestro[o.pid]) || buscar(o.jugador);
    return !!j && (M.mercado || []).some((m) => m.pid === j.id && m.tipo === 'manager' && m.vendedorTeamId !== yoT);
  };
  // (revisión total, A6) la acción que escribe la IA, a una de las que la app sabe hacer: «fichar» es pujar, comprar o
  // clausular según su ref (o lo que haya hoy para ese jugador), «subir_clausula» es blindar pagando y «aceptar» es vender.
  // Lo que no se reconoce no sale como un paso normal: va descartado («la app no reconoce esta operación»)
  const normalizar = (o0) => {
    const o = { ...o0 };
    const k = String(o.accion || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const r = String(o.ref || '').trim().toUpperCase();
    const pid0 = (cat.ref[r] && cat.ref[r].pid) || ((buscar(o.jugador) || {}).id);
    const SIN = [
      [/^(aceptar|aceptar_(la_)?ofertas?|aceptar_oferta_de_.*)$/, 'aceptar_oferta'],
      [/^(vender|venta|vende|poner_(a_la_|en_)?venta|vender_a_(la_)?liga|vender_a_laliga)$/, 'vender'],
      [/^(pujar|puja|pujar_por|subasta|pujar_en_el_mercado)$/, 'pujar'],
      [/^(comprar|compra|ofertar|oferta|hacer_(una_)?oferta|ofrecer|comprar_a_.*)$/, 'comprar'],
      [/^(clausular|clausulazo|pagar_(la_|su_)?clausula|clausula)$/, 'clausular'],
      [/^(blindar|blindaje|escudo|proteger|usar_escudo|blindar_gratis)$/, 'blindar'],
      [/^(subir_(la_|su_)?clausula|subida_(de_(la_)?)?clausula|subir|blindar_pagando|pagar_blindaje)$/, 'subir'],
      [/^(fichar|fichaje|ficha|incorporar|traer|comprar_o_pujar)$/, 'fichar'],
      [/^(alinear|alineacion|alinea|once|poner_(el_)?once|cambiar_(el_)?once)$/, 'alinear'],
      [/^(esperar|espera|no_hacer_nada|nada|mantener|aguantar|no_vender|quedarse)$/, 'esperar'],
    ];
    const hit = SIN.find(([re]) => re.test(k));
    let acc = hit ? hit[1] : null;
    if (acc === 'fichar') {
      const pr = r[0] && cat.ref[r] ? r[0] : ['P', 'M', 'T', 'C'].find((x) => pid0 && cat.ref[`${x}-${pid0}`]) || null;
      acc = pr === 'P' ? 'pujar' : pr === 'C' ? 'clausular' : 'comprar';
      if (pr && !cat.ref[r] && pid0) o.ref = `${pr}-${pid0}`;
      o.normalizada = o.accion;
    } else if (acc === 'subir') {
      acc = 'blindar';
      o.subir = true;
      o.normalizada = o.accion;
      if (!(+o.importe > 0)) {
        // sin cifra: la subida justa de la app (si la hay)
        const x = pid0 && (M.mias || []).find((y) => y.pid === pid0);
        const bj = x && x.blindaje;
        o.importe = bj && !bj.yaVale && !bj.caro && bj.coste ? bj.coste : null;
      }
    } else if (acc && acc !== k && acc !== 'aceptar_oferta') o.normalizada = o.accion;
    // (sale con la acción tal cual la escribió la IA, para que se vea qué era; va descartada y no cuenta para nada)
    if (!acc) { o.noReconocida = String(o.accion || '').trim() || '(sin acción)'; acc = k || 'desconocida'; }
    o.accion = acc;
    return o;
  };
  let lista = (P.operaciones || []).map(normalizar).filter((o) => !((sinOnce || chat) && /alinea/i.test(String(o.accion || ''))) && (chat || !ventaRival(o)));
  // (30 oct, Carlos: «me pone alinear a Unai cuando ya está en el once» y «blindarle cuando su cláusula está en 50 M
  // valiendo 38 M, sin sentido») el paso de alinear sobra si el once que propone es el que ya tienes puesto en LaLiga
  // (K('mi-once'), que app.js mira al cargar), y si cambia dice quién entra y quién sale; blindar a uno sin riesgo no
  // tiene sentido: se quita y va a los descartes con el porqué
  const puesto = (() => { const g = LS.get(K('mi-once'), null); return !M.enJuego && g && Date.now() - g.t < 2 * DIA && (g.ids || []).length >= 10 ? new Set(g.ids.map(String)) : null; })();
  const titP = ((P.alineacion && P.alineacion.titulares) || []).map((n) => buscar(n)).filter(Boolean).map((j) => String(j.id));
  const yaPuesto = !!puesto && titP.length >= 10 && titP.every((id) => puesto.has(id));
  const quitados = [];
  lista = lista.filter((o) => {
    const acc = String(o.accion || '').toLowerCase();
    if (/alinea/.test(acc)) {
      if (yaPuesto) return false;
      const j = buscar(o.jugador);
      return !(puesto && !titP.length && j && puesto.has(String(j.id)));
    }
    if (acc === 'blindar') {
      const porRef = cat.ref[String(o.ref || '').trim().toUpperCase()];
      const j = (porRef && porRef.pid && D.maestro[porRef.pid]) || buscar(o.jugador);
      const x = j && (M.mias || []).find((y) => y.pid === j.id);
      if (x && x.riesgo === 'ninguno') {
        quitados.push({ jugador: j.nombre, ref: null, motivo: `La app lo quita: su cláusula (${eur(x.clausula)}) ya está ${x.ratio ? `un ${pct((x.ratio - 1) * 100, 0)} ` : ''}por encima de su valor (${eur(x.j.valor)}) y no hay riesgo de que te lo quiten.` });
        return false;
      }
    }
    return true;
  }).map((o) => {
    if (!/alinea/i.test(String(o.accion || '')) || !puesto || titP.length < 10) return o;
    const nom = (id) => (D.maestro[id] || {}).nombre || '';
    const entran = titP.filter((id) => !puesto.has(id)), salen = [...puesto].filter((id) => !titP.includes(id));
    const j = D.maestro[entran[0]];
    return { ...o, jugador: j ? j.nombre : o.jugador, pid: j ? j.id : o.pid, cambioOnce: `Cambia en tu once de LaLiga: entra${entran.length > 1 ? 'n' : ''} ${entran.map(nom).join(', ')}${salen.length ? ` y sale${salen.length > 1 ? 'n' : ''} ${salen.map(nom).join(', ')}` : ''}.` };
  });
  if (empezo && !lista.length) lista = [{ accion: 'esperar', jugador: '', donde: '', importe: null, cuando: 'ahora', motivo: `La jornada ${M.enJuego.n} ya ha empezado (${cuando(M.enJuego.ini)}) y este plan es de antes. Tu once de esta jornada ya está cerrado (LaLiga lo bloquea con el primer partido). Pide un plan nuevo, ya pensando en la jornada ${M.proxima ? M.proxima.n : 'siguiente'}: con la jornada empezada se han reabierto las cláusulas.` }];
  const ops = lista.map((o0, i) => {
    let o = { ...o0 };
    // la ref de la operación manda sobre el nombre (un nombre parecido podía dar otro jugador)
    const porRef = cat.ref[String(o.ref || '').trim().toUpperCase()];
    const j = (o.pid && D.maestro[o.pid]) || (porRef && porRef.pid && D.maestro[porRef.pid]) || buscar(o.jugador);
    const pid = j && j.id;
    const cl = pid && M.clausulas.find((x) => x.pid === pid);
    const original = String(o.accion || '').toLowerCase();
    let accion = original.replace('aceptar_oferta', 'vender').replace('aceptar', 'vender').replace('ofertar', 'comprar');
    let aceptar = /aceptar/.test(original) || /acepta/i.test(o.donde || '');
    // (tope: si la app la descarta porque no te llega, hasta cuánto podrías pujar o comprar; Mercado → Fichar lo enseña)
    let importe = o.importe != null ? +o.importe : null, signo = 0, aviso = o.cambioOnce || null, descartada = false, sobre = null, tope = null;
    // lo que ya has hecho en LaLiga desde que se hizo el plan (vender al que decía, fichar al que decía) no se puede
    // volver a hacer, pero no es un error: se queda como hecho, sin contarlo otra vez en el saldo
    const desdeP = P.t || (P.dia ? Date.parse(`${P.dia}T00:00:00`) : 0);
    const ya = pid && OPERA.includes(accion) ? (M.actividad || []).find((a) => a.esYo && a.pid === pid && a.t > desdeP
      && (accion === 'vender' ? a.clase === 'venta' : accion === 'blindar' ? a.clase === 'blindaje' : a.clase === 'compra' || a.clase === 'clausula')) : null;
    const opC = !ya && !o.noReconocida && OPERA.includes(accion) ? buscarOp(cat, o, pid) : null;
    // (A6) la ref manda, pero si el nombre que escribe la IA es de otro jugador, se dice
    const porNombre = porRef && porRef.pid && o.jugador ? buscar(o.jugador) : null;
    const noCasa = porNombre && porNombre.id !== porRef.pid ? `Ojo: la IA ponía «${o.jugador}» con la operación de ${(D.maestro[porRef.pid] || {}).nombre || porRef.ref}; la app sigue la operación (${porRef.ref}).` : null;
    if (o.noReconocida) {
      descartada = true;
      aviso = `La app no reconoce esta operación («${o.noReconocida}»): no es vender, pujar, comprar, clausular, blindar ni alinear, así que no la hagas por este plan.`;
    } else if (ya) { signo = accion === 'vender' ? 1 : accion === 'blindar' ? 0 : -1; importe = ya.importe || importe; }
    else if (accion === 'blindar' && !opC && importe) { descartada = true; aviso = 'La app lo descarta: su cláusula no se abre pronto o no corre riesgo, así que no hace falta pagar para subirla.'; }
    else if (accion === 'blindar' && !opC) aviso = 'Su cláusula no se abre pronto: aún no hace falta';
    else if (OPERA.includes(accion) && !opC) {
      descartada = true;
      const pq = porQueNo(D, M, o, pid, j);
      // (una cláusula que se abre dentro de varios días, como la de Huijsen en el parón: no es un error de la IA que haya que
      // corregir, es que hoy no toca; Carlos, 9 nov)
      aviso = /^Para más adelante/.test(pq) ? `${pq}.` : `La app lo descarta: ${pq.charAt(0).toLowerCase()}${pq.slice(1)}.`;
      if (/^Para más adelante/.test(pq)) o.masAdelante = true;
      signo = accion === 'vender' ? 1 : -1;
    } else if (opC && !({ A: ['vender'], V: ['vender'], P: ['pujar', 'comprar'], M: ['comprar', 'pujar'], T: ['comprar', 'pujar'], C: ['clausular'], B: ['blindar'] }[opC.ref[0]] || [accion]).includes(accion)) {
      // la ref dice una cosa y la acción otra (p. ej. «pujar» con la ref de una venta): no se adivina cuál quería
      descartada = true;
      aviso = `La app lo descarta: la operación ${opC.ref} no es «${accion}».`;
    } else if (opC) {
      // la acción, el importe y el «dónde» de verdad, según la operación posible
      o.ref = opC.ref;
      switch (opC.ref[0]) {
        case 'A': accion = 'vender'; aceptar = true; signo = 1; importe = opC.precio; o.donde = `oferta de ${opC.de}`; break;
        case 'V': accion = 'vender'; signo = 1; importe = importe && importe >= opC.precio * 0.9 ? importe : opC.precio; break;
        case 'P': {
          accion = 'pujar'; signo = -1;
          const puja = o.puja_max != null ? +o.puja_max : importe || opC.puja;
          importe = Math.max(puja || 0, opC.precio); o.puja_max = importe; o.donde = 'libre en el mercado de la liga';
          if (puja && puja < opC.precio) aviso = `La puja mínima es ${eur(opC.precio)}`;
          // lo que se paga en esta liga (aviso de Domy, 29 oct): la puja de la app ya lo cuenta; por debajo, lo normal es perderlo
          const PL = M.pujasLiga;
          // (como mucho hasta lo que se puede pujar hoy: si no, la puja entera se descartaría)
          const cabe = margen != null ? margen + (opC.miPuja ? +opC.miPuja : 0) : Infinity;
          const sube = Math.min(opC.puja || 0, Math.floor(cabe / 10000) * 10000);
          // (con lo que se paga por los de su valor: la mediana de todos engaña con los baratos; Carlos, 30 oct)
          const PV = M.pagaLiga && opC.j && opC.j.valor ? M.pagaLiga(opC.j.valor) : null;
          if (sube > importe && PL && !PL.poco) {
            aviso = `${aviso ? `${aviso}. ` : ''}Subida de ${eur(importe)} a ${eur(sube)}: ${PV ? `en esta liga, los libres de su valor (de ${eur(PV.desde)} a ${eur(PV.hasta)}) se llevan de mediana con un ${pct(PV.med * 100)} sobre su valor (la mitad, entre ${pct(PV.p25 * 100)} y ${pct(PV.p75 * 100)})` : `en esta liga los libres se llevan de mediana con un ${pct(PL.med * 100)} sobre su valor (la mitad, entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)})`}; con menos lo normal es perderlo${sube < opC.puja ? `. La app pujaría ${eur(opC.puja)}, pero no te llega para más` : ''}.`;
            importe = sube; o.puja_max = importe;
          } else if (opC.puja && opC.puja >= opC.precio && importe > opC.puja * 1.1 && importe - opC.puja > 500000) {
            // y al revés: si la IA puja claramente más que la app, se baja a la de la app. La de la app ya cuenta las
            // pujas que lleva, si está subiendo, lo que se paga en esta liga por los de su valor (hasta el p90 con
            // muchas pujas) y lo que aguanta pagar por lo que aporta; un 10 % por encima ya es pagar de más. Y como
            // poco medio millón: en los baratos un 10 % son cuatro duros y se pagan más caros en porcentaje
            aviso = `${aviso ? `${aviso}. ` : ''}La IA pujaba ${eur(importe)}. La app la deja en ${eur(opC.puja)}: con más pagarías de más.`;
            importe = opC.puja; o.puja_max = importe;
          }
          break;
        }
        case 'M': case 'T':
          accion = 'comprar'; signo = -1; o.puja_max = null;
          o.donde = `a ${opC.vendedor}${opC.trato ? ' (vuestro trato)' : ' (lo tiene a la venta)'}`;
          if (opC.trato) importe = importe || opC.precio;
          else {
            // LaLiga también le hace su oferta y se queda con la mejor: por debajo de eso no hay compra posible
            const min = opC.ofertaMin || opC.precio, ol = opC.ofertaLiga;
            const pedida = importe || opC.puja || min;
            importe = Math.max(pedida, min);
            const liga = ol && !ol.sinDatos && !bloqueada('ventasRivales') ? `LaLiga le suele dar unos ${eur(ol.v)} por uno así (lo de hoy solo lo ve él)` : 'LaLiga también le hace su oferta';
            aviso = pedida < min
              ? `Subida a ${eur(min)}: ${liga} y por menos no te lo vende.`
              : `${liga}: si tu oferta no la supera, se queda con la de LaLiga.`;
          }
          break;
        case 'C': accion = 'clausular'; signo = -1; importe = opC.precio; o.donde = `cláusula a ${opC.de}`; if (!opC.abierta) { aviso = opC.veda ? `Cláusulas cerradas hasta que empiece la jornada ${opC.veda.n}: se puede pagar ${cuando(opC.abre)}, no antes` : `Se abre ${cuando(opC.abre)}`; o.cuando = opC.veda ? `${cuando(opC.abre)}, al empezar la jornada` : cuando(opC.abre); } break;
        case 'B': accion = 'blindar'; signo = importe ? -1 : 0; if (!importe && !opC.abierta) { o.cuando = `cuando se abra (${cuando(opC.abre)})`; aviso = `El escudo solo vale con la cláusula abierta: úsalo cuando se abra, ${cuando(opC.abre)}.`; } break;
        default: break;
      }
    }
    if (noCasa) aviso = `${aviso ? `${aviso} ` : ''}${noCasa}`;
    // (A6) «para revender» solo si la app lo ve subiendo hasta el día de venderlo (M.especular: sigue subiendo, no frena ni
    // ha girado, da tiempo a venderlo y gana lo bastante). Si no, es un fichaje como cualquier otro y pasa todos los filtros
    // (salida, calendario, lesión). El beneficio es el de la app con el precio de este paso, no el que escribe la IA
    if (!ya && !descartada && signo < 0 && String(o.objetivo || '').startsWith('revend')) {
      const e = (M.especular || []).find((x) => x.pid === pid);
      if (!e) {
        o.objetivo = 'titular';
        o.beneficio_esperado = null;
        aviso = `${aviso ? `${aviso} ` : ''}La IA lo ponía para revender, pero la app no lo ve subiendo hasta el día de venderlo: se mira como un fichaje normal.`;
      } else {
        const ben = Math.round(e.valorFuturo - (importe || e.precio));
        o.beneficio_esperado = ben;
        o.beneficioApp = true;
        if (ben <= 0) { descartada = true; aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta para revender: pagando ${eur(importe || e.precio)}, el día de venderlo valdría unos ${eur(e.valorFuturo)} y no ganarías nada.`; }
        else if (!o.vender_el && e.vender) o.vender_el = diaDe(e.vender);
      }
    }
    // (19, aviso de Domy, 9 nov) en el parón, con la vuelta a más de 3 días, una cláusula o un fichaje para el once son días
    // sin puntuar con el dinero parado: solo un chollo claro (a un 5 % de su valor y sin bajar) o un trato que te ha contado
    if (!ya && !descartada && signo < 0 && importe && j && ['clausular', 'pujar', 'comprar'].includes(accion) && !String(o.objetivo || '').startsWith('revend') && paronLejos(M) && !cholloParon(M, j, importe)
      && !(opC && opC.trato) && !notasDe(pid).some((n) => /trato|hecho|intencion/.test(n.tipo || '') || n.importe)) {
      descartada = true;
      o.paron = true;
      aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: estamos en el parón y la jornada ${M.proxima.n} no empieza hasta ${cuando(M.proxima.ini)}. ${accion === 'clausular' ? 'Clausularlo' : 'Ficharlo'} ahora para el once son ${eur(importe)} parados ${Math.round((M.proxima.ini - Date.now()) / DIA)} días sin puntuar y su valor puede bajar. Para el once, mejor en los dos o tres días antes de la vuelta; hasta entonces el dinero rinde más especulando.`;
    }
    // (11 nov) Hoy, las alarmas y la IA no se contradicen sobre una cláusula: una para el once que no pasa la regla de
    // Hoy (mereceClausula) se descarta, con el motivo; para revender sí puede ir (la cuenta del beneficio, arriba)
    if (!ya && !descartada && accion === 'clausular' && !String(o.objetivo || '').startsWith('revend') && noMerece(M, { pid })
      && !(opC && opC.trato) && !notasDe(pid).some((n) => /trato|hecho|intencion/.test(n.tipo || '') || n.importe)) {
      descartada = true;
      aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: con lo que pagas de más por su cláusula, su calendario o lo poco que mejora tu once, no es una cláusula que la app recomiende (por eso no sale en Hoy ni en las alarmas).`;
    }
    // (A6) subir la cláusula pagando: como mucho la subida justa de la app; si ya vale o no compensa, no se paga
    if (!ya && !descartada && accion === 'blindar' && importe) {
      const x = (M.mias || []).find((y) => y.pid === pid);
      const bj = x && x.blindaje;
      const tope = bj ? (bj.yaVale ? 0 : bj.caro ? (bj.parcial ? bj.parcial.coste : 0) : bj.coste) : null;
      if (bj && bj.yaVale) { descartada = true; aviso = 'La app lo descarta: su cláusula ya está por encima de lo que se suele pagar en esta liga por una cláusula. No hace falta subirla.'; }
      else if (bj && !tope) { descartada = true; aviso = `La app lo descarta: dejarla fuera del alcance de todos costaría ${eur(bj.coste)} y no compensa.`; }
      else if (tope && importe > tope * 1.1 && importe - tope > 500000) {
        aviso = `${aviso ? `${aviso} ` : ''}La IA pagaba ${eur(importe)} por subirla. La app lo deja en la subida justa, ${eur(tope)}${bj.parcial && bj.caro ? ` (deja fuera a ${bloqueada('quienPaga') ? 'casi todos' : `todos menos a ${bj.parcial.quedan.join(', ')}`})` : ''}: con más pagarías de más.`;
        importe = tope;
      }
    }
    // pagar mucho más de lo que vale: se avisa y, si es una barbaridad sin un trato que le hayas contado, se descarta
    // lo que cuenta es el dinero que se pierde (un +25 % por uno de 3 M no es lo mismo que por uno de 40 M),
    // comparado con tu equipo y con lo que sube al día
    if (!ya && !descartada && signo < 0 && importe && j && j.valor && ['clausular', 'comprar', 'pujar'].includes(accion)) {
      sobre = importe / j.valor - 1;
      const trato = (opC && opC.trato) || notasDe(pid).some((n) => /trato|hecho|intencion/.test(n.tipo || '') || n.importe);
      const sc = M.sobrecoste ? M.sobrecoste(j, importe) : null;
      const mas = (t) => { aviso = `${aviso ? `${aviso} ` : ''}${t}`; };
      if (sc && sc.extra > 0) {
        // escala continua: cuanto más mejora tu once, más sobrecoste se aguanta
        const tol = M.tolerancia(j);
        const base = `${eur(sc.extra)} más de lo que vale (${pct(sobre * 100)}), sobrecoste ${sc.indice}/100${sc.recTxt ? `; ${sc.recTxt}` : ''}`;
        if (sc.indice > tol && !trato) { descartada = true; aviso = `La app lo descarta: pagarías ${base}, y para lo que aporta solo compensaría hasta ${tol}/100.`; }
        else if (sc.indice > tol - 30) mas(`Ojo: pagas ${base}.`);
        else if (sc.indice >= 15) mas(`Pagas ${base}: aceptable para lo que aporta.`);
      }
    }
    // la salida (aviso de Domy, 29 oct): un clausulazo que, si el jugador se tuerce, no se puede vender sin perder y que
    // tampoco es por un titular seguro con buen partido, no se propone; si se puede perder algo, se dice cuánto
    if (!ya && !descartada && signo < 0 && importe && j && j.valor && ['clausular', 'comprar'].includes(accion) && M.salida && !String(o.objetivo || '').startsWith('revend')) {
      const s = M.salida(j, importe);
      const trato = (opC && opC.trato) || notasDe(pid).some((n) => /trato|hecho|intencion/.test(n.tipo || '') || n.importe);
      if (s && !s.ok && accion === 'clausular' && !trato) { descartada = true; aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: ${s.txt}, y no es un titular seguro con buen partido como para ficharlo solo por los puntos.`; }
      else if (s && s.pierde > 0) aviso = `${aviso ? `${aviso} ` : ''}Salida: ${s.txt}.`;
    }
    // vender a uno con una sanción de un partido: no es motivo por sí solo (la guía de lesionados y sancionados); si la IA
    // no tiene otra razón de las que ve la app (la inercia, que su valor caiga fuerte), se dice
    if (!ya && !descartada && accion === 'vender' && !aceptar && j && M.sancionCorta && M.sancionCorta(j)) {
      const x = M.mias.find((y) => y.pid === pid);
      if (x && !x.ventaInercia && !M.vendeBaja(x)) aviso = `${aviso ? `${aviso} ` : ''}Ojo: solo está sancionado una jornada. Se pierde la próxima y vuelve a la siguiente: por eso solo no hace falta venderlo.`;
    }
    // fichar a un lesionado o sancionado para el once: aviso
    if (!ya && !descartada && signo < 0 && j && ['injured', 'suspended'].includes(j.estado) && !String(o.objetivo || '').startsWith('revend')) aviso = `${aviso ? `${aviso} ` : ''}Ojo: está ${j.estado === 'injured' ? 'lesionado' : 'sancionado'}.`;
    // lo que se hace hoy suma al saldo; lo de otro día (o cuando se abra una cláusula), no
    const cu = String(o.cuando || '').trim();
    const diaIA = String(o.dia || '').trim();
    const otroDia = (/^\d{4}-\d{2}-\d{2}$/.test(diaIA) && diaIA !== diaDe()) || /cuando se abra|se abre|si vendes/i.test(cu) || (opC && opC.tipo === 'clausular' && !opC.abierta && diaDe(opC.abre) !== diaDe())
      || (/^(el )?(pasado )?(mañana|lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\w*\b|^(el )?\d{1,2} (de )?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test(cu) && !/^(hoy|esta noche|antes|hasta)\b/i.test(cu) && accion !== 'pujar');
    const hoy = (!otroDia || !!(cl && cl.abierta && accion === 'clausular')) && !descartada;
    // una cláusula de hoy que no cabe en la caja: LaLiga no deja clausular quedándote en negativo
    if (margen != null && ['pujar', 'comprar'].includes(accion) && hoy && !ya && !descartada && importe) {
      const mia = opC && opC.miPuja ? +opC.miPuja : 0;
      if (importe - mia > margen) { descartada = true; tope = Math.max(0, margen + mia); aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: no puedes pujar ni comprar por más de ${eur(Math.max(0, margen + mia))} (tu saldo más el margen de deuda, menos lo que ya tienes pujado).`; }
      else margen -= importe - mia;
    }
    if (caja != null && accion === 'blindar' && hoy && !ya && !descartada && importe && importe > caja) { descartada = true; aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta. No te llega: subir la cláusula se paga con saldo, sin deuda, y ahora tendrías ${eur(Math.max(0, caja))}.`; }
    if (caja != null && accion === 'clausular' && hoy && !ya && importe && importe > caja) descartada = true;
    if (caja != null && accion === 'clausular' && hoy && !ya && importe && importe > caja) aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta. No te llega: una cláusula solo se paga con saldo, sin deuda, y ahora tendrías ${eur(Math.max(0, caja))}${caja < saldo ? ' (lo que pones en venta no entra hasta que aceptas la oferta)' : ''}.`;
    // (lo ya hecho ya está en tu saldo de ahora)
    // un fichaje para el once con un calendario duro o de riesgo alto, solo de parche y cerca de su valor (lo dice el
    // motor con M.compraCal): se avisa
    if (!ya && !descartada && signo < 0 && j && importe && ['clausular', 'comprar', 'pujar'].includes(accion) && !String(o.objetivo || '').startsWith('revend') && M.compraCal) {
      const cc = M.compraCal(j, importe);
      if (!cc.ok && cc.txt) aviso = `${aviso ? `${aviso} ` : ''}Ojo: ${cc.txt.charAt(0).toLowerCase()}${cc.txt.slice(1)}`;
    }
    // para revender hace falta tiempo: lo del mercado llega en el siguiente cambio y luego hay que venderlo (2 cambios);
    // una cláusula, 1. Sin eso no da tiempo a venderlo antes de la jornada
    if (!ya && !descartada && signo < 0 && String(o.objetivo || '').startsWith('revend') && M.ventanaEsp) {
      const hace = accion === 'pujar' || accion === 'comprar' ? 2 : 1;
      if ((M.ventanaEsp.ciclos || 0) < hace) { descartada = true; aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: no da tiempo a revenderlo antes de la jornada (${M.enJuego ? 'la jornada está en juego' : `quedan ${M.ventanaEsp.ciclos || 0} cambios de mercado que cuentan y hacen falta ${hace}`}).`; }
    }
    // una cláusula para otro día: el dinero tiene que estar en caja entonces (lo que pongas a la venta no entra hasta aceptar)
    if (!ya && !descartada && accion === 'clausular' && !hoy && importe && caja != null && importe > caja) aviso = `${aviso ? `${aviso} ` : ''}Cuando se abra necesitarás ${eur(importe)} en caja; ahora tienes ${eur(Math.max(0, caja))} y lo que pongas a la venta no entra hasta que aceptes una oferta.`;
    if (saldo != null && signo && importe && hoy && !ya && !descartada) {
      const mia = (accion === 'pujar' || accion === 'comprar') && opC && opC.miPuja ? +opC.miPuja : 0;
      saldo += signo * (importe - mia);
      if (signo < 0 || aceptar) caja += signo * importe;
      if (aceptar && margen != null) margen += importe;
      // (una cláusula o un blindaje pagados también bajan lo que se puede pujar o comprar después)
      if (margen != null && signo < 0 && !['pujar', 'comprar'].includes(accion)) margen -= importe;
    }
    return { ...o, accion, etiqueta: aceptar ? 'Aceptar oferta' : accion === 'blindar' ? (importe ? 'Subir cláusula' : 'Blindar') : o.retira ? 'Retirar puja' : null, n: i + 1, j, pid, importe, signo, saldo: signo && importe && hoy && !ya ? saldo : null, aviso, hoy, descartada, tope, sobre, ya: !!ya };
  });
  // los blindajes gratis de LaLiga: 2 por jornada. Si el plan pide más de los que te quedan, sobran los últimos
  const ES = M.escudosMios;
  if (ES) {
    let libres = ES.quedan;
    for (const o of ops) {
      if (o.accion !== 'blindar' || o.importe || o.ya || o.descartada || !o.hoy) continue;
      if (libres > 0) { libres--; continue; }
      o.descartada = true;
      o.aviso = ES.quedan ? `No te queda blindaje para este: te ${ES.quedan === 1 ? 'queda 1' : `quedan ${ES.quedan}`} esta jornada y ya va${ES.quedan === 1 ? '' : 'n'} en el plan antes.` : `Ya has gastado los ${ES.usados} blindajes de esta jornada: hasta que acabe la jornada no hay más.`;
    }
  }
  let final = saldo;
  // (aviso de Carlos, 3 nov: Oyarzabal, «Aceptar oferta» con un aviso de que no hacía falta, perdiendo 7,67 M y con 3 días
  // hasta la jornada) una venta que no hace falta no se recomienda con un aviso al lado: se descarta y sale del saldo.
  // Se queda (con el aviso) si detrás hay una cláusula o una subida de cláusula de hoy, que se pagan con lo que hay en caja
  const pagaCaja = (o) => ops.some((x) => x.n > o.n && x.hoy && !x.ya && !x.descartada && x.importe && ['clausular', 'blindar'].includes(x.accion));
  const quitarVenta = (o, txt) => {
    o.descartada = true;
    o.aviso = txt;
    final -= o.importe;
    for (const x of ops) if (x.n > o.n && x.saldo != null) x.saldo -= o.importe;
    o.saldo = null;
  };
  // vender sin necesidad: si sin esa venta acabarías en positivo y la app no la aceptaría (no entra en tu once y la
  // oferta no es buena), se descarta; puede esperar a una oferta mejor
  for (const o of ops) {
    if (o.accion !== 'vender' || !o.hoy || o.ya || o.descartada || !o.importe || final == null || final - o.importe < 0) continue;
    const v = (M.misVentas || []).find((x) => x.pid === o.pid);
    if (!v || v.consejo !== 'esperar' || !v.porque) continue;
    if (pagaCaja(o)) o.aviso = `${o.aviso ? `${o.aviso} ` : ''}No hace falta venderlo: sin esta venta acabarías con ${eur(final - o.importe)}. ${v.porque}`;
    else quitarVenta(o, `La app lo descarta: no te hace falta el dinero (sin esta venta acabarías con ${eur(final - o.importe)}). ${v.porque}`);
  }
  // el que vuelve y sigue subiendo (se hundió y ahora juega y sube varios días seguidos): no se manda vender mientras
  // siga subiendo, salvo que haga falta el dinero o sea uno comprado para revender (0.7n, el caso De Jong)
  for (const o of ops) {
    if (o.accion !== 'vender' || !o.pid || o.ya || o.descartada || !M.inercia) continue;
    const ine = M.inercia(o.pid);
    if (!ine || !ine.vuelve || (M.paraRevender || []).some((x) => x.pid === o.pid)) continue;
    const txt = `vuelve y sigue subiendo (un ${pct(ine.vuelve.ritmo * 100, 1, false)} al día; llegó a valer ${eur(ine.vuelve.max)}): cada día que lo aguantes vale más.`;
    if (o.hoy && o.importe && final != null && final - o.importe >= 0 && !pagaCaja(o)) quitarVenta(o, `La app lo descarta: no te hace falta el dinero (sin esta venta acabarías con ${eur(final - o.importe)}) y ${txt}`);
    else o.aviso = `${o.aviso ? `${o.aviso} ` : ''}Ojo: ${txt} Véndelo solo si necesitas el dinero.`;
  }
  // (0.7.8c, aviso de Carlos, 13 nov 17:16: «me recomienda vender a Fornals cuando vale 53 M, lo compré por 54, le quedan
  // 9 días de cláusula cerrada y sube más de 1 M al día») lo tuyo que sube de verdad (más de un 0,5 % al día, sin frenar)
  // no se vende si no hace falta el dinero: aguantarlo hasta la jornada vale más que lo que da hoy la oferta. Fuera de
  // esto: lo comprado para revender, el que está de baja y una oferta que ya paga lo que subiría
  const subeFuerte = (o) => {
    if (o.accion !== 'vender' || !o.pid || o.ya || o.descartada || !M.inercia) return null;
    const x = M.mias.find((y) => y.pid === o.pid);
    if (!x || !x.j || !x.j.valor || (M.paraRevender || []).some((y) => y.pid === o.pid) || x.ventaInercia) return null;
    if ((M.vendeBaja && M.vendeBaja(x)) || ['injured', 'suspended'].includes(x.j.estado)) return null;
    const ine = M.inercia(o.pid);
    if (!ine || !['sube', 'acelera'].includes(ine.fase) || num(ine.ult) < x.j.valor * 0.005) return null;
    // hasta el día antes de la jornada (en el parón, la de la vuelta)
    const dias = M.proxima ? Math.max(1, Math.ceil((M.proxima.ini - Date.now()) / DIA) - 1) : ine.hastaJ;
    const gana = ine.proy ? ine.proy(dias) : ine.proyJ;
    const extra = (o.importe || x.j.valor) - x.j.valor;
    if (!(gana > 0) || extra >= gana) return null;
    const cerrada = !x.abierta && x.abreEn > DIA ? ` y su cláusula está cerrada ${dura ? `${dura(x.abreEn)} más` : 'unos días más'} (no te lo pueden quitar)` : '';
    return { x, gana, dias, txt: `sube ${eur(ine.ult, { signo: true })} al día${cerrada}: aguantándolo ${dias} día${dias === 1 ? '' : 's'} más vale unos ${eur(gana)} más de lo que te dan hoy.` };
  };
  for (const o of ops) {
    const sf = subeFuerte(o);
    if (!sf) continue;
    const sin = final != null ? final - (o.importe || 0) : null;
    // (también ponerlo a la venta sin oferta todavía: el dinero no entra hoy, pero si sin él no te falta, es venderlo para nada)
    if ((o.hoy || !o.importe) && sin != null && sin >= 0 && !pagaCaja(o)) {
      const txt = `La app lo descarta: no te hace falta el dinero (sin esta venta acabarías con ${eur(sin)}) y ${sf.txt}`;
      if (o.importe) quitarVenta(o, txt); else { o.descartada = true; o.aviso = txt; o.saldo = null; }
      o.aguanta = 'sube';
    }
    else o.aviso = `${o.aviso ? `${o.aviso} ` : ''}Ojo: ${sf.txt} Véndelo solo si de verdad necesitas el dinero.`;
  }
  // lo que pagaste por él: cuánto ganas o pierdes con la venta. Perder dinero sin necesidad (no hace falta el dinero
  // y no está bajando) se avisa; si está bajando, lo que pagaste no cambia nada: lo perdido ya no vuelve
  for (const o of ops) {
    if (o.accion !== 'vender' || !o.pid || o.ya) continue;
    const x = M.mias.find((y) => y.pid === o.pid);
    if (!x) continue;
    const precio = o.importe || x.j.valor;
    // sin precio de compra: si venía en tu equipo inicial, con lo que valía entonces; si no, se dice que no se sabe
    if (!x.compra) { o.compra = x.inicial ? { precio: x.inicial, gana: precio - x.inicial, con: o.importe ? 'venta' : 'valor', inicial: true } : { desconocida: true }; continue; }
    o.compra = { precio: x.compra, gana: precio - x.compra, con: o.importe ? 'venta' : 'valor' };
    if (o.descartada || o.compra.gana >= 0 || !o.hoy || final == null || final - (o.importe || 0) < 0) continue;
    const t = M.tend(o.pid);
    const bajando = ((M.partidazo && M.partidazo(o.pid)) || {}).nivel !== 3 && (x.ventaInercia || (t.p1 != null && t.p1 < -1) || ((t.p7e !== undefined ? t.p7e : t.p7) != null && (t.p7e !== undefined ? t.p7e : t.p7) < -3) || (M.vendeBaja ? M.vendeBaja(x) : ['injured', 'suspended'].includes(x.j.estado)));
    if (bajando || /No hace falta venderlo/.test(o.aviso || '')) continue;
    const perder = `Lo venderías por ${eur(-o.compra.gana)} menos de lo que pagaste, no te hace falta el dinero y no está bajando: puede esperar a una oferta mejor.`;
    // y si además la oferta no llega a su valor, ni se propone
    if (o.importe && o.importe < x.j.valor && !pagaCaja(o)) quitarVenta(o, `La app lo descarta: ${perder.charAt(0).toLowerCase()}${perder.slice(1)}`);
    else o.aviso = `${o.aviso ? `${o.aviso} ` : ''}${perder}`;
  }
  // la cláusula abierta frente a venderlo a LaLiga (aviso de Domy, 6 nov): cada venta del plan dice a cuánto está la cláusula,
  // cuánto daría LaLiga y qué sale mejor; si la cláusula paga más y le llega a algún rival, y no hay urgencia (no está de
  // baja ni hace falta el dinero), se avisa de que mejor esperar
  for (const o of ops) {
    if (o.accion !== 'vender' || !o.pid || o.ya || o.descartada || !o.hoy) continue;
    const x = M.mias.find((y) => y.pid === o.pid);
    const vc = x && M.ventaClausula ? M.ventaClausula(x) : null;
    if (!vc || /Su cláusula está abierta/.test(o.aviso || '')) continue;
    const urge = (M.vendeBaja && M.vendeBaja(x)) || pagaCaja(o) || (x.ventaInercia && x.ventaInercia.urgencia === 'ya');
    o.aviso = `${o.aviso ? `${o.aviso} ` : ''}${vc.txt}${vc.espera && !urge ? ' Si no tienes prisa, mejor espera.' : ''}`;
  }
  // (aviso de Carlos, 3 nov, 12:16: Ibañez y Javi Guerra, «Aceptar oferta · ahora» perdiendo 1,37 y 5,85 M, con el saldo
  // a −1,18 M y 3 días hasta la jornada) en negativo entre semana no hay que vender ya: lo obligatorio es empezar la
  // jornada en positivo, y antes LaLiga hace una oferta nueva en cada cambio de mercado. Una venta de hoy que pierde
  // dinero frente a lo que pagaste, con 2 o más cambios de mercado antes de la jornada, sale como sugerencia (no cuenta
  // en el saldo ni en lo que queda por hacer), salvo que pague una cláusula o subida de hoy, haga falta para no pasarte
  // del límite de deuda, esté de baja o se hunda (más de un 3 % al día)
  const cambiosAntes = M.ventanaEsp ? M.ventanaEsp.ciclos || 0 : 0;
  let sugeridas = 0;
  for (const o of ops) {
    if (o.accion !== 'vender' || !o.hoy || o.ya || o.descartada || !o.importe || !o.pid || final == null) continue;
    if (!o.compra || o.compra.desconocida || o.compra.gana >= 0 || cambiosAntes < 2 || pagaCaja(o) || final - o.importe < -M.deuda) continue;
    const x = M.mias.find((y) => y.pid === o.pid);
    if (!x || ['injured', 'suspended'].includes(x.j.estado)) continue;
    const t = M.tend(o.pid), ine = M.inercia ? M.inercia(o.pid) : null;
    if ((ine && x.j.valor && num(ine.ult) < -0.03 * x.j.valor) || (t.p1 != null && t.p1 < -3)) continue;
    o.sugerencia = true;
    o.hoy = false;
    o.cuando = 'sin prisa';
    final -= o.importe;
    for (const y of ops) if (y.n > o.n && y.saldo != null) y.saldo -= o.importe;
    o.saldo = null;
    sugeridas += o.importe;
    const lim = M.ventanaEsp.limite;
    o.aviso = `No hace falta hoy: venderías perdiendo ${eur(-o.compra.gana)} de lo que pagaste y quedan ${cambiosAntes} cambios de mercado antes de la jornada${M.proxima ? ` ${M.proxima.n} (${cuando(M.proxima.ini)})` : ''}, con una oferta nueva de LaLiga en cada uno. Lo obligatorio es empezar la jornada en positivo: ${lim ? `si te hace falta, te vale aceptar la que llegue ${cuando(lim)}` : 'si te hace falta, véndelo antes'}.${o.aviso ? ` ${o.aviso.replace(/\s*Lo venderías por [^.]*mejor\./, '').trim()}` : ''}`.trim();
  }
  // en negativo puede ser a propósito: lo comprado para revender se vende antes de la jornada
  const rev = ops.filter((o) => String(o.objetivo || '').startsWith('revend') && o.signo < 0 && o.importe && o.hoy);
  // (A6) con el beneficio de la app (M.especular), nunca con el que escribe la IA
  const recupera = rev.reduce((s, o) => s + (o.beneficioApp && o.beneficio_esperado ? +o.importe + +o.beneficio_esperado : +o.importe), 0);
  let avisoSaldo = null, avisoTipo = null;
  if (final != null && final < -M.deuda) { avisoSaldo = `Te pasarías del límite de deuda (${eur(-M.deuda)})`; avisoTipo = 'mal'; }
  else if (final != null && final < 0 && rev.length && final + recupera >= 0) {
    avisoSaldo = `En negativo a propósito hasta que vendas lo de revender (${rev.map((o) => (o.j && o.j.nombre) || o.jugador).join(', ')}). Con eso vuelves a unos ${eur(final + recupera)} antes de la jornada`;
    avisoTipo = 'plan';
  } else if (final != null && final < 0 && sugeridas && final + sugeridas >= 0) {
    avisoSaldo = `En negativo, pero sin prisa: tienes hasta ${M.ventanaEsp && M.ventanaEsp.limite ? cuando(M.ventanaEsp.limite) : 'antes de la jornada'} para vender y empezar la jornada en positivo (las ventas sugeridas te dejarían en ${eur(final + sugeridas)})`;
    avisoTipo = 'plan';
  } else if (final != null && final >= 0 && sugeridas > 0) {
    // (aviso de Carlos, 4 nov: «me pone de vender todo eso y me quedaría con 30 M teniendo 24 M») las ventas sin prisa
    // no cuentan en el saldo de hoy: se dice, con lo que tendrías si las haces también
    avisoSaldo = `Te quedas con, haciendo lo de hoy (con las ventas sin prisa también: ${eur(final + sugeridas)})`;
  } else if (final != null && final < 0) { avisoSaldo = M.enJuego ? `Acabarías en negativo (${eur(final)}): vende antes de que empiece la próxima jornada` : `Acabarías en negativo (${eur(final)}): vende antes de que empiece la jornada`; avisoTipo = 'mal'; }
  // lo que queda en tu plantilla tras el plan de hoy: lo que vendes, fuera; lo que clausulas o compras, dentro (las
  // pujas solo si las ganas: no cuentan). Si el once pierde mucho o se queda con huecos, se dice (revisión del 25 oct)
  // (aviso de Carlos, 30 oct: Gulácsi, con la cláusula a las 21:00 y su partido a las 21:00) una cláusula que se abre
  // cuando ya ha empezado la jornada de su partido, o está a punto, se puede pagar pero no llega a alinearlo: LaLiga
  // cierra el once con el primer partido de la jornada, no con el suyo (aviso de Domy, 31 oct). Cuenta en el saldo, no
  // en el once. Con esa jornada ya en juego no se avisa: el plan ya es para la siguiente
  const tarde = new Map();
  for (const o of ops) {
    if (o.accion !== 'clausular' || !o.pid || !o.j || o.descartada || o.ya) continue;
    const cl = M.clausulas.find((x) => x.pid === o.pid);
    const pa = cl && !cl.abierta && M.proximoPartido ? M.proximoPartido(o.j.equipoId) : null;
    const jo = pa && (M.jornadas || []).find((x) => x.n === pa.jornada);
    const cierre = jo ? jo.ini : pa && pa.fecha;
    if (!pa || !cierre || cierre <= Date.now() || cl.protegidoHasta + 10 * MIN <= cierre) continue;
    tarde.set(o.pid, { j: o.j, abre: cl.protegidoHasta, ini: cierre });
    const t = `Se abre ${cuando(cl.protegidoHasta)} y la jornada${jo ? ` ${jo.n}` : ''} empieza ${cuando(cierre)} (con el primer partido LaLiga cierra el once): esta jornada no lo vas a poder alinear.`;
    o.aviso = o.aviso ? `${String(o.aviso).replace(/[.\s]+$/, '')}. ${t}` : t;
  }
  for (const o of ops) {
    if (o.accion !== 'alinear' || !o.pid || o.descartada || !tarde.has(o.pid)) continue;
    const t = tarde.get(o.pid);
    o.descartada = true;
    o.aviso = `La app lo descarta: ${t.j.nombre} no llega a tu once esta jornada. Su cláusula se abre ${cuando(t.abre)} y la jornada empieza ${cuando(t.ini)}, cuando LaLiga cierra el once.`;
  }
  const vendeHoy = new Set(ops.filter((o) => o.accion === 'vender' && o.hoy && !o.descartada && !o.ya && o.pid).map((o) => o.pid));
  const entraHoy = ops.filter((o) => ['clausular', 'comprar'].includes(o.accion) && o.hoy && !o.descartada && !o.ya && o.j && !tarde.has(o.pid)).map((o) => o.j);
  const quedan = [...M.mias.filter((x) => !vendeHoy.has(x.pid)).map((x) => x.j), ...entraHoy];
  let avisoOnce = null;
  if (!empezo && M.once && M.mejorOnce && vendeHoy.size) {
    const tras = M.mejorOnce(quedan);
    if (tras && ((tras.huecos || 0) > (M.once.huecos || 0) || tras.total < M.once.total - 1.5)) avisoOnce = `Con estas ventas tu once pasa de ${d1(M.once.total)} a ${d1(tras.total)} puntos esperados${(tras.huecos || 0) > (M.once.huecos || 0) ? ` y se queda con ${tras.huecos} hueco${tras.huecos > 1 ? 's' : ''}` : ''}: ficha a alguien antes de la jornada${M.enJuego && M.proxima ? ` ${M.proxima.n}` : ''} o no vendas a todos.`;
  }
  // la alineación de la IA, comprobada: 11 tuyos (o fichados hoy en el plan) que no vendes hoy, un portero y una
  // formación de las gratis. Si no cuadra, la de la app
  let alineacion = sinOnce ? null : P.alineacion, avisoAlin = null;
  // (solo la de la IA: la del plan automático es el mejor once de la app)
  if (P.modelo && alineacion && Array.isArray(alineacion.titulares)) {
    const pos = quedan.filter(Boolean);
    const quien = (n) => { const k = norm(n); if (!k) return null; return pos.find((j) => norm(j.nombre) === k) || pos.find((j) => norm(j.largo || '') === k) || pos.find((j) => norm(j.nombre).length > 3 && (k.includes(norm(j.nombre)) || norm(j.nombre).includes(k))) || null; };
    const js = alineacion.titulares.map(quien);
    const f = (M.formaciones || []).find((g) => g.join('-') === (String(alineacion.formacion || '').match(/\d/g) || []).join('-'));
    const bien = js.length === 11 && js.every(Boolean) && new Set(js.map((j) => j.id)).size === 11 && js.filter((j) => j.pos === 1).length === 1
      && !!f && [2, 3, 4].every((p, i) => js.filter((j) => j.pos === p).length === f[i]);
    const llegaTarde = [...tarde.values()].filter((t) => alineacion.titulares.some((n) => norm(n) === norm(t.j.nombre)));
    if (!bien) {
      avisoAlin = llegaTarde.length
        ? `La alineación de la IA ponía a ${llegaTarde.map((t) => t.j.nombre).join(', ')}, que no llega${llegaTarde.length > 1 ? 'n' : ''}: su cláusula se abre ${cuando(llegaTarde[0].abre)}, cuando LaLiga ya ha cerrado el once de la jornada. Te pongo la mejor que sale con tu plantilla.`
        : 'La alineación de la IA no cuadra (algún jugador no es tuyo, lo vendes hoy, sobra o falta alguno, o la formación no es de las gratis): te pongo la mejor que sale con tu plantilla.';
      alineacion = null;
    } else {
      // (aviso de Domy, 30 oct: «me recomienda alinear un defensa del Racing jugando contra el Madrid») la IA no siempre
      // pesa el rival: si en el banquillo hay uno que puede jugar y del que la app espera bastante más, se cambia y se dice
      const no = new Set([...(Array.isArray(P.descartes) ? P.descartes : []).map((d) => norm(d && d.jugador)), ...ops.filter((o) => o.accion === 'vender' && !o.descartada && o.pid).map((o) => norm((D.maestro[o.pid] || {}).nombre))].filter(Boolean));
      const mej = mejorarAlin(js, pos, M, no);
      if (mej.cambios.length) {
        const once = mej.once;
        const forma = [2, 3, 4].map((p) => once.filter((j) => j.pos === p).length).join('-');
        const orden = [1, 2, 3, 4].flatMap((p) => once.filter((j) => j.pos === p));
        alineacion = { ...alineacion, formacion: forma, titulares: orden.map((j) => j.nombre), dudas: (alineacion.dudas || []).filter((d) => !mej.cambios.some((c) => norm(String(d).split(':')[0]) === norm(c.sale.nombre))), cambiosApp: mej.cambios.length };
        const enLaLiga = puesto && mej.cambios.some((c) => puesto.has(String(c.sale.id)) || !puesto.has(String(c.entra.id)));
        const hasta = Math.min(...mej.cambios.flatMap((c) => [c.sale, c.entra].map((j) => (M.proximoPartido(j.equipoId) || {}).fecha || Infinity)));
        const forma0 = (String(P.alineacion.formacion || '').match(/\d/g) || []).join('-');
        // «por el rival» solo si el que sale lo tiene más difícil que el que entra; si no, es por la titularidad o la forma
        const fr = (j) => ((M.factorRival && M.factorRival(j)) || {}).f || 1;
        const porRival = mej.cambios.every((c) => fr(c.sale) + 0.08 < fr(c.entra));
        avisoAlin = `La app cambia ${mej.cambios.length > 1 ? `${mej.cambios.length} del once de la IA` : 'uno del once de la IA'}${porRival ? ' por el rival' : ', que espera más puntos así'}: ${mej.cambios.map((c) => `entra ${c.entra.nombre} (${partidoTxt(M, c.entra)}, ~${d1(c.pe)} pts) por ${c.sale.nombre} (${partidoTxt(M, c.sale)}, ~${d1(c.ps)})`).join('; ')}.${forma !== forma0 ? ` Queda en ${forma}.` : ''}${enLaLiga && Number.isFinite(hasta) ? ` Cámbialo en LaLiga antes de que empiece su partido (${cuando(hasta)}).` : ''}`;
        // el paso de alinear del plan decía quién entraba y salía con el once de la IA: ahora, con el bueno
        if (puesto) {
          const ids = once.map((j) => String(j.id));
          const nom = (id) => (D.maestro[id] || {}).nombre || '';
          const entran = ids.filter((id) => !puesto.has(id)), salen = [...puesto].filter((id) => !ids.includes(id));
          const txt = entran.length ? `Cambia en tu once de LaLiga: entra${entran.length > 1 ? 'n' : ''} ${entran.map(nom).join(', ')}${salen.length ? ` y sale${salen.length > 1 ? 'n' : ''} ${salen.map(nom).join(', ')}` : ''}.` : '';
          // (si con el cambio queda justo el que ya tienes puesto, el paso de alinear sobra)
          if (!entran.length) for (let i = ops.length - 1; i >= 0; i--) { if (ops[i].accion === 'alinear') ops.splice(i, 1); }
          for (const o of ops) if (o.accion === 'alinear' && o.cambioOnce) { o.aviso = String(o.aviso || '').replace(o.cambioOnce, txt) || txt; o.cambioOnce = txt; }
        }
        // y si el paso de alinear nombra a uno que la app ha sacado, pasa a nombrar al que entra por él
        for (const o of ops) {
          if (o.accion !== 'alinear' || !o.pid) continue;
          const c = mej.cambios.find((x) => String(x.sale.id) === String(o.pid));
          if (!c) continue;
          const nota = `La app pone a ${c.entra.nombre} en vez de ${c.sale.nombre} (${partidoTxt(M, c.sale)}).`;
          Object.assign(o, { j: c.entra, pid: c.entra.id, jugador: c.entra.nombre, aviso: o.aviso ? `${nota} ${o.aviso}` : nota });
        }
        js.splice(0, js.length, ...once);
      }
      const malos = js.filter((j) => ['injured', 'suspended', 'out_of_league'].includes(j.estado));
      if (malos.length) avisoAlin = `${avisoAlin ? `${avisoAlin} ` : ''}Ojo: en la alineación ${malos.length > 1 ? 'van' : 'va'} ${malos.map((j) => j.nombre).join(', ')}, que no puede${malos.length > 1 ? 'n' : ''} jugar.`;
    }
  }
  const descartes0 = Array.isArray(P.descartes) ? P.descartes.filter((d) => !String((d && d.ref) || '').trim().toUpperCase().startsWith('M-')) : P.descartes;
  const descartes = quitados.length ? [...quitados, ...(Array.isArray(descartes0) ? descartes0.filter((d) => !quitados.some((q) => norm(q.jugador) === norm(d && d.jugador))) : [])] : descartes0;
  // el paso de alinear no puede nombrar a uno que no es tuyo (la alineación ya se ha corregido arriba, el paso no)
  for (const o of ops) {
    if (o.accion !== 'alinear' || !o.pid || M.dueno[o.pid] === yoT || ops.some((x) => x.pid === o.pid && !x.descartada && ['clausular', 'pujar', 'comprar'].includes(x.accion))) continue;
    const quien = (o.j && o.j.nombre) || o.jugador;
    Object.assign(o, { j: null, pid: null, jugador: '', aviso: `${o.aviso ? `${o.aviso} ` : ''}La IA nombraba aquí a ${quien}, que no es tuyo: no puede ir en tu once.` });
  }
  const { titular, situacion, titularApp } = textoSinDescartes(P, ops, OPERA, quitados);
  return { ...P, titular, situacion, titularApp, descartes, ops, final, avisoSaldo, avisoTipo, recupera, empezo, alineacion, avisoOnce, avisoAlin, pujasHechas: +M.misPujas || 0 };
}

/* (0.7.8g, aviso de Carlos, 13 nov 19:58: el titular decía «hoy toca hacer caja aceptando la oferta por Fornals» y justo
   debajo la app descartaba esa venta) el titular y el resumen los escribe la IA antes de que la app cuadre el plan: si
   nombran a alguien cuya operación la app ha descartado (y no le queda otra operación en pie), se quita esa parte y el
   titular se rehace con lo que sí queda para hoy */
function textoSinDescartes(P, ops, OPERA, quitados = []) {
  const titular = P.titular || '', situacion = P.situacion || '';
  const nombreDe = (o) => (o.j && o.j.nombre) || o.jugador || '';
  const vivas = ops.filter((o) => !o.descartada);
  // (y lo que la app quita antes de mirarlo, como blindar a uno sin riesgo: tampoco puede salir en el titular)
  const fuera = [...ops.filter((o) => o.descartada && !o.ya && OPERA.includes(o.accion) && nombreDe(o)), ...quitados.map((q) => ({ accion: 'blindar', jugador: q.jugador, descartada: true }))]
    .filter((o) => !vivas.some((v) => (v.pid && o.pid ? v.pid === o.pid : norm(nombreDe(v)) === norm(nombreDe(o)))));
  if (!fuera.length || (!titular && !situacion)) return { titular: P.titular, situacion: P.situacion, titularApp: false };
  // las formas en que la IA puede escribir el nombre: el corto, el largo, lo que puso ella y su última palabra
  const formas = new Set();
  for (const o of fuera) for (const n of [o.j && o.j.nombre, o.j && o.j.largo, o.jugador]) {
    const k = norm(n);
    if (!k) continue;
    formas.add(k);
    const ult = k.split(' ').pop();
    if (ult.length >= 4) formas.add(ult);
  }
  const nombra = (t) => { const k = ` ${norm(t)} `; return [...formas].some((f) => k.includes(` ${f} `)); };
  // quita las frases (y, dentro de una frase, las partes separadas por «;») que nombran a alguno
  const limpiar = (t) => String(t || '').split(/(?<=[.!?])\s+/).map((fr) => {
    if (!nombra(fr)) return fr;
    const partes = fr.split(/\s*;\s*/).filter((x) => x && !nombra(x));
    if (!partes.length) return '';
    const r = partes.join('; ').replace(/[\s,;:]+$/, '');
    return /[.!?]$/.test(r) ? r : `${r}.`;
  }).filter(Boolean).join(' ');
  const sit = nombra(situacion) ? limpiar(situacion) : situacion;
  if (!nombra(titular)) return { titular: P.titular, situacion: sit || null, titularApp: false };
  // lo que queda para hoy, en pocas palabras
  const VERBO = { vender: 'vender a', clausular: 'clausular a', pujar: 'pujar por', comprar: 'comprar a', ofertar: 'hacer una oferta por', blindar: 'blindar a' };
  const hoy = vivas.filter((o) => o.hoy && !o.ya && !o.sugerencia && VERBO[o.accion] && nombreDe(o));
  const frase = (o) => o.etiqueta === 'Aceptar oferta' ? `aceptar la oferta por ${nombreDe(o)}` : o.accion === 'blindar' && o.importe ? `subir la cláusula de ${nombreDe(o)}` : `${VERBO[o.accion]} ${nombreDe(o)}`;
  const aguanta = fuera.filter((o) => o.accion === 'vender').map(nombreDe);
  const yDe = (l) => l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0];
  let lo = hoy.length ? `hoy toca ${yDe(hoy.slice(0, 2).map(frase))}${hoy.length > 2 ? ` (y ${hoy.length - 2} más)` : ''}`
    : vivas.some((o) => o.ya) ? 'lo de hoy ya está hecho' : 'hoy no hace falta vender ni fichar a nadie';
  if (aguanta.length) {
    const sube = fuera.some((o) => o.accion === 'vender' && o.aguanta === 'sube');
    lo += `${hoy.length ? ';' : ':'} mejor aguantar a ${yDe(aguanta)}${sube ? `, que sigue${aguanta.length > 1 ? 'n' : ''} subiendo` : ''}`;
  }
  const resto = limpiar(titular).replace(/[.\s]+$/, '');
  const nuevo = resto ? `${resto}; ${lo}` : `${lo.charAt(0).toUpperCase()}${lo.slice(1)}`;
  return { titular: nuevo, situacion: sit || null, titularApp: true };
}

/* ---------------- lo que haría la app con cada operación (revisión de la IA, 14 nov) ----------------
   «El motor decide y la IA explica»: antes de preguntarle nada a la IA, cada operación posible de hoy pasa, una a una,
   por el mismo cuadrarPlan que luego revisa lo que contesta. Lo que la app descartaría ya no se le ofrece (va en una línea,
   con el motivo, para que sepa explicarlo si le preguntan) y lo que vale lleva el aviso de la app. Así la IA no puede
   elegir algo que la app vaya a tachar, y el plan y el chat dicen lo mismo que Hoy y que las alarmas. */
const ACC_REF = { A: 'aceptar_oferta', V: 'vender', P: 'pujar', M: 'comprar', T: 'comprar', C: 'clausular', B: 'blindar' };
const sinApp = (t) => String(t || '').replace(/La app lo descarta[.:]?\s*/g, '').replace(/^Para más adelante: /, '').replace(/\s+/g, ' ').trim();
const cortar = (t, n = 170) => { const x = sinApp(t); if (x.length <= n) return x; const c = x.slice(0, n); const i = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; '), c.lastIndexOf(': ')); return `${(i > 60 ? c.slice(0, i) : c.slice(0, c.lastIndexOf(' '))).replace(/[\s,;:.]+$/, '')}…`; };
export function veredictos(D, M) {
  const cat = catDe(D, M);
  if (M._ver && M._verCat === cat) return M._ver;
  const uno = (o, mas = {}) => {
    const paso = { ref: o.ref, accion: ACC_REF[o.ref[0]], jugador: o.j.nombre, importe: null, motivo: '', dia: 'hoy', cuando: 'ahora', ...mas };
    let x = null;
    try { x = (cuadrarPlan({ operaciones: [paso], titular: '', t: Date.now() }, D, M, { chat: true }).ops || [])[0] || null; } catch (e) { x = null; }
    if (!x) return { ok: false, aviso: 'la app no la haría' };
    return { ok: !x.descartada && !x.sugerencia, sinPrisa: !!x.sugerencia, aviso: x.aviso || '', importe: x.importe, cuando: x.cuando, paron: !!x.paron };
  };
  const V = {};
  for (const o of cat.lista) {
    const t = o.ref[0];
    if (t === 'C' || t === 'P') {
      // para el once y para revender no pasan los mismos filtros: vale si vale para alguna de las dos
      const tit = uno(o, { objetivo: 'titular', importe: t === 'P' ? o.puja : o.precio, puja_max: t === 'P' ? o.puja : null });
      const rev = (M.especular || []).some((e) => e.pid === o.pid) ? uno(o, { objetivo: 'revender', importe: t === 'P' ? o.puja : o.precio, puja_max: t === 'P' ? o.puja : null }) : { ok: false };
      V[o.ref] = tit.ok && rev.ok ? { ...tit, para: 'el once o revender' } : tit.ok ? { ...tit, para: 'el once' } : rev.ok ? { ...rev, para: 'revender (para el once, no)' } : { ...tit, ok: false };
    } else if (t === 'B') V[o.ref] = uno(o, { objetivo: 'proteger', importe: o.escudoGratis || !o.blindaje || o.blindaje.yaVale || o.blindaje.caro ? 0 : o.blindaje.coste });
    else if (t === 'A') V[o.ref] = uno(o, { objetivo: 'caja', importe: o.precio });
    else if (t === 'V') V[o.ref] = uno(o, { objetivo: 'caja' });
    else V[o.ref] = uno(o, { objetivo: 'titular', importe: t === 'M' ? (o.puja || o.ofertaMin || o.precio) : o.precio });
  }
  M._ver = V; M._verCat = cat;
  return V;
}
/** lo que la app haría con uno de tus jugadores si lo vendes hoy, en una frase (para su línea en los datos de la IA) */
function ventaAppTxt(D, M, pid) {
  const V = veredictos(D, M), a = V[`A-${pid}`], v = V[`V-${pid}`];
  if (a) return a.ok ? `LA APP: aceptaría hoy la oferta que tiene${a.aviso ? ` (${cortar(a.aviso, 140)})` : ''}` : `LA APP: NO aceptaría hoy la oferta${a.sinPrisa ? ' (sin prisa)' : ''}: ${cortar(a.aviso, 200)}`;
  if (!v) return '';
  if (v.ok) return v.aviso ? `LA APP: venderlo se puede, con este aviso: ${cortar(v.aviso, 170)}` : '';
  return `LA APP: NO LO VENDERÍA HOY${v.sinPrisa ? ' (sin prisa: como mucho, más cerca de la jornada)' : ''}: ${cortar(v.aviso, 200)}`;
}

function sacarJSON(t) {
  // (0.7.8b) los Gemini 3 con esquema a veces se quedan escribiendo espacios o saltos sin parar hasta el tope
  // (13 nov: 32.010 caracteres en 31.984 tokens): esas tiras fuera, que ningún texto bueno lleva 20 blancos seguidos
  const s = String(t || '').replace(/[ \t\r\n]{20,}/g, ' ');
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const trozo = m ? m[1] : s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1);
  try { return JSON.parse(trozo); } catch (e) {
    try { return JSON.parse(trozo.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (e2) {
      const i = s.indexOf('{');
      return i < 0 ? null : repararJSON(s.slice(i).replace(/```\s*$/, ''));
    }
  }
}

/** un JSON cortado a medias (por el tope de tokens): se queda con lo último que cerró bien y cierra lo que falta.
    Lo que estaba a medio escribir (una operación sin acabar) se pierde; lo de antes, no. Lleva `_cortado: true` */
export function repararJSON(t) {
  const pila = [], puntos = [];
  let enCad = false, esc = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (enCad) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') { enCad = false; if (pila.length) puntos.push([i + 1, pila.join('')]); }
      continue;
    }
    if (ch === '"') enCad = true;
    else if (ch === '{' || ch === '[') pila.push(ch);
    else if (ch === '}' || ch === ']') {
      pila.pop();
      if (!pila.length) { try { return JSON.parse(t.slice(0, i + 1)); } catch (e) { return null; } }
      puntos.push([i + 1, pila.join('')]);
    } else if (/[0-9el]/.test(ch) && /[,}\]\s]/.test(t[i + 1] || '') && pila.length) puntos.push([i + 1, pila.join('')]);
  }
  // de lo último a lo primero: el primer corte que, cerrado, se puede leer
  const cerrar = (p) => p.split('').reverse().map((c) => (c === '{' ? '}' : ']')).join('');
  for (let k = puntos.length - 1, n = 0; k >= 0 && n < 400; k--, n++) {
    const [fin, p] = puntos[k];
    // sin colgar una clave sin valor («"motivo"» suelto) ni una coma al final
    let base = t.slice(0, fin);
    if (p.endsWith('{')) base = base.replace(/([{,])\s*"(?:[^"\\]|\\.)*"\s*$/, (x, c) => (c === '{' ? '{' : ''));
    base = base.replace(/,\s*$/, '');
    try { const j = JSON.parse(base + cerrar(p)); if (j && typeof j === 'object') { j._cortado = true; return j; } } catch (e) { /* el anterior */ }
  }
  return null;
}

/* ---------------- el chat ---------------- */
export const conversacion = () => LS.get(K('chat'), []);
/** al parar una pregunta, se quita del chat (para poder hacerla otra vez o cambiarla) */
export function quitarUltimaPregunta(t) {
  const h = conversacion();
  if (h.length && h[h.length - 1].r === 'yo' && h[h.length - 1].t === t) { h.pop(); LS.set(K('chat'), h); }
}
export const borrarConversacion = () => LS.set(K('chat'), []);
/** sin IndexedDB, la miniatura vuelve dentro del mensaje del chat (como antes de la 0.7z) */
function reponerMini(id, mini) {
  const h = conversacion();
  let cambia = false;
  for (const m of h) for (const f of m.fotos || []) if (f.id === id && !f.mini) { f.mini = mini; cambia = true; }
  if (cambia) LS.set(K('chat'), h);
}
/** las miniaturas que iban dentro del chat (antes de la 0.7z) pasan a IndexedDB: el chat guardado ocupa mucho menos */
export async function migrarMinis() {
  const pasar = async (msgs) => {
    let n = 0;
    for (const m of msgs || []) for (const f of m.fotos || []) {
      if (!f.mini || !/^data:/.test(f.mini)) continue;
      if (await guardarMini(f.id, f.mini)) { delete f.mini; n++; }
    }
    return n;
  };
  const h = conversacion();
  if (await pasar(h)) LS.set(K('chat'), h);
  const l = chatsAnteriores();
  let n = 0;
  for (const c of l) n += await pasar(c.msgs);
  if (n) guardarAnteriores(l);
}

/* ---------------- los chats anteriores ---------------- */
// Al empezar uno nuevo, el de ahora se guarda (los 15 últimos) para poder volver a él. Lo que le has contado
// (las notas) no se borra con el chat: lo sigue teniendo en cuenta.
export const chatsAnteriores = () => LS.get(K('chats-viejos'), []);
const guardarAnteriores = (l) => LS.set(K('chats-viejos'), l.slice(0, 15));
function archivar() {
  const msgs = conversacion();
  if (!msgs.length) return false;
  const primera = msgs.find((m) => m.r === 'yo');
  const t0 = primera ? primera.t || (primera.fotos ? 'Captura' : '') : '';
  const titulo = t0 ? (t0.length > 70 ? `${t0.slice(0, 67)}…` : t0) : 'Chat';
  guardarAnteriores([{ t: Date.now(), ini: msgs[0].ts || Date.now(), titulo, n: msgs.length, msgs }, ...chatsAnteriores()]);
  return true;
}
/** empieza un chat nuevo; el de ahora queda en «anteriores» */
export function nuevoChat() { const ok = archivar(); LS.set(K('chat'), []); return ok; }
/** vuelve a un chat anterior (el de ahora se guarda) */
export function recuperarChat(i) {
  const l = chatsAnteriores();
  const c = l[i];
  if (!c) return false;
  l.splice(i, 1);
  guardarAnteriores(l);
  archivar();
  LS.set(K('chat'), c.msgs || []);
  return true;
}
export function borrarChatAnterior(i) { const l = chatsAnteriores(); l.splice(i, 1); guardarAnteriores(l); }

/** ¿la respuesta nombra a un jugador que ya vendió sin decir que ya no es suyo? Con `deOtro` (ahora es de otro mánager
 * de la liga) solo cuenta si se habla de él como tuyo: hablar de que su dueño lo vende o de ficharlo es lo normal
 * (aviso de Carlos, 13 nov: «Domi vende a Pepelu» y salía «Ojo: Pepelu ya no es tuyo (salió de tu equipo 4 nov)») */
export function cuentaConVendido(texto, nombre, deOtro = false) {
  if (!texto || !nombre) return false;
  const t = norm(texto), k = norm(nombre);
  let i = t.indexOf(k);
  while (i >= 0) {
    const antes = t[i - 1], despues = t[i + k.length];
    const suelto = (!antes || !/[a-z0-9]/.test(antes)) && (!despues || !/[a-z0-9]/.test(despues));
    const cerca = t.slice(Math.max(0, i - 70), i + k.length + 70);
    if (suelto && !/vendid|vendiste|ya no es tuyo|ya no lo tienes|clausularon|te lo quitaron|ya no esta/.test(cerca)
      && (!deOtro || (/\b(vendelo|vende a|vender a|alinea|alinealo|blinda|blindalo|tu jugador|tus jugadores|es tuyo|lo tienes)\b/.test(cerca)
        && !/fich|compr|puj|ofert|clausul|a la venta|lo vende|te lo deja|rival|mercado/.test(cerca)))) return true;
    i = t.indexOf(k, i + 1);
  }
  return false;
}

/** pregunta en el chat; alTexto(texto) se llama según va llegando la respuesta */
// Lo que se apunta, SOLO lo que él cuenta como hecho o como decidido. El 7 nov apuntó dos veces «rechazó el trueque»
// cuando Carlos solo preguntaba y luego estaba negociando: además de decírselo, aplicarNotas lo comprueba.
const NOTAS_CHAT = `APUNTAR: solo lo que el manager te CUENTA en su último mensaje como un hecho o como algo que ya ha decidido: una oferta o un trato que le ha hecho otro manager (que exista la oferta es un hecho, aunque él no haya decidido nada), algo que ya ha hecho, algo que ha decidido hacer, un jugador que dice que no quiere vender, una preferencia. Que un rival tenga a alguien a la venta NO es un trato: apúntalo (si acaso) como «otro», sin importe; el importe solo si él te dice una cifra que le han ofrecido A ÉL. NUNCA apuntes una decisión que no te haya dicho él con sus palabras («lo he rechazado», «acepto», «voy a…»): si pregunta («¿lo acepto?», «¿qué hago?») o está negociando, no ha decidido nada; como mucho apunta la oferta tal cual («Rival 2 le ofrece A por B») o en qué va la negociación. Y nunca escribas que hizo algo por tu consejo. Al final de tu respuesta, y solo entonces, añade este bloque (no lo menciones en el texto):
\`\`\`notas
{"recomiendo": [{"ref": "la ref de OPERACIONES POSIBLES HOY si la tiene, o null", "accion": "aceptar_oferta|vender|pujar|comprar|clausular|blindar|alinear", "jugador": "nombre exacto", "importe": número en euros o null, "cuando": "ahora | hoy | el día y la hora"}], "apuntar": [{"texto": "frase corta en tercera persona con nombres y cifras", "jugador": "nombre exacto del jugador o null", "tipo": "trato|hecho|intencion|preferencia|otro", "importe": número en euros o null, "dias": días que sigue valiendo (1 a 30) o null si no caduca}], "olvidar": ["id entre corchetes de una nota que ya no vale"]}
\`\`\`
En «recomiendo» van SOLO las operaciones que en esta respuesta le dices que HAGA (ninguna si le dices que espere, que no lo haga o solo le informas): la app las comprueba una a una antes de enseñarle tu respuesta, igual que en el plan. Si no recomiendas ninguna operación y no hay nada que apuntar ni que olvidar, no pongas el bloque. Si te cuenta una oferta o un trato, contesta además si le conviene, con cifras (precio frente a valor, lo que sube o baja al día, en cuántos días lo recupera, si entra en su once, si le llega el dinero y qué tendría que vender).`;

// ¿su mensaje dice que ha hecho o decidido algo? (no vale una pregunta)
const DECIDE = /\b(he|hemos) (rechazado|aceptado|decidido|vendido|fichado|clausulado|comprado|blindado|dicho que (si|no)|cerrado)\b|\b(lo|la|los) (rechazo|acepto|vendo|dejo|cierro)\b|\b(rechazo|acepto|vendo|descarto)\b|\bno (lo |la )?(acepto|vendo|quiero|voy)\b|\b(voy|vamos) a\b|\bme quedo con\b|\bpaso de\b|\bya (lo |la )?(he|hice)\b|\ble he (dicho|ofrecido|pedido)\b|\btrato hecho\b/;
const DUDA = /\bno (lo |la )?(he|tengo|hemos) decidid|\bno (lo )?se\b|\b(todavia|aun) no\b|\bnegocian|\bpensando|\bme lo (estoy )?pensando\b|\bsi (lo )?acepto\b/;
const DECISION_NOTA = /rechaz|acept|decid|descart|cerr[oó]|dijo que (si|no)|no (lo )?quiso|consejo|recomend|aconsej/;
/** lo que se puede apuntar de lo que dice: una decisión, solo si él la ha dicho; lo de «por tu consejo», fuera */
export function notaValida(a, pregunta) {
  const t = norm(a && a.texto);
  if (!t) return false;
  const q = norm(pregunta);
  const pregunta_ = /\?\s*$/.test(String(pregunta || '').trim()) || /^(que|como|cuanto|cuando|me interesa|deberia|lo acepto|acepto|hago)\b/.test(q);
  const decide = DECIDE.test(q) && !DUDA.test(q) && !pregunta_;
  if (/consejo|recomend|aconsej/.test(t)) return false;
  if (decide) return true;
  // sin decisión suya: solo la oferta o el trato tal cual, sin decir qué hace con él
  return ['trato', 'otro'].includes(String(a.tipo || 'otro')) && !DECISION_NOTA.test(t);
}

/** saca el bloque de notas de la respuesta y lo aplica: lo que hay que apuntar y lo que hay que olvidar */
export function aplicarNotas(texto, D, pregunta = null, conFotos = false) {
  const m = String(texto || '').match(/```notas\s*([\s\S]*?)(```|$)/);
  if (!m) return { texto, apuntadas: [], olvidadas: 0, recomiendo: [] };
  const limpio = texto.replace(m[0], '').trim();
  let j = null;
  try { j = JSON.parse(m[1]); } catch (e) { j = sacarJSON(m[1]); }
  if (!j) return { texto: limpio, apuntadas: [], olvidadas: 0, recomiendo: [] };
  let lista = notas();
  const antes = lista.length;
  const fuera = new Set((j.olvidar || []).map(String));
  lista = lista.filter((n) => !fuera.has(n.id));
  const olvidadas = antes - lista.length;
  const apuntadas = [];
  // (aviso de Carlos, 13 nov: «Domi dice que vende a Pepelu» se apuntó como «vende a Pepelu por 43,50 M» y la IA habló
  // de un precio «que pactasteis») una cifra solo se apunta si él la ha dicho o la manda en una captura; que un rival
  // tenga a alguien a la venta, sin precio para él, no es un trato
  const sinCifra = pregunta != null && !conFotos && !/\d/.test(String(pregunta));
  for (const a of j.apuntar || []) {
    if (!a || !a.texto) continue;
    if (pregunta != null && !notaValida(a, pregunta)) continue;
    const dias = num(a.dias);
    let tipo = String(a.tipo || 'otro');
    if (sinCifra) {
      a.importe = null;
      a.texto = String(a.texto).replace(/\s+(?:por|a|en)\s+(?:unos?\s+)?[\d.,]+\s*(?:M\b|millones|mill\b|kilos|mil\b|€)/gi, '');
      // si aún lleva una cifra que él no ha dicho, mejor no apuntarla
      if (/\d/.test(a.texto)) continue;
      if (tipo === 'trato') tipo = 'otro';
    }
    apuntadas.push({
      id: `n${Date.now().toString(36)}${apuntadas.length}`, t: Date.now(), texto: String(a.texto).slice(0, 300),
      jugador: a.jugador || null, pid: a.jugador ? pidDe(a.jugador, D) : null, tipo, importe: num(a.importe) || null,
      caduca: dias > 0 ? Date.now() + Math.min(60, dias) * DIA : tipo === 'trato' ? Date.now() + 7 * DIA : null,
    });
  }
  if (apuntadas.length || olvidadas) guardarNotas([...lista, ...apuntadas]);
  return { texto: limpio, apuntadas, olvidadas, recomiendo: Array.isArray(j.recomiendo) ? j.recomiendo.filter((x) => x && x.jugador && x.accion).slice(0, 8) : [] };
}

/** los últimos mensajes para Gemini, con las fotos enteras de los más recientes (como mucho 6) */
async function contenidosChat(hist, nuevas) {
  const recientes = hist.slice(-14);
  const out = new Array(recientes.length);
  let quedan = 6;
  for (let i = recientes.length - 1; i >= 0; i--) {
    const m = recientes[i];
    const fs = m.r === 'yo' && Array.isArray(m.fotos) ? m.fotos : [];
    const parts = [];
    let perdidas = 0;
    for (const f of fs) {
      const b = quedan > 0 ? (nuevas[f.id] || (await leerFoto(f.id))) : null;
      if (b) { parts.push({ inlineData: { mimeType: 'image/jpeg', data: b } }); quedan--; } else perdidas++;
    }
    let t = m.t || (fs.length ? `Mira ${fs.length > 1 ? 'estas capturas' : 'esta captura'}.` : '');
    if (perdidas) t += `\n[Aquí te mandó ${perdidas} foto${perdidas > 1 ? 's' : ''} que ya no puedes ver: tira de lo que contestaste.]`;
    parts.push({ text: t || '…' });
    out[i] = { role: m.r === 'yo' ? 'user' : 'model', parts };
  }
  return out;
}

const SOBRE_FOTOS = `\nFOTOS: si te manda una captura o una foto, léela entera antes de contestar (puede ser del mercado, de una oferta que le han hecho, de la plantilla o las cláusulas de un rival, de un chat con otro manager, de una noticia). Di lo que ves que importa con sus cifras y crúzalo con los datos que te paso; si en la captura sale algo que no cuadra con los datos o un jugador que no tengo, dilo. Si se lee mal o está cortada, dilo en vez de inventarte lo que pone.`;

// en el chat, Google solo cuando hace falta: cada búsqueda son unos segundos más de espera
const SIN_BUSCAR_CHAT = 'EN EL CHAT NO TIENES BÚSQUEDA EN GOOGLE: contesta con los datos que te paso y, si para contestar falta algo de hoy (una lesión, un once), dilo.';
const BUSCAR_CHAT = 'EN EL CHAT, BUSCA EN GOOGLE SOLO SI HACE FALTA: si la pregunta se contesta con los datos que te paso, contesta sin buscar. Busca cuando necesites algo de hoy que no esté aquí (una lesión, una rueda de prensa, un once, una noticia) o te lo pida. Si pregunta por cambiar, vender o comprar a un jugador que está en duda o lesionado, busca siempre qué tiene y cuánto puede estar fuera.';
/**
 * las cuentas de los jugadores que nombra, hechas: valores, cláusulas, diferencias y quién puede pagar cada cláusula.
 * El 7 nov la IA dio «Berenguer + 33-35 M» y luego «+ 26 M», y sumó «107 + 35 = 75»: si las cifras le llegan hechas,
 * no se las inventa.
 */
export function cuentasTxt(D, M, js, { web = true } = {}) {
  if (!js || js.length < 2) return '';
  const yo = D.yo && D.yo.teamId;
  const info = js.map((j) => {
    const tid = M.dueno[j.id];
    const mia = tid && tid === yo ? (M.mias || []).find((x) => x.pid === j.id) : null;
    const cl = mia || (M.clausulas || []).find((x) => x.pid === j.id) || null;
    const t = M.tend(j.id) || {};
    return { j, tid, mia: !!mia, cl, d1: t.d1 };
  });
  const L = ['\nCUENTAS HECHAS (las cifras de estos jugadores salen de aquí; no las cambies de un mensaje a otro sin un dato nuevo):'];
  for (const x of info) L.push(`- ${x.j.nombre}: vale ${eur(x.j.valor)}${x.d1 != null ? ` (hoy ${eur(x.d1, { signo: true })})` : ''}${x.cl && x.cl.clausula ? `, cláusula ${eur(x.cl.clausula)}${x.cl.abierta ? ' abierta' : x.cl.protegidoHasta ? `, se abre ${cuandoF(x.cl.protegidoHasta)}` : ''}` : ''}; ${x.mia ? 'es mío' : x.tid ? `es de ${nombreTid(M, x.tid)}` : 'libre'}`);
  const mios = info.filter((x) => x.mia), suyos = info.filter((x) => !x.mia && x.tid);
  for (const a of mios) for (const b of suyos) {
    const dif = a.j.valor - b.j.valor;
    // un cambio entre managers son DOS COMPRAS, cada una a su valor (Carlos, 8 nov: «yo compro una cosa que vale 28 M por
    // 28 M y él una que vale 55 M por 55 M; nos quedamos igual, nadie pierde valor»). La IA lo contaba como un cambio sin
    // dinero y repetía que le regalaba 26 M: lo que decide es quién va a subir más y quién da más puntos
    L.push(`- CAMBIO DE ${a.j.nombre.toUpperCase()} POR ${b.j.nombre.toUpperCase()}: en esta liga un cambio entre managers son DOS COMPRAS, cada una a su valor salvo que acuerden otros precios: yo le compro ${b.j.nombre} por ${eur(b.j.valor)} y él me compra ${a.j.nombre} por ${eur(a.j.valor)}. Acabo con ${b.j.nombre} y mi saldo ${dif >= 0 ? 'sube' : 'baja'} ${eur(Math.abs(dif))} (${eur(a.j.valor)} − ${eur(b.j.valor)}; de ${eur(num(D.dinero))} a ${eur(num(D.dinero) + dif)}). NADIE PIERDE VALOR: nunca digas que regalo, pierdo o le doy la diferencia. (Solo si el manager dice expresamente que es sin dinero de por medio sería otra cosa.) Lo que decide si me conviene es quién de los dos va a SUBIR MÁS de valor a partir de ahora y quién me dará MÁS PUNTOS: compara su tendencia (hoy, 7 días, inercia), su estado (lesión, duda, sanción), su forma, sus próximos partidos y el parón, ${web ? 'y busca en Google noticias de los dos si alguno está tocado' : 'y, si alguno está tocado, dilo con lo que sale en los datos'}.`);
    if (a.cl && a.cl.clausula) {
      const r = (M.rivales || []).find((y) => y.e.teamId === b.tid);
      const din = r && r.dinero && r.dinero.v != null ? r.dinero.v : null;
      if (din != null) L.push(`- La cláusula de ${a.j.nombre} (${eur(a.cl.clausula)}) ${din >= a.cl.clausula ? `SÍ le llega a ${nombreTid(M, b.tid)} (${bloqueada('dineroRivales') ? (din >= a.cl.clausula * 1.2 ? 'le sobra' : 'justo') : `tiene ${r.dinero.exacto ? '' : '≈ '}${eur(din)}`}): ${a.cl.abierta ? 'se lo puede llevar ya' : `se lo puede llevar ${cuandoF(a.cl.protegidoHasta)}, en el mismo minuto en que se abra, sin negociar nada y quizá antes de que me dé tiempo a blindarlo. Eso pesa en cualquier negociación con él: no va a pagar mucho más que la cláusula. Si se lo lleva así, cobro yo los ${eur(a.cl.clausula)}${a.cl.clausula > b.j.valor ? ` (más de lo que vale ${b.j.nombre})` : ""}`}` : `no le llega a ${nombreTid(M, b.tid)}${bloqueada('dineroRivales') ? '' : ` (tiene ${r.dinero.exacto ? '' : '≈ '}${eur(din)})`}`}.`);
    }
    // y la razón de fondo de un cambio cuando las dos cláusulas se van a abrir: al comprarse entre managers, cada uno vuelve
    // a tener la cláusula protegida 14 días, así que los dos se aseguran a un jugador que sube sin que nadie se lo quite
    // (Carlos, 8 nov: «ambos nos aseguramos tener a un jugador que sube millón y medio cada día 14 días más»)
    {
      const ritmo = (x) => { const t = M.tend(x.j.id) || {}; return t.diaE != null ? t.diaE : t.d7 != null ? t.d7 / 7 : t.d1; };
      const ra = ritmo(a), rb = ritmo(b);
      const abre = [a, b].filter((x) => x.cl && !x.cl.abierta && x.cl.protegidoHasta).map((x) => `${x.j.nombre} ${cuandoF(x.cl.protegidoHasta)}`);
      L.push(`- PROTECCIÓN: al comprarse entre managers, cada jugador vuelve a tener la cláusula protegida 14 días (nadie lo puede clausular). ${abre.length ? `Sin el cambio, las cláusulas se abren (${abre.join('; ')}) y cualquiera de la liga con saldo se los puede llevar; ` : ''}con el cambio, me aseguro a ${b.j.nombre} 14 días${rb != null ? `, que ${rb >= 0 ? 'sube' : 'baja'} ${eur(Math.abs(rb))} al día (en 14 días, unos ${eur(rb * 14, { signo: true })} si sigue ese ritmo)` : ''}, y él a ${a.j.nombre}${ra != null ? `, que ${ra >= 0 ? 'sube' : 'baja'} ${eur(Math.abs(ra))} al día` : ''}. Esa seguridad es LA RAZÓN del cambio: valórala con cifras frente a quedarme a ${a.j.nombre} con la cláusula abierta (puedo blindarla con el escudo de LaLiga solo con la cláusula ya abierta, 24 h y 2 por jornada, y en el minuto en que se abre compito con quien quiera pagarla).`);
    }
    // si el mío está tocado, pesa A FAVOR de cambiarlo: si se confirma la lesión baja de valor, y en el cambio cobro su
    // valor de hoy. Que busque qué tiene antes de contestar
    if (a.j.estado === 'doubtful' || a.j.estado === 'injured') L.push(`- ${a.j.nombre} está ${a.j.estado === 'doubtful' ? 'EN DUDA' : 'LESIONADO'}: pesa A FAVOR del cambio (si se confirma la lesión, su valor baja, y en el cambio cobro su valor de hoy, ${eur(a.j.valor)}). ${web ? 'Busca en Google qué tiene y cuánto puede estar fuera antes de contestar, y dilo.' : 'Di lo que sale en los datos de qué tiene; si no se sabe cuánto estará fuera, dilo.'}`);
    if (b.j.estado === 'doubtful' || b.j.estado === 'injured') L.push(`- ${b.j.nombre} está ${b.j.estado === 'doubtful' ? 'EN DUDA' : 'LESIONADO'}: pesa EN CONTRA del cambio.${web ? ' Busca en Google qué tiene antes de contestar.' : ''}`);
    // la vara de medir de cualquier trato con precio (le vendo A por X y le compro B por Y = dos ventas): con qué jugador
    // acabo y cuánto saldo, frente a esperar a las cláusulas. Sin esto la IA miraba cada precio por separado y llamaba
    // «cifras inventadas» a Berenguer por 30 M y Nico por 60 M, que deja 4 M más que las dos cláusulas (Carlos, 8 nov)
    if (a.cl && a.cl.clausula && b.cl && b.cl.clausula) {
      const neto = a.cl.clausula - b.cl.clausula;
      L.push(`- REFERENCIA PARA CUALQUIER TRATO entre ${a.j.nombre} y ${b.j.nombre}: si le vendo ${a.j.nombre} por X y le compro ${b.j.nombre} por Y (son dos ventas entre managers, un trato válido con los precios que acordemos), acabo con ${b.j.nombre} y mi saldo cambia en X − Y. Con las dos cláusulas (${nombreTid(M, b.tid)} paga la de ${a.j.nombre} y yo la de ${b.j.nombre}) acabaría con ${b.j.nombre} y ${eur(neto, { signo: true })} de saldo (${eur(a.cl.clausula)} − ${eur(b.cl.clausula)}), pero eso depende de que él pague la mía y de llegar yo a tiempo a la suya. Un cambio a sus valores deja casi lo mismo que las dos cláusulas (${eur(a.j.valor - b.j.valor, { signo: true })}), pero es seguro. Un trato que me deje ${b.j.nombre} y más de ${eur(neto)} netos es MEJOR que las cláusulas; menos, peor. Ejemplo: «${b.j.nombre} por ${eur(b.cl.clausula + 2e6)} y ${a.j.nombre} por ${eur(a.cl.clausula + 6e6)}» deja ${eur(neto + 4e6, { signo: true })} netos, ${eur(4e6)} más que las cláusulas.`);
    }
    if (b.cl && b.cl.clausula) L.push(`- La cláusula de ${b.j.nombre} (${eur(b.cl.clausula)}) ${b.cl.clausula <= num(D.dinero) ? `SÍ me llega con mi saldo (${eur(num(D.dinero))})` : `no me llega con mi saldo (${eur(num(D.dinero))}; faltan ${eur(b.cl.clausula - num(D.dinero))})`}${b.cl.abierta ? ': está abierta' : b.cl.protegidoHasta ? `: se abre ${cuandoF(b.cl.protegidoHasta)}` : ''}.`);
  }
  return L.join('\n');
}

// cómo se habla en el chat: al grano, sin repetir el plan y con las cifras de los datos (Carlos, 7 nov)
const REGLAS_CHAT = `
EN EL CHAT:
- Contesta a lo que te pregunta y nada más, al grano. NO repitas el plan del día ni operaciones que no ha preguntado; sácalo solo si cambia la respuesta a su pregunta, y entonces en una línea.
- Si te pregunta si PUEDE hacer algo, empieza por «sí» o «no» según las REGLAS y lo que te paso de ese jugador («CÓMO CONSEGUIRLO», su cláusula y cuándo se abre, su saldo), y después dile si le conviene y lo que haría la app.
- LO QUE UN RIVAL TIENE A LA VENTA (regla 8b) no es una oferta para él ni una negociación: si el precio está muy por encima de su valor, basta una línea («a ese precio no; lo tendrá puesto para ver qué le da LaLiga»). Lo que importa es si el jugador le interesa: su valor, su inercia, lo que aporta a su once y la oferta mínima con opciones si te la paso. Nunca escribas «pactasteis», «te pide» ni «te lo deja a» con una cifra que él no te haya dicho.
- No mezcles el pasado con lo de ahora: que un jugador fuera suyo hace días no cambia nada si ahora es de un rival; háblale de él como de cualquier jugador de ese rival.
- CIFRAS, FECHAS Y HORAS: cópialas de los datos o de «CUENTAS HECHAS», con su día («mañana 20:00 (8 nov)»). No des horquillas sin decir de dónde salen. Si en este chat ya diste una cifra y ahora das otra, di por qué ha cambiado.
- Si te falta un dato para aconsejar (qué quiere hacer, hasta dónde está dispuesto a llegar), pregúntaselo en vez de suponerlo.
- TRATOS CON PRECIO: si propone un precio para cada jugador («le pido A por X y yo le vendo B por Y»), es un trato válido entre managers: no digas que son cifras inventadas ni lo descartes por haber cláusulas. Haz la cuenta del trato ENTERO (con qué jugador acaba, cuánto cobra y cuánto paga) y compáralo con la REFERENCIA de «CUENTAS HECHAS» y con quedarse como está. Primero si le conviene a él; después, aparte, si el rival lo aceptaría y por qué.
- CAMBIOS ENTRE MANAGERS (regla 9): lo que decide es quién va a subir más y quién dará más puntos (tendencia, inercia, estado, forma, calendario, parón) y la PROTECCIÓN: tras el cambio, cada uno tiene a su nuevo jugador 14 días sin que se lo puedan clausular. Compáralos con cifras y da tu veredicto.
- IDIOMA: español de España siempre, también en las bromas: nada de voseo ni de argentinismos.
- SI TE DA UN DATO NUEVO (molestias, una lesión, una oferta, lo que le ha dicho un rival) o te vuelve a preguntar lo mismo, no repitas la respuesta de antes con otras palabras: empieza por lo que cambia ese dato y lo que no, con números. Si el dato no está en los datos, dalo por bueno y úsalo. Si tu consejo sigue siendo el mismo, explica por qué en una frase y dale la mejor alternativa para lo que le preocupa.
{{TONO}}`;
// el tono del chat, según Ajustes > Pullitas de la IA: con «Sin pullitas» o «Suaves», serio (0.7o); con «Normales» o
// «A saco», con bromas y pullas como antes, pero sin tocar las cuentas (Domy, 8 nov: «quiero que me siga hablando con
// pullas y bromas»)
const TONO_CHAT = {
  serio: '- TONO: el de un director deportivo serio y cercano. Las pullitas, solo con una noticia extradeportiva; nunca cuando hablas de una operación, de una oferta o de un manager con el que está negociando.',
  normal: '- TONO: director deportivo con chispa: puedes soltar una broma o una pullita por respuesta (a los rivales por lo que hacen, a una noticia extradeportiva, o un vacile de colega al propio manager), siempre aparte de las cuentas y del consejo, que van en serio. Sin palabrotas ni expresiones de caricatura («tururú», «que se lo pida a su abuela»), y sin atribuirle ganas ni decisiones que no te ha dicho.',
  saco: '- TONO: director deportivo con mucha guasa: dos o tres bromas o pullas por respuesta (a los rivales sin cortarte, a las noticias extradeportivas, y algún vacile de colega al propio manager), siempre aparte de las cuentas y del consejo, que van en serio. Sin palabrotas ni crueldad, y sin atribuirle ganas ni decisiones que no te ha dicho.',
};
const tonoChat = () => { const p = cfgIA().pullitas || 'normal'; return TONO_CHAT[p === 'saco' ? 'saco' : p === 'normal' ? 'normal' : 'serio']; };

/* ---------------- la revisión del chat (revisión de la IA, 14 nov) ----------------
   En el plan, cuadrarPlan comprueba cada paso; en el chat no se comprobaba casi nada y lo que dijera la IA salía tal cual
   (cláusulas con deuda, cifras que no eran las de los datos, sumas mal hechas, «pactasteis»…). Ahora cada respuesta pasa
   por aquí antes de guardarse:
   1. lo que la IA dice que hagas (su bloque «recomiendo» y, si no lo pone, las órdenes claras del texto: «clausúlalo»,
      «puja por X», «véndelo», «alinea a X», «blíndalo») pasa por el mismo cuadrarPlan que el plan;
   2. las cifras que da de un jugador (valor, cláusula) y de tu saldo se comparan con los datos;
   3. las cuentas que escribe («a + b − c = d») se rehacen;
   4. lo que no puede decir: que una cláusula se paga con deuda, que te viene bien que te clausulen a uno a su valor, que
      el precio que un rival pone en el mercado es un trato, el nombre del modelo o de otras webs.
   Lo que no cuadra no se borra (el texto ya se ha ido viendo mientras llegaba): se añade debajo «Revisado por la app»
   con lo que es de verdad. Una respuesta correcta sale tal cual. */
const NUM_M = '(\\d{1,3}(?:[.,]\\d{1,3})?)\\s*(M\\b|millones\\b|mill\\b|kilos\\b|mil\\b)';
const aEuros = (n, u) => parseFloat(String(n).replace(',', '.')) * (/^mil$/i.test(u) ? 1e3 : 1e6);
const casi = (a, b) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.006, 6000);
const MODELOS = /\b(gemini|gemma|chatgpt|gpt-?\d[\w.-]*|openai|claude|anthropic|deepmind|bard|copilot|llama ?\d|mistral)\b(?:[ -]?\d[\d.]*)?(?:[ -]?(?:flash-lite|flash|pro|ultra|nano|lite|sonnet|opus|haiku|mini|turbo))?/gi;
const SOY_IA = /\b(modelo de lenguaje|modelo de ia|modelo de inteligencia artificial|large language model|llm|(?:modelo|ia|inteligencia artificial|asistente)\s+(?:de|entrenad[oa] por|cread[oa] por|desarrollad[oa] por)\s+google)\b/i;
/** ni el nombre del modelo ni el de otras webs de fantasy (reglas de Carlos y de Domy): la frase en que la IA dice qué
 * modelo es se cambia entera; un nombre suelto, por «la IA» */
export function sinModelos(t) {
  let dicho = false;
  const out = String(t || '').replace(/[^.!?\n]+[.!?]?/g, (fr) => {
    MODELOS.lastIndex = 0;
    const nombra = MODELOS.test(fr);
    MODELOS.lastIndex = 0;
    if (!nombra && !SOY_IA.test(fr)) return fr;
    if (/\b(soy|eres|estoy|funciono|basad[oa]|entrenad[oa]|desarrollad[oa]|cread[oa]|modelo|llamo)\b/i.test(fr) || SOY_IA.test(fr)) {
      if (dicho) return '';
      dicho = true;
      return `${/^\s/.test(fr) ? ' ' : ''}Soy el director deportivo de Fantasy Manager: qué IA hay detrás no te lo puedo decir.`;
    }
    return fr.replace(MODELOS, 'la IA');
  });
  return out.replace(/[ \t]{2,}/g, ' ');
}
const WEBS_TXT = /\b(?:www\.)?(?:jornada ?perfecta|comuniate|futbol ?fantasy|anal[ií]tica ?fantasy)(?:\.com|\.es)?\b/gi;
const sinWebsChat = (t) => sinWebs(String(t || '').replace(WEBS_TXT, 'la prensa').replace(/\b(?:sofascore|understat)(?:\.com)?\b/gi, 'las estadísticas'))
  .replace(/\b(la prensa)(?:(?:\s*,\s*|\s+y\s+|\s+e\s+|\s+o\s+)la prensa)+\b/gi, '$1');

const ORDENES = [
  ['clausular', /\b(clausulalo|clausulala|clausula (?:ya |hoy |ahora )?a|paga (?:ya |hoy )?su clausula|pagale la clausula|ve a por su clausula)\b/],
  ['pujar', /\b(puja (?:fuerte |ya |hoy )?por|pujale|puja \d)/],
  ['vender', /\b(vendelo|vendela|vende (?:ya |hoy )?a|ponlo a la venta|ponlo en venta|pon a la venta a|acepta (?:ya |hoy )?la oferta)\b/],
  ['alinear', /\b(alinea (?:ya |hoy )?a|alinealo|mete (?:ya |ahora |hoy )?a|metelo en el once|ponlo en el once|ponlo de titular)\b/],
  ['blindar', /\b(blindalo|blindala|blinda (?:ya |hoy |ahora )?a|ponle el escudo)\b/],
];

export function revisarChat(texto, pregunta, D, M, { rec = [], hist = [] } = {}) {
  let t = sinWebsChat(sinModelos(texto));
  const notas = [];
  const nota = (x) => { if (x && !notas.includes(x)) notas.push(x); };
  const yoT = D.yo && D.yo.teamId;
  const cat = catDe(D, M);
  const saldo = D.dinero == null ? null : +D.dinero;
  const mia = (pid) => (M.mias || []).find((x) => x.pid === pid) || null;
  const clDe = (pid) => { const x = mia(pid) || (M.clausulas || []).find((c) => c.pid === pid); return x && x.clausula ? x : null; };
  // los jugadores de los que se habla (en la respuesta y en la pregunta) y las frases de la respuesta
  const enResp = jugadoresEn(t, D), enPreg = jugadoresEn(pregunta || '', D);
  const todos = [...enResp, ...enPreg.filter((j) => !enResp.includes(j))];
  const formas = (j) => { const n = norm(j.nombre), u = n.split(' ').pop(); return u.length >= 5 && u !== n ? [n, u] : [n]; };
  const enFrase = (fr) => { const k = ` ${norm(fr)} `; return todos.filter((j) => formas(j).some((f) => k.includes(` ${f} `))); };
  const frases = t.split(/(?<=[.!?;:])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const N = (j) => `**${j.nombre}**`;

  /* 1. lo que dice que hagas: su bloque y, si de ese jugador no lo pone, las órdenes claras del texto */
  const pasos = [];
  const meter = (accion, j, mas = {}) => { if (j && !pasos.some((p) => p.j.id === j.id && p.accion === accion)) pasos.push({ accion, j, ...mas }); };
  for (const r of rec || []) {
    const acc = String(r.accion || '').toLowerCase().replace('aceptar_oferta', 'vender').replace('aceptar', 'vender').replace('ofertar', 'comprar').replace('fichar', 'comprar');
    const porRef = cat.ref[String(r.ref || '').trim().toUpperCase()];
    const j = (porRef && porRef.j) || M.J(pidDe(r.jugador, D));
    if (j) meter(acc, j, { ref: porRef ? porRef.ref : null, importe: +r.importe > 0 ? +r.importe : null, cuando: r.cuando || '', aceptar: /acept/.test(String(r.accion || '')), bloque: true });
  }
  for (const fr of frases) {
    if (/\?\s*$/.test(fr)) continue;
    // una orden va al principio de la frase o de un inciso («Sí, clausúlalo»; «entonces vende a X»): «una cláusula a su
    // valor», «Marcos vende a Camello» o «la puja por Terrats» no lo son (falsa alarma en la pasada con la IA, 13 nov)
    for (const inciso of fr.split(/[,;:()—–]/)) {
      const k = norm(inciso);
      for (const [acc, re] of ORDENES) {
        const m = k.match(re);
        if (!m || !/^(?:(?:si|pues|entonces|asi que|y|mejor|hoy|ahora|ya|venga|primero|luego|despues|adelante|yo|tu)\s+)*$/.test(`${k.slice(0, m.index).trim()} `.replace(/^ $/, ''))) continue;
        const aqui = enFrase(inciso).length ? enFrase(inciso) : enFrase(fr);
        // «clausúlalo», sin nombre en la frase: el único del que va la pregunta
        const j = aqui.length === 1 ? aqui[0] : !aqui.length && enPreg.length === 1 ? enPreg[0] : null;
        if (j && !pasos.some((p) => p.j.id === j.id)) meter(acc, j, { cuando: /\b(ya|ahora|hoy)\b/.test(norm(fr)) ? 'ahora' : '' });
      }
    }
  }
  const yaDice = (abre) => { const k = norm(t); return [fechaCorta(abre), cuando(abre)].some((x) => x && k.includes(norm(x))); };
  for (const p of pasos) {
    const j = p.j, tid = M.dueno[j.id];
    if (p.accion === 'alinear') {
      if (tid !== yoT) nota(`${N(j)} no es tuyo${tid ? ` (es de ${nombreTid(M, tid)})` : ''}: no puede ir en tu once.`);
      else if (M.enJuego) nota(`Tu once de la jornada ${M.enJuego.n} ya está cerrado: LaLiga lo bloquea con el primer partido y ya no se puede cambiar a nadie, ni a los que no han jugado. Lo que muevas ahora es para la jornada ${M.proxima ? M.proxima.n : 'siguiente'}.`);
      else if (['injured', 'suspended', 'out_of_league'].includes(j.estado)) nota(`${N(j)} está ${ESTADO_TXT[j.estado] || j.estado}: no lo alinees.`);
      continue;
    }
    if (!['vender', 'clausular', 'pujar', 'comprar', 'blindar'].includes(p.accion)) continue;
    // una oferta directa a un jugador de un rival que no está en el mercado se puede hacer (decide él): no hay nada que comprobar
    if (p.accion === 'comprar' && tid && tid !== yoT && !['M', 'T'].some((x) => cat.ref[`${x}-${j.id}`])) continue;
    // lo primero, lo que no tiene vuelta de hoja: una cláusula solo se paga con saldo
    if (p.accion === 'clausular' && tid && tid !== yoT && saldo != null) {
      const c = clDe(j.id);
      if (c && c.clausula > saldo) { nota(`${N(j)}: no te llega. Su cláusula son ${eur(c.clausula)} y una cláusula solo se paga con saldo, sin deuda: tienes ${eur(Math.max(0, saldo))}, faltan ${eur(c.clausula - Math.max(0, saldo))}.${c.abierta ? '' : ` Además, ${c.veda ? `las cláusulas están cerradas hasta que empiece la jornada ${c.veda.n}` : `no se abre hasta ${cuandoF(c.protegidoHasta)}`}.`}`); continue; }
    }
    const paso = { ref: p.ref, accion: p.aceptar ? 'aceptar_oferta' : p.accion, jugador: j.nombre, pid: j.id, importe: p.importe, motivo: '', dia: 'hoy', cuando: p.cuando || 'ahora', objetivo: null };
    let r = null;
    try { r = cuadrarPlan({ operaciones: [paso], titular: '', t: Date.now() }, D, M, { chat: true }); } catch (e) { r = null; }
    if (!r) continue;
    const x = (r.ops || [])[0], q = (r.descartes || []).find((d) => d && norm(d.jugador) === norm(j.nombre) && /^La app lo quita/.test(d.motivo || ''));
    if (q) { nota(`${N(j)}: ${sinApp(q.motivo).replace(/^La app lo quita: /, '')}`); continue; }
    if (!x) continue;
    const opC = x.ref ? cat.ref[x.ref] : null;
    if (x.descartada) { nota(`${N(j)}: ${sinApp(x.aviso).replace(/^./, (c) => c.toUpperCase()).slice(0, 420)}`); continue; }
    if (x.sugerencia && x.aviso) { nota(`${N(j)}: ${sinApp(x.aviso).slice(0, 420)}`); continue; }
    if (opC && opC.ref[0] === 'M' && p.importe && p.importe < opC.precio) nota(`${N(j)}: ${opC.vendedor} lo tiene a la venta por ${eur(opC.precio)} y por debajo de ese precio LaLiga no deja ofertar${opC.ofertaMin && opC.ofertaMin > opC.precio ? `; para tener opciones, como poco ${eur(opC.ofertaMin)}` : ''}. Y decide él: también tiene la oferta de LaLiga.`);
    else if (opC && opC.ref[0] === 'C' && !opC.abierta && !yaDice(opC.abre)) nota(`${N(j)}: ${opC.veda ? `las cláusulas están cerradas hasta que empiece la jornada ${opC.veda.n}; la suya se puede pagar ${cuandoF(opC.abre)}, no antes` : `su cláusula no se abre hasta ${cuandoF(opC.abre)}: hasta entonces no se puede pagar`}.`);
    else if (opC && opC.ref[0] === 'B' && !x.importe && !opC.abierta && !yaDice(opC.abre)) nota(`${N(j)}: el escudo solo se puede poner con la cláusula ya abierta, y la suya está protegida hasta ${cuandoF(opC.abre)}.`);
    else if (p.accion === 'vender' && /sube [^.]*al día/.test(x.aviso || '') && !/aguant|no lo vend|no vend|esper/.test(norm(t))) nota(`${N(j)}: ${sinApp(x.aviso).split(/(?<=\.)\s/).slice(0, 2).join(' ')}`);
  }

  /* 2. las cifras de un jugador y del saldo, contra los datos */
  const reCl = new RegExp(`cl[aá]usula(?: de [^,.;:()\\d]{2,30}?)?,?\\s*(?:\\()?(?:(?:que )?est[aá] (?:ya )?(?:abierta )?(?:en|a)|es de|son|de|en|:)\\s*(?:unos |los |las |solo )?${NUM_M}`, 'i');
  const reVal = new RegExp(`\\b(?:vale(?:n)?|valor(?: actual| de mercado)?(?: es)?(?: de|:)?)\\s+(?:ahora |hoy |ya |unos |sobre |alrededor de |aproximadamente |mismo )*${NUM_M}`, 'i');
  const reSaldo = new RegExp(`(?:\\b(?:tu|el) (?:saldo|caja)(?: actual| de ahora| de hoy)?(?: es| está)?(?: de| en|:)?\\s+(?:unos |los |solo )?${NUM_M})|(?:\\b(?:con|tienes) (?:tus |unos |los |solo )?${NUM_M} (?:de saldo|en caja|de caja|en el banco))`, 'i');
  // (una frase que habla de un supuesto o de otra cifra —«si sube a…», «la pagaste a…», «súbela hasta…»— no se compara)
  const SUPUESTO = /\b(hasta|por encima|por debajo|mas de|menos de|si|cuando|tras|despues de|antes de)\b|\b(podr|seria|quedar|dejar|valia|llego a valer|valdr|tendr|pagaste|pague|pagar|costo|compraste|fichaste)\w*/;
  const SUBIRLA = /\bsub(ir|e|es|as|ida|irla|irle|ela|ele)\b/;
  for (const fr of frases) {
    const k = norm(fr);
    const js = enFrase(fr);
    if (js.length === 1 && !SUPUESTO.test(k)) {
      const j = js[0];
      const mc = fr.match(reCl), cl = clDe(j.id);
      if (mc && cl && !SUBIRLA.test(k) && !casi(aEuros(mc[1], mc[2]), cl.clausula)) nota(`${N(j)}: su cláusula es de ${eur(cl.clausula)} (no de ${mc[1]} ${mc[2]}).`);
      const mv = !mc && fr.match(reVal);
      if (mv && j.valor && !casi(aEuros(mv[1], mv[2]), j.valor) && !(cl && casi(aEuros(mv[1], mv[2]), cl.clausula))) nota(`${N(j)}: vale ${eur(j.valor)} (no ${mv[1]} ${mv[2]}).`);
    }
    const ms = saldo != null && !/\b(si|quedar|tendr|tras|despues|acept|vend)\w*/.test(k) ? fr.match(reSaldo) : null;
    if (ms) { const v = aEuros(ms[1] || ms[3], ms[2] || ms[4]); if (!casi(v, saldo)) nota(`Tu saldo ahora es de ${eur(saldo)} (no de ${ms[1] || ms[3]} ${ms[2] || ms[4]}).`); }
  }

  /* 3. las cuentas que escribe: «a + b − c = d» */
  const reCuenta = new RegExp(`((?:[−–-]\\s*)?${NUM_M}(?:\\s*[+−–-]\\s*${NUM_M})+)\\s*=\\s*([−–-]?)\\s*${NUM_M}`, 'gi');
  for (const m of t.matchAll(reCuenta)) {
    const total = (m[m.length - 3] ? -1 : 1) * aEuros(m[m.length - 2], m[m.length - 1]);
    let suma = 0, mal = false;
    const ter = [...m[1].matchAll(new RegExp(`([+−–-])?\\s*${NUM_M}`, 'gi'))];
    for (const x of ter) { const v = aEuros(x[2], x[3]); if (!Number.isFinite(v)) mal = true; suma += (x[1] && x[1] !== '+' ? -1 : 1) * v; }
    if (!mal && Math.abs(suma - total) > Math.max(Math.abs(suma) * 0.004, 25000)) nota(`La cuenta «${m[1].replace(/\s+/g, ' ').trim()}» da ${eur(suma)}, no ${m[m.length - 2]} ${m[m.length - 1]}.`);
  }

  /* 4. lo que no puede decir */
  const yaLoDice = /\b(nunca|no)\b[^.]{0,60}\b(con|de) deuda\b|\bsolo\b[^.]{0,60}\bsaldo\b|\bsin deuda\b/.test(norm(t).replace(/ /g, ' ')) ;
  for (const fr of frases) {
    const k = norm(fr);
    // una cláusula con deuda
    // (si la respuesta ya dice la regla —«nunca con deuda», «solo con saldo»—, una frase suelta sin el «no» no es un error)
    if (/clausul/.test(k) && /\b(deuda|en negativo|margen)\b/.test(k) && !/\b(no|solo|sin|nunca|ni|tampoco|olvidate)\b/.test(k) && !yaLoDice && saldo != null) nota(`Una cláusula solo se paga con saldo, sin deuda: ahora tienes ${eur(Math.max(0, saldo))}. El margen de deuda solo vale para pujar o comprar en el mercado.`);
    // «te viene bien que te lo clausulen»
    if (/clausul/.test(k) && /\b(te viene bien|buena noticia|haces caja|hacer caja|negocio redondo|te conviene que|mejor para ti)\b/.test(k) && !/\b(no|nunca|tampoco)\b/.test(k)) {
      const js = enFrase(fr), j = js.length === 1 ? js[0] : !js.length && enPreg.length === 1 ? enPreg[0] : null, x = j && mia(j.id);
      if (x && x.clausula && j.valor && x.clausula <= j.valor * 1.12) nota(`${N(j)}: su cláusula (${eur(x.clausula)}) está ${x.clausula <= j.valor * 1.01 ? 'a su valor' : `solo un ${pct((x.clausula / j.valor - 1) * 100, 0)} por encima de su valor`} (${eur(j.valor)}). Que te lo clausulen a ese precio no es una venta: es regalarlo. Pierdes sus puntos y lo que suba, y reponerlo cuesta más.`);
    }
  }
  // el precio que un rival pone en el mercado no es un trato (Pepelu, 13 nov): solo si él no ha dado una cifra
  if (/\b(pactasteis|pactado|pactaste|acordasteis|acordado|vuestro trato|te pide|te lo deja|te lo ofrece por)\b/.test(norm(t))) {
    const suyo = [pregunta, ...(hist || []).filter((m) => m.r === 'yo').slice(-4).map((m) => m.t || '')].join(' ');
    if (!/\d/.test(suyo)) for (const j of todos) {
      const m = (M.mercado || []).find((x) => x.pid === j.id && x.tipo === 'manager' && x.vendedorTeamId !== yoT);
      if (m && !notasDe(j.id).some((n) => n.importe)) nota(`${N(j)}: ${m.vendedor || nombreTid(M, m.vendedorTeamId)} lo tiene puesto a la venta por ${eur(m.precio)}. Ese precio lo ha puesto él en el mercado (muchas veces solo para ver la oferta de LaLiga): no es un trato contigo ni algo que te pida a ti. Por debajo no se puede ofertar.`);
    }
  }
  // uno que ya no es suyo, tratado como suyo
  for (const v of M.vendidos || []) {
    if (!v.j || notas.some((x) => x.includes(`**${v.j.nombre}**`))) continue;
    if (cuentaConVendido(t, v.j.nombre, !!(M.dueno && M.dueno[v.j.id] && M.dueno[v.j.id] !== yoT))) nota(`${N(v.j)} ya no es tuyo (${v.como} ${cuando(v.t)}): no cuenta para lo de arriba.`);
  }
  // (texto.js no pinta citas: un título en negrita y una lista)
  if (notas.length) t += `\n\n**Revisado por la app:**\n${notas.slice(0, 6).map((x) => `- ${x}`).join('\n')}`;
  return { texto: t, notas };
}

/** lo que va a la IA en el chat (sin la conversación): se exporta para probarlo con la demo */
export function montarChat(pregunta, D, M, c, { fotos = false, hist = [], web = cfgIA().web } = {}) {
  const p = ultimoPlan();
  // los jugadores que nombra, con todos sus datos aunque no salgan en el resto del contexto
  // también los de sus últimos mensajes («¿y con Nico qué hago?» tras hablar del trueque) y los suyos por el nombre de
  // pila si solo hay uno («Nico»): sin eso, a la segunda pregunta ya no llevaba las cuentas ni la cláusula
  const nombrados = [];
  const meter = (j) => { if (j && !nombrados.some((x) => x.id === j.id) && nombrados.length < 6) nombrados.push(j); };
  const q0 = ` ${norm(pregunta)} `;
  for (const j of jugadoresEn(pregunta, D)) meter(j);
  // (el de pila, solo si no ha salido nadie por su nombre: «Fran me ofrece a Berenguer» no es Fran García)
  if (!nombrados.length) {
    const pila = {};
    for (const x of M.mias || []) { const n = norm(x.j && x.j.nombre).split(' '); if (n.length > 1 && n[0].length >= 4) (pila[n[0]] ||= []).push(x.j); }
    for (const [n, js] of Object.entries(pila)) if (js.length === 1 && q0.includes(` ${n} `)) meter(js[0]);
  }
  const deAhora = nombrados.length;
  const antes = (hist || []).filter((m) => m.r === 'yo').slice(-4, -1).map((m) => m.t || '').join(' \n ');
  if (antes) for (const j of jugadoresEn(antes, D)) meter(j);
  const extra = nombrados.length ? `\n\nJUGADORES QUE NOMBRA EN SU MENSAJE:\n${nombrados.map((j) => `- ${lineaCompleta(D, M, j)}`).join('\n')}${cuentasTxt(D, M, nombrados, { web })}` : '';
  // el plan, entero solo si la pregunta va de él o de sus jugadores; si no, que sepa que existe y poco más
  // (lo repetía en cada respuesta: vender a Natan, Gulácsi y Macià en un chat sobre un trueque)
  let plan = '';
  if (p) {
    const ops = p.operaciones || [];
    // (M3) lo que dejó la app, con lo de hoy (lo hecho desde entonces sale como hecho)
    let cu = null;
    try { cu = opsCuadradas(cuadrarPlan(p, D, M).ops); } catch (e) { cu = p.cuadradas || null; }
    const q = norm(pregunta);
    const vaDelPlan = /\b(plan|operaciones|hoy)\b/.test(q) || (!deAhora && /\b(que hago|que hacer|que me recomiendas|vend|compr|fich|puj|alin)/.test(q)) || ops.some((o) => o.jugador && q.includes(norm(o.jugador).split(' ').pop()));
    const cab = `${diaDe(p.t) === diaDe() ? 'EL PLAN DE HOY' : 'EL ÚLTIMO PLAN'} QUE LE DISTE (${cuando(p.t)})`;
    plan = vaDelPlan
      ? `\n\n${cab}, solo de referencia (no lo repitas si no viene a cuento): ${p.titular} → ${cu ? opsTxt(cu) || 'nada' : ops.map((o) => `${o.accion} ${o.jugador}`).join('; ')}`
      : `\n\n${cab}: «${p.titular}». Esta pregunta no va del plan: no lo nombres.`;
  }
  return `${sistemaIA()}${fotos ? SOBRE_FOTOS : ''}\nContesta a lo que te pregunta, al grano y con cifras; usa listas cortas solo si ayudan. Si recomiendas algo, di cuánto cuesta, cuánto pujar y cuándo hacerlo.\nLOS DATOS DE AHORA MANDAN: lo hablado antes en este chat o en planes de otros días puede estar superado. Sus jugadores son SOLO los de «MIS JUGADORES»; si uno del que hablasteis ya no está ahí (o sale en «YA NO SON MÍOS»), ya no es suyo: no lo cuentes para vender, para el once ni para el dinero. Lo mismo con el saldo: vale el de ahora.\n${REGLAS_CHAT.replace('{{TONO}}', tonoChat())}\n${NOTAS_CHAT}\n${web ? BUSCAR_CHAT : SIN_BUSCAR_CHAT}\n\nDATOS DE SU LIGA AHORA MISMO:\n${contexto(D, M, c, { chat: true })}${extra}${plan}`;
}

export async function charlar(pregunta, D, M, c, alTexto, signal, fotos = [], alPaso = null) {
  const hist = conversacion();
  const nuevas = Object.fromEntries((fotos || []).map((f) => [f.id, f.b64]));
  // (la miniatura va a IndexedDB y en el chat solo su id; si IndexedDB no va, se vuelve a meter en el chat)
  hist.push({ r: 'yo', t: pregunta, ts: Date.now(), ...(fotos && fotos.length ? { fotos: fotos.map((f) => ({ id: f.id })) } : {}) });
  LS.set(K('chat'), hist.slice(-40));
  for (const f of fotos || []) {
    guardarFoto(f).catch(() => {});
    guardarMini(f.id, f.mini).then((ok) => { if (!ok) reponerMini(f.id, f.mini); }).catch(() => reponerMini(f.id, f.mini));
  }
  const contents = await contenidosChat(hist, nuevas);
  const web = cfgIA().web, conFotos = !!(fotos && fotos.length) || hist.some((m) => m.fotos);
  const sistema = montarChat(pregunta, D, M, c, { fotos: conFotos, hist, web });
  const sinBloque = (t) => String(t || '').replace(/```notas[\s\S]*$/, '').trim();
  // sin búsqueda (apagada, cupo gastado o en el relevo) no se le manda buscar: si se le manda, a veces contesta vacío
  const sistemaSinWeb = web ? montarChat(pregunta, D, M, c, { fotos: conFotos, hist, web: false }) : sistema;
  const r = await preguntar({ sistema, sistemaSinWeb, contents }, { stream: true, alTexto: alTexto ? (t) => alTexto(sinWebsChat(sinModelos(sinBloque(t)))) : null, signal, alPaso: alPaso || undefined, nivel: 'low', temperatura: 0.4, seudo: seudonimos(D) });
  const n = aplicarNotas(r.texto, D, pregunta, !!(fotos && fotos.length));
  // (revisión de la IA, 14 nov) lo que contesta se revisa antes de guardarlo, como el plan: lo que recomienda hacer, las
  // cifras que da de sus jugadores y de su saldo, las cuentas y lo que la IA no puede decir
  let rev = { texto: n.texto, notas: [] };
  try { rev = revisarChat(n.texto, pregunta, D, M, { rec: n.recomiendo, hist }); } catch (e) { rev = { texto: n.texto, notas: [] }; }
  n.texto = rev.texto;
  const h2 = conversacion();
  h2.push({ r: 'ia', t: n.texto, ts: Date.now(), fuentes: r.fuentes.slice(0, 8), modelo: r.modelo, apuntadas: n.apuntadas.map((x) => x.texto), olvidadas: n.olvidadas });
  LS.set(K('chat'), h2.slice(-40));
  return { ...r, texto: n.texto, apuntadas: n.apuntadas, olvidadas: n.olvidadas, revisado: rev.notas };
}
