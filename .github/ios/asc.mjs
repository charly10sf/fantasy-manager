// La API de App Store Connect, para .github/ios/ficha.mjs (sesión iOS 6). Lo mismo que hay dentro de testflight.mjs (la
// credencial JWT ES256 con ASC_KEY_*, las llamadas y el descifrado de contacto.enc), sacado a un módulo para no tocar el
// script de TestFlight, que funciona. Si algún día se cambia algo de aquí, cambiarlo también allí (o pasar testflight.mjs
// a importar de aquí).
import crypto from 'node:crypto';

export const APP = '6839220127'; // Apple ID de la app en App Store Connect
export const API = 'https://api.appstoreconnect.apple.com';
export const LOCALE = 'es-ES';

export function normaP8(txt) {
  const b = String(txt || '').replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  return `-----BEGIN PRIVATE KEY-----\n${b.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
}
export const claveP8 = () => crypto.createPrivateKey(normaP8(process.env.ASC_KEY_P8));
const b64u = (b) => Buffer.from(b).toString('base64url');
function credencial() {
  const id = process.env.ASC_KEY_ID, iss = process.env.ASC_ISSUER_ID, p8 = process.env.ASC_KEY_P8;
  if (!id || !iss || !p8) throw new Error('Faltan los secretos ASC_KEY_ID, ASC_ISSUER_ID y ASC_KEY_P8');
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64u(JSON.stringify({ alg: 'ES256', kid: id, typ: 'JWT' }));
  const cuerpo = b64u(JSON.stringify({ iss, iat: ahora, exp: ahora + 19 * 60, aud: 'appstoreconnect-v1' }));
  const firma = crypto.sign('sha256', Buffer.from(`${cab}.${cuerpo}`), { key: claveP8(), dsaEncoding: 'ieee-p1363' });
  return `${cab}.${cuerpo}.${b64u(firma)}`;
}

let jwt = null, jwtT = 0;
export async function api(metodo, ruta, cuerpo) {
  if (!jwt || Date.now() - jwtT > 15 * 60e3) { jwt = credencial(); jwtT = Date.now(); }
  const r = await fetch(ruta.startsWith('http') ? ruta : API + ruta, {
    method: metodo,
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const txt = await r.text();
  let j = null;
  try { j = txt ? JSON.parse(txt) : null; } catch { /* no es JSON */ }
  if (!r.ok) {
    const err = (j && j.errors || []).map((e) => `${e.code}: ${e.detail || e.title}${e.source && e.source.pointer ? ` (${e.source.pointer})` : ''}`).join(' | ') || txt.slice(0, 300);
    const e = new Error(`${metodo} ${ruta.split('?')[0]} → ${r.status} ${err}`);
    e.estado = r.status; e.errores = j && j.errors;
    throw e;
  }
  return j;
}

/** todas las páginas de una lista */
export async function todo(ruta) {
  const out = [];
  let siguiente = ruta;
  while (siguiente) {
    const j = await api('GET', siguiente);
    out.push(...(j.data || []));
    siguiente = j.links && j.links.next ? j.links.next : null;
  }
  return out;
}

const INFO_HKDF = Buffer.from('fantasy-manager contacto testflight');
export function descifrar(sobre, priv = claveP8()) {
  const efimera = crypto.createPublicKey({ key: Buffer.from(sobre.e, 'base64'), type: 'spki', format: 'der' });
  const comun = crypto.diffieHellman({ privateKey: priv, publicKey: efimera });
  const k = Buffer.from(crypto.hkdfSync('sha256', comun, Buffer.alloc(0), INFO_HKDF, 32));
  const d = Buffer.from(sobre.d, 'base64');
  const dc = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(sobre.iv, 'base64'));
  dc.setAuthTag(d.subarray(d.length - 16));
  return JSON.parse(Buffer.concat([dc.update(d.subarray(0, d.length - 16)), dc.final()]).toString());
}

/** que un valor no salga nunca en el registro de la Action */
export const ocultar = (v) => { if (v) for (const t of String(v).split(/\s+/)) if (t) console.log(`::add-mask::${t}`); };
