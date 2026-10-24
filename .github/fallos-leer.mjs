// Para Claude: abre los avisos de fallos que deja la Action «Fallos».
//   node .github/fallos-leer.mjs llave              → crea (o reutiliza) la llave de este chat y saca la pública
//   node .github/fallos-leer.mjs leer fallos.enc    → los avisos, legibles (DIAG=1 para ver también el diagnóstico)
// La privada se queda en ~/.fm/fallos.key, fuera del repo, y no se sube a ningún sitio: cada chat nuevo crea la suya.
import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [, , que, archivo] = process.argv;
const dir = join(homedir(), '.fm'), priv = join(dir, 'fallos.key'), pub = join(dir, 'fallos.pub');

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
  const { t, avisos } = JSON.parse(Buffer.concat([dc.update(Buffer.from(d, 'base64')), dc.final()]).toString('utf8'));
  const f = (x) => (x ? new Date(x).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '');
  console.log(`Avisos a ${f(t)}: ${avisos.length} (${avisos.filter((a) => !a.respondida).length} sin contestar)\n`);
  for (const a of avisos) {
    console.log(`## ${a.id} · ${f(a.t)} · ${a.equipo || ''}${a.quien ? ` (${a.quien})` : ''} · ${a.app || ''}`);
    console.log(a.texto);
    if (a.capturas) console.log(`(${a.capturas} captura${a.capturas > 1 ? 's' : ''}: en la bandeja de la app)`);
    if (a.respondida) console.log(`→ ${a.por || 'Respuesta'} (${f(a.respondida)}${a.vista ? ', leída' : ', sin leer'}): ${a.respuesta}`);
    if (process.env.DIAG && a.diag) console.log(`\n--- diagnóstico ---\n${a.diag}`);
    console.log('');
  }
} else {
  console.error('Uso: node .github/fallos-leer.mjs llave | leer <fallos.enc>');
  process.exit(1);
}
