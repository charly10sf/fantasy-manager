/* Inicio de sesión con la cuenta de LaLiga (la misma de la app oficial, con Google, Apple o email).
   Es OAuth2 con PKCE contra el B2C de LaLiga: la página de entrar se abre en una pestaña de Chrome, LaLiga
   vuelve a la app con un código (authredirect://com.lfp.laligafantasy?code=...) y ese código se cambia aquí
   por la sesión. La sesión (el token y el de renovarlo) se guarda en el almacenamiento privado de la app. */
import { http, guardar, leer, nativo, enApp } from './puente.js';

const B2C = 'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0';
const POLITICA = 'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN';
const CLIENTE = 'af88bcff-1157-40a0-b579-030728aacf0b';
// La vuelta de LaLiga, según dónde estamos. En Android la app oficial caza el esquema propio, así que ahí seguimos igual.
// En la web ese esquema no abre nada (en iPhone es donde se moría la entrada); usamos una redirect https que LaLiga ya tiene
// registrada en este client_id (jwt.ms, una página de Microsoft que solo enseña el token en el propio navegador). Al volver
// a ella, el ?code=… queda a la vista en la barra, también en iPhone, y se copia a mano. Con PKCE el code no sirve sin el
// verificador, que se queda aquí. GOTCHA: la redirect tiene que ser LA MISMA en authorize y en el canje del token; por eso
// se guarda en `pkce` y terminarLogin usa la de ahí.
const VUELTA = 'authredirect://com.lfp.laligafantasy';
const VUELTA_WEB = 'https://jwt.ms';
const vueltaDe = () => (enApp ? VUELTA : VUELTA_WEB);

export class ErrorSesion extends Error {
  // tipo (0.7.13i): para contar en qué falla la entrada (semaforo.js): cancel, caduca, laliga, redirect, perdido u otro
  constructor(m, tipo = 'otro') { super(m); this.sesion = true; this.tipo = tipo; }
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const azar = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export function jwt(t) {
  try {
    const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(p + '='.repeat((4 - (p.length % 4)) % 4)))));
  } catch (e) { return null; }
}

export const sesion = () => leer('sesion', true);
export const haySesion = () => { const s = sesion(); return !!(s && (s.token || s.renovar)); };
export function cerrarSesion() { guardar('sesion', null); guardar('pkce', null); }

/** quién ha entrado (nombre y correo, sacados del token) */
export function quien() {
  const s = sesion(); if (!s) return null;
  const p = jwt(s.idToken || s.token) || {};
  return { nombre: p.name || p.given_name || '', correo: p.email || (p.emails && p.emails[0]) || p.unique_name || '', idp: p.idp || '' };
}

/** abre la página de LaLiga para entrar */
export async function empezarLogin() {
  const verificador = azar(48);
  const reto = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)));
  const estado = azar(16);
  const vuelta = vueltaDe();
  guardar('pkce', { verificador, estado, vuelta, t: Date.now() });
  const q = new URLSearchParams({
    p: POLITICA, client_id: CLIENTE, response_type: 'code', redirect_uri: vuelta,
    scope: 'openid offline_access', code_challenge: reto, code_challenge_method: 'S256', state: estado, nonce: estado,
  });
  nativo.abrirLogin(`${B2C}/authorize?${q}`);
}

function guardarTokens(j, anterior = {}) {
  const token = j.access_token || j.id_token;
  if (!token) throw new ErrorSesion('LaLiga no ha devuelto la sesión');
  const p = jwt(token) || {};
  const dura = +(j.id_token_expires_in || j.expires_in || 0);
  const caduca = p.exp ? p.exp * 1000 : Date.now() + (dura || 3600) * 1000;
  const s = { token, idToken: j.id_token || anterior.idToken || null, renovar: j.refresh_token || anterior.renovar || null, caduca, desde: anterior.desde || Date.now() };
  guardar('sesion', s);
  return s;
}

async function pedirToken(datos) {
  const r = await http('POST', `${B2C}/token?p=${POLITICA}`, {
    cabeceras: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    cuerpo: new URLSearchParams(datos).toString(),
  });
  let j = null;
  try { j = JSON.parse(r.b || 'null'); } catch (e) { j = null; }
  return { r, j };
}

/** saca la dirección de vuelta de lo que pega el usuario, aunque venga con texto alrededor o solo la parte de ?state=…&code=… */
export function extraerVuelta(txt) {
  const s = String(txt || '').trim();
  // solo si TODO el texto es ya una URL con un esquema esperado (si no, «mira: …» colaría «mira» como esquema y arrastraría basura)
  try { const u = new URL(s); if (/^(https?|authredirect|msauth):/i.test(u.protocol) && (u.searchParams.get('code') || u.searchParams.get('error'))) return s; } catch (e) { /* se busca dentro del texto */ }
  const url = s.match(/(?:https?|authredirect|msauth[\w.]*):\/\/[^\s"'<>]*[?#&][^\s"'<>]*code=[^\s"'<>]+/i);
  if (url) return url[0];
  const suelto = s.match(/(?:state=[^\s"'<>&]+&)?(?:error=[^\s"'<>&]+&[^\s"'<>]*|code=[^\s"'<>&]+)(?:&state=[^\s"'<>&]+)?/i);
  if (suelto) return `https://jwt.ms/?${suelto[0]}`;
  return s;
}

/** la vuelta de LaLiga con el código: lo cambia por la sesión */
export async function terminarLogin(url) {
  let u;
  try { u = new URL(extraerVuelta(url)); } catch (e) { throw new ErrorSesion('La vuelta de LaLiga no se entiende. Copia la dirección entera de la página de LaLiga.'); }
  const q = u.searchParams;
  if (q.get('error')) { const x = q.get('error_description') || q.get('error'); throw new ErrorSesion(textoError(x), tipoDe(x)); }
  const codigo = q.get('code');
  const pk = leer('pkce', true);
  if (!codigo) throw new ErrorSesion('LaLiga no ha devuelto el código para entrar');
  if (!pk) throw new ErrorSesion('Se ha perdido el inicio de sesión a medias. Vuelve a pulsar Entrar.', 'perdido');
  if (pk.estado && q.get('state') && q.get('state') !== pk.estado) throw new ErrorSesion('La vuelta de LaLiga no es de este inicio de sesión. Vuelve a probar.', 'perdido');
  const { r, j } = await pedirToken({
    grant_type: 'authorization_code', client_id: CLIENTE, code: codigo, redirect_uri: pk.vuelta || VUELTA,
    code_verifier: pk.verificador, scope: 'openid offline_access',
  });
  guardar('pkce', null);
  if (r.s === 0) throw Object.assign(new Error(`Sin conexión con LaLiga (${r.e})`), { tipo: 'red' });
  if (r.s >= 400 || !j) { const x = (j && (j.error_description || j.error)) || `error ${r.s}`; throw new ErrorSesion(textoError(x), r.s >= 500 ? 'laliga' : tipoDe(x)); }
  return guardarTokens(j);
}

let renovando = null;
/** renueva la sesión con el token de renovar (cada token dura un rato; este, semanas) */
export function renovar() {
  if (renovando) return renovando;
  renovando = (async () => {
    const s = sesion();
    if (!s || !s.renovar) throw new ErrorSesion('Tienes que volver a entrar con tu cuenta de LaLiga');
    const { r, j } = await pedirToken({ grant_type: 'refresh_token', refresh_token: s.renovar, client_id: CLIENTE, scope: 'openid offline_access' });
    if (r.s === 0) throw new Error(`Sin conexión con LaLiga (${r.e})`);
    if (r.s === 400 || r.s === 401 || (j && /invalid_grant/i.test(j.error || ''))) {
      guardar('sesion', { ...s, renovar: null });
      throw new ErrorSesion('Tu sesión de LaLiga ha caducado: vuelve a entrar');
    }
    if (r.s >= 400 || !j) throw new Error(`LaLiga no ha renovado la sesión (error ${r.s})`);
    return guardarTokens(j, s);
  })();
  // (el catch es para que la copia que devuelve finally no quede como error sin recoger: el error ya le llega a quien espera)
  renovando.finally(() => { renovando = null; }).catch(() => {});
  return renovando;
}

/** el token para la API, renovado si le quedan menos de 5 minutos */
export async function token() {
  let s = sesion();
  if (!s || !s.token) throw new ErrorSesion('No has entrado con tu cuenta de LaLiga');
  if (s.caduca && s.caduca - Date.now() < 5 * 60e3) {
    if (!s.renovar) throw new ErrorSesion('Tu sesión de LaLiga ha caducado: vuelve a entrar');
    s = await renovar();
  }
  return s.token;
}

/** en qué ha fallado la entrada, para contarlo (lo mismo que mira textoError) */
function tipoDe(m) {
  const t = String(m || '');
  if (/AADB2C90091|cancel/i.test(t)) return 'cancel';
  if (/AADB2C90006|redirect/i.test(t)) return 'redirect';
  if (/AADB2C90079|AADB2C90080|expired/i.test(t)) return 'caduca';
  if (/AADB2C90075|InternalServerError|Internal Server Error|server_error|temporarily_unavailable/i.test(t)) return 'laliga';
  return 'otro';
}
function textoError(m) {
  const t = String(m || '');
  if (/AADB2C90091|cancel/i.test(t)) return 'Has cancelado el inicio de sesión';
  if (/AADB2C90006|redirect/i.test(t)) return 'LaLiga no ha aceptado la vuelta. Vuelve a probar; si sigue, usa el desplegable «¿No te sale? Hacerlo a mano». Avísame con esto: ' + t.slice(0, 140);
  if (/AADB2C90079|AADB2C90080|expired/i.test(t)) return 'El inicio de sesión ha caducado. Vuelve a probar.';
  // (14 nov, Carlos) la primera vez con Google, los servidores de LaLiga a veces fallan al dar de alta la cuenta (AADB2C90075,
  // «InternalServerError»): es cosa suya y a la segunda entra
  if (/AADB2C90075|InternalServerError|Internal Server Error/i.test(t)) return 'Los servidores de LaLiga han fallado al entrar (es cosa suya, no de tu cuenta). Vuelve a darle a «Entrar con mi cuenta de LaLiga»: a la segunda suele entrar.';
  return t.slice(0, 220) || 'No se ha podido entrar';
}
