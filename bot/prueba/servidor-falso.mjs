// Servidor falso de X para probar el publicador de punta a punta sin tocar X: responde 201 a POST /2/tweets (comprueba que lleva una
// cabecera OAuth firmada y un texto, y que los media_ids, si los hay, se han subido antes), 200 a POST /2/media/upload (comprueba
// que la imagen es un PNG en base64 de categoría tweet_image; con SUBIDA_FALLA=1 contesta 403) y 200 a GET /2/users/me.
// GET /__resumen cuenta lo recibido; con GUARDAR=<carpeta> deja ahí las imágenes subidas.
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
const recibidos = []; let firmados = 0, duplicados = 0;
const subidas = new Map(); let conImagen = 0, imagenesUsadas = 0;
const GUARDAR = process.env.GUARDAR; if (GUARDAR) mkdirSync(GUARDAR, { recursive: true });
http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    const aut = req.headers.authorization || '';
    const firmado = /^OAuth /.test(aut) && /oauth_signature="/.test(aut) && /oauth_consumer_key="/.test(aut) && /oauth_nonce="/.test(aut);
    const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/2/tweets') {
      let t = '', ids = []; try { const c = JSON.parse(cuerpo); t = c.text; ids = (c.media && c.media.media_ids) || []; } catch { /* nada */ }
      if (!firmado || !t) return json(401, { title: 'Unauthorized' });
      if (ids.length > 4 || ids.some((i) => !subidas.has(String(i)))) return json(400, { title: 'Invalid Request', detail: 'media_ids desconocidos' });
      if (ids.length) { conImagen++; imagenesUsadas += ids.length; }
      if (recibidos.includes(t)) { duplicados++; return json(403, { detail: 'You are not allowed to create a Tweet with duplicate content.', title: 'Forbidden', status: 403 }); }
      firmados++; recibidos.push(t);
      return json(201, { data: { id: `falso-${recibidos.length}`, text: t } });
    }
    if (req.method === 'POST' && req.url === '/2/media/upload') {
      if (!firmado) return json(401, { title: 'Unauthorized' });
      if (process.env.SUBIDA_FALLA === '1') return json(403, { title: 'Forbidden', detail: 'subida rechazada (prueba)' });
      let c = null; try { c = JSON.parse(cuerpo); } catch { /* nada */ }
      const b = c && c.media ? Buffer.from(c.media, 'base64') : null;
      if (!b || b[0] !== 0x89 || b.toString('ascii', 1, 4) !== 'PNG' || c.media_category !== 'tweet_image' || c.media_type !== 'image/png') return json(400, { title: 'Invalid Request' });
      const id = String(1880000000000000000n + BigInt(subidas.size + 1));
      subidas.set(id, b.length);
      if (GUARDAR) writeFileSync(`${GUARDAR}/subida-${subidas.size}.png`, b);
      return json(200, { data: { id, media_key: `3_${id}`, expires_after_secs: 86400 } });
    }
    if (req.method === 'GET' && req.url === '/2/users/me') return firmado ? json(200, { data: { username: 'cuenta_falsa' } }) : json(401, {});
    if (req.url === '/__resumen') return json(200, { total: recibidos.length, unicos: new Set(recibidos).size, firmados, duplicados, subidas: subidas.size, conImagen, imagenesUsadas, maxLargo: Math.max(0, ...recibidos.map((t) => [...t].length)) });
    json(404, {});
  });
}).listen(8787, '127.0.0.1');
