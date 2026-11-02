// Telegram falso para probar el envío de punta a punta sin tocar Telegram: acepta POST /bot<TOKEN>/sendMessage con el token y el chat
// esperados (TELEGRAM_FALSO_TOKEN / TELEGRAM_FALSO_CHAT, por defecto TOKENFALSO y 12345) y un texto; con otro token contesta 401 y,
// a propósito, repite la ruta en el error (así se comprueba que el bot nunca deja el token en sus logs).
// GET /__resumen cuenta lo recibido; GET /__mensajes lo enseña.
import http from 'node:http';
const TOKEN = process.env.TELEGRAM_FALSO_TOKEN || 'TOKENFALSO';
const CHAT = process.env.TELEGRAM_FALSO_CHAT || '12345';
const recibidos = [];
http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url === '/__resumen') return json(200, { total: recibidos.length, unicos: new Set(recibidos).size, maxLargo: Math.max(0, ...recibidos.map((t) => [...t].length)) });
    if (req.url === '/__mensajes') return json(200, recibidos);
    const m = /^\/bot([^/]+)\/sendMessage$/.exec(req.url);
    if (req.method !== 'POST' || !m) return json(404, { ok: false, error_code: 404, description: 'Not Found' });
    if (m[1] !== TOKEN) return json(401, { ok: false, error_code: 401, description: `Unauthorized (${req.url})` });
    let p = {}; try { p = JSON.parse(cuerpo); } catch { /* nada */ }
    if (String(p.chat_id) !== CHAT || !p.text) return json(400, { ok: false, error_code: 400, description: 'Bad Request: chat not found o texto vacío' });
    if (p.parse_mode !== 'HTML') return json(400, { ok: false, error_code: 400, description: 'se esperaba parse_mode HTML' });
    if (p.text.length > 4096) return json(400, { ok: false, error_code: 400, description: 'message is too long' });
    recibidos.push(p.text);
    json(200, { ok: true, result: { message_id: recibidos.length, chat: { id: Number(CHAT) }, text: p.text } });
  });
}).listen(8788, '127.0.0.1');
