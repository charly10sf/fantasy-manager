// Los avisos de fallos de la app, para que Claude los revise (lo lanza .github/workflows/fallos.yml).
// (0.8.4) Cada aviso es una conversación (un hilo con todos los mensajes de quien lo mandó y de Fantasy Manager) y vive en
// un Durable Object del Worker, no en el KV: se piden al Worker (POST /fallos/accion) con la llave FALLOS_CLAVE, que es el
// sha256 de «fallos|» más el token de Cloudflare (worker.yml la pone en el Worker igual). Se dejan en fallos.enc cifrados
// con la llave pública que se le pasa al lanzarla (RSA-OAEP + AES-256-GCM): solo los abre quien tiene la privada, que no
// sale del chat que la creó (.github/fallos-leer.mjs). La Action lo deja en el repo privado charly10sf/fantasy-manager-avisos
// (Claude no puede bajar artefactos, pero sí leer ese repo con git). En el registro solo sale cuántos hay. Lanzarla solo
// pueden los que escriben en el repo.
// Con RESPUESTAS ([{ id | buscar, respuesta }], sin datos de nadie: se ve en la Action) AÑADE un mensaje de Fantasy
// Manager a esos hilos (ya no pisa la respuesta anterior) y a quien lo mandó le llega en la app.
import { constants, createCipheriv, createHash, publicEncrypt, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { CLOUDFLARE_API_TOKEN: T, LLAVE = '', RESPUESTAS = '', WORKER = 'https://fantasy-manager.fantasymanager-web-app.workers.dev' } = process.env;
if (!T) { console.log('::error::Falta CLOUDFLARE_API_TOKEN (de él sale la llave de los avisos)'); process.exit(1); }
const pem = Buffer.from(LLAVE.trim(), 'base64').toString('utf8');
if (!/BEGIN PUBLIC KEY/.test(pem)) { console.log('::error::Falta la llave pública (node .github/fallos-leer.mjs llave)'); process.exit(1); }
const CLAVE = createHash('sha256').update(`fallos|${T}`).digest('hex');

function cifrar(txt) {
  const k = randomBytes(32), iv = randomBytes(12), c = createCipheriv('aes-256-gcm', k, iv);
  const d = Buffer.concat([c.update(txt, 'utf8'), c.final()]);
  const kc = publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, k);
  return JSON.stringify({ k: kc.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), d: d.toString('base64') });
}
async function worker(cuerpo) {
  const r = await fetch(`${WORKER}/fallos/accion`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-fallos-clave': CLAVE }, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error(`el Worker contesta ${r.status} a «${cuerpo.op}»${r.status === 404 ? ' (¿se ha publicado el Worker de la 0.8.4 con su llave?)' : ''}`);
  return r.json();
}

try {
  // las respuestas: cada una va a un hilo por su id o, si no se tiene, a los que esperan respuesta y llevan ese trozo
  let contestados = 0;
  if (RESPUESTAS.trim()) contestados = (await worker({ op: 'contestar', respuestas: JSON.parse(RESPUESTAS) })).n || 0;

  // los hilos, del último movimiento al más viejo (sin el número de cuenta); los que esperan respuesta, con sus capturas
  // (las de todos sus mensajes), para que Claude las vea sin que nadie se las pase
  const { lista = [] } = await worker({ op: 'leer', max: 150 });
  for (const h of lista) {
    if (h.de !== 'u') continue;
    for (const m of h.msgs || []) {
      if (!m.caps) continue;
      m.imagenes = [];
      for (let n = 0; n < Math.min(3, m.caps); n++) {
        try { m.imagenes.push((await worker({ op: 'captura', id: h.id, m: m.n, n })).img); } catch (e) { m.imagenes.push(null); }
      }
    }
  }
  writeFileSync('fallos.enc', cifrar(JSON.stringify({ t: Date.now(), hilos: lista })));
  console.log(`::notice::${lista.length} avisos (${lista.filter((h) => h.de === 'u').length} esperando respuesta)${contestados ? `, ${contestados} contestados ahora` : ''}`);
} catch (e) {
  console.log(`::error::${e.message}`);
  process.exit(1);
}
