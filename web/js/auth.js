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
// se guarda en `pkce` y terminarLogin usa la de ahí (o la del esquema nativo si lo pegado viene del método a mano).
const VUELTA = 'authredirect://com.lfp.laligafantasy';
const VUELTA_WEB = 'https://jwt.ms';
const vueltaDe = () => (enApp ? VUELTA : VUELTA_WEB);
// (0.8l) en la web el `state` lleva delante una pista que se lee en la barra de direcciones de la página final (en el
// ordenador se ve entera): es el momento en que el usuario está solo en una página rara. Solo letras y guiones, lo mismo
// que ya devuelve LaLiga tal cual; lo que se compara al volver es el state entero.
const PISTA = 'copia-esta-direccion-entera-y-pegala-en-Fantasy-Manager-';
// el inicio de sesión a medias de la web vale un día: mientras tanto, cualquier pestaña de LaLiga abierta desde aquí sirve
const PKCE_DURA = 24 * 3600e3;

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

const reto = async (verificador) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)));
const urlEntrar = (vuelta, r, estado) => `${B2C}/authorize?${new URLSearchParams({
  p: POLITICA, client_id: CLIENTE, response_type: 'code', redirect_uri: vuelta,
  scope: 'openid offline_access', code_challenge: r, code_challenge_method: 'S256', state: estado, nonce: estado,
})}`;

/** abre la página de LaLiga para entrar (la app de Android; en la web, solo si el enlace de prepararLogin aún no está) */
export async function empezarLogin() {
  if (!enApp) { const { url } = await prepararLogin(); window.open(url, '_blank', 'noopener'); return; }
  const verificador = azar(48);
  const estado = azar(16);
  const vuelta = vueltaDe();
  guardar('pkce', { verificador, estado, vuelta, t: Date.now() });
  nativo.abrirLogin(urlEntrar(vuelta, await reto(verificador), estado));
}

/**
 * (0.8l) La web: deja listo el enlace a la página de LaLiga para ponerlo en un <a target="_blank"> de verdad (un window.open
 * después de un await lo puede parar el bloqueador de ventanas de Safari). El inicio a medias (`pkce`) se reutiliza mientras
 * no se entre: así vale el enlace de CUALQUIER pestaña de LaLiga abierta desde aquí, aunque se pulse dos veces, se repinte
 * la pantalla o Safari recargue la página al volver. Devuelve { url, urlAMano, abierto }: `urlAMano` es el mismo inicio con
 * la vuelta de antes (el esquema de la app), para el método a mano del ordenador si LaLiga dejara de aceptar la https.
 */
export async function prepararLogin() {
  let pk = leer('pkce', true);
  // caducado solo si además no se acaba de abrir LaLiga con él (una pestaña abierta hace un rato aún puede volver con su código)
  const viejo = pk && !(Date.now() - pk.t < PKCE_DURA) && !(Date.now() - (pk.abierto || 0) < 3600e3);
  if (!pk || !pk.verificador || !pk.estado || pk.vuelta !== VUELTA_WEB || viejo) {
    pk = { verificador: azar(48), estado: PISTA + azar(16), vuelta: VUELTA_WEB, t: Date.now() };
    guardar('pkce', pk);
  }
  const r = await reto(pk.verificador);
  return { url: urlEntrar(VUELTA_WEB, r, pk.estado), urlAMano: urlEntrar(VUELTA, r, pk.estado), abierto: pk.abierto || 0 };
}
/** apunta que se ha abierto la página de LaLiga (para ofrecer pegar al volver, también si la página se recarga) */
export function marcarAbierto() {
  const pk = leer('pkce', true);
  if (pk) guardar('pkce', { ...pk, abierto: Date.now() });
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
  const url = s.match(/(?:https?|authredirect|msauth[\w.]*):\/\/[^\s"'<>]*[?#&][^\s"'<>]*(?:code|error)=[^\s"'<>]+/i);
  if (url) return url[0];
  const suelto = s.match(/(?:state=[^\s"'<>&]+&)?(?:error=[^\s"'<>&]+&[^\s"'<>]*|code=[^\s"'<>&]+)(?:&state=[^\s"'<>&]+)?/i);
  if (suelto) return `https://jwt.ms/?${suelto[0]}`;
  return s;
}

/**
 * (0.8l) Mira lo pegado ANTES de llamar a LaLiga y dice qué pasa con palabras que digan qué hacer: { url } si lleva el código
 * (o un error de LaLiga, que explica terminarLogin) o { error } con lo que se ha pegado en su lugar. No gasta el inicio a medias.
 */
export function mirarVuelta(txt) {
  const s = String(txt || '').trim();
  if (!s) return { error: 'No hay nada pegado. Copia la dirección de la página en la que acabas al entrar en LaLiga y pégala aquí.' };
  const v = extraerVuelta(s);
  let u = null;
  try { u = new URL(v); } catch (e) { u = null; }
  if (u && /^(https?|authredirect|msauth[\w.]*):$/i.test(u.protocol) && (u.searchParams.get('code') || u.searchParams.get('error'))) return { url: v };
  if (/login\.laliga\.es|b2clogin\.com|accounts\.google\.|appleid\.apple\./i.test(s)) return { error: 'Esa es la dirección de la página de entrar: aún no has terminado. Acaba de entrar en LaLiga y copia la dirección de la página en la que te deja al final (empieza por jwt.ms).' };
  if (/fantasymanagerapp\.com|fantasy-manager[\w.-]*\.pages\.dev|charly10sf\.github\.io/i.test(s)) return { error: 'Esa es la dirección de Fantasy Manager. La que hace falta es la de la página en la que acabas al entrar en LaLiga (empieza por jwt.ms).' };
  if (/jwt\.ms/i.test(s)) return { error: 'A esa dirección le falta el final (la parte de «code=»). Vuelve a esa página y cópiala entera, sin seleccionar un trozo a mano.' };
  return { error: 'Eso no es la dirección que hace falta. Es la de la página en la que acabas al entrar en LaLiga: empieza por jwt.ms y lleva «code=».' };
}

/** la vuelta de LaLiga con el código: lo cambia por la sesión */
export async function terminarLogin(url) {
  let u;
  try { u = new URL(extraerVuelta(url)); } catch (e) { throw new ErrorSesion('La vuelta de LaLiga no se entiende. Copia la dirección entera de la página en la que acabas al entrar.'); }
  const q = u.searchParams;
  if (q.get('error')) { const x = q.get('error_description') || q.get('error'); throw new ErrorSesion(textoError(x), tipoDe(x)); }
  const codigo = q.get('code');
  const pk = leer('pkce', true);
  if (!codigo) throw new ErrorSesion('LaLiga no ha devuelto el código para entrar');
  if (!pk) throw new ErrorSesion(enApp ? 'Se ha perdido el inicio de sesión a medias. Vuelve a pulsar Entrar.' : 'Ese enlace no se ha sacado desde aquí (por ejemplo, empezaste en Safari y ahora estás en el icono de la pantalla de inicio, o al revés). Pulsa aquí «Abrir LaLiga» y copia la dirección nueva.', 'perdido');
  // El state que no cuadra. En la app, como siempre: no se sigue. En la web no se corta aquí: lo que ata el código a este
  // inicio es PKCE (LaLiga solo lo canjea con el verificador de aquí), así que se prueba el canje y, si LaLiga lo rechaza, se
  // dice que es de otro intento. Así la entrada no depende de que el state vuelva idéntico letra a letra.
  const otro = !!(pk.estado && q.get('state') && q.get('state') !== pk.estado);
  if (otro && enApp) throw new ErrorSesion('La vuelta de LaLiga no es de este inicio de sesión. Vuelve a probar.', 'perdido');
  // la vuelta del canje, la misma del authorize: la del esquema de la app si lo pegado viene del método a mano; si no, la guardada
  const vuelta = /^authredirect:$/i.test(u.protocol) ? VUELTA : (pk.vuelta || VUELTA);
  const { r, j } = await pedirToken({
    grant_type: 'authorization_code', client_id: CLIENTE, code: codigo, redirect_uri: vuelta,
    code_verifier: pk.verificador, scope: 'openid offline_access',
  });
  // sin conexión el código no se ha gastado: el inicio a medias se queda y se puede volver a pulsar con lo mismo pegado
  if (r.s === 0) throw Object.assign(new Error(`Sin conexión con LaLiga (${r.e}). Mira que tengas internet y vuelve a pulsar: el enlace que has pegado sigue valiendo unos minutos.`), { tipo: 'red' });
  // en la web el inicio a medias sigue valiendo para otro enlace (el código caducó o ya se usó): solo se borra al entrar
  if (enApp) guardar('pkce', null);
  if (r.s >= 400 || !j) {
    const x = (j && (j.error_description || j.error)) || `error ${r.s}`;
    if (otro && r.s < 500) throw new ErrorSesion('Ese enlace es de otro intento o de otro navegador. Pulsa aquí «Abrir LaLiga» y copia la dirección nueva.', 'perdido');
    throw new ErrorSesion(textoError(x), r.s >= 500 ? 'laliga' : tipoDe(x));
  }
  const ses = guardarTokens(j);
  guardar('pkce', null);
  return ses;
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
  if (/AADB2C90079|AADB2C90080|expired|invalid_grant/i.test(t)) return 'caduca';
  if (/code_verifier|AADB2C90183/i.test(t)) return 'perdido';
  if (/AADB2C90075|InternalServerError|Internal Server Error|server_error|temporarily_unavailable/i.test(t)) return 'laliga';
  return 'otro';
}
function textoError(m) {
  const t = String(m || '');
  const otra = enApp ? 'Vuelve a probar.' : 'Pulsa «Abrir LaLiga» otra vez y copia la dirección nueva.';
  if (/AADB2C90091|cancel/i.test(t)) return enApp ? 'Has cancelado el inicio de sesión' : 'Has cancelado la entrada en LaLiga. Cuando quieras, pulsa «Abrir LaLiga» otra vez.';
  if (/AADB2C90006|redirect/i.test(t)) return enApp ? 'LaLiga no ha aceptado la vuelta. Vuelve a probar; si sigue, avísame con esto: ' + t.slice(0, 140) : 'LaLiga ha dejado de aceptar esta forma de entrar (error AADB2C90006). No es cosa tuya. Mira «¿Algo no va?», aquí debajo: ahí están las otras formas de entrar.';
  if (/code_verifier|AADB2C90183/i.test(t)) return `Ese enlace es de otro intento o de otro navegador. ${otra}`;
  if (/AADB2C90079|AADB2C90080|expired|invalid_grant/i.test(t)) return enApp ? 'El inicio de sesión ha caducado. Vuelve a probar.' : `Ese enlace ya no vale: caduca a los pocos minutos y solo sirve una vez. ${otra}`;
  // (14 nov, Carlos) la primera vez con Google, los servidores de LaLiga a veces fallan al dar de alta la cuenta (AADB2C90075,
  // «InternalServerError»): es cosa suya y a la segunda entra
  if (/AADB2C90075|InternalServerError|Internal Server Error/i.test(t)) return enApp ? 'Los servidores de LaLiga han fallado al entrar (es cosa suya, no de tu cuenta). Vuelve a darle a «Entrar con mi cuenta de LaLiga»: a la segunda suele entrar.' : `Los servidores de LaLiga han fallado al entrar (es cosa suya, no de tu cuenta). ${otra} A la segunda suele entrar.`;
  return t.slice(0, 220) || 'No se ha podido entrar';
}
