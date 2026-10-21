/* La IA: Gemini (Google AI Studio) con tu clave gratuita, llamada directamente desde el móvil a Google.
   Hace el plan del día (las operaciones en orden: qué vender, qué comprar, a quién clausular, cuánto pujar)
   cruzando todo lo de tu liga con lo que busca en Google (lesiones, convocatorias, alineaciones probables).
   Prueba todos los modelos gratuitos que tenga tu clave antes de rendirse, y si se acaba la búsqueda en
   Google, sigue sin ella. Cada intento queda apuntado para el diagnóstico. */
import { leer, guardar, http, enApp } from './puente.js';
import { LS, eur, pct, cuando, dura, POS, DIA, diaDe, norm, num } from './util.js';
import { K } from './datos.js';
import { catalogo, catalogoTxt, comoConseguir, buscarOp, porQueNo } from './operaciones.js';
import { recsDe, aprendeTxt } from './aprende.js';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
// los de siempre, por si la lista de modelos de tu clave no llega
const BASE = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const diaGoogle = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

export const clave = () => leer('gemini') || '';
export const guardarClave = (k) => { guardar('gemini', (k || '').trim() || null); LS.del('ia-agotados'); LS.del('ia-modelos'); LS.del('ia-sin-web'); };
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
  const r = await peticion('GET', `${GEMINI}/models?pageSize=1000`, null, (k || '').trim());
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

async function cadena() {
  let lista;
  try { lista = await modelosDisponibles(); } catch (e) { if (e.estado === 400 || e.estado === 401 || e.estado === 403) throw e; lista = BASE; }
  if (!lista.length) lista = BASE;
  const elegido = cfgIA().modelo;
  const todos = [...new Set([...(elegido ? [elegido] : []), ...lista])];
  const f = fuera();
  return todos.filter((m) => !f[m]);
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
  if (estado === 401 || (estado === 403 && /PERMISSION_DENIED|SERVICE_DISABLED|has not been used/i.test(todo))) return new ErrorIA('Google no deja usar Gemini con esta clave. Crea otra en aistudio.google.com/apikey (mejor en un proyecto nuevo).', estado, { ...info, clave: estado === 401 });
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
async function peticion(metodo, url, cuerpo, k = clave(), { stream = false, signal } = {}) {
  if (enApp) {
    const pet = http(metodo, url, { cabeceras: { 'content-type': 'application/json', 'x-goog-api-key': k }, cuerpo: cuerpo == null ? null : JSON.stringify(cuerpo), tiempo: 200000 });
    // si lo paras, se deja de esperar al momento (la respuesta, si llega, se tira)
    const r = signal ? await Promise.race([pet, new Promise((_, mal) => {
      const parar = () => mal(new DOMException('Parado', 'AbortError'));
      if (signal.aborted) parar(); else signal.addEventListener('abort', parar, { once: true });
    })]) : await pet;
    if (r.s === 0) throw new ErrorIA(`Sin conexión con Google (${r.e || 'sin respuesta'})`, 0, { red: true, dns: !!r.dns });
    let j = null;
    try { j = JSON.parse(r.b || 'null'); } catch (e) { j = null; }
    if (r.s >= 400) throw errorDe(r.s, j);
    if (!j) throw new ErrorIA(`Respuesta rara de Google (${r.s})`, r.s);
    return { j };
  }
  let r;
  try {
    r = await fetch(url, { method: metodo, signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': k }, body: cuerpo == null ? undefined : JSON.stringify(cuerpo) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ErrorIA(`Sin conexión con Google (${e.message})`, 0, { red: true });
  }
  if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { /* nada */ } throw errorDe(r.status, j); }
  if (stream) return { r };
  return { j: await r.json() };
}

async function llamar(modelo, cuerpo, { stream = false, alTexto = null, signal } = {}) {
  // en la app no hay streaming: llega la respuesta entera de una vez
  const enVivo = stream && !enApp;
  const url = `${GEMINI}/models/${modelo}:${enVivo ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  const resp = await peticion('POST', url, cuerpo, clave(), { stream: enVivo, signal });
  let texto = '', fuentes = [], fin = null, bloqueo = null;
  const procesar = (j) => {
    if (j.promptFeedback && j.promptFeedback.blockReason) bloqueo = j.promptFeedback.blockReason;
    const c = (j.candidates || [])[0] || {};
    for (const p of (c.content && c.content.parts) || []) if (p.text && !p.thought) { texto += p.text; if (alTexto) alTexto(texto); }
    const g = c.groundingMetadata;
    if (g && g.groundingChunks) fuentes.push(...g.groundingChunks.map((x) => x.web).filter((w) => w && w.uri).map((w) => ({ t: w.title || w.uri, u: w.uri })));
    if (c.finishReason) fin = c.finishReason;
  };
  if (!enVivo) procesar(resp.j);
  else {
    const lector = resp.r.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const linea = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!linea.startsWith('data:')) continue;
        try { procesar(JSON.parse(linea.slice(5))); } catch (e) { /* trozo incompleto */ }
      }
    }
    if (buf.trim().startsWith('data:')) { try { procesar(JSON.parse(buf.trim().slice(5))); } catch (e) { /* nada */ } }
  }
  if (!texto.trim()) throw new ErrorIA(bloqueo ? `Google ha bloqueado la pregunta (${bloqueo})` : `El modelo ha contestado vacío${fin ? ` (${fin})` : ''}`, 0, { vacio: true });
  const vistas = new Set();
  fuentes = fuentes.filter((f) => !vistas.has(f.u) && vistas.add(f.u));
  return { texto, fuentes, fin };
}

const espera = (s, signal) => new Promise((res, rej) => { const t = setTimeout(res, s * 1000); if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Parado', 'AbortError')); }, { once: true }); });

/**
 * Pregunta con todos los modelos que haga falta. Por cada modelo: con búsqueda en Google; si la búsqueda se ha
 * acabado, sin ella; si es el cupo por minuto, espera lo que diga Google y repite; si es el del día, al siguiente.
 * alPaso(texto) cuenta lo que va pasando (para enseñarlo mientras piensa).
 */
async function preguntar({ sistema, contents }, op = {}) {
  const alPaso = op.alPaso || (() => {});
  const modelos = await cadena();
  if (!modelos.length) {
    const f = fuera();
    throw new ErrorIA(`Todos los modelos de tu clave han gastado su cupo gratis de hoy (${Object.keys(f).length} probados). Vuelven mañana a las 9:00.`, 429, { todos: true });
  }
  const quiereWeb = cfgIA().web;
  const resumen = [];
  let ultimo = null;
  let cortes = 0, webSospecha = null;
  // si con búsqueda da «cupo gastado» y sin ella el mismo modelo sí contesta, lo gastado es la búsqueda: fuera hoy
  const confirmarSinWeb = (modelo, e) => { if (webSospecha === modelo && !(e && e.estado === 429)) LS.set('ia-sin-web', diaGoogle()); webSospecha = null; };
  for (const modelo of modelos) {
    let web = quiereWeb && !sinWebHoy() && !esGemma(modelo);
    let pensar = !esGemma(modelo) && !/gemini-(1|2\.0)/.test(modelo);
    // pensar a medias: contesta en la mitad de tiempo y el plan sale igual de bien; los pro, lo justo
    let nivel = op.nivel || (/pro/.test(modelo) ? 'low' : 'medium');
    let esperado = false;
    for (let intento = 0; intento < 5; intento++) {
      if (op.signal && op.signal.aborted) throw new DOMException('Parado', 'AbortError');
      const cuerpo = esGemma(modelo)
        ? { contents: [{ role: 'user', parts: [{ text: `${sistema}\n\n---\n\n${contents.map((c) => `${c.role === 'model' ? 'ASISTENTE' : 'MANAGER'}: ${c.parts.map((p) => p.text).join('\n')}`).join('\n\n')}` }] }], generationConfig: { maxOutputTokens: 8192, temperature: 0.6 } }
        : { systemInstruction: { parts: [{ text: sistema }] }, contents, ...(web ? { tools: [{ google_search: {} }] } : {}), generationConfig: { maxOutputTokens: 16000, temperature: 0.6, ...(pensar ? { thinkingConfig: { thinkingLevel: nivel } } : {}) } };
      alPaso(`${nombreModelo(modelo)}${web ? ' con búsqueda en Google' : ''}…`);
      const t0 = Date.now();
      try {
        const r = await llamar(modelo, cuerpo, op);
        apuntar({ modelo, web, ok: true, ms: Date.now() - t0 });
        confirmarSinWeb(modelo, null);
        return { ...r, modelo, web, intentos: resumen };
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        ultimo = e;
        apuntar({ modelo, web, s: e.estado, e: e.message, google: e.google, ms: Date.now() - t0 });
        if (e.clave) throw e;
        if (!e.red) confirmarSinWeb(modelo, e);
        // se ha cortado la conexión (cambio de red, cobertura, Android cortando a la app): se espera y se repite
        // con el mismo modelo, sin gastar sus intentos, hasta 4 veces en total
        if (e.red && cortes < 4) {
          cortes++; intento--;
          alPaso(`Se ha cortado la conexión con Google. Vuelvo a probar (${cortes}/4)…`);
          await espera([3, 6, 10, 15][cortes - 1], op.signal);
          continue;
        }
        if (e.estado === 400 && pensar && nivel !== 'low' && /thinking|thought|level/i.test(e.google || e.message)) { nivel = 'low'; continue; }
        if (e.estado === 400 && pensar && /thinking|thought|level/i.test(e.google || e.message)) { pensar = false; continue; }
        if (e.estado === 400 && web && /search|tool|grounding/i.test(e.google || e.message)) { web = false; continue; }
        if (e.estado === 400 && /system|developer instruction/i.test(e.google || '')) { sacar(modelo, 'no admite instrucciones'); break; }
        if (e.estado === 429 && e.busqueda && web) { LS.set('ia-sin-web', diaGoogle()); web = false; continue; }
        if (e.estado === 429 && web && !e.minuto) { web = false; webSospecha = modelo; continue; } // por si el cupo que falta es el de la búsqueda y Google no lo dice
        if (e.estado === 429 && e.minuto && !esperado && (e.espera || 20) <= 45) { esperado = true; alPaso(`Esperando ${Math.ceil(e.espera || 20)} s a que Google deje volver a preguntar…`); await espera(e.espera || 20, op.signal); continue; }
        if (e.estado === 429) { sacar(modelo, e.message); resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
        if (e.estado === 404 || e.estado === 403 || e.estado === 400) { sacar(modelo, e.message); resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`); break; }
        if (e.vacio && intento < 1) continue;
        if ((e.estado >= 500 || e.estado === 0 || e.estado == null) && intento < 2) { await espera(2.5 * (intento + 1), op.signal); continue; }
        if (e.red) {
          resumen.push(`sin conexión con Google (${e.message})`);
          throw new ErrorIA(`Se ha cortado la conexión con Google ${cortes + 1} veces seguidas (${e.message.replace(/^Sin conexión con Google \((.*)\)$/, '$1')}). Mira que tengas internet (prueba con datos si estás con wifi) y vuelve a probar.`, 0, { red: true });
        }
        resumen.push(`${nombreModelo(modelo)}: ${e.message.toLowerCase()}`);
        break;
      }
    }
  }
  throw new ErrorIA(`Ningún modelo ha podido contestar. ${resumen.slice(0, 4).join(' · ')}${resumen.length > 4 ? ` y ${resumen.length - 4} más` : ''}.${ultimo && ultimo.google ? ` Google: «${ultimo.google.slice(0, 140)}»` : ''}`, ultimo ? ultimo.estado : 0, { todos: true });
}

/* ---------------- todo lo que la IA sabe de tu liga ---------------- */
const m1 = (v) => (v == null ? '?' : eur(v));
/** el dinero de un rival: exacto o estimado con su margen */
const dineroTxt = (d) => (!d || d.v == null ? `dinero: no se sabe${d && d.motivo ? ` (${d.motivo})` : ''}` : d.exacto ? `dinero ${eur(d.v)} (exacto)` : `dinero ≈ ${eur(d.v)} ± ${eur(d.margen)} (estimado con todos sus movimientos)`);
/** quién puede pagar una cláusula tuya */
const paganTxt = (p) => {
  if (!p || (!p.seguro.length && !p.quiza.length && !p.hayDatos)) return p && p.sinSaber.length ? `no se sabe el dinero de ${p.sinSaber.length} rivales` : null;
  if (!p.seguro.length && !p.quiza.length) return `no le llega a ningún rival${p.sinSaber.length ? ` de los que se sabe el dinero (de ${p.sinSaber.map((x) => x.nombre).join(', ')} no)` : ''}`;
  return `le llega a: ${[...p.seguro.map((x) => `${x.nombre} (le sobra)`), ...p.quiza.map((x) => `${x.nombre} (justo)`)].join(', ')}${p.sinSaber.length ? `; de ${p.sinSaber.map((x) => x.nombre).join(', ')} no se sabe` : ''}`;
};
/** el blindaje justo, si compensa */
const blindajeTxt = (b) => {
  if (!b || b.yaVale) return null;
  const t = b.caro ? `dejarla fuera del alcance de todos costaría ${eur(b.coste)} (subirla a ${eur(b.objetivo)}): NO compensa para lo que vale` : `blindaje justo: subirla a ${eur(b.objetivo)} cuesta ${eur(b.coste)} y no le llegaría a nadie de los que se sabe el dinero`;
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
  const xg = v.xg ? ` · xG por partido (Understat): su equipo genera ${d1(v.xg.tu.xg)} y concede ${d1(v.xg.tu.xga)}${v.xg.tu.xg5 != null ? ` (últimos 5: ${d1(v.xg.tu.xg5)}/${d1(v.xg.tu.xga5)})` : ''}; el rival genera ${d1(v.xg.ri.xg)} y concede ${d1(v.xg.ri.xga)}${v.xg.ri.xg5 != null ? ` (últimos 5: ${d1(v.xg.ri.xg5)}/${d1(v.xg.ri.xga5)})` : ''}` : '';
  return `PREVIA: ${v.casa ? 'en casa vs' : 'fuera en'} ${v.rival}${v.posRival ? ` (${v.posRival}º, ${v.nivel || '?'})` : ''} ${cuando(v.p.fecha)} · su equipo llega ${rs(v.rachaTu)}, el rival ${rs(v.rachaRi)}${v.rivalMarca != null ? ` · el rival marca ${d1(v.rivalMarca)} y encaja ${d1(v.rivalEncaja)} por partido` : ''}${xg}${sitio ? ` · ${sitio}` : ''}${porPos ? ` · ${porPos}` : ''}`;
}
/** hacia dónde va su valor ahora: lo de cada día de la última semana y si se frena o ha girado */
function inerciaTxt(M, j) {
  const x = M.inercia ? M.inercia(j.id) : null;
  if (!x || x.fase === 'plano') return null;
  const F = { giro: 'HA GIRADO A LA BAJA', baja: 'BAJANDO', parado: 'ESTANCADO TRAS SUBIR', frena: 'FRENANDO', acelera: 'acelerando', sube: 'subiendo' }[x.fase] || x.fase;
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
    l.push(`Understat: ${u.g} goles con ${d1(u.xg)} xG y ${u.a} asist. con ${d1(u.xa)} xA en ${u.min} min (${p90(u.xg, u.min)} xG y ${p90(u.xa, u.min)} xA por 90; ${p90(u.tiros, u.min)} tiros y ${p90(u.pc, u.min)} pases clave por 90)`);
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
    if (x.length) l.push(`SofaScore: ${x.join(', ')}`);
  }
  return l.length ? l.join(' · ') : null;
}
const lineaJ = (M, j, x = {}) => [
  POS[j.pos] || '?', j.nombre, j.equipo || '?', `valor ${eur(j.valor)}`,
  x.tend && x.tend.d1 != null ? `hoy ${eur(x.tend.d1, { signo: true })}` : null,
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
  if (!M.hayOnces || !j || j.pos === 5) return null;
  const o = M.onceProb(j.id);
  if (!o) return 'once probable: no sale';
  if (o.titular) return `once probable: TITULAR${o.prob != null ? ` ${o.prob} %` : ''}`;
  return 'once probable: suplente';
}
const mejoraTxt = (M, j) => { const g = M.mejora ? M.mejora(j) : 0; return g >= 0.3 ? `entraría en mi once (+${String(Math.round(g * 10) / 10).replace('.', ',')} pts/jornada)` : 'NO entraría en mi once'; };
const rivalTxt = (M, j) => {
  const fr = M.factorRival ? M.factorRival(j) : null;
  if (!fr || !fr.p) return null;
  const luego = (M.calendarioDe ? M.calendarioDe(j.equipoId, 3) : []).slice(1);
  return luego.length ? `después: ${luego.map((x) => `${x.casa ? 'vs' : 'en'} ${x.rival}${x.pos ? ` ${x.pos}º` : ''}${x.nivel ? ` (${x.nivel})` : ''}`).join(', ')}` : null;
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
  return `${lineaJ(M, j, { tend: t })} | ${de}${cl ? ` | cláusula ${eur(cl.clausula)} ${cl.abierta ? 'ABIERTA' : `se abre ${cuando(cl.protegidoHasta)}`}` : ''} | CÓMO CONSEGUIRLO: ${como}${prensaTxt(M, j.id)}${v7 ? ` | hace 7 días valía ${eur(v7)}` : ''}${v30 ? `, hace 30 días ${eur(v30)}` : ''} | ${mejoraTxt(M, j)}`;
}

/** el catálogo de operaciones posibles, uno por análisis */
const catDe = (D, M) => M._cat || (M._cat = catalogo(D, M, notasVigentes()));
/** los titulares de los últimos días que nombran a un jugador */
function prensaTxt(M, pid, n = 2) {
  const l = (M.noticiasDe ? M.noticiasDe(pid) : []).slice(0, n);
  return l.length ? ` | PRENSA: ${l.map((x) => `«${x.titulo}» (${x.fuente || '?'}${x.t ? `, ${cuando(x.t)}` : ''})`).join('; ')}` : ' | prensa: nada en 3 días';
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

export function contexto(D, M, c, { corto = false } = {}) {
  const L = [];
  const ahora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  L.push(`AHORA: ${ahora} (hora de España)`);
  L.push(`LIGA: ${D.liga.nombre}, ${D.clasif.length} equipos. Se puede quedar en negativo hasta el ${c.deuda} % del valor del equipo (${eur(M.deuda)}).`);
  if (M.enJuego) L.push(`JORNADA ${M.enJuego.n} EN JUEGO hasta ${cuando(M.enJuego.fin)}.`);
  if (M.proxima) L.push(`PRÓXIMA JORNADA: ${M.proxima.n}, primer partido ${cuando(M.proxima.ini)} (en ${dura(M.proxima.ini - Date.now())}).`);
  if (M.paron) L.push(`PARÓN DE SELECCIONES: del ${cuando(M.paron.ini, { hora: false })} al ${cuando(M.paron.fin, { hora: false })}${M.enParon ? ' (estamos en él)' : ''}.`);
  if (M.cierreMercado) L.push(`EL MERCADO CAMBIA: ${cuando(M.cierreMercado)} (en ${dura(M.cierreMercado - Date.now())}).`);
  const yo = M.yo || {};
  L.push(`MI EQUIPO: ${yo.nombre || '?'} · ${yo.pos || '?'}º de ${D.clasif.length} · ${yo.puntos || 0} pts · valor ${eur(D.valorEquipo)} · SALDO ${m1(D.dinero)} · PUEDO GASTAR COMO MUCHO ${eur(M.pujaMax)}${M.misPujas ? ` (ya tengo ${eur(M.misPujas)} comprometidos en pujas)` : ''}.`);
  if (M.once) {
    const tit = new Set(M.once.lineas.flat().map((j) => j.id));
    L.push(`\nJUEGA CON LA VERSIÓN GRATUITA. Formaciones que puede usar: ${M.formaciones.map((f) => f.join('-')).join(', ')} (ninguna otra).`);
    L.push(`MI PLANTILLA POR PUESTOS (sanos/total): ${M.puestos.map((p) => `${POS[p.pos]} ${p.sanos}/${p.total}${p.faltan ? ` (FALTAN ${p.faltan})` : ''}${p.sobran ? ` (sobran ${p.sobran})` : ''}`).join(' · ')}.`);
    L.push(`MI MEJOR ONCE AHORA: ${M.once.nombre}${M.once.huecos ? ` CON ${M.once.huecos} HUECOS` : ''}, unos ${String(Math.round(M.once.total * 10) / 10).replace('.', ',')} pts esperados: ${M.once.lineas.map((l) => l.map((j) => j.nombre).join(', ')).filter(Boolean).join(' | ')}${M.once.entrenador ? ` · entrenador ${M.once.entrenador.nombre}` : ''}.`);
    M._tit = tit;
  }
  const nt = notasTxt(D, M);
  if (nt) L.push(nt);
  L.push('\nMIS JUGADORES (posición | nombre | equipo | valor | cambio | media | puntos | últimas jornadas con su rival | lo que rinde | once probable | previa del próximo partido | los dos siguientes) + titular o suplente en mi once, cláusula, protección, riesgo y lo que pagué:');
  for (const x of M.mias) L.push(`- ${lineaJ(M, x.j, x)} | ${M._tit && M._tit.has(x.pid) ? 'TITULAR' : 'suplente'}${M.enVenta && M.enVenta.has(x.pid) ? ' | EN VENTA' : ''} | cláusula ${eur(x.clausula)} ${x.abierta ? 'ABIERTA (me lo pueden quitar ya)' : `protegido hasta ${cuando(x.protegidoHasta)}`} | ${x.ventaInercia ? `VENDER POR INERCIA (${x.ventaInercia.urgencia === 'ya' ? 'ya: ha girado' : 'antes de que gire'}) | ` : ''}riesgo ${x.riesgo}${x.pagan && (x.abierta || x.abreEn < 2 * DIA) && paganTxt(x.pagan) ? ` (${paganTxt(x.pagan)})` : ''}${blindajeTxt(x.blindaje) ? ` | ${blindajeTxt(x.blindaje)}` : ''}${x.compra ? ` | pagué ${eur(x.compra)} (${eur(x.ganado, { signo: true })})` : ''}`);
  if (M.vendidos && M.vendidos.length) {
    L.push('\nYA NO SON MÍOS (vendidos o clausulados estos días; NO cuentes con ellos para nada: ni para vender, ni para el once, ni para el dinero):');
    for (const v of M.vendidos) L.push(`- ${v.j.nombre}: ${v.como} ${cuando(v.t)}${v.importe ? ` por ${eur(v.importe)}` : ''}`);
  }
  if (M.misVentas && M.misVentas.length) {
    L.push('\nMIS JUGADORES EN VENTA Y SUS OFERTAS:');
    for (const v of M.misVentas) L.push(`- ${v.j.nombre} (vale ${eur(v.j.valor)}${v.compra ? `, pagué ${eur(v.compra)}` : ''}) puesto a ${eur(v.precio)}: ${v.ofertas.length ? v.ofertas.map((o) => `${o.de} ofrece ${eur(o.importe)} (${pct(o.sobre * 100)} sobre su valor${o.caduca ? `, caduca ${cuando(o.caduca)}` : ''})`).join('; ') : 'sin ofertas todavía'}${v.ligaEst ? `; la de LaLiga rondará ${eur(v.ligaEst.v)}` : ''}`);
  }
  if (M.ventanaEsp) {
    const v = M.ventanaEsp;
    L.push(`\nESPECULAR: hasta la jornada caben ${v.ciclos} cambios de mercado. Para estar en positivo, lo de revender se pone a la venta el ${cuando(v.ponerVenta, { hora: false })}. Margen: puede bajar hasta −${eur(M.deuda)} entre medias.`);
    if (M.paraRevender && M.paraRevender.length) L.push(`COMPRADOS PARA REVENDER: ${M.paraRevender.map((x) => `${x.j.nombre} (comprado a ${eur(x.rev.precio)}, vale ${eur(x.j.valor)}, ${eur(x.beneficioYa, { signo: true })})`).join('; ')}.`);
    if (M.especular && M.especular.length) {
      L.push('CANDIDATOS PARA REVENDER SEGÚN LA TENDENCIA (precio de compra | subida diaria | valor esperado el día de vender | beneficio):');
      for (const e of M.especular.slice(0, 10)) L.push(`- ${e.j.nombre} (${POS[e.j.pos]}, ${e.j.equipo}) | ${e.origen === 'mercado' ? `mercado, pujar ${eur(e.puja)}` : `cláusula ${eur(e.precio)} a ${e.rival.manager || e.rival.nombre}`} | ${pct(e.r * 100)}/día | ${eur(e.valorFuturo)} | ${eur(e.beneficio, { signo: true })}`);
    }
  }
  L.push(`\nRIVALES (pos | equipo | manager | puntos | valor | cambio de valor 7d | movimientos 7d | gastado 7d | cláusulas que han hecho en 14d | peligro | su dinero | lo que suele pagar en el mercado | mis cláusulas que le llegan)${M.dineroExacto ? '' : `. Su dinero, si no es exacto, sale de todos vuestros movimientos desde el principio de la liga (empezasteis con lo mismo); el margen es la recompensa diaria, que no sale en los movimientos`}:`);
  for (const r of M.rivales) L.push(`- ${r.e.pos}º | ${r.e.nombre} | ${r.e.manager} | ${r.e.puntos} pts | ${eur(r.e.valor)} | ${r.dValor != null ? eur(r.dValor, { signo: true }) : '?'} | ${r.movs} | ${eur(r.gastado)} | ${r.clausulazos}${r.contraMi ? ` (${r.contraMi} a mí)` : ''} | ${r.nivel} | ${dineroTxt(r.dinero)} | ${r.paga ? `paga de mediana ${pct(r.paga.med * 100)} sobre el valor (${r.paga.n} compras, como mucho ${pct(r.paga.max * 100)})` : 'sin compras al mercado'} | ${r.leLlegan.length ? r.leLlegan.map((x) => `${x.j.nombre} ${eur(x.clausula)}${x.abierta ? ' ABIERTA' : ` (se abre ${cuando(x.protegidoHasta)})`}`).join(', ') : 'ninguna'}`);
  if (M.ofertaLiga && !M.ofertaLiga.poco) L.push(`\nLO QUE OFRECE LALIGA por lo que se pone a la venta en esta liga (${M.ofertaLiga.n} ventas): de mediana ${pct(M.ofertaLiga.med * 100)} sobre el valor (la mitad entre ${pct(M.ofertaLiga.p25 * 100)} y ${pct(M.ofertaLiga.p75 * 100)}). Las ofertas de otros managers por los jugadores de un rival no se ven (solo cuántas hay).`);
  const PL = M.pujasLiga;
  if (PL && !PL.poco) {
    L.push(`\nLO QUE SE PAGA EN ESTA LIGA POR LOS LIBRES DEL MERCADO (${PL.n} compras de las últimas 6 semanas, sobre el valor que tenían ese día): mediana ${pct(PL.med * 100)}, la mitad entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)}, el 10 % más alto ${pct(PL.p90 * 100)} o más${PL.caros != null ? `; por los de más de 10 M, ${pct(PL.caros * 100)}` : ''}${PL.baratos != null ? `; por los de menos, ${pct(PL.baratos * 100)}` : ''}. Últimas: ${PL.ult.slice(0, 6).map((x) => `${(D.maestro[x.pid] || {}).nombre || '?'} ${eur(x.imp)} (${pct(x.s * 100)}, ${x.tid ? nombreTid(M, x.tid) : '?'})`).join('; ')}.`);
  }
  // lo que se puede hacer hoy, cada cosa con los datos de su jugador (forma, once, rivales, prensa)
  const cat = catDe(D, M);
  L.push('');
  L.push(catalogoTxt(D, M, cat, { corto, datos: (o) => (['A', 'V', 'B'].includes(o.ref[0]) ? null : `${lineaJ(M, o.j, { tend: M.tend(o.pid) })} | interés ${o.interes != null ? o.interes : '?'}/100 | ${mejoraTxt(M, o.j)}${prensaTxt(M, o.pid)}`) }));
  if (!corto) {
    L.push('\nLOS QUE MÁS SUBEN HOY EN TODA LALIGA:');
    for (const x of M.suben.slice(0, 14)) L.push(`- ${x.j.nombre} (${x.j.equipo}, ${eur(x.j.valor)}) ${x.t.d1 != null ? eur(x.t.d1, { signo: true }) : ''} · ${x.dueno ? (x.dueno === D.yo.teamId ? 'MÍO' : `de ${(M.equipo[x.dueno] || {}).nombre}`) : 'libre'}`);
    L.push('LOS QUE MÁS BAJAN HOY:');
    for (const x of M.bajan.slice(0, 12)) L.push(`- ${x.j.nombre} (${x.j.equipo}, ${eur(x.j.valor)}) ${x.t.d1 != null ? eur(x.t.d1, { signo: true }) : ''} · ${x.dueno ? (x.dueno === D.yo.teamId ? 'MÍO' : `de ${(M.equipo[x.dueno] || {}).nombre}`) : 'libre'}`);
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
    const tit = (n) => `${n.t ? `${cuando(n.t)}: ` : ''}«${n.titulo}»${n.fuente ? ` (${n.fuente})` : ''}`;
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
  }
  const ap = aprendeTxt(M);
  if (ap) L.push(ap);
  const act = M.actividad.filter((a) => a.t && Date.now() - a.t < 7 * DIA && a.clase !== 'premio').slice(0, corto ? 20 : 45);
  if (act.length) {
    L.push('\nMOVIMIENTOS DE LA LIGA (7 días):');
    for (const a of act) L.push(`- ${cuando(a.t)}: ${a.esYo ? 'YO' : a.quien || '?'} ${({ compra: 'fichó', clausula: 'clausuló', venta: 'vendió', blindaje: 'blindó', entra: 'entró' })[a.clase] || 'movió'} ${a.nombreJ || ''}${a.importe ? ` por ${eur(a.importe)}` : ''}${a.otro ? ` ${a.clase === 'clausula' ? 'a' : 'a'} ${a.contraMi ? 'MÍ' : a.otro}` : ''}`);
  }
  return L.join('\n');
}

const SISTEMA = `Eres el director deportivo de un manager de LaLiga Fantasy (el juego oficial de LaLiga) en una liga privada. Tu trabajo es decirle exactamente qué operaciones hacer cada día para ganar la liga y hacer crecer el valor de su equipo. Hablas en español de España, directo, como un colega que sabe mucho del juego.
Reglas del juego en su liga: cada jugador tiene una cláusula; cuando se le acaba la protección, cualquiera puede pagarla y quitárselo al instante. El dueño puede subirla (blindar). En el mercado hay DOS cosas muy distintas que no debes mezclar: (1) jugadores LIBRES de LaLiga, que no son de nadie: el mercado cambia cada día, se puja a ciegas desde su precio y se los lleva la puja más alta; (2) jugadores que OTRO MANAGER de la liga ha puesto a la venta: siguen siendo suyos, el precio lo pone él y solo pasan a ser del manager si el dueño acepta su oferta, así que no se pueden conseguir «más baratos en el mercado». Si el dueño es un amigo que se lo deja a un precio, es un trato entre los dos: valóralo por su valor, lo que sube al día, lo que le da a su once y si le llega el dinero, no comparándolo con el mercado de la liga. Para vender, se pone al jugador en el mercado y llegan ofertas (la de LaLiga, cerca de su valor, y las de otros managers); el dinero entra al aceptar una. Puede quedarse en negativo hasta el % del valor del equipo que te digo, pero si empieza la jornada con saldo negativo no puntúa.
Usa los datos que te paso: cifras en millones («12,4 M»), fechas y horas exactas. No inventes jugadores ni cifras. Te paso el once probable de cada jugador (de futbolfantasy) y titulares de prensa recientes: úsalos. Además, busca en Google lo último de las webs y cuentas especializadas en LaLiga Fantasy (Futbol Fantasy, Jornada Perfecta, Comuniate, Analítica Fantasy…) y lo que publican en X/Twitter los periodistas de cada club sobre lesiones, convocatorias y onces; para el rendimiento de cada jugador, SofaScore, FBref o WhoScored (notas, xG, acciones defensivas). Busca también: lesiones, sanciones, convocatorias con selecciones, alineaciones probables, rotaciones por Champions o Copa, cambios de entrenador, dificultad de los próximos rivales. Ten en cuenta los parones de selecciones. Piensa en puntos (quién va a jugar y puntuar) y en dinero (comprar antes de que suba, vender antes de que baje, cláusulas baratas para revender). Mira qué hacen los rivales y quién puede ir a por sus jugadores.
Hay dos tipos de fichaje y tienes que decir cuál es cada uno: para su ONCE (entra de titular y le da puntos) o para REVENDER (aunque no le haga falta, porque está subiendo y lo vende con beneficio antes de la jornada). Entre semana puede quedarse en negativo hasta el límite de deuda para especular: comprar lunes o martes lo que sube y venderlo el día antes de la jornada (lo pone a la venta y acepta la oferta antes de que empiece). Lo único obligatorio es empezar la jornada con saldo positivo o cero. Si especula, calcula que aunque los valores bajen pueda volver a positivo vendiendo, y dile qué día vender cada cosa.
VERSIÓN GRATIS SIN ENTRENADOR: no se alinea entrenador ni puntúa. No recomiendes nunca fichar, pujar ni clausular entrenadores; si tiene alguno, es dinero parado: véndelo para hacer caja.
CADA JUGADOR TE LLEGA CON: sus últimas jornadas con el rival de cada una y el resultado («J9 11 vs Getafe 19º 2-0»), lo que rinde en casa, fuera, contra los 6 primeros y contra los 6 últimos, y la PREVIA de su próximo partido (cómo llegan los dos equipos en los últimos 5, lo que marca y encaja el rival, cómo le va al rival jugando en ese campo, la portería a cero esperada para porteros y defensas o los goles esperados de su equipo para medios y delanteros, y los puntos esperados). Úsalo: un jugador que solo puntúa contra los de abajo no es fiable contra el Madrid; un defensa con un 15 % de portería a cero puntuará poco aunque sea titular; uno que rinde fuera igual que en casa es más seguro. Compara siempre lo que le toca ahora con lo que ha hecho contra rivales parecidos.
ESTADÍSTICAS AVANZADAS (Understat y SofaScore, cuando las hay): mira más allá de los puntos del Fantasy. xG y xA por 90 dicen las ocasiones que genera de verdad: si marca mucho menos de lo que dice su xG, es probable que lleguen los goles (y al revés, si marca mucho más, puede bajar). Tiros y pases clave por 90 son la base de los puntos de un medio o un delantero; entradas, intercepciones y recuperaciones, los de un defensa o un medio defensivo; las paradas y las porterías a cero, los de un portero. La nota de SofaScore y su tendencia (las últimas) avisan de si está en forma o de si puede perder el sitio. Y el xG que genera y concede cada equipo (sobre todo en los últimos 5) dice mejor que los goles cómo de difícil es un partido. Úsalo para afinar, sobre todo entre candidatos parecidos.
INERCIA DEL VALOR: con cada jugador va lo que ha cambiado su valor cada día de la última semana. Mira hacia dónde va AHORA, no el total de la semana. Si sube cada vez menos (1 M, 800 mil, 500 mil…) está FRENANDO y va a girar: hay que anticiparse y venderlo antes de que empiece a bajar (te digo en cuántos días deja de subir). Si después de subir se ha estancado o ya baja (HA GIRADO A LA BAJA), lo normal es que siga bajando varios días: es VENTA casi obligatoria para no perder lo ganado; solo se queda si es imprescindible en el once para la jornada que viene, y entonces dilo con cifras (lo que perdería de valor hasta la jornada frente a los puntos que da) y dile qué hacer después. Para comprar, y sobre todo para revender, nada que esté frenando o haya girado: tiene que seguir subiendo hasta el día de venderlo.
PUNTOS ESPERADOS POR PARTES: los de cada jugador vienen desglosados como puntúa LaLiga Fantasy (min: minutos; gol: con su xG; asis: con su xA; cero: portería a cero con lo que marca el rival; encaja: goles encajados; paradas; tarj: tarjetas; resto: la nota de DAZN, recuperaciones, tiros…), con la probabilidad de ser titular juntando el once probable, sus últimos partidos y la temporada. Úsalo para entender de dónde salen sus puntos: un defensa que vive de la portería a cero vale poco contra un equipo que marca mucho; un delantero con mucho xG y pocos goles está para marcar. Si su equipo juega Champions, Europa League, Conference o Copa pegada a la jornada, va marcado como ROTACIÓN: mira en la prensa si su entrenador suele rotar antes de ponerlo de titular o de ficharlo para esa jornada.
SI TE CLAUSULAN, COBRAS LA CLÁUSULA: lo que se pierde es lo que ese jugador te puntúa (y lo que fuera a subir), no su valor. Así que proteger solo merece la pena con jugadores importantes en su once y con la cláusula cerca de su valor; un suplente con la cláusula en su valor o un titular con la cláusula un 30 % por encima no necesitan blindaje. Y nunca digas que una cláusula «casi no pasa de su valor» si pasa más de un 10 %: dilo en porcentaje.
DINERO DE LOS RIVALES: te paso el de cada uno, exacto si LaLiga lo da o estimado con vuestros movimientos (con su margen). Úsalo para saber quién puede ir a por cada cláusula: una cláusula abierta que no le llega a nadie es poco riesgo hoy (aunque podrían vender para juntar el dinero), y si a varios les sobra, hay que blindar o asumirlo. Para blindar te paso el «blindaje justo» (subir la cláusula X cuesta X/2): propón esa cifra, no un número al azar, y solo si el jugador lo merece. Y un rival sin dinero no va a pujar fuerte en el mercado ni a clausular.
PUJAS EN ESTA LIGA: te paso lo que se paga de verdad aquí por los libres (mediana, el rango normal, por los caros y por los baratos, y lo que paga cada rival). La puja que propongas tiene que salir de ahí: por uno que buscará todo el mundo, hacia la parte alta; por uno que no mira nadie, cerca de la mínima. Dila con su % sobre el valor.
APRENDE DE LO QUE FALLA: en «CÓMO VAN TUS ACIERTOS» te digo cuánto fallan los puntos esperados y cómo salieron tus recomendaciones de los últimos días. Si algo salió mal, piensa por qué (¿no jugó?, ¿el rival?, ¿se pagó de más?) y no lo repitas; si un tipo de operación sale bien, sigue por ahí.
El rival importa tanto como ser titular: no es lo mismo jugar contra el Barça o el Madrid que contra el colista, ni en casa que fuera. Te paso el próximo rival de cada jugador con su puesto en LaLiga y si es difícil, medio o fácil; los porteros y defensas puntúan más contra equipos que marcan poco, y los medios y delanteros contra los que encajan mucho. Tenlo en cuenta en el once, en a quién fichar y en cuándo vender (vender antes de una racha de rivales difíciles, comprar antes de una de fáciles).
El manager te cuenta cosas que no salen en los datos (tratos con amigos de la liga, ofertas que le hacen por privado, lo que ya ha hecho o piensa hacer, jugadores que no quiere vender): cuentan tanto como los datos. Si otro manager le ofrece venderle un jugador por un precio, se cierra haciéndole una oferta directa por ese importe desde la ficha del jugador; si conviene, ponlo como operación (accion "comprar", donde "a <manager>") y calcula si le compensa con su valor, lo que sube al día, si entra en su once y si le llega el dinero.
CÓMO DECIDIR (hazlo con cada operación antes de recomendarla, y si algo falla, no la recomiendes):
1. ¿Se puede? Solo las operaciones de «OPERACIONES POSIBLES HOY», con su ref. Un jugador de un rival que no está ahí no se puede conseguir hoy.
2. ¿Juega? Once probable, minutos de las últimas jornadas, lesión, sanción, convocatoria y lo que diga la prensa de los últimos dos días del jugador y de su equipo.
3. ¿Puntúa? Su forma (puntos de las últimas jornadas y media), cómo le va a su equipo (últimos resultados) y lo difíciles que son sus próximos 3 rivales.
4. ¿Qué cuesta? Precio frente a valor y si sube o baja (hoy y en 7 días). Lo que se paga de más se pierde.
5. ¿Le hace falta? Si es para el once, que entre en una formación gratuita y mejore el once; si es para revender, que suba lo bastante para ganar antes de la jornada.
6. ¿Le llega el dinero? Con el saldo, el límite de deuda y lo que venda antes. Empezar la jornada en positivo.
7. ¿Riesgos? Rivales con dinero para clausular sus jugadores, sus cláusulas abiertas, rotaciones por Champions o Copa, parón.
Mejor no hacer nada que hacer algo dudoso. Confianza «alta» solo si todo cuadra y hay un dato o una noticia que lo respalda; si no has encontrado noticias, dilo.
COMPRAR A OTRO MANAGER: solo si lo tiene a la venta (te los paso en el bloque «EN EL MERCADO PERO CON DUEÑO») o si es un trato que te ha contado el manager. Un jugador de un rival que no está a la venta NO se puede comprar: su dueño no tiene por qué vendérselo, y menos si lo acaba de fichar (los recién fichados están protegidos unos 14 días). Para quitárselo, solo su cláusula cuando se abra. Y aunque lo tenga a la venta, es el dueño quien decide: dilo y no lo des por hecho.
PAGAR DE MÁS: lo que importa es el DINERO que se paga por encima del valor, no solo el porcentaje, porque eso se pierde en el valor del equipo (si lo vendes, te dan cerca de su valor). Un +25 % por uno que vale 3 M son 750 mil: casi nada si te da puntos. Un +25 % por uno que vale 40 M son 10 M: muchísimo. Con cada operación te paso el ÍNDICE DE SOBRECOSTE (0 a 100, sube poco a poco con los euros que pierdes de verdad, comparados con el valor de su equipo y descontando lo que recupera en una semana con lo que sube, y algo con el porcentaje) y hasta dónde es aguantable para ese jugador (de 60 si no le aporta nada a su once a 95 si lo mejora mucho). No lo uses como un corte: pésalo frente a lo que aporta. Cuanto más alto el índice, más tiene que aportar para que compense; por encima de lo aguantable, no lo recomiendes salvo un trato que te haya contado. Dilo siempre en euros y en días para recuperarlo. Ejemplo de lo que NO hay que hacer: clausular por 21 M a un jugador que vale 9 M.
Las posiciones mandan para el once: juega con la versión gratuita, así que solo puede alinear las formaciones que te digo. Lo primero es poder sacar el mejor once posible: tapa antes los huecos (si le falta un defensa, no le recomiendes otro delantero). Un fichaje para el once solo si entra de titular; si no entraría, solo como fichaje para revender, y entonces dilo. Para vender, empieza por los suplentes que no juegan. La alineación que propongas tiene que ser una de esas formaciones, con un portero y solo con jugadores suyos (o los que le digas que fiche hoy) que puedan jugar.`;

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

export async function planDelDia(D, M, c, { signal, alPaso } = {}) {
  const pedido = `${contexto(D, M, c)}${memoria(M)}

Hazme el PLAN DE HOY. Primero busca noticias de hoy y de ayer de mis jugadores, de los candidatos de «OPERACIONES POSIBLES HOY» y de sus equipos (lesiones, convocatorias, ruedas de prensa, onces probables, rotaciones), y contrástalas con los titulares que te paso. Después sigue «CÓMO DECIDIR» con cada candidato.
Luego dime las operaciones a hacer, EN ORDEN, para que el dinero cuadre: primero qué ofertas acepto (o rechazo) de lo que ya tengo en venta y qué pongo a la venta (para tener saldo), luego lo que compro o clausulo, después blindar y por último la alineación. Para cada compra en el mercado dime la puja máxima que pondría (según las pujas que lleva y si sube). Solo clausular o pujar si me llega. Nunca me dejes en negativo al empezar la jornada: si hace falta vender, dímelo. Si hoy lo mejor es no hacer nada, dilo y por qué.
Contesta SOLO con un bloque \`\`\`json (sin texto fuera) con este formato:
{
 "titular": "8 a 16 palabras con lo más importante de hoy",
 "situacion": "2 o 3 frases: cómo está mi equipo y qué buscamos hoy, con cifras",
 "operaciones": [{"ref": "la ref de OPERACIONES POSIBLES HOY (P-…, M-…, T-…, C-…, A-…, V-…, B-…); null solo para alinear o esperar", "accion": "aceptar_oferta|vender|pujar|comprar|clausular|blindar|alinear|esperar", "objetivo": "titular|revender|caja|proteger", "vender_el": "solo si es para revender: el día en que ponerlo a la venta", "beneficio_esperado": número en euros o null, "jugador": "nombre exacto de los datos", "donde": "a la liga | en el mercado | cláusula a <manager> | ...", "importe": número en euros o null, "puja_max": número o null, "cuando": "ahora | hoy antes de las 18:00 | mañana 14:05 cuando se abra", "motivo": "por qué, con cifras y la noticia que lo justifica (1 o 2 frases)", "claves": ["3 a 5 datos cortos que lo respaldan: «Titular 90 %», «8-6-10 pts», «vs Getafe (19º)», «+1,2 %/día», «+3 % sobre su valor», «sin noticias»"], "confianza": "alta|media|baja"}],
 "descartes": [{"jugador": "nombre", "ref": "su ref o null", "motivo": "por qué NO (lesión, no juega, caro, rival difícil, no entra en el once, no se puede…)"}],
 "proximos_dias": [{"dia": "mañana miércoles 21 | jueves 22 | antes de la jornada", "texto": "qué hacer ese día y a qué hora"}],
 "vigilar": [{"jugador": "nombre", "texto": "por qué hay que seguirlo"}],
 "noticias": [{"jugador": "nombre", "texto": "qué ha pasado y cómo afecta", "efecto": "sube|baja|neutro"}],
 "rivales": [{"manager": "nombre", "texto": "qué está haciendo y si va a por mis jugadores"}],
 "paron": "qué hacer con el parón si está cerca, o null",
 "alineacion": {"formacion": "una de las formaciones gratuitas", "titulares": ["portero, defensas, medios y delanteros: nombres exactos"], "dudas": ["jugador: por qué"]}
}
Entre 1 y 8 operaciones (o ninguna si hoy no conviene nada). En descartes, de 3 a 6 candidatos que has mirado y no convienen. Entre 2 y 5 días en proximos_dias.
"pujar" es SOLO para jugadores libres de la liga (subasta del mercado). Para un jugador que es de otro manager la acción es "comprar", con el precio en "importe" y sin puja_max, y SOLO si lo tiene a la venta o es un trato que te he contado; si no, no lo pongas. Para quitárselo pagando su cláusula, "clausular" (solo si la cláusula está abierta o se abre pronto).`;
  const r = await preguntar({ sistema: SISTEMA, contents: [{ role: 'user', parts: [{ text: pedido }] }] }, { signal, alPaso, nivel: 'high' });
  const json = sacarJSON(r.texto);
  if (!json || !Array.isArray(json.operaciones)) throw new ErrorIA('Gemini ha contestado sin el formato del plan. Vuelve a probar.', 0);
  const P = { ...json, fuentes: r.fuentes.slice(0, 14), modelo: r.modelo, web: r.web, t: Date.now(), dia: diaDe(), mercado: M.cierreMercado || null };
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
  return Date.now() - p.t > 10 * 3600e3;
}

/** las operaciones del plan con sus jugadores y el saldo después de cada una, con los números de la app */
export function cuadrarPlan(P, D, M) {
  if (!P) return null;
  const buscar = (n) => {
    const k = norm(n);
    if (!k) return null;
    const todos = Object.values(D.maestro);
    return todos.find((j) => norm(j.nombre) === k) || todos.find((j) => norm(j.largo) === k)
      || todos.find((j) => norm(j.nombre).includes(k) || k.includes(norm(j.nombre))) || null;
  };
  let saldo = D.dinero == null ? null : +D.dinero;
  // cada paso se comprueba contra lo que de verdad se puede hacer hoy
  const cat = M._cat || (M._cat = catalogo(D, M, notasVigentes()));
  const OPERA = ['vender', 'clausular', 'pujar', 'comprar', 'ofertar', 'blindar'];
  const ops = (P.operaciones || []).map((o0, i) => {
    let o = { ...o0 };
    const j = (o.pid && D.maestro[o.pid]) || buscar(o.jugador);
    const pid = j && j.id;
    const cl = pid && M.clausulas.find((x) => x.pid === pid);
    const original = String(o.accion || '').toLowerCase();
    let accion = original.replace('aceptar_oferta', 'vender').replace('aceptar', 'vender').replace('ofertar', 'comprar');
    let aceptar = /aceptar/.test(original) || /acepta/i.test(o.donde || '');
    let importe = o.importe != null ? +o.importe : null, signo = 0, aviso = null, descartada = false, sobre = null;
    const opC = OPERA.includes(accion) ? buscarOp(cat, o, pid) : null;
    if (accion === 'blindar' && !opC) aviso = 'Su cláusula no se abre pronto: aún no hace falta';
    else if (OPERA.includes(accion) && !opC) {
      descartada = true;
      const pq = porQueNo(D, M, o, pid, j);
      aviso = `La app lo descarta: ${pq.charAt(0).toLowerCase()}${pq.slice(1)}.`;
      signo = accion === 'vender' ? 1 : -1;
    } else if (opC) {
      // la acción, el importe y el «dónde» de verdad, según la operación posible
      o.ref = opC.ref;
      switch (opC.ref[0]) {
        case 'A': accion = 'vender'; aceptar = true; signo = 1; importe = opC.precio; o.donde = `oferta de ${opC.de}`; break;
        case 'V': accion = 'vender'; signo = 1; importe = importe || opC.precio; break;
        case 'P': {
          accion = 'pujar'; signo = -1;
          const puja = o.puja_max != null ? +o.puja_max : importe || opC.puja;
          importe = Math.max(puja || 0, opC.precio); o.puja_max = importe; o.donde = 'libre en el mercado de la liga';
          if (puja && puja < opC.precio) aviso = `La puja mínima es ${eur(opC.precio)}`;
          break;
        }
        case 'M': case 'T':
          accion = 'comprar'; signo = -1; importe = importe || opC.precio; o.puja_max = null;
          o.donde = `a ${opC.vendedor}${opC.trato ? ' (vuestro trato)' : ' (lo tiene a la venta)'}`;
          if (!opC.trato) aviso = importe < opC.precio ? `Pide ${eur(opC.precio)}: por menos puede que no lo acepte.` : 'Decide él: solo es tuyo si acepta tu oferta.';
          break;
        case 'C': accion = 'clausular'; signo = -1; importe = opC.precio; o.donde = `cláusula a ${opC.de}`; if (!opC.abierta) aviso = `Se abre ${cuando(opC.abre)}`; break;
        case 'B': accion = 'blindar'; signo = importe ? -1 : 0; break;
        default: break;
      }
    }
    // pagar mucho más de lo que vale: se avisa y, si es una barbaridad sin un trato que le hayas contado, se descarta
    // lo que cuenta es el dinero que se pierde (un +25 % por uno de 3 M no es lo mismo que por uno de 40 M),
    // comparado con tu equipo y con lo que sube al día
    if (!descartada && signo < 0 && importe && j && j.valor && ['clausular', 'comprar', 'pujar'].includes(accion)) {
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
    // fichar a un lesionado o sancionado para el once: aviso
    if (!descartada && signo < 0 && j && ['injured', 'suspended'].includes(j.estado) && !String(o.objetivo || '').startsWith('revend')) aviso = `${aviso ? `${aviso} ` : ''}Ojo: está ${j.estado === 'injured' ? 'lesionado' : 'sancionado'}.`;
    // lo que se hace hoy suma al saldo; lo de otro día (o cuando se abra una cláusula), no
    const cu = String(o.cuando || '').trim();
    const otroDia = /cuando se abra|se abre|si vendes/i.test(cu) || (/^(el )?(mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i.test(cu) && accion !== 'pujar');
    const hoy = (!otroDia || !!(cl && cl.abierta && accion === 'clausular')) && !descartada;
    if (saldo != null && signo && importe && hoy) saldo += signo * importe;
    return { ...o, accion, etiqueta: aceptar ? 'Aceptar oferta' : null, n: i + 1, j, pid, importe, signo, saldo: signo && importe && hoy ? saldo : null, aviso, hoy, descartada, sobre };
  });
  const final = saldo;
  // en negativo puede ser a propósito: lo comprado para revender se vende antes de la jornada
  const rev = ops.filter((o) => String(o.objetivo || '').startsWith('revend') && o.signo < 0 && o.importe && o.hoy);
  const recupera = rev.reduce((s, o) => s + (o.beneficio_esperado ? +o.importe + +o.beneficio_esperado : +o.importe), 0);
  let avisoSaldo = null, avisoTipo = null;
  if (final != null && final < -M.deuda) { avisoSaldo = `Te pasarías del límite de deuda (${eur(-M.deuda)})`; avisoTipo = 'mal'; }
  else if (final != null && final < 0 && rev.length && final + recupera >= 0) {
    avisoSaldo = `En negativo a propósito hasta que vendas lo de revender (${rev.map((o) => (o.j && o.j.nombre) || o.jugador).join(', ')}). Con eso vuelves a unos ${eur(final + recupera)} antes de la jornada`;
    avisoTipo = 'plan';
  } else if (final != null && final < 0) { avisoSaldo = `Acabarías en negativo (${eur(final)}): vende antes de que empiece la jornada`; avisoTipo = 'mal'; }
  return { ...P, ops, final, avisoSaldo, avisoTipo, recupera };
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
  const titulo = primera ? (primera.t.length > 70 ? `${primera.t.slice(0, 67)}…` : primera.t) : 'Chat';
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

export async function charlar(pregunta, D, M, c, alTexto, signal) {
  const hist = conversacion();
  hist.push({ r: 'yo', t: pregunta, ts: Date.now() });
  LS.set(K('chat'), hist.slice(-40));
  const contents = hist.slice(-14).map((m) => ({ role: m.r === 'yo' ? 'user' : 'model', parts: [{ text: m.t }] }));
  const p = ultimoPlan();
  // los jugadores que nombra, con todos sus datos aunque no salgan en el resto del contexto
  const nombrados = jugadoresEn(pregunta, D);
  const extra = nombrados.length ? `\n\nJUGADORES QUE NOMBRA EN SU MENSAJE:\n${nombrados.map((j) => `- ${lineaCompleta(D, M, j)}`).join('\n')}` : '';
  const sistema = `${SISTEMA}\nContesta a lo que te pregunta, al grano y con cifras; usa listas cortas solo si ayudan. Si recomiendas algo, di cuánto cuesta, cuánto pujar y cuándo hacerlo.\nLOS DATOS DE AHORA MANDAN: lo hablado antes en este chat o en planes de otros días puede estar superado. Sus jugadores son SOLO los de «MIS JUGADORES»; si uno del que hablasteis ya no está ahí (o sale en «YA NO SON MÍOS»), ya no es suyo: no lo cuentes para vender, para el once ni para el dinero. Lo mismo con el saldo: vale el de ahora.\n${NOTAS_CHAT}\n\nDATOS DE SU LIGA AHORA MISMO:\n${contexto(D, M, c, { corto: true })}${extra}${p ? `\n\nEL PLAN DE HOY QUE LE DISTE (${cuando(p.t)}): ${p.titular} → ${(p.operaciones || []).map((o) => `${o.accion} ${o.jugador}`).join('; ')}` : ''}`;
  const sinBloque = (t) => String(t || '').replace(/```notas[\s\S]*$/, '').trim();
  const r = await preguntar({ sistema, contents }, { stream: true, alTexto: alTexto ? (t) => alTexto(sinBloque(t)) : null, signal });
  const n = aplicarNotas(r.texto, D);
  const vend = (M.vendidos || []).filter((v) => cuentaConVendido(n.texto, v.j && v.j.nombre));
  if (vend.length) n.texto += `\n\n> Ojo: ${vend.map((v) => `**${v.j.nombre}** ya no es tuyo (${v.como} ${cuando(v.t)})`).join('; ')}. No cuenta para lo de arriba.`;
  const h2 = conversacion();
  h2.push({ r: 'ia', t: n.texto, ts: Date.now(), fuentes: r.fuentes.slice(0, 8), modelo: r.modelo, apuntadas: n.apuntadas.map((x) => x.texto), olvidadas: n.olvidadas });
  LS.set(K('chat'), h2.slice(-40));
  return { ...r, texto: n.texto, apuntadas: n.apuntadas, olvidadas: n.olvidadas };
}
