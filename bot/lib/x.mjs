// Publicar en X con la API v2 (POST /2/tweets) firmando con OAuth 1.0a (las cuatro claves de la app, "Leer y escribir").
// Sin dependencias. Las claves llegan por variables de entorno desde los secretos de GitHub: nunca en el repo ni en el chat.
import crypto from 'node:crypto';

const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** los parámetros oauth_* con su firma (HMAC-SHA1). `params` son los de la query o del cuerpo form; con cuerpo JSON no van. */
export function firmar({ metodo, url, params = {}, claves, nonce, marca }) {
  const oauth = { oauth_consumer_key: claves.apiKey, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: marca, oauth_token: claves.token, oauth_version: '1.0' };
  const todos = { ...params, ...oauth };
  const normal = Object.keys(todos).sort().map((k) => `${enc(k)}=${enc(todos[k])}`).join('&');
  const base = [metodo.toUpperCase(), enc(url), enc(normal)].join('&');
  const clave = `${enc(claves.apiSecret)}&${enc(claves.tokenSecret)}`;
  return { ...oauth, oauth_signature: crypto.createHmac('sha1', clave).update(base).digest('base64') };
}
export const cabecera = (oauth) => 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');

export function clavesDelEntorno(env = process.env) {
  const c = { apiKey: env.X_API_KEY, apiSecret: env.X_API_SECRET, token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_TOKEN_SECRET };
  const faltan = Object.entries({ X_API_KEY: c.apiKey, X_API_SECRET: c.apiSecret, X_ACCESS_TOKEN: c.token, X_ACCESS_TOKEN_SECRET: c.tokenSecret }).filter(([, v]) => !v).map(([k]) => k);
  return { claves: c, faltan };
}

/** publica un tweet (con imágenes ya subidas, si se pasan sus media_ids). Devuelve { ok, estado, id, cuerpo }.
    No reintenta: un fallo no debe duplicar el post. */
export async function publicar(texto, claves, { base = process.env.X_API_BASE || 'https://api.x.com', mediaIds = [] } = {}) {
  if ([...texto].length === 0) throw new Error('tweet vacío');
  const url = `${base}/2/tweets`;
  const oauth = firmar({ metodo: 'POST', url, claves, nonce: crypto.randomBytes(16).toString('hex'), marca: String(Math.floor(Date.now() / 1000)) });
  const cuerpoTweet = mediaIds.length ? { text: texto, media: { media_ids: mediaIds.map(String) } } : { text: texto };
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: cabecera(oauth), 'Content-Type': 'application/json', 'User-Agent': 'FantasyManager/0.1' },
    body: JSON.stringify(cuerpoTweet),
    signal: AbortSignal.timeout(20000),
  });
  const cuerpo = await r.text();
  let j = null; try { j = JSON.parse(cuerpo); } catch { /* texto */ }
  return { ok: r.status === 201, estado: r.status, id: j && j.data && j.data.id, cuerpo: cuerpo.slice(0, 400) };
}

/** sube una imagen PNG para un tweet: POST /2/media/upload con cuerpo JSON (la imagen en base64, categoría tweet_image).
    Con cuerpo JSON la firma OAuth no lleva parámetros, como en /2/tweets. Devuelve { ok, estado, id, cuerpo }. Sin reintentos. */
export async function subirImagen(png, claves, { base = process.env.X_API_BASE || 'https://api.x.com' } = {}) {
  if (!png || png.length < 8 || png[0] !== 0x89) throw new Error('no es un PNG');
  if (png.length > 5 * 1024 * 1024) throw new Error(`imagen de ${png.length} bytes: X no acepta más de 5 MB`);
  const url = `${base}/2/media/upload`;
  const oauth = firmar({ metodo: 'POST', url, claves, nonce: crypto.randomBytes(16).toString('hex'), marca: String(Math.floor(Date.now() / 1000)) });
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: cabecera(oauth), 'Content-Type': 'application/json', 'User-Agent': 'FantasyManager/0.1' },
    body: JSON.stringify({ media: Buffer.from(png).toString('base64'), media_category: 'tweet_image', media_type: 'image/png' }),
    signal: AbortSignal.timeout(30000),
  });
  const cuerpo = await r.text();
  let j = null; try { j = JSON.parse(cuerpo); } catch { /* texto */ }
  const id = j && j.data && j.data.id;
  return { ok: r.status >= 200 && r.status < 300 && !!id, estado: r.status, id, cuerpo: cuerpo.slice(0, 400) };
}

/** comprueba las claves sin publicar nada: GET /2/users/me firmado. Devuelve { ok, estado, usuario, cuerpo } */
export async function comprobar(claves, { base = process.env.X_API_BASE || 'https://api.x.com' } = {}) {
  const url = `${base}/2/users/me`;
  const oauth = firmar({ metodo: 'GET', url, claves, nonce: crypto.randomBytes(16).toString('hex'), marca: String(Math.floor(Date.now() / 1000)) });
  const r = await fetch(url, { headers: { Authorization: cabecera(oauth), 'User-Agent': 'FantasyManager/0.1' }, signal: AbortSignal.timeout(20000) });
  const cuerpo = await r.text();
  let j = null; try { j = JSON.parse(cuerpo); } catch { /* texto */ }
  return { ok: r.status === 200, estado: r.status, usuario: j && j.data && j.data.username, cuerpo: cuerpo.slice(0, 400) };
}
