/* El puente con la app de Android (window.FantasyApp). Fuera de la app (en un navegador) no hay puente: las
   peticiones a LaLiga y a las webs de datos van por el Worker de Fantasy Manager (worker/), porque el navegador no
   deja llamarlas desde otra página. Sin Worker (abriendo la web en local, por ejemplo) solo hay liga de ejemplo. */

const N = typeof window !== 'undefined' && window.FantasyApp ? window.FantasyApp : null;
export const enApp = !!N;
/** el Worker publicado (lo usa la web para todo y la app para dejar la sesión con un código) */
export const WORKER_PUBLICO = 'https://fantasy-manager.fantasymanager-web-app.workers.dev';
/** el Worker de la web: el publicado en GitHub Pages; para probar en local, el que diga localStorage «fm-worker» */
export const WORKER = (() => {
  if (N) return WORKER_PUBLICO;
  try { const w = localStorage.getItem('fm-worker'); if (w) return w.replace(/\/+$/, ''); } catch (e) { /* nada */ }
  return typeof location !== 'undefined' && /(\.github\.io|(^|\.)fantasymanagerapp\.com|\.pages\.dev)$/.test(location.hostname) ? WORKER_PUBLICO : '';
})();
/** la versión web de verdad (con tu liga), no la de ejemplo */
export const enWeb = !N && !!WORKER;

let seq = 0;
const pendientes = new Map();

// la app avisa con __http(id) cuando acaba una petición; la respuesta se recoge con respuesta(id)
window.__http = (id) => {
  const fin = pendientes.get(id);
  if (!fin) { try { N && N.respuesta(id); } catch (e) { /* nada */ } return; }
  pendientes.delete(id);
  let r;
  try { r = JSON.parse(N.respuesta(id)); } catch (e) { r = { s: 0, e: 'respuesta ilegible' }; }
  fin(r);
};

/**
 * Una petición por la app (sin CORS). Devuelve { s: estado, b: cuerpo, t: tipo, e: error }.
 * s = 0 si no llegó a contestar (sin red, dirección no permitida, tiempo agotado).
 */
export function http(metodo, url, { cabeceras = {}, cuerpo = null, tiempo = 45000 } = {}) {
  if (!N) return enWeb ? porWorker(metodo, url, cabeceras, cuerpo, tiempo) : Promise.resolve({ s: 0, e: 'Fuera de la app no se puede hablar con LaLiga' });
  const id = `p${Date.now().toString(36)}${(seq++).toString(36)}`;
  return new Promise((resolver) => {
    const reloj = setTimeout(() => { if (pendientes.delete(id)) resolver({ s: 0, e: 'tiempo agotado' }); }, tiempo);
    pendientes.set(id, (r) => { clearTimeout(reloj); resolver(r); });
    try {
      N.http(id, metodo, url, JSON.stringify(cabeceras || {}), cuerpo == null ? '' : String(cuerpo));
    } catch (e) {
      pendientes.delete(id); clearTimeout(reloj);
      resolver({ s: 0, e: String(e.message || e) });
    }
  });
}

/** en la web: la petición la hace el Worker y devuelve lo mismo que la app ({ s, b, t, e }) */
async function porWorker(metodo, url, cabeceras, cuerpo, tiempo) {
  const parar = new AbortController();
  const reloj = setTimeout(() => parar.abort(), tiempo);
  try {
    const r = await fetch(`${WORKER}/p`, {
      method: 'POST', signal: parar.signal,
      headers: { 'content-type': 'text/plain;charset=utf-8', 'x-u': url, 'x-m': metodo || 'GET', 'x-h': JSON.stringify(cabeceras || {}) },
      body: cuerpo == null ? '' : String(cuerpo),
    });
    const b = await r.text();
    const s = +(r.headers.get('x-s') || 0);
    if (!r.ok) return { s: 0, e: `el servidor de la web responde ${r.status}` };
    if (!s) return { s: 0, e: b || 'sin respuesta' };
    return { s, b, t: r.headers.get('x-t') || '' };
  } catch (e) {
    return { s: 0, e: e.name === 'AbortError' ? 'tiempo agotado' : `sin conexión con el servidor de la web (${e.message || e})` };
  } finally { clearTimeout(reloj); }
}

/** una imagen como data:… (para mirar sus píxeles). En la app, por el puente; fuera, con fetch (si el sitio deja) */
export async function imagenDatos(url) {
  if (N && typeof N.imagen === 'function') {
    const id = `i${Date.now().toString(36)}${(seq++).toString(36)}`;
    const r = await new Promise((resolver) => {
      const reloj = setTimeout(() => { if (pendientes.delete(id)) resolver({ s: 0, e: 'tiempo agotado' }); }, 20000);
      pendientes.set(id, (x) => { clearTimeout(reloj); resolver(x); });
      try { N.imagen(id, url); } catch (e) { pendientes.delete(id); clearTimeout(reloj); resolver({ s: 0, e: String(e) }); }
    });
    if (!r.b) throw new Error(r.e || 'sin imagen');
    return `data:${r.t || 'image/png'};base64,${r.b}`;
  }
  if (N) throw new Error('esta versión de la app no puede mirar imágenes');
  const res = await fetch(enWeb ? `${WORKER}/img?u=${encodeURIComponent(url)}` : url, { mode: 'cors' });
  if (!res.ok) throw new Error(`imagen ${res.status}`);
  const blob = await res.blob();
  return await new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = mal; fr.readAsDataURL(blob); });
}

/* almacenamiento privado de la app (la sesión de LaLiga, la clave de Gemini). Fuera de la app, localStorage */
export function guardar(clave, valor) {
  const v = valor == null ? null : typeof valor === 'string' ? valor : JSON.stringify(valor);
  try {
    if (N) { if (v == null) N.borrar(clave); else N.guardar(clave, v); return; }
    if (v == null) localStorage.removeItem('fm-n-' + clave); else localStorage.setItem('fm-n-' + clave, v);
  } catch (e) { /* nada */ }
}
export function leer(clave, json = false) {
  let v = null;
  try { v = N ? N.leer(clave) : localStorage.getItem('fm-n-' + clave); } catch (e) { v = null; }
  if (!json || v == null) return v;
  try { return JSON.parse(v); } catch (e) { return null; }
}

let trabajos = 0;
const llamar = (f, ...a) => { try { return N && typeof N[f] === 'function' ? N[f](...a) : undefined; } catch (e) { return undefined; } };
export const nativo = {
  abrirLogin: (url) => (N ? llamar('abrirLogin', url) : window.open(url, '_blank')),
  loginPendiente: () => llamar('loginPendiente') || null,
  programarAvisos: (lista) => llamar('programarAvisos', JSON.stringify(lista || [])),
  avisosPermitidos: () => (N ? !!llamar('avisosPermitidos') : false),
  pedirPermisoAvisos: () => llamar('pedirPermisoAvisos'),
  alarmasExactas: () => (N ? !!llamar('alarmasExactas') : false),
  pedirAlarmasExactas: () => llamar('pedirAlarmasExactas'),
  notificar: (t, x, h = '') => llamar('notificar', t, x, h),
  version: () => (N ? llamar('version') || 0 : 0),
  // de dónde viene la app: «github» (se actualiza sola desde el aviso), «play» (la actualiza la tienda) o «web»
  canal: () => (N ? llamar('canal') || 'github' : 'web'),
  nombreVersion: () => (N ? llamar('nombreVersion') || '' : ''),
  actualizar: (url) => llamar('actualizar', url),
  instalar: () => llamar('instalar'),
  copiar: (t) => { if (N) return llamar('copiar', t); try { navigator.clipboard.writeText(t); } catch (e) { /* nada */ } },
  compartir: (t) => (N ? llamar('compartir', t) : nativo.copiar(t)),
  abrir: (url) => (N ? llamar('abrir', url) : window.open(url, '_blank', 'noopener')),
  toque: () => llamar('toque'),
  // mientras la IA trabaja: pantalla encendida y notificación fija para que Android no corte internet
  // se cuentan los trabajos a la vez (el plan y una pregunta): la notificación fija se quita cuando acaba el último
  trabajando: (si, texto = '', titulo = '') => {
    trabajos = Math.max(0, trabajos + (si ? 1 : -1));
    if (!si && trabajos > 0) return undefined;
    return N && typeof N.trabajandoCon === 'function' ? llamar('trabajandoCon', !!si, titulo, texto) : llamar('trabajando', !!si, texto);
  },
  aLaVista: () => (N && typeof N.aLaVista === 'function' ? !!llamar('aLaVista') : !document.hidden),
  // la IA en segundo plano: encenderla o apagarla y decir cuándo cambia el mercado; avisar de que ha terminado
  programarFondo: (on, prox = 0) => llamar('programarFondo', !!on, Math.max(0, +prox || 0)),
  fondoTerminado: () => llamar('fondoTerminado'),
  // preguntar con la voz: en la app, el dictado de Google; en el navegador, el reconocimiento de voz de Chrome si lo hay
  voz: () => llamar('voz'),
  hayVoz: () => !!N || 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
  // fotos y capturas para la IA: en la app, el selector de fotos de Android (las devuelve con fotosApp())
  hayFotos: () => !!N && typeof N.fotos === 'function',
  // sacar el teclado (si el WebView se queda sin foco al volver de otra pantalla, Android no lo saca solo)
  teclado: () => (N && typeof N.teclado === 'function' ? llamar('teclado') : undefined),
  fotos: (max) => llamar('fotos', Math.max(1, Math.min(4, +max || 1))),
  estadoFondo: () => { try { return JSON.parse(llamar('estadoFondo') || 'null'); } catch (e) { return null; } },
  // la web al día sin reinstalar (AlDia.java): la huella de la parte Android de este APK, decir que la web ha
  // arrancado bien, cómo está (la que trae el APK, la bajada y el último fallo) y buscar ya (contesta webBuscada)
  huellaNativa: () => (N && typeof N.nativo === 'function' ? llamar('nativo') || '' : ''),
  webViva: () => llamar('webViva'),
  estadoWeb: () => { try { return JSON.parse(llamar('web') || 'null'); } catch (e) { return null; } },
  buscarWeb: () => { if (!N || typeof N.buscarWeb !== 'function') return false; llamar('buscarWeb'); return true; },
  // los anuncios, solo en la versión de Google Play (Anuncios.java): si los lleva, el banner de abajo (si va en la
  // pantalla de ahora), el bonificado para desbloquear algo (contesta con anuncioVisto) y el consentimiento
  hayAnuncios: () => !!(N && typeof N.hayAnuncios === 'function' && llamar('hayAnuncios')),
  banner: (si) => llamar('banner', !!si),
  verAnuncio: (para) => llamar('verAnuncio', String(para || '')),
  cancelarAnuncio: () => llamar('cancelarAnuncio'),
  hayPrivacidadAnuncios: () => !!(N && typeof N.hayPrivacidadAnuncios === 'function' && llamar('hayPrivacidadAnuncios')),
  privacidadAnuncios: () => llamar('privacidadAnuncios'),
};
