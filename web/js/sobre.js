/* Lo que se pasa del móvil al ordenador (la sesión, la clave de la IA, la liga), cerrado con AES-GCM para que el
   servidor de la web solo guarde, esos 10 minutos, algo que no puede leer (fase 0 del roadmap, 4 nov 2026).
   - Con el QR: la clave va en el propio QR, detrás de # (no llega a ningún servidor).
   - Con el código de 8 letras: la clave sale del código (PBKDF2), y el código lo saca el móvil, no el servidor. */

const B64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s) => { const t = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(t, (c) => c.charCodeAt(0)); };
const texto = new TextEncoder(), leer = new TextDecoder();

/** las mismas letras que el servidor (sin 0/O ni 1/I, que se confunden) */
export const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function nuevoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => ALFABETO[x % ALFABETO.length]).join('');
}
/** una clave al azar para el QR (256 bits, 43 caracteres) */
export const claveQR = () => B64(crypto.getRandomValues(new Uint8Array(32)));
export const esClaveQR = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{43}$/.test(k);

const importar = (bytes) => crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
async function deCodigo(cod) {
  const base = await crypto.subtle.importKey('raw', texto.encode(String(cod).toUpperCase()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: texto.encode('fantasy-manager/vinculo/v1'), iterations: 150000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const llave = (x) => (x && x.qr ? importar(deB64(x.qr)) : deCodigo(x.codigo));

/** cierra un objeto: «v1.<iv>.<cifrado>»; x = { qr: clave } o { codigo } */
export async function cerrar(x, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llave(x), texto.encode(JSON.stringify(obj)));
  return `v1.${B64(iv)}.${B64(c)}`;
}
/** lo abre (lanza un error si la clave no es la suya o se ha tocado por el camino) */
export async function abrir(x, cif) {
  const [v, iv, c] = String(cif || '').split('.');
  if (v !== 'v1' || !iv || !c) throw new Error('Lo que ha llegado del móvil no se entiende');
  try {
    const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, await llave(x), deB64(c));
    return JSON.parse(leer.decode(p));
  } catch (e) { throw new Error('No se ha podido abrir lo que manda el móvil: pide otro código o QR'); }
}
