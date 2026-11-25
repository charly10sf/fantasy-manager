/* El semáforo de LaLiga Fantasy en la pantalla de entrar y la entrada paso a paso sin cuenta (0.7.13i, Carlos, 15 nov:
   con 27 clics en la campaña de X no veía a nadie entrar y no había forma de saber si no llegaban, si se iban o si LaLiga
   no les dejaba entrar).

   El semáforo: pregunta al Worker (GET /estado, que lo mira para todos como mucho cada 2 minutos); si no contesta (con
   partidos las operadoras cortan Cloudflare), lo mira el propio móvil con las pruebas de estado-laliga.js (en la app, por
   su conexión; en la web, por el intermediario). Lo pinta en #estadoLL y lo repite cada 2 minutos mientras se ve.

   Los pasos antes de entrar (marcarPaso): se mandan al momento a /embudo, sin sesión, sin ids ni nada de quién es: solo el
   paso, desde dónde (Google Play, el APK o la web en Android, iPhone u ordenador) y, si se llegó a la web desde una campaña
   con ?utm_source=…, cuál. El servidor solo los suma por día. Lo del dueño (y lo que haga en sus pruebas) no se cuenta. */
import { http, enApp, nativo, WORKER, WORKER_PUBLICO, despues } from './puente.js';
import { LS, diaDe, esc } from './util.js';
import { PRUEBAS, resultado, nivelDe, textoEstado } from './estado-laliga.js';

const BASE = enApp ? WORKER_PUBLICO : WORKER;
const CADA = 2 * 60e3;
let ultimo = null, mirando = null;

/** una petición al Worker sin sesión: { s, b } (s 0 si no contesta) */
async function alWorker(metodo, ruta, cuerpo, tiempo) {
  if (!BASE) return { s: 0 };
  if (enApp) return http(metodo, BASE + ruta, { cabeceras: { 'content-type': 'text/plain' }, cuerpo, tiempo });
  const ctl = new AbortController(), reloj = setTimeout(() => ctl.abort(), tiempo);
  try {
    const r = await fetch(BASE + ruta, { method: metodo, body: cuerpo || undefined, headers: cuerpo ? { 'content-type': 'text/plain' } : undefined, signal: ctl.signal, cache: 'no-store', keepalive: !!cuerpo });
    return { s: r.status, b: await r.text() };
  } catch (e) { return { s: 0 }; } finally { clearTimeout(reloj); }
}

/** lo mira el propio móvil (sin «cuenta», que en la web no deja pasar el intermediario sin sesión) */
async function mirarDirecto() {
  const una = async (p) => {
    const t0 = Date.now();
    const r = await http(p.metodo, p.url, { cabeceras: p.cabeceras, cuerpo: p.cuerpo, tiempo: 9000 });
    return resultado(p, r.s, r.b, Date.now() - t0);
  };
  const dos = async (p) => { const a = await una(p); return a.e === 'mal' ? una(p) : a; };
  const [login, api] = await Promise.all([dos(PRUEBAS.login), dos(PRUEBAS.api)]);
  // si no se llega a ninguno de los dos, lo más probable es que sea la conexión de este móvil
  if (login.s === 0 && api.s === 0) return { nivel: 'gris', t: Date.now(), login, api, sinRed: true };
  return { nivel: nivelDe({ login, api }), t: Date.now(), login, api, directo: true };
}

/** { nivel, t, login, api, cuenta, entradas } (nivel 'gris' si no se ha podido mirar) */
export function mirarEstado(forzar = false) {
  if (!forzar && ultimo && Date.now() - ultimo.t < CADA - 5e3) return Promise.resolve(ultimo);
  if (mirando) return mirando;
  mirando = (async () => {
    let E = null;
    const r = await alWorker('GET', '/estado', null, 7000);
    if (r.s === 200) { try { E = JSON.parse(r.b); } catch (e) { E = null; } }
    if (!E || !E.nivel) { try { E = await mirarDirecto(); } catch (e) { E = { nivel: 'gris', t: Date.now() }; } }
    ultimo = { ...E, visto: Date.now() };
    return ultimo;
  })().finally(() => { mirando = null; });
  return mirando;
}
export const ultimoEstado = () => ultimo;

const horaF = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
/** el recuadro (se rellena con pintarEstado) */
export function estadoHTML() {
  const E = ultimo;
  const n = E ? E.nivel : 'mirando';
  const { t, x } = E ? textoEstado(E) : { t: 'Mirando cómo va LaLiga Fantasy…', x: '' };
  const cuando = E && E.t ? ` · ${horaF.format(new Date(E.t))}` : '';
  return `<button type="button" class="estado-ll" id="estadoLL" data-nivel="${n}" data-accion="mirarEstado" aria-live="polite" title="Volver a mirar">
    <span class="el-p" aria-hidden="true"></span><span class="el-c"><b>${esc(t)}</b>${x ? `<span>${esc(x)}</span>` : ''}</span><small>${E ? `Servidores de LaLiga${cuando}` : ''}</small></button>`;
}
let reloj = null;
/** mira el estado y lo pinta donde esté #estadoLL; se repite cada 2 minutos mientras se ve */
export async function pintarEstado(forzar = false) {
  if (reloj) { reloj(); reloj = null; }
  const el = document.getElementById('estadoLL');
  if (!el) return;
  if (forzar) { el.dataset.nivel = 'mirando'; }
  await mirarEstado(forzar);
  const ya = document.getElementById('estadoLL');
  if (!ya) return;
  ya.outerHTML = estadoHTML();
  reloj = despues(CADA, () => { reloj = null; if (document.getElementById('estadoLL') && !document.hidden) pintarEstado(); });
}

/* ---------------- los pasos antes de entrar ---------------- */
/** desde dónde: 'play' | 'github' | 'ios' | 'web-android' | 'web-iphone' | 'web-pc' */
export function canalPaso() {
  // (25 nov) la app de iOS va aparte: hasta que el servidor conozca ese canal no cuenta sus pasos (los rechaza), que es
  // mejor que contarlos como si fueran de otra app
  if (enApp && nativo.canal() === 'ios') return 'ios';
  if (enApp) return nativo.canal() === 'play' ? 'play' : 'github';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'web-android';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'web-iphone';
  return 'web-pc';
}
const ORIGEN_DIAS = 7;
/** si se llegó a la web con ?utm_source=… (o ?ref=…), se apunta 7 días y se quita de la dirección */
export function leerOrigen() {
  try {
    const p = new URLSearchParams(location.search);
    const o = String(p.get('utm_source') || p.get('ref') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    // (21 nov) la marca de las pruebas: ?prueba=1 se queda guardada en este navegador (?prueba=0 la quita) y sus pasos no
    // se cuentan. Para probar contra la web publicada o una vista previa sin ensuciar «Antes de entrar»
    const pr = p.get('prueba');
    if (pr != null) { if (pr === '0') LS.del('prueba'); else LS.set('prueba', true); }
    if (!o && pr == null) return;
    // (24 nov) los orígenes de dentro de la propia web (un botón de las páginas de datos, «web-…», o el QR del ordenador,
    // «qr») no pisan la campaña con la que llegó: quien vino de un anuncio sigue contando para ese anuncio
    const deDentro = (x) => /^(web-|qr$)/.test(x);
    if (o && !(deDentro(o) && origen() && !deDentro(origen()))) LS.set('origen', { o, t: Date.now() });
    for (const k of [...p.keys()]) if (/^utm_|^ref$|^prueba$/.test(k)) p.delete(k);
    history.replaceState(null, '', location.pathname + (p.toString() ? `?${p}` : '') + location.hash);
  } catch (e) { /* nada */ }
}
/** la campaña con la que se llegó en los últimos 7 días ('' si ninguna) */
export const origenActual = () => origen();
function origen() { const x = LS.get('origen', null); return x && Date.now() - x.t < ORIGEN_DIAS * 864e5 ? x.o : ''; }
/** el dueño no cuenta (sus pruebas lo llenarían todo) */
const esDueno = () => { const a = LS.get('avisos', null); return !!(a && a.admin); };
/** (21 nov) ¿es una prueba? Con la marca guardada (?prueba=1) o con un navegador manejado por un programa (Playwright y
    compañía ponen navigator.webdriver; también algunos rastreadores, que tampoco son visitas). El 21 nov las pruebas
    contra la web publicada sumaron 9 «ver» y 3 «le dan» que no eran de nadie */
export const esPrueba = () => { try { return !!LS.get('prueba', false) || navigator.webdriver === true; } catch (e) { return false; } };
/** el Worker de una prueba en local (localStorage «fm-worker» apuntando a esta máquina): ahí se manda todo, que no ensucia nada */
const workerLocal = () => /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE);

/**
 * apunta un paso: 'llega' (la web: llega sin sesión), 'ver' (en la app, la pantalla de entrar; en la web, el bloque de entrar
 * a la vista), 'demo', 'play' (el botón de Google Play en la web), 'l' (abre LaLiga), 'v' (la web: vuelve de la pestaña de
 * LaLiga), 'p' (la web: pega el enlace), 'ok' (ha entrado), 'x-vuelve' (la app: vuelve de LaLiga sin el código) o un fallo
 * 'x-…'. Con una: true, solo una vez al día en este dispositivo
 */
export function marcarPaso(p, { una = false } = {}) {
  try {
    if (!BASE || esDueno()) return;
    // las pruebas no cuentan (solo se mandan a un Worker de mentira en local, que es donde se comprueban los pasos)
    if (esPrueba() && !(workerLocal() && !enApp)) { pasosPrueba.push(p); return; }
    if (una) {
      const d = diaDe(Date.now()), ya = LS.get('pasos-hoy', {}) || {};
      if (ya.d === d && ya[p]) return;
      LS.set('pasos-hoy', { ...(ya.d === d ? ya : { d }), [p]: 1 });
    }
    alWorker('POST', '/embudo', JSON.stringify({ p, k: canalPaso(), o: origen() }), 10000).catch(() => {});
  } catch (e) { /* contar nunca puede romper nada */ }
}
/** lo que se habría apuntado si no fuera una prueba (para comprobarlo en las pruebas de .github) */
const pasosPrueba = [];
if (typeof window !== 'undefined') window.__pasosPrueba = pasosPrueba;
/** el paso de un fallo al entrar, por su tipo (auth.js) */
export const pasoDeFallo = (e) => `x-${(e && e.tipo) || (e && e.sesion ? 'otro' : 'red')}`;
