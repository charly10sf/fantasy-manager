// Lectura de un solo uso (3 nov 2026, pedida por Carlos): los 100 últimos tweets propios (sin retuits ni respuestas)
// de tres cuentas de fantasy, con sus imágenes, fotogramas de vídeo y enlaces, para estudiar su estilo.
// Coste: 300 posts × 0,005 $ + 3 perfiles × 0,01 $ ≈ 1,53 $. Una sola página por cuenta, sin expandir tweets citados.
// Todo sale cifrado (ver x-lectura.yml): nada de esas cuentas queda legible en el repo público ni en el log.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { firmar, cabecera, clavesDelEntorno } from '../bot/lib/x.mjs';

const CUENTAS = ['JoseCarrasco_98', 'AnaliticaLaLiga', 'futbol_fantasy'];
const BASE = 'https://api.x.com';
const SAL = process.argv[2] || 'salida';
fs.mkdirSync(path.join(SAL, 'media'), { recursive: true });

const { claves, faltan } = clavesDelEntorno();
if (faltan.length) { console.log('Faltan secretos:', faltan.join(', ')); process.exit(1); }

async function get(ruta, params) {
  const url = BASE + ruta;
  const oauth = firmar({ metodo: 'GET', url, params, claves, nonce: crypto.randomBytes(16).toString('hex'), marca: String(Math.floor(Date.now() / 1000)) });
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`${url}?${q}`, { headers: { Authorization: cabecera(oauth), 'User-Agent': 'FantasyManager/0.1' }, signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  if (r.status !== 200) { console.log(`HTTP ${r.status} en ${ruta}: ${t.slice(0, 300)}`); process.exit(1); }
  return JSON.parse(t);
}

async function bajar(url, destino, max = 60e6) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return false;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > max) return false;
    fs.writeFileSync(destino, b);
    return true;
  } catch { return false; }
}

const usuarios = await get('/2/users/by', { usernames: CUENTAS.join(','), 'user.fields': 'description,public_metrics,created_at' });
console.log('Perfiles:', (usuarios.data || []).length);
const todo = { leido: new Date().toISOString(), usuarios: usuarios.data, cuentas: {} };

for (const u of usuarios.data || []) {
  const r = await get(`/2/users/${u.id}/tweets`, {
    max_results: '100',
    exclude: 'retweets,replies',
    'tweet.fields': 'created_at,public_metrics,entities,attachments,referenced_tweets,note_tweet,lang',
    expansions: 'attachments.media_keys',
    'media.fields': 'type,url,preview_image_url,variants,alt_text,width,height,duration_ms,public_metrics',
  });
  const tweets = r.data || [];
  const media = (r.includes && r.includes.media) || [];
  console.log(`${u.username}: ${tweets.length} tweets, ${media.length} adjuntos`);
  const dir = path.join(SAL, 'media', u.username);
  fs.mkdirSync(dir, { recursive: true });
  for (const m of media) {
    m.archivos = [];
    const img = m.type === 'photo' ? m.url : m.preview_image_url;
    if (img) {
      const f = path.join(dir, `${m.media_key}.jpg`);
      const u2 = img.includes('pbs.twimg.com') ? `${img}?format=jpg&name=medium` : img;
      if (await bajar(u2, f, 15e6)) m.archivos.push(path.relative(SAL, f));
    }
    if ((m.type === 'video' || m.type === 'animated_gif') && m.variants) {
      const mp4 = m.variants.filter((v) => v.content_type === 'video/mp4').sort((a, b) => (a.bit_rate || 0) - (b.bit_rate || 0))[0];
      const tmp = path.join(SAL, 'tmp.mp4');
      if (mp4 && await bajar(mp4.url, tmp)) {
        const dur = (m.duration_ms || 6000) / 1000;
        for (const [i, p] of [0.1, 0.35, 0.6, 0.9].entries()) {
          const f = path.join(dir, `${m.media_key}_f${i}.jpg`);
          try {
            execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String((dur * p).toFixed(2)), '-i', tmp, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '5', f]);
            if (fs.existsSync(f)) m.archivos.push(path.relative(SAL, f));
          } catch { /* fotograma que no sale */ }
        }
        fs.rmSync(tmp, { force: true });
      }
    }
  }
  todo.cuentas[u.username] = { tweets, media };
}

fs.writeFileSync(path.join(SAL, 'tweets.json'), JSON.stringify(todo, null, 1));
const n = Object.values(todo.cuentas).reduce((s, c) => s + c.tweets.length, 0);
console.log(`Total: ${n} tweets leídos (≈ ${(n * 0.005 + (usuarios.data || []).length * 0.01).toFixed(2)} $)`);
