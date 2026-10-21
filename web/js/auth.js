/* Inicio de sesión con la cuenta de LaLiga (la misma de la app oficial, con Google, Apple o email).
   Es OAuth2 con PKCE contra el B2C de LaLiga: la página de entrar se abre en una pestaña de Chrome, LaLiga
   vuelve a la app con un código (authredirect://com.lfp.laligafantasy?code=...) y ese código se cambia aquí
   por la sesión. La sesión (el token y el de renovarlo) se guarda en el almacenamiento privado de la app. */
import { http, guardar, leer, nativo } from './puente.js';

const B2C = 'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0';
const POLITICA = 'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN';
const CLIENTE = 'af88bcff-1157-40a0-b579-030728aacf0b';
const VUELTA = 'authredirect://com.lfp.laligafantasy';

export class ErrorSesion extends Error {
  constructor(m) { super(m); this.sesion = true; }
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
  guardar('pkce', { verificador, estado, t: Date.now() });
  const q = new URLSearchParams({
    p: POLITICA, client_id: CLIENTE, response_type: 'code', redirect_uri: VUELTA,
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

/** la vuelta de LaLiga con el código: lo cambia por la sesión */
export async function terminarLogin(url) {
  let u;
  try { u = new URL(url); } catch (e) { throw new ErrorSesion('La vuelta de LaLiga no se entiende'); }
  const q = u.searchParams;
  if (q.get('error')) throw new ErrorSesion(textoError(q.get('error_description') || q.get('error')));
  const codigo = q.get('code');
  const pk = leer('pkce', true);
  if (!codigo) throw new ErrorSesion('LaLiga no ha devuelto el código para entrar');
  if (!pk) throw new ErrorSesion('Se ha perdido el inicio de sesión a medias. Vuelve a pulsar Entrar.');
  if (pk.estado && q.get('state') && q.get('state') !== pk.estado) throw new ErrorSesion('La vuelta de LaLiga no es de este inicio de sesión. Vuelve a probar.');
  const { r, j } = await pedirToken({
    grant_type: 'authorization_code', client_id: CLIENTE, code: codigo, redirect_uri: VUELTA,
    code_verifier: pk.verificador, scope: 'openid offline_access',
  });
  guardar('pkce', null);
  if (r.s === 0) throw new Error(`Sin conexión con LaLiga (${r.e})`);
  if (r.s >= 400 || !j) throw new ErrorSesion(textoError((j && (j.error_description || j.error)) || `error ${r.s}`));
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

function textoError(m) {
  const t = String(m || '');
  if (/AADB2C90091|cancel/i.test(t)) return 'Has cancelado el inicio de sesión';
  if (/AADB2C90006|redirect/i.test(t)) return 'LaLiga no acepta la vuelta a esta app. Avísame con este mensaje: ' + t.slice(0, 160);
  if (/AADB2C90079|AADB2C90080|expired/i.test(t)) return 'El inicio de sesión ha caducado. Vuelve a probar.';
  return t.slice(0, 220) || 'No se ha podido entrar';
}
