/* La IA: Gemini (Google AI Studio) con tu clave gratuita, llamada directamente desde el móvil a Google.
   Hace el plan del día (las operaciones en orden: qué vender, qué comprar, a quién clausular, cuánto pujar)
   cruzando todo lo de tu liga con lo que busca en Google (lesiones, convocatorias, alineaciones probables).
   Prueba todos los modelos gratuitos que tenga tu clave antes de rendirse, y si se acaba la búsqueda en
   Google, sigue sin ella. Cada intento queda apuntado para el diagnóstico. */
import { leer, guardar, http, enApp, despues } from './puente.js';
import { LS, eur, pct, cuando, dura, POS, DIA, diaDe, norm, num, esWebFantasy, sinWebs } from './util.js';
import { K } from './datos.js';
import { favoritos } from './favoritos.js';
import { catalogo, catalogoTxt, comoConseguir, buscarOp, porQueNo, cajaConOfertas, esMalo } from './operaciones.js';
import { recsDe, aprendeTxt } from './aprende.js';
import { guardarFoto, leerFoto } from './fotos.js';
import { bloqueada, topConAnuncio } from './limite.js';

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
export const cfgIA = () => ({ modelo: '', web: true, auto: true, ...LS.get('cfg-ia', {}) });
export const guardarCfgIA = (c) => LS.set('cfg-ia', { ...cfgIA(), ...c });

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
/* el modelo que contestó bien la última vez va el primero durante 3 horas (los nuevos suelen estar saturados y cada intento
   con ellos cuesta de 20 s a minutos); pasadas las 3 horas se vuelve a probar el orden de siempre */
const BUENO_H = 3 * 3600 * 1000;
const RELEVO_MS = 45000, SILENCIO_MS = 30000;
/* un modelo que con la búsqueda contesta con una llamada rota (MALFORMED_FUNCTION_CALL) va una hora sin ella */
const malConWeb = (m) => (LS.get('ia-mal-web', {})[m] || 0) > Date.now();
const marcarMalConWeb = (m) => { const a = LS.get('ia-mal-web', {}); a[m] = Date.now() + 3600 * 1000; LS.set('ia-mal-web', a); };
const recordarBueno = (m) => { const b = LS.get('ia-bueno', null); LS.set('ia-bueno', { m, desde: b && b.m === m && Date.now() - b.desde < BUENO_H ? b.desde : Date.now() }); };
async function cadena() {
  let lista;
  try { lista = await modelosDisponibles(); } catch (e) { if (e.estado === 400 || e.estado === 401 || e.estado === 403) throw e; lista = BASE; }
  if (!lista.length) lista = BASE;
  const elegido = cfgIA().modelo;
  const todos = [...new Set([...(elegido ? [elegido] : []), ...lista])];
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
  if (estado === 401 || (estado === 403 && /PERMISSION_DENIED|SERVICE_DISABLED|has not been used/i.test(todo))) return new ErrorIA('Google no deja usar Gemini con esta clave. Crea otra en aistudio.google.com/apikey (mejor en un proyecto nuevo).', estado, { ...info, clave: estado === 401 || /SERVICE_DISABLED|has not been used|API_KEY_SERVICE_BLOCKED/i.test(todo) });
  if (estado === 404) return new ErrorIA('Ese modelo no existe para tu clave', 404, info);
  if (estado === 429) {
    const busqueda = /search|grounding/i.test(todo);
    const minuto = /per.?minute|PerMinute|retry in \d+(\.\d+)?s/i.test(todo) && !/per.?day|PerDay/i.test(todo);
    const cero = /limit:\s*0\b/.test(todo);
    return new ErrorIA(busqueda ? 'Se ha acabado la búsqueda en Google gratis de hoy' : cero ? 'Este modelo no tiene cupo gratis' : minuto ? 'Demasiadas preguntas seguidas' : 'Cupo gratis del día gastado', 429, { ...info, busqueda, minuto, cero });
  }
  if (estado >= 500) return new ErrorIA('Google está saturado ahora mismo', estado, info);
  return new ErrorIA(m || `Error ${estado} de Google`, estado, info);
}

/* el registro de intentos, para Ajustes → Diagnóstico */
export const intentosIA = [];
const apuntar = (x) => { intentosIA.unshift({ t: Date.now(), ...x }); if (intentosIA.length > 60) intentosIA.length = 60; };

/**
 * Una petición a Google. En la app va por la parte nativa (el WebView corta los POST a Google con «Failed to fetch»);
 * en el navegador, con fetch. Devuelve { j } con el JSON o { r } con la respuesta en streaming (solo navegador).
 */
async function peticion(metodo, url, cuerpo, k = clave(), { stream = false, signal, limite = 150000 } = {}) {
  const sinTiempo = (m) => new ErrorIA(`Sin conexión con Google (${m})`, 0, { red: true, tiempo: true });
  if (enApp) {
    const pet = http(metodo, url, { cabeceras: { 'content-type': 'application/json', 'x-goog-api-key': k }, cuerpo: cuerpo == null ? null : JSON.stringify(cuerpo), tiempo: limite });
    // si lo paras, se deja de esperar al momento (la respuesta, si llega, se tira)
    const r = signal ? await Promise.race([pet, new Promise((_, mal) => {
      const parar = () => mal(new DOMException('Parado', 'AbortError'));
      if (signal.aborted) parar(); else signal.addEventListener('abort', parar, { once: true });
    })]) : await pet;
    if (r.s === 0) {
      // (solo el tiempo máximo que cuenta la app; un «connect timed out» de la conexión es cobertura, no un modelo lento)
      if (r.e === 'tiempo agotado') throw sinTiempo('tiempo agotado');
      throw new ErrorIA(`Sin conexión con Google (${r.e || 'sin respuesta'})`, 0, { red: true, dns: !!r.dns });
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
      throw new ErrorIA(`Sin conexión con Google (${e.message})`, 0, { red: true });
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
      if (e.name === 'AbortError' && (silencio || resp.vencido())) throw new ErrorIA('Sin conexión con Google (tiempo agotado)', 0, { red: true, tiempo: true });
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
async function preguntar({ sistema, sistemaSinWeb, contents, contentsSinWeb }, op = {}) {
  // (el tope de tiempo cuenta desde aquí, con lo que tarde en saber qué modelos tiene tu clave)
  const inicio = Date.now(), total = op.total || 240000;
  const resta = () => total - (Date.now() - inicio);
  const alPaso = op.alPaso || (() => {});
  let modelos = await cadena();
  // con fotos solo valen los Gemini (los Gemma no ven imágenes)
  const conFotos = (contents || []).some((c) => (c.parts || []).some((p) => p.inlineData));
  if (conFotos && modelos.length) {
    modelos = modelos.filter((m) => !esGemma(m));
    if (!modelos.length) throw new ErrorIA(`Para mirar fotos hace falta un modelo Gemini y los de tu clave ya han gastado el cupo gratis de hoy. Pregúntalo sin la foto o vuelve ${vuelveCupo()}.`, 429, { todos: true });
  }
  if (!modelos.length) {
    const f = fuera();
    throw new ErrorIA(`Todos los modelos de tu clave han gastado su cupo gratis de hoy (${Object.keys(f).length} probados). Vuelven ${vuelveCupo()}.`, 429, { todos: true });
  }
  const quiereWeb = cfgIA().web;
  const resumen = [];
  let ultimo = null;
  let cortes = 0, webSospecha = null, tiempos = 0;
  // Google a veces se queda sin contestar (con la búsqueda y un modelo saturado, minutos): cada intento tiene su tiempo máximo
  // y todo junto no pasa de unos 4 minutos; el modelo que no contesta se salta y los siguientes van sin búsqueda.
  // Sin búsqueda, ni el sistema ni la pregunta le mandan buscar (si se lo mandan, a veces llama a una herramienta que no
  // tiene y contesta vacío)
  const cuerpoDe = (modelo, web, pensar, nivel) => {
    const cont = !web && contentsSinWeb ? contentsSinWeb : contents;
    const sis = !web && sistemaSinWeb ? sistemaSinWeb : sistema;
    return esGemma(modelo)
      ? { contents: [{ role: 'user', parts: [{ text: `${sis}\n\n---\n\n${cont.map((c) => `${c.role === 'model' ? 'ASISTENTE' : 'MANAGER'}: ${c.parts.map((p) => p.text).filter(Boolean).join('\n')}`).join('\n\n')}` }] }], generationConfig: { maxOutputTokens: 8192, temperature: 0.6 } }
      : { systemInstruction: { parts: [{ text: sis }] }, contents: cont, ...(web ? { tools: [{ google_search: {} }] } : {}), generationConfig: { maxOutputTokens: op.maxTokens || 16000, temperature: 0.6, ...(pensar ? { thinkingConfig: { thinkingLevel: nivel } } : {}) } };
  };
  // cada petición con su propio «parar», que también salta si paras la pregunta: así la que pierde la carrera se corta
  const ramal = () => {
    const ctl = new AbortController();
    if (op.signal) { if (op.signal.aborted) ctl.abort(); else op.signal.addEventListener('abort', () => ctl.abort(), { once: true }); }
    return ctl;
  };
  /* El relevo: si un modelo lleva 45 s sin contestar (lo normal son 15-35 s), se pregunta a la vez a los siguientes, sin
     búsqueda, y vale la primera respuesta que llegue. Una vez por pregunta. Así un modelo colgado ya no deja minutos sin plan. */
  let relevo = null, viendoTexto = false, cerrado = false;
  const saltar = new Set();
  const siguienteSano = (actual) => { const pz = pausas(); return modelos.slice(modelos.indexOf(actual) + 1).find((m) => !esGemma(m) && !pz[m] && !saltar.has(m)) || null; };
  const conRelevo = (modelo, pr, ctlA) => new Promise((res, rej) => {
    let fin = false, quitar = () => {}, ctlR = null;
    const ganar = (x) => { if (fin) return; fin = true; quitar(); if (x.deRelevo) ctlA.abort(); else if (ctlR) ctlR.abort(); res(x); };
    const perder = (e) => { if (fin) return; fin = true; quitar(); if (ctlR) ctlR.abort(); rej(e); };
    if (!relevo) {
      quitar = despues(RELEVO_MS, () => {
        if (fin || relevo || viendoTexto || resta() < 30000) return;
        // el relevo va probando los siguientes modelos sanos (hasta 3) mientras el primero no conteste
        ctlR = ramal();
        relevo = { p: (async () => {
          try {
            let desde = modelo;
            for (let k = 0; k < 3 && !fin && resta() >= 25000; k++) {
              const otro = siguienteSano(desde);
              if (!otro) break;
              desde = otro;
              alPaso(`${nombreModelo(modelo)} tarda: pregunto también a ${nombreModelo(otro)}…`);
              const t1 = Date.now(), pensarO = !/gemini-(1|2\.0)/.test(otro);
              try {
                const r = await llamar(otro, cuerpoDe(otro, false, pensarO, 'low'), { signal: ctlR.signal, limite: Math.max(20000, Math.min(90000, resta() - 5000)) });
                apuntar({ modelo: otro, web: false, ok: true, ms: Date.now() - t1, fin: r.fin, tok: r.tok, car: r.texto.length, nivel: pensarO ? 'low' : null, relevo: true });
                return { r, modelo: otro };
              } catch (e) {
                if (e.name === 'AbortError') return { e };
                apuntar({ modelo: otro, web: false, s: e.estado, e: e.message, google: e.google, ms: Date.now() - t1, nivel: pensarO ? 'low' : null, relevo: true });
                saltar.add(otro);
                if (e.estado === 429 && !e.minuto) sacar(otro, e.message);
                else if (e.estado >= 500 || e.tiempo) pausar(otro, e.tiempo ? 600 : 300);
              }
            }
          } catch (e) { return { e }; }
          return { e: null };
        })() };
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
        const limite = Math.max(25000, Math.min(/pro/.test(modelo) ? 150000 : web ? 110000 : 90000, restante));
        const cuerpo = cuerpoDe(modelo, web, pensar, nivel);
        // lo que escribió un intento que se ha cortado no se queda en pantalla
        if (viendoTexto && op.alTexto) op.alTexto('');
        viendoTexto = false;
        alPaso(`${nombreModelo(modelo)}${web ? ' con búsqueda en Google' : ''}…`);
        const t0 = Date.now();
        const ctlA = ramal();
        try {
          const r = await conRelevo(modelo, llamar(modelo, cuerpo, { ...op, signal: ctlA.signal, limite, alTexto: op.alTexto ? (t) => { if (cerrado) return; viendoTexto = true; op.alTexto(t); } : null }), ctlA);
          if (r.deRelevo) {
            // ha contestado antes el relevo: el lento se salta un rato y el que ha contestado va el primero la próxima vez
            if (r.principal) apuntar({ modelo, web, s: r.principal.estado, e: r.principal.message, google: r.principal.google, ms: Date.now() - t0, nivel: pensar ? nivel : null });
            else apuntar({ modelo, web, s: 'relevo', e: `sin contestar en ${Math.round((Date.now() - t0) / 1000)} s: ha contestado antes ${nombreModelo(r.deRelevo)}`, ms: Date.now() - t0, nivel: pensar ? nivel : null });
            pausar(modelo, 600);
            recordarBueno(r.deRelevo);
            return { ...r, modelo: r.deRelevo, web: false, intentos: resumen };
          }
          apuntar({ modelo, web, ok: true, ms: Date.now() - t0, fin: r.fin, tok: r.tok, car: r.texto.length, nivel: pensar ? nivel : null });
          if (!web) confirmarSinWeb(modelo); else webSospecha = null;
          recordarBueno(modelo);
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
            if (pensar && nivel !== 'low') { nivel = 'low'; intento--; alPaso(`${nombreModelo(modelo)} tarda más de ${seg} s: lo pido pensando menos…`); continue; }
            if (web) { web = false; intento--; alPaso(`${nombreModelo(modelo)} tarda más de ${seg} s: lo pido sin búsqueda en Google…`); continue; }
            // ni así contesta: se salta un rato (las siguientes preguntas no esperan por él) y se prueba con otro
            pausar(modelo, 600);
            resumen.push(`${nombreModelo(modelo)}: no contesta (más de ${seg} s)`);
            alPaso(`${nombreModelo(modelo)} no contesta: pruebo con otro modelo…`);
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
            if (web) { marcarMalConWeb(modelo); web = false; intento--; alPaso(`${nombreModelo(modelo)} ha fallado con la búsqueda: lo pido sin ella…`); continue; }
            resumen.push(`${nombreModelo(modelo)}: respuesta rota (${e.fin})`);
            alPaso(`${nombreModelo(modelo)} contesta mal: pruebo con otro modelo…`);
            break;
          }
          if (e.vacio && intento < 1) continue;
          if (e.vacio) { resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
          if ((e.estado >= 500 || e.estado === 0 || e.estado == null) && intento < 2 && resta() > 2500 * (intento + 1) + 25000) { await espera(2.5 * (intento + 1), op.signal); continue; }
          if (e.red) {
            resumen.push(`sin conexión con Google (${e.message})`);
            throw new ErrorIA(`Se ha cortado la conexión con Google ${cortes + 1} veces seguidas (${e.message.replace(/^Sin conexión con Google \((.*)\)$/, '$1')}). Mira que tengas internet (prueba con datos si estás con wifi) y vuelve a probar.`, 0, { red: true });
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
  }
  throw new ErrorIA(`Ningún modelo ha podido contestar. ${resumen.slice(0, 4).join(' · ')}${resumen.length > 4 ? ` y ${resumen.length - 4} más` : ''}.${ultimo && ultimo.google ? ` Google: «${ultimo.google.slice(0, 140)}»` : ''}`, ultimo ? ultimo.estado : 0, { todos: true });
}

/* ---------------- todo lo que la IA sabe de tu liga ---------------- */
const m1 = (v) => (v == null ? '?' : eur(v));
/** el dinero de un rival: exacto o estimado con su margen */
const dineroTxt = (d) => (!d || d.v == null ? `dinero: no se sabe${d && d.motivo ? ` (${d.motivo})` : ''}` : d.exacto ? `dinero ${eur(d.v)} (exacto)` : d.dicho ? `dinero ≈ ${eur(d.v)} ± ${eur(d.margen)} (me dijo lo que tenía ${cuando(d.dicho.t)}, más lo que ha movido desde entonces)` : `dinero ≈ ${eur(d.v)} ± ${eur(d.margen)} (estimado con todos sus movimientos y sus subidas de cláusula)`);
/** quién puede pagar una cláusula tuya */
const paganTxt = (p) => {
  if (!p || (!p.seguro.length && !p.quiza.length && !p.hayDatos)) return p && p.sinSaber.length ? `no se sabe el dinero de ${p.sinSaber.length} rivales` : null;
  if (!p.seguro.length && !p.quiza.length) return `no le llega a ningún rival${p.sinSaber.length ? ` de los que se sabe el dinero (de ${p.sinSaber.map((x) => x.nombre).join(', ')} no)` : ''}`;
  return `le llega a: ${[...p.seguro.map((x) => `${x.nombre} (le sobra)`), ...p.quiza.map((x) => `${x.nombre} (justo)`)].join(', ')}${p.sinSaber.length ? `; de ${p.sinSaber.map((x) => x.nombre).join(', ')} no se sabe` : ''}`;
};
/** el blindaje justo, si compensa */
const blindajeTxt = (b) => {
  if (!b || b.yaVale) return null;
  const por = b.porTecho ? `en esta liga nadie suele pagar más de un ${pct(b.techoPct * 100, 0)} sobre el valor por una cláusula, así que con ${eur(b.objetivo)} estaría a salvo` : `con ${eur(b.objetivo)} no le llegaría a nadie de los que se sabe el dinero`;
  const t = b.caro ? `blindarla costaría ${eur(b.coste)} (subirla a ${eur(b.objetivo)}: ${por}): NO compensa, es más de una cuarta parte de lo que vale` : `blindaje justo: subirla a ${eur(b.objetivo)} cuesta ${eur(b.coste)} (${por})`;
  const u = b.parcial ? `; lo que sí compensa: subirla a ${eur(b.parcial.objetivo)} (${eur(b.parcial.coste)}) y solo le llegaría a ${b.parcial.quedan.join(', ')}` : '';
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
  return `INERCIA ${F}: cada día ${x.R.map((r) => eur(r, { signo: true })).join(' → ')}${x.fase === 'frena' ? ` (deja de subir en ~${Math.max(1, Math.round(x.giroEn))} d)` : ''}${['giro', 'baja', 'parado', 'frena'].includes(x.fase) ? `; hasta la jornada ${eur(x.proyJ, { signo: true })}` : ''}`;
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
const lineaJ = (M, j, x = {}) => [
  POS[j.pos] || '?', j.nombre, j.equipo || '?', `valor ${eur(j.valor)}`,
  (() => { const ine = M.inercia ? M.inercia(j.id) : null; if (ine && ine.fase !== 'plano') return null; return x.tend && x.tend.d1 != null ? `hoy ${eur(x.tend.d1, { signo: true })}` : null; })(),
  x.tend && x.tend.p7 != null ? `7d ${pct(x.tend.p7)}` : null,
  inerciaTxt(M, j),
  j.pos === 5 ? 'ENTRENADOR: no se alinea ni puntúa en la versión gratis' : null,
  j.media ? `media ${String(j.media).replace('.', ',')}` : null, `${j.puntos} pts`,
  j.pos < 5 ? forma(M, j.id) : null,
  j.pos < 5 ? historialTxt(M, j) : null,
  j.pos < 5 ? rendimientoTxt(M, j) : null,
  j.pos < 5 ? avanzadoTxt(M, j) : null,
  onceTxt(M, j),
  j.pos < 5 ? previaTxt(M, j) : null,
  j.pos < 5 ? esperadosTxt(M, j) : null,
  j.pos < 5 ? rivalTxt(M, j) : null,
  j.estado && j.estado !== 'ok' ? `ESTADO: ${j.estado}` : null,
].filter(Boolean).join(' | ');
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
let CORTO = false;
/**
 * el calendario de riesgo: sus próximos 5 partidos (o los de sus 14 días con la cláusula protegida), con el
 * veredicto; partido a partido si es duro, favorable o de riesgo alto (y no vamos en corto)
 */
const rivalTxt = (M, j) => {
  const c = M.calendarioRiesgo ? M.calendarioRiesgo(j) : null;
  if (!c) return null;
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const cab = `CALENDARIO ${c.tipo.toUpperCase()} (riesgo ${c.riesgo}): ${c.texto}`;
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
    if (n.length >= 4 && t.includes(` ${n} `)) { out.push(j); continue; }
    const ult = n.split(' ').pop();
    if (ult.length >= 5) (porApellido[ult] ||= []).push(j);
  }
  for (const [ap, js] of Object.entries(porApellido)) if (js.length === 1 && t.includes(` ${ap} `) && !out.includes(js[0])) out.push(js[0]);
  return out.slice(0, 6);
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
  return `${lineaJ(M, j, { tend: t })} | ${de}${cl ? ` | cláusula ${eur(cl.clausula)} ${cl.abierta ? 'ABIERTA' : cl.veda ? `CERRADA hasta que empiece la jornada ${cl.veda.n}: se puede clausular ${cuando(cl.protegidoHasta)}, no antes` : cl.escudo ? `BLINDADA por su dueño hasta ${cuando(cl.protegidoHasta)} (hasta entonces no se puede clausular)` : `se abre ${cuando(cl.protegidoHasta)}`}` : ''} | CÓMO CONSEGUIRLO: ${como}${prensaTxt(M, j.id)}${v7 ? ` | hace 7 días valía ${eur(v7)}` : ''}${v30 ? `, hace 30 días ${eur(v30)}` : ''} | ${mejoraTxt(M, j)}`;
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
  try { return contextoDe(D, M, c, { corto: corto || chat, chat }); } finally { CORTO = false; }
}
function contextoDe(D, M, c, { corto = false, chat = false } = {}) {
  const L = [];
  const ahora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  L.push(`AHORA: ${ahora} (hora de España)`);
  L.push(`LIGA: ${D.liga.nombre}, ${D.clasif.length} equipos. Se puede quedar en negativo hasta el ${c.deuda} % del valor del equipo (${eur(M.deuda)}), pero solo pujando o comprando en el mercado: las cláusulas se pagan con saldo.`);
  if (M.enJuego) L.push(`JORNADA ${M.enJuego.n} EN JUEGO hasta ${cuando(M.enJuego.fin)}.`);
  if (M.proxima) L.push(`PRÓXIMA JORNADA: ${M.proxima.n}, primer partido ${cuando(M.proxima.ini)} (en ${dura(M.proxima.ini - Date.now())}).`);
  if (M.vedaAhora) L.push(`CLÁUSULAS CERRADAS: desde ${cuando(M.vedaAhora.ini)} (24 h antes del primer partido de la jornada ${M.vedaAhora.n}) LaLiga no deja clausular a nadie, ni a mí me pueden clausular, hasta que empiece la jornada (${cuando(M.vedaAhora.fin)}). Un clausulazo, a esa hora y no antes; blindar tampoco hace falta hasta entonces.`);
  else if (M.proxima) L.push(`LAS CLÁUSULAS SE CIERRAN ${cuando(M.proxima.ini - M.VEDA_H * 3600e3)} (24 h antes del primer partido) y se reabren cuando empieza la jornada (${cuando(M.proxima.ini)}): un clausulazo, antes del cierre o a partir de esa hora.`);
  if (M.paron) L.push(`PARÓN DE SELECCIONES: del ${cuando(M.paron.ini, { hora: false })} al ${cuando(M.paron.fin, { hora: false })}${M.enParon ? ' (estamos en él)' : ''}.`);
  if (M.cierreMercado) L.push(`EL MERCADO CAMBIA: ${cuando(M.cierreMercado)} (en ${dura(M.cierreMercado - Date.now())}).`);
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
    L.push(`MI PLANTILLA POR PUESTOS (sanos/total): ${M.puestos.map((p) => `${POS[p.pos]} ${p.sanos}/${p.total}${p.faltan ? ` (FALTAN ${p.faltan})` : ''}${p.sobran ? ` (sobran ${p.sobran})` : ''}`).join(' · ')}.`);
    L.push(`MI MEJOR ONCE AHORA: ${M.once.nombre}${M.once.huecos ? ` CON ${M.once.huecos} HUECOS` : ''}, unos ${String(Math.round(M.once.total * 10) / 10).replace('.', ',')} pts esperados (cada uno con su próximo rival y lo que se espera de él): ${M.once.lineas.map((l) => l.map((j) => `${j.nombre} (${partidoTxt(M, j)}, ~${d1(M.ppEsperado(j))})`).join(', ')).filter(Boolean).join(' | ')}${M.once.entrenador ? ` · entrenador ${M.once.entrenador.nombre}` : ''}.`);
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
  L.push('\nMIS JUGADORES (posición | nombre | equipo | valor | cambio | media | puntos | últimas jornadas con su rival | lo que rinde | once probable | previa del próximo partido | los dos siguientes) + titular o suplente en mi once, cláusula, protección, riesgo y lo que pagué:');
  const sinEl = (x) => {
    if (!x.j || x.j.pos === 5) return '';
    const pu = (M.puestos || []).find((p) => p.pos === x.j.pos);
    const min = x.j.pos === 1 ? 1 : Math.min(...(M.formaciones || [[3, 4, 3]]).map((f) => f[x.j.pos - 2]));
    if (pu && !['injured', 'suspended', 'out_of_league'].includes(x.j.estado) && pu.sanos - 1 < min) return ' | IMPRESCINDIBLE: sin él no puedo alinear una formación gratis';
    const pp = M.perdida ? M.perdida(x.pid) : 0;
    return pp >= 0.3 ? ` | si lo vendo, mi once pierde ${d1(pp)} pts/jornada` : ' | venderlo no quita nada a mi once';
  };
  for (const x of M.mias) L.push(`- ${lineaJ(M, x.j, x)} | ${M._tit && M._tit.has(x.pid) ? 'TITULAR' : 'suplente'}${sinEl(x)}${M.enVenta && M.enVenta.has(x.pid) ? ' | EN VENTA' : ''} | cláusula ${eur(x.clausula)}${x.ratio != null ? ` (${x.ratio <= 1.03 ? 'A SU VALOR: la presa más fácil' : `${pct((x.ratio - 1) * 100, 0)} sobre su valor`})` : ''} ${x.abierta ? 'ABIERTA (me lo pueden quitar ya)' : x.veda ? `a salvo por el cierre de cláusulas hasta que empiece la jornada ${x.veda.n} (${cuando(x.protegidoHasta)})` : `${x.escudo ? 'BLINDADO' : 'protegido'} hasta ${cuando(x.protegidoHasta)}`}${(M.paraEscudo || []).includes(x.pid) ? ' | CONVIENE BLINDARLO HOY (gratis)' : ''} | ${x.ventaInercia ? `VENDER POR INERCIA (${x.ventaInercia.urgencia === 'ya' ? 'ya: ha girado' : 'antes de que gire'}) | ` : ''}riesgo ${x.riesgo}${x.pagan && (x.abierta || x.abreEn < 2 * DIA) && paganTxt(x.pagan) ? ` (${paganTxt(x.pagan)})` : ''}${blindajeTxt(x.blindaje) ? ` | ${blindajeTxt(x.blindaje)}` : ''}${x.compra ? ` | pagué ${eur(x.compra)} (${eur(x.ganado, { signo: true })})` : x.inicial ? ` | venía en mi equipo inicial: valía ${eur(x.inicial)} al empezar la liga (${eur(x.ganadoIni, { signo: true })})` : ' | no se sabe lo que pagué'}`);
  if (M.enJuego && M.vivo && M.vivo.n === M.enJuego.n && Array.isArray(M.vivo.once) && M.vivo.once.length) {
    const ahoraT = Date.now();
    const est = (pid) => {
      const j = M.J(pid);
      if (!j) return null;
      const pp = M.proximoPartido(j.equipoId), pts = M.puntosVivo ? M.puntosVivo(pid) : null;
      const jugado = pts != null || (pp && pp.jornada === M.enJuego.n && pp.fecha <= ahoraT);
      return `${j.nombre} (${jugado ? `ya jugando o jugado${pts != null ? `, ${pts} pts` : ''}` : pp && pp.jornada === M.enJuego.n ? `juega ${cuando(pp.fecha)}` : 'sin partido'})`;
    };
    L.push(`MI ONCE EN LALIGA PARA LA JORNADA ${M.enJuego.n} (EN JUEGO): ${M.vivo.once.map(est).filter(Boolean).join(', ')}. Solo se puede cambiar a los que aún no han jugado: la alineación que me propongas, para esos.`);
  }
  if (M.escudosMios) L.push(`BLINDAJES (el escudo de LaLiga, gratis viendo un anuncio): me quedan ${M.escudosMios.quedan} de 2 esta jornada; protegen la cláusula ${M.escudosMios.horas} h y solo se pueden poner a jugadores con la cláusula abierta.`);
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
    if (v.ciclos < 1) L.push(`\nNO ESPECULES AHORA: ${M.enJuego ? `la jornada ${M.enJuego.n} está en juego y antes de la siguiente no da tiempo` : 'antes de la jornada no queda ningún cambio de mercado que cuente (el del mismo día en que empieza la jornada no cuenta)'}. Lo que compre ahora no lo puede vender a tiempo: nada de comprar «para revender».`);
    else L.push(`\nESPECULAR: hasta la jornada quedan ${v.ciclos} cambio${v.ciclos === 1 ? '' : 's'} de mercado que cuentan (${v.cambios.map((t) => cuando(t)).join(', ')}); el del mismo día que empieza la jornada NO cuenta. Lo de revender se pone a la venta ${cuando(v.ponerVenta)} para aceptar la oferta del cambio de ${cuando(v.ultimoMercado)}. Una compra en el mercado llega en el siguiente cambio y luego hay que ponerla a la venta: necesita 2 cambios; una cláusula, 1. Margen: puede bajar hasta −${eur(M.deuda)} entre medias.`);
    if (M.paraRevender && M.paraRevender.length) L.push(`COMPRADOS PARA REVENDER: ${M.paraRevender.map((x) => `${x.j.nombre} (comprado a ${eur(x.rev.precio)}, vale ${eur(x.j.valor)}, ${eur(x.beneficioYa, { signo: true })})`).join('; ')}.`);
    if (M.especular && M.especular.length) {
      L.push('CANDIDATOS PARA REVENDER SEGÚN LA TENDENCIA (precio de compra | subida diaria | valor esperado el día de vender | beneficio):');
      for (const e of M.especular.slice(0, 10)) L.push(`- ${e.j.nombre} (${POS[e.j.pos]}, ${e.j.equipo}) | ${e.origen === 'mercado' ? `mercado, pujar ${eur(e.puja)}` : `cláusula ${eur(e.precio)} a ${e.rival.manager || e.rival.nombre}`} | ${pct(e.r * 100)}/día | ${eur(e.valorFuturo)} | ${eur(e.beneficio, { signo: true })}`);
    }
  }
  L.push(`\nRIVALES (pos | equipo | manager | puntos | valor | lo que han subido de valor sus jugadores en 7d (sin contar fichajes ni ventas) | movimientos 7d | gastado 7d | cláusulas que han hecho en 14d | peligro | su dinero | lo que suele pagar en el mercado | mis cláusulas que le llegan)${M.dineroExacto ? '' : `. Su dinero, si no es exacto, sale de todos vuestros movimientos desde el principio de la liga (empezasteis con lo mismo); el margen es la recompensa diaria, que no sale en los movimientos`}:`);
  for (const r of M.rivales) L.push(`- ${r.e.pos}º | ${r.e.nombre} | ${r.e.manager} | ${r.e.puntos} pts | ${eur(r.e.valor)} | ${r.dValor != null ? eur(r.dValor, { signo: true }) : '?'} | ${r.movs} | ${eur(r.gastado)} | ${r.clausulazos}${r.contraMi ? ` (${r.contraMi} a mí)` : ''} | ${r.nivel} | ${dineroTxt(r.dinero)} | ${r.paga ? `paga de mediana ${pct(r.paga.med * 100)} sobre el valor (${r.paga.n} compras, como mucho ${pct(r.paga.max * 100)})` : 'sin compras al mercado'} | ${r.leLlegan.length ? `${r.leLlegan.filter((x) => x.abierta).length} abiertas y ${r.leLlegan.filter((x) => !x.abierta).length} que se abren pronto (la más cara, ${(() => { const x = [...r.leLlegan].sort((a, b) => b.clausula - a.clausula)[0]; return `${x.j.nombre} ${eur(x.clausula)}`; })()})` : 'ninguna'}`);
  // cómo juega cada uno, con todo el historial (función top «perfilRival»: si está cerrada, la usa sin contarla)
  if (M.perfil) {
    const yoT = D.yo && D.yo.teamId;
    const pf = M.rivales.map((r) => {
      const P = M.perfil(r.e.teamId);
      if (!P || !P.n) return null;
      const t = [`${P.cz.n} clausulazo${P.cz.n === 1 ? '' : 's'}${P.cz.n && P.cz.med != null ? ` (de mediana ${pct(P.cz.med * 100)} sobre el valor)` : ''}${yoT && P.cz.victimas[yoT] ? `, ${P.cz.victimas[yoT]} a mí` : ''}`];
      if (P.ventas.dias != null && P.ventas.nDias >= 2) t.push(`vende a los ~${Math.max(1, Math.round(P.ventas.dias))} días de fichar`);
      if (P.escudos + P.subidas) t.push(`se ha protegido ${P.escudos + P.subidas} veces`);
      if (P.franja && P.franja.pct >= 0.4) t.push(`clausula, vende y blinda sobre todo de ${P.franja.ini} a ${P.franja.fin} h`);
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
  if (PL && !PL.poco) {
    L.push(`\nLO QUE SE PAGA EN ESTA LIGA POR LOS LIBRES DEL MERCADO (${PL.n} compras de las últimas 6 semanas, sobre el valor que tenían ese día): mediana ${pct(PL.med * 100)}, la mitad entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)}, el 10 % más alto ${pct(PL.p90 * 100)} o más${PL.caros != null ? `; por los de más de 10 M, ${pct(PL.caros * 100)}` : ''}${PL.baratos != null ? `; por los de menos, ${pct(PL.baratos * 100)}` : ''}. Últimas: ${PL.ult.slice(0, 6).map((x) => `${(D.maestro[x.pid] || {}).nombre || '?'} ${eur(x.imp)} (${pct(x.s * 100)}, ${x.tid ? nombreTid(M, x.tid) : '?'})`).join('; ')}.`);
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
  L.push(catalogoTxt(D, M, cat, { corto, chat, datos: chat ? null : (o) => (['A', 'V', 'B'].includes(o.ref[0]) ? null : sinFicha(o) ? `${o.j.nombre}: ${esMalo(o.j) ? `ESTADO ${o.j.estado}` : 'casi seguro suplente'}; no lo recomiendes` : `${lineaJ(M, o.j, { tend: M.tend(o.pid) })} | interés ${o.interes != null ? o.interes : '?'}/100 | ${mejoraTxt(M, o.j)}${prensaTxt(M, o.pid)}`) }));
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

const SISTEMA = `Eres el director deportivo de un manager de LaLiga Fantasy (el juego oficial de LaLiga) en una liga privada. Tu trabajo es decirle exactamente qué operaciones hacer cada día para ganar la liga y hacer crecer el valor de su equipo. Hablas en español de España, directo, como un colega que sabe mucho del juego.
Reglas del juego en su liga: cada jugador tiene una cláusula; cuando se le acaba la protección, cualquiera puede pagarla y quitárselo al instante. El dueño puede subirla pagando (pagar X la sube 2X) o blindarla gratis un rato (mira BLINDAJES). En el mercado hay DOS cosas muy distintas que no debes mezclar: (1) jugadores LIBRES de LaLiga, que no son de nadie: el mercado cambia cada día, se puja a ciegas desde su precio y se los lleva la puja más alta; (2) jugadores que OTRO MANAGER de la liga ha puesto a la venta: siguen siendo suyos, el precio lo pone él y solo pasan a ser del manager si el dueño acepta su oferta, así que no se pueden conseguir «más baratos en el mercado». Si el dueño es un amigo que se lo deja a un precio, es un trato entre los dos: valóralo por su valor, lo que sube al día, lo que le da a su once y si le llega el dinero, no comparándolo con el mercado de la liga. Para vender, se pone al jugador en el mercado y llegan ofertas (la de LaLiga, cerca de su valor, y las de otros managers); el dinero entra al aceptar una. Puede quedarse en negativo hasta el % del valor del equipo que te digo, pero si empieza la jornada con saldo negativo no puntúa.
Usa los datos que te paso: cifras en millones («12,4 M»), fechas y horas exactas. No inventes jugadores ni cifras. Te paso el once probable de cada jugador y titulares de prensa recientes: úsalos. Cuando hables de lo que te paso (el once probable, su nota, su xG), no digas de qué web sale: «el once probable», «su nota». No nombres nunca webs de fantasy ni de onces (futbolfantasy, Analítica Fantasy, Jornada Perfecta, Comuniate, Biwenger, Futmondo…) ni las pongas como fuente o con un «según»: di «la prensa» o «los onces probables». Si un jugador lleva ALINEACIÓN CONFIRMADA (sale una hora antes de su partido), eso manda sobre el once probable y la prensa: si está de SUPLENTE o NO CONVOCADO y lo tengo en el once, dime que lo cambie por uno que juegue antes de que empiece su partido. Si tienes la búsqueda de Google, úsala para lo que pueda cambiar una decisión: lesiones, sanciones, convocatorias, onces de última hora, rotaciones por Champions o Copa y cambios de entrenador de los jugadores que vas a recomendar o a alinear. Ten en cuenta los parones de selecciones. Piensa en puntos (quién va a jugar y puntuar) y en dinero (comprar antes de que suba, vender antes de que baje, cláusulas baratas para revender). Mira qué hacen los rivales y quién puede ir a por sus jugadores.
Hay dos tipos de fichaje y tienes que decir cuál es cada uno: para su ONCE (entra de titular y le da puntos) o para REVENDER (aunque no le haga falta, porque está subiendo y lo vende con beneficio antes de la jornada). Para REVENDER da igual que no lo vaya a alinear o que ya tenga a otro en su puesto (otro portero, por ejemplo): NUNCA lo descartes por eso ni lo llames «dinero parado» si está subiendo; cuenta lo que gana hasta venderlo, el dinero y el límite de jugadores de la plantilla. Una CLÁUSULA solo se puede pagar con el saldo que tiene: LaLiga no deja clausular quedándose en negativo (ni con el dinero de lo que pone en venta, que no entra hasta que acepta una oferta). Quedarse en negativo solo se puede pujando o comprando en el mercado. Entre semana puede quedarse en negativo hasta el límite de deuda para especular: comprar lunes o martes lo que sube y venderlo el día antes de la jornada (lo pone a la venta y acepta la oferta antes de que empiece). Lo único obligatorio es empezar la jornada con saldo positivo o cero. Si especula, calcula que aunque los valores bajen pueda volver a positivo vendiendo, y dile qué día vender cada cosa.
CLÁUSULAS TUYAS: el riesgo de cada jugador te lo paso calculado con el dinero de cada rival y lo que se paga en esta liga; no lo rebajes sin un dato nuevo. NUNCA digas que te viene bien que te clausulen a uno por su valor (ni «ponle un lacito», ni «así haces caja»): con la cláusula a su valor o cerca te lo quitan sin pagar nada de más, pierdes sus puntos y lo que suba, el otro puede revenderlo con beneficio y tú pagarías más por otro igual. Solo es buena noticia si la cláusula está muy por encima de su valor y el jugador no te aporta. Si no compensa protegerlo, dilo así: que es un riesgo que asumes, no un regalo. Para decir quién puede ir a por uno, mira CÓMO JUEGA CADA RIVAL: el que clausula a menudo y le llega es el peligro de verdad; el que no ha clausulado nunca, mucho menos, aunque le llegue. Si se mueve a una hora, avísame antes de esa hora.
VENDER SIN NECESIDAD: no le hagas vender para «hacer caja» si el dinero no hace falta (está en positivo y no lo necesita para algo de este mismo plan) y el jugador no entra en su once: puede quedarse hasta que LaLiga le haga una oferta mejor (hace una nueva en cada cambio de mercado), y que sea suplente o falte poco para la jornada no es motivo para venderlo. Vende solo si la oferta es buena (por encima de su valor o de las altas en su liga), si su valor cae deprisa (más de un 3 % al día), si está lesionado o si hace falta el dinero. Si le aconsejas esperar, díselo así.
LO QUE PAGÓ: de cada uno te paso «pagué X». Cuando propongas vender, di cuánto gana o pierde frente a eso. Vender perdiendo dinero frente a lo que pagó solo si hace falta el dinero o si está bajando (por la inercia, una lesión…): en ese caso lo que pagó no cambia nada, lo perdido ya no vuelve y esperar solo pierde más. Si no hace falta el dinero y no baja, que espere a una oferta mejor.
VERSIÓN GRATIS SIN ENTRENADOR: no se alinea entrenador ni puntúa. No recomiendes nunca fichar, pujar ni clausular entrenadores; si tiene alguno, es dinero parado: véndelo cuando llegue una buena oferta o cuando haga falta el dinero.
CADA JUGADOR TE LLEGA CON: sus últimas jornadas con el rival de cada una y el resultado («J9 11 vs Getafe 19º 2-0»), lo que rinde en casa, fuera, contra los 6 primeros y contra los 6 últimos, y la PREVIA de su próximo partido (cómo llegan los dos equipos en los últimos 5, lo que marca y encaja el rival, cómo le va al rival jugando en ese campo, la portería a cero esperada para porteros y defensas o los goles esperados de su equipo para medios y delanteros, y los puntos esperados). Úsalo: un jugador que solo puntúa contra los de abajo no es fiable contra el Madrid; un defensa con un 15 % de portería a cero puntuará poco aunque sea titular; uno que rinde fuera igual que en casa es más seguro. Compara siempre lo que le toca ahora con lo que ha hecho contra rivales parecidos.
ESTADÍSTICAS AVANZADAS (cuando las hay): mira más allá de los puntos del Fantasy. xG y xA por 90 dicen las ocasiones que genera de verdad: si marca mucho menos de lo que dice su xG, es probable que lleguen los goles (y al revés, si marca mucho más, puede bajar). Tiros y pases clave por 90 son la base de los puntos de un medio o un delantero; entradas, intercepciones y recuperaciones, los de un defensa o un medio defensivo; las paradas y las porterías a cero, los de un portero. La nota media y su tendencia (las últimas) avisan de si está en forma o de si puede perder el sitio. Y el xG que genera y concede cada equipo (sobre todo en los últimos 5) dice mejor que los goles cómo de difícil es un partido. Úsalo para afinar, sobre todo entre candidatos parecidos.
INERCIA DEL VALOR: con cada jugador va lo que ha cambiado su valor cada día de la última semana. Mira hacia dónde va AHORA, no el total de la semana. Si sube cada vez menos (1 M, 800 mil, 500 mil…) está FRENANDO y va a girar: hay que anticiparse y venderlo antes de que empiece a bajar (te digo en cuántos días deja de subir). Si después de subir se ha estancado o ya baja (HA GIRADO A LA BAJA), lo normal es que siga bajando varios días, y VENDER POR INERCIA es la señal para venderlo, pero no una orden: compara lo que perdería hasta la jornada («hasta la jornada −X») con lo que pierde tu once si lo vendes (te lo paso con cada uno: «si lo vendo, mi once pierde Y pts/jornada») y con lo que cuesta reponerlo (lo que se paga aquí por los libres). Si es IMPRESCINDIBLE (sin él no puedo alinear una formación gratis), no lo vendas antes de la jornada salvo lesión: dilo y di qué hacer después. Si es suplente o lo puedo reponer, véndelo. Para comprar, y sobre todo para revender, nada que haya girado o se haya estancado: tiene que seguir subiendo hasta el día de venderlo. FRENANDO no es descartarlo: mira en cuántos días deja de subir; si sigue subiendo hasta el día de venderlo, vale para revender (lo que importa es lo que gana hasta entonces). Salvo que ACABE DE HACER un buen partido (te lo marco así): ahí la bajada puede frenarse o darse la vuelta, así que para ficharlo o clausularlo cuenta sus puntos y no lo descartes solo por la inercia; con 10 o más, lo normal es que suba los próximos días y mañana puede estar más caro.
PUNTOS ESPERADOS POR PARTES: los de cada jugador vienen desglosados como puntúa LaLiga Fantasy (min: minutos; gol: con su xG; asis: con su xA; cero: portería a cero con lo que marca el rival; encaja: goles encajados; paradas; tarj: tarjetas; resto: la nota de DAZN, recuperaciones, tiros…), con la probabilidad de ser titular juntando el once probable, sus últimos partidos y la temporada. Úsalo para entender de dónde salen sus puntos: un defensa que vive de la portería a cero vale poco contra un equipo que marca mucho; un delantero con mucho xG y pocos goles está para marcar. Si su equipo juega Champions, Europa League, Conference o Copa pegada a la jornada, va marcado como ROTACIÓN: mira en la prensa si su entrenador suele rotar antes de ponerlo de titular o de ficharlo para esa jornada.
SI TE CLAUSULAN, COBRAS LA CLÁUSULA, pero con la cláusula en su valor o cerca es regalarlo: pierdes sus puntos y lo que suba, vendiéndolo a LaLiga sacarías más y reponerlo cuesta más, aunque sea suplente. El riesgo de cada uno te lo paso calculado: no lo rebajes. Una cláusula por encima de lo que se ha pagado en los clausulazos de esta liga (te paso hasta dónde llega el 90 %; si aún no hay bastantes, un +30 %) corre poco riesgo: casi nadie paga tanto de más. Y cuenta también los EUROS de más, no solo el porcentaje: un 20 % por encima son 1 M en uno de 5 M (alguien lo paga) y 16 M en uno de 80 M (nadie). Mira también hasta dónde se ha llegado en los clausulazos de esta liga. Y nunca digas que una cláusula «casi no pasa de su valor» si pasa más de un 10 %: dilo en porcentaje.
DINERO DE LOS RIVALES: te paso el de cada uno, exacto si LaLiga lo da o estimado con vuestros movimientos (con su margen). Úsalo para saber quién puede ir a por cada cláusula: una cláusula abierta que no le llega a nadie es poco riesgo hoy (aunque podrían vender para juntar el dinero), y si a varios les sobra, hay que blindar o asumirlo. Para blindar te paso el «blindaje justo» (subir la cláusula X cuesta X/2): propón esa cifra, no un número al azar, y solo si el jugador lo merece. Ya tiene en cuenta lo que de verdad se paga en su liga por una cláusula: no hace falta dejarla por encima de todo el dinero del más rico (nadie paga el doble de lo que vale un jugador), así que no hables de subirla más que eso. Si te paso que NO compensa, dilo en una frase con esa cifra; no hagas cuentas tuyas para «sacarlo del alcance» de nadie. Y un rival sin dinero no va a pujar fuerte en el mercado ni a clausular.
PUJAS EN ESTA LIGA: te paso lo que se paga de verdad aquí por los libres (mediana, el rango normal, por los caros y por los baratos, y lo que paga cada rival). La puja que propongas tiene que salir de ahí: por uno que buscará todo el mundo, hacia la parte alta; por uno que no mira nadie, cerca de la mínima. Dila con su % sobre el valor.
APRENDE DE LO QUE FALLA: en «CÓMO VAN TUS ACIERTOS» te digo cuánto fallan los puntos esperados y cómo salieron tus recomendaciones de los últimos días. Si algo salió mal, piensa por qué (¿no jugó?, ¿el rival?, ¿se pagó de más?) y no lo repitas; si un tipo de operación sale bien, sigue por ahí.
El rival importa tanto como ser titular: no es lo mismo jugar contra el Barça o el Madrid que contra el colista, ni en casa que fuera. Te paso el próximo rival de cada jugador con su puesto en LaLiga y si es difícil, medio o fácil; los porteros y defensas puntúan más contra equipos que marcan poco, y los medios y delanteros contra los que encajan mucho. Tenlo en cuenta en el once, en a quién fichar y en cuándo vender (vender antes de una racha de rivales difíciles, comprar antes de una de fáciles).
El manager te cuenta cosas que no salen en los datos (tratos con amigos de la liga, ofertas que le hacen por privado, lo que ya ha hecho o piensa hacer, jugadores que no quiere vender): cuentan tanto como los datos. Si otro manager le ofrece venderle un jugador por un precio, se cierra haciéndole una oferta directa por ese importe desde la ficha del jugador; si conviene, ponlo como operación (accion "comprar", donde "a <manager>") y calcula si le compensa con su valor, lo que sube al día, si entra en su once y si le llega el dinero.
OFERTAS DE LALIGA: por lo que tienes en venta, LaLiga hace una oferta nueva en cada cambio de mercado. Te digo dónde cae la de hoy dentro de lo que suele dar en esta liga y lo normal que sería la de mañana. Si es de las más bajas y no hay prisa, NO la aceptes: di que espere a la de mañana, aunque el jugador esté bajando un poco, porque venderlo hoy es hacerlo casi por lo mínimo. Solo acéptala si hay prisa (empezaría la jornada en negativo, está de baja, o ese dinero hace falta hoy para una operación del plan que de verdad compense) o si cae tan rápido que pierde más de lo que se gana esperando (te paso la cuenta). Que vaya a la baja por la inercia no basta para malvender: si toca vender por la inercia y la oferta es mala, la salida es esperar a la de mañana o a la de otro manager.
{{PULLITAS}}
CÓMO DECIDIR (hazlo con cada operación antes de recomendarla, y si algo falla, no la recomiendes):
1. ¿Se puede? Solo las operaciones de «OPERACIONES POSIBLES HOY», con su ref. Un jugador de un rival que no está ahí no se puede conseguir hoy.
2. ¿Juega? Once probable, minutos de las últimas jornadas, lesión, sanción, convocatoria y lo que diga la prensa de los últimos dos días del jugador y de su equipo.
3. ¿Puntúa? Su forma (puntos de las últimas jornadas y media), cómo le va a su equipo (últimos resultados) y su CALENDARIO (abajo).
4. ¿Qué cuesta? Precio frente a valor y si sube o baja (hoy y en 7 días). Lo que se paga de más se pierde.
5. ¿Le hace falta? Si es para el once, que entre en una formación gratuita y mejore el once; si es para revender, que suba lo bastante para ganar antes de la jornada.
6. ¿Le llega el dinero? Para clausular, solo con el saldo de ahora. Para pujar o comprar en el mercado, con el saldo, el límite de deuda y lo que venda antes. Empezar la jornada en positivo.
7. ¿Riesgos? Rivales con dinero para clausular sus jugadores, sus cláusulas abiertas, rotaciones por Champions o Copa, parón.
CIERRE DE CLÁUSULAS: LaLiga no deja clausular a nadie en las 24 h antes del primer partido de cada jornada; se reabren justo a la hora de ese primer partido. Una cláusula que se abre dentro de ese cierre no se puede pagar hasta esa hora: nunca propongas clausular a la hora en que vence su protección si cae dentro del cierre (te paso cada una ya con la hora en que de verdad se puede pagar).
BLINDAJES: en LaLiga Fantasy cada equipo puede blindar gratis 2 jugadores por jornada (viendo un anuncio; desde que acaba una jornada hasta que acaba la siguiente) y su cláusula queda protegida 24 h (48 h en las ligas Premium). Un jugador BLINDADO no se puede clausular hasta la hora que te digo: no lo recomiendes como clausulazo hasta entonces (como mucho, «cuando se abra»). Con los míos, si uno importante tiene la cláusula abierta y algún rival la puede pagar, y me quedan blindajes, blindarlo es gratis: recomiéndalo antes que gastar en subirle la cláusula (acción «blindar», importe 0, donde «con el blindaje de LaLiga»). Ojo: dura poco, así que si nadie le puede pagar la cláusula, guárdalo.
Mejor no hacer nada que hacer algo dudoso. Confianza «alta» solo si todo cuadra y hay un dato o una noticia que lo respalda; si no has encontrado noticias, dilo.
CALENDARIO DE RIESGO: con cada jugador te paso su calendario (sus próximos 5 partidos, o todos los de los 14 días que un fichaje tiene la cláusula protegida si son más): cada rival con su puesto, lo difícil que es PARA ÉL (un defensa sufre con el que marca mucho, un delantero con el que no encaja; y en casa o fuera), los puntos que se esperan y la probabilidad de que sea titular (con la rotación si su equipo juega Champions, Europa o Copa cerca), y cómo le fue a su equipo las últimas veces contra ese rival (V, E o D con el marcador, de la más vieja a la más reciente; pesa poco, menos que cómo están ahora). Si es DURO o de riesgo ALTO, no recomiendes ficharlo salvo que sea un parche (le falta gente sana en ese puesto para sacar el once) y a un precio cerca de su valor (no más de un 5 % por encima); si lo propones así, dilo («de parche»). Si es FAVORABLE y es titular, se puede pagar algo más por él. Cuando lo uses para fichar o descartar a alguien, justifícalo con los partidos (contra quién y si en casa o fuera), los puntos que se esperan y su titularidad, con las cifras que te paso; no basta con decir «calendario difícil». Con los que ya tiene, el calendario no decide la venta: uno duro no es motivo para vender por sí solo (aunque cuenta si le llega una buena oferta), y uno favorable NO es motivo para quedarse a uno que está bajando de valor: si toca venderlo por la inercia, eso manda, porque lo que sume en puntos no compensa lo que pierde cada día.
COMPRAR A OTRO MANAGER: solo si lo tiene a la venta (te los paso en el bloque «EN EL MERCADO PERO CON DUEÑO») o si es un trato que te ha contado el manager. Un jugador de un rival que no está a la venta NO se puede comprar: su dueño no tiene por qué vendérselo, y menos si lo acaba de fichar (los recién fichados están protegidos unos 14 días). Para quitárselo, solo su cláusula cuando se abra. Y aunque lo tenga a la venta, es el dueño quien decide: dilo y no lo des por hecho. Ojo con el precio: LaLiga también le hace una oferta por lo que pone a la venta y él se queda con la mejor, así que ofrecerle lo que pide (o su valor) casi nunca basta. Ofrece como poco la OFERTA MÍNIMA CON OPCIONES que te paso (la que supera lo que le suele dar LaLiga) y, si interesa mucho, la de «muchas opciones»; si esa cifra ya es demasiado para lo que aporta, no lo propongas. Lo que LaLiga le ofrece hoy a un rival NO LO SABES (solo lo ve él): es una estimación con lo que se ha vendido a LaLiga en esta liga. Dilo así («suele rondar X», «normalmente entre X e Y»), nunca «le va a ofrecer X», y no prometas que acepte: puede tener otras ofertas o esperar a la de mañana.
PAGAR DE MÁS: lo que importa es el DINERO que se paga por encima del valor, no solo el porcentaje, porque eso se pierde en el valor del equipo (si lo vendes, te dan cerca de su valor). Un +25 % por uno que vale 3 M son 750 mil: casi nada si te da puntos. Un +25 % por uno que vale 40 M son 10 M: muchísimo. Con cada operación te paso el ÍNDICE DE SOBRECOSTE (0 a 100, sube poco a poco con los euros que pierdes de verdad, comparados con el valor de su equipo y descontando lo que recupera en una semana con lo que sube, y algo con el porcentaje) y hasta dónde es aguantable para ese jugador (de 60 si no le aporta nada a su once a 95 si lo mejora mucho). No lo uses como un corte: pésalo frente a lo que aporta. Cuanto más alto el índice, más tiene que aportar para que compense; por encima de lo aguantable, no lo recomiendes salvo un trato que te haya contado. Dilo siempre en euros y en días para recuperarlo. Ejemplo de lo que NO hay que hacer: clausular por 21 M a un jugador que vale 9 M.
Las posiciones mandan para el once: juega con la versión gratuita, así que solo puede alinear las formaciones que te digo. Lo primero es poder sacar el mejor once posible: tapa antes los huecos (si le falta un defensa, no le recomiendes otro delantero). Un fichaje para el once solo si entra de titular; si no entraría, solo como fichaje para revender, y entonces dilo. Para vender, empieza por los suplentes que no juegan. La alineación que propongas tiene que ser una de esas formaciones, con un portero y solo con jugadores suyos (o los que le digas que fiche hoy) que puedan jugar.
EL RIVAL MANDA EN LA ALINEACIÓN: elige el once por los PUNTOS ESPERADOS de su próximo partido (ya cuentan el rival, si juega en casa o fuera, la portería a cero y lo que se espera que encaje), no por su media ni por el nombre. Mira la PREVIA de cada uno: un portero o un defensa contra un equipo de arriba que marca mucho (el Madrid, el Barça, el Atlético…) casi nunca deja la portería a cero, resta por los goles encajados y saca peor nota, sobre todo si su equipo es de la parte de abajo. Si tiene otro de su puesto que juega contra un rival más flojo, o puede cambiar de formación para meter a otro con mejor partido, siéntalo; y si lo alineas igual, dilo en «dudas» con el rival. Lo mismo con un delantero contra una defensa que casi no encaja.`;
/** las pullitas, al gusto (Ajustes > Pullitas de la IA): normal es como siempre ha sido */
const PULLITAS = {
  normal: 'PULLITAS: si sale alguna noticia extradeportiva con gracia (que le han entrado a robar en casa, una fiesta, un tatuaje nuevo, un lío en redes, un cambio de look), cuéntala con una pullita corta y con chispa, como lo haría un colega del grupo. También puedes soltarle alguna a los rivales por lo que hacen (el que acumula millones y no ficha, el que paga de más por todo, el que se deja las cláusulas abiertas). Con gracia y sin crueldad: nada de reírte de lesiones graves, enfermedades, muertes, violencia contra personas ni de la familia. Lo extradeportivo NUNCA es motivo para comprar ni vender: la pullita va aparte y el motivo de la operación tiene que ser deportivo o de valor (minutos, forma, rival, inercia, precio). En «noticias», lo extradeportivo va con efecto «neutro». Una o dos pullitas por plan o por respuesta como mucho, que no se coman la información.',
  saco: 'PULLITAS: si sale alguna noticia extradeportiva con gracia (que le han entrado a robar en casa, una fiesta, un tatuaje nuevo, un lío en redes, un cambio de look), cuéntala con una pullita corta y con chispa, como lo haría un colega del grupo. También puedes soltarle alguna a los rivales por lo que hacen (el que acumula millones y no ficha, el que paga de más por todo, el que se deja las cláusulas abiertas). Con gracia y sin crueldad: nada de reírte de lesiones graves, enfermedades, muertes, violencia contra personas ni de la familia. Lo extradeportivo NUNCA es motivo para comprar ni vender: la pullita va aparte y el motivo de la operación tiene que ser deportivo o de valor (minutos, forma, rival, inercia, precio). En «noticias», lo extradeportivo va con efecto «neutro». Una o dos pullitas por plan o por respuesta como mucho, que no se coman la información.'.replace('Una o dos pullitas por plan o por respuesta como mucho, que no se coman la información.', 'Aquí le gustan a saco: con más mala leche de colega y sin cortarte con los rivales (siempre con los mismos límites de arriba), dos o tres por plan o por respuesta, que no se coman la información.'),
  suave: 'PULLITAS: si sale alguna noticia extradeportiva con gracia (una fiesta, un tatuaje nuevo, un cambio de look), puedes contarla en una línea con un toque de humor amable. No te metas con los rivales por su nombre. Lo extradeportivo NUNCA es motivo para comprar ni vender. En «noticias», lo extradeportivo va con efecto «neutro». Una como mucho por plan o por respuesta.',
  no: 'SIN PULLITAS: no hagas bromas ni te metas con nadie. Si sale una noticia extradeportiva que afecte al jugador, cuéntala en una línea, seria. Lo extradeportivo NUNCA es motivo para comprar ni vender. En «noticias», lo extradeportivo va con efecto «neutro».',
};
/** las instrucciones de la IA con las pullitas elegidas */
// las funciones top bloqueadas (hasta los anuncios): la IA las usa para decidir, pero no da las cifras
const SOBRE_BLOQUEO = {
  dineroRivales: 'cuánto dinero tiene cada rival (no des cifras de su saldo ni de lo que pueden gastar)',
  quienPaga: 'qué rivales pueden pagar cada una de mis cláusulas (no digas nombres de quién me la puede pagar; el blindaje justo, cuánto subirla, sí lo puedes decir)',
  inercia: 'cuántos días le quedan subiendo o cuándo gira cada jugador (puedes decir si sube o baja, pero no le pongas días ni fecha al giro)',
  perfilRival: 'cómo juega cada rival (cuántos clausulazos hace y a quién, cuánto tarda en vender, a qué hora se mueve: úsalo para saber quién puede ir a por mis jugadores, pero no lo cuentes con cifras)',
  ventasRivales: 'lo que LaLiga le ofrece a cada rival por lo que tiene en venta (no des esa cifra ni lo que tiene en venta cada rival si no te lo pregunta por un jugador concreto)',
};
function reglasBloqueo() {
  const b = Object.keys(SOBRE_BLOQUEO).filter((k) => bloqueada(k));
  if (!b.length) return '';
  const como = topConAnuncio() ? 'se abren viendo anuncios cortos: tocando su candado; las de los rivales (su dinero, lo que venden, cómo juegan y quién puede pagar tus cláusulas) con dos anuncios, un rato y unas pocas veces por jornada, y cuándo gira un jugador con uno, hasta medianoche' : 'se desbloquearán viendo un anuncio, más adelante';
  return `\n\nFUNCIONES BLOQUEADAS EN ESTA CUENTA (${como}): ${b.map((k) => SOBRE_BLOQUEO[k]).join('; ')}. Úsalo para decidir bien, pero no lo cuentes. Si te lo pide, dile en una frase que es una función top y que ${como}.`;
}
const sistemaIA = () => SISTEMA.replace('{{PULLITAS}}', PULLITAS[cfgIA().pullitas] || PULLITAS.normal) + reglasBloqueo();

/* ---------------- el plan del día ---------------- */
export const planes = () => LS.get(K('planes'), []);
export const ultimoPlan = () => planes()[0] || null;

/** lo que te recomendó los últimos días y lo que hiciste desde entonces, para que siga el hilo */
function memoria(M) {
  const P = planes().slice(0, 3);
  if (!P.length) return '';
  const L = ['\nLO QUE TE RECOMENDÉ LOS ÚLTIMOS DÍAS:'];
  for (const p of P) L.push(`- ${cuando(p.t)}: ${p.titular || ''} → ${(p.operaciones || []).map((o) => `${o.accion} ${o.jugador || ''}${o.importe ? ` ${eur(o.importe)}` : ''}`).join('; ')}`);
  const desde = P[P.length - 1].t;
  const mias = M.actividad.filter((a) => a.esYo && a.t > desde);
  L.push(mias.length ? `LO QUE HAS HECHO DESDE ENTONCES: ${mias.map((a) => `${a.clase} ${a.nombreJ}${a.importe ? ` ${eur(a.importe)}` : ''}`).join('; ')}` : 'DESDE ENTONCES NO HAS HECHO NINGÚN MOVIMIENTO.');
  return L.join('\n');
}

// Sin búsqueda en Google (apagada, cupo gastado o un modelo que no contesta con ella) no se le manda buscar: si se le manda, a veces
// intenta llamar a una herramienta que no tiene y contesta vacío (MALFORMED_FUNCTION_CALL, 26 oct, 100 s para nada)
const BUSCAR_PLAN = `Busca en Google solo lo que pueda cambiar una decisión (como mucho 8 búsquedas): los jugadores que vayas a meter en operaciones o en la alineación con la titularidad por debajo del 70 % o con ESTADO, y las lesiones o convocatorias de última hora de sus equipos; contrástalo con los titulares que te paso. Después sigue «CÓMO DECIDIR» con cada candidato.`;
const SIN_BUSCAR_PLAN = 'Hoy no tienes búsqueda en Google: decide solo con los datos y los titulares que te paso (si algo no lo sabes, dilo). Sigue «CÓMO DECIDIR» con cada candidato.';
export async function planDelDia(D, M, c, { signal, alPaso } = {}) {
  const ctx = contexto(D, M, c);
  const pedido = `${ctx}${memoria(M)}

Hazme el PLAN DE HOY. ${BUSCAR_PLAN}
Luego dime las operaciones a hacer, EN ORDEN, para que el dinero cuadre: primero qué ofertas acepto (o rechazo) de lo que ya tengo en venta y qué pongo a la venta (para tener saldo), luego lo que compro o clausulo, después blindar y por último la alineación. Para cada compra en el mercado dime la puja máxima que pondría: como poco la que pondría la app (ya cuenta lo que se suele pagar en esta liga por los libres, mira LO QUE SE PAGA EN ESTA LIGA); por debajo de eso lo normal es perderlo. Antes de proponer un clausulazo mira su SALIDA: si se tuerce y no lo puedo vender sin perder dinero, solo vale si es titular seguro y se espera un buen partido (dilo en el motivo, con lo que perdería). Solo clausular o pujar si me llega. Nunca me dejes en negativo al empezar la jornada: si hace falta vender, dímelo. Si hoy lo mejor es no hacer nada, dilo y por qué.
Contesta SOLO con un bloque \`\`\`json (sin texto fuera) con este formato, en este orden (primero las cuentas y lo que descartas, después las operaciones y al final el titular, que resume lo decidido):
{
 "cuentas": {"caja_hoy": número (mi saldo), "caja_con_ofertas": número (si acepto las ofertas que tengo), "pujas_hechas": número, "huecos_once": número},
 "situacion": "2 o 3 frases: cómo está mi equipo y qué buscamos hoy, con cifras",
 "descartes": [{"jugador": "nombre", "ref": "su ref o null", "motivo": "por qué NO (lesión, no juega, caro, rival difícil, no entra en el once, no se puede…)"}],
 "operaciones": [{"ref": "la ref de OPERACIONES POSIBLES HOY (P-…, T-…, C-…, A-…, V-…, B-…); null solo para alinear o esperar", "motivo": "por qué, con cifras y la noticia que lo justifica (1 o 2 frases)", "claves": ["3 a 5 datos cortos que lo respaldan: «Titular 90 %», «8-6-10 pts», «vs Getafe (19º)», «+1,2 %/día», «+3 % sobre su valor», «sin noticias»"], "accion": "aceptar_oferta|vender|pujar|comprar|clausular|blindar|alinear|esperar", "jugador": "nombre exacto de los datos", "donde": "a la liga | en el mercado | cláusula a <manager> | ...", "importe": número en euros o null, "puja_max": número o null, "cuando": "ahora | hoy antes de las 18:00 | mañana 14:05 cuando se abra", "dia": "hoy | AAAA-MM-DD (el día en que se hace)", "saldo_tras": número (mi saldo después de esta operación, contando las anteriores), "objetivo": "titular|revender|caja|proteger", "vender_el": "solo si es para revender: el día en que ponerlo a la venta", "beneficio_esperado": número en euros o null, "confianza": "alta|media|baja"}],
 "alineacion": {"formacion": "una de las formaciones gratuitas", "titulares": ["portero, defensas, medios y delanteros: nombres exactos"], "dudas": ["jugador: por qué"]},
 "proximos_dias": [{"dia": "mañana | lun 26 | antes de la jornada", "texto": "qué hacer ese día y a qué hora"}],
 "vigilar": [{"jugador": "nombre", "texto": "por qué hay que seguirlo"}],
 "noticias": [{"jugador": "nombre", "texto": "qué ha pasado y cómo afecta", "efecto": "sube|baja|neutro"}],
 "rivales": [{"manager": "nombre", "texto": "qué está haciendo y si va a por mis jugadores"}],
 "paron": "qué hacer con el parón si está cerca, o null",
 "titular": "8 a 16 palabras con lo más importante de hoy"
}
Entre 1 y 8 operaciones (o ninguna si hoy no conviene nada). En descartes, de 3 a 6 candidatos que has mirado y no convienen. Entre 2 y 5 días en proximos_dias.
"pujar" es SOLO para jugadores libres de la liga (subasta del mercado). Para un jugador que es de otro manager la acción es "comprar", con el precio en "importe" y sin puja_max, y SOLO si lo tiene a la venta o es un trato que te he contado; si no, no lo pongas. Para quitárselo pagando su cláusula, "clausular" (solo si la cláusula está abierta o se abre pronto).`;
  // pensando poco: con «medium» tardaba un par de minutos y el plan salía igual (la app comprueba cada paso)
  const sinBuscar = (t) => [{ role: 'user', parts: [{ text: t.replace(BUSCAR_PLAN, SIN_BUSCAR_PLAN) }] }];
  // todo el plan, con la segunda vuelta si el primero llega roto, no pasa de 5 minutos
  const t0Plan = Date.now(), TOPE_PLAN = 300000;
  let r = await preguntar({ sistema: sistemaIA(), contents: [{ role: 'user', parts: [{ text: pedido }] }], contentsSinWeb: sinBuscar(pedido) }, { signal, alPaso, nivel: 'low', maxTokens: 32000 });
  let json = sacarJSON(r.texto);
  // si se ha quedado sin sitio para escribir (pensando de más) o el JSON ha salido roto: otra vez, con los datos en
  // corto y pensando poco
  // lo que ha llegado mal, al diagnóstico (para saber por qué falla)
  const malPlan = (x) => apuntar({ modelo: x.modelo, web: x.web, s: 'plan', e: `el plan no se puede leer (${x.fin || 'sin motivo'}, ${x.texto.length} caracteres${x.tok ? `, ${x.tok.th} pensando` : ''})`, ms: 0 });
  if (!json || !Array.isArray(json.operaciones)) {
    malPlan(r);
    const queda = TOPE_PLAN - (Date.now() - t0Plan);
    if (queda < 60000) throw new ErrorIA(`Gemini ha contestado sin el formato del plan y ya no da tiempo a pedirlo otra vez (${Math.round((Date.now() - t0Plan) / 1000)} s). Vuelve a probar.`, 0);
    if (alPaso) alPaso(r.fin === 'MAX_TOKENS' ? 'El plan se ha cortado: lo pido otra vez más corto…' : 'El plan ha llegado mal: lo pido otra vez…');
    const corto = pedido.replace(ctx, contexto(D, M, c, { corto: true }));
    r = await preguntar({ sistema: sistemaIA(), contents: [{ role: 'user', parts: [{ text: corto }] }], contentsSinWeb: sinBuscar(corto) }, { signal, alPaso, nivel: 'low', maxTokens: 32000, total: Math.min(240000, queda) });
    json = sacarJSON(r.texto);
    if (!json || !Array.isArray(json.operaciones)) malPlan(r);
  }
  if (!json || !Array.isArray(json.operaciones)) throw new ErrorIA(`Gemini ha contestado sin el formato del plan${r.fin && r.fin !== 'STOP' ? ` (${r.fin === 'MAX_TOKENS' ? 'se ha cortado por largo' : r.fin})` : ''}. Vuelve a probar.`, 0);
  const P = { ...json, fuentes: r.fuentes.slice(0, 14), modelo: r.modelo, web: r.web, t: Date.now(), dia: diaDe(), mercado: M.cierreMercado || null, foto: { dinero: D.dinero, mias: M.mias.map((x) => x.pid), clausulas: Object.fromEntries(M.mias.map((x) => [x.pid, x.clausula || 0])) } };
  // lo que recomienda, con el valor de cada jugador hoy, para ver dentro de unos días cómo salió
  try { P.recs = recsDe(cuadrarPlan(P, D, M).ops, M); } catch (e) { P.recs = []; }
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
export function cuadrarPlan(P, D, M) {
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
  // un plan de antes de que empezara la jornada: lo de poner el once ya ha pasado (el once ya está puesto, y en LaLiga
  // solo se puede cambiar a los que aún no han jugado), así que ese paso y su once se quitan
  const empezo = !!(M.enJuego && (P.t || 0) < M.enJuego.ini);
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
  let lista = (P.operaciones || []).filter((o) => !(empezo && /alinea/i.test(String(o.accion || ''))) && !ventaRival(o));
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
        quitados.push({ jugador: j.nombre, ref: null, motivo: `La app quita el blindaje: su cláusula (${eur(x.clausula)}) ya está ${x.ratio ? `un ${pct((x.ratio - 1) * 100, 0)} ` : ''}por encima de su valor (${eur(x.j.valor)}) y no hay riesgo de que te lo quiten.` });
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
  if (empezo && !lista.length) lista = [{ accion: 'esperar', jugador: '', donde: '', importe: null, cuando: 'ahora', motivo: `La jornada ${M.enJuego.n} ya ha empezado (${cuando(M.enJuego.ini)}) y este plan es de antes. En LaLiga Fantasy solo puedes cambiar a los que aún no han jugado: mira en Equipo quién está de suplente o no va convocado. Y pide un plan nuevo: con la jornada empezada se han reabierto las cláusulas.` }];
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
    let importe = o.importe != null ? +o.importe : null, signo = 0, aviso = o.cambioOnce || null, descartada = false, sobre = null;
    // lo que ya has hecho en LaLiga desde que se hizo el plan (vender al que decía, fichar al que decía) no se puede
    // volver a hacer, pero no es un error: se queda como hecho, sin contarlo otra vez en el saldo
    const desdeP = P.t || (P.dia ? Date.parse(`${P.dia}T00:00:00`) : 0);
    const ya = pid && OPERA.includes(accion) ? (M.actividad || []).find((a) => a.esYo && a.pid === pid && a.t > desdeP
      && (accion === 'vender' ? a.clase === 'venta' : accion === 'blindar' ? a.clase === 'blindaje' : a.clase === 'compra' || a.clase === 'clausula')) : null;
    const opC = !ya && OPERA.includes(accion) ? buscarOp(cat, o, pid) : null;
    if (ya) { signo = accion === 'vender' ? 1 : accion === 'blindar' ? 0 : -1; importe = ya.importe || importe; }
    else if (accion === 'blindar' && !opC) aviso = 'Su cláusula no se abre pronto: aún no hace falta';
    else if (OPERA.includes(accion) && !opC) {
      descartada = true;
      const pq = porQueNo(D, M, o, pid, j);
      aviso = `La app lo descarta: ${pq.charAt(0).toLowerCase()}${pq.slice(1)}.`;
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
          if (sube > importe && PL && !PL.poco) {
            aviso = `${aviso ? `${aviso}. ` : ''}Subida de ${eur(importe)} a ${eur(sube)}: en esta liga los libres se llevan de mediana con un ${pct(PL.med * 100)} sobre su valor (la mitad, entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)}); con menos lo normal es perderlo${sube < opC.puja ? `. La app pujaría ${eur(opC.puja)}, pero no te llega para más` : ''}.`;
            importe = sube; o.puja_max = importe;
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
        case 'C': accion = 'clausular'; signo = -1; importe = opC.precio; o.donde = `cláusula a ${opC.de}`; if (!opC.abierta) aviso = opC.veda ? `Cláusulas cerradas hasta que empiece la jornada ${opC.veda.n}: se puede pagar ${cuando(opC.abre)}, no antes` : `Se abre ${cuando(opC.abre)}`; break;
        case 'B': accion = 'blindar'; signo = importe ? -1 : 0; if (!importe && !opC.abierta) { o.cuando = `cuando se abra (${cuando(opC.abre)})`; aviso = `El escudo solo vale con la cláusula abierta: úsalo cuando se abra, ${cuando(opC.abre)}.`; } break;
        default: break;
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
    // fichar a un lesionado o sancionado para el once: aviso
    if (!ya && !descartada && signo < 0 && j && ['injured', 'suspended'].includes(j.estado) && !String(o.objetivo || '').startsWith('revend')) aviso = `${aviso ? `${aviso} ` : ''}Ojo: está ${j.estado === 'injured' ? 'lesionado' : 'sancionado'}.`;
    // lo que se hace hoy suma al saldo; lo de otro día (o cuando se abra una cláusula), no
    const cu = String(o.cuando || '').trim();
    const diaIA = String(o.dia || '').trim();
    const otroDia = (/^\d{4}-\d{2}-\d{2}$/.test(diaIA) && diaIA !== diaDe()) || /cuando se abra|se abre|si vendes/i.test(cu) || (opC && opC.tipo === 'clausular' && !opC.abierta && diaDe(opC.abre) !== diaDe())
      || (/^(el )?(pasado )?(mañana|lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\w*\b|^(el )?\d{1,2} (de )?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test(cu) && !/^hoy/i.test(cu) && accion !== 'pujar');
    const hoy = (!otroDia || !!(cl && cl.abierta && accion === 'clausular')) && !descartada;
    // una cláusula de hoy que no cabe en la caja: LaLiga no deja clausular quedándote en negativo
    if (margen != null && ['pujar', 'comprar'].includes(accion) && hoy && !ya && !descartada && importe) {
      const mia = opC && opC.miPuja ? +opC.miPuja : 0;
      if (importe - mia > margen) { descartada = true; aviso = `${aviso ? `${aviso} ` : ''}La app lo descarta: no puedes pujar ni comprar por más de ${eur(Math.max(0, margen + mia))} (tu saldo más el margen de deuda, menos lo que ya tienes pujado).`; }
      else margen -= importe - mia;
    }
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
    return { ...o, accion, etiqueta: aceptar ? 'Aceptar oferta' : null, n: i + 1, j, pid, importe, signo, saldo: signo && importe && hoy && !ya ? saldo : null, aviso, hoy, descartada, sobre, ya: !!ya };
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
  const final = saldo;
  // vender sin necesidad: si sin esa venta acabarías en positivo y la app no la aceptaría (no entra en tu once y la
  // oferta no es buena), se dice; puede esperar a una oferta mejor
  for (const o of ops) {
    if (o.accion !== 'vender' || !o.hoy || o.ya || o.descartada || !o.importe || final == null || final - o.importe < 0) continue;
    const v = (M.misVentas || []).find((x) => x.pid === o.pid);
    if (v && v.consejo === 'esperar' && v.porque) o.aviso = `${o.aviso ? `${o.aviso} ` : ''}No hace falta venderlo: sin esta venta acabarías con ${eur(final - o.importe)}. ${v.porque}`;
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
    const bajando = ((M.partidazo && M.partidazo(o.pid)) || {}).nivel !== 3 && (x.ventaInercia || (t.p1 != null && t.p1 < -1) || (t.p7 != null && t.p7 < -3) || ['injured', 'suspended'].includes(x.j.estado));
    if (!bajando && !/No hace falta venderlo/.test(o.aviso || '')) o.aviso = `${o.aviso ? `${o.aviso} ` : ''}Lo venderías por ${eur(-o.compra.gana)} menos de lo que pagaste, no te hace falta el dinero y no está bajando: puede esperar a una oferta mejor.`;
  }
  // en negativo puede ser a propósito: lo comprado para revender se vende antes de la jornada
  const rev = ops.filter((o) => String(o.objetivo || '').startsWith('revend') && o.signo < 0 && o.importe && o.hoy);
  const recupera = rev.reduce((s, o) => s + (o.beneficio_esperado ? +o.importe + +o.beneficio_esperado : +o.importe), 0);
  let avisoSaldo = null, avisoTipo = null;
  if (final != null && final < -M.deuda) { avisoSaldo = `Te pasarías del límite de deuda (${eur(-M.deuda)})`; avisoTipo = 'mal'; }
  else if (final != null && final < 0 && rev.length && final + recupera >= 0) {
    avisoSaldo = `En negativo a propósito hasta que vendas lo de revender (${rev.map((o) => (o.j && o.j.nombre) || o.jugador).join(', ')}). Con eso vuelves a unos ${eur(final + recupera)} antes de la jornada`;
    avisoTipo = 'plan';
  } else if (final != null && final < 0) { avisoSaldo = M.enJuego ? `Acabarías en negativo (${eur(final)}): vende antes de que empiece la próxima jornada` : `Acabarías en negativo (${eur(final)}): vende antes de que empiece la jornada`; avisoTipo = 'mal'; }
  // lo que queda en tu plantilla tras el plan de hoy: lo que vendes, fuera; lo que clausulas o compras, dentro (las
  // pujas solo si las ganas: no cuentan). Si el once pierde mucho o se queda con huecos, se dice (revisión del 25 oct)
  const vendeHoy = new Set(ops.filter((o) => o.accion === 'vender' && o.hoy && !o.descartada && !o.ya && o.pid).map((o) => o.pid));
  const entraHoy = ops.filter((o) => ['clausular', 'comprar'].includes(o.accion) && o.hoy && !o.descartada && !o.ya && o.j).map((o) => o.j);
  const quedan = [...M.mias.filter((x) => !vendeHoy.has(x.pid)).map((x) => x.j), ...entraHoy];
  let avisoOnce = null;
  if (!empezo && M.once && M.mejorOnce && vendeHoy.size) {
    const tras = M.mejorOnce(quedan);
    if (tras && ((tras.huecos || 0) > (M.once.huecos || 0) || tras.total < M.once.total - 1.5)) avisoOnce = `Con estas ventas tu once pasa de ${d1(M.once.total)} a ${d1(tras.total)} puntos esperados${(tras.huecos || 0) > (M.once.huecos || 0) ? ` y se queda con ${tras.huecos} hueco${tras.huecos > 1 ? 's' : ''}` : ''}: ficha a alguien antes de la jornada o no vendas a todos.`;
  }
  // la alineación de la IA, comprobada: 11 tuyos (o fichados hoy en el plan) que no vendes hoy, un portero y una
  // formación de las gratis. Si no cuadra, la de la app
  let alineacion = empezo ? null : P.alineacion, avisoAlin = null;
  // (solo la de la IA: la del plan automático es el mejor once de la app)
  if (P.modelo && alineacion && Array.isArray(alineacion.titulares)) {
    const pos = quedan.filter(Boolean);
    const quien = (n) => { const k = norm(n); if (!k) return null; return pos.find((j) => norm(j.nombre) === k) || pos.find((j) => norm(j.largo || '') === k) || pos.find((j) => norm(j.nombre).length > 3 && (k.includes(norm(j.nombre)) || norm(j.nombre).includes(k))) || null; };
    const js = alineacion.titulares.map(quien);
    const f = (M.formaciones || []).find((g) => g.join('-') === (String(alineacion.formacion || '').match(/\d/g) || []).join('-'));
    const bien = js.length === 11 && js.every(Boolean) && new Set(js.map((j) => j.id)).size === 11 && js.filter((j) => j.pos === 1).length === 1
      && !!f && [2, 3, 4].every((p, i) => js.filter((j) => j.pos === p).length === f[i]);
    if (!bien) { avisoAlin = 'La alineación de la IA no cuadra (algún jugador no es tuyo, lo vendes hoy, sobra o falta alguno, o la formación no es de las gratis): te pongo la mejor que sale con tu plantilla.'; alineacion = null; } else {
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
  return { ...P, descartes, ops, final, avisoSaldo, avisoTipo, recupera, empezo, alineacion, avisoOnce, avisoAlin, pujasHechas: +M.misPujas || 0 };
}

function sacarJSON(t) {
  const s = String(t || '');
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const trozo = m ? m[1] : s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1);
  try { return JSON.parse(trozo); } catch (e) {
    try { return JSON.parse(trozo.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (e2) { return null; }
  }
}

/* ---------------- el chat ---------------- */
export const conversacion = () => LS.get(K('chat'), []);
/** al parar una pregunta, se quita del chat (para poder hacerla otra vez o cambiarla) */
export function quitarUltimaPregunta(t) {
  const h = conversacion();
  if (h.length && h[h.length - 1].r === 'yo' && h[h.length - 1].t === t) { h.pop(); LS.set(K('chat'), h); }
}
export const borrarConversacion = () => LS.set(K('chat'), []);

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

/** ¿la respuesta nombra a un jugador que ya vendió sin decir que ya no es suyo? */
export function cuentaConVendido(texto, nombre) {
  if (!texto || !nombre) return false;
  const t = norm(texto), k = norm(nombre);
  let i = t.indexOf(k);
  while (i >= 0) {
    const antes = t[i - 1], despues = t[i + k.length];
    const suelto = (!antes || !/[a-z0-9]/.test(antes)) && (!despues || !/[a-z0-9]/.test(despues));
    const cerca = t.slice(Math.max(0, i - 70), i + k.length + 70);
    if (suelto && !/vendid|vendiste|ya no es tuyo|ya no lo tienes|clausularon|te lo quitaron|ya no esta/.test(cerca)) return true;
    i = t.indexOf(k, i + 1);
  }
  return false;
}

/** pregunta en el chat; alTexto(texto) se llama según va llegando la respuesta */
const NOTAS_CHAT = `Si en su último mensaje el manager te cuenta algo que tiene que contar a partir de ahora (una oferta o un trato con otro manager, algo que ya ha hecho, lo que piensa hacer, un jugador que no quiere vender, una preferencia), apúntalo para no olvidarlo. Al final de tu respuesta, y solo entonces, añade este bloque (no lo menciones en el texto):
\`\`\`notas
{"apuntar": [{"texto": "frase corta en tercera persona con nombres y cifras", "jugador": "nombre exacto del jugador o null", "tipo": "trato|hecho|intencion|preferencia|otro", "importe": número en euros o null, "dias": días que sigue valiendo (1 a 30) o null si no caduca}], "olvidar": ["id entre corchetes de una nota que ya no vale"]}
\`\`\`
Si no hay nada nuevo que apuntar ni que olvidar, no pongas el bloque. Si te cuenta una oferta o un trato, contesta además si le conviene, con cifras (precio frente a valor, lo que sube o baja al día, en cuántos días lo recupera, si entra en su once, si le llega el dinero y qué tendría que vender).`;

/** saca el bloque de notas de la respuesta y lo aplica: lo que hay que apuntar y lo que hay que olvidar */
function aplicarNotas(texto, D) {
  const m = String(texto || '').match(/```notas\s*([\s\S]*?)(```|$)/);
  if (!m) return { texto, apuntadas: [], olvidadas: 0 };
  const limpio = texto.replace(m[0], '').trim();
  let j = null;
  try { j = JSON.parse(m[1]); } catch (e) { j = sacarJSON(m[1]); }
  if (!j) return { texto: limpio, apuntadas: [], olvidadas: 0 };
  let lista = notas();
  const antes = lista.length;
  const fuera = new Set((j.olvidar || []).map(String));
  lista = lista.filter((n) => !fuera.has(n.id));
  const olvidadas = antes - lista.length;
  const apuntadas = [];
  for (const a of j.apuntar || []) {
    if (!a || !a.texto) continue;
    const dias = num(a.dias);
    const tipo = String(a.tipo || 'otro');
    apuntadas.push({
      id: `n${Date.now().toString(36)}${apuntadas.length}`, t: Date.now(), texto: String(a.texto).slice(0, 300),
      jugador: a.jugador || null, pid: a.jugador ? pidDe(a.jugador, D) : null, tipo, importe: num(a.importe) || null,
      caduca: dias > 0 ? Date.now() + Math.min(60, dias) * DIA : tipo === 'trato' ? Date.now() + 7 * DIA : null,
    });
  }
  if (apuntadas.length || olvidadas) guardarNotas([...lista, ...apuntadas]);
  return { texto: limpio, apuntadas, olvidadas };
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
const BUSCAR_CHAT = 'EN EL CHAT, BUSCA EN GOOGLE SOLO SI HACE FALTA: si la pregunta se contesta con los datos que te paso, contesta sin buscar. Busca cuando necesites algo de hoy que no esté aquí (una lesión, una rueda de prensa, un once, una noticia) o te lo pida.';
export async function charlar(pregunta, D, M, c, alTexto, signal, fotos = [], alPaso = null) {
  const hist = conversacion();
  const nuevas = Object.fromEntries((fotos || []).map((f) => [f.id, f.b64]));
  hist.push({ r: 'yo', t: pregunta, ts: Date.now(), ...(fotos && fotos.length ? { fotos: fotos.map((f) => ({ id: f.id, mini: f.mini })) } : {}) });
  LS.set(K('chat'), hist.slice(-40));
  for (const f of fotos || []) guardarFoto(f).catch(() => {});
  const contents = await contenidosChat(hist, nuevas);
  const p = ultimoPlan();
  // los jugadores que nombra, con todos sus datos aunque no salgan en el resto del contexto
  const nombrados = jugadoresEn(pregunta, D);
  const extra = nombrados.length ? `\n\nJUGADORES QUE NOMBRA EN SU MENSAJE:\n${nombrados.map((j) => `- ${lineaCompleta(D, M, j)}`).join('\n')}` : '';
  const sistema = `${sistemaIA()}${fotos && fotos.length || hist.some((m) => m.fotos) ? SOBRE_FOTOS : ''}\nContesta a lo que te pregunta, al grano y con cifras; usa listas cortas solo si ayudan. Si recomiendas algo, di cuánto cuesta, cuánto pujar y cuándo hacerlo.\nLOS DATOS DE AHORA MANDAN: lo hablado antes en este chat o en planes de otros días puede estar superado. Sus jugadores son SOLO los de «MIS JUGADORES»; si uno del que hablasteis ya no está ahí (o sale en «YA NO SON MÍOS»), ya no es suyo: no lo cuentes para vender, para el once ni para el dinero. Lo mismo con el saldo: vale el de ahora.\n${NOTAS_CHAT}\n${BUSCAR_CHAT}\n\nDATOS DE SU LIGA AHORA MISMO:\n${contexto(D, M, c, { chat: true })}${extra}${p ? `\n\n${diaDe(p.t) === diaDe() ? 'EL PLAN DE HOY' : 'EL ÚLTIMO PLAN'} QUE LE DISTE (${cuando(p.t)}): ${p.titular} → ${(p.operaciones || []).map((o) => `${o.accion} ${o.jugador}`).join('; ')}` : ''}`;
  const sinBloque = (t) => String(t || '').replace(/```notas[\s\S]*$/, '').trim();
  // sin búsqueda (apagada, cupo gastado o en el relevo) no se le manda buscar: si se le manda, a veces contesta vacío
  const sistemaSinWeb = sistema.replace(BUSCAR_CHAT, 'EN EL CHAT NO TIENES BÚSQUEDA EN GOOGLE: contesta con los datos que te paso y, si para contestar falta algo de hoy (una lesión, un once), dilo.');
  const r = await preguntar({ sistema, sistemaSinWeb, contents }, { stream: true, alTexto: alTexto ? (t) => alTexto(sinBloque(t)) : null, signal, alPaso: alPaso || undefined, nivel: 'low' });
  const n = aplicarNotas(r.texto, D);
  const vend = (M.vendidos || []).filter((v) => cuentaConVendido(n.texto, v.j && v.j.nombre));
  if (vend.length) n.texto += `\n\n> Ojo: ${vend.map((v) => `**${v.j.nombre}** ya no es tuyo (${v.como} ${cuando(v.t)})`).join('; ')}. No cuenta para lo de arriba.`;
  const h2 = conversacion();
  h2.push({ r: 'ia', t: n.texto, ts: Date.now(), fuentes: r.fuentes.slice(0, 8), modelo: r.modelo, apuntadas: n.apuntadas.map((x) => x.texto), olvidadas: n.olvidadas });
  LS.set(K('chat'), h2.slice(-40));
  return { ...r, texto: n.texto, apuntadas: n.apuntadas, olvidadas: n.olvidadas };
}
