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
/** desde dónde: 'play' | 'github' | 'web-android' | 'web-iphone' | 'web-pc' */
export function canalPaso() {
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
    if (!o) return;
    LS.set('origen', { o, t: Date.now() });
    for (const k of [...p.keys()]) if (/^utm_|^ref$/.test(k)) p.delete(k);
    history.replaceState(null, '', location.pathname + (p.toString() ? `?${p}` : '') + location.hash);
  } catch (e) { /* nada */ }
}
const origen = () => { const x = LS.get('origen', null); return x && Date.now() - x.t < ORIGEN_DIAS * 864e5 ? x.o : ''; };
/** el dueño no cuenta (sus pruebas lo llenarían todo) */
const esDueno = () => { const a = LS.get('avisos', null); return !!(a && a.admin); };

/**
 * apunta un paso: 'ver' (la pantalla de entrar), 'demo', 'play' (el botón de Google Play en la web), 'l' (le da a entrar),
 * 'ok' (ha entrado) o un fallo 'x-…'. Con una: true, solo una vez al día en este dispositivo
 */
export function marcarPaso(p, { una = false } = {}) {
  try {
    if (!BASE || esDueno()) return;
    if (una) {
      const d = diaDe(Date.now()), ya = LS.get('pasos-hoy', {}) || {};
      if (ya.d === d && ya[p]) return;
      LS.set('pasos-hoy', { ...(ya.d === d ? ya : { d }), [p]: 1 });
    }
    alWorker('POST', '/embudo', JSON.stringify({ p, k: canalPaso(), o: origen() }), 10000).catch(() => {});
  } catch (e) { /* contar nunca puede romper nada */ }
}
/** el paso de un fallo al entrar, por su tipo (auth.js) */
export const pasoDeFallo = (e) => `x-${(e && e.tipo) || (e && e.sesion ? 'otro' : 'red')}`;
