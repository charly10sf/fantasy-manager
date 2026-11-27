// Para Claude: abre los avisos de fallos que deja la Action «Fallos».
//   node .github/fallos-leer.mjs llave              → crea (o reutiliza) la llave de este chat y saca la pública
//   node .github/fallos-leer.mjs leer fallos.enc    → los avisos, legibles (DIAG=1 para ver también el diagnóstico;
//                                                      CAPTURAS=<carpeta> guarda ahí las de los que esperan respuesta)
//   el fallos.enc de la última vez: git -C <clon> fetch -q origin main && git -C <clon> reset -q --hard FETCH_HEAD (repo privado fantasy-manager-avisos)
// (0.8.4) Cada aviso es una conversación: sale entera, mensaje a mensaje, y «esperando respuesta» es que el último es de
// quien lo mandó. Las capturas se guardan como <id>-<mensaje>-<n>.<ext>. Los fallos.enc de antes (con `avisos`) también
// se leen.
// La privada se queda en ~/.fm/fallos.key, fuera del repo, y no se sube a ningún sitio: cada chat nuevo crea la suya.
import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [, , que, archivo] = process.argv;
const dir = join(homedir(), '.fm'), priv = join(dir, 'fallos.key'), pub = join(dir, 'fallos.pub');

/** un aviso de los fallos.enc de antes (una respuesta como mucho) como hilo */
const comoHilo = (a) => ({
  ...a, de: a.respondida ? 'd' : 'u',
  msgs: [{ n: 0, de: 'u', t: a.t, texto: a.texto, caps: a.capturas || 0, imagenes: a.imagenes }, ...(a.respondida ? [{ n: 1, de: 'd', t: a.respondida, texto: a.respuesta, por: a.por }] : [])],
  vu: a.respondida && a.vista ? a.respondida : 0, vd: a.respondida || 0,
});

if (que === 'llave') {
  if (!existsSync(priv)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    writeFileSync(priv, privateKey, { mode: 0o600 });
    writeFileSync(pub, publicKey);
  }
  console.log(Buffer.from(readFileSync(pub, 'utf8')).toString('base64'));
} else if (que === 'leer' && archivo) {
  const { k, iv, tag, d } = JSON.parse(readFileSync(archivo, 'utf8'));
  const clave = privateDecrypt({ key: readFileSync(priv, 'utf8'), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(k, 'base64'));
  const dc = createDecipheriv('aes-256-gcm', clave, Buffer.from(iv, 'base64'));
  dc.setAuthTag(Buffer.from(tag, 'base64'));
  const j = JSON.parse(Buffer.concat([dc.update(Buffer.from(d, 'base64')), dc.final()]).toString('utf8'));
  const hilos = j.hilos || (j.avisos || []).map(comoHilo);
  const f = (x) => (x ? new Date(x).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '');
  console.log(`Avisos a ${f(j.t)}: ${hilos.length} (${hilos.filter((h) => h.de === 'u' && !h.cer).length} esperando respuesta)\n`);
  for (const h of hilos) {
    console.log(`## ${h.id} · ${f(h.t)} · ${h.equipo || ''}${h.quien ? ` (${h.quien})` : ''} · ${h.app || ''}${h.de === 'u' ? (h.cer ? ' · DADO POR TERMINADO' : ' · ESPERANDO RESPUESTA') : ''}`);
    const ultD = [...(h.msgs || [])].reverse().find((m) => m.de === 'd');
    for (const m of h.msgs || []) {
      // (0.8.4c) lo contestado desde la app lleva quién lo escribió (el dueño o quien ayuda); lo de la Action, no
      const quien = m.de === 'd' ? `→ ${m.por || 'Fantasy Manager'}${m.aut ? ` (lo escribió ${m.aut})` : ''}` : '·';
      console.log(`${quien} ${f(m.t)}${m === ultD ? (h.vu >= m.t ? ' (leído)' : ' (sin leer)') : ''}: ${m.texto}`);
      if (m.caps) {
        const guardadas = [];
        if (process.env.CAPTURAS && m.imagenes) {
          mkdirSync(process.env.CAPTURAS, { recursive: true });
          m.imagenes.forEach((img, n) => {
            const x = /^data:image\/(\w+);base64,(.+)$/.exec(img || '');
            if (!x) return;
            const ruta = join(process.env.CAPTURAS, `${h.id}-${m.n}-${n + 1}.${x[1] === 'jpeg' ? 'jpg' : x[1]}`);
            writeFileSync(ruta, Buffer.from(x[2], 'base64'));
            guardadas.push(ruta);
          });
        }
        console.log(`  ${guardadas.length ? `(capturas: ${guardadas.join(', ')})` : `(${m.caps} captura${m.caps > 1 ? 's' : ''}${m.imagenes ? '' : ': en la bandeja de la app'})`}`);
      }
    }
    if (process.env.DIAG && h.diag) console.log(`\n--- diagnóstico ---\n${h.diag}`);
    console.log('');
  }
} else {
  console.error('Uso: node .github/fallos-leer.mjs llave | leer <fallos.enc>');
  process.exit(1);
}
