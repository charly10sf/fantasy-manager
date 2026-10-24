// Los avisos de fallos de la app, para que Claude los revise (lo lanza .github/workflows/fallos.yml).
// Lee los avisos del almacén KV del Worker («VINCULOS», claves f:<cuenta>:<id>) con la API de Cloudflare y los deja
// en fallos.enc cifrados con la llave pública que se le pasa al lanzarla (RSA-OAEP + AES-256-GCM): solo los abre
// quien tiene la privada, que no sale del chat que la creó (.github/fallos-leer.mjs). El repo es público y los
// artefactos también; en el registro solo sale cuántos hay. Lanzarla solo pueden los que escriben en el repo.
// Con RESPUESTAS ([{ id | buscar, respuesta, por? }], sin datos de nadie: se ve en la Action) contesta esos avisos y al que
// lo mandó le llega la respuesta en la app.
import { constants, createCipheriv, publicEncrypt, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { CLOUDFLARE_API_TOKEN: T, CLOUDFLARE_ACCOUNT_ID: A, LLAVE = '', RESPUESTAS = '' } = process.env;
if (!T || !A) { console.log('::error::Faltan CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID'); process.exit(1); }
const pem = Buffer.from(LLAVE.trim(), 'base64').toString('utf8');
if (!/BEGIN PUBLIC KEY/.test(pem)) { console.log('::error::Falta la llave pública (node .github/fallos-leer.mjs llave)'); process.exit(1); }

function cifrar(txt) {
  const k = randomBytes(32), iv = randomBytes(12), c = createCipheriv('aes-256-gcm', k, iv);
  const d = Buffer.concat([c.update(txt, 'utf8'), c.final()]);
  const kc = publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, k);
  return JSON.stringify({ k: kc.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), d: d.toString('base64') });
}

const API = `https://api.cloudflare.com/client/v4/accounts/${A}/storage/kv/namespaces`;
async function cf(ruta, op = {}) {
  const r = await fetch(`${API}${ruta}`, { ...op, headers: { Authorization: `Bearer ${T}`, ...(op.headers || {}) } });
  if (!r.ok) throw new Error(`Cloudflare ${r.status} en ${ruta.split('?')[0].replace(/values\/.*/, 'values/…')}`);
  return r;
}

const ns = (await (await cf('?per_page=100')).json()).result.find((n) => /^(fantasy-manager-)?VINCULOS$/.test(n.title));
if (!ns) { console.log('::error::No encuentro el almacén VINCULOS'); process.exit(1); }
const base = `/${ns.id}`;

// todas las claves de avisos, con su resumen
const claves = [];
let cursor = '';
do {
  const j = await (await cf(`${base}/keys?prefix=f:&limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)).json();
  claves.push(...j.result);
  cursor = j.result_info && j.result_info.cursor;
} while (cursor);
const leer = async (k) => JSON.parse(await (await cf(`${base}/values/${encodeURIComponent(k)}`)).text());
// el mismo resumen que guarda el Worker (worker/src/index.js)
const corta = (x, n) => String(x == null ? '' : x).slice(0, n);
const resumen = (f) => ({ t: f.t, quien: corta(f.quien, 40), equipo: corta(f.equipo, 40), txt: corta(String(f.texto || '').replace(/\s+/g, ' '), 90), r: f.respondida || 0, v: f.vista ? 1 : 0 });

// las respuestas
let contestados = 0;
if (RESPUESTAS.trim()) {
  // cada respuesta va a un aviso por su id o, si no se tiene, por un trozo de su texto («buscar»: a los que estén sin
  // contestar y lo lleven al principio)
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  for (const { id, buscar, respuesta, por } of JSON.parse(RESPUESTAS)) {
    if (!String(respuesta || '').trim()) continue;
    const ks = id ? claves.filter((x) => x.name.endsWith(`:${id}`))
      : buscar ? claves.filter((x) => x.metadata && !x.metadata.r && norm(x.metadata.txt).includes(norm(buscar))) : [];
    for (const k of ks) {
    const f = await leer(k.name);
    f.respuesta = String(respuesta).trim().slice(0, 2000); f.respondida = Date.now(); f.vista = false; f.por = corta(por || 'Fantasy Manager', 40);
    const fd = new FormData();
    fd.append('value', JSON.stringify(f));
    fd.append('metadata', JSON.stringify(resumen(f)));
    await cf(`${base}/values/${encodeURIComponent(k.name)}?expiration_ttl=${180 * 86400}`, { method: 'PUT', body: fd });
    contestados++;
    }
  }
}

// los avisos, del más nuevo al más viejo (sin el número de cuenta)
const avisos = [];
for (const k of claves.sort((a, b) => ((b.metadata || {}).t || 0) - ((a.metadata || {}).t || 0)).slice(0, 150)) {
  const { uid, ...f } = await leer(k.name);
  void uid;
  avisos.push(f);
}
writeFileSync('fallos.enc', cifrar(JSON.stringify({ t: Date.now(), avisos })));
console.log(`::notice::${avisos.length} avisos (${avisos.filter((f) => !f.respondida).length} sin contestar)${contestados ? `, ${contestados} contestados ahora` : ''}`);
