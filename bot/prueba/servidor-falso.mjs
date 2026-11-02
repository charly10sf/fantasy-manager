// Servidor falso de X para probar el publicador de punta a punta sin tocar X: responde 201 a POST /2/tweets (comprueba que lleva una
// cabecera OAuth firmada y un texto) y 200 a GET /2/users/me. GET /__resumen cuenta lo recibido.
import http from 'node:http';
const recibidos = []; let firmados = 0;
http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    const aut = req.headers.authorization || '';
    const firmado = /^OAuth /.test(aut) && /oauth_signature="/.test(aut) && /oauth_consumer_key="/.test(aut) && /oauth_nonce="/.test(aut);
    const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/2/tweets') {
      let t = ''; try { t = JSON.parse(cuerpo).text; } catch { /* nada */ }
      if (!firmado || !t) return json(401, { title: 'Unauthorized' });
      firmados++; recibidos.push(t);
      return json(201, { data: { id: `falso-${recibidos.length}`, text: t } });
    }
    if (req.method === 'GET' && req.url === '/2/users/me') return firmado ? json(200, { data: { username: 'cuenta_falsa' } }) : json(401, {});
    if (req.url === '/__resumen') return json(200, { total: recibidos.length, unicos: new Set(recibidos).size, firmados, maxLargo: Math.max(0, ...recibidos.map((t) => [...t].length)) });
    json(404, {});
  });
}).listen(8787, '127.0.0.1');
