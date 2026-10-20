/* La IA: Gemini (Google AI Studio) con tu clave gratuita, llamada directamente desde el móvil a Google.
   Busca en internet con Google (noticias, lesiones, convocatorias, alineaciones probables) y cruza eso con
   los números de tu liga. Dos usos: el análisis del día (sale en la pestaña Análisis) y el chat. */
import { leer, guardar } from './puente.js';
import { LS, eur, pct, cuando, dura, POS, DIA } from './util.js';
import { K } from './datos.js';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
// los gratuitos, del más listo al más rápido; si uno gasta su cupo del día, se salta al siguiente
const CADENA = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
export const NOMBRES = { 'gemini-3.8-flash': 'Gemini 3.8 Flash', 'gemini-3.6-flash': 'Gemini 3.6 Flash', 'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite' };
const diaGoogle = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

export const clave = () => leer('gemini') || '';
export const guardarClave = (k) => guardar('gemini', (k || '').trim() || null);
export const hayClave = () => !!clave();
export const cfgIA = () => ({ modelo: CADENA[0], web: true, ...LS.get('cfg-ia', {}) });
export const guardarCfgIA = (c) => LS.set('cfg-ia', { ...cfgIA(), ...c });

const agotados = () => { const a = LS.get('ia-agotados', {}), d = diaGoogle(); return Object.keys(a).filter((m) => a[m] === d); };
const agotar = (m) => { const a = LS.get('ia-agotados', {}); a[m] = diaGoogle(); LS.set('ia-agotados', a); };

function cadena() {
  const cfg = cfgIA();
  const extra = LS.get('ia-modelos', []) || [];
  const todos = [...new Set([cfg.modelo, ...CADENA, ...extra])];
  const fuera = agotados();
  return todos.filter((m) => !fuera.includes(m));
}

class ErrorIA extends Error {
  constructor(m, estado, diario) { super(m); this.estado = estado; this.diario = diario; }
}

function errorDe(estado, j) {
  const e0 = (j && j.error) || {}, m = e0.message || '', det = JSON.stringify(e0.details || '');
  if (/API key not valid|API_KEY_INVALID/i.test(m + det)) return new ErrorIA('Google dice que la clave no es válida. Cópiala otra vez entera desde aistudio.google.com/apikey.', estado);
  if (estado === 401 || estado === 403) return new ErrorIA('Google no acepta esta clave. Crea otra gratis en aistudio.google.com/apikey.', estado);
  if (estado === 404) return new ErrorIA('Ese modelo de Gemini ya no existe', 404);
  if (estado === 429) return new ErrorIA('Has llegado al límite gratuito de Google por ahora', 429, /per.?day|PerDay|daily/i.test(m + det) || !/minute/i.test(m + det));
  if (estado >= 500) return new ErrorIA('Google está saturado ahora mismo. Prueba en un momento.', estado);
  return new ErrorIA(m || `Error ${estado} de Google`, estado);
}

async function llamar(modelo, cuerpo, { stream = false, alTexto = null, signal } = {}) {
  const url = `${GEMINI}/models/${modelo}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  const r = await fetch(url, { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': clave() }, body: JSON.stringify(cuerpo) });
  if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { /* nada */ } throw errorDe(r.status, j); }
  let texto = '', fuentes = [], fin = null;
  const procesar = (j) => {
    const c = (j.candidates || [])[0] || {};
    for (const p of (c.content && c.content.parts) || []) if (p.text && !p.thought) { texto += p.text; if (alTexto) alTexto(texto); }
    const g = c.groundingMetadata;
    if (g && g.groundingChunks) fuentes.push(...g.groundingChunks.map((x) => x.web).filter((w) => w && w.uri).map((w) => ({ t: w.title || w.uri, u: w.uri })));
    if (c.finishReason) fin = c.finishReason;
  };
  if (!stream) procesar(await r.json());
  else {
    const lector = r.body.getReader(), dec = new TextDecoder();
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
  const vistas = new Set();
  fuentes = fuentes.filter((f) => !vistas.has(f.u) && vistas.add(f.u));
  return { texto, fuentes, fin };
}

/** prueba la clave sin gastar cupo (lista los modelos) y apunta los Flash que haya por si cambian de nombre */
export async function probarClave(k) {
  const r = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': (k || '').trim() } });
  if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { /* nada */ } throw errorDe(r.status, j); }
  const j = await r.json();
  const flash = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, '')).filter((n) => /^gemini-[\d.]+-flash(-lite)?$/.test(n))
    .sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]) || (a.includes('lite') ? 1 : -1));
  LS.set('ia-modelos', flash.slice(0, 6));
  return flash;
}

/** una llamada con todo: salta de modelo si uno se agota, quita el «pensar» o la búsqueda si el modelo no los admite */
async function preguntar(cuerpoBase, op = {}) {
  const cfg = cfgIA();
  let web = cfg.web && !LS.get('ia-sin-web', false);
  let pensar = true, ultimo = null;
  const modelos = cadena();
  if (!modelos.length) throw new ErrorIA('Los modelos gratuitos de Gemini han gastado su cupo de hoy. Mañana a las 9:00 vuelven.', 429, true);
  for (const modelo of modelos) {
    for (let intento = 0; intento < 3; intento++) {
      const cuerpo = { ...cuerpoBase, ...(web ? { tools: [{ google_search: {} }] } : {}), generationConfig: { maxOutputTokens: 12000, temperature: 0.7, ...(pensar ? { thinkingConfig: { thinkingLevel: 'high' } } : {}) } };
      try {
        const r = await llamar(modelo, cuerpo, op);
        return { ...r, modelo, web };
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        ultimo = e;
        if (e.estado === 400 && pensar && /thinking/i.test(e.message)) { pensar = false; continue; }
        if (e.estado === 400 && web && /search|tool|grounding/i.test(e.message)) { web = false; LS.set('ia-sin-web', true); continue; }
        if (e.estado === 404) break;
        if (e.estado === 429) { if (e.diario) agotar(modelo); else if (intento === 0) { await new Promise((r) => setTimeout(r, 4000)); continue; } break; }
        if (e.estado >= 500 && intento < 2) { await new Promise((r) => setTimeout(r, 2500 * (intento + 1))); continue; }
        throw e;
      }
    }
  }
  throw ultimo || new ErrorIA('No se ha podido hablar con Gemini');
}

/* ---------------- lo que la IA sabe de tu liga ---------------- */
const lineaJ = (j, x = {}) => [
  POS[j.pos] || '?', j.nombre, j.equipo || '?', `valor ${eur(j.valor)}`,
  x.tend && x.tend.p7 != null ? `7d ${pct(x.tend.p7)}` : x.tend && x.tend.p1 != null ? `hoy ${pct(x.tend.p1)}` : null,
  j.media ? `media ${String(j.media).replace('.', ',')}` : null, `${j.puntos} pts`,
  j.estado && j.estado !== 'ok' ? `ESTADO ${j.estado}` : null,
].filter(Boolean).join(' | ');

const partido = (p) => (p ? `${p.casa ? 'vs' : 'en'} ${p.rival} ${cuando(p.fecha)}` : null);

export function contexto(D, M, c, { corto = false } = {}) {
  const L = [];
  const ahora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  L.push(`AHORA: ${ahora} (hora de España)`);
  L.push(`LIGA: ${D.liga.nombre}, ${D.clasif.length} equipos. Se puede quedar en negativo hasta el ${c.deuda} % del valor del equipo.`);
  if (M.enJuego) L.push(`JORNADA ${M.enJuego.n} EN JUEGO hasta ${cuando(M.enJuego.fin)}.`);
  if (M.proxima) L.push(`PRÓXIMA JORNADA: ${M.proxima.n}, empieza ${cuando(M.proxima.ini)} (en ${dura(M.proxima.ini - Date.now())}).`);
  if (M.paron) L.push(`PARÓN DE SELECCIONES: ${cuando(M.paron.ini, { hora: false })} a ${cuando(M.paron.fin, { hora: false })}${M.enParon ? ' (estamos en él)' : ''}.`);
  const yo = M.yo || {};
  L.push(`MI EQUIPO: ${yo.nombre || '?'} · ${yo.pos || '?'}º · ${yo.puntos || 0} pts · valor ${eur(D.valorEquipo)} · saldo ${eur(D.dinero)} · puedo gastar hasta ${eur(M.pujaMax)}${M.misPujas ? ` (ya tengo ${eur(M.misPujas)} en pujas)` : ''}.`);
  L.push('\nMIS JUGADORES (pos | nombre | equipo | valor | tendencia | media | puntos | estado) + cláusula, protección, próximo partido y lo que pagué:');
  for (const x of M.mias) L.push(`- ${lineaJ(x.j, x)} | cláusula ${eur(x.clausula)} ${x.abierta ? 'ABIERTA' : `protegida ${dura(x.abreEn)} más`} | riesgo ${x.riesgo}${x.prox ? ` | ${partido(x.prox)}` : ''}${x.compra ? ` | pagué ${eur(x.compra)}` : ''}`);
  L.push('\nRIVALES (pos | equipo | manager | puntos | valor | cambio de valor 7d | movimientos 7d | gastado 7d | cláusulas que han hecho en 14d):');
  for (const r of M.rivales) L.push(`- ${r.e.pos}º | ${r.e.nombre} | ${r.e.manager} | ${r.e.puntos} pts | ${eur(r.e.valor)} | ${r.dValor != null ? eur(r.dValor, { signo: true }) : '?'} | ${r.movs} | ${eur(r.gastado)} | ${r.clausulazos}${r.contraMi ? ` (${r.contraMi} a mí)` : ''}`);
  const cl = M.clausulas.filter((x) => x.abierta || x.abreEn < 3 * DIA).slice(0, corto ? 15 : 28);
  L.push('\nCLÁUSULAS DE RIVALES (abiertas o que se abren en 3 días, de más a menos interesante):');
  for (const x of cl) L.push(`- ${lineaJ(x.j, x)} | de ${x.rival.nombre} | cláusula ${eur(x.clausula)} ${x.abierta ? 'ABIERTA' : `se abre ${cuando(x.protegidoHasta)}`} | ${x.meLlega ? 'me llega' : 'NO me llega'}${x.prox ? ` | ${partido(x.prox)}` : ''}`);
  if (M.mercado.length) {
    L.push(`\nMERCADO DE HOY${M.cierreMercado ? ` (cambia ${cuando(M.cierreMercado)})` : ''}:`);
    for (const m of M.mercado.slice(0, 24)) L.push(`- ${lineaJ(m.j, m)} | precio ${eur(m.precio)}${m.tipo === 'manager' ? ` (lo vende ${m.vendedor || 'un rival'})` : ''} | ${m.pujas} pujas${m.miPuja ? ` | MI PUJA ${eur(m.miPuja)}` : ''}${m.prox ? ` | ${partido(m.prox)}` : ''}`);
  }
  if (!corto) {
    L.push('\nLOS QUE MÁS SUBEN HOY EN LALIGA:');
    for (const x of M.suben.slice(0, 12)) L.push(`- ${x.j.nombre} (${x.j.equipo}) ${x.t.d1 != null ? eur(x.t.d1, { signo: true }) : ''} · ${x.dueno ? (x.dueno === D.yo.teamId ? 'mío' : `de ${(M.equipo[x.dueno] || {}).nombre}`) : 'libre'}`);
    L.push('LOS QUE MÁS BAJAN HOY:');
    for (const x of M.bajan.slice(0, 10)) L.push(`- ${x.j.nombre} (${x.j.equipo}) ${x.t.d1 != null ? eur(x.t.d1, { signo: true }) : ''} · ${x.dueno ? (x.dueno === D.yo.teamId ? 'mío' : `de ${(M.equipo[x.dueno] || {}).nombre}`) : 'libre'}`);
  }
  const act = M.actividad.filter((a) => a.t && Date.now() - a.t < 7 * DIA).slice(0, corto ? 20 : 40);
  if (act.length) {
    L.push('\nMOVIMIENTOS DE LA LIGA (7 días):');
    for (const a of act) L.push(`- ${cuando(a.t)}: ${a.quien} ${({ compra: 'fichó', clausula: 'clausuló', venta: 'vendió', blindaje: 'blindó', premio: 'cobró por jornada', entra: 'entró' })[a.clase] || 'movió'} ${a.nombreJ || ''}${a.importe ? ` por ${eur(a.importe)}` : ''}${a.otro ? ` a ${a.otro}` : ''}`);
  }
  return L.join('\n');
}

const SISTEMA = `Eres el asesor de LaLiga Fantasy (el juego oficial de LaLiga) de un manager de una liga privada. Hablas en español de España, cercano y directo, como un colega que sabe mucho del juego, sin rodeos ni frases hechas.
Cómo funciona su liga: cada jugador de un equipo tiene una cláusula; cuando se le acaba la protección, cualquiera puede pagarla y quitárselo al momento. El dueño puede subirla (blindar). El mercado cambia cada día. Puede quedarse en negativo hasta un % del valor de su equipo, pero si empieza la jornada en negativo no puntúa.
Usa siempre los datos que te paso: cifras exactas en euros (en millones, «12,4 M»), fechas y horas. No inventes jugadores ni cifras que no estén. Busca en internet con Google lo reciente que importe: lesiones, sanciones, convocatorias con su selección, alineaciones probables, rotaciones por Champions o Copa, cambios de entrenador y el calendario de los próximos partidos. Ten en cuenta los parones de selecciones (los valores se mueven distinto y hay riesgo de lesiones). Piensa en sacar beneficio: comprar antes de que suba, vender antes de que baje, cláusulas que son un chollo para revender. Mira qué hacen los rivales y quién puede ir a por sus jugadores.`;

/** el análisis del día: devuelve { titular, resumen, acciones[], noticias[], rivales[], paron, alineacion, fuentes[], modelo, t } */
export async function analisisDelDia(D, M, c, signal) {
  const pedido = `${contexto(D, M, c)}

Hazme el análisis de hoy. Antes, busca noticias de mis jugadores, de los que más me interesan de cláusulas y mercado y de la próxima jornada.
Contesta SOLO con un bloque \`\`\`json con este formato (sin texto fuera):
{
 "titular": "una frase de 8 a 16 palabras con lo más importante de hoy",
 "resumen": "3 o 4 frases con la situación y lo que haría yo, con cifras",
 "acciones": [{"tipo": "clausular|pujar|vender|blindar|alinear|esperar|vigilar", "jugador": "nombre exacto como en los datos", "precio": número en euros o null, "cuando": "ya | hoy antes de las 18:00 | antes del parón...", "motivo": "por qué, con cifras y la noticia si la hay (1 o 2 frases)", "confianza": "alta|media|baja"}],
 "noticias": [{"jugador": "nombre", "texto": "qué ha pasado y cómo afecta (1 frase)", "efecto": "sube|baja|neutro"}],
 "rivales": [{"manager": "nombre", "texto": "qué está haciendo y si es un peligro para mí (1 frase)"}],
 "paron": "qué hacer con el parón de selecciones si está cerca, o null",
 "alineacion": {"formacion": "4-3-3", "titulares": ["nombres de mis jugadores"], "dudas": ["jugador: por qué"]}
}
Entre 4 y 8 acciones, de más a menos importante. Las de clausular o pujar, solo si me llega el dinero.`;
  const r = await preguntar({ systemInstruction: { parts: [{ text: SISTEMA }] }, contents: [{ role: 'user', parts: [{ text: pedido }] }] }, { signal });
  const json = sacarJSON(r.texto);
  if (!json) throw new ErrorIA('Gemini ha contestado sin el formato esperado. Vuelve a probar.');
  const A = { ...json, fuentes: r.fuentes.slice(0, 12), modelo: r.modelo, web: r.web, t: Date.now() };
  LS.set(K('ia'), A);
  return A;
}
export const ultimoAnalisis = () => LS.get(K('ia'), null);

function sacarJSON(t) {
  const m = String(t || '').match(/```(?:json)?\s*([\s\S]*?)```/);
  const trozo = m ? m[1] : String(t || '').slice(String(t || '').indexOf('{'), String(t || '').lastIndexOf('}') + 1);
  try { return JSON.parse(trozo); } catch (e) {
    try { return JSON.parse(trozo.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { return null; }
  }
}

/* ---------------- el chat ---------------- */
export const conversacion = () => LS.get(K('chat'), []);
export const borrarConversacion = () => LS.set(K('chat'), []);

/** pregunta en el chat; alTexto(texto) se llama según va llegando la respuesta */
export async function charlar(pregunta, D, M, c, alTexto, signal) {
  const hist = conversacion();
  hist.push({ r: 'yo', t: pregunta, ts: Date.now() });
  LS.set(K('chat'), hist.slice(-40));
  const contents = hist.slice(-14).map((m) => ({ role: m.r === 'yo' ? 'user' : 'model', parts: [{ text: m.t }] }));
  const sistema = `${SISTEMA}\nContesta a lo que te pregunta, al grano y con cifras; usa listas cortas solo si ayudan. Si recomiendas algo, di cuánto cuesta y cuándo hacerlo.\n\nDATOS DE SU LIGA AHORA MISMO:\n${contexto(D, M, c, { corto: true })}`;
  const r = await preguntar({ systemInstruction: { parts: [{ text: sistema }] }, contents }, { stream: true, alTexto, signal });
  const h2 = conversacion();
  h2.push({ r: 'ia', t: r.texto, ts: Date.now(), fuentes: r.fuentes.slice(0, 8), modelo: r.modelo });
  LS.set(K('chat'), h2.slice(-40));
  return r;
}

