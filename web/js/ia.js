/* La IA: Gemini (Google AI Studio) con tu clave gratuita, llamada directamente desde el móvil a Google.
   Hace el plan del día (las operaciones en orden: qué vender, qué comprar, a quién clausular, cuánto pujar)
   con todo lo de tu liga, los titulares de prensa y los onces probables que ya trae la app; la búsqueda en
   Google es un ajuste (en el chat, solo cuando hace falta; en el plan, apagada por defecto: tarda el doble).
   Prueba todos los modelos gratuitos que tenga tu clave antes de rendirse, y si se acaba la búsqueda en
   Google, sigue sin ella. Cada intento queda apuntado para el diagnóstico. */
import { leer, guardar, http, enApp, enIPhone, despues, nativo } from './puente.js';
import { token, sesion } from './auth.js';
import { LS, eur, pct, cuando, dura, POS, DIA, MIN, HORA, diaDe, norm, num, esWebFantasy, sinWebs, fechaCorta, fechaLarga, horaDe } from './util.js';
import { K } from './datos.js';
import { apodosLiga, listaApodos, aproximar, sinArticulo } from './apodos.js';
import { favoritos } from './favoritos.js';
import { catalogo, catalogoTxt, comoConseguir, buscarOp, porQueNo, cajaConOfertas, esMalo, paronLejos, cholloParon, subeHastaVuelta, aSuValorParon, PARON_VUELTA, noMerece } from './operaciones.js';
import { recsDe, aprendeTxt, guardarRecs } from './aprende.js';
import { guardarFoto, leerFoto, guardarMini } from './fotos.js';
import { bloqueada, topConAnuncio, planesCfg, preguntasCfg, rivalesAbiertos } from './limite.js';
import { pedirWorker } from './soporte.js';
import { turnoPendiente } from './planes-hora.js';
import { rematarAuto, prisaNegativo, ofertaDueno, motivoPeligro } from './motor.js';
import { planDeHoy, planMotor, planVueltas, titularMotor } from './plan.js';
import { SOBRE_BLOQUEO, avisoAlias, sistemaCorto as sistemaCortoDe, claveUrl, SISTEMA_CORTO } from './plan-sistema.js';
import { sistemaChat, tonoDe, separarNotas, sinCodigos, CABECERA_DATOS, MARCA_PREGUNTA } from './chat-sistema.js';
import { leerDicho, dichoTxt, DURA_DICHO } from './dicho.js';

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
// web: la búsqueda en Google en el chat (solo cuando hace falta). (webPlan, la del plan con tu clave, solo la usaba el plan
// largo: se quitó con él el 17 nov, y su interruptor de Ajustes, que ya no hacía nada)
// La del chat, apagada por defecto desde la 0.7zc (revisión total, A3: las condiciones de la búsqueda de Google piden
// enseñar sus sugerencias tal cual y la app no lo hace). Quien la tenía guardada de antes pasa a apagada una vez (webV);
// si la vuelve a encender en Ajustes, se respeta.
export const cfgIA = () => {
  const g = LS.get('cfg-ia', {}) || {};
  return { modelo: '', web: false, auto: true, ...g, ...(g.webV ? {} : { web: false }) };
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
// (22 nov, Carlos) rival a rival: el dinero se abre para UN rival viendo sus anuncios; ese va con su cifra (y se le puede
// decir) y los demás siguen sin ella
const dineroDe = (d, valor, tid = null) => (bloqueada('dineroRivales', tid) ? dineroCat(d, valor) : `${dineroTxt(d)}${tid != null && bloqueada('dineroRivales') ? ' (el de este rival lo tiene ABIERTO: su cifra sí se la puedes decir)' : ''}`);
const dineroTxt = (d) => (!d || d.v == null ? `dinero: no se sabe${d && d.motivo ? ` (${d.motivo})` : ''}` : d.exacto ? `dinero ${eur(d.v)} (exacto)` : d.dicho ? `dinero ≈ ${eur(d.v)} ± ${eur(d.margen)} (me dijo lo que tenía ${cuando(d.dicho.t)}, más lo que ha movido desde entonces)` : `dinero ≈ ${eur(d.v)} ± ${eur(d.margen)} (estimado con todos sus movimientos y sus subidas de cláusula${d.correccion ? `; corregido con ${d.correccion.propio ? 'lo que me dijo él' : [d.correccion.n ? 'lo que me han dicho otros rivales' : '', d.correccion.todos ? 'lo que apunta la gente en todas las ligas' : ''].filter(Boolean).join(' y ')}` : ''})`);
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
  // (21 nov, medido con la liga de Carlos) el partido que acaba de jugar ya va en lo que espera la app: se dice con sus cifras
  const pa = x && x.partido;
  const part = !pa ? '' : bloqueada('inercia') ? `; ACABA DE HACER ${pa.pts} PTS (J${pa.n}): ${pa.e3 > 0 ? 'lo normal es que su valor suba más de lo que venía' : 'lo normal es que su valor vaya peor de lo que venía'}` : pa ? `; ${pa.etapa === 0 ? 'SU PARTIDO DE HOY YA HA ACABADO' : 'JUGÓ AYER'}: ${pa.pts} PTS (J${pa.n}). Tras un partido así, a los de su precio que venían ${pa.como === 'sube' ? 'subiendo' : pa.como === 'baja' ? 'bajando' : 'planos'} su valor les va de media ${pct(pa.e3 * 100, 1)} en ${pa.etapa === 0 ? 3 : 2} días y ${pct(pa.e7 * 100, 1)} en ${pa.etapa === 0 ? 7 : 6} respecto a lo que marcaba su inercia${pa.e3 < 0 && ['sube', 'acelera', 'frena'].includes(x.fase) ? ' (se le frena la subida, no se da la vuelta)' : ''}: la app ya lo cuenta y espera ${eur(x.proy(7), { signo: true })} en 7 días. Usa esto, no lo rehagas` : '';
  const ojo = !pz || pa ? '' : x && ['giro', 'baja', 'parado', 'frena'].includes(x.fase) ? `; OJO: ACABA DE HACER ${QUE} (${pz.pts} PTS, J${pz.n}): ${EFECTO}; tenlo en cuenta antes de decir que siga bajando, que lo venda o que no lo fiches o clausules por la bajada` : `; ACABA DE HACER ${QUE} (${pz.pts} PTS, J${pz.n}): lo normal es que siga subiendo`;
  if (!x || x.fase === 'plano') return pa ? `INERCIA plana${part}` : pz ? `ACABA DE HACER ${QUE} (${pz.pts} PTS, J${pz.n}): ${EFECTO.replace('la bajada', 'su valor')}` : null;
  return inerciaLinea(M, j, x) + part + ojo;
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
  if (!(M.hayOnceDe ? M.hayOnceDe(j) : M.hayOnces)) return null;
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
/* (repaso de la 0.8s, 22 nov) lo quitado de aquí (con su ×, o porque algo nuevo lo pisa) se recuerda 45 días, { id: t }, para
   que al juntarse con lo de otro dispositivo no vuelva. Viaja dentro de la lista de notas como { id, b: t }, sin texto: las
   versiones de antes lo ignoran (solo leen las que llevan texto) */
const BORRADAS_DIAS = 45 * DIA;
const borradas = () => { const b = LS.get(K('notas-borradas'), {}); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
const guardarBorradas = (b) => {
  const ahora = Date.now();
  const l = Object.entries(b).filter(([, t]) => ahora - (Number(t) || 0) < BORRADAS_DIAS).sort((x, y) => y[1] - x[1]).slice(0, 200);
  LS.set(K('notas-borradas'), Object.fromEntries(l));
};
const guardarNotas = (l) => {
  const quedan = new Set(l.slice(-40).map((n) => n && n.id)), b = borradas(), ahora = Date.now();
  for (const n of notas()) if (n && n.id && !quedan.has(n.id)) b[n.id] = ahora;
  guardarBorradas(b);
  LS.set(K('notas'), l.slice(-40)); LS.set(K('notas-t'), ahora); cambioLocal('notas');
};
export const notasVigentes = () => notas().filter((n) => !n.caduca || n.caduca > Date.now());
export const borrarNota = (id) => guardarNotas(notas().filter((n) => n.id !== id));
export const notasDe = (pid) => notasVigentes().filter((n) => n.pid === pid);

/* ---------------- lo dicho que MANDA en el motor (22 nov, Carlos) ----------------
   «No me quedan blindajes», «a Pedri no lo vendo», «ya he pujado por Pepe», «ya he blindado a Thiago»: hechos claros que
   el motor entiende (dicho.js). Se apuntan ANTES de preguntar a la IA, leyendo lo que escribe él, y la app rehace el
   análisis: así los datos que lee la IA ya van corregidos y Hoy, Equipo, las alarmas y el plan dicen lo mismo. Si no
   nombra al jugador («a ese no lo vendo»), queda pendiente: lo puede poner la IA en su nota (aplicarNotas). */
// (lo apuntado y lo pendiente van atados al mensaje en que lo dijo: medido el 22 nov con la IA de verdad, con una ventana de
// minutos la IA daba por dicho en la pregunta siguiente lo de la anterior: «Julián Álvarez se queda contigo» por un «no me fío»)
let PENDIENTE = { t: 0, q: '', lista: [] };
let DICHO_AHORA = { t: 0, q: '', ids: [] };
const DICHO_PENDIENTE_MS = 5 * MIN;
const deEstaPregunta = (X, pregunta) => !!X.t && Date.now() - X.t < DICHO_PENDIENTE_MS && X.q === String(pregunta || '');
/** el texto de la nota para la IA (tercera persona) */
const dichoIA = (n, M) => {
  const j = n.pid && M.J(n.pid), quien = (j && j.nombre) || n.jugador || 'ese jugador';
  const jn = (M.enJuego || M.proxima || {}).n;
  if (n.corr === 'blindajes') return `${n.n === 0 ? 'No le quedan blindajes gratis' : n.n === 1 ? 'Le queda 1 blindaje gratis' : 'Le quedan los 2 blindajes gratis'}${jn ? ` hasta que acabe la jornada ${jn}` : ''}`;
  if (n.corr === 'blindado') return `Ya ha blindado a ${quien}`;
  if (n.corr === 'no-vender') return `No vende a ${quien}`;
  if (n.corr === 'puja') return `Ya ha pujado por ${quien}${n.importe ? ` (${eur(n.importe)})` : ''}`;
  return n.texto || '';
};
/** ¿a quién se le puede aplicar cada cosa? (lo suyo, o lo que hay en el mercado sin puja suya) */
function valeDicho(corr, pid, D, M) {
  const yo = D.yo && D.yo.teamId;
  if (!pid) return false;
  if (corr === 'no-vender' || corr === 'blindado') return !!yo && M.dueno[pid] === yo;
  if (corr === 'puja') return (M.mercado || []).some((m) => m.pid === pid && !m.miPuja && String(m.vendedorTeamId || '') !== String(yo || ''));
  return false;
}
function notaDicho(corr, pid, D, M, { importe = null, n = null, plan = null, ahora = Date.now() } = {}) {
  const o = { corr, pid: pid || null, jugador: pid ? (M.J(pid) || {}).nombre || null : null, tipo: 'hecho', importe: null };
  if (corr === 'blindajes') { o.n = n; o.caduca = M.escudosMios && M.escudosMios.hasta > ahora ? M.escudosMios.hasta : ahora + DURA_DICHO.blindajes; }
  else if (corr === 'blindado') o.caduca = ahora + (M.ESCUDO_H || 24) * HORA;
  else if (corr === 'no-vender') { o.tipo = 'preferencia'; o.caduca = ahora + DURA_DICHO['no-vender']; }
  else if (corr === 'puja') {
    const m = (M.mercado || []).find((y) => y.pid === pid) || {};
    const op = plan && (plan.ops || []).find((y) => y.pid === pid && ['pujar', 'comprar'].includes(y.accion) && y.importe);
    o.importe = num(importe) || (op && num(op.importe)) || num(m.puja) || num(m.precio) || null;
    // (LaLiga no deja pujar por debajo del precio de salida: si dice menos, es que redondea)
    if (o.importe && num(m.precio) > o.importe) o.importe = num(m.precio);
    o.caduca = M.cierreMercado && M.cierreMercado > ahora ? M.cierreMercado + 30 * MIN : ahora + DURA_DICHO.puja;
  }
  o.texto = dichoIA(o, M);
  return o;
}
/**
 * Lee el mensaje del mánager y apunta lo que manda en el motor. Devuelve las notas nuevas (para rehacer el análisis antes
 * de preguntar). `plan`: el plan que ve en Hoy, para «ya he hecho esa puja» sin nombre.
 */
export function apuntarDicho(pregunta, D, M, plan = null, hist = null) {
  PENDIENTE = { t: 0, q: '', lista: [] };
  DICHO_AHORA = { t: 0, q: '', ids: [] };
  if (!pregunta || !D || !M || !D.yo) return [];
  let leido = [];
  try { leido = leerDicho(pregunta, (t) => jugadoresEn(t, D)); } catch (e) { return []; }
  if (!leido.length) return [];
  const ahora = Date.now(), nuevas = [], pend = [];
  const opsPlan = ((plan && plan.ops) || []).filter((o) => o.hoy !== false && !o.descartada && !o.ya);
  for (const x of leido) {
    if (x.corr === 'blindajes') {
      // (aunque la app ya lo cuente así, se apunta: lo ve en el plan y sabe que se le ha hecho caso)
      nuevas.push(notaDicho('blindajes', null, D, M, { n: x.n, ahora }));
      continue;
    }
    let pids = x.pids.filter((pid) => valeDicho(x.corr, pid, D, M));
    // sin nombre: si en el plan de hoy solo hay un paso de eso, es ese («ya he hecho esa puja», «ya lo he blindado»)
    if (!x.pids.length && (x.corr === 'puja' || x.corr === 'blindado')) {
      const del = opsPlan.filter((o) => (x.corr === 'puja' ? o.accion === 'pujar' : o.accion === 'blindar' && !o.importe) && valeDicho(x.corr, o.pid, D, M));
      if (del.length === 1) pids = [del[0].pid];
    }
    // «a ese no lo vendo», sin nombre: el único al que se le puede aplicar de su mensaje de antes («¿Vendo a X?») o, si en
    // ese no hay ninguno, de la última respuesta. Con dos o más no se adivina
    if (!x.pids.length && !pids.length) {
      const conv = (hist || conversacion()).filter((m) => m && m.t && (!m.ts || ahora - m.ts < 30 * MIN));
      for (const quien of ['yo', 'ia']) {
        const ult = [...conv].reverse().find((m) => m.r === quien);
        const cs = ult ? jugadoresEn(ult.t, D).map((j) => j.id).filter((pid) => valeDicho(x.corr, pid, D, M)) : [];
        if (cs.length === 1) { pids = cs; break; }
        if (cs.length > 1) break;
      }
    }
    if (!pids.length) { if (!x.pids.length) pend.push({ corr: x.corr, importe: x.importe || null }); continue; }
    for (const pid of pids) nuevas.push(notaDicho(x.corr, pid, D, M, { importe: pids.length === 1 ? x.importe : null, plan, ahora }));
  }
  if (pend.length) PENDIENTE = { t: ahora, q: String(pregunta), lista: pend };
  const con = guardarDicho(nuevas, ahora);
  DICHO_AHORA = { t: ahora, q: String(pregunta), ids: con.map((n) => n.id) };
  return con;
}
/** guarda las notas que corrigen al motor: de cada cosa (y de cada jugador) manda la última */
function guardarDicho(nuevas, ahora = Date.now()) {
  if (!nuevas.length) return [];
  const pisa = (n) => n.corr && nuevas.some((x) => x.corr === n.corr && (x.pid || null) === (n.pid || null));
  const con = nuevas.map((o, i) => ({ id: `d${ahora.toString(36)}${i}`, t: ahora, ...o }));
  guardarNotas([...notas().filter((n) => !pisa(n)), ...con]);
  return con;
}

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
let palabrasS = null;
const palabrasSistema = () => (palabrasS ||= ` ${norm(`${sistemaChat({})}\n${SISTEMA_CORTO}`)} `);
export function seudonimos(D, apodos = apodosLiga()) {
  const yo = D && D.yo && D.yo.teamId;
  const mio = ((D && D.clasif) || []).find((e) => e && e.teamId === yo);
  const otros = new Set();
  for (const j of Object.values((D && D.maestro) || {})) if (j) for (const t of [j.nombre, j.nombreCompleto, j.equipo]) if (typeof t === 'string' && t.trim()) otros.add(t.trim());
  for (const e of Object.values((D && D.equipos) || {})) if (e) for (const t of [e.nombre, e.corto]) if (typeof t === 'string' && t.trim()) otros.add(t.trim());
  for (const t of [D && D.yo && D.yo.nombre, mio && mio.manager, mio && mio.nombre]) if (typeof t === 'string' && t.trim()) otros.add(t.trim());
  const igual = new Set([...otros].map(norm));
  // (19 nov, (72)) las palabras de las instrucciones que de verdad lee la IA (las del chat y las del plan): un nombre que es
  // una de ellas no se tapa con un alias. Antes se miraba SISTEMA, el sistema del plan largo, que ya no se mandaba a nadie
  const base = palabrasSistema();
  const vale = (x) => typeof x === 'string' && x.trim().length >= 3 && /\p{L}/u.test(x) && !igual.has(norm(x)) && !base.includes(` ${norm(x)} `);
  const rivales = ((D && D.clasif) || []).filter((e) => e && e.teamId !== yo).sort((a, b) => (a.pos || 99) - (b.pos || 99));
  const puestos = rivales.map((e) => e.pos);
  const porPuesto = puestos.every((x) => Number.isInteger(x) && x > 0) && new Set(puestos).size === puestos.length;
  // nombre doblado → alias (el primero que llega se queda: dos rivales que se escriben igual no se pueden separar)
  const alias = new Map(), vuelta = {};
  // (0.8a) los nombres de los rivales y sus apodos, para reconocerlos aunque vengan mal escritos o dictados (`aproximar`),
  // y el primer apodo de cada alias, para contestar con él («el Tito (Marcos)»)
  const aprox = [], apodoDe = {};
  const poner = (nombre, a) => {
    const k = doblar(nombre.trim().normalize('NFC'));
    if (alias.has(k)) return;
    alias.set(k, a);
    if (!(a.toLowerCase() in vuelta)) vuelta[a.toLowerCase()] = nombre.trim();
  };
  rivales.forEach((e, i) => {
    const n = porPuesto ? e.pos : i + 1;
    if (vale(e.manager)) { poner(e.manager, `Rival ${n}`); aprox.push({ nombre: e.manager.trim(), clave: `Rival ${n}` }); }
    if (e.nombre && e.nombre !== e.manager && vale(e.nombre)) { poner(e.nombre, `Equipo ${n}`); aprox.push({ nombre: e.nombre.trim(), clave: `Equipo ${n}` }); }
    // (0.8a, Carlos 17 nov) los apodos que le has puesto: apuntan al mismo «Rival N» (con las mismas reglas que un nombre)
    const aps0 = listaApodos(apodos && apodos[String(e.teamId)]);
    // «el Tito» vale también como «Tito» («al Tito», «del Tito»), pero contesta con «el Tito»
    const aps = [...new Set([...aps0, ...aps0.map(sinArticulo).filter(Boolean)])].filter(vale);
    const a = vale(e.manager) ? `Rival ${n}` : e.nombre && vale(e.nombre) ? `Equipo ${n}` : `Rival ${n}`;
    for (const ap of aps) { poner(ap, a); aprox.push({ nombre: ap, clave: a }); }
    if (aps.length && !apodoDe[a.toLowerCase()]) apodoDe[a.toLowerCase()] = aps[0];
    if (!(a.toLowerCase() in vuelta) && aps.length) vuelta[a.toLowerCase()] = aps[0];
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
  const conEl = Object.values(apodoDe).some((a) => /^el\s/i.test(a));
  const tapar = (t0, { aprox: conAprox = false } = {}) => {
    if (!todo || typeof t0 !== 'string') return t0;
    if (conAprox) t0 = aproximar(t0, aprox, { prohibidos: igual, norm }).t;
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
  };
  return {
    n: alias.size,
    aviso: avisoAlias(porPuesto, ex),
    // (para el Worker, que arma el aviso él: /plan)
    porPuesto, ex: ex > 0,
    // (16 nov) los alias a sus nombres («rival 2» → nombre), para el aviso de Android cuando contesta con la app fuera
    vuelta,
    tapar,
    /** (0.8a) lo que escribes o dictas tú: con los nombres aproximados ya corregidos y tapado; `nota`, lo que se le dice
        a la IA si había uno aproximado (a quién se refiere, o que pregunte si vale para dos) */
    taparPregunta: (t0) => {
      if (!todo || typeof t0 !== 'string') return { t: t0, nota: '' };
      const r = aproximar(t0, aprox, { prohibidos: igual, norm });
      const tt = r.t === t0 ? t0 : r.t;
      const out = tapar(tt);
      const notas = [];
      if (r.cambios.length) notas.push(`en la pregunta había un nombre escrito o dictado de forma aproximada: se refiere a ${r.cambios.join(' y ')}. Empieza diciendo a quién entiendes que se refiere («Entiendo que hablas de ${r.cambios[0]}»)`);
      for (const d of r.dudas) notas.push(`había un nombre aproximado que puede ser ${d.join(' o ')}: pregúntale a cuál se refiere antes de contestar sobre él`);
      return { t: out, nota: notas.length ? `\n[Nota de la app: ${notas.join('; ')}.]` : '' };
    },
    // json: lo que vuelve es un JSON (el plan): el nombre va escapado para que no lo rompa una comilla. (0.8a) En el chat,
    // un rival con apodo sale con él: la primera vez «el Tito (Marcos)» y luego «el Tito»
    // (19 nov) con un apodo que empieza por «el» («el Tito»): «de el Tito» → «del Tito», «a el Tito» → «al Tito»
    destapar: (t, { json = false } = {}) => (alias.size && typeof t === 'string' ? ((vistos) => { const o = t.replace(deVuelta, (m, q, d) => { const k = `${q.toLowerCase()} ${d}`, v = vuelta[k]; if (v == null) return m; if (json) return JSON.stringify(v).slice(1, -1); const ap = apodoDe[k]; if (!ap || ap === v) return v; if (vistos.has(k)) return ap; vistos.add(k); return `${ap} (${v})`; }); return json || !conEl ? o : o.replace(/\b(De|de|Del|del|A|a|Al|al) el (?=\p{Lu})/gu, (m, p) => `${/^d/i.test(p) ? (p[0] === 'D' ? 'Del' : 'del') : (p[0] === 'A' ? 'Al' : 'al')} `); })(new Set()) : t),
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
    const manda = n.corr && (M.dicho || []).some((x) => x.id === n.id);
    L.push(`- [${n.id}] ${cuando(n.t)}: ${n.texto}${n.caduca ? ` (vale hasta ${cuando(n.caduca, { hora: false })})` : ''}${n.pid && fuera.has(n.pid) ? ' [YA NO ES SUYO: esta nota está superada]' : ''}${manda ? ' [LA APP YA LO CUENTA ASÍ en el plan, en Hoy y en los avisos: no lo contradigas]' : ''}`);
    if (n.corr === 'blindajes') continue;
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
  if (M.proxima) L.push(`PRÓXIMA JORNADA: ${M.proxima.n}, primer partido ${cuando(M.proxima.ini)} (en ${dura(M.proxima.ini - Date.now())}).${chat && !M.enJuego ? ` El once de esa jornada se puede cambiar hasta esa hora (${cuando(M.proxima.ini)}); lo que se fiche o clausule después ya no puntúa en ella.` : ''}`);
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
  L.push(`MI EQUIPO: ${yo.nombre || '?'} · ${yo.pos || '?'}º de ${D.clasif.length} · ${yo.puntos || 0} pts · valor ${eur(D.valorEquipo)} · SALDO ${m1(D.dinero)} (lo máximo para una cláusula) · EN EL MERCADO ME QUEDAN PARA PUJAS O COMPRAS NUEVAS ${eur(M.pujaMax)} COMO MUCHO${M.misPujas ? ` (ya descontados los ${eur(M.misPujas)} que tengo comprometidos en pujas: una puja nueva de hasta ${eur(M.pujaMax)} cabe)` : ''}.`);
  // (19 nov, tercera parte) las pujas que ya tiene puestas, con nombre: antes solo salían dentro de las operaciones y el chat
  // confundía una puja posible (R. Terrats) con la que ya tenía (Courtois)
  if (chat) {
    const pu = (M.mercado || D.mercado || []).filter((m) => m.miPuja).map((m) => `${(M.J(m.pid) || {}).nombre || '?'} ${eur(m.miPuja)}${m.pujaDicha ? ' (me ha dicho él que ya la ha hecho)' : ''}`);
    if (pu.length) L.push(`MIS PUJAS YA PUESTAS (se resuelven en el cambio de mercado${M.cierreMercado ? `, ${cuando(M.cierreMercado)}` : ''}): ${pu.join('; ')}. Ninguna otra: lo que sale en PUJAR más abajo son opciones, no pujas mías.`);
  }
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
  // (17 nov, Baena) «NO VENDER AÚN» es para el que la app vendería por la bajada (inercia o una semana cayendo): salía
  // también en uno que sube y tiene una oferta que la app aceptaría, y la IA leía dos órdenes contrarias
  const noVenderAun = (x) => !!(M.esperarVenta && (x.ventaInercia || (x.tend && x.tend.p7 != null && x.tend.p7 < -4))
    && !(veredictos(D, M) || {})[`A-${x.pid}`] && M.esperarVenta(x).tipo);
  // (19 nov) en el chat, lo que se dice de vender por la inercia sale de lo que hace el plan que ve en Hoy: antes decía
  // «VENDER POR INERCIA» de uno que el plan aguanta («Te da 3,5 pts… se aguanta», en Mirados) y la IA mandaba venderlo
  let vendeP = null, miradoP = null;
  if (chat) {
    try {
      const Rp = planQueVe(D, M, c), Rm = planDeHoy(D, M, c);
      const ops = Rp ? (Rp.motorHoy ? Rp.ops : cuadrarPlan(Rp, D, M).ops) : [];
      vendeP = new Set(ops.filter((o) => !o.descartada && !o.sugerencia && o.accion === 'vender').map((o) => String(o.pid)));
      miradoP = new Map(((Rm && Rm.descartes) || []).map((d) => [String(d.pid), String(d.detalle || d.motivo || '')]));
    } catch (e) { vendeP = null; }
  }
  // (24 nov, decide.js) lo que se dice de vender a cada uno es su decisión, la misma de Hoy y Equipo
  const inerciaTxt = (x) => {
    const d = M.decision ? M.decision(x.pid) : null;
    if (!d) return '';
    if (d.accion === 'vender' && ['inercia', 'titular-baja'].includes(d.regla) && !d.enVenta) return `VENDER POR INERCIA (${!x.ventaInercia || x.ventaInercia.urgencia === 'ya' ? 'ya: ha girado' : 'antes de que gire'}) | `;
    if (d.accion === 'vender') return `LA APP: ${d.corta.toUpperCase()} | `;
    if (x.ventaInercia || d.matiz === 'busca-sustituto') return `HA GIRADO A LA BAJA, PERO EL PLAN DE HOY NO LO VENDE (${d.porque.replace(/[.\s]+$/, '')}) | `;
    return '';
  };
  for (const x of M.mias) L.push(`- ${chat ? lineaBreve(M, x.j) : lineaJ(M, x.j, x)} | ${chat ? (M._tit && M._tit.has(x.pid) ? 'EN MI ONCE: titular' : 'EN MI ONCE: suplente') : (M._tit && M._tit.has(x.pid) ? 'TITULAR' : 'suplente')}${sinEl(x)}${M.enVenta && M.enVenta.has(x.pid) ? ' | EN VENTA' : ''}${M.noVender && M.noVender.has(x.pid) ? ' | NO LO VENDE (me lo ha dicho él): no propongas venderlo ni aceptar ofertas por él' : ''} | cláusula ${eur(x.clausula)}${x.ratio != null ? ` (${x.ratio <= 1.03 ? 'A SU VALOR: la presa más fácil' : `${pct((x.ratio - 1) * 100, 0)} sobre su valor`})` : ''} ${x.abierta ? 'ABIERTA (me lo pueden quitar ya)' : x.veda ? `a salvo por el cierre de cláusulas hasta que empiece la jornada ${x.veda.n} (${cuandoF(x.protegidoHasta)})` : `${x.escudo ? 'BLINDADO' : 'protegido'} hasta ${cuandoF(x.protegidoHasta)}, se abre a esa hora${M.escudosMios && M.escudosMios.quedan && !x.escudo ? ' (hasta esa hora no se le puede poner el blindaje)' : ''}`}${(M.paraEscudo || []).includes(x.pid) ? ' | CONVIENE BLINDARLO HOY (gratis)' : x.noBlindar && x.abierta ? ` | NO LO BLINDES: ${x.noBlindar.texto}` : ''} | ${inerciaTxt(x)}${noVenderAun(x) ? `NO VENDER AÚN: ${M.esperarVenta(x).texto} | ` : ''}riesgo de cláusula ${x.riesgo}${x.pagan && (x.abierta || x.abreEn < 2 * DIA) && paganTxt(x.pagan) ? ` (${paganTxt(x.pagan)})` : ''}${blindajeTxt(x.blindaje) ? ` | ${blindajeTxt(x.blindaje)}` : ''}${x.compra ? ` | pagué ${eur(x.compra)} (${eur(x.ganado, { signo: true })})` : x.inicial ? ` | venía en mi equipo inicial: valía ${eur(x.inicial)} al empezar la liga (${eur(x.ganadoIni, { signo: true })})` : ' | no se sabe lo que pagué'}${ventaAppTxt(D, M, x.pid) ? ` | ${ventaAppTxt(D, M, x.pid)}` : ''}`);
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
  if (M.escudosMios) L.push(`BLINDAJES (el escudo de LaLiga, gratis viendo un anuncio): me quedan ${M.escudosMios.quedan} de 2${M.escudosMios.dicho ? ' (me lo ha dicho él: manda sobre lo que se ve en LaLiga)' : ''} hasta que acabe la jornada ${(M.enJuego || M.proxima || {}).n || 'siguiente'}; cada uno protege la cláusula ${M.escudosMios.horas} h desde que se pone y SOLO se puede poner a un jugador con la cláusula ya abierta: a uno con la cláusula protegida o cerrada no se le puede poner hasta la hora en que se abre (te la paso con cada uno). No hay otra protección gratis ni otra forma de alargarla: no te inventes horas ni plazos distintos de los que te paso.`);
  if (M.vendidos && M.vendidos.length) {
    L.push('\nYA NO SON MÍOS (vendidos o clausulados estos días; NO cuentes con ellos para nada: ni para vender, ni para el once, ni para el dinero):');
    for (const v of M.vendidos) L.push(`- ${v.j.nombre}: ${v.como} ${cuando(v.t)}${v.importe ? ` por ${eur(v.importe)}` : ''}`);
  }
  if (M.misVentas && M.misVentas.length) {
    L.push('\nMIS JUGADORES EN VENTA Y SUS OFERTAS:');
    for (const v of M.misVentas) {
      // (24 nov, Fran) lo que da LaLiga, bien dicho: cada oferta, de −10 % a +10 %; lo que se acepta en la liga es otra cosa
      const lg = v.liga ? ` [LA OFERTA DE LALIGA de hoy es ${v.liga.posicion === 'baja' ? 'FLOJA' : v.liga.posicion === 'alta' ? 'DE LAS BUENAS' : 'NORMAL'} (las que se aceptan aquí: de ${pct(v.liga.p25 * 100)} a ${pct(v.liga.p75 * 100)}); hace otra en cada cambio de mercado, de −10 % a +10 % de su valor, A SUERTE (${Math.round((M.pMejorOferta ? M.pMejorOferta(v.mejor ? v.mejor.sobre : 0) : 0.5) * 10)} de cada 10 mejorarían esta)${v.liga.prisa ? `; HAY PRISA: ${v.liga.prisa === 'negativo' ? 'si no vendes antes de la jornada empiezas en negativo' : 'está de baja'}` : '; no hay prisa'}]` : '';
      L.push(`- ${v.j.nombre} (vale ${eur(v.j.valor)}${v.compra ? `, pagué ${eur(v.compra)}` : ''}) puesto a ${eur(v.precio)}: ${v.ofertas.length ? v.ofertas.map((o) => `${o.de} ofrece ${eur(o.importe)} (${pct(o.sobre * 100)} sobre su valor${o.caduca ? `, caduca ${cuando(o.caduca)}` : ''})`).join('; ') : 'sin ofertas todavía'}${lg}${v.ligaEst ? `; la de LaLiga rondará ${eur(v.ligaEst.v)}` : ''}${v.mejor ? ` → la app aconseja ${v.consejo.toUpperCase()}${v.decision && v.decision.matiz === 'esta-oferta-no' ? ' OTRA OFERTA (sigue a la venta, pero esta no)' : ''}: ${v.porque}` : v.decision && v.decision.accion === 'vender' ? ' → la app: sigue a la venta, a esperar la oferta' : ''}`);
    }
  }
  if (M.ventanaEsp) {
    const v = M.ventanaEsp;
    if (v.ciclos < 1) L.push(`\nNO ESPECULES AHORA: ${M.enJuego ? `la jornada ${M.enJuego.n} está en juego y antes de la siguiente no da tiempo` : 'antes de la jornada no queda ningún cambio de mercado que cuente para revender (el del mismo día en que empieza la jornada no da tiempo a vender)'}. Lo que compre ahora no lo puede vender a tiempo: nada de comprar «para revender». Esto es solo para revender: ${M.cierreMercado && M.proxima && !M.enJuego && M.cierreMercado < M.proxima.ini ? 'para FICHAR y alinear, lo que se gane en la subasta sí llega (mira EL MERCADO CAMBIA).' : 'y lo que se gane en la subasta de hoy tampoco llega al once de esta jornada (mira EL MERCADO CAMBIA).'}`);
    else L.push(`\nESPECULAR: hasta la jornada quedan ${v.ciclos} cambio${v.ciclos === 1 ? '' : 's'} de mercado que cuentan (${v.cambios.map((t) => cuando(t)).join(', ')}); ${v.justo ? `el del mismo día que empieza la jornada (${cuando(v.justo)}) solo vale para vender lo que YA tienes para revender si estás en positivo: nunca para salir del negativo ni para lo que compres hoy` : 'el del mismo día que empieza la jornada NO cuenta'}. Lo que compres hoy para revender se pone a la venta ${cuando(v.ponerVentaSeguro)} para aceptar la oferta del cambio de ${cuando(v.limite)}.${v.apura ? ` Lo que ya tienes para revender puede esperar al de ${cuando(v.justo)} (${v.avisoJusto})` : ''} Una compra en el mercado llega en el siguiente cambio y luego hay que ponerla a la venta: necesita 2 cambios; una cláusula, 1. Margen: puede bajar hasta −${eur(M.deuda)} entre medias.${M.enJuego ? ` La jornada ${M.enJuego.n} está en juego, pero se puede comprar YA para revender antes de la ${M.proxima ? M.proxima.n : 'siguiente'}: el valor sigue cambiando cada día (y con lo que haga en su partido si aún juega esta jornada); lo que no vale es vender en los cambios de mientras se juega.` : ''}`);
    if (M.paraRevender && M.paraRevender.length) L.push(`COMPRADOS PARA REVENDER: ${M.paraRevender.map((x) => `${x.j.nombre} (comprado a ${eur(x.rev.precio)}, vale ${eur(x.j.valor)}, ${eur(x.beneficioYa, { signo: true })}${M.aguantaReventa && M.aguantaReventa(x) ? `; LA APP LO AGUANTA: cláusula cerrada hasta ${cuandoF(x.protegidoHasta)}, no está bajando${x.beneficioYa < 0 ? ' y venderlo hoy es perder dinero' : ''}; solo se vende si hace falta para empezar la jornada en positivo` : ''})`).join('; ')}.`);
    if (M.especular && M.especular.length) {
      L.push('CANDIDATOS PARA REVENDER SEGÚN LA TENDENCIA (precio de compra | subida diaria | valor esperado el día de vender | beneficio):');
      for (const e of M.especular.slice(0, 10)) L.push(`- ${e.j.nombre} (${POS[e.j.pos]}, ${e.j.equipo}) | ${e.origen === 'mercado' ? `mercado, pujar ${eur(e.puja)}` : `cláusula ${eur(e.precio)} a ${e.rival.manager || e.rival.nombre}`} | ${pct(e.r * 100)}/día | ${eur(e.valorFuturo)} | ${eur(e.beneficio, { signo: true })}${e.vuelve ? ` | VUELVE: llegó a valer ${eur(e.vuelve.max)} esta temporada, juega otra vez y lleva ${e.vuelve.racha} días subiendo` : ''}`);
    }
  }
  L.push(`\nRIVALES (pos | equipo | manager | puntos | valor | lo que han subido de valor sus jugadores en 7d (sin contar fichajes ni ventas) | movimientos 7d | gastado 7d | cláusulas que han hecho en 14d | peligro (y por qué) | su dinero | lo que suele pagar en el mercado | mis cláusulas que le llegan)${M.dineroExacto ? '' : `. Su dinero, si no es exacto, sale de todos vuestros movimientos desde el principio de la liga (empezasteis con lo mismo); el margen (±) es por la recompensa diaria, que no sale en los movimientos ni en ningún otro sitio: la app no puede saber cuánto ha cogido cada uno. Si le das a alguien el dinero de un rival con su ±, di también que el ± es por eso${M.calDinero && !bloqueada('dineroRivales') ? `. En todas las ligas, con ${M.calDinero.n} casos apuntados por la gente, esta cuenta suele fallar ± ${eur(M.calDinero.margen)}: ya va corregida, pero no te fíes de diferencias más pequeñas que eso` : M.calDinero ? '. Esta cuenta va corregida con lo que apunta la gente en todas las ligas, pero sigue siendo una estimación' : ''}`}:`);
  for (const r of M.rivales) L.push(`- ${r.e.pos}º | ${r.e.nombre} | ${r.e.manager} | ${r.e.puntos} pts | ${eur(r.e.valor)} | ${r.dValor != null ? eur(r.dValor, { signo: true }) : '?'} | ${r.movs} | ${eur(r.gastado)} | ${r.clausulazos}${r.contraMi ? ` (${r.contraMi} a mí)` : ''} | ${({ muyalta: 'muy alto', alta: 'alto', media: 'medio', baja: 'bajo' })[r.nivel] || r.nivel} (${motivoPeligro(r, { quien: !bloqueada('quienPaga') }).replace(/\.$/, '')}) | ${dineroDe(r.dinero, r.e.valor, r.e.teamId)} | ${r.paga ? `paga de mediana ${pct(r.paga.med * 100)} sobre el valor (${r.paga.n} compras, como mucho ${pct(r.paga.max * 100)})` : 'sin compras al mercado'} | ${bloqueada('quienPaga') ? 'no lo sabes (función top cerrada)' : r.leLlegan.length ? `${r.leLlegan.filter((x) => x.abierta).length} abiertas y ${r.leLlegan.filter((x) => !x.abierta).length} que se abren pronto (la más cara, ${(() => { const x = [...r.leLlegan].sort((a, b) => b.clausula - a.clausula)[0]; return `${x.j.nombre} ${eur(x.clausula)}`; })()})` : 'ninguna'}`);
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
  // (24 nov, Fran: «se cree que la liga da un 7 % en las ofertas; puede dar de −10 a +10») las ventas que se ven son las que
  // alguien aceptó: su mediana no es lo que LaLiga ofrece cada vez
  L.push(`\nLO QUE DA LALIGA por lo que se pone a la venta: CADA oferta suya es una lotería entre −10 % y +10 % de lo que vale el jugador ese día (la mitad de las veces, por debajo de su valor), y hace una nueva en cada cambio de mercado. NUNCA digas «LaLiga suele dar un +X %» ni des una cifra fija de lo que va a ofrecer: di el intervalo.${M.ofertaLiga && !M.ofertaLiga.poco ? ` En esta liga, las ofertas que se han ACEPTADO (${M.ofertaLiga.n} ventas) rondan ${pct(M.ofertaLiga.med * 100)} sobre el valor (la mitad entre ${pct(M.ofertaLiga.p25 * 100)} y ${pct(M.ofertaLiga.p75 * 100)}): eso es lo que se acaba sacando si se espera varios cambios de mercado a una buena, no lo que da cada vez; y mientras se espera, el valor del jugador sigue su tendencia.` : ''} Las ofertas de otros managers por los jugadores de un rival no se ven (solo cuántas hay).`);
  // que te lo clausulen no es una venta: con la cláusula a su valor te lo quitan barato (y reponerlo cuesta más)
  {
    const vLiga = M.ofertaLiga && !M.ofertaLiga.poco ? M.ofertaLiga.med : null, pLiga = M.pujasLiga && !M.pujasLiga.poco ? M.pujasLiga.med : null;
    L.push(`\nQUE TE LO CLAUSULEN: es perderlo por su cláusula. Solo te sale bien si la cláusula pasa claramente de lo que sacarías vendiéndolo${vLiga != null ? ` (esperando a una buena oferta, a LaLiga se le saca de mediana ${pct(vLiga * 100)} sobre el valor en esta liga)` : ''} y no te quita puntos ni lo que iba a subir; para reponerlo pagas más de lo que vale${pLiga != null ? ` (aquí se puja de mediana ${pct(pLiga * 100)})` : ''}. Una cláusula a su valor, o casi, es la presa más fácil: es justo lo que buscan los que clausulan.`);
  }
  const PL = M.pujasLiga;
  const tramoTxt = (x) => (x.desde === 0 ? `menos de ${eur(x.hasta, { dec: 0 })}` : x.hasta === Infinity ? `más de ${eur(x.desde, { dec: 0 })}` : `de ${eur(x.desde, { dec: 0 })} a ${eur(x.hasta, { dec: 0 })}`);
  if (PL && !PL.poco) {
    L.push(`\nLO QUE SE PAGA EN ESTA LIGA POR LOS LIBRES DEL MERCADO (${PL.n} compras de las últimas 6 semanas, sobre el valor que tenían ese día): mediana ${pct(PL.med * 100)}, la mitad entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)}, el 10 % más alto ${pct(PL.p90 * 100)} o más. Eso mezcla jugadores de todos los valores, y cuanto más barato, más se paga en porcentaje: NO lo uses para un jugador concreto${PL.tramos && PL.tramos.length ? `. Por tramos de valor: ${PL.tramos.map((x) => `${tramoTxt(x)}, mediana ${pct(x.med * 100)}, 3 de cada 4 hasta ${pct(x.p75 * 100)} y el 90 % hasta ${pct(x.p90 * 100)} (${x.n} compras)`).join('; ')}` : ''}. Con cada puja (P-) te paso lo que se paga aquí por los de su valor, en porcentaje y en euros: esa es la referencia. Últimas: ${PL.ult.slice(0, 6).map((x) => `${(D.maestro[x.pid] || {}).nombre || '?'} ${eur(x.imp)} (${pct(x.s * 100)}, ${x.tid ? nombreTid(M, x.tid) : '?'})`).join('; ')}.`);
  }
  // (0.7.13u, Carlos 16 nov: «los top o los que suben mucho se pagan bastante por encima de la media») cómo se paga según
  // cómo venía el jugador, en esta liga y en todas, y cómo le va al mánager con sus pujas
  {
    const CL = M.comprasLiga || [];
    const med = (f) => { const l = CL.filter(f).map((x) => x.s).sort((a, b) => a - b); if (l.length < 3) return null; const m = (l.length - 1) / 2; return { n: l.length, med: (l[Math.floor(m)] + l[Math.ceil(m)]) / 2 }; };
    const g = [['subían más de un 1,2 % al día', med((x) => x.r != null && x.r > 0.012)], ['subían de un 0,4 a un 1,2 % al día', med((x) => x.r != null && x.r > 0.004 && x.r <= 0.012)],
      ['no subían', med((x) => x.r != null && x.r <= 0.004)], [`eran de los top (más de ${eur(M.corteTop, { dec: 0 })})`, med((x) => x.top)]].filter(([, x]) => x);
    const MP = M.misPujasRes;
    if (g.length || M.calPujas || MP) {
      L.push(`\nCÓMO SE PAGA SEGÚN CÓMO VIENE EL JUGADOR${g.length ? ` (compras de esta liga, con lo que subía cada uno esos días): ${g.map(([t, x]) => `los que ${t}, mediana ${pct(x.med * 100)} sobre su valor (${x.n})`).join('; ')}` : ''}.${M.calPujas ? ` En todas las ligas hay ${M.calPujas.n} compras apuntadas, sin nombres: cuando aquí hay pocas parecidas, la puja de cada P- mezcla las de aquí con esas.` : ''} La puja de la app (P-) ya va con los que venían como él: para uno que sube fuerte, no la bajes, que en esta liga con menos se lo lleva otro. Si con esa puja no sale revenderlo, se dice en su línea (PARA REVENDER NO SALE) y entonces solo vale para tenerlo.${MP ? ` MIS PUJAS (las ${MP.n} últimas que vio la app): ganadas ${MP.ganadas}, perdidas ${MP.perdidas}${MP.falta != null ? `; en las perdidas, quien se lo llevó pagó de mediana ${pct(MP.falta * 100, 1, false)} más sobre su valor que yo` : ''}${MP.ajuste > 0.01 ? '; por eso la app puja algo más arriba de lo normal en esta liga' : MP.ajuste < -0.01 ? '; las gano casi todas, así que la app puja algo más abajo' : ''}.` : ''}`);
    }
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
    for (const a of act) L.push(`- ${cuando(a.t)}: ${a.esYo ? 'YO' : a.quien || '?'} ${({ compra: 'fichó', clausula: 'clausuló', venta: 'vendió', blindaje: 'blindó', entra: 'entró' })[a.clase] || 'movió'} ${a.nombreJ || ''}${a.clase === 'blindaje' ? ' (escudo gratis)' : a.importe ? ` por ${eur(a.importe)}` : ''}${a.otro && a.otro !== a.quien ? ` a ${a.contraMi ? 'MÍ' : a.otro}` : ''}${a.esYo ? '' : yaNoEsSuyo(a, D, M)}`);
  }
  return L.join('\n');
}


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
    // (24 nov) la app lo ha sacado al repasar el plan con los datos de ahora: lo que dice ahora
    ...(o.descartada && o.decAhora ? { ahora: o.decAhora.corta } : {}),
  }));
}
export function opsTxt(l) {
  return (l || []).map((o) => `${o.accion} ${o.jugador}${o.importe ? ` ${eur(o.importe)}` : ''}${o.estado === 'descartada' && o.ahora ? ` (ESO DECÍA EL PLAN; CON LOS DATOS DE AHORA LA APP DICE «${o.ahora}»)` : o.estado === 'descartada' ? ` (LA APP LO DESCARTÓ${o.porque ? `: ${o.porque}` : ''}; no lo recomendaste al final)` : o.estado === 'sugerencia' ? ' (sugerencia sin prisa)' : o.estado === 'hecho' ? ' (ya hecho)' : ''}`).join('; ');
}

const T = (type, extra = {}) => ({ type, ...extra });
const TXT = T('STRING'), TXTN = T('STRING', { nullable: true });

/* ---------------- el plan corto: el motor propone y la IA ordena, recorta y explica (14 nov) ----------------
   Antes la IA escribía la lista de operaciones (y la app tachaba lo que no cuadraba). Ahora el plan lo hace el motor
   (plan.js): a la IA le llegan sus pasos, cada uno con su id y sus datos, tres o cuatro alternativas que también valen y
   lo mínimo de contexto (noticias, lo que el mánager le ha contado, los rivales). Devuelve poco: el orden, qué quita y
   por qué, qué alternativa mete, una o dos frases por paso, el titular, la situación, las noticias y los rivales. La app
   aplica los cambios con el propio motor (que rehace las cuentas) y lo pasa otra vez por cuadrarPlan: si lo que pide la
   IA no cuadra, se queda el plan del motor con sus frases. Si la IA no contesta, el plan del motor ya está en pantalla. */
/** lo que elige la app para las instrucciones del plan corto (el Worker las arma igual con esto: plan-sistema.js) */
export const opSistemaCorto = () => {
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
/** (15 nov, Domy) de un fichaje, una cláusula o un blindaje de un rival: si ese jugador ya no es suyo (lo has fichado tú
 * después, lo ha vendido), se dice. Sin esto la IA contaba «X fichó a Chust» de uno que ya era del mánager */
function yaNoEsSuyo(a, D, M) {
  if (!a || !a.pid || !a.quienT || !['compra', 'clausula', 'blindaje'].includes(a.clase)) return '';
  const de = (M.dueno || {})[a.pid] || null;
  if (de === a.quienT) return '';
  return de && D.yo && de === D.yo.teamId ? ' (ya no lo tiene: ahora es MÍO)' : ' (ya no lo tiene)';
}
/**
 * (15 nov, Domy: «me indica que U.D. Carlista algo de Chust y ya lo he fichado») «Tus rivales» lo escribe la IA y se
 * queda en pantalla todo el día. Una frase que dice que ese rival ha fichado, tiene o ha blindado a un jugador que no es
 * suyo (lo has fichado tú después, lo ha vendido) se quita; si no queda nada que decir de él, se quita el rival. Se mira
 * cada vez que se pinta el plan (cuadrarPlan), con la liga de ese momento: así se pone al día solo.
 */
const RIVAL_TIENE = /\b(ficho|ha fichado|compro|ha comprado|clausulo|ha clausulado|se llevo|se ha llevado|se hizo con|se ha hecho con|pago|ha pagado|blindo|ha blindado|tiene|sigue con|cuenta con|acaba de (?:fichar|comprar|clausular|blindar))\b/g;
const RIVAL_SUELTA = /\b(vend\w*|perd\w*|solt\w*|traspas\w*|quit\w*|en venta|a la venta)\b/;
export function revisarRivales(rivales, D, M) {
  if (!Array.isArray(rivales) || !rivales.length || !M || !M.dueno || !M.teamDeManager) return rivales;
  const yo = D.yo && D.yo.teamId;
  const out = [];
  for (const r of rivales) {
    if (!r || !r.texto) continue;
    const tid = M.teamDeManager(r.manager);
    // (un «rival» que no es de la liga o que soy yo: no hay con qué comprobarlo; el primero se deja, el segundo sobra)
    if (!tid) { out.push(r); continue; }
    if (tid === yo) continue;
    const vale = (frase) => {
      const t = ` ${norm(frase)} `;
      const verbos = [...t.matchAll(RIVAL_TIENE)].map((m) => m.index);
      if (!verbos.length) return true;
      for (const j of jugadoresEn(frase, D)) {
        if ((M.dueno[j.id] || null) === tid) continue;
        const n = norm(j.nombre), ap = n.split(' ').pop();
        let pos = t.indexOf(` ${n} `);
        if (pos < 0) pos = t.indexOf(` ${ap} `);
        if (pos < 0) continue;
        // el verbo, antes del nombre, cerca y sin un «vendió» o «perdió» en medio: habla de tenerlo, y no lo tiene
        if (verbos.some((v) => v < pos && pos - v <= 80 && !RIVAL_SUELTA.test(t.slice(v, pos)))) return false;
      }
      return true;
    };
    // (por frases; el punto de una inicial, «V. Chust», no corta; el de «80 M.», sí)
    const frases = String(r.texto).split(/(?<!(?:^|(?<!\d)[\s(«"])[A-ZÁÉÍÓÚÑ]\.)(?<=[.!?;])\s+/).filter(Boolean);
    const buenas = frases.filter(vale);
    if (buenas.length === frases.length) out.push(r);
    else if (buenas.length) { const x = buenas.join(' ').replace(/;$/, '.'); out.push({ ...r, texto: x.charAt(0).toUpperCase() + x.slice(1) }); }
  }
  return out;
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
  if (Array.isArray(R.descartes) && R.descartes.length) L.push(`\nMIRADO Y DESCARTADO POR LA APP (no se puede meter): ${R.descartes.map((d) => `${d.jugador}: ${cortar(d.detalle || d.motivo, 150)}`).join(' · ')}`);
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
  if (act.length) L.push(`MOVIMIENTOS DE MIS RIVALES (3 días): ${act.map((a) => `${a.quien || '?'} ${({ compra: 'fichó', clausula: 'clausuló', venta: 'vendió', blindaje: 'blindó' })[a.clase] || 'movió'} a ${a.nombreJ || '?'}${a.clase !== 'blindaje' && a.importe ? ` por ${eur(a.importe)}` : ''}${a.contraMi ? ' (a MÍ)' : ''}${yaNoEsSuyo(a, D, M)}`).join('; ')}.`);
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
  // (punto 14, Carlos 14 nov) una noticia de la búsqueda en Google también vale, pero solo con su fuente: la url tiene que
  // estar entre las que salieron de verdad en la búsqueda (json.fuentes lo pone el Worker, o Google; nunca la IA)
  const fuentesOK = new Set((Array.isArray(json.fuentes) ? json.fuentes : []).map((f) => claveUrl(f && f.u)).filter(Boolean));
  const conFuente = (x) => !!(x && x.fuente && fuentesOK.has(claveUrl(x.fuente)));
  const porBusqueda = new Set([...(Array.isArray(json.quita) ? json.quita : []), ...(Array.isArray(json.mete) ? json.mete : [])].filter(conFuente).map((x) => de(x)).filter(Boolean).map((x) => x.k));
  // (lo primero que la app tacharía de ese plan, con su aviso; '' si pasa entero)
  let malo = null;
  const tachado = (P) => { const cu = cuadrarPlan({ ...P, modelo: 'x', t: Date.now() }, D, M); const o = (cu.ops || []).find((y) => y._k && (y.descartada || y.sugerencia)); malo = o ? { k: o._k, aviso: String(o.aviso || '') } : null; return o ? `${o._k} (${String(o.aviso || 'sin aviso').slice(0, 110)})` : ''; };
  // Quitar o meter algo es cosa de las noticias (los números ya los ha mirado el motor): solo si de ese jugador hay
  // prensa, un estado (lesión, sanción, duda), algo que el mánager ha contado o un partidazo reciente. Si no, no se aplica
  // (el modelo ligero quitaba pasos «porque sobra margen»; medido el 14 nov)
  const conNoticia = (k) => {
    const o = (lista.find((y) => y.k === k) || {}).o, pid = o && o.pid, j = pid && D.maestro[pid];
    if (!j) return false;
    return !!((M.noticiasDe && M.noticiasDe(pid).length) || (j.estado && j.estado !== 'ok') || notasDe(pid).length || ((M.partidazo && M.partidazo(pid)) || {}).nivel >= 2);
  };
  // (15 nov) lo que la app vetó al montar el plan del motor (las vueltas de planVueltas) sigue vetado aquí: si no, el
  // motor lo volvía a proponer (subir una cláusula, un blindaje), la app lo volvía a tachar y el plan entero «no cuadraba»
  let vet0 = new Set((R.vetos || []).map((v) => v.k));
  // (17 nov) con qué se compara la jornada: la del plan del motor y, si esa salía en negativo, la del plan de hoy de esta
  // misma liga (si el plan que llega es de antes, la liga de ahora puede llegar en positivo; con la de antes, aquel plan
  // pasaba aunque se quedara en negativo)
  let refJ = null;
  const refJornada = () => {
    if (refJ !== null) return refJ;
    refJ = R.cuentas ? R.cuentas.jornada : -1;
    if (refJ < 0) { try { const H = planDeHoy(D, M, c); if (H && H.motor && H.cuentas) refJ = Math.max(refJ, H.cuentas.jornada); } catch (e) { /* el de antes */ } }
    return refJ;
  };
  // (19 nov, azar-plan martes/negativo) y si ni el del motor llega en positivo («sin salida»), lo que meta la IA no puede
  // dejarlo más en negativo todavía: antes con la referencia en negativo valía todo, y la IA metía compras encima
  const peorJornada = (P) => P.cuentas.jornada < 0 && (refJornada() >= 0 || P.cuentas.jornada < refJornada() - 1e4);
  let pasosBase = base;
  let porque = '';
  const intento = (q, m) => {
    let P = null;
    malo = null;
    try { P = planMotor(D, M, c, { fijar: new Set([...pasosBase.filter((k) => !esPost(k) && !q.includes(k)), ...m]), vetados: new Set([...vet0, ...q.filter(esPost)]), prefer: orden }); } catch (e) { porque = `el motor falla: ${String((e && e.message) || e).slice(0, 110)}`; return null; }
    if (!P) { porque = 'las cuentas no salen'; return null; }
    // nunca peor para la jornada (si el del motor llegaba en positivo, este también) ni con algo que la app tacharía
    if (peorJornada(P)) { porque = 'la jornada empezaría en negativo'; return null; }
    const t = tachado(P);
    if (t) { porque = `la app tacha ${t}`; return null; }
    return { P, quita: q, mete: m };
  };
  // de uno en uno: cada cosa que quita o mete se queda solo si el plan sigue cuadrando con ella (así una que no cabe
  // no se lleva por delante a las demás, y lo que hace falta para empezar la jornada en positivo no se va)
  let r = intento([], []);
  // (15 nov, Carlos: «pone esto cuando es mentira») el plan del motor, sin que la IA toque nada, puede no cuadrar aquí: ha
  // pasado un rato desde que se montó (una cláusula que se cierra, el mercado que cambia, una oferta que caduca) o el
  // motor y la app no dicen lo mismo de algo. Antes eso tiraba el plan entero con «lo que pide la IA no cuadra», aunque la
  // IA no pidiera nada. Ahora nunca: el motor lo elige otra vez con sus vueltas (lo mismo que hace Hoy) y, si ni eso, se
  // queda el que ya está en pantalla. La IA pone las frases sobre el que salga
  let rehecho = '';
  // (17 nov) antes de rehacerlo entero, el mismo plan sin lo que ya no cabe: primero lo que la app tacharía, luego de uno
  // en uno y de dos en dos (como mucho 24 pruebas). Así se quedan los pasos que la IA ha explicado y solo sale lo que ya
  // no se puede (va a «descartados» con su porqué). Pasaba con un plan que ya no es de ahora: la liga ha cambiado desde
  // que se pidió (el plan que se recoge al volver a la app, otro saldo, una puja ganada)
  const ajustes = [];
  let anadidos = [];
  if (!r && base.length) {
    const motivoTxt = (por, m) => (m && m.aviso ? m.aviso : /negativo/.test(por) ? 'con él empezarías la jornada en negativo' : /cuentas/.test(por) ? 'con tu saldo de ahora ya no salen las cuentas' : 'ya no cabe en el plan');
    const p0 = porque, m0 = malo;
    const pruebas = [];
    if (m0 && base.includes(m0.k)) pruebas.push([m0.k]);
    for (const k of base) if (!pruebas.some((x) => x.length === 1 && x[0] === k)) pruebas.push([k]);
    for (let i = 0; i < base.length; i++) for (let k = i + 1; k < base.length; k++) pruebas.push([base[i], base[k]]);
    for (const q of pruebas.slice(0, 24)) {
      const x = intento(q, []);
      if (!x) continue;
      for (const k of q) ajustes.push({ k, motivo: k === (m0 && m0.k) ? motivoTxt(p0, m0) : motivoTxt(p0, null) });
      pasosBase = pasosBase.filter((k) => !q.includes(k));
      vet0 = new Set([...vet0, ...q.filter(esPost)]);
      r = intento([], []) || { ...x, quita: [] };
      break;
    }
    // (y si quitando no sale, el mismo plan con lo que haga falta de más: el motor busca el resto con esos pasos dentro,
    // como mucho 3 vueltas, y lo que la app tacharía sale de los que van dentro o se veta)
    const sinPost = base.filter((k) => !esPost(k));
    for (const sin of [null, ...sinPost].slice(0, 8)) {
      if (r) break;
      let inc = sinPost.filter((k) => k !== sin), vet = new Set(vet0);
      const fuera = sin ? [{ k: sin, motivo: motivoTxt(p0, null) }] : [];
      for (let v = 0; v < 3 && !r; v++) {
        let X = null;
        try { X = planMotor(D, M, c, { incluir: new Set(inc), vetados: vet, prefer: orden }); } catch (e) { break; }
        if (!X) break;
        if (peorJornada(X)) break;
        if (!tachado(X)) { r = { P: X, quita: [], mete: [] }; break; }
        if (inc.includes(malo.k)) { inc = inc.filter((k) => k !== malo.k); fuera.push({ k: malo.k, motivo: motivoTxt('', malo) }); } else vet.add(malo.k);
      }
      if (r) {
        ajustes.push(...fuera.filter((a) => !r.P.operaciones.some((o) => o._k === a.k)));
        for (const k of base) if (!r.P.operaciones.some((o) => o._k === k) && !fuera.some((a) => a.k === k)) ajustes.push({ k, motivo: motivoTxt(p0, null) });
        pasosBase = r.P.operaciones.filter((o) => o._k).map((o) => o._k);
        vet0 = vet;
        anadidos = pasosBase.filter((k) => !base.includes(k));
      }
    }
    if (!r) porque = p0;
  }
  if (!r) {
    rehecho = porque || 'no cuadra';
    try {
      const V2 = planVueltas(D, M, c, { prefer: orden });
      vet0 = new Set((V2.R.vetos || []).map((v) => v.k));
      pasosBase = (V2.P.operaciones || []).filter((o) => o._k).map((o) => o._k);
      r = { P: V2.P, quita: [], mete: [] };
    } catch (e) {
      rehecho += `; y al rehacerlo: ${String((e && e.message) || e).slice(0, 110)}`;
      const fuera = new Set((R.ops || []).filter((o) => o._k && (o.descartada || o.sugerencia)).map((o) => o._k));
      r = { P: { ...R, operaciones: (R.operaciones || []).filter((o) => !fuera.has(o._k)).map((o) => ({ ...o })) }, quita: [], mete: [] };
    }
  }
  const respaldo = (k) => conNoticia(k) || porBusqueda.has(k);
  for (const k of quita0) { if (!respaldo(k) || !pasosBase.includes(k)) continue; const x = intento([...r.quita, k], r.mete); if (x) r = x; }
  // (una alternativa entra si cubre algo que se ha quitado o si la noticia es suya)
  for (const k of mete0) { if (!r.quita.length && !respaldo(k)) continue; const x = intento(r.quita, [...r.mete, k]); if (x) r = x; }
  const P = r.P;
  // las frases: la de la IA si no trae cifras que no estén en los datos del paso; si no, la de la app
  let sinFrase = 0;
  const frasesNo = [];
  const cuBase = cuadrarPlan({ ...P, modelo: 'x', t: Date.now() }, D, M);
  const nombreK = (k) => { const x = lista.find((y) => y.k === k); return x ? x.o.jugador : ''; };
  for (const o of P.operaciones) {
    const d = o.datos || {};
    if (d.cuanto || d.cuando) o.claves = [d.cuanto, d.cuando && `Cuándo: ${d.cuando}`, d.siNo && `Si no: ${d.siNo}`].filter(Boolean);
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
  // (17 nov) y tampoco a quien ha salido del plan porque ya no cabía (los ajustes y, si se ha rehecho, lo que ya no está)
  const enP = new Set((P.operaciones || []).map((o) => o._k).filter(Boolean));
  const fueraN = [...quita0.filter((k) => r.quita.includes(k)), ...mete0.filter((k) => !r.mete.includes(k)), ...base.filter((k) => !enP.has(k) && !r.quita.includes(k))].map(nombreK).filter(Boolean).map(norm);
  const ajustados = ajustes.map((a) => ({ pid: ((lista.find((y) => y.k === a.k) || {}).o || {}).pid || null, jugador: nombreK(a.k), motivo: `La app lo saca del plan: ${limpio(a.motivo).replace(/^La app lo descarta:\s*/i, '')}` })).filter((d) => d.jugador);
  const nombra = (t) => { const n = norm(t); return fueraN.some((x) => x && n.includes(x)); };
  const tit = limpio(json.titular), sit = limpio(json.situacion);
  return {
    ...P, auto: false, corto: true,
    titular: tit && !nombra(tit) ? tit : titularMotor({ ...cu, modo: P.modo }),
    // (Domy, 9 nov) en el parón el plan va de dinero: si la IA no lo dice, se añade
    // (si el plan se ha rehecho, la situación de la IA hablaba de otro: saldo, pasos; va la de la app)
    situacion: sit && !nombra(sit) && !rehecho ? `${sit}${P.modo === 'paron' && !/par[oó]n/i.test(`${sit} ${tit}`) ? ' Estamos en el parón: nadie puntúa hasta la vuelta, así que hoy manda el dinero.' : ''}` : P.situacion,
    descartes: [...quitados, ...ajustados, ...(P.descartes || []).filter((d) => ![...quitados, ...ajustados].some((q) => q.pid && q.pid === d.pid))],
    // las noticias, solo de quien tiene prensa, estado o una nota (lo demás es relleno o invento), y en corto: dos frases
    // (o con su fuente de la búsqueda)
    noticias: (Array.isArray(json.noticias) ? json.noticias : []).map((n) => ({ ...n, pid: n && n.jugador ? pidDe(n.jugador, D) : null })).filter((n) => { const j = n.pid && D.maestro[n.pid]; return !!j && !!((M.noticiasDe && M.noticiasDe(n.pid).length) || (j.estado && j.estado !== 'ok') || notasDe(n.pid).length || conFuente(n)); })
      .slice(0, 4).map((n) => ({ jugador: n.jugador, efecto: n.efecto, texto: breve(limpio(n.texto)), ...(conFuente(n) && !esWebFantasy(n.fuente) ? { fuente: n.fuente } : {}) })).filter((n) => n.texto),
    rivales: (Array.isArray(json.rivales) ? json.rivales : []).slice(0, 3).map((n) => ({ ...n, texto: breve(limpio(n && n.texto)) })).filter((n) => n.manager && n.texto),
    proximos_dias: prox,
    cambios: { ...(rehecho ? { rehecho } : {}), ...(ajustes.length || anadidos.length ? { ajustado: [...ajustes.map((a) => `fuera ${nombreK(a.k)}: ${String(a.motivo).slice(0, 120)}`), ...anadidos.map((k) => `entra ${((r.P.operaciones.find((o) => o._k === k)) || {}).jugador || k}`)] } : {}), quita: r.quita.map(nombreK), mete: r.mete.map(nombreK), porBusqueda: [...r.quita, ...r.mete].filter((k) => porBusqueda.has(k) && !conNoticia(k)).map(nombreK), noAplicado: [...quita0.filter((k) => !r.quita.includes(k)).map((k) => `quitar ${nombreK(k)}${respaldo(k) ? '' : ' (sin noticia que lo respalde)'}`), ...mete0.filter((k) => !r.mete.includes(k)).map((k) => `meter ${nombreK(k)}`)], sinFrase, frasesNo },
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
async function planPorApp(pedido, seudo, { signal, alPaso, extra = false, ids = null } = {}) {
  const sd = seudo && seudo.n ? seudo : null;
  const t0 = Date.now();
  if (alPaso) alPaso(planesCfg().web ? 'La IA está leyendo tu plan y buscando las últimas noticias…' : 'La IA está leyendo tu plan y las noticias…');
  let j;
  // (15 nov) el id del pedido. En la app de Google Play, al salir de la app Android la congela y se corta la conexión con
  // el servidor, pero el plan se sigue haciendo allí y se guarda con este id: al volver se pide otra vez con el mismo id y
  // llega el que ya estaba hecho (sin gastar otro plan del día ni volver a pedírselo a la IA). El id se queda guardado
  // hasta que llega el plan, por si Android cierra la app del todo: el siguiente plan de los 30 min siguientes lo recoge.
  const pend = LS.get('plan-rid', null);
  const rid = pend && pend.dia === diaDe() && Date.now() - pend.t < 30 * 60e3 && /^[a-z0-9]{8,24}$/.test(pend.rid || '') ? pend.rid
    : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 20);
  // (17 nov) con el id va lo que era cada paso de ese pedido (p1 → vender a X…): si se recoge después, el plan de ahora
  // puede ser otro y sus p1, p2… ya no son los mismos (ver planCorto)
  const idsDe = pend && pend.rid === rid && Array.isArray(pend.ids) ? pend.ids : ids;
  if (!pend || pend.rid !== rid) LS.set('plan-rid', { rid, t: Date.now(), dia: diaDe(), ...(ids ? { ids } : {}) });
  const cuerpo = { pedido: sd ? sd.tapar(pedido) : pedido, ...opSistemaCorto(), alias: sd ? { puesto: !!sd.porPuesto, ex: !!sd.ex } : null, extra: !!extra, rid };
  const parado = () => Object.assign(new Error('Parado'), { name: 'AbortError' });
  // una petición que, si la app vuelve de segundo plano con ella aún sin contestar, se da por cortada a los 3 s
  const una = () => new Promise((ok, ko) => {
    let hecho = false, reloj = null, mira = null;
    const ini = Date.now();
    const fin = () => { hecho = true; if (reloj) clearTimeout(reloj); if (mira) clearTimeout(mira); window.removeEventListener('fm-vuelta', vuelta); document.removeEventListener('visibilitychange', vis); };
    const vuelta = () => { if (hecho || reloj) return; reloj = setTimeout(() => { if (hecho) return; fin(); ko(Object.assign(new Error('Sin conexión: vuelve a probar en un rato'), { estado: 0, detalle: 'la app ha vuelto de segundo plano' })); }, 3000); };
    const vis = () => { if (!document.hidden) vuelta(); };
    window.addEventListener('fm-vuelta', vuelta);
    document.addEventListener('visibilitychange', vis);
    // (24 nov, Carlos: «tarda 2 o 3 minutos y creo que sí que lo hace: cierro la aplicación, la abro y ya está el plan») la
    // petición del plan se queda abierta hasta que la IA acaba; si el final no llega (la conexión se queda muda sin
    // cortarse), la app seguía esperando hasta agotar el intento (2 minutos) con el plan ya hecho en el servidor. Mientras
    // espera, cada 5 s le pregunta aparte si el plan de este pedido ya está (/plan/res, lo mismo que mira el móvil al
    // salir de la app) y, si está, se queda con él sin esperar a la petición
    const mirar = (espera) => {
      mira = setTimeout(async () => {
        mira = null;
        if (hecho) return;
        let r = null;
        try { r = await pedirWorker('GET', `/plan/res?rid=${rid}`, null, { tiempo: 8000 }); } catch (e) { r = null; }
        if (hecho) return;
        const f = r && r.fin && typeof r.fin === 'object' ? r.fin : null;
        if (f && (f.plan || f.e)) {
          fin();
          apuntar({ modelo: 'app', s: 'plan', e: 'la IA de la app: el plan ya estaba hecho y la petición seguía sin contestar; recogido aparte', ms: Date.now() - ini });
          ok(f);
          return;
        }
        mirar(5000);
      }, espera);
    };
    mirar(8000);
    // (17 nov) cada intento, con lo que quede de los 3 minutos (antes, 2 minutos cada uno: podían ser 4 en total). Y una
    // respuesta que no llega entera (se corta con el servidor ya contestando: solo los espacios de mientras piensa, medio
    // plan) es un corte como otro: se repite con el mismo id y, si el plan ya estaba hecho, llega sin gastar otro
    const tiempo = Math.max(15000, Math.min(120000, TOPE - (Date.now() - t0)));
    const cortada = (e) => (e && e.name !== 'AbortError' && ((e instanceof TypeError && e.estado === undefined) || (e.estado >= 200 && e.estado < 300 && !e.datos))
      ? Object.assign(new Error('La respuesta de la IA se ha cortado por el camino. Tienes el plan de la app; vuelve a probar en un rato.'), { estado: 0, detalle: `respuesta cortada${e.estado ? ` (${e.estado})` : ''}: ${String(e.message || e).slice(0, 80)}` }) : e);
    pedirWorker('POST', '/plan', cuerpo, { tiempo, signal }).then((r) => { if (!hecho) { fin(); ok(r); } }, (e) => { if (!hecho) { fin(); ko(cortada(e)); } });
  });
  // a que la app esté a la vista (si se ha cortado con la app en segundo plano, se repite al volver)
  const aLaVista = () => new Promise((ok) => {
    if (nativo.aLaVista()) return ok();
    const ya = () => { window.removeEventListener('fm-vuelta', ya); document.removeEventListener('visibilitychange', ya); ok(); };
    window.addEventListener('fm-vuelta', ya);
    document.addEventListener('visibilitychange', ya);
  });
  // (15 nov) para el aviso del móvil si sales de la app (versión de Google Play); en la web no hace nada
  // (24 nov) primero con la sesión que ya hay, sin esperar: si hay que renovarla tarda un momento y, saliendo de la app
  // justo entonces, el móvil no tenía el id del pedido y ni avisaba ni lo recogía
  if (enApp) {
    try { const s0 = sesion(); if (s0 && s0.token) nativo.planEnMarcha(rid, s0.token); } catch (e) { /* nada */ }
    try { nativo.planEnMarcha(rid, await token()); } catch (e) { /* sin sesión: lo dirá el Worker */ }
  }
  // como mucho 3 minutos en total: nunca se queda «preparando» sin fin
  const TOPE = 180000;
  try {
    for (let vez = 0; ; vez++) {
      try { j = await una(); break; } catch (e) {
        if (e.name === 'AbortError' || e.estado !== 0 || vez >= 3 || (signal && signal.aborted)) throw e;
        if (Date.now() - t0 > TOPE) throw Object.assign(new Error('La IA ha tardado demasiado. Tienes el plan de la app; vuelve a probar en un rato.'), { estado: 0, detalle: 'más de 3 min' });
        apuntar({ modelo: 'app', s: 'plan', e: `la IA de la app: 0 corte${e.detalle ? ` (${e.detalle})` : ''}; lo repito`, ms: Date.now() - t0 });
        await aLaVista();
        if (alPaso) alPaso('Recogiendo tu plan…');
        await new Promise((ok) => setTimeout(ok, 1500));
        if (signal && signal.aborted) throw parado();
      }
    }
    LS.del('plan-rid');
    nativo.planAcabado();
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const d = e.datos || {};
    if (d.cupo) guardarCupo(d.cupo);
    // (lo que no es un corte no se va a recoger después: el id se suelta)
    if (e.estado !== 0) LS.del('plan-rid');
    nativo.planAcabado();
    apuntar({ modelo: 'app', s: 'plan', e: `la IA de la app: ${e.estado || 0} ${e.message}${e.detalle ? ` (${e.detalle})` : ''}`, ms: Date.now() - t0 });
    // sin cupo hoy: no es un fallo (lo dice el Worker); lo demás es que el servicio no está (y vale tu clave, si la tienes)
    if (e.estado === 429 && d.cupo) throw new ErrorIA(e.message, 429, { cupo: d.cupo });
    // (17 nov) el tope de gasto del día de la IA de la app: no vuelve «en un rato», sino mañana (lo dice el servidor)
    if (d.tope && d.e) throw new ErrorIA(String(d.e), e.estado || 503, { servicio: true });
    if (e.sesion || e.estado === 401) throw new ErrorIA(e.message || 'No se ha podido comprobar tu cuenta de LaLiga ahora mismo.', 401, { servicio: true });
    throw new ErrorIA(e.estado === 0 ? e.message : 'La IA de los planes no está disponible ahora mismo. Tienes el plan de la app; vuelve a probar en un rato.', e.estado || 0, { servicio: true });
  }
  // (la respuesta ya empezada trae el error en el cuerpo: el Worker manda espacios mientras la IA piensa)
  if (j && j.e) {
    apuntar({ modelo: 'app', s: 'plan', e: `la IA de la app: ${j.estado || 200} ${j.e}`, ms: Date.now() - t0 });
    throw new ErrorIA(j.e, j.estado || 0, { servicio: !!j.servicio });
  }
  if (j.cupo) guardarCupo(j.cupo);
  const busquedas = (j.tok && Number(j.tok.web)) || 0;
  apuntar({ modelo: 'app', s: 'plan', ok: true, web: busquedas > 0, ms: Date.now() - t0, tok: j.tok || null });
  const texto = JSON.stringify(j.plan || {});
  return { texto: sd ? sd.destapar(texto, { json: true }) : texto, idsDe, pedidoT: pend && pend.rid === rid && pend.t ? pend.t : t0, modelo: 'app', web: busquedas, tok: j.tok ? { entra: j.tok.entra, sale: j.tok.sale, ...(busquedas ? { web: busquedas } : {}) } : null, cupo: j.cupo || null };
}
/**
 * (17 nov) los ids del plan corto (p1, a2…) son la posición de cada paso en el plan que se mandó. Si la respuesta es de
 * otro pedido (`viejos`, [[id, clave]] de entonces) y el plan de ahora (`nuevos`) no es el mismo, se cambian en el json
 * por los de ahora según la clave de cada paso (V-123: vender a ese jugador…); lo que ya no está se quita. Cambia `json`
 * y devuelve un resumen para el diagnóstico, o '' si no hacía falta.
 */
export function traducirIds(json, viejos, nuevos) {
  if (!json || !Array.isArray(viejos) || !viejos.length || !Array.isArray(nuevos)) return '';
  if (viejos.length === nuevos.length && viejos.every(([id, k], i) => nuevos[i][0] === id && nuevos[i][1] === k)) return '';
  const kDe = new Map(viejos.map(([id, k]) => [id, k])), idDe = new Map(nuevos.map(([id, k]) => [k, id]));
  let iguales = 0, fuera = 0;
  for (const campo of ['pasos', 'quita', 'mete']) {
    if (!Array.isArray(json[campo])) continue;
    json[campo] = json[campo].filter((x) => {
      const id = x && idDe.get(kDe.get(idLimpio(x.id)));
      if (!id) { fuera++; return false; }
      iguales++; x.id = id; return true;
    });
  }
  return `${iguales} pasos siguen, ${fuera} ya no están`;
}
/**
 * El plan del día con el contrato corto. Devuelve null si el motor no ha podido hacer su plan.
 * porApp: con la IA de la app (el Worker); si no, con tu clave de Google. extra: viene de un anuncio bonificado.
 */
async function planCorto(D, M, c, { signal, alPaso, porApp = false, extra = false } = {}) {
  const R = planDeHoy(D, M, c);
  if (!R || !R.motor) return null;
  const pedido = pedidoCorto(D, M, c, R);
  const seudo = seudonimos(D);
  // (corto de verdad: 1.500 tokens de respuesta sobran; el resto del tope es lo que piense. Y un minuto como mucho)
  const ids = idsCorto(R).lista.map((x) => [x.id, x.k]);
  const r = porApp ? await planPorApp(pedido, seudo, { signal, alPaso, extra, ids })
    : await preguntar({ sistema: sistemaCorto(), contents: [{ role: 'user', parts: [{ text: pedido }] }] }, { signal, alPaso, nivel: 'low', maxTokens: 5000, total: 75000, web: false, seudo, seudoJSON: true, esquema: ESQUEMA_CORTO });
  const json = sacarJSON(r.texto);
  if (!json || (!Array.isArray(json.pasos) && !json.titular)) {
    apuntar({ modelo: r.modelo, web: r.web, s: 'plan', e: `el plan corto no se puede leer (${r.fin || 'sin motivo'}, ${r.texto.length} caracteres${r.tok && r.tok.th ? `, ${r.tok.th} pensando` : ''})`, ms: 0 });
    throw new ErrorIA(`La IA ha contestado sin el formato del plan${r.fin && r.fin !== 'STOP' ? ` (${r.fin === 'MAX_TOKENS' ? 'se ha cortado por largo' : r.fin})` : ''}. Tienes el plan de la app; vuelve a probar cuando quieras.`, 0);
  }
  // (17 nov) el plan recogido de un pedido de antes (la app se cerró mientras la IA contestaba): sus ids eran los de aquel
  // plan; se pasan a los de este por lo que era cada paso. Lo que ya no está en el plan de ahora no se aplica
  // (19 nov, (72) de la segunda revisión) un plan pedido antes de que se cerraran las cláusulas y recogido ya con ellas
  // cerradas era de otro mundo: sus cláusulas ya no se pueden pagar y no queda cambio de mercado para lo demás. Antes se
  // rehacía con planVueltas y salía otro plan con las frases de la IA a medias; ahora no se aplica: queda el de la app
  if (r.pedidoT && M.vedaAhora && r.pedidoT < M.vedaAhora.ini) {
    apuntar({ modelo: r.modelo, s: 'plan', e: 'plan recogido de antes del cierre de cláusulas: no se aplica', ms: 0 });
    throw new ErrorIA('El plan de la IA se pidió antes de que se cerraran las cláusulas y ya no vale: tienes el de la app, que ya cuenta con el cierre. Si quieres, pide otro.', 0, { recogidoViejo: true });
  }
  const traducidos = traducirIds(json, r.idsDe, ids);
  // las fuentes de la búsqueda en Google: las que trae el Worker (ya comprobadas) o Google; lo que la IA escriba ahí, no
  json.fuentes = (porApp ? (Array.isArray(json.fuentes) ? json.fuentes : []) : r.fuentes || []).filter((f) => f && typeof f.u === 'string' && /^https:\/\//.test(f.u));
  // (15 nov) lo que conteste la IA nunca tira el plan: lo que no cabe no se aplica y, si el plan de la app ya no cuadra tal
  // cual, se rehace (aplicarCorto). Si aun así algo fallara, solo sus textos; y el error, solo si ni eso (con su porqué)
  let A = null, fallo = '';
  try { A = aplicarCorto(json, R, D, M, c); } catch (e) { fallo = String((e && e.message) || e); }
  if (!A) { try { A = aplicarCorto({ titular: json.titular, situacion: json.situacion, pasos: [], quita: [], mete: [], fuentes: json.fuentes }, R, D, M, c); if (A) A.cambios.rehecho = `solo los textos de la IA: ${fallo || 'lo demás no cuadraba'}`; } catch (e) { fallo = fallo || String((e && e.message) || e); } }
  if (!A) {
    apuntar({ modelo: r.modelo, web: r.web, s: 'plan', e: `no cuadra${fallo ? ` (${fallo.slice(0, 160)})` : ''}: ${String(r.texto || '').slice(0, 300)}`, ms: 0 });
    throw new ErrorIA('La IA ha contestado, pero no se ha podido aplicar al plan de hoy. Tienes el plan de la app; vuelve a probar cuando quieras.', 0);
  }
  // (para el diagnóstico: por qué el plan de la app no cuadraba tal cual; no es un fallo, el plan sale igual)
  if (traducidos) apuntar({ modelo: r.modelo, web: r.web, s: 'plan', ok: true, fin: `plan recogido de un pedido anterior: ${traducidos}`, ms: 0 });
  if (A.cambios && A.cambios.rehecho) apuntar({ modelo: r.modelo, web: r.web, s: 'plan', ok: true, fin: `plan rehecho al aplicar: ${String(A.cambios.rehecho).slice(0, 260)}`, ms: 0 });
  // (en «Fuentes», sin las webs de fantasy: para quitar o meter sí han valido)
  const fuentes = json.fuentes.filter((f) => !esWebFantasy(f.t) && !esWebFantasy(f.u)).slice(0, 6).map((f) => ({ t: String(f.t || f.u).slice(0, 120), u: f.u }));
  return { ...A, fuentes, modelo: r.modelo, web: porApp ? r.web > 0 : json.fuentes.length > 0, t: Date.now(), dia: diaDe(), mercado: M.cierreMercado || null, tok: r.tok || null, ...(porApp ? { app: true } : {}), foto: { dinero: D.dinero, mias: M.mias.map((x) => x.pid), clausulas: Object.fromEntries(M.mias.map((x) => [x.pid, x.clausula || 0])) } };
}
/**
 * El plan del día con la IA: el corto (plan.js monta el plan y la IA lo ordena, recorta y explica). Con «planes.on» en
 * limites.json va por la IA de la app (op.demo: en la liga de ejemplo, no); si ese servicio no está (sin clave en el
 * Worker, apagado, su tope del día, caído), con tu clave de Google si la tienes. Sin cupo, no: los de más van con anuncio
 * (Carlos, 14 nov). (17 nov) Si el motor no ha podido montar su plan, la IA no tiene qué ordenar: se dice y se queda el
 * automático. Antes, con tu clave, la IA escribía el plan entero (planLargo, el contrato de antes de la 0.7.10); se quitó
 * porque ya solo llegaba ahí con el motor roto (en 5.850 ligas al azar no pasa nunca) o con «cfg-ia.planLargo», que no
 * tenía interruptor en Ajustes. Lo que la IA escribe a mano sigue pasando por cuadrarPlan (los planes guardados de antes).
 */
export async function planDelDia(D, M, c, op = {}) {
  let P = null;
  if (planesApp(op.demo)) {
    try { P = await planCorto(D, M, c, { ...op, porApp: true }); } catch (e) {
      if (!(e.servicio && hayClave())) throw e;
      P = await planCorto(D, M, c, op);
    }
  } else P = await planCorto(D, M, c, op);
  if (!P) throw new ErrorIA('Hoy la app no ha podido montar su plan con las cuentas, así que la IA no tiene qué ordenar. Tienes el plan automático.', 0);
  try { const cu = cuadrarPlan(P, D, M); P.recs = recsDe(cu.ops, M); P.cuadradas = opsCuadradas(cu.ops); } catch (e) { P.recs = []; }
  try { guardarRecs(P); } catch (e) { /* nada */ }
  const lista = planes();
  lista.unshift(P);
  LS.set(K('planes'), lista.slice(0, 10));
  cambioLocal('plan');
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

/** ¿se hace sola un plan nuevo con la IA? (0.7.13l, Carlos 16 nov) A sus horas: por defecto, 10 minutos después de que se
    refresque el mercado y 12 horas después, o las que elija en Ajustes (planes-hora.js). Con la de la app cuentan en los 2
    del día, así que nunca si el Worker ya ha dicho que hoy no quedan. Con tu clave, además, si el plan es viejo (planViejo) */
export function planViejoAuto(M, demo) {
  const turno = !!turnoPendiente(M, ultimoPlan());
  if (!planesApp(demo)) return turno || planViejo(M);
  if (!turno) return false;
  const cu = cupoPlanes();
  return !(cu && !cu.ilimitado && cu.quedan <= 0);
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
export function cuadrarPlan(P, D, M, { chat = false, suelto = false } = {}) {
  if (!P) return null;
  const buscar = (n) => {
    const k = norm(n);
    if (!k) return null;
    // (19 nov, Carlos: «entra Morcillo y sale Morcillo… no es tuyo») con dos que se llaman igual se quedaba con el
    // primero de LaLiga, que podía no ser el tuyo: en cada paso de la búsqueda, primero los tuyos y luego el resto
    const mios = (M.mias || []).map((x) => x.j || D.maestro[x.pid]).filter(Boolean);
    const todos = Object.values(D.maestro);
    const en = (f) => mios.find(f) || todos.find(f);
    return en((j) => norm(j.nombre) === k) || en((j) => norm(j.largo) === k)
      || (k.length >= 3 ? en((j) => { const n = norm(j.nombre); return n.length >= 3 && (n.includes(k) || k.includes(n)); }) : null) || null;
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
      // (23 nov, Thiago) al que baja, que te lo clausulen es venderlo por más de lo que da LaLiga
      if (x && x.noBlindar) { quitados.push({ jugador: j.nombre, ref: null, motivo: `La app lo quita: no lo blindes, ${x.noBlindar.texto}.` }); return false; }
      if (x && x.riesgo === 'ninguno') {
        // (17 nov) el porqué de verdad: antes decía «ya está un +11 % por encima de su valor y no hay riesgo», como si
        // un +11 % fuera mucho en una liga que paga los clausulazos al +21,8 %
        const CZ = M.clausulazos, pg = x.pagan, sobre = x.ratio ? x.ratio - 1 : null;
        const porque = !x.abierta && x.protegidoHasta ? `sigue protegida hasta ${cuando(x.protegidoHasta)} (nadie puede pagarla hasta entonces y el blindaje solo se pone con la cláusula abierta)${sobre != null && sobre > 0.3 ? ` y, abierta, estaría un ${pct(sobre * 100, 0)} por encima de su valor` : ''}`
          : CZ && CZ.n >= 3 && sobre != null && sobre > CZ.p90
          ? `ya está un ${pct(sobre * 100, 0)} por encima de su valor (${eur(x.j.valor)}), más de lo que se paga en tu liga por un clausulazo (como mucho un ${pct(CZ.p90 * 100, 0)})`
          : pg && pg.hayDatos && !pg.seguro.length && !pg.quiza.length ? 'a ningún rival le llega el dinero para pagarla'
          : !x.importa ? 'no te quita puntos y, si te lo clausulan, cobras más de lo que te daría LaLiga'
          : `${sobre != null ? `está un ${pct(sobre * 100, 0)} por encima de su valor (${eur(x.j.valor)}) y ` : ''}la app no ve a nadie dispuesto a pagarla`;
        quitados.push({ jugador: j.nombre, ref: null, motivo: `La app lo quita: su cláusula (${eur(x.clausula)}) no corre peligro: ${porque}.` });
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
          // (16 nov) si es para revender y la app solo lo ve rentable pujando hasta un tope (`pujaJusta`), no se sube de ahí
          // (0.7.13u) y para revender, la puja es la que gana en tu liga (`pujaGana`), sin los recortes por lo que aporta al once
          const espR = String(o.objetivo || '').startsWith('revend') ? (M.especular || []).find((e) => String(e.pid) === String(opC.pid) && e.origen === 'mercado') : null;
          const espJ = espR && espR.pujaJusta ? espR : null;
          // (24 nov) y para aguantarlo (`nr.aguantar`: no sale revenderlo antes de la jornada, pero sí teniéndolo), también
          const nrP = !espR && String(o.objetivo || '').startsWith('revend') ? (M.noRevender || {})[opC.pid] : null;
          const objetivoP = espR ? espR.puja : nrP && nrP.aguantar ? nrP.puja : (opC.puja || 0);
          const sube = Math.min(objetivoP, Math.floor(cabe / 10000) * 10000);
          if (espJ && importe > espJ.puja) { aviso = `${aviso ? `${aviso}. ` : ''}Para revenderlo, la app la deja en ${eur(espJ.puja)}: con más ya no sale a cuenta.`; importe = Math.max(espJ.puja, opC.precio); o.puja_max = importe; }
          // (con lo que se paga por los de su valor: la mediana de todos engaña con los baratos; Carlos, 30 oct)
          const PV = M.pagaLiga && opC.j && opC.j.valor ? M.pagaLiga(opC.j.valor, opC.pid) : null;
          if (sube > importe && (PV || (PL && !PL.poco))) {
            aviso = `${aviso ? `${aviso}. ` : ''}Subida de ${eur(importe)} a ${eur(sube)}: ${PV ? `por ${M.pagaTxt(PV)}, se los llevan de mediana con un ${pct(PV.med * 100)} sobre su valor (la mitad, entre ${pct(PV.p25 * 100)} y ${pct(PV.p75 * 100)})` : `en esta liga los libres se llevan de mediana con un ${pct(PL.med * 100)} sobre su valor (la mitad, entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)})`}; con menos lo normal es perderlo${sube < objetivoP ? `. La app pujaría ${eur(objetivoP)}, pero no te llega para más` : ''}.`;
            importe = sube; o.puja_max = importe;
          } else if (objetivoP && objetivoP >= opC.precio && importe > objetivoP * 1.1 && importe - objetivoP > 500000) {
            // y al revés: si la IA puja claramente más que la app, se baja a la de la app. La de la app ya cuenta las
            // pujas que lleva, si está subiendo, lo que se paga en esta liga por los de su valor (hasta el p90 con
            // muchas pujas) y lo que aguanta pagar por lo que aporta; un 10 % por encima ya es pagar de más. Y como
            // poco medio millón: en los baratos un 10 % son cuatro duros y se pagan más caros en porcentaje
            aviso = `${aviso ? `${aviso}. ` : ''}La IA pujaba ${eur(importe)}. La app la deja en ${eur(objetivoP)}: con más pagarías de más.`;
            importe = objetivoP; o.puja_max = importe;
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
            const liga = ol && !ol.sinDatos && !bloqueada('ventasRivales') ? `esperando a una buena oferta, LaLiga le acaba dando unos ${eur(ol.v)} por uno así (cada oferta va de −10 % a +10 % y la de hoy solo la ve él)` : 'LaLiga también le hace su oferta';
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
      // (24 nov, aviso de Domy: descartaba a uno que subía 1,4 M al día con 324 M de saldo) a la puja que gana en su liga
      // no da tiempo a revenderlo antes de la jornada, pero aguantándolo sí sale (`M.aguantar`): vale para revender más
      // adelante, pagado con el saldo (si hay que tirar de deuda, habría que venderlo antes de la jornada y ya no sale)
      const nrA = !e && accion === 'pujar' ? (M.noRevender || {})[pid] : null, ag = nrA && nrA.aguantar;
      if (o.aguantar && !ag) o.aguantar = false;
      if (ag) {
        const mia = opC && opC.miPuja ? +opC.miPuja : 0;
        const ben = Math.round(ag.valorFuturo - (importe || nrA.puja));
        o.aguantar = true;
        o.beneficio_esperado = ben;
        o.beneficioApp = true;
        o.vender_el = null;
        if (ben <= 0) { descartada = true; aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: pagando ${eur(importe)}, en ${ag.dias} días valdría unos ${eur(ag.valorFuturo)} y no ganarías nada.`; }
        else if (saldo != null && importe - mia > saldo) { descartada = true; aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: para revender antes de la jornada no sale y, para aguantarlo, hay que pagarlo con saldo (te quedarían ${eur(saldo - (importe - mia))}): en negativo no puntúas.`; }
      } else if (!e) {
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
    // (0.7.13p, aviso de Domy del 16 nov: «no puede ser que descarte un fichaje que sube 2 M y medio al día») en el parón
    // manda el dinero: si la app lo ve subiendo hasta la vuelta y pagando esto se gana, no se descarta aunque la IA lo
    // ponga para el once: es dinero en el parón y llega a tiempo para la jornada
    const subeParon = !ya && !descartada && signo < 0 && importe && j && ['pujar', 'comprar', 'clausular'].includes(accion) && paronLejos(M) ? subeHastaVuelta(M, j, importe) : null;
    if (subeParon && !String(o.objetivo || '').startsWith('revend') && !cholloParon(M, j, importe)) {
      o.paronSube = true;
      if (subeParon.futuro) { o.beneficio_esperado = Math.round(subeParon.futuro - importe); o.beneficioApp = true; }
      aviso = `${aviso ? `${aviso} ` : ''}En el parón, pero ${subeParon.txt}: ${subeParon.futuro ? `pagando ${eur(importe)}, antes de la vuelta valdría unos ${eur(subeParon.futuro)} (${eur(subeParon.futuro - importe, { signo: true })}). ` : ''}Comprarlo ahora sale a cuenta y llega a tiempo para el once de la jornada ${M.proxima.n}.`;
    }
    // (0.7.13p) ni uno del mercado a su valor, bueno y sin bajar que se paga con el saldo, sin deuda (aSuValorParon)
    const mParon = accion !== 'clausular' && (M.mercado || []).find((x) => String(x.pid) === String(pid));
    if (!ya && !descartada && !subeParon && signo < 0 && importe && j && ['clausular', 'pujar', 'comprar'].includes(accion) && !String(o.objetivo || '').startsWith('revend') && paronLejos(M) && !cholloParon(M, j, importe)
      && !(mParon && aSuValorParon(M, mParon, importe, num(D.dinero) - num(M.misPujas)))
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
    // (22 nov) «a este no lo vendo», dicho en Pregunta: una venta suya no entra en ningún plan
    if (!ya && accion === 'vender' && M.noVender && M.noVender.has(pid)) { descartada = true; aviso = 'Me dijiste que no lo vendes: fuera del plan. Si has cambiado de idea, quítalo en «Lo que me has dicho».'; }
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
    // (24 nov) lo que se compra para aguantarlo ya trae su cuenta (lo pagado de más y en cuántos días se recupera): sin el
    // «aceptable para lo que aporta», que es del once
    if (!ya && !descartada && signo < 0 && importe && j && j.valor && ['clausular', 'comprar', 'pujar'].includes(accion) && !o.aguantar) {
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
    if (!ya && !descartada && signo < 0 && String(o.objetivo || '').startsWith('revend') && !o.aguantar && M.ventanaEsp) {
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
  // (24 nov) el cambio: la venta del titular que baja no va sin la puja por su recambio (si la IA la quita, o la app la
  // descarta por dinero, la venta también; si el recambio ya es tuyo, la venta sigue sola)
  // (24 nov) el cambio: la venta del titular que baja sin relevo va solo con la puja por su recambio (la del plan de la app
  // lleva `cambio`; la de la IA, cualquiera de los recambios de `M.cambioDe`)
  for (const o of ops) {
    if (suelto || o.accion !== 'vender' || o.ya || o.descartada || !o.hoy) continue;
    const cbM = !o.cambio && M.cambioDe ? M.cambioDe(o.pid) : null;
    if (!o.cambio && !cbM) continue;
    const entran = o.cambio ? [o.cambio.entra] : cbM.rec.map((r) => r.pid);
    if (entran.some((e) => M.dueno && M.dueno[e] === (D.yo && D.yo.teamId))) continue;
    if (ops.some((p) => entran.includes(p.pid) && !p.descartada && ['pujar', 'comprar', 'clausular'].includes(p.accion))) continue;
    const nom = o.cambio ? o.cambio.entraNombre : cbM.rec.map((r) => r.j.nombre).slice(0, 2).join(' o ');
    o.descartada = true;
    o.aviso = `La app lo descarta: sin su recambio (${nom}) no lo vendas: es titular en tu once.`;
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
  /* (24 nov, decide.js) UNA regla donde había cuatro («vender sin necesidad», la oferta protegida, el que vuelve y el que
     sube fuerte, cada una con su cuenta): una venta que va contra la decisión del jugador sale del plan con el porqué de
     la decisión, el mismo que dicen Equipo, los avisos y la IA. Se queda (con el aviso) solo si hace falta el dinero: sin
     ella se acabaría en negativo, es una venta para otro día que el plan guarda por si acaso, o detrás hay una cláusula o
     una subida de cláusula de hoy que se pagan con lo que hay en caja. Y lo que antes no se podía decir: si la decisión es
     vender pero no por esta oferta (Turrientes), el paso lo dice (`cambia`) y el titular también, en vez de «mejor aguantar» */
  const quedanCambios = !!(M.ventanaEsp && M.ventanaEsp.ciclos >= 1);
  for (const o of ops) {
    if (o.accion !== 'vender' || !o.pid || o.ya || o.descartada || !M.decisionBase) continue;
    const d = M.decisionBase(o.pid);
    if (!d || d.regla === 'entrenador') continue;
    const acepta = o.etiqueta === 'Aceptar oferta' || /acepta/i.test(o.donde || '');
    const noEsta = acepta && d.accion === 'vender' && d.oferta === 'esperar' && d.matiz !== 'con-recambio';
    if (d.accion !== 'aguantar' && !noEsta) continue;
    const entra = o.hoy && o.importe ? o.importe : 0;
    const sin = final != null ? final - entra : null;
    const v = (M.misVentas || []).find((x) => x.pid === o.pid);
    const fuera = (txt) => { if (entra) quitarVenta(o, txt); else { o.descartada = true; o.aviso = txt; o.saldo = null; } };
    const ahoraDec = { accion: d.accion, matiz: d.matiz, corta: d.corta, porque: d.porque };
    // la oferta que el motor protege (un titular o uno que ha dejado de bajar, por poco más de lo que vale; Gulácsi, 23 nov):
    // aunque haga falta dinero, no se acepta mientras queden cambios de mercado (se hace caja con otra cosa)
    if (acepta && o.hoy && v && v.protege && quedanCambios && !pagaCaja(o)) {
      fuera(`La app lo descarta: ${v.porqueCorto || d.porque} Quedan ${M.ventanaEsp.ciclos} cambios de mercado para hacer caja con otra cosa.`);
      o.decAhora = ahoraDec;
      continue;
    }
    const haceFalta = !o.hoy || (sin != null && sin < 0) || pagaCaja(o);
    if (haceFalta) {
      o.porDinero = true;
      if (!/hace falta/i.test(`${o.motivo || ''} ${o.aviso || ''}`)) o.aviso = `${o.aviso ? `${o.aviso} ` : ''}Ojo: ${d.porque.replace(/\s+$/, '')} Véndelo solo si de verdad necesitas el dinero.`;
      continue;
    }
    if (noEsta) {
      fuera(`La app lo descarta: ${d.porque}`);
      o.cambia = true;
    } else {
      fuera(`La app lo descarta: no te hace falta el dinero${sin != null ? ` (${entra ? 'sin esta venta ' : ''}acabarías con ${eur(sin)})` : ''}. ${d.porque}`);
      if (d.matiz === 'sube' || d.matiz === 'vuelve') o.aguanta = 'sube';
    }
    o.decAhora = ahoraDec;
  }
  const aceptaDec = (o) => { const dq = M.decisionBase ? M.decisionBase(o.pid) : null; return !!dq && dq.matiz === 'acepta' && (o.etiqueta === 'Aceptar oferta' || /acepta/i.test(o.donde || '')); };
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
    // (24 nov, decide.js) si la decisión del jugador es aceptar esa oferta (paga de más, o baja y casi iguala su valor), lo
    // que pagaste no la cambia: antes Equipo decía «Aceptar» y el plan, «puede esperar a una oferta mejor»
    if (aceptaDec(o)) continue;
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
    // (17 nov, Baena) si la app ya aconseja aceptar la oferta que tiene (paga por encima de su valor), no se le añade
    // «mejor espera»: salían las dos cosas juntas. Que te lo clausulen no es seguro y la oferta la tienes ya
    const acepta = (M.misVentas || []).some((v) => v.pid === o.pid && v.consejo === 'aceptar');
    o.aviso = `${o.aviso ? `${o.aviso} ` : ''}${vc.txt}${vc.espera && !urge && !acepta ? ' Si no tienes prisa, mejor espera.' : vc.espera && acepta ? ' Pero que te lo clausulen no es seguro y esta oferta la tienes ya.' : ''}`;
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
    if (aceptaDec(o)) continue;
    const x = M.mias.find((y) => y.pid === o.pid);
    if (!x || ['injured', 'suspended'].includes(x.j.estado)) continue;
    const t = M.tend(o.pid), ine = M.inercia ? M.inercia(o.pid) : null;
    if ((ine && x.j.valor && num(ine.ult) < -0.03 * x.j.valor) || (t.p1 != null && t.p1 < -3)) continue;
    // (Carlos, 14 nov) si baja todos los días, no es malvender: a la venta por si llega una oferta mejor (o aceptarla)
    if (M.bajaSeguido && M.bajaSeguido(o.pid) && +o.importe >= x.j.valor * 0.995) continue;
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
  // (24 nov) lo que se compra para aguantarlo no: ese dinero no vuelve antes de la jornada
  const rev = ops.filter((o) => String(o.objetivo || '').startsWith('revend') && !o.aguantar && o.signo < 0 && o.importe && o.hoy);
  // (A6) con el beneficio de la app (M.especular), nunca con el que escribe la IA
  const recupera = rev.reduce((s, o) => s + (o.beneficioApp && o.beneficio_esperado ? +o.importe + +o.beneficio_esperado : +o.importe), 0);
  let avisoSaldo = null, avisoTipo = null;
  if (final != null && final < -M.deuda) { avisoSaldo = `Te pasarías del límite de deuda (${eur(-M.deuda)})`; avisoTipo = 'mal'; }
  else if (final != null && final < 0 && rev.length && final + recupera >= 0) {
    // (17 nov) con más o menos fuerza según los cambios de mercado que quedan para vender
    const pn = prisaNegativo(M);
    avisoSaldo = `En negativo a propósito hasta que vendas lo de revender (${rev.map((o) => (o.j && o.j.nombre) || o.jugador).join(', ')}). ${pn.txt ? `${pn.txt} ` : ''}Con eso vuelves a unos ${eur(final + recupera)} antes de la jornada`;
    avisoTipo = pn.tipo;
  } else if (final != null && final < 0 && sugeridas && final + sugeridas >= 0) {
    const pn = prisaNegativo(M);
    avisoSaldo = pn.nivel === 'calma'
      ? `En negativo, pero sin prisa: tienes hasta ${M.ventanaEsp && M.ventanaEsp.limite ? cuando(M.ventanaEsp.limite) : 'antes de la jornada'} para vender y empezar la jornada en positivo (las ventas sugeridas te dejarían en ${eur(final + sugeridas)})`
      : `En negativo: ${pn.txt.replace(/^./, (x) => x.toLowerCase())} Con las ventas sugeridas te quedarías en ${eur(final + sugeridas)}`;
    avisoTipo = pn.tipo;
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
  // («Tus rivales», al día: lo que dice de un rival y ya no es verdad con la liga de ahora, fuera)
  let rivales = P.rivales;
  try { rivales = revisarRivales(P.rivales, D, M); } catch (e) { rivales = P.rivales; }
  return { ...P, titular, situacion, titularApp, descartes, ops, final, avisoSaldo, avisoTipo, recupera, empezo, alineacion, avisoOnce, avisoAlin, pujasHechas: +M.misPujas || 0, ...(Array.isArray(P.rivales) ? { rivales } : {}) };
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
  // (24 nov) si la decisión sigue siendo vender pero no por esta oferta, el titular lo dice así: «mejor aguantar» sonaba
  // a lo contrario de lo que le decía el chat (aviso de Senna)
  const noOferta = fuera.filter((o) => o.accion === 'vender' && o.cambia).map(nombreDe);
  const aguanta = fuera.filter((o) => o.accion === 'vender' && !o.cambia).map(nombreDe);
  const yDe = (l) => l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0];
  let lo = hoy.length ? `hoy toca ${yDe(hoy.slice(0, 2).map(frase))}${hoy.length > 2 ? ` (y ${hoy.length - 2} más)` : ''}`
    : vivas.some((o) => o.ya) ? 'lo de hoy ya está hecho' : 'hoy no hace falta vender ni fichar a nadie';
  if (aguanta.length) {
    const sube = fuera.some((o) => o.accion === 'vender' && o.aguanta === 'sube');
    lo += `${hoy.length ? ';' : ':'} mejor aguantar a ${yDe(aguanta)}${sube ? `, que sigue${aguanta.length > 1 ? 'n' : ''} subiendo` : ''}`;
  }
  if (noOferta.length) {
    const cola = `${yDe(noOferta)}: a la venta, pero esta oferta no`;
    lo = hoy.length || aguanta.length ? `${lo}; ${cola}` : cola;
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
    // (`suelto`: cada paso solo, sin los que van en pareja con otro, como la venta del cambio con la puja por su recambio)
    try { x = (cuadrarPlan({ operaciones: [paso], titular: '', t: Date.now() }, D, M, { chat: true, suelto: true }).ops || [])[0] || null; } catch (e) { x = null; }
    if (!x) return { ok: false, aviso: 'la app no la haría' };
    return { ok: !x.descartada && !x.sugerencia, sinPrisa: !!x.sugerencia, aviso: x.aviso || '', importe: x.importe, cuando: x.cuando, paron: !!x.paron };
  };
  const V = {};
  for (const o of cat.lista) {
    const t = o.ref[0];
    if (t === 'C' || t === 'P') {
      // para el once y para revender no pasan los mismos filtros: vale si vale para alguna de las dos
      const tit = uno(o, { objetivo: 'titular', importe: t === 'P' ? o.puja : o.precio, puja_max: t === 'P' ? o.puja : null });
      const espO = (M.especular || []).find((e) => e.pid === o.pid), pujaRev = espO && espO.origen === 'mercado' ? espO.puja : o.puja;
      const rev = espO ? uno(o, { objetivo: 'revender', importe: t === 'P' ? pujaRev : o.precio, puja_max: t === 'P' ? pujaRev : null }) : { ok: false };
      // (24 nov) y para aguantarlo (revender más adelante, pagado con saldo): `aguantar` lo lleva aparte, valga o no para el once
      const nrA = t === 'P' && !espO ? (M.noRevender || {})[o.pid] : null;
      const lar = nrA && nrA.aguantar ? uno(o, { objetivo: 'revender', importe: nrA.puja, puja_max: nrA.puja }) : { ok: false };
      V[o.ref] = tit.ok && rev.ok ? { ...tit, para: 'el once o revender' } : tit.ok ? { ...tit, para: lar.ok ? 'el once o aguantarlo para revender más adelante' : 'el once' } : rev.ok ? { ...rev, para: 'revender (para el once, no)' } : lar.ok ? { ...lar, para: 'aguantarlo y revender más adelante, pagado con saldo (para el once, no)' } : { ...tit, ok: false };
      if (lar.ok) V[o.ref].aguantar = { importe: lar.importe, aviso: lar.aviso || '' };
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
  // (24 nov, decide.js) la decisión del jugador, la misma en todos los sitios
  const dec = M.decision ? M.decision(pid) : null;
  if (dec && (dec.accion === 'vender' || dec.enVenta)) return `LA APP${dec.oferta ? ', CON LA OFERTA QUE TIENE' : ''}: ${dec.oferta ? (dec.oferta === 'aceptar' ? 'ACEPTAR' : dec.matiz === 'esta-oferta-no' ? 'ESPERAR OTRA OFERTA (sigue a la venta)' : 'ESPERAR') : dec.corta.toUpperCase()} (${cortar(dec.porque, 170)})`;
  const V = veredictos(D, M), a = V[`A-${pid}`], v = V[`V-${pid}`];
  // (20 nov) con una oferta, lo que aconseja la app es su consejo (ACEPTAR o ESPERAR, el de Equipo → en venta): «aceptaría»
  // solo decía que la operación se puede hacer, y con la de Hugo por Baena salían a la vez «aceptaría» y «ESPERAR»
  const mv = (M.misVentas || []).find((x) => x.pid === pid && x.mejor);
  if (a && mv && ['aceptar', 'esperar'].includes(mv.consejo)) return `LA APP, CON LA OFERTA QUE TIENE: ${mv.consejo.toUpperCase()}${mv.porque ? ` (${cortar(mv.porque, 170)})` : ''}`;
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

/* ---------------- lo mismo en todos tus dispositivos (22 nov, Carlos) ----------------
   «En la web me sale un plan distinto al de la app móvil; tienen que ser iguales, y las preguntas que hagas en un sitio
   tienen que aparecer en el otro.» El plan de la IA, la conversación, lo que le has contado y los pasos marcados como
   hechos se guardaban solo en cada dispositivo, y cada uno pedía su plan. Ahora van también con la cuenta (sinc.js y
   /sinc del servidor): de cada cosa gana la que se cambió más tarde. Aquí, lo que se sube y cómo se pone lo que llega. */
let alCambiar = () => {};
/** sinc.js se apunta aquí para subir lo que cambie */
export const escucharCambios = (f) => { alCambiar = typeof f === 'function' ? f : () => {}; };
export const cambioLocal = (clave) => { try { alCambiar(clave); } catch (e) { /* sin sincronizar, como antes */ } };
const guardarChat = (l) => { LS.set(K('chat'), l); LS.set(K('chat-t'), Date.now()); cambioLocal('chat'); };
/** lo de este dispositivo, cada cosa con cuándo se cambió: { plan, chat, notas, hechos } (null lo que no hay) */
export function paraSinc() {
  const p = ultimoPlan();
  // (las miniaturas de las capturas no viajan: se quedan en el dispositivo que las mandó)
  const chat = conversacion().map((m) => (Array.isArray(m.fotos) ? { ...m, fotos: m.fotos.map((f) => ({ id: f.id })) } : m));
  const tc = Number(LS.get(K('chat-t'), 0)) || (chat.length ? Number(chat[chat.length - 1].ts) || 0 : 0);
  const tn = Number(LS.get(K('notas-t'), 0)) || 0, th = Number(LS.get(K('hechos-t'), 0)) || 0;
  return {
    plan: p && p.t && !p.auto ? { t: p.t, v: p } : null,
    chat: tc ? { t: tc, v: chat } : null,
    notas: tn ? { t: tn, v: [...notas(), ...Object.entries(borradas()).map(([id, b]) => ({ id, b }))] } : null,
    hechos: th ? { t: th, v: LS.get(K('hechos'), {}) } : null,
  };
}
/**
 * Pone aquí lo que llega de otro dispositivo, si es más nuevo. Devuelve si ha cambiado algo. `charlando`: hay una pregunta
 * en marcha; la conversación no se toca hasta que acabe.
 */
/* (repaso de la 0.8s, 22 nov) Si aquí hay cambios que aún no se han subido (`desde`: lo último que este dispositivo subió o
   recibió de esa cosa) y llega algo más nuevo de otro, ya no gana entero lo último: se junta. Antes, con el móvil abierto
   mientras se usaba la web, lo que se contaba o se preguntaba en uno se perdía al subir el otro. De las notas, las de los
   dos menos las quitadas en cualquiera; de la conversación, los mensajes de los dos en orden; de los pasos hechos, por
   plan, el que se marcó más tarde. Lo juntado queda con la hora de ahora para que se suba (sinc.js). */
export function ponerRemoto(clave, d, { charlando = false, desde = null } = {}) {
  if (!d || !d.t || d.v == null) return false;
  if (clave === 'plan') {
    const P = d.v;
    if (typeof P !== 'object' || !P.t || P.auto || typeof P.titular !== 'string') return false;
    const l = planes();
    if (l.some((x) => x.t === P.t)) return false;
    LS.set(K('planes'), [P, ...l].sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 10));
    return true;
  }
  if (clave === 'chat') {
    if (charlando || !Array.isArray(d.v)) return false;
    const tLoc = Number(LS.get(K('chat-t'), 0)) || 0;
    // (con cambios de aquí sin subir, lo de allí cuenta si es de después de la última vez que se miró, aunque sea de antes
    // que lo de aquí: se junta)
    const junta = desde != null && tLoc > desde && d.t > desde;
    if (!junta && d.t <= tLoc) return false;
    const loc = conversacion(), llega = d.v.filter((m) => m && (m.r === 'yo' || m.r === 'ia')).slice(-40);
    // otra conversación (en el otro dispositivo empezó un chat nuevo): la de aquí pasa a «Anteriores», como allí
    const misma = loc.length && llega.length && (loc[0].ts || 0) === (llega[0].ts || 0);
    // la misma conversación seguida en los dos a la vez: los mensajes de los dos, en orden
    if (misma && junta) {
      const id = (m) => `${m.ts}|${m.r}`, ya = new Set(llega.map(id));
      const mios = loc.filter((m) => m && (Number(m.ts) || 0) > desde && !ya.has(id(m)));
      LS.set(K('chat'), [...llega, ...mios].sort((x, y) => (Number(x.ts) || 0) - (Number(y.ts) || 0)).slice(-40)); LS.set(K('chat-t'), Date.now());
      return true;
    }
    if (d.t <= tLoc) return false;
    if (loc.length && !misma) archivar();
    LS.set(K('chat'), llega); LS.set(K('chat-t'), d.t);
    return true;
  }
  if (clave === 'notas') {
    const tLoc = Number(LS.get(K('notas-t'), 0)) || 0;
    const junta = desde != null && tLoc > desde && d.t > desde;
    if (!Array.isArray(d.v) || (!junta && d.t <= tLoc)) return false;
    const b = borradas();
    for (const x of d.v) if (x && x.id && x.b && !x.texto) b[x.id] = Math.max(Number(b[x.id]) || 0, Number(x.b) || 0);
    let lista = d.v.filter((n) => n && n.id && n.texto && !b[n.id]);
    if (junta) {
      const ids = new Set(lista.map((n) => n.id));
      lista = [...lista, ...notas().filter((n) => n && n.id && !ids.has(n.id) && !b[n.id] && (Number(n.t) || 0) > desde)];
      // de lo que corrige al motor, de cada cosa (y de cada jugador) la última, como al apuntarlo
      const ult = new Map();
      for (const n of lista) if (n.corr) { const k = `${n.corr}|${n.pid || ''}`; if (!ult.has(k) || (Number(n.t) || 0) > (Number(ult.get(k).t) || 0)) ult.set(k, n); }
      lista = lista.filter((n) => !n.corr || ult.get(`${n.corr}|${n.pid || ''}`) === n).sort((x, y) => (Number(x.t) || 0) - (Number(y.t) || 0));
    }
    guardarBorradas(b);
    LS.set(K('notas'), lista.slice(-40)); LS.set(K('notas-t'), junta ? Date.now() : d.t);
    return true;
  }
  if (clave === 'hechos') {
    const tLoc = Number(LS.get(K('hechos-t'), 0)) || 0;
    const junta = desde != null && tLoc > desde && d.t > desde;
    if (typeof d.v !== 'object' || Array.isArray(d.v) || (!junta && d.t <= tLoc)) return false;
    let v = d.v;
    if (junta) { v = { ...d.v }; for (const [k, x] of Object.entries(LS.get(K('hechos'), {}) || {})) if (x && (!v[k] || (Number(x.t) || 0) > (Number(v[k].t) || 0))) v[k] = x; }
    LS.set(K('hechos'), v); LS.set(K('hechos-t'), junta ? Date.now() : d.t);
    return true;
  }
  return false;
}
/** al parar una pregunta, se quita del chat (para poder hacerla otra vez o cambiarla) */
export function quitarUltimaPregunta(t) {
  const h = conversacion();
  if (h.length && h[h.length - 1].r === 'yo' && h[h.length - 1].t === t) { h.pop(); guardarChat(h); }
}
export const borrarConversacion = () => guardarChat([]);
/** sin IndexedDB, la miniatura vuelve dentro del mensaje del chat (como antes de la 0.7z) */
function reponerMini(id, mini) {
  const h = conversacion();
  let cambia = false;
  for (const m of h) for (const f of m.fotos || []) if (f.id === id && !f.mini) { f.mini = mini; cambia = true; }
  if (cambia) guardarChat(h);
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
  if (await pasar(h)) guardarChat(h);
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
export function nuevoChat() { const ok = archivar(); guardarChat([]); return ok; }
/** vuelve a un chat anterior (el de ahora se guarda) */
export function recuperarChat(i) {
  const l = chatsAnteriores();
  const c = l[i];
  if (!c) return false;
  l.splice(i, 1);
  guardarAnteriores(l);
  archivar();
  guardarChat(c.msgs || []);
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

/* ---------------- la oferta que le cuentan (22 nov, Domy, por audio) ----------------
   «Le doy los datos de una oferta y siempre dice que no, que no la ve dentro de la aplicación. ¡Pero te estoy diciendo
   que me ofrece esto!» Lo que se habla por WhatsApp o de palabra no sale en LaLiga: si el mánager cuenta que le ofrecen
   algo, es un hecho. A la IA se le dice que la valore con sus cifras, y si aun así contesta que no la ve, esa frase se quita. */
const OFERTA_DICHA = /\bme (ofrece|ofrecen|ha ofrecido|han ofrecido|ofrecio|ofrecieron|da|dan|daria|darian|paga|pagan|pagaria|propone|proponen|ha propuesto|han propuesto|quiere dar|quieren dar|quiere comprar|quieren comprar|compra|compran)\b|\b(tengo|me ha llegado|me llega|me ha hecho|me han hecho|me hace) (una |la )?(oferta|propuesta)\b|\bme ha dicho que me (da|paga|ofrece|compra)\b/;
/* (repaso de la 0.8s, 22 nov) «LaLiga me da 15 M por X»: si LaLiga YA le da una cifra, el jugador ya está en venta aunque los
   datos aún no lo traigan, y esa oferta está hecha. Los datos de vender o quedárselo decían «su oferta llega en el siguiente
   cambio de mercado» y en 1 o 2 de cada 4 respuestas la IA contestaba que la oferta llegaba mañana o que la pusiera a la
   venta. Ahora esa línea dice que ya la tiene (`ventasMiasTxt`, `laligaYa`) y la app quita de la respuesta lo que lo niegue. */
export const laligaYaDa = (pregunta) => { const q = norm(pregunta || ''); return /\b(laliga|la liga)\b/.test(q) && /\b(me|le) (da|dan|ofrece|ofrecen|paga|pagan|ha ofrecido|ofrecio|esta dando|esta ofreciendo)\b/.test(q) && /\d/.test(q) && !/^(que|cuanto) me (da|ofrece)\b/.test(q); };
const LLEGA_MANANA = /\b(aun|todavia) no (es|son) (dinero|una oferta|real)\b|\b(su|la|esa) oferta (real |de laliga |buena )?(llega|llegara|te llega|te llegara|no llega|vendra|sale)\b|\bponlo (ya |hoy )?(a|en) (la )?venta\b|\b(si|cuando) (lo )?pones? (ya |hoy )?(a|en) (la )?venta\b|\bsi (esos|esa|los|las|estos|esta) [^.!?]{0,40}\b(ya )?(son|es) (una )?oferta\b|\bpara que (la oferta|laliga) (te )?(llegue|haga|ofrezca)\b/;
/** quita de la respuesta lo que dice que la oferta de LaLiga aún no está o llega mañana, cuando él dice que ya se la dan */
export const sinLlegaManana = (texto) => sinNoLaVeo(texto, LLEGA_MANANA);
/** ¿su mensaje cuenta una oferta o un trato que le han hecho? (no vale preguntar «¿qué me ofrecen?») */
export const cuentaOferta = (pregunta) => { const q = norm(pregunta || ''); return OFERTA_DICHA.test(q) && !/^(que|cuanto|quien) me (ofrece|ofrecen|da|dan)\b/.test(q); };
const NO_LA_VEO = /\bno (la |lo |me |te |se )?(veo|aparece|consta|sale|figura|tengo|encuentro)\b[^.!?]{0,90}\b(oferta|trato|propuesta)\b|\b(oferta|trato|propuesta)\b[^.!?]{0,70}\bno (la )?(veo|aparece|consta|sale|figura|esta)\b|\bno (veo|aparece|consta|figura)\b[^.!?]{0,60}\b(en los datos|en la app|en la aplicacion|en laliga|en tu cuenta)\b|\bno hay (ninguna|esa|tal) oferta\b|\bno cuenta como (una )?oferta\b/;
/** quita de la respuesta las frases que dicen que no ve esa oferta. Devuelve { texto, quitadas } */
export function sinNoLaVeo(texto, re = NO_LA_VEO) {
  const [cuerpo, ...resto] = String(texto || '').split(/\n\n(?=\*\*Revisado por la app:\*\*)/);
  let quitadas = 0;
  const t = cuerpo.split(/\n{2,}/).map((p) => p.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«*-])/).filter((f) => { const fuera = re.test(norm(f)); if (fuera) quitadas++; return !fuera; }).join(' ')).filter((p) => p.trim()).join('\n\n');
  // (si se quedaba sin nada que decir, se deja como llegó: mejor eso que una respuesta vacía)
  if (!quitadas || t.replace(/\s+/g, ' ').trim().length < 60) return { texto, quitadas: 0 };
  return { texto: [t, ...resto].join('\n\n'), quitadas };
}

/* ---------------- el dinero de un rival, cerrado (22 nov, Carlos) ----------------
   «Si alguien pregunta cuánto dinero tiene X rival y no lo ha desbloqueado viendo el anuncio, que no se lo diga.» La cifra
   ya no le llegaba a la IA (solo «mucho», «algo», «poco»), pero a la pregunta directa contestaba con eso mismo («tiene un
   saldo medio», «está en el tramo de algo»): es decirlo a medias. Ahora, si pregunta por el dinero de un rival que tiene
   cerrado, a la IA se le dice que no dé ni la categoría, y la app quita de la respuesta lo que hable de ese dinero. */
const DINERO_RE = /\bquien(es)? (me |te |le )?(puede|pueden|podria|podrian) (pagar|clausular)\w*|\b(dinero|saldo|pasta|presupuesto|liquidez|banco|caja|millones tiene|cuanto (dinero )?(tiene|tienen|le queda|les queda|maneja|manejan)|cuanto puede(n)? gastar|rico|ricos|pobre|pobres|forrad[oa]s?|tieso|tiesos)\b/;
/** los rivales por cuyo dinero pregunta y que tiene cerrado: [{ tid, nombre }] (vacío si no pregunta por eso) */
export const dineroCerradoDe = (pregunta, D, M, antes = '') => dineroPreguntado(pregunta, D, M, antes).cerrados;
/** { cerrados, abiertos }: los rivales por cuyo dinero pregunta, según lo tenga cerrado o abierto (viendo sus anuncios) */
export function dineroPreguntado(pregunta, D, M, antes = '') {
  const q = norm(pregunta || '');
  if (!q || !DINERO_RE.test(q) || !bloqueada('dineroRivales')) return { cerrados: [], abiertos: [] };
  // (repaso de la 0.8s) «¿quién me puede pagar la cláusula de X?» es preguntar por su dinero, salvo que tenga abierto quién paga
  if (/\bquien(es)? (me |te |le )?(puede|pueden|podria|podrian) (pagar|clausular)/.test(q) && !/\b(dinero|saldo|pasta)\b/.test(q) && !bloqueada('quienPaga')) return { cerrados: [], abiertos: [] };
  const yo = D.yo && D.yo.teamId;
  let tids = [...rivalesEn(pregunta, D, M)];
  if (!tids.length) tids = [...rivalesAprox(pregunta, D, M)];
  // «¿y cuánto dinero tiene?»: el rival del que venía hablando
  if (!tids.length && /\b(tiene|le queda|maneja|su)\b/.test(q) && !/\b(tengo|me queda|mi saldo|mi dinero)\b/.test(q) && antes) tids = [...rivalesEn(antes, D, M)];
  // «el dinero de los rivales», «quién tiene más dinero»: todos
  if (!tids.length && /\b(rival|rivales|los demas|cada uno|todos|la liga|quien)\b/.test(q)) tids = (M.rivales || []).map((r) => String(r.e.teamId));
  const de = (cerrado) => tids.filter((t) => String(t) !== String(yo) && bloqueada('dineroRivales', t) === cerrado).map((t) => ({ tid: String(t), nombre: nombreTid(M, t) }));
  return { cerrados: de(true), abiertos: de(false) };
}
// (25 nov) en el iPhone no hay Google Play: el dinero de un rival se abre invitando a un amigo (2 rivales por amigo)
const comoSeAbre = () => (topConAnuncio() ? 'se abre en Rivales, tocando su candado y viendo unos anuncios cortos' : enIPhone ? 'en el iPhone se abre invitando a un amigo, con el botón Invitar de arriba' : 'se abre viendo un anuncio en la app de Google Play');
const HABLA_DINERO = /\b(dinero|saldo|pasta|presupuesto|liquidez|banco)\b/;
const CUANTO_DINERO = /\d[\d.,]*\s?(m\b|millones|mil\b|k\b)|\b(mucho|muchisimo|poco|poquisimo|algo|medio|media|bastante|de sobra|le sobra|les sobra|justo|justito|apretad\w*|tramo|margen|holgad\w*|limitad\w*|escaso|alto|bajo|rico|pobre|mas que|menos que|por debajo|por encima|de los que mas|de los que menos|el que mas|el que menos|le da para|le llega|no le llega|en negativo)\b/;
const MIO_DINERO = /\b(tu saldo|tu dinero|tu caja|tienes|te queda|te quedan|te llega|te falta|te faltan)\b/;
// (repaso de la 0.8s) lo que lo cuenta sin decir «dinero»: «ha gastado 34 M, así que no le sobra tanto como para pujar fuerte»
const SOBRA_DINERO = /\btienen? (el )?(dinero|saldo|pasta) (para|suficiente)\b|\b(nadie|ningun rival|ninguno)\b[^.]{0,40}\b(dinero|saldo|pasta)\b|\b(no )?le (sobra|sobran|alcanza|da para|queda (poco|mucho|bastante))\b|\b(anda|va|esta|ira) (justo|justito|apretado|corto|tieso|sobrado|forrado|pelado)\b|\b(no )?puede (pujar|gastar|pagar|fichar) (fuerte|mucho|poco|lo que quiera)\b/;
/**
 * Quita de una respuesta las frases que cuentan el dinero de un rival que tiene cerrado (cifra o «mucho/algo/poco»), cuando
 * preguntaba por eso. Devuelve { texto, quitadas }. Si no queda nada que diga cómo se abre, lo añade.
 */
export function sinDineroCerrado(texto, cerrados) {
  if (!cerrados || !cerrados.length || !texto) return { texto, quitadas: 0 };
  const [cuerpo, ...resto] = String(texto).split(/\n\n(?=\*\*Revisado por la app:\*\*)/);
  let quitadas = 0;
  const parrafos = cuerpo.split(/\n{2,}/).map((p) => p.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«*-])/).filter((f) => {
    // (una frase que lo cuenta y además habla del candado se va entera: lo del candado se repone abajo, limpio)
    const n = norm(f);
    const fuera = ((HABLA_DINERO.test(n) && CUANTO_DINERO.test(n)) || SOBRA_DINERO.test(n)) && !MIO_DINERO.test(n);
    if (fuera) quitadas++;
    return !fuera;
  }).join(' ')).filter((p) => p.trim());
  let t = parrafos.join('\n\n');
  const quien = cerrados.length === 1 ? `El dinero de ${cerrados[0].nombre}` : 'El dinero de esos rivales';
  // (si ya dice que está cerrado, solo falta cómo se abre; si no, la frase entera, lo primero)
  if (!/candado|anuncio/.test(norm(t))) t = /cerrad|bloquead/.test(norm(t)) ? `${t}\n\nEso ${comoSeAbre()}.` : `${quien} está cerrado en tu cuenta: ${comoSeAbre()}.${t ? `\n\n${t}` : ''}`;
  return { texto: [t, ...resto].join('\n\n'), quitadas };
}

/** pregunta en el chat; alTexto(texto) se llama según va llegando la respuesta */
// Lo que se apunta, SOLO lo que él cuenta como hecho o como decidido. El 7 nov apuntó dos veces «rechazó el trueque»
// cuando Carlos solo preguntaba y luego estaba negociando: además de decírselo, aplicarNotas lo comprueba.

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
export function aplicarNotas(texto, D, pregunta = null, conFotos = false, M = null) {
  // (16 nov) el bloque también sin sus comillas («notas» y el JSON debajo: se quedaba a la vista) y sin los códigos de
  // operación que la IA copia de los datos («Operación M-3143»)
  const sep = separarNotas(texto);
  const limpio = sep.texto;
  if (!sep.bloque) return { texto: limpio, apuntadas: [], olvidadas: 0, recomiendo: [] };
  let j = null;
  try { j = JSON.parse(sep.bloque); } catch (e) { j = sacarJSON(sep.bloque); }
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
  // (22 nov) lo que acaba de decir y ya ha apuntado la app (apuntarDicho): la IA no lo apunta otra vez. Y lo que dijo sin
  // nombrar al jugador («a ese no lo vendo»): si la nota de la IA dice a quién, y a ese se le puede aplicar, manda
  const recientes = deEstaPregunta(DICHO_AHORA, pregunta) ? notas().filter((n) => DICHO_AHORA.ids.includes(n.id)) : [];
  const pend = M && deEstaPregunta(PENDIENTE, pregunta) ? PENDIENTE.lista : [];
  const dichas = [];
  for (const a of j.apuntar || []) {
    if (!a || !a.texto) continue;
    const pidA = a.jugador ? pidDe(a.jugador, D) : null;
    const k = pend.findIndex((x) => valeDicho(x.corr, pidA, D, M));
    if (k >= 0) { const x = pend.splice(k, 1)[0]; dichas.push(notaDicho(x.corr, pidA, D, M, { importe: x.importe })); continue; }
    if (recientes.some((n) => (n.pid ? n.pid === pidA : /blind|escud/i.test(a.texto)))) continue;
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
  if (dichas.length) apuntadas.push(...guardarDicho(dichas));
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

/**
 * las cuentas de los jugadores que nombra, hechas: valores, cláusulas, diferencias y quién puede pagar cada cláusula.
 * El 7 nov la IA dio «Berenguer + 33-35 M» y luego «+ 26 M», y sumó «107 + 35 = 75»: si las cifras le llegan hechas,
 * no se las inventa.
 */
export function cuentasTxt(D, M, js, { web = true, trato = null } = {}) {
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
  // (19 nov) con un trato con precios, las cuentas del cambio las hace M.trato (van en «LA APP, EL TRATO»): las de aquí,
  // a sus valores, le hacían proponer «cambio a valores»
  const enTrato = (j) => !!trato && [...trato.mios, ...trato.suyos].some((x) => x.pid === j.id);
  for (const a of mios) for (const b of suyos) {
    if (enTrato(a.j) && enTrato(b.j)) continue;
    const dif = a.j.valor - b.j.valor;
    // un cambio entre managers son DOS COMPRAS, cada una a su valor (Carlos, 8 nov: «yo compro una cosa que vale 28 M por
    // 28 M y él una que vale 55 M por 55 M; nos quedamos igual, nadie pierde valor»). La IA lo contaba como un cambio sin
    // dinero y repetía que le regalaba 26 M: lo que decide es quién va a subir más y quién da más puntos
    L.push(`- CAMBIO DE ${a.j.nombre.toUpperCase()} POR ${b.j.nombre.toUpperCase()}: en esta liga un cambio entre managers son DOS COMPRAS, cada una a su valor salvo que acuerden otros precios: yo le compro ${b.j.nombre} por ${eur(b.j.valor)} y él me compra ${a.j.nombre} por ${eur(a.j.valor)}. Acabo con ${b.j.nombre} y mi saldo ${dif >= 0 ? 'sube' : 'baja'} ${eur(Math.abs(dif))} (${eur(a.j.valor)} − ${eur(b.j.valor)}; de ${eur(num(D.dinero))} a ${eur(num(D.dinero) + dif)}). NADIE PIERDE VALOR: nunca digas que regalo, pierdo o le doy la diferencia. (Solo si el manager dice expresamente que es sin dinero de por medio sería otra cosa.) Lo que decide si me conviene es quién de los dos va a SUBIR MÁS de valor a partir de ahora y quién me dará MÁS PUNTOS: compara su tendencia (hoy, 7 días, inercia), su estado (lesión, duda, sanción), su forma, sus próximos partidos y el parón, ${web ? 'y busca en Google noticias de los dos si alguno está tocado' : 'y, si alguno está tocado, dilo con lo que sale en los datos'}.`);
    if (a.cl && a.cl.clausula) {
      const r = (M.rivales || []).find((y) => y.e.teamId === b.tid);
      const din = r && r.dinero && r.dinero.v != null ? r.dinero.v : null;
      if (din != null) L.push(`- La cláusula de ${a.j.nombre} (${eur(a.cl.clausula)}) ${din >= a.cl.clausula ? `SÍ le llega a ${nombreTid(M, b.tid)} (${bloqueada('dineroRivales', b.tid) ? (din >= a.cl.clausula * 1.2 ? 'le sobra' : 'justo') : `tiene ${r.dinero.exacto ? '' : '≈ '}${eur(din)}`}): ${a.cl.abierta ? 'se lo puede llevar ya' : `se lo puede llevar ${cuandoF(a.cl.protegidoHasta)}, en el mismo minuto en que se abra, sin negociar nada y quizá antes de que me dé tiempo a blindarlo. Eso pesa en cualquier negociación con él: no va a pagar mucho más que la cláusula. Si se lo lleva así, cobro yo los ${eur(a.cl.clausula)}${a.cl.clausula > b.j.valor ? ` (más de lo que vale ${b.j.nombre})` : ""}`}` : `no le llega a ${nombreTid(M, b.tid)}${bloqueada('dineroRivales') ? '' : ` (tiene ${r.dinero.exacto ? '' : '≈ '}${eur(din)})`}`}.`);
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

/* ---------------- ¿lo vendo o me lo quedo? (20 nov, el chat de Carlos y la queja de Fran) ----------------
   A «¿me renta vender a Valverde, Natan, Nico y Zabiri si me dan más que su cláusula, o me los quedo y sigo especulando?
   ¿A LaLiga o a un rival, y por cuánto?» la IA contestó «a LaLiga no le sacas más que su cláusula» (mezclaba la oferta de
   LaLiga con la cláusula), sin la tendencia de ninguno ni el precio para un rival. Las cuentas las hace M.ventaMia y aquí
   van con su veredicto, como las ofertas y los tratos. */
const VENDE_RE = /\b(vend\w*|vendo|quedo|quedarme\w*|quedar\w*|especul\w*|renta\w*|traspas\w*|me dan|me ofrec\w*|me pagan|cuanto pido|cuanto le pido|deshac\w*|liquid\w*|sacar dinero|hacer caja|clausul\w* a su valor|me lo clausul\w*)\b/;
/** ¿la pregunta (o la conversación) va de vender jugadores suyos? */
export const vaDeVender = (t) => VENDE_RE.test(norm(t || ''));
/** los suyos que mirar si no nombra a nadie: los que la app vendería o protegería primero (como mucho 4) */
export function vendiblesMios(M, n = 4) {
  // (24 nov) por la decisión de cada uno (decide.js): primero los que se venden, luego los que hay que proteger y los que están en venta
  const peso = (x, y) => { const d = M.decision ? M.decision(x.pid) : null; return d && d.accion === 'vender' ? 0 : y.veredicto === 'proteger' ? 1 : d && d.enVenta ? 2 : y.veredicto === 'da-igual' ? 3 : y.presa ? 4 : 9; };
  return (M.mias || []).map((x) => { const y = M.ventaMia && M.ventaMia(x); return y ? { y, p: peso(x, y) } : null; }).filter((z) => z && z.p < 9)
    .sort((a, b) => a.p - b.p || b.y.v - a.y.v).slice(0, n).map((z) => z.y.j);
}
export function ventasMiasTxt(D, M, js, c = null, { laligaYa = false } = {}) {
  const yo = D.yo && D.yo.teamId;
  const L = [];
  const V = (() => { try { return veredictos(D, M); } catch (e) { return {}; } })();
  // lo que hace con cada uno el plan que ve en Hoy (venderlo, o mirarlo y aguantarlo): manda, para que no digan cosas distintas
  let opsPlan = [], mirados = new Map();
  try {
    const Rp = planQueVe(D, M, c);
    opsPlan = Rp ? (Rp.motorHoy ? Rp.ops : cuadrarPlan(Rp, D, M).ops) || [] : [];
    const Rm = planDeHoy(D, M, c);
    mirados = new Map(((Rm && Rm.descartes) || []).map((d) => [String(d.pid), String(d.detalle || d.motivo || '')]));
  } catch (e) { opsPlan = []; }
  const sinDias = bloqueada('inercia');
  const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  for (const j of js || []) {
    if (!j || M.dueno[j.id] !== yo) continue;
    const x = (M.mias || []).find((y) => y.pid === j.id);
    const y = x && M.ventaMia ? M.ventaMia(x) : null;
    if (!y) continue;
    const t = M.tend(j.id) || {};
    const pz = M.partidazo ? M.partidazo(j.id) : null;
    // la tendencia: lo de hoy y lo que se espera en 7 días (sin la inercia abierta, solo lo de la última semana)
    const futuro = !sinDias && y.p7 != null ? `si sigue la tendencia, en 7 días ${eur(y.p7, { signo: true })}` : '';
    const tend = [y.hoy != null ? `hoy ${eur(y.hoy, { signo: true })}` : '', t.d7 != null ? `última semana ${eur(t.d7, { signo: true })}` : '', futuro].filter(Boolean).join('; ') || 'sin datos de los últimos días';
    const ojoPz = pz && pz.nivel && y.baja ? `; OJO: acaba de hacer ${pz.pts} pts (J${pz.n}), puede frenar la bajada` : '';
    const opV = opsPlan.find((o) => !o.descartada && !o.sugerencia && o.accion === 'vender' && String(o.pid || (o.j && o.j.id)) === String(j.id));
    const venV = V[`V-${j.id}`] || null;
    const noHoy = venV && !venV.ok && venV.aviso ? cortar(venV.aviso, 160) : y.espera && ['juega', 'sube'].includes(y.espera.tipo) ? cortar(y.espera.texto, 160) : '';
    const sube7 = futuro ? ` (${futuro.replace('si sigue la tendencia, ', '')})` : '';
    /* (24 nov, decide.js) LA DECISIÓN es la del jugador, la misma que dicen Hoy, Equipo y los avisos. Antes este bloque
       sacaba su propio veredicto de `M.ventaMia` (que no mira si es titular ni la oferta que tiene) y le decía a la IA
       «VENDER» de uno que Hoy mandaba aguantar (aviso de Senna). De `M.ventaMia` quedan las cuentas y cómo protegerlo */
    const d = M.decision ? M.decision(j.id) : null;
    const venta = (M.misVentas || []).find((v) => v.pid === j.id);
    const mejor = venta && venta.ofertas && venta.ofertas[0];
    const quien = mejor ? (mejor.de || (mejor.deLiga ? 'LaLiga' : 'un rival')) : '';
    const nv = M.noVender && M.noVender.get(j.id);
    // (repaso del 24 nov) «protegerlo» solo si es lo que dice Hoy (el blindaje de «Ahora mismo» o el del plan): antes aquí
    // salía «blíndalo ya» de uno en venta que ni el plan ni Equipo blindaban, y «súbele la cláusula» junto a «no compensa»
    const accP = (M.acciones || []).find((a) => String(a.pid) === String(j.id) && ['escudo', 'blindar'].includes(a.tipo));
    const opB = opsPlan.find((o) => !o.descartada && o.accion === 'blindar' && String(o.pid) === String(j.id));
    const protege = !!(accP || opB) && !x.noBlindar;
    let ver = !d ? y.veredicto : d.accion === 'vender' ? 'vender' : y.veredicto === 'proteger' && (protege || !y.proteger || !['escudo', 'subir'].includes(y.proteger.como)) && !x.noBlindar && d.regla !== 'dicho' ? 'proteger' : 'aguantar';
    let motivo = d ? d.porque.replace(/[.\s]+$/, '') : '';
    if (opV && d && d.accion === 'vender') motivo += `. Está en el plan de hoy${opV.cuando ? ` (${opV.cuando})` : ''}`;
    if (ver === 'proteger') motivo = `sube${sube7} y su cláusula ${y.abierta ? 'está abierta' : `se abre ${cuandoF(y.abre)}`} cerca de su valor, con rivales a los que les llega: si te lo clausulan, se llevan a precio de mercado lo que iba a subir`;
    if (ver === 'vender' && y.pts >= 3 && d && d.matiz !== 'con-recambio') motivo += `. En tu once pesa (${d1(y.pts)} pts por jornada sin él): mira con qué lo repones`;
    // (22 nov) «a este no lo vendo», dicho en Pregunta: manda sobre todo lo demás
    if (nv) { ver = 'dicho'; motivo = `me dijo él que no lo vende (${cuando(nv.t)}${nv.caduca ? `; vale hasta ${cuando(nv.caduca, { hora: false })}` : ''}) y la app no lo pone en ningún plan ni aviso de venta. No le propongas venderlo; si ahora pregunta por venderlo, dale las cifras y dile que eso lo quita él en Hoy, en «Lo que me has dicho»`; }
    const of = mejor ? eur(mejor.importe) : '';
    const VER = ver === 'dicho' ? 'NO SE VENDE (LO HA DICHO ÉL)'
      : ver === 'proteger' ? `AGUANTAR Y PROTEGERLO${mejor ? ` (NO ACEPTAR LA OFERTA DE ${of})` : ''}`
        : ver === 'vender' ? ({ acepta: `VENDER: ACEPTAR LA OFERTA DE ${of}`, 'esta-oferta-no': `VENDER, PERO ESTA OFERTA NO (${of})`, 'espera-oferta': 'VENDER: YA ESTÁ A LA VENTA, ESPERAR LA OFERTA', 'con-recambio': 'VENDER CUANDO TENGA AL RECAMBIO', 'antes-del-giro': 'VENDER ANTES DE QUE GIRE', 'otro-dia': 'VENDER, PERO HOY NO', 'por-dinero': 'VENDER: HACE FALTA EL DINERO' }[d ? d.matiz : ''] || (noHoy && !opV ? 'VENDER, PERO NO HOY' : 'VENDER'))
          : !d ? 'AGUANTAR' : mejor ? `AGUANTAR: NO ACEPTAR LA OFERTA DE ${of}` : d.matiz === 'busca-sustituto' ? 'AGUANTAR Y BUSCARLE SUSTITUTO' : d.regla === 'resto' && !d.matiz && y.pts < 1 && !y.sube ? 'AGUANTAR: VENDERLO SOLO SI LE PAGAN BIEN' : 'AGUANTAR';
    const P = y.proteger;
    const como = ver === 'vender' && d && ['acepta', 'con-recambio', 'otro-dia'].includes(d.matiz) ? ''
      : ver === 'vender'
        ? ` Al momento, a un rival que te pague ${eur(y.rival.piso)} o más; si no, ${venta ? 'sigue a la venta' : 'a la venta'} para la ${mejor ? 'siguiente ' : ''}oferta de LaLiga.${noHoy && !opV && !(d && d.matiz) ? ` Cuándo: ${noHoy}` : ''}`
      : ver === 'proteger' && P
        ? ` ${P.como === 'ya' ? 'Ya lo tienes blindado.' : P.como === 'escudo' ? 'Blíndalo ya con el escudo (gratis, 24 h).' : P.como === 'escudo-al-abrir' ? `Blíndalo con el escudo en cuanto se abra (${cuandoF(y.abre)}): antes no se puede.` : P.como === 'subir' && !(x.blindaje && x.blindaje.caro) && (opB ? !!opB.importe : accP && accP.tipo === 'blindar') ? `Súbele la cláusula a ${eur(P.objetivo)} (cuesta ${eur(P.coste)}, menos de lo que va a subir).` : P.como === 'subir' ? 'Blíndalo con el escudo gratis si te queda; pagar por subirle la cláusula no compensa.' : `Protegerlo pagando no compensa${P.coste ? ` (subirle la cláusula cuesta ${eur(P.coste)}, más de lo que va a subir)` : ''}.`} Si no, véndeselo antes a un rival por ${eur(y.rival.techo)} o cerca.`
        : '';
    // (repaso de la 0.8s) si dice que LaLiga YA le da una cifra, la oferta está hecha: lo que esperaría la app es la de mañana
    // (24 nov, Senna) con la oferta de LaLiga ya hecha, la línea lo dice (antes: «su oferta llega en el siguiente cambio…»)
    const ofLiga = venta && (venta.ofertas || []).find((o) => o.deLiga);
    const sig = d && d.cifras && d.cifras.esperado ? d.cifras.esperado : y.liga.v;
    const liga = ofLiga ? `LALIGA: YA LE HA HECHO SU OFERTA, ${eur(ofLiga.importe)} (${pct(ofLiga.sobre * 100)} sobre su valor): se cobra al aceptarla, hoy. Si no la acepta, le hará otra en el siguiente cambio de mercado${y.liga.cuando ? ` (${cuandoF(y.liga.cuando)})` : ''}, entre ${eur(y.liga.una.min)} y ${eur(y.liga.una.max)} (de −10 % a +10 % de su valor, a suerte; las que se aceptan en su liga rondan ${pct(y.liga.med * 100)})`
      : laligaYa && !mejor ? `LALIGA: ÉL DICE QUE YA LE OFRECE LA CIFRA DE SU MENSAJE: lo tiene en venta (los datos van por detrás) y esa oferta está hecha y se cobra al aceptarla, hoy. Compárala con su valor (${eur(y.v)}) y su tendencia. Si no la acepta, LaLiga le hará otra en el siguiente cambio de mercado${y.liga.cuando ? ` (${cuandoF(y.liga.cuando)})` : ''}, entre ${eur(y.liga.una.min)} y ${eur(y.liga.una.max)} (de −10 % a +10 % de su valor, a suerte). NO le digas que la oferta llega mañana, que aún no es dinero ni que lo ponga a la venta` : `LALIGA: su oferta llega en el siguiente cambio de mercado${y.liga.cuando ? ` (${cuandoF(y.liga.cuando)})` : ''}, no al momento; puede ser de entre ${eur(y.liga.una.min)} y ${eur(y.liga.una.max)} (de −10 % a +10 % de su valor, a suerte; no des una cifra fija); si sale floja, se rechaza y en el siguiente cambio de mercado hace otra${y.liga.sinDatos ? '' : `; esperando a una buena, en su liga se acaba sacando unos ${eur(y.liga.v)}`}`;
    const cl = !y.clausula ? 'CLÁUSULA: no la sé' : `CLÁUSULA ${eur(y.clausula)} (${y.sobre != null && y.sobre <= 0.03 ? 'A SU VALOR' : y.sobre != null ? `${pct(y.sobre * 100, 0)} sobre su valor` : '?'}), ${y.abierta ? 'ABIERTA' : y.veda ? `cerrada hasta que empiece la jornada (${cuandoF(y.abre)})` : `se abre ${cuandoF(y.abre)}`}; ${paganTxt(x.pagan) || 'no se sabe a quién le llega'}. Es lo que cobras si un rival te lo quita, no lo que da LaLiga`;
    const riv = y.rival.corto
      ? `A UN RIVAL (cobras al momento): no le saques más que lo de LaLiga, ≈ ${eur(y.rival.piso)}`
      : `A UN RIVAL (cobras al momento): pídele entre ${eur(y.rival.piso)} y ${eur(y.rival.techo)}${y.clausula && y.rival.techo >= y.clausula * 0.995 ? '; más que su cláusula no te paga quien se la puede pagar' : ''}`;
    // la oferta que ya tiene, con su cifra (la de un rival o la de LaLiga)
    const ya = mejor ? ` | LA OFERTA QUE TIENE: ${quien}, ${eur(mejor.importe)}; la app aconseja ${venta.consejo === 'aceptar' ? 'ACEPTARLA' : 'NO ACEPTARLA'}` : '';
    const mas = `SI UN RIVAL TE DA MÁS DE ${eur(y.aceptarDesde)}: ${ver !== 'vender' && y.pts >= 3 ? `merece la pena si no lo necesitas en el once (${d1(y.pts)} pts por jornada)` : 'acéptalo: es más de lo que cobras si te lo clausulan'}`;
    L.push(`- ${j.nombre} (vale ${eur(y.v)}; TENDENCIA: ${y.baja ? 'BAJA' : y.sube ? 'SUBE' : 'NI SUBE NI BAJA de verdad'}; ${tend}${ojoPz}): LA DECISIÓN DE LA APP: ${VER}: ${motivo}.${como} | ${liga} | ${cl} | ${riv} | ${mas}${ya}`.replace(/…\./g, '…').replace(/\.\./g, '.'));
  }
  if (!L.length) return '';
  return `\n\nVENDER O QUEDÁRTELO, LAS CUENTAS DE LA APP (el dinero manda: el valor cambia una vez al día y sigue una tendencia; los puntos no se saben. Se pierde dinero vendiendo tarde uno que baja, pagando por subirle la cláusula a uno que baja y dejando que un rival se lleve a su valor uno que sube. La OFERTA DE LALIGA y la CLÁUSULA son cosas distintas: no las compares entre sí. LA DECISIÓN DE LA APP de cada uno es la misma que él ve en Hoy y en Equipo, y es tu respuesta: no la cambies ni digas otra distinta de la que pone. De cada jugador, una o dos frases: la decisión, su tendencia dicha con su palabra («sube», «baja» o «ni sube ni baja») y, si toca vender, a quién (LaLiga o un rival) y por cuánto, con estas cifras y sin rehacerlas):\n${L.join('\n')}`;
}

/* ---------------- un trato entre managers (19 nov, el trueque de Carlos con Domy) ----------------
   Se saca de la pregunta (o de sus últimos mensajes, o de un trato apuntado) qué jugadores entran y a qué precio («a su
   valor», «por 60 M», «un 4 % más»), lo calcula el motor (M.trato) y la IA lo recibe hecho, con su veredicto. */
const liso = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
const PALABRAS_TRATO = /\b(cambi\w*|trueque|truec\w*|intercambi\w*|me compra\w*|le compr\w*|le vend\w*|me vend\w*|a cambio|me ofrece\w*|me propone\w*|trato)\b/;
const IGUAL_TRATO = /\b(uno por otro|sin dinero|sin poner dinero|a pelo|cambio directo|sin pagar nada)\b/;
/** ¿dice que la cláusula del suyo no es una vía? («si no, me lo blinda», «se la sube») */
export const sinClausulaEn = (t) => /\b(blind\w*|se la sub\w*|la sub\w* la clausula|le sub\w* la clausula|sube la clausula|no es opcion|no puedo clausul\w*|clausular\w* no\b)/.test(liso(t));
/**
 * El trato que cuenta en un texto: { mios: [{ pid, precio }], suyos: [{ pid, precio }], igual, supuesto } o null.
 * Cada precio se le pone al jugador más cerca de él en la frase; sin precio, a su valor (supuesto: true).
 */
export function tratoEn(texto, D, M) {
  const l = ` ${liso(texto)} `;
  if (!PALABRAS_TRATO.test(l) && !IGUAL_TRATO.test(l)) return null;
  const yo = D.yo && D.yo.teamId;
  const js = jugadoresEn(texto, D).filter((j) => M.dueno[j.id]);
  const mios = js.filter((j) => M.dueno[j.id] === yo), otros = js.filter((j) => M.dueno[j.id] !== yo);
  if (!mios.length || !otros.length) return null;
  // los del rival que más sale (todos tienen que ser del mismo)
  const cuenta = {};
  for (const j of otros) cuenta[M.dueno[j.id]] = (cuenta[M.dueno[j.id]] || 0) + 1;
  const tid = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0];
  const suyos = otros.filter((j) => M.dueno[j.id] === tid);
  const todos = [...mios.slice(0, 2), ...suyos.slice(0, 2)];
  // dónde sale cada uno en el texto (por el nombre entero o por el apellido)
  const sitios = [];
  for (const j of todos) {
    const n = liso(j.nombre).replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/);
    for (const pat of [n.join('\\W+'), n.length > 1 && n[n.length - 1].length >= 4 ? n[n.length - 1] : null].filter(Boolean)) {
      const re = new RegExp(`(?<![a-z0-9])${pat}(?![a-z0-9])`, 'g');
      let m; while ((m = re.exec(l))) sitios.push({ j, i: m.index, f: m.index + m[0].length });
    }
  }
  // las cifras: «a su valor», «un 4 % más», «60 M» (fuera las del saldo, las cláusulas y lo que vale)
  const precios = [];
  const RE_VALOR = /\b(?:a|por|en)\s+(?:su|el)\s+valor(?:\s+de\s+mercado)?\b|\ba\s+valor(?:es)?(?:\s+de\s+mercado)?\b|\bpor\s+lo\s+que\s+vale\b|\b(?:a|al|por\s+el)\s+precio\s+de\s+mercado\b/g;
  const RE_PCT = /(?:un\s+)?(\d+(?:[.,]\d+)?)\s*%\s*(mas|menos|por encima|por debajo)/g;
  const RE_EUR = /(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:m\b|millones\b|mill\b|kilos\b|kk\b|€)/g;
  let m;
  while ((m = RE_VALOR.exec(l))) precios.push({ i: m.index, f: m.index + m[0].length, tipo: 'valor' });
  while ((m = RE_PCT.exec(l))) precios.push({ i: m.index, f: m.index + m[0].length, tipo: 'pct', x: parseFloat(m[1].replace(',', '.')) / 100 * (/menos|debajo/.test(m[2]) ? -1 : 1) });
  while ((m = RE_EUR.exec(l))) {
    const antes = l.slice(Math.max(0, m.index - 28), m.index), despues = l.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (/^\s*(?:de\s+)?saldo/.test(despues) || /(saldo|tengo|clausula|vale|valor|valia|cuesta|tiene|me quedan?|ahorrad\w*)\s*(?:de|en|a|es|son)?\s*(?:unos?\s*)?$/.test(antes)) continue;
    if (precios.some((p) => m.index >= p.i && m.index < p.f)) continue;
    precios.push({ i: m.index, f: m.index + m[0].length, tipo: 'eur', x: parseFloat(m[1].replace(/\.(?=\d{3}\b)/, '').replace(',', '.')) * 1e6 });
  }
  const precio = new Map();
  for (const p of precios.sort((a, b) => a.i - b.i)) {
    let mejor = null, dm = Infinity;
    for (const s of sitios) {
      // detrás del nombre cuenta un poco más («a Huijsen por 60 M») que delante («le pago 60 M por Huijsen»)
      const d = p.i >= s.f ? p.i - s.f : (s.i - p.f) * 1.4;
      if (d >= 0 && d < dm && d <= 70 && !precio.has(s.j.id)) { dm = d; mejor = s; }
    }
    if (!mejor) continue;
    const j = mejor.j;
    precio.set(j.id, p.tipo === 'valor' ? j.valor : p.tipo === 'pct' ? Math.round(j.valor * (1 + p.x) / 1e4) * 1e4 : p.x);
  }
  const igual = IGUAL_TRATO.test(l) && !precio.size;
  let supuesto = false;
  const conPrecio = (j) => { if (precio.has(j.id)) return precio.get(j.id); supuesto = true; return j.valor; };
  const sm = mios.slice(0, 2).map((j) => ({ pid: j.id, precio: conPrecio(j) })), ss = suyos.slice(0, 2).map((j) => ({ pid: j.id, precio: conPrecio(j) }));
  // uno por otro: los dos al mismo precio (el más bajo), así el saldo no se mueve
  if (igual) { const x = Math.min(...[...sm, ...ss].map((y) => y.precio)); if (sm.length === 1 && ss.length === 1) { sm[0].precio = x; ss[0].precio = x; } }
  return { mios: sm, suyos: ss, igual, supuesto: supuesto && !igual };
}
/* ---------------- una compra a otro mánager que él cuenta (24 nov, Carlos con Bernardo Silva) ----------------
   «Le compro a Fran a Bernardo Silva por precio de mercado para revenderlo»: el dueño se lo deja a ese precio (lo han hablado
   por WhatsApp) y la IA contestaba «el dueño no vende a su valor, hay que ofrecer 33,58 M» (la estimación de `ofertaDueno`,
   que aquí no pinta nada). Como con las ofertas que cuenta (22 nov): es un HECHO, y las cuentas las hace la app: lo que le
   daría LaLiga en el siguiente cambio de mercado, si le llega con el saldo (a otro mánager no se le paga con deuda), si le
   cabe en la plantilla, lo que suma a su once y si le falta gente en ese puesto. Con uno suyo en el mensaje es un trato (`tratoEn`) */
const COMPRA_DICHA = /\b(le compr\w*|se lo compr\w*|lo compr\w*|compr\w* a\b|me (?:lo |la |los )?(?:vend|dej|ofrec|pon|pas)\w*|lo (?:deja|vende|ofrece|pone)\b|me lo quedo)/;
export function compraContada(pregunta, D, M, antes = '') {
  const yo = D.yo && D.yo.teamId;
  const l = ` ${liso(pregunta)} `;
  if (!COMPRA_DICHA.test(l)) return null;
  const de = (t) => jugadoresEn(t, D).filter((j) => M.dueno[j.id]);
  let js = de(pregunta);
  // «pero si lo compro por precio de mercado…»: el jugador viene de sus mensajes de antes
  if (!js.length && antes) js = de(antes);
  if (js.some((j) => M.dueno[j.id] === yo)) return null;
  const suyos = js.filter((j) => M.dueno[j.id] !== yo);
  if (suyos.length !== 1) return null;
  const j = suyos[0];
  let precio = null, como = '';
  const eurM = /(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:m\b|millones\b|mill\b|kilos\b|kk\b)/.exec(l);
  const pctM = /(?:un\s+)?(\d+(?:[.,]\d+)?)\s*%\s*(mas|menos|por encima|por debajo)/.exec(l);
  if (eurM && !/(saldo|tengo|clausula|vale|valor|valia|me quedan?)\s*(?:de|en|a|es|son)?\s*(?:unos?\s*)?$/.test(l.slice(Math.max(0, eurM.index - 28), eurM.index))) { precio = parseFloat(eurM[1].replace(',', '.')) * 1e6; como = `por ${eur(precio)}`; }
  else if (pctM) { precio = Math.round(j.valor * (1 + parseFloat(pctM[1].replace(',', '.')) / 100 * (/menos|debajo/.test(pctM[2]) ? -1 : 1)) / 1e4) * 1e4; como = `un ${pctM[1]} % ${pctM[2]} de su valor`; }
  else if (/\b(?:a|por|en|al)\s+(?:(?:su|el)\s+)?(?:valor|precio)(?:\s+de)?(?:\s+mercado)?\b|\bpor lo que vale\b|\ba mercado\b/.test(l)) { precio = j.valor; como = 'a su valor de mercado'; }
  if (!precio || precio < j.valor * 0.5 || precio > j.valor * 3) return null;
  return { pid: j.id, precio, como };
}
export function compraTxt(D, M, C) {
  const j = M.J(C.pid);
  if (!j) return '';
  const tid = M.dueno[j.id], riv = (M.rivales || []).find((r) => r.e && r.e.teamId === tid), dueno = riv ? (riv.e.manager || riv.e.nombre) : 'su dueño';
  const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  // lo que se espera que cambie mañana y cada día de los siguientes (la inercia; sin ella, lo de hoy)
  const ine = M.inercia(j.id), hoyD = ine ? num(ine.ult) : num((M.tend(j.id) || {}).d1);
  const dia = ine && ine.proy ? num(ine.proy(1)) : hoyD;
  /* (24 nov, Fran: «se cree que la liga da un 7 %; puede dar de −10 a +10») revenderlo a LaLiga: cada oferta va de −10 % a
     +10 % de lo que valga ese día, a suerte, y la de ayer ya no está cuando llega la de hoy. Aceptando la primera, de media
     se saca lo que vale; lo que da dinero es poder rechazar las flojas: con 3 cambios de mercado por delante, un +3,9 % de
     media con el valor quieto (`M.esperarOferta`, que ya cuenta lo que sube o baja cada día mientras se espera) */
  const RL = M.RANGO_LIGA || 0.1, N_ESPERA = 3;
  const v1 = Math.max(1, j.valor + dia);
  const una = { min: Math.round(v1 * (1 - RL) / 1e4) * 1e4, max: Math.round(v1 * (1 + RL) / 1e4) * 1e4 };
  const sigue = ine && ine.proy ? (num(ine.proy(N_ESPERA)) - dia) / (N_ESPERA - 1) : dia;
  const E = M.esperarOferta ? M.esperarOferta(N_ESPERA, sigue / v1) : { gana: 0.039, corte: 0.025 };
  const gana = Math.round((v1 * (1 + E.gana) - C.precio) / 1e4) * 1e4;
  const ganaUna = Math.round((v1 - C.precio) / 1e4) * 1e4;
  const corte = Math.round(v1 * (1 + E.corte) / 1e4) * 1e4;
  const OLa = M.ofertaLiga && !M.ofertaLiga.poco ? M.ofertaLiga : null;
  const saldo = num(D.dinero), llega = saldo >= C.precio, llena = (M.mias || []).length >= 25;
  const once = M.mejora ? num(M.mejora(j)) : 0;
  const sobre = j.valor ? C.precio / j.valor - 1 : 0;
  // cómo va de gente en ese puesto (Carlos: «teniendo en cuenta si me faltan jugadores de otras posiciones»)
  const PU = { 1: 'porteros', 2: 'defensas', 3: 'centrocampistas', 4: 'delanteros' };
  const pu = (M.puestos || []).find((y) => y.pos === j.pos), otros = (M.puestos || []).filter((y) => y.pos !== j.pos && y.faltan > 0);
  const puesto = pu && pu.faltan > 0 ? ` En su puesto le ${pu.faltan > 1 ? 'faltan' : 'falta'} ${pu.faltan}: si no lo revende, le viene bien quedárselo.` : pu && pu.sobran > 0 ? ` De ${PU[j.pos]} va sobrado: es solo para revender.` : '';
  const faltaOtros = otros.length && saldo - C.precio < 5e6 ? ` OJO: le faltan ${otros.map((y) => `${y.faltan} ${PU[y.pos]}`).join(' y ')} y con esta compra se queda con ${eur(saldo - C.precio)} hasta que lo revenda.` : '';
  const cuandoL = M.cierreMercado ? cuandoF(M.cierreMercado) : 'en el siguiente';
  const antesJ = !!(M.cierreMercado && M.proxima && M.cierreMercado < M.proxima.ini);
  const baja = dia < 0 ? `, ya contado que baja unos ${eur(-dia)} al día` : dia > 0 ? `, ya contado que sube unos ${eur(dia)} al día` : '';
  const ok = gana >= Math.max(150000, C.precio * 0.015);
  const espera = `rechazando las flojas (hasta ${N_ESPERA} cambios de mercado, uno al día), de media ${gana >= 0 ? `gana unos ${eur(gana, { signo: true })}` : `pierde unos ${eur(-gana)}`}`;
  const primera = `con la primera oferta, de media ${eur(ganaUna, { signo: true })} (puede salir entre ${eur(una.min - C.precio, { signo: true })} y ${eur(una.max - C.precio, { signo: true })})`;
  let ver;
  if (llena) ver = 'NO PUEDE: tiene la plantilla llena (25) y antes tendría que vender a uno';
  else if (!llega) ver = `NO LE LLEGA: a otro mánager se le paga con saldo, sin deuda, y tiene ${eur(saldo)} (le faltan ${eur(C.precio - saldo)}); antes tendría que vender`;
  // (el que baja: la cuenta sale por poco y cada día de espera cuesta; se dice)
  else if (ok) ver = `${dia < 0 && gana < C.precio * 0.03 ? `SÍ, PARA REVENDERLO, PERO CON POCO MARGEN (baja unos ${eur(-dia)} al día: cuanto más espere, menos vale)` : 'SÍ, PARA REVENDERLO SIN PRISA'}: ${espera}; ${primera}. Que acepte la primera solo si pasa de ${eur(corte)}${once >= 0.3 ? `. Y si se lo queda, suma ${d1(once)} pts por jornada a su once` : ''}`;
  else if (once >= 0.3) ver = `PARA REVENDER NO (${espera}: ${gana < 0 ? 'pierde' : 'no paga el riesgo'}); PARA SU ONCE, SÍ: suma ${d1(once)} pts por jornada`;
  else ver = `NO COMPENSA: ${espera}${gana < 0 ? '' : ', que no paga el riesgo'}, y no mejora su once`;
  return `\n\nLA APP, LA COMPRA QUE CUENTA: ${dueno} le deja a ${j.nombre} ${C.como} (${eur(C.precio)}; vale ${eur(j.valor)}${Math.abs(sobre) >= 0.005 ? `, ${pct(sobre * 100)}` : ''}). ES UN HECHO (lo han hablado fuera de la app): NO le digas que el dueño no vende a ese precio, ni le des otra «oferta para que te lo venda» o «oferta mínima», ni que no lo ves. LAS CUENTAS: se paga con saldo (tiene ${eur(saldo)}${llega ? ` y se queda con ${eur(saldo - C.precio)}` : ''}); lo pone a la venta y LaLiga le hace una oferta en cada cambio de mercado (la primera, ${cuandoL}${antesJ ? ', antes de la jornada' : ''}): cada una va de −10 % a +10 % de lo que valga ese día, A SUERTE, y la de ayer se pierde cuando llega la nueva (la primera, entre ${eur(una.min)} y ${eur(una.max)}). ${primera[0].toUpperCase() + primera.slice(1)}; ${espera}${baja}${OLa ? `. En su liga las ofertas que se aceptan rondan ${pct(OLa.med * 100)}: son las buenas, no lo que da cada vez` : ''}. NO digas que LaLiga «suele dar» un tanto por ciento fijo ni que «le dará el +10 %»: el +10 % es lo más alto que puede salir. Recién comprado, nadie se lo puede clausular en 14 días (él sí puede venderlo cuando quiera).${puesto}${faltaOtros} LA DECISIÓN DE LA APP: ${ver}. Respóndele con esto y con estas cifras, sin rehacerlas.`;
}

/** el trato de la conversación: el de la pregunta, si no el de sus últimos mensajes y si no el último trato apuntado */
export function tratoDeChat(pregunta, D, M, antes = []) {
  const fuentes = [pregunta, ...[...antes].reverse()];
  try { for (const n of notas().filter((x) => x.tipo === 'trato' && (!x.caduca || x.caduca > Date.now())).reverse()) fuentes.push(n.texto); } catch (e) { /* sin notas */ }
  for (const f of fuentes) {
    const spec = f && tratoEn(f, D, M);
    if (!spec) continue;
    const T = M.trato ? M.trato({ ...spec, sinClausula: sinClausulaEn([pregunta, ...antes].join(' \n ')) }) : null;
    if (T) return { ...T, igual: spec.igual, supuesto: spec.supuesto };
  }
  return null;
}
/** el trato hecho cuentas, para los datos del chat («LA APP, EL TRATO») */
export function tratoTxt(D, M, T) {
  if (!T) return '';
  const oculto = bloqueada('dineroRivales', T.tid);
  const riv = nombreTid(M, T.tid);
  const sobre = (x) => { const d = x.precio / x.valor - 1; return Math.abs(d) < 0.005 ? 'su valor' : `${d > 0 ? '+' : '−'}${pct(Math.abs(d) * 100, 1).replace(/^[+-]/, '')} sobre su valor, ${eur(x.valor)}`; };
  const lista = (l) => l.map((x) => `${x.j.nombre} por ${eur(x.precio)} (${sobre(x)})`).join(' y ');
  const L = ['\nLA APP, EL TRATO (cuentas hechas por la app con el dinero de los dos, cada uno solo con su saldo: entre managers no se puede tirar de deuda, eso solo vale para pujar en el mercado; su veredicto es tu respuesta: empieza por él y explícalo con estas cifras):'];
  L.push(`- Lo que hablan: ${riv} me compra ${lista(T.mios)} y yo le compro ${lista(T.suyos)}.${T.igual ? ' Es uno por otro: los dos al mismo precio, así mi saldo no se mueve.' : T.supuesto ? ' (El que va sin precio, contado a su valor.)' : ''}`);
  const din = (imp) => { const s = !T.cap ? 'nose' : T.cap.seguro >= imp ? 'si' : T.cap.alto >= imp ? 'quiza' : 'no';
    if (s === 'nose') return 'no sé si le llega';
    if (oculto) return s === 'si' ? 'parece que le llega' : s === 'quiza' ? 'parece que le llega justo' : 'no parece que le llegue';
    return `${s === 'si' ? 'le llega' : s === 'quiza' ? 'le llega justo' : 'no le llega'}: tiene ${T.cap.exacto ? '' : '≈ '}${eur(T.cap.v)}`; };
  if (!T.orden) L.push(`- EL DINERO NO DA: con mi saldo (${eur(T.saldo)}) no pago ${eur(T.pago)} primero, y él para pagarme ${eur(T.cobro)} primero ${din(T.cobro)}. PARA QUE SALGA, uno de los dos tiene que hacer caja antes: a mí me faltan ${eur(Math.max(0, T.pago - T.saldo))} (aceptando una oferta que ya tenga, entran al momento; poniendo a alguien a la venta, con la oferta de LaLiga del siguiente cambio de mercado${M.cierreMercado ? `, ${cuandoF(M.cierreMercado)}` : ''}). Dile eso, con la cifra que le falta; el trato en sí se cobra al momento: no le digas sin más que «espere al cambio de mercado».`);
  else if (T.orden === 'el') L.push(`- El orden: ${T.yoPrimero ? 'da igual quién empiece, pero mejor que pague él primero' : `con mi saldo (${eur(T.saldo)}) no puedo pagar primero`}; él me compra primero (${din(T.cobro)}), me entran ${eur(T.cobro)} AL MOMENTO (tengo ${eur(T.saldo + T.cobro)}) y luego le pago ${eur(T.pago)}: acabo con ${eur(T.saldoFin)} de saldo.`);
  else L.push(`- El orden: a él no le llega para pagar primero, así que pago yo ${eur(T.pago)} con mi saldo (me quedan ${eur(T.saldo - T.pago)}) y con ese dinero me compra él lo mío: me entran ${eur(T.cobro)} al momento y acabo con ${eur(T.saldoFin)} de saldo.`);
  L.push(`- Mi valor (saldo + jugadores): de ${eur(T.valorAntes)} a ${eur(T.valorDespues)} (${eur(T.dValor, { signo: true })})${T.dValor < 0 ? `: es lo que pago por encima de lo que valen (${[T.deMas > 0 ? `${eur(T.deMas)} de más por lo suyo` : null, T.cedo > 0 ? `${eur(T.cedo)} menos de lo que vale lo mío` : null].filter(Boolean).join(' y ')})` : ''}.`);
  L.push(`- El precio: lo normal entre managers por ${T.suyos.map((x) => x.j.nombre).join(' y ')} es hasta ~${eur(T.normal)} (su «oferta para que te lo venda»; a su valor su dueño no vende): ${eur(T.pago)} está ${eur(Math.abs(T.normal - T.pago))} ${T.barato ? 'por debajo: BUEN PRECIO' : 'por encima: CARO'}.${T.mios.some((x) => x.precio <= x.valor) ? ` Lo mío va a su valor o menos: a LaLiga le sacaría algo más, pero no al momento (en el siguiente cambio de mercado).` : ''}`);
  const pts = (x) => `${x.j.nombre} ~${d1(x.pp)}`;
  const rit = (x) => `${x.j.nombre} ${x.ritmo >= 0 ? 'sube' : 'baja'} ${eur(Math.abs(x.ritmo))} al día`;
  L.push(`- Lo que gano: puntos del próximo partido ${[...T.suyos, ...T.mios].map(pts).join(', ')}; mi once ${Math.abs(T.dPts) < 0.05 ? 'se queda igual' : `${T.dPts > 0 ? 'gana' : 'pierde'} ~${d1(Math.abs(T.dPts))} pts por jornada`}. ${[...T.suyos, ...T.mios].map(rit).join('; ')} (en 14 días, con el cambio ${T.dRitmo >= 0 ? 'gano' : 'pierdo'} ${eur(Math.abs(T.dRitmo * 14))} si siguen así). ${T.suyos.map((x) => x.j.nombre).join(' y ')} llega${T.suyos.length > 1 ? 'n' : ''} con la cláusula cerrada 14 días: nadie me ${T.suyos.length > 1 ? 'los' : 'lo'} puede quitar en ese tiempo.${T.enRiesgo.length ? ` ${T.enRiesgo.map((x) => x.j.nombre).join(' y ')} tenía${T.enRiesgo.length > 1 ? 'n' : ''} riesgo de cláusula ${T.enRiesgo[0].riesgo}: con el trato me lo quito.` : ''}`);
  L.push(`- Cuenta de 14 días: ${eur(T.dValor, { signo: true })} de valor ahora ${T.gana14 >= 0 ? '+' : '−'} ${eur(Math.abs(T.gana14))} entre lo que sube de más y los puntos (100 mil cada uno, ${T.jornadas14} jornada${T.jornadas14 > 1 ? 's' : ''}) = ${eur(T.neto, { signo: true })}.`);
  if (T.via) {
    const v = T.via, s = T.suyos[0];
    if (v.fuera) L.push(`- La otra vía, su cláusula (${eur(v.clausula)}), NO CUENTA: me ha dicho que ${riv} la blinda o la sube si no hay trato. No la propongas.`);
    else L.push(`- La otra vía: la cláusula de ${s.j.nombre} (${eur(v.clausula)}) ${v.abierta ? 'está abierta' : `se abre ${cuandoF(v.abre)}`}${v.meLlega ? ' y me llega' : `, pero no me llega (faltan ${eur(v.clausula - T.saldo)})`}${v.antesJornada ? '' : ', después de que empiece la jornada'}. ${v.vale ? `Por ahí me ahorro ${eur(T.pago - v.clausula)} y me quedo también lo mío, pero no es seguro: él puede blindarla o subirla antes y en ese minuto compito con quien quiera pagarla.` : 'No es mejor camino.'}`);
  }
  L.push(`- VEREDICTO DE LA APP: ${T.veredicto}${T.si ? ` ${T.si}` : ''}: ${T.motivo}.`);
  return L.join('\n');
}

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

// (22 nov, Carlos: «Entendido, lo quito del plan… para la próxima vez el plan no debe depender de un blindaje», y el plan
// rehecho mandó blindar) la IA no puede prometer que apunta, quita o tendrá en cuenta algo si no se ha guardado nada
const PROMETE = /\b(lo|la|los|las|te lo|me lo) (apunto|anoto|quito|saco|elimino|tendre en cuenta|tengo en cuenta|recordare|dejo apuntado)\b|\b(queda|quedan|lo dejo|ya esta) (apuntad|anotad)[oa]s?\b|\b(apuntado|anotado|tomo nota)\b|\b(quito|saco|elimino|fuera)\b[^.]{0,60}\bdel plan\b|\bpara la proxima vez\b|\bla proxima vez que (rehagas|hagas|pidas)\b|\bel (proximo )?plan (ya )?no (debe|debera|va a|contara|dependera)\b/;
export const prometeApuntar = (t) => PROMETE.test(norm(t || ''));
export function revisarChat(texto, pregunta, D, M, { rec = [], hist = [], apuntado = null } = {}) {
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
    // (19 nov) una orden para más adelante y con condición no es de hoy: «Si el valor sigue cayendo en los próximos cambios
    // de mercado…, véndelo entonces» hacía saltar «Revisado por la app» con una respuesta que decía «hoy no lo vendas»
    if (/^\W*si\b/.test(norm(fr)) && /\b(sigue|siguen|proxim\w*|despues|cuando|manana|entonces|mas adelante|otro dia)\b/.test(norm(fr))) continue;
    // una orden va al principio de la frase o de un inciso («Sí, clausúlalo»; «entonces vende a X»): «una cláusula a su
    // valor», «Marcos vende a Camello» o «la puja por Terrats» no lo son (falsa alarma en la pasada con la IA, 13 nov)
    for (const inciso of fr.split(/[,;:()—–]/)) {
      const k = norm(inciso);
      for (const [acc, re] of ORDENES) {
        const m = k.match(re);
        if (!m || !/^(?:(?:si|pues|entonces|asi que|y|mejor|hoy|ahora|ya|venga|primero|luego|despues|adelante|yo|tu)\s+)*$/.test(`${k.slice(0, m.index).trim()} `.replace(/^ $/, ''))) continue;
        // («véndelo por eso y no para clausular a Oyarzabal»: con «véndelo», «clausúlalo»…, el jugador es el de antes, no
        // el que sale detrás; quinta pasada con Haiku, 17 nov)
        const antes = /(?:lo|la)$/.test(m[0]) ? enFrase(fr.slice(0, Math.max(0, fr.indexOf(inciso)))) : [];
        const aqui = antes.length ? antes : enFrase(inciso).length ? enFrase(inciso) : enFrase(fr);
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
    if (opC && opC.ref[0] === 'M' && p.importe && p.importe < opC.precio) nota(`${N(j)} vale ${eur(opC.precio)} y a otro mánager no se le puede ofertar por debajo del valor de mercado${opC.ofertaMin && opC.ofertaMin > opC.precio ? `; para tener opciones, como poco ${eur(opC.ofertaMin)}` : ''}. Y decide él: también tiene la oferta de LaLiga.`);
    else if (opC && opC.ref[0] === 'C' && !opC.abierta && !yaDice(opC.abre)) nota(`${N(j)}: ${opC.veda ? `las cláusulas están cerradas hasta que empiece la jornada ${opC.veda.n}; la suya se puede pagar ${cuandoF(opC.abre)}, no antes` : `su cláusula no se abre hasta ${cuandoF(opC.abre)}: hasta entonces no se puede pagar`}.`);
    else if (opC && opC.ref[0] === 'B' && !x.importe && !opC.abierta && !yaDice(opC.abre)) nota(`${N(j)}: el escudo solo se puede poner con la cláusula ya abierta, y la suya está protegida hasta ${cuandoF(opC.abre)}.`);
    else if (p.accion === 'vender' && /sube [^.]*al día/.test(x.aviso || '') && !/aguant|no lo vend|no vend|esper/.test(norm(t))) nota(`${N(j)}: ${sinApp(x.aviso).split(/(?<=\.)\s/).slice(0, 2).join(' ')}`);
  }

  /* 2. las cifras de un jugador y del saldo, contra los datos */
  const reCl = new RegExp(`cl[aá]usula(?: de [^,.;:()\\d]{2,30}?)?,?\\s*(?:\\()?(?:(?:que )?est[aá] (?:ya )?(?:abierta )?(?:en|a)|es de|son|de|en|:)\\s*(?:unos |los |las |solo )?${NUM_M}`, 'i');
  const reVal = new RegExp(`\\b(?:vale(?:n)?|valor(?: actual| de mercado)?(?: es)?(?: de|:)?)\\s+(?:ahora |hoy |ya |unos |sobre |alrededor de |aproximadamente |mismo )*${NUM_M}`, 'i');
  const reSaldo = new RegExp(`(?:\\b(?:tu|el) (?:saldo|caja)(?: actual| de ahora| de hoy)?(?: es| está)?(?: de| en|:)?\\s+(?:unos |los |solo )?${NUM_M})|(?:\\b(?:con|tienes) (?:tus |unos |los |solo )?${NUM_M} (?:de saldo|en caja|de caja|en el banco))`, 'i');
  // (una frase que habla de un supuesto o de otra cifra —«si sube a…», «la pagaste a…», «súbela hasta…»— no se compara)
  const SUPUESTO = /\b(hasta|por encima|por debajo|mas de|menos de|si|cuando|tras|despues de|antes de)\b|\b(podr|seria|quedar|dejar|valia|llego a valer|valdr|tendr|pagaste|pague|pagar|costo|compraste|fichaste|aguant)\w*/;
  const SUBIRLA = /\bsub(ir|e|es|as|ida|irla|irle|ela|ele)\b/;
  for (const fr of frases) {
    const k = norm(fr);
    const js = enFrase(fr);
    if (js.length === 1 && !SUPUESTO.test(k)) {
      const j = js[0];
      const mc = fr.match(reCl), cl = clDe(j.id);
      if (mc && cl && !SUBIRLA.test(k) && !casi(aEuros(mc[1], mc[2]), cl.clausula)) nota(`${N(j)}: su cláusula es de ${eur(cl.clausula)} (no de ${mc[1]} ${mc[2]}).`);
      // («aguantarlo 11 días vale unos 2,55 M más»: es lo que gana, no su valor; segunda pasada con Haiku, 16 nov)
      const mv0 = !mc && fr.match(reVal);
      const mv = mv0 && !/^\s*(?:m[aá]s|menos|de m[aá]s|extra|por encima|por debajo)\b/i.test(fr.slice(mv0.index + mv0[0].length)) ? mv0 : null;
      if (mv && j.valor && !casi(aEuros(mv[1], mv[2]), j.valor) && !(cl && casi(aEuros(mv[1], mv[2]), cl.clausula))) nota(`${N(j)}: vale ${eur(j.valor)} (no ${mv[1]} ${mv[2]}).`);
    }
    // («te deja con 3,90 M de saldo», «tu saldo pasa de… a…»: lo que le quedaría, no su saldo de ahora; cuarta pasada, 17 nov;
    // «acabas con 2,40 M de saldo», «sales con 57,05 M de saldo»: el trueque de Carlos con Domy, 19 nov)
    const ms = saldo != null && !/\b(si|qued|tendr|tras|despues|acept|vend|dej|pasa|pasar|baj|subir|cost|seria|cambi|acab|termin|sales|salir|saldr|propuest|trato|luego|final)\w*/.test(k) ? fr.match(reSaldo) : null;
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

  /* 3b. (19 nov, el trueque de Carlos con Domy) «cambio a valores», «a su valor», «sin el 4 %»: ningún dueño vende a su
     valor porque LaLiga le da más; se dice cuánto es lo normal que pide su dueño por el jugador del rival del que habla */
  if (/\b(cambio|cambiar|intercambio|cerrar|cerrarlo|contraofert\w*|propon\w*)\b[^.]{0,30}\ba (sus )?valores\b|\ba valor(es)? exactos?\b|\bsin (el|la) (\d+ ?%|prima|sobreprecio)\b/i.test(norm(t))) {
    const rival = todos.find((j) => j && !mia(j.id) && M.dueno && M.dueno[j.id]);
    const of = rival ? ofertaDueno(M, rival) : null;
    nota(of && of.v ? `A su valor no lo vende ningún dueño, porque LaLiga le da más: lo normal entre managers es pagar por ${N(rival)} hasta unos ${eur(of.v)}, y por debajo de eso es buen precio.` : 'A su valor no lo vende ningún dueño, porque LaLiga le da más: pagar algo por encima entre managers es lo normal.');
  }

  /* 3c. (20 nov, Carlos con Revivo: «por solo un millón más evidentemente no me lo va a aceptar») ofrecerle a un rival por
     uno suyo que sube menos de lo que pediría su dueño (ofertaDueno): se dice cuánto */
  // (si el precio lo ha puesto el rival en la pregunta, ya lo acepta: eso lo cuenta la calculadora de tratos)
  const precioEnPregunta = new RegExp(NUM_M, 'i').test(pregunta || '');
  // (sin partir «J. David» por el punto de la inicial)
  const frasesO = precioEnPregunta ? [] : t.split(/(?<!(?:^|[\s(«"])[A-ZÁÉÍÓÚÑ])[.!?;]\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  for (const fr of frasesO) {
    const k = norm(fr);
    if (!/\b(ofrec\w*|ofert\w*|propon\w*|pagale|pagarle|dale|darle)\b/.test(k) || /\b(clausul\w*|laliga|liga te)\b/.test(k)) continue;
    const js = enFrase(fr).filter((j) => !mia(j.id) && M.dueno && M.dueno[j.id] && M.dueno[j.id] !== (D.yo && D.yo.teamId));
    if (js.length !== 1) continue;
    const od = ofertaDueno(M, js[0], M.tend ? M.tend(js[0].id) || {} : {});
    if (!od || !od.sube) continue;
    const cifras = [...fr.matchAll(new RegExp(NUM_M, 'gi'))].map((m) => aEuros(m[1], m[2])).filter((x) => Number.isFinite(x) && x > js[0].valor * 0.5);
    if (cifras.length && Math.max(...cifras) < od.v * 0.98) nota(`${N(js[0])} sube: por menos de unos ${eur(od.v)} su dueño no lo va a soltar (lo que ganaría quedándoselo esta semana${od.conPuntos ? ' y sus puntos de la jornada' : ''}).`);
  }

  /* 3d. (21 nov, la batería con la IA de verdad: «la app aconseja esperar…; si quieres caja ya, acéptala») con una oferta por
     uno tuyo en la que la app aconseja ESPERAR, la respuesta no manda aceptarla, ni como «si quieres…» */
  for (const v of M.misVentas || []) {
    if (v.consejo !== 'esperar' || !v.mejor || !v.j) continue;
    // (por frases enteras, con lo que va detrás de un «;»: «…la app aconseja esperar; si quieres caja ya, acéptala»)
    const suyas = t.split(/(?<!(?:^|[\s(«"])[A-ZÁÉÍÓÚÑ])[.!?]\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    const ofertas = (M.misVentas || []).filter((y) => y.mejor).length;
    const manda = suyas.some((fr) => {
      const k = norm(fr);
      const delJ = enFrase(fr).some((j) => j.id === v.pid) || (ofertas === 1 && /\boferta\b/.test(k));
      // (si es por si deja de subir, vale: es lo mismo que haría la app)
      return delJ && /\b(aceptala|acepta (ya|la oferta)|aceptala ya)\b/.test(k) && !/\b(no|nunca|ni)\b[^,]{0,12}\bacepta/.test(k)
        && !/\bsi\b[^.]{0,90}\b(se para|para de subir|cae|baja|gira|deja de subir|empieza a bajar|se frena|se estanca)\b/.test(k);
    });
    if (manda) nota(`Con la oferta por ${N(v.j)} la app aconseja esperar, así que mejor no aceptarla todavía${v.porque ? `: ${cortar(v.porque, 150).replace(/[.\s]+$/, '')}` : ''}${v.porque && /…$/.test(cortar(v.porque, 150)) ? '' : '.'}`);
  }

  /* 3f. (24 nov, Carlos con Bernardo Silva) le cuenta que un rival le deja a uno a un precio y la respuesta dice que el dueño
     no vende a ese precio o le da otra «oferta mínima»: se corrige con las cuentas de la app */
  try {
    const antesQ = (hist || []).filter((m) => m.r === 'yo').slice(-3).map((m) => m.t || '').filter((x) => x !== pregunta).join(' ');
    const C = compraContada(pregunta, D, M, antesQ);
    if (C && /\b(no (te lo )?vende a (su|ese) (valor|precio)|oferta minima|oferta que tienes que hacer|para que te lo venda|no compras)\b/.test(norm(t))) {
      const dec = (compraTxt(D, M, C).match(/LA DECISIÓN DE LA APP: ([^.]*)\./) || [])[1];
      if (dec) {
        const tu = dec.replace('SÍ, PARA REVENDERLO SIN PRISA', 'sí, para revenderlo sin prisa').replace('SÍ, PARA REVENDERLO, PERO CON POCO MARGEN', 'sí, para revenderlo, pero con poco margen').replace('cuanto más espere', 'cuanto más esperes').replace('de media gana unos', 'de media ganas unos').replace('de media pierde unos', 'de media pierdes unos').replace('Que acepte la primera', 'Acepta la primera').replace('NO PUEDE: tiene', 'no puedes: tienes').replace('NO LE LLEGA', 'no te llega').replace('PARA REVENDER NO', 'para revender no').replace('PARA SU ONCE, SÍ', 'para tu once, sí').replace('NO COMPENSA', 'no compensa')
          .replace(/\bsu once\b/g, 'tu once').replace('y tiene ', 'y tienes ').replace('le faltan', 'te faltan').replace(/tendría\b/g, 'tendrías').replace('se lo queda', 'te lo quedas');
        nota(`Si te deja a ${N(M.J(C.pid))} por ${eur(C.precio)}, ese es el precio. Con él, ${tu}.`);
      }
    }
  } catch (e) { /* sin esta comprobación */ }

  /* 3e. (24 nov, Senna: «Te he dicho que lo vendas, no que lo aguantes. Mi recomendación sigue igual: vender», con Hoy
     diciendo otra cosa) lo que aconseja de cada jugador tuyo tiene que ser su decisión (decide.js), la misma que ve en Hoy
     y en Equipo: si manda vender al que la app aguanta, o aguantar al que la app vende hoy, se dice */
  try {
    const yoT = D.yo && D.yo.teamId, vistos = new Set();
    let ultimo = null;
    for (const fr of t.split(/(?<!(?:^|[\s(«"])[A-ZÁÉÍÓÚÑ])[.!?]\s+|\n+/).map((x) => x.trim()).filter(Boolean)) {
      const k = norm(fr), c = consejoEnFrase(fr);
      const suyos = enFrase(fr).filter((j) => M.dueno[j.id] === yoT);
      if (suyos.length) ultimo = suyos[suyos.length - 1];
      // «la cláusula no te protege» de una que nadie paga: es al revés
      if (/clausula[^.]{0,80}\bno (te|le) protege/.test(k) && ultimo) {
        const x = (M.mias || []).find((y) => y.pid === ultimo.id), cz = M.clausulazos && M.clausulazos.n >= 3 ? M.clausulazos.p90 : 0.3;
        if (x && x.clausula && x.ratio != null && x.ratio - 1 > Math.max(cz, 0.5)) nota(`La cláusula de ${N(ultimo)} sí te protege: está un ${pct((x.ratio - 1) * 100, 0)} por encima de su valor y nadie la va a pagar. Lo que no hace es servirte para venderlo.`);
      }
      if (!c) continue;
      for (const j of suyos) {
        if (vistos.has(j.id)) continue;
        const d = M.decision ? M.decision(j.id) : null;
        if (!d) continue;
        const v = (M.misVentas || []).find((y) => y.pid === j.id && y.mejor);
        // (lo de aceptar una oferta que la app manda esperar ya lo dice la 3d)
        if (c === 'V' && d.accion === 'aguantar' && !(v && notas.some((n2) => n2.includes(j.nombre)))) { vistos.add(j.id); nota(`Con ${N(j)}, lo que dice la app (en Hoy y en Equipo) es «${d.corta}»: ${cortar(d.porque, 170)}`); }
        else if (c === 'A' && d.accion === 'vender' && ['poner', 'aceptar'].includes(d.paso)) { vistos.add(j.id); nota(`Con ${N(j)}, lo que dice la app (en Hoy y en Equipo) es «${d.corta}»: ${cortar(d.porque, 170)}`); }
      }
    }
  } catch (e) { /* sin esta comprobación */ }

  /* 4. lo que no puede decir */
  const yaLoDice = /\b(nunca|no)\b[^.]{0,60}\b(con|de) deuda\b|\bsolo\b[^.]{0,60}\bsaldo\b|\bsin deuda\b/.test(norm(t).replace(/ /g, ' ')) ;
  for (const fr of frases) {
    const k = norm(fr);
    // una cláusula con deuda
    // (si la respuesta ya dice la regla —«nunca con deuda», «solo con saldo»—, una frase suelta sin el «no» no es un error)
    // («lo harías con margen antes del cierre de cláusulas»: un margen de tiempo, no de deuda; segunda pasada, 16 nov)
    if (/clausul/.test(k) && /\b(deuda|en negativo|margen de deuda|tirando del margen|con el margen)\b/.test(k) && !/\b(no|solo|sin|nunca|ni|tampoco|olvidate)\b/.test(k) && !/\bcierre de (las )?clausulas\b|\bclausulas se (cierran|reabren)\b/.test(k) && !yaLoDice && saldo != null) nota(`Una cláusula solo se paga con saldo, sin deuda: ahora tienes ${eur(Math.max(0, saldo))}. El margen de deuda solo vale para pujar o comprar en el mercado.`);
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
      if (m && !notasDe(j.id).some((n) => n.importe)) nota(`${N(j)}: ${m.vendedor || nombreTid(M, m.vendedorTeamId)} lo tiene puesto a la venta. El precio que le pone en el mercado no cuenta: no es un trato contigo ni algo que te pida a ti. Se le puede ofertar desde su valor, ${eur(j.valor)}.`);
    }
  }
  // uno que ya no es suyo, tratado como suyo
  for (const v of M.vendidos || []) {
    if (!v.j || notas.some((x) => x.includes(`**${v.j.nombre}**`))) continue;
    if (cuentaConVendido(t, v.j.nombre, !!(M.dueno && M.dueno[v.j.id] && M.dueno[v.j.id] !== yoT))) nota(`${N(v.j)} ya no es tuyo (${v.como} ${cuando(v.t)}): no cuenta para lo de arriba.`);
  }
  // (22 nov, Fran y Carlos) el precio que un rival le pone a uno suyo en el mercado no cuenta para nada: si la respuesta lo
  // da como lo que hay que pagar («al menos 200 M»), se corrige con su valor y con lo que haría falta ofrecerle
  for (const m of (M.mercado || []).filter((x) => x.tipo === 'manager' && x.pide && x.j && x.j.valor && x.pide > Math.max(x.ofertaAlta || 0, x.j.valor) * 1.15 && todos.some((j) => j.id === x.j.id))) {
    const ent = String(Math.floor(m.pide / 1e6));
    const cifra = new RegExp(`(^|[^0-9,.])${ent}(?:[.,]\\d{1,2})?\\s?(M\\b|millones|kilos)`, 'i');
    const malas = frases.filter((f) => { const n = norm(f); return cifra.test(f) && /\b(al menos|como minimo|minimo|ofrece|ofrecele|ofrecer|oferta de|paga|pagar|pagale|puja|pujar|comprarselo por|compralo por|por lo menos)\b/.test(n) && !/\b(no|irreal|absurd\w*|inflad\w*|disparatad\w*|ni de broma|nadie)\b/.test(n); });
    if (malas.length) nota(`${N(m.j)} vale ${eur(m.j.valor)}: el precio que le ha puesto ${m.vendedor || 'su dueño'} en el mercado no cuenta. Se le puede ofertar desde su valor${m.ofertaMin ? `; para que te lo venda, unos ${eur(m.puja || m.ofertaMin)}` : ''}.`);
  }
  if (apuntado === 0 && prometeApuntar(t)) nota('De esto no se ha apuntado nada: el plan sale de los datos de tu liga. Si es un hecho, dímelo tal cual («no me quedan blindajes», «a Pedri no lo vendo», «ya he pujado por él») y el plan lo contará.');
  // (texto.js no pinta citas: un título en negrita y una lista)
  if (notas.length) t += `\n\n**Revisado por la app:**\n${notas.slice(0, 6).map((x) => `- ${x}`).join('\n')}`;
  return { texto: t, notas };
}

/**
 * (16 nov, revisión del chat) las plantillas enteras de los rivales. Antes al chat solo le llegaba una línea por rival y
 * lo que tenían a la venta, y si Carlos preguntaba qué le interesaba del equipo de un rival, la IA contestaba que no veía
 * su plantilla y le pedía la lista. Cada jugador en una línea corta; los rivales de los que habla, con algo más.
 * enteros: los teamId de los rivales que nombra en la pregunta (o en sus últimos mensajes).
 */
/* ofertaDueno (cuánto ofrecerle a un rival para que te venda a uno) vive en motor.js desde el 19 nov: la usa M.trato */
export { ofertaDueno };

/* (19 nov, tercera parte) recortado para el chat: de los rivales de los que no pregunta, sin lo de hoy (va lo de 7 días) y sin
   «oferta para que te lo venda» salvo que pregunte por ofertas o nombre al jugador (~20 % menos de lo que lee el chat) */
export function plantillasRivalesTxt(D, M, enteros = new Set(), { nombrados = new Set(), ofertas = true } = {}) {
  const saldo = num(D.dinero);
  const enVenta = new Map((M.mercado || []).filter((m) => m.tipo === 'manager').map((m) => [String(m.pid), m]));
  const L = [`\nPLANTILLAS DE LOS RIVALES (todas enteras; cada jugador: puesto | nombre | equipo | valor | cómo va | media | su cláusula, cuándo se puede pagar y si le llega con su saldo de ahora, ${eur(saldo)} | si lo tiene en venta | cuánto ofrecerle a su dueño). Cualquiera de estos se consigue por su cláusula cuando esté abierta o con una oferta a su dueño, esté o no en venta:`];
  const rivales = [...(M.rivales || [])].sort((a, b) => (enteros.has(String(b.e.teamId)) ? 1 : 0) - (enteros.has(String(a.e.teamId)) ? 1 : 0) || (a.e.pos || 99) - (b.e.pos || 99));
  for (const r of rivales) {
    const fichas = (r.fichas || []).filter((x) => x && x.j && x.j.pos !== 5).sort((a, b) => (a.j.pos - b.j.pos) || (b.j.valor - a.j.valor));
    if (!fichas.length) continue;
    const det = enteros.has(String(r.e.teamId));
    L.push(`${r.e.nombre} (${r.e.manager}, ${r.e.pos}º, ${fichas.length} jugadores)${det ? ' — DEL QUE PREGUNTA:' : ':'}`);
    for (const x of fichas) {
      const j = x.j, t = x.tend || (M.tend ? M.tend(j.id) : null) || {};
      const T = det && M.titularidad && j.pos < 5 ? M.titularidad(j) : null;
      const entero = det || nombrados.has(String(j.id));
      const cl = x.clausula ? `cláusula ${eur(x.clausula)}${x.ratio ? ` (${x.ratio <= 1.03 ? 'a su valor' : pct((x.ratio - 1) * 100, 0)})` : ''}: ${x.abierta ? 'ABIERTA' : `se abre ${cuandoF(x.protegidoHasta)}`}, ${x.clausula <= saldo ? 'le llega' : `le faltan ${eur(x.clausula - saldo)}`}` : 'sin cláusula';
      const v = enVenta.get(String(j.id));
      const of = ofertaDueno(M, j, t);
      L.push(`  - ${[
        POS[j.pos] || '?', j.nombre, j.equipo || '?', eur(j.valor),
        [entero && t.d1 != null ? `hoy ${eur(t.d1, { signo: true })}` : null, t.p7 != null ? `7d ${pct(t.p7)}` : null].filter(Boolean).join(', ') || null,
        j.media ? `media ${String(j.media).replace('.', ',')}` : null,
        det ? (onceTxt(M, j) || (T && T.p != null ? `titular ~${Math.round(T.p * 100)} %` : null)) : null,
        det && j.pos < 5 && M.ppEsperado ? `próximo: ${partidoTxt(M, j)}, ~${d1(M.ppEsperado(j))} pts` : null,
        cl,
        v ? 'LO TIENE EN VENTA (el precio que le pone no cuenta: se le oferta desde su valor)' : null,
        // (19 nov, el trueque de Carlos con Domy: la IA tomaba el valor como precio justo y proponía «cambio a valores») lo que
        // pide un dueño por él: pagar hasta ahí es un precio normal entre managers
        of && (entero || ofertas) ? `oferta para que te lo venda ~${eur(of.v)} (precio normal entre managers: pagar hasta ahí es buen precio; a su valor su dueño no lo vende)${of.sube ? ' (sube: su dueño querrá más)' : ''}` : null,
        j.estado && j.estado !== 'ok' ? `ESTADO: ${ESTADO_TXT[j.estado] || j.estado}` : null,
      ].filter(Boolean).join(' | ')}`);
    }
  }
  return L.length > 1 ? L.join('\n') : '';
}
/** los rivales de los que habla: por el nombre de su equipo o de su mánager (enteros o la palabra larga que los distingue) */
/**
 * (cuarta pasada con Haiku, 17 nov) sus cláusulas, de la más fácil de pagar a la más cara, comparadas con lo que se paga en
 * la liga por un clausulazo. A «¿quién me puede clausular?» o «¿blindo a alguien?» contestaba a veces al revés (una
 * cláusula un 87 % por encima de su valor, «la más tentadora»; una un 11 % por encima, «muy por encima de lo que se paga»).
 * Solo el precio: quién puede pagarla va (o no, si está cerrado) en sus líneas de siempre.
 */
export function misClausulasTxt(D, M) {
  const cz = M.clausulazos && M.clausulazos.n >= 3 ? M.clausulazos : null;
  const med = cz ? cz.med : 0.2, p90 = cz ? cz.p90 : 0.3;
  const l = (M.mias || []).filter((x) => x && x.j && x.j.pos !== 5 && x.clausula && x.j.valor).map((x) => ({ x, r: x.clausula / x.j.valor - 1 })).sort((a, b) => a.r - b.r);
  if (!l.length) return '';
  const L = [`\nSUS CLÁUSULAS, DE LA MÁS FÁCIL DE PAGAR A LA MÁS CARA (lo que pide cada una sobre su valor, frente a lo que se paga en esta liga por un clausulazo: ${cz ? `de mediana ${pct(med * 100)}, el 90 % hasta ${pct(p90 * 100)}` : 'sin clausulazos suficientes en la liga: se toma +20 % de referencia'}; cuanto más cerca de su valor, más peligro):`];
  for (const { x, r } of l) {
    const zona = r <= 0.03 ? 'A SU VALOR: la presa más fácil' : r <= med ? 'POR DEBAJO de lo que se suele pagar aquí: tentadora si a alguien le llega el dinero' : r <= p90 + 0.05 ? 'en la zona de lo que se paga aquí: puede pasar' : 'muy por encima de lo que se paga aquí: no la paga nadie';
    const cuando = x.abierta ? 'ABIERTA' : x.veda ? `a salvo por el cierre hasta que empiece la jornada ${x.veda.n}` : `${x.escudo ? 'blindada' : 'protegida'} hasta ${cuandoF(x.protegidoHasta)}`;
    L.push(`- ${x.j.nombre}: ${eur(x.clausula)} (${r <= 0.03 ? 'a su valor' : pct(r * 100, 0)}) | ${cuando} | ${zona}${M.enVenta && M.enVenta.has(x.pid) ? ' | lo tiene en venta' : ''}`);
  }
  return L.join('\n');
}
/** los rivales que nombra por su apodo (Ajustes → Apodos de los rivales) o con el nombre aproximado (lo que escribe el dictado) */
export function rivalesAprox(texto, D, M) {
  const out = new Set();
  if (!texto || !M || !M.rivales) return out;
  const ap = apodosLiga(), nombres = [];
  const q = ` ${norm(texto).replace(/[^a-z0-9ñ ]+/g, ' ')} `;
  for (const r of M.rivales) {
    const tid = String(r.e.teamId);
    for (const a of listaApodos(ap[tid])) {
      for (const v of [a, sinArticulo(a)].filter(Boolean)) { const n = norm(v).replace(/[^a-z0-9ñ ]+/g, ' ').trim(); if (n.length >= 3 && q.includes(` ${n} `)) out.add(tid); nombres.push({ nombre: v, clave: tid }); }
    }
    for (const n of [r.e.nombre, r.e.manager].filter(Boolean)) nombres.push({ nombre: n, clave: tid });
  }
  if (out.size) return out;
  const prohibidos = new Set(Object.values(D.maestro || {}).flatMap((j) => [j.nombre, j.equipo]).filter(Boolean).map(norm));
  try { for (const k of aproximar(texto, nombres, { prohibidos, norm }).cambios) out.add(String(k)); } catch (e) { /* sin aproximar */ }
  return out;
}
export function rivalesEn(texto, D, M) {
  const q = ` ${norm(texto).replace(/[^a-z0-9ñ ]+/g, ' ')} `;
  const out = new Set();
  if (q.trim().length < 3) return out;
  const pal = (s) => norm(s).replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 5);
  const todas = (M.rivales || []).map((r) => ({ tid: String(r.e.teamId), ns: [r.e.nombre, r.e.manager].filter(Boolean).map((n) => norm(n).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()) }));
  // cuántos rivales usan cada palabra (una palabra que tienen varios no sirve para distinguir)
  const cuenta = {};
  for (const r of todas) for (const w of new Set(r.ns.flatMap((n) => n.split(' ')).filter((w) => w.length >= 5))) cuenta[w] = (cuenta[w] || 0) + 1;
  for (const r of todas) {
    if (r.ns.some((n) => n.length >= 3 && q.includes(` ${n} `))) { out.add(r.tid); continue; }
    if (r.ns.some((n) => pal(n).some((w) => cuenta[w] === 1 && q.includes(` ${w} `)))) out.add(r.tid);
  }
  return out;
}

/** el plan que se ve en Hoy ahora: el de la IA si es de hoy; si no, el del motor de hoy (marcado con motorHoy) */
/* (24 nov, Senna) lo que la IA ha aconsejado de cada jugador tuyo en la conversación: 'V' (véndelo, acepta la oferta) o 'A'
   (aguántalo, no lo vendas). Lo usan «Lo que llevas hoy» («te lo aconsejó la IA a las 13:48») y los datos del chat («TÚ
   DIJISTE ANTES…», para que no niegue lo que dijo). Solo frases que lo dicen claro y sin condición */
const SI_VENDE = /\b(vende(lo|r|rlo)?|vendas|vendelo|acepta(la|r|rla)?|ponlo (a la|en) venta|ponerlo (a la|en) venta|deshazte)\b/;
const NO_VENDE = /\b(no|nunca|ni)\b[^,.;]{0,16}\b(vend|acept)|\b(aguanta(lo|r|rlo)?|quedate(lo)?|mantenlo|mantener|conservalo)\b/;
const CON_CONDICION = /\b(si|cuando|salvo|a no ser|solo si|excepto)\b[^.]{0,90}\b(necesit|hace falta|te pag|ofrec|fich|tengas|gir|baj|deje|llega|sub)/;
export function consejoEnFrase(frase) {
  const k = norm(frase || '');
  // (lo que cuenta que decía antes el plan o ella no es un consejo de ahora: «el plan de las 06:25 decía aceptar la oferta»)
  if (/\b(decia|decias|dije|dijiste|ponia|proponia|mandaba|recomendaba|aconsejaba)\b/.test(k)) return null;
  if (NO_VENDE.test(k)) return 'A';
  if (SI_VENDE.test(k) && !CON_CONDICION.test(k)) return 'V';
  return null;
}
export function consejosChat(M, hist = conversacion(), { desde = 0 } = {}) {
  const out = [];
  const mias = (M && M.mias) || [];
  const nombrados = (texto) => { const k = ` ${norm(texto)} `; return mias.filter((x) => { const n = norm(x.j.nombre), ult = n.split(' ').pop(); return k.includes(` ${n} `) || (ult.length >= 4 && new RegExp(`\\b${ult.replace(/[^a-z0-9]/g, '.')}\\b`).test(k)); }); };
  let pregunta = '';
  for (const m of hist || []) {
    if (m && m.r === 'yo') { pregunta = m.t || ''; continue; }
    if (!m || m.r !== 'ia' || !m.t) continue;
    const ts = m.ts || m.cuando || 0;
    if (ts && ts < desde) continue;
    const cuerpo = String(m.t).replace(/\n\n\*\*Revisado por la app:\*\*[\s\S]*$/, '');
    for (const fr of cuerpo.split(/(?<=[.!?;:])\s+|\n+/)) {
      const c = consejoEnFrase(fr);
      if (!c) continue;
      // de quién habla: de los que nombra la frase; si la respuesta entera no nombra a ninguno («Véndelo: está bajando»),
      // del único que nombraba la pregunta
      let de = nombrados(fr);
      if (!de.length && !nombrados(cuerpo).length) { const q = nombrados(pregunta); if (q.length === 1) de = q; }
      for (const x of de) {
        const ya = out.find((y) => y.pid === x.pid);
        if (ya) { if (ts >= ya.ts) { ya.clase = c; ya.ts = ts; } } else out.push({ pid: x.pid, clase: c, ts });
      }
    }
  }
  return out;
}
/** el plan de hoy guardado, si sigue valiendo: no, si después le ha contado a la IA algo que manda en el motor (22 nov) */
export function planGuardadoHoy(M) {
  const p = ultimoPlan();
  return p && p.dia === diaDe() && !((M && M.dicho) || []).some((n) => n.t > p.t) ? p : null;
}
/** qué ha cambiado en el plan de la IA desde que se hizo (lo que proponía entonces y la app ya no hace), para el chat */
function cambiosDesde(p, visto, M) {
  const antes = p.cuadradas || [];
  const L = [];
  for (const o of visto.ops || []) {
    if (!o.descartada || o.ya) continue;
    const nom = (o.j && o.j.nombre) || o.jugador || '';
    const era = antes.find((a) => norm(a.jugador) === norm(nom));
    // (si ya estaba descartado al hacerse el plan, no es un cambio)
    if (era && era.estado === 'descartada') continue;
    const d = o.decAhora || (o.pid && M.decision ? M.decision(o.pid) : null);
    const paso = o.etiqueta === 'Aceptar oferta' ? `aceptar la oferta por ${nom}` : `${o.accion} ${o.accion === 'pujar' ? 'por' : 'a'} ${nom}`;
    L.push(`el plan decía «${paso}»; ahora la app dice ${d && d.corta ? `«${d.corta}»: ${String(d.porque || '').replace(/[.\s]+$/, '')}` : `que no: ${motivoCorto(o.aviso)}`}`);
  }
  if (!L.length) return '';
  return `\nHA CAMBIADO DESDE EL PLAN de las ${horaDe(p.t)} (los datos de ahora mandan): ${L.join('. Y ')}. Si pregunta por ello o le extraña, RECONOCE que el plan de las ${horaDe(p.t)} decía eso y explica qué ha cambiado y qué dice la app ahora. Nunca niegues lo que decía el plan ni lo des por vigente.`;
}
function planQueVe(D, M, c) {
  const p = planGuardadoHoy(M);
  if (p) return p;
  try {
    const R = planDeHoy(D, M, c);
    if (R && Array.isArray(R.ops) && R.ops.some((o) => !o.descartada)) return { motorHoy: true, t: Date.now(), titular: R.titular || '', operaciones: R.ops.filter((o) => !o.descartada).map((o) => ({ accion: o.accion, jugador: (o.j && o.j.nombre) || o.jugador || '' })), ops: R.ops };
  } catch (e) { /* sin motor: el de antes, si lo hay */ }
  return ultimoPlan();
}
/**
 * Los datos de su liga para el chat: lo de siempre (contexto), los jugadores que nombra con todo, las plantillas de los
 * rivales y el plan. Es lo que la app manda al Worker (empieza por CABECERA_DATOS); se exporta para probarlo con la demo.
 */
export function datosChat(pregunta, D, M, c, { hist = [], web = false } = {}) {
  // (19 nov, tercera parte) el plan que ve en Hoy: el de la IA si es de hoy y, si no, el del motor de hoy (como montarPlan
  // de app.js). Antes iba siempre el último plan de la IA, aunque fuera de ayer, y sin plan de la IA no iba ninguno: a
  // «¿por qué el plan me dice que venda a X?» contestaba sin saber qué plan tenía delante
  const p = planQueVe(D, M, c);
  // (24 nov, Senna: «Te he dicho que lo vendas, no que lo aguantes») lo que ella aconsejó antes en esta conversación y ya no
  // es la decisión de la app: se le dice, para que lo reconozca y explique el cambio en vez de negarlo
  // (24 nov) lo que el plan ha mirado y no ficha: la IA no lo recomienda como fichaje (antes solo lo sabía si la operación,
  // suelta, no pasaba; lo que el plan deja fuera por pagar de más o por el resto del plan no le llegaba)
  let noFichaTxt = '';
  try {
    const q0 = norm(pregunta), yoT = D.yo && D.yo.teamId;
    const Rm = planDeHoy(D, M, c);
    const L0 = ((Rm && Rm.descartes) || []).filter((d) => d && d.pid && d.jugador && M.dueno[d.pid] !== yoT);
    const nombra = L0.filter((d) => q0.includes(norm(d.jugador).split(' ').pop()));
    const lista = nombra.length ? nombra : /\b(fich|puj|compr|clausul|mercado|chollo|refuerz|a quien|que hago|que hacer|recomiend)/.test(q0) ? L0.slice(0, 6) : [];
    if (lista.length) noFichaTxt = `\n\nLO QUE EL PLAN DE HOY HA MIRADO Y NO FICHA (lo ve en Hoy, en «Mirados y descartados»; no los recomiendes como fichaje y, si pregunta por uno, explícale este motivo): ${lista.map((d) => `${d.jugador}: ${cortar(d.motivo || d.detalle || '', 150)}`).join(' | ')}`;
  } catch (e) { noFichaTxt = ''; }
  let dijoAntes = '';
  try {
    const L = [];
    for (const k of consejosChat(M, hist)) {
      const d = M.decision ? M.decision(k.pid) : null;
      if (!d || (k.clase === 'V') === (d.accion === 'vender' && d.paso !== 'esperar')) continue;
      L.push(`${k.clase === 'V' ? 'que vendiera a' : 'que aguantara a'} ${d.j.nombre}${k.ts ? ` (${cuando(k.ts)})` : ''}; ahora la app dice «${d.corta}»: ${String(d.porque || '').replace(/[.\s]+$/, '')}`);
    }
    if (L.length) dijoAntes = `\n\nTÚ DIJISTE ANTES en esta conversación ${L.join('. Y ')}. Si sale el tema, di que antes le aconsejaste otra cosa y qué ha cambiado; nunca «te he dicho que…» negándolo ni «mi recomendación sigue igual» si ya no es la de la app.`;
  } catch (e) { dijoAntes = ''; }
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
  // (19 nov) un trato entre managers con sus precios: lo calcula la app y la IA lo explica (como las ofertas)
  let trato = null;
  try { trato = tratoDeChat(pregunta, D, M, (hist || []).filter((m) => m.r === 'yo').slice(-4, -1).map((m) => m.t || '')); } catch (e) { trato = null; }
  for (const x of trato ? [...trato.mios, ...trato.suyos] : []) meter(x.j);
  const extra = nombrados.length ? `\n\nJUGADORES QUE NOMBRA EN SU MENSAJE:\n${nombrados.map((j) => `- ${lineaCompleta(D, M, j)}`).join('\n')}${cuentasTxt(D, M, nombrados, { web, trato })}${trato ? tratoTxt(D, M, trato) : ''}` : '';
  // (20 nov) vender o quedarse a los suyos: los que nombra o, si pregunta en general («¿a quién vendo?»), los que la app
  // vendería o protegería primero
  let ventas = '';
  try {
    const yo = D.yo && D.yo.teamId;
    const mios = nombrados.filter((j) => M.dueno[j.id] === yo);
    if (!trato && mios.length && (vaDeVender(`${pregunta} ${antes}`) || laligaYaDa(pregunta))) ventas = ventasMiasTxt(D, M, mios, c, { laligaYa: laligaYaDa(pregunta) });
    else if (!trato && !nombrados.length && /\b(vendo|vender|vendemos|me quedo|quedarme\w*|hago caja|hacer caja|especulo)\b/.test(norm(pregunta)) && !/\b(clausul|fich|compr|puj)\w*/.test(norm(pregunta))) ventas = ventasMiasTxt(D, M, vendiblesMios(M), c);
  } catch (e) { ventas = ''; }
  // los rivales de los que habla (ahora o en sus últimos mensajes: «¿y de toda su plantilla?»)
  let enteros = rivalesEn(pregunta, D, M);
  if (!enteros.size && antes) enteros = rivalesEn(antes, D, M);
  // (19 nov) también por su apodo o con el nombre mal dictado («leao ere espabilado», «el Tito»): antes la IA lo entendía
  // por los alias, pero a ese rival no le llegaban los datos enteros (titularidad, próximo partido)
  if (!enteros.size) enteros = rivalesAprox(pregunta, D, M);
  if (!enteros.size && antes) enteros = rivalesAprox(antes, D, M);
  let rivales = '', mias = '';
  try { rivales = plantillasRivalesTxt(D, M, enteros, { nombrados: new Set(nombrados.map((j) => String(j.id))), ofertas: /\b(ofrec\w*|oferta\w*|cuanto|precio|trato|cambi\w*)\b/.test(norm(`${pregunta} ${antes}`)) }); } catch (e) { rivales = ''; }
  try { mias = misClausulasTxt(D, M); } catch (e) { mias = ''; }
  // el plan, entero solo si la pregunta va de él o de sus jugadores; si no, que sepa que existe y poco más
  let plan = '', cambiosPlan = '';
  if (p) {
    const ops = p.operaciones || [];
    let cu = null;
    // (24 nov, Senna) el plan de la IA le llega como se ve en Hoy: repasado con los datos de ahora, con el titular que ve él
    // (antes, el que escribió la IA: «vender a X» con Hoy diciendo otra cosa) y, si el repaso ha cambiado algo, dicho
    let visto = null;
    try { visto = p.motorHoy ? null : cuadrarPlan(p, D, M); cu = opsCuadradas(p.motorHoy ? p.ops.filter((o) => !o.descartada) : visto.ops); } catch (e) { cu = p.cuadradas || null; }
    const titularHoy = visto && visto.titular ? visto.titular : p.titular;
    cambiosPlan = visto ? cambiosDesde(p, visto, M) : '';
    const q = norm(pregunta);
    const vaDelPlan = /\b(plan|operaciones|hoy)\b/.test(q) || (!deAhora && !enteros.size && /\b(que hago|que hacer|que me recomiendas|vend|compr|fich|puj|alin)/.test(q)) || ops.some((o) => o.jugador && q.includes(norm(o.jugador).split(' ').pop()));
    const cab = p.motorHoy ? 'EL PLAN DE HOY QUE VE EN LA APP (lo ha hecho la app, no tú)' : `${diaDe(p.t) === diaDe() ? 'EL PLAN DE HOY' : 'EL ÚLTIMO PLAN'} QUE LE DISTE (${cuando(p.t)})`;
    // del plan de la app van también el cuándo y el porqué de cada paso (lo que ve él en Hoy), para «¿por qué me dice que…?»
    const pasos = p.motorHoy ? p.ops.filter((o) => !o.descartada).slice(0, 8).map((o) => `- ${o.retira ? 'retirar la puja por' : o.accion === 'esperar' ? 'esperar a' : o.accion} ${(o.j && o.j.nombre) || o.jugador || ''}${o.importe ? ` ${eur(o.importe)}` : ''}${o.cuando ? ` (${o.cuando})` : ''}: ${String(o.motivo || '').replace(/\s*\(interés \d+\)/g, '').split(/(?<=\.)\s/).slice(0, 3).join(' ')}`).join('\n') : '';
    plan = vaDelPlan
      ? (pasos ? `\n\n${cab}, de referencia (no lo repitas si no viene a cuento; si te pregunta por un paso, explícalo con su porqué): ${titularHoy}\n${pasos}`
        : `\n\n${cab}, solo de referencia (no lo repitas si no viene a cuento): ${titularHoy} → ${cu ? opsTxt(cu) || 'nada' : ops.map((o) => `${o.accion} ${o.jugador}`).join('; ')}`)
      : `\n\n${cab}: «${titularHoy}». Esta pregunta no va del plan: no lo nombres.`;
    if (cambiosPlan) plan += cambiosPlan;
  }
  // (segunda pasada con Haiku, 16 nov) «función top cerrada» de los datos lo copiaba tal cual en la respuesta
  // (lo de lo que queda para pujar ya sale bien dicho de contexto, para el plan y el chat: 17 nov)
  const ctx = contexto(D, M, c, { chat: true }).replace(/funci[oó]n top cerrada/g, 'cerrado en su cuenta');
  // (19 nov) lo de la liga primero y lo de esta pregunta detrás de MARCA_PREGUNTA: lo de la liga va en la caché de la IA entre
  // una pregunta y la siguiente de la misma conversación (en el Worker, cuesta una décima parte). Para que la caché valga, en
  // la misma conversación se repite tal cual (fotoChat) mientras no cambien la liga ni lo que tienes abierto, hasta 10 min;
  // la hora de verdad va abajo
  const liga = fotoChat(D, `${CABECERA_DATOS}\n${ctx}${mias ? `\n${mias}` : ''}`, hist);
  const ahoraTxt = liga.t ? `AHORA: ${fechaLarga(Date.now())}, ${horaDe(Date.now())} (hora de España). Los datos de arriba son de las ${horaDe(liga.t)}: lo que pone «en N h» o «hace N min» cuenta desde esa hora.\n` : '';
  // (22 nov) lo que acaba de contar en este mensaje y la app ya ha apuntado, o lo que ha dicho sin decir de quién
  let dichoAhora = '';
  try {
    const rec = deEstaPregunta(DICHO_AHORA, pregunta) ? notasVigentes().filter((n) => DICHO_AHORA.ids.includes(n.id)) : [];
    const pend = deEstaPregunta(PENDIENTE, pregunta) ? PENDIENTE.lista : [];
    const tot = rec.some((n) => n.corr === 'puja') ? ` (con ella tiene pujados ${eur(M.misPujas)} EN TOTAL: no le sumes nada)` : '';
    if (rec.length) dichoAhora += `\nLO QUE ACABA DE CONTARTE EN ESTE MENSAJE Y LA APP YA HA APUNTADO (los datos de arriba ya van así; desde ahora el plan, Hoy y los avisos lo cuentan): ${rec.map((n) => n.texto).join('; ')}${tot}. Dile en media frase que queda apuntado y que el plan ya lo tiene en cuenta (lo ve en Hoy, en «Lo que me has dicho», y ahí lo puede quitar). No digas que lo quitas tú del plan ni «la próxima vez»: ya está hecho.\n`;
    if (pend.length) dichoAhora += `\nHA DICHO ${pend.map((x) => (x.corr === 'no-vender' ? 'que no vende a un jugador' : x.corr === 'puja' ? 'que ya ha hecho una puja' : 'que ya ha blindado a uno')).join(' y ')} SIN DECIR A QUIÉN: si por la conversación está claro, pon su nombre exacto en «jugador» al apuntarlo; si no, pregúntale a cuál se refiere.\n`;
  } catch (e) { dichoAhora = ''; }
  let dineroTxtQ = '';
  try {
    const { cerrados: cer, abiertos: abi } = dineroPreguntado(pregunta, D, M, antes);
    // (el que ha abierto viendo sus anuncios: las instrucciones dicen «cerrado» en general y la IA se lo negaba también de ese)
    if (abi.length) dineroTxtQ += `\nPREGUNTA POR EL DINERO DE ${abi.map((x) => x.nombre).join(' y ')}, QUE LO TIENE ABIERTO (ha visto sus anuncios): díselo con la cifra y su ± tal cual van arriba en RIVALES. Lo de «cerrado en su cuenta» no va con ${abi.length === 1 ? 'este rival' : 'estos rivales'}.\n`;
    if (cer.length) dineroTxtQ += `\nPREGUNTA POR EL DINERO DE ${cer.length === 1 ? cer[0].nombre.toUpperCase() : 'RIVALES'} Y LO TIENE CERRADO: no se lo digas de ninguna forma. Ni una cifra, ni «mucho», «algo», «poco», «saldo medio», ni si tiene más o menos que otro o que él, ni si le llega para algo: la categoría que ves arriba es solo para que tú decidas, no para contarla. Dile en una frase, de tú («lo tienes cerrado en tu cuenta»), que eso ${comoSeAbre()}, y si quieres añade algo útil que NO sea su dinero (lo que ha gastado esta semana, sus movimientos). No uses las palabras «categoría» ni «desbloquear».\n`;
  } catch (e) { dineroTxtQ = ''; }
  // (22 nov, Domy) le cuenta una oferta que le han hecho: es un hecho aunque no salga en los datos
  const ofertaTxtQ = cuentaOferta(pregunta) ? '\nTE CUENTA UNA OFERTA O UN TRATO QUE LE HAN HECHO: es un HECHO, aunque no salga en los datos (lo que se habla por WhatsApp o de palabra, y a veces lo último de LaLiga, no llega a la app). NO le digas que no la ves, que no aparece o que la compruebe: dala por buena y valórala con sus cifras y las de los datos (lo que vale el jugador, su tendencia, lo que ha hecho en la jornada, lo que le daría LaLiga, lo que pagaría un rival y lo que pierde su once), y dile si la acepta, si pide más (cuánto) o si no. Si dice que LaLiga YA le da una cifra por uno suyo, es que ya lo tiene en venta y esa oferta ya está hecha: no le digas que llegará en el próximo cambio ni que tiene que ponerlo a la venta; compárala con su valor y su tendencia y dile si la coge hoy o espera a la de mañana.\n' : '';
  const largoTxt = '\n\nLARGO DE TU RESPUESTA: 5 frases como mucho en total, contando cada punto de una lista (salvo que pida la lista entera). Si pregunta por varios jugadores o varias cosas, una frase por cada una y solo lo que decide.';
  // (24 nov) una compra a otro mánager a un precio que él cuenta: es un hecho, con las cuentas de la app
  let compraTxtQ = '';
  try {
    const antesQ = (hist || []).filter((m) => m.r === 'yo').slice(-3).map((m) => m.t || '').filter((t) => t !== pregunta).join(' ');
    const C = compraContada(pregunta, D, M, antesQ);
    if (C) compraTxtQ = compraTxt(D, M, C);
  } catch (e) { compraTxtQ = ''; }
  return `${liga.texto}${MARCA_PREGUNTA}${ahoraTxt}${dichoAhora}${dineroTxtQ}${ofertaTxtQ}${compraTxtQ}${rivales ? `${rivales}\n` : ''}${extra}${ventas}${plan}${noFichaTxt}${dijoAntes}`.replace(/\n+$/, '') + largoTxt;
}
/** lo de la liga del chat, repetido igual en la misma conversación: { texto, t } (t: la hora de la foto si es de antes) */
let FOTO = null;
export function fotoChat(D, texto, hist = [], ahora = Date.now()) {
  const clave = `${D && D.t}|${D && D.liga && D.liga.id}|${Object.keys(SOBRE_BLOQUEO).filter((k) => bloqueada(k)).join()}|${rivalesAbiertos().join()}|${LS.get(K('notas-t'), 0)}`;
  if (FOTO && (hist || []).length && FOTO.clave === clave && ahora - FOTO.t < 10 * 60e3 && diaDe(FOTO.t) === diaDe(ahora)) return { texto: FOTO.texto, t: FOTO.t };
  FOTO = { clave, texto, t: ahora };
  return { texto, t: 0 };
}
/** cómo se le pide al chat el tono y lo cerrado (lo mismo va al Worker) */
export const opcionesChat = () => ({ tono: tonoDe(cfgIA().pullitas || 'normal'), bloq: Object.keys(SOBRE_BLOQUEO).filter((k) => bloqueada(k)), anuncio: topConAnuncio() });
/** lo que va a la IA en el chat con tu clave (sin la conversación): se exporta para probarlo con la demo */
export function montarChat(pregunta, D, M, c, { fotos = false, hist = [], web = cfgIA().web, alias = null } = {}) {
  return `${sistemaChat({ ...opcionesChat(), fotos, web, alias })}\n\n${datosChat(pregunta, D, M, c, { hist, web })}`;
}

/* ---------------- el chat con la IA de la app (16 nov) ----------------
   Como los planes: la pregunta va al Worker (/pregunta), que la hace con la IA de Carlos y la guarda con un id (rid). Si
   sales de la app, Android la congela y se corta la conexión, pero allí se sigue haciendo: al volver, la app pide lo mismo
   con el mismo id y le llega la respuesta que ya estaba hecha (sin gastar otra pregunta). El id se queda guardado con la
   pregunta hasta que llega la respuesta, por si Android cierra la app del todo: al abrirla, reanudarPregunta la recoge.
   Cupo: «preguntas» de limites.json (3 al día y 3 más con un anuncio, 6 como mucho; Carlos, 17 nov). La clave de Google de cada
   uno queda de reserva si el servicio no está. */
export const preguntasApp = (demo) => !demo && preguntasCfg().on;
/** ¿se puede usar el chat? (la IA de la app o tu clave) */
export const puedeChat = (demo) => preguntasApp(demo) || hayClave();
/** lo último que ha dicho el Worker del cupo de preguntas de hoy, o null */
export function cupoPreguntas() {
  const g = LS.get('preg-cupo', null);
  return g && g.dia === diaDe() ? g : null;
}
const guardarCupoP = (cu) => { if (cu && typeof cu === 'object') LS.set('preg-cupo', { ...cu, dia: diaDe() }); };
/** la pregunta en marcha (para recogerla al volver o al abrir la app): { rid, t, ts, dia } */
export const preguntaPendiente = () => { const p = LS.get('preg-rid', null); return p && p.dia === diaDe() && Date.now() - p.ts < 15 * 60e3 && /^[a-z0-9]{8,24}$/.test(p.rid || '') ? p : null; };
const nuevoRid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 20);
/** al Worker: devuelve { texto (destapado), tok, cupo } o lanza un ErrorIA (cupo: sin preguntas; servicio: no está) */
async function preguntaPorApp(cuerpo, seudo, { signal, alPaso, textoQ = '' } = {}) {
  const t0 = Date.now();
  const parado = () => Object.assign(new Error('Parado'), { name: 'AbortError' });
  // una petición que, si la app vuelve de segundo plano con ella aún sin contestar, se da por cortada a los 3 s (Android
  // congela la app y corta la conexión; el servidor la sigue y se recoge con el mismo id). En el navegador, cambiar de
  // pestaña no corta nada: ahí no se da por cortada (antes se repetía la petición al volver a la pestaña)
  const una = () => new Promise((ok, ko) => {
    let hecho = false, reloj = null;
    const fin = () => { hecho = true; if (reloj) clearTimeout(reloj); window.removeEventListener('fm-vuelta', vuelta); document.removeEventListener('visibilitychange', vis); };
    const vuelta = () => { if (hecho || reloj) return; reloj = setTimeout(() => { if (hecho) return; fin(); ko(Object.assign(new Error('Sin conexión'), { estado: 0, detalle: 'la app ha vuelto de segundo plano' })); }, 3000); };
    const vis = () => { if (!document.hidden) vuelta(); };
    if (enApp) { window.addEventListener('fm-vuelta', vuelta); document.addEventListener('visibilitychange', vis); }
    pedirWorker('POST', '/pregunta', cuerpo, { tiempo: 90000, signal }).then((r) => { if (!hecho) { fin(); ok(r); } }, (e) => { if (!hecho) { fin(); ko(e); } });
  });
  const aLaVista = () => new Promise((ok) => {
    if (nativo.aLaVista()) return ok();
    const ya = () => { window.removeEventListener('fm-vuelta', ya); document.removeEventListener('visibilitychange', ya); ok(); };
    window.addEventListener('fm-vuelta', ya);
    document.addEventListener('visibilitychange', ya);
  });
  if (alPaso) alPaso('La IA está leyendo tu liga…');
  // (16 nov) si sales de la app con la pregunta en marcha, Android avisa «Pensando tu respuesta» y, al contestar, «Tu
  // director deportivo ha contestado» (Recoger.java; desde la parte Android de la 0.8)
  if (enApp && cuerpo.rid) { try { nativo.preguntaEnMarcha(cuerpo.rid, await token(), (seudo && seudo.vuelta) || {}, textoQ); } catch (e) { /* sin sesión: lo dirá el Worker */ } }
  let j;
  try {
    for (let vez = 0; ; vez++) {
      try { j = await una(); break; } catch (e) {
        if (e.name === 'AbortError' || e.estado !== 0 || vez >= 3 || (signal && signal.aborted)) throw e;
        if (Date.now() - t0 > 150000) throw Object.assign(new Error('La IA ha tardado demasiado. Vuelve a preguntar en un rato.'), { estado: 0, detalle: 'más de 2 min y medio' });
        apuntar({ modelo: 'app', s: 'chat', e: `la IA de la app: corte${e.detalle ? ` (${e.detalle})` : ''}; lo repito`, ms: Date.now() - t0 });
        await aLaVista();
        if (alPaso) alPaso('Recogiendo la respuesta…');
        await new Promise((ok) => setTimeout(ok, 1200));
        if (signal && signal.aborted) throw parado();
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const d = e.datos || {};
    if (d.cupo) guardarCupoP(d.cupo);
    apuntar({ modelo: 'app', s: 'chat', e: `la IA de la app: ${e.estado || 0} ${e.message}${e.detalle ? ` (${e.detalle})` : ''}`, ms: Date.now() - t0 });
    if (e.estado === 429 && d.cupo) throw new ErrorIA(e.message, 429, { cupo: d.cupo, corte: false });
    if (e.sesion || e.estado === 401) throw new ErrorIA(e.message || 'No se ha podido comprobar tu cuenta de LaLiga ahora mismo.', 401, { servicio: true });
    if (e.estado === 0) throw new ErrorIA('Se ha cortado la conexión. Vuelve a preguntar (si ya estaba hecha, no cuenta otra vez).', 0, { red: true, corte: true });
    throw new ErrorIA('La IA no está disponible ahora mismo. Vuelve a preguntar en un rato.', e.estado || 0, { servicio: true });
  }
  if (j && j.e) {
    apuntar({ modelo: 'app', s: 'chat', e: `la IA de la app: ${j.estado || 200} ${j.e}`, ms: Date.now() - t0 });
    throw new ErrorIA(j.e, j.estado || 0, { servicio: !!j.servicio });
  }
  if (j.cupo) guardarCupoP(j.cupo);
  apuntar({ modelo: 'app', s: 'chat', ok: true, ms: Date.now() - t0, tok: j.tok || null, car: String(j.texto || '').length });
  const texto = String(j.texto || '');
  return { texto: seudo && seudo.n ? seudo.destapar(texto) : texto, tok: j.tok || null, cupo: j.cupo || null };
}

/** lo que se hace con una respuesta (de la app o de tu clave): notas, revisión y guardarla en el chat */
function rematarRespuesta(r, pregunta, D, M, fotos, hist, dicho = []) {
  const n = aplicarNotas(sinWebsChat(sinModelos(r.texto)), D, pregunta, !!(fotos && fotos.length), M);
  // (22 nov) lo que apuntó la app al leer su mensaje va con lo apuntado, para que lo vea debajo de la respuesta
  n.apuntadas = [...(dicho || []), ...n.apuntadas];
  // (revisión de la IA, 14 nov) lo que contesta se revisa antes de guardarlo, como el plan: lo que recomienda hacer, las
  // cifras que da de sus jugadores y de su saldo, las cuentas y lo que la IA no puede decir
  let rev = { texto: n.texto, notas: [] };
  try { rev = revisarChat(n.texto, pregunta, D, M, { rec: n.recomiendo, hist, apuntado: n.apuntadas.length + n.olvidadas }); } catch (e) { rev = { texto: n.texto, notas: [] }; }
  n.texto = rev.texto;
  // (22 nov) preguntaba por el dinero de un rival que tiene cerrado: de la respuesta se quita lo que lo cuente
  try {
    const antesQ = (hist || []).filter((m) => m.r === 'yo').slice(-3, -1).map((m) => m.t || '').join(' ');
    const sd = sinDineroCerrado(n.texto, dineroCerradoDe(pregunta, D, M, antesQ));
    if (sd.quitadas || sd.texto !== n.texto) n.texto = sd.texto;
  } catch (e) { /* como llegó */ }
  // (22 nov, Domy) le contaba una oferta: «no la veo en la app» no es una respuesta
  try { if (cuentaOferta(pregunta)) n.texto = sinNoLaVeo(n.texto).texto; } catch (e) { /* como llegó */ }
  // (repaso de la 0.8s) «LaLiga me da X»: la oferta ya está; «llega mañana» o «ponlo a la venta» no es una respuesta
  try { if (laligaYaDa(pregunta)) n.texto = sinLlegaManana(n.texto).texto; } catch (e) { /* como llegó */ }
  const h2 = conversacion();
  h2.push({ r: 'ia', t: n.texto, ts: Date.now(), fuentes: (r.fuentes || []).slice(0, 8), modelo: r.modelo, apuntadas: n.apuntadas.map((x) => (x.corr ? `${dichoTxt(x, x.jugador)}${x.corr === 'puja' && x.importe ? ` (${eur(x.importe)})` : ''}${x.caduca ? `, hasta ${cuando(x.caduca, { hora: x.corr !== 'no-vender' })}` : ''}. El plan ya lo cuenta así.` : x.texto)), olvidadas: n.olvidadas });
  guardarChat(h2.slice(-40));
  return { ...r, texto: n.texto, apuntadas: n.apuntadas, olvidadas: n.olvidadas, revisado: rev.notas };
}

/* (20 nov, Carlos: «lo de Huijsen está desfasado: se lo compré ayer a Domy») la conversación guardada iba entera a la IA,
   aunque fuera de antes del último cambio de mercado: lo que se habló ayer de clausular a Huijsen (de Domy entonces)
   seguía pesando hoy, con Huijsen ya tuyo. Ahora solo lo de después del último cambio de mercado (12 h como mucho), y
   lo de la IA de hace más de 10 minutos, marcado con cuándo se dijo */
export function histVigente(hist, M, ahora = Date.now()) {
  const sig = M && M.cierreMercado;
  const ultCambio = sig && sig > ahora ? sig - DIA : sig && sig <= ahora ? sig : 0;
  const corte = Math.max(ahora - 12 * HORA, ultCambio || 0);
  const out = [];
  for (const m of hist || []) {
    // (los que no llevan hora se quedan: todos los de la app la llevan desde que existe el chat)
    if (!m || (m.ts && m.ts < corte)) continue;
    // (Carlos: «la IA debe estar actualizada al momento») lo que contestó hace más de 10 minutos va marcado: manda lo de ahora
    const min = m.ts ? (ahora - m.ts) / 60000 : 0;
    const hace = min >= 90 ? `${Math.round(min / 60)} h` : `${Math.round(min)} min`;
    out.push(min >= 10 && m.r === 'ia' ? { ...m, t: `[dicho hace ${hace}: puede estar desfasado; si los datos de ahora dicen otra cosa, mandan los de ahora] ${m.t || ''}` } : m);
  }
  return out;
}
/** con la IA de la app: la conversación de antes (sin la pregunta de ahora), con alias y sin fotos */
function histParaApp(hist, seudo) {
  const tap = (t, aprox) => (seudo && seudo.n ? seudo.tapar(t, { aprox }) : t);
  return hist.slice(0, -1).slice(-12).map((m) => {
    let t = m.r === 'ia' ? separarNotas(m.t || '').texto.replace(/\n\n\*\*Revisado por la app:\*\*[\s\S]*$/, '') : (m.t || '');
    if (m.r === 'yo' && Array.isArray(m.fotos) && m.fotos.length) t = `${t}${t ? '\n' : ''}[Aquí mandó ${m.fotos.length} captura${m.fotos.length > 1 ? 's' : ''}: tira de lo que contestaste.]`;
    return { r: m.r === 'ia' ? 'ia' : 'yo', t: tap(t, m.r !== 'ia').slice(0, 5800) };
  }).filter((m) => m.t.trim());
}

/** lo que se manda al Worker en /pregunta (se exporta para probar que el Worker lo acepta) */
export function pedidoChat(pregunta, D, M, c, hist, fotos, { extra = false, rid = '' } = {}, seudo = seudonimos(D)) {
  const datos = datosChat(pregunta, D, M, c, { hist, web: false });
  const fs = (fotos || []).map((f) => f && f.b64).filter((b) => typeof b === 'string' && b.length < 880000).slice(0, 3);
  const o = opcionesChat();
  const cuerpo = {
    datos: seudo.n ? seudo.tapar(datos) : datos, pregunta: seudo.n ? (({ t, nota }) => `${t.slice(0, 3000 - nota.length)}${nota}`)(seudo.taparPregunta(pregunta || '')) : (pregunta || ''), hist: histParaApp([...histVigente(hist.slice(0, -1), M), ...hist.slice(-1)], seudo), fotos: fs,
    conFotos: hist.some((m) => m.fotos && m.fotos.length), ...o, alias: seudo.n ? { puesto: !!seudo.porPuesto, ex: !!seudo.ex } : null, extra: !!extra, rid,
  };
  return cuerpo;
}
async function charlarApp(pregunta, D, M, c, hist, fotos, { signal, alPaso, extra = false, rid } = {}) {
  const seudo = seudonimos(D);
  const cuerpo = pedidoChat(pregunta, D, M, c, hist, fotos, { extra, rid }, seudo);
  const r = await preguntaPorApp(cuerpo, seudo, { signal, alPaso, textoQ: pregunta });
  return { texto: r.texto, fuentes: [], modelo: 'app', tok: r.tok, cupo: r.cupo };
}

/** con tu clave de Google (la reserva, o si la app no tiene la IA de las preguntas encendida) */
async function charlarClave(pregunta, D, M, c, hist, nuevas, fotos, alTexto, signal, alPaso) {
  const contents = await contenidosChat([...histVigente(hist.slice(0, -1), M), ...hist.slice(-1)], nuevas);
  const web = cfgIA().web, conFotos = !!(fotos && fotos.length) || hist.some((m) => m.fotos);
  const seudo = seudonimos(D);
  const alias = seudo.n ? { puesto: !!seudo.porPuesto, ex: !!seudo.ex } : null;
  const sistema = montarChat(pregunta, D, M, c, { fotos: conFotos, hist, web, alias });
  // sin búsqueda (apagada, cupo gastado o en el relevo) no se le manda buscar: si se le manda, a veces contesta vacío
  const sistemaSinWeb = web ? montarChat(pregunta, D, M, c, { fotos: conFotos, hist, web: false, alias }) : sistema;
  // (el aviso de los alias ya va dentro del sistema: preguntar no lo vuelve a poner)
  const sd = seudo.n ? { ...seudo, aviso: '' } : seudo;
  return preguntar({ sistema, sistemaSinWeb, contents }, { stream: true, alTexto: alTexto ? (t) => alTexto(sinWebsChat(sinModelos(separarNotas(t).texto))) : null, signal, alPaso: alPaso || undefined, nivel: 'low', temperatura: 0.4, seudo: sd });
}

/** el principio de una respuesta para el aviso del móvil: sin markdown ni la revisión de la app */
export const resumenAviso = (t) => String(t || '').replace(/\n\n\*\*Revisado por la app:\*\*[\s\S]*$/, '').replace(/[*_#>`]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\s+/g, ' ').trim().slice(0, 300);
/** a Android: la pregunta ha acabado (el aviso, si la app no está a la vista) */
const acabadaApp = (ok, t) => { if (enApp) nativo.preguntaAcabada(ok, ok ? resumenAviso(t) : String(t || '')); };

export async function charlar(pregunta, D, M, c, alTexto, signal, fotos = [], alPaso = null, { extra = false, dicho = [] } = {}) {
  const hist = conversacion();
  const nuevas = Object.fromEntries((fotos || []).map((f) => [f.id, f.b64]));
  // (la miniatura va a IndexedDB y en el chat solo su id; si IndexedDB no va, se vuelve a meter en el chat)
  hist.push({ r: 'yo', t: pregunta, ts: Date.now(), ...(fotos && fotos.length ? { fotos: fotos.map((f) => ({ id: f.id })) } : {}) });
  guardarChat(hist.slice(-40));
  for (const f of fotos || []) {
    guardarFoto(f).catch(() => {});
    guardarMini(f.id, f.mini).then((ok) => { if (!ok) reponerMini(f.id, f.mini); }).catch(() => reponerMini(f.id, f.mini));
  }
  let r;
  if (preguntasApp(!!D.demo)) {
    // (la misma pregunta otra vez tras un corte: con el mismo id, así llega la que ya estaba hecha y no cuenta dos veces)
    const pend = preguntaPendiente();
    const rid = pend && pend.t === pregunta && !(fotos || []).length ? pend.rid : nuevoRid();
    LS.set('preg-rid', { rid, t: pregunta, ts: pend && pend.rid === rid ? pend.ts : Date.now(), dia: diaDe(), fotos: (fotos || []).length });
    try {
      r = await charlarApp(pregunta, D, M, c, hist, fotos, { signal, alPaso, extra, rid });
      LS.del('preg-rid');
      const fin = rematarRespuesta(r, pregunta, D, M, fotos, hist, dicho);
      acabadaApp(true, fin.texto);
      return fin;
    } catch (e) {
      // (un corte de conexión deja el id: al volver a preguntar lo mismo, o al abrir la app, se recoge sin contar otra vez)
      if (!e.corte) LS.del('preg-rid');
      // el servicio no está y tienes tu clave: con ella (el aviso de Android, al acabar esa)
      if (!(e.servicio && hayClave() && e.name !== 'AbortError')) { acabadaApp(false, e.name === 'AbortError' ? '' : e.message); throw e; }
      try { r = await charlarClave(pregunta, D, M, c, hist, nuevas, fotos, alTexto, signal, alPaso); } catch (e2) { acabadaApp(false, e2.name === 'AbortError' ? '' : e2.message); throw e2; }
      const fin = rematarRespuesta(r, pregunta, D, M, fotos, hist, dicho);
      acabadaApp(true, fin.texto);
      return fin;
    }
  } else r = await charlarClave(pregunta, D, M, c, hist, nuevas, fotos, alTexto, signal, alPaso);
  return rematarRespuesta(r, pregunta, D, M, fotos, hist, dicho);
}

/**
 * Al abrir la app o volver a ella: si quedó una pregunta a la IA de la app sin respuesta (Android cerró la app), se recoge
 * con su id. Devuelve la respuesta, null si no había nada que recoger, o lanza el error.
 */
export async function reanudarPregunta(D, M, c, { signal, alPaso } = {}) {
  const p = preguntaPendiente();
  if (!p || !preguntasApp(!!D.demo)) return null;
  const hist = conversacion();
  const ult = hist[hist.length - 1];
  if (!ult || ult.r !== 'yo' || (ult.t || '') !== (p.t || '')) { LS.del('preg-rid'); return null; }
  try {
    const r = await charlarApp(p.t, D, M, c, hist, [], { signal, alPaso, rid: p.rid });
    LS.del('preg-rid');
    const fin = rematarRespuesta(r, p.t, D, M, [], hist);
    acabadaApp(true, fin.texto);
    return fin;
  } catch (e) {
    acabadaApp(false, e.message);
    if (!e.corte) LS.del('preg-rid');
    throw e;
  }
}
